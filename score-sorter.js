/* Local-only PDF analysis and reviewed cover publishing. Original media is never uploaded. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id), M=window.ScoreModel;
  const state={rows:[],reader:null,busy:false,stopped:false,publishing:false,dependencies:null,videoCount:0,pdfBytes:0};
  const escape=value=>window.scoreAdminBridge.escape(value);
  const safeMessage=error=>String(error?.message||error||'The file could not be read.').slice(0,280);
  const MAX_PDF=50*1024*1024,MAX_TOTAL_PDF=512*1024*1024,MAX_ENTRIES=20000;
  function error(message=''){$('import-error').textContent=message;if(message){$('import-error').tabIndex=-1;$('import-error').focus();}}
  const quantity=(count,noun)=>count+' '+noun+(count===1?'':'s');
  function status(message){$('import-status').textContent=message;}
  function loadScript(url) {
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=()=>reject(Error('The local ZIP reader could not load. Reload the page and try again.'));document.head.appendChild(script);});
  }
  async function dependencies() {
    if(!state.dependencies)state.dependencies=(async()=>{
      await loadScript('vendor/zipjs/zip-native.min.js');
      zip.configure({workerURI:new URL('vendor/zipjs/zip-web-worker-native.js',document.baseURI).href,useWebWorkers:true});
      const pdf=await import('./vendor/pdfjs/pdf.min.mjs');
      pdf.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;
      return pdf;
    })().catch(reason=>{state.dependencies=null;throw reason;});
    return state.dependencies;
  }
  function normalizePath(path) {
    const normalized=String(path).replace(/\\/g,'/');
    if(normalized.startsWith('/')||/^[a-z]:/i.test(normalized)||normalized.split('/').some(part=>part==='..'))throw Error('The archive contains an unsafe folder path. Choose another archive.');
    return normalized.replace(/^\.\//,'');
  }
  function admin(){if(!window.scoreAdminBridge.isAdmin)throw Error('Sign in as admin to import arrangements.');}
  async function clearQueue(ask=true) {
    if(state.busy||state.publishing){error('Stop the current scan before clearing the queue.');return false;}
    if(ask&&state.rows.some(row=>row.status==='ready'&&!row.published)&&!window.confirm('Clear the reviewed arrangements? Unsaved recommendations will be lost.'))return false;
    for(const row of state.rows)if(row.coverUrl)URL.revokeObjectURL(row.coverUrl);
    if(state.reader){await state.reader.close();state.reader=null;}
    state.rows=[];state.videoCount=0;state.pdfBytes=0;
    $('score-zip').value='';$('score-folder').value='';$('import-review').hidden=true;$('import-rows').replaceChildren();$('import-progress').value=0;error();status('Choose an archive or folder to begin.');return true;
  }
  async function start(files,archive) {
    if(!files?.length)return;
    const selected=[...files];
    try{
      admin();if(!await clearQueue(true))return;
      state.busy=true;controls();status('Reading folder structure…');await dependencies();
      let entries=[];
      if(archive){
        const file=selected[0];state.reader=new zip.ZipReader(new zip.BlobReader(file),{checkSignature:true});
        let entryCount=0;
        for await(const entry of state.reader.getEntriesGenerator()){
          if(++entryCount>MAX_ENTRIES)throw Error('This archive contains too many entries. Import fewer than 20,000 files at a time.');
          if(entry.directory)continue;
          const path=normalizePath(entry.filename);
          if(/\.mp4$/i.test(path)){state.videoCount++;continue;}
          if(!/\.(pdf|txt)$/i.test(path))continue;
          const size=entry.uncompressedSize;
          entries.push({path,size,read:async()=>entry.getData(new zip.Uint8ArrayWriter())});
        }
      }else{
        if(selected.length>MAX_ENTRIES)throw Error('Import fewer than 20,000 files at a time.');
        entries=selected.flatMap(file=>{
          const path=normalizePath(file.webkitRelativePath||file.name);
          if(/\.mp4$/i.test(path)){state.videoCount++;return[];}
          return /\.(pdf|txt)$/i.test(path)?[{path,size:file.size,read:async()=>new Uint8Array(await file.arrayBuffer())}]:[];
        });
      }
      const names=new Set();for(const entry of entries){if(names.has(entry.path))throw Error('The archive contains duplicate paths: '+entry.path);names.add(entry.path);if(/\.pdf$/i.test(entry.path)){if(entry.size>MAX_PDF)throw Error('A PDF exceeds 50 MB: '+entry.path);state.pdfBytes+=entry.size;}else if(entry.size>65536)throw Error('A link text file exceeds 64 KB: '+entry.path);}
      if(state.pdfBytes>MAX_TOTAL_PDF)throw Error('The PDFs exceed 512 MB. Import a smaller selection; videos do not count toward this limit.');
      const groups=M.groupEntries(entries);if(!groups.length)throw Error('No PDFs were found. Choose a folder or ZIP containing score PDFs.');
      const library=window.scoreAdminBridge.library($('import-destination').value);
      const defaults=new Set();
      state.rows=groups.map((group,index)=>{
        const songKey=M.key(group.songFolder.split('/').pop());
        const matches=library.filter(song=>M.key(song.title).includes(songKey)||song.sourceKey===songKey||M.key(song.title).replace(/racing into the night/,'into the night')===songKey);
        const isDefault=!defaults.has(songKey);defaults.add(songKey);
        return {index,group,songKey,conductor:group.pdfs[0].path,status:'queued',selected:true,isDefault,existingId:matches.length===1?matches[0].id:'',japaneseTitle:'',englishTitle:'',artist:'',label:group.folder===group.songFolder?'':group.folder.split('/').pop(),ensemble:'',instruments:'',genre:'',driveLink:'',dirty:new Set(),cover:null,coverUrl:'',notes:[],published:false};
      });
      $('import-progress').max=state.rows.length;$('import-review').hidden=false;renderRows();
      state.stopped=false;await scanRows();
    }catch(reason){error(safeMessage(reason));status('Import paused. Correct the issue and choose the files again.');}
    finally{state.busy=false;controls();}
  }
  function textLines(items,page) {
    const lines=[];const [x0,y0,x1,y1]=page.view;
    for(const item of items){
      const text=String(item.str||'').trim();if(!text)continue;
      const x=item.transform[4],y=item.transform[5],size=Math.hypot(item.transform[0],item.transform[1]);
      let line=lines.find(line=>Math.abs(line.y-y)<2&&Math.abs(line.size-size)<2);
      if(!line){line={parts:[],y,size,x,width:0};lines.push(line);}
      if(!line.parts.some(part=>part.text===text&&Math.abs(part.x-x)<2))line.parts.push({x,text,width:item.width||0});
      line.x=Math.min(line.x,x);line.width=Math.max(line.width,x+(item.width||0)-line.x);
    }
    return lines.map(line=>{
      const parts=line.parts.sort((a,b)=>a.x-b.x);let text='';
      for(const part of parts){const tight=/[\u3040-\u9fff]$/.test(text)&&/^[\u3040-\u9fff]/.test(part.text);text+=(text&&!tight?' ':'')+part.text;}
      return{text:text.replace(/\s+/g,' ').trim(),size:line.size,yRatio:(line.y-y0)/(y1-y0),centerRatio:(line.x+line.width/2-x0)/(x1-x0)};
    }).sort((a,b)=>b.yRatio-a.yRatio);
  }
  async function analyze(row) {
    const entry=row.group.pdfs.find(entry=>entry.path===row.conductor);if(!entry)throw Error('Choose a conductor PDF from this arrangement.');
    const pdf=await dependencies();let documentTask;
    try{
      const bytes=await entry.read();if(bytes.byteLength>MAX_PDF)throw Error('The PDF exceeds the processing limit.');
      documentTask=pdf.getDocument({data:bytes,isEvalSupported:false,useWasm:false,cMapUrl:new URL('vendor/pdfjs/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('vendor/pdfjs/standard_fonts/',document.baseURI).href,iccUrl:new URL('vendor/pdfjs/iccs/',document.baseURI).href});
      const pdfDocument=await documentTask.promise,page=await pdfDocument.getPage(1),content=await page.getTextContent();
      const lines=textLines(content.items,page);
      const baseName=entry.path.split('/').pop().replace(/\.pdf$/i,'');
      const names=M.titles(lines,baseName,row.group.songFolder.split('/').pop());
      const pdfText=lines.map(line=>line.text).join(' '),fileText=row.group.pdfs.map(entry=>entry.path).join(' ');
      const tags=M.detectInstruments(pdfText+' '+fileText);
      const ensemble=M.classify(tags,pdfText+' '+fileText+' '+row.group.folder);
      const suggestions={japaneseTitle:names.japanese,englishTitle:names.english,instruments:tags.join(', '),ensemble,label:row.label||ensemble};
      for(const [field,value]of Object.entries(suggestions))if(!row.dirty.has(field))row[field]=value;
      const linkFiles=row.group.entries.filter(entry=>/\.txt$/i.test(entry.path)).sort((a,b)=>a.path.split('/').length-b.path.split('/').length);
      const links=[];
      for(const file of linkFiles){const text=new TextDecoder('utf-8').decode(await file.read());const urls=text.match(/https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+(?:\?[^\s<>\)\]]*)?/g)||[];links.push(...urls);}
      const unique=[...new Set(links)];if(!row.dirty.has('driveLink'))row.driveLink=unique.length===1?unique[0]:'';
      row.notes=[];
      if(unique.length>1)row.notes.push('More than one Drive folder link was found. Choose the correct link.');
      if(!row.driveLink)row.notes.push('Drive folder link is blank. You can add it before publishing.');
      if(!pdfText.match(/[\p{L}]{3}/u))row.notes.push('This PDF has no readable text. Enter its title and instruments manually.');
      if(M.detectInstruments(baseName).length)row.notes.push('The selected PDF may be an instrument part. Check the cover or choose another file.');
      if(!row.englishTitle)row.notes.push('English title is uncertain and has been left blank.');
      const initial=page.getViewport({scale:1}),scale=Math.min(1.7,1000/initial.width,1700/initial.height),viewport=page.getViewport({scale});
      const canvas=documentCreateCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
      const cover=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));if(!cover)throw Error('The cover image could not be generated. Choose another PDF.');
      if(row.coverUrl)URL.revokeObjectURL(row.coverUrl);
      row.cover=cover;row.coverUrl=URL.createObjectURL(cover);row.coverWidth=canvas.width;row.coverHeight=canvas.height;
      canvas.width=canvas.height=1;page.cleanup();row.status='ready';row.failure='';
    }finally{if(documentTask)await documentTask.destroy();}
  }
  function documentCreateCanvas(width,height){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
  async function scanRows() {
    for(const row of state.rows){
      if(state.stopped)break;if(row.status==='ready'||row.published)continue;
      row.status='scanning';renderRow(row);status(`Scanning arrangements (${row.index+1}/${state.rows.length}): ${row.group.folder.split('/').pop()}`);
      try{await analyze(row);}catch(reason){row.status='failed';row.failure=safeMessage(reason);}
      renderRow(row);$('import-progress').value=state.rows.filter(row=>row.status==='ready'||row.status==='failed'||row.published).length;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    summary();
    const complete=state.rows.filter(row=>row.status==='ready'||row.published).length,failed=state.rows.filter(row=>row.status==='failed').length;
    status(state.stopped?`Scan paused (${complete}/${state.rows.length}). Continue when ready.`:`Scanned ${state.rows.length} arrangements. ${complete} ready${failed?', '+failed+' need attention':''}. ${state.videoCount} MP4 files skipped.`);
  }
  function controls() {
    $('score-zip').disabled=$('score-folder').disabled=state.busy||state.publishing;
    $('import-stop').hidden=!state.busy||state.publishing;
    $('import-resume').hidden=state.busy||!state.rows.some(row=>row.status==='queued'||row.status==='failed');
    $('import-publish').disabled=state.busy||state.publishing||!state.rows.some(row=>row.status==='ready'&&row.selected&&!row.published);
    $('import-clear').disabled=state.busy||state.publishing;$('import-destination').disabled=state.busy||state.publishing;
  }
  function summary() {
    const selected=state.rows.filter(row=>row.selected&&row.status==='ready'&&!row.published);
    const selectable=state.rows.filter(row=>!row.published);
    $('import-select-all').checked=selectable.length>0&&selectable.every(row=>row.selected);
    $('import-select-all').indeterminate=selectable.some(row=>row.selected)&&!$('import-select-all').checked;
    $('import-summary').textContent=`${quantity(selected.length,'arrangement')} selected in ${quantity(new Set(selected.map(row=>row.songKey)).size,'song')}. Covers and links switch with the selected arrangement.`;
    controls();
  }
  function field(row,name,label,type='text') {return `<label><span class="field-label">${label}</span><input class="ui-field" data-field="${name}" name="import-${row.index}-${name}" type="${type}" autocomplete="off" value="${escape(row[name])}" /></label>`;}
  function rowHTML(row) {
    const checked=row.selected?'checked':'',disabled=row.published||state.publishing?'disabled':'';
    const library=window.scoreAdminBridge.library($('import-destination').value);
    const title=row.japaneseTitle&&row.englishTitle?row.japaneseTitle+' - '+row.englishTitle:row.japaneseTitle||row.englishTitle||row.group.songFolder.split('/').pop();
    return `<article class="import-row" id="import-row-${row.index}" data-index="${row.index}"><div class="import-cover">${row.coverUrl?`<img src="${escape(row.coverUrl)}" width="${row.coverWidth}" height="${row.coverHeight}" alt="Generated first-page cover for ${escape(title)}" />`:`<span>${row.status==='scanning'?'Reading PDF…':'Cover preview'}</span>`}</div><div class="import-row-content"><div class="import-row-heading"><label class="checkbox-label"><input type="checkbox" data-action="select" ${checked} ${disabled} /><strong>${escape(title)}</strong></label><span class="import-state" data-state="${row.status}">${row.published?'Published':row.status==='ready'?'Ready to review':row.status==='failed'?'Needs attention':row.status==='scanning'?'Scanning…':'Queued'}</span></div><p class="import-source">${escape(row.group.folder)}</p>${row.failure?`<p class="field-error" role="alert">${escape(row.failure)} <button type="button" class="ui-btn border border-line px-3" data-action="retry">Retry</button></p><label><span class="field-label">Choose another conductor PDF</span><select class="ui-field" data-action="conductor">${row.group.pdfs.map(entry=>`<option value="${escape(entry.path)}" ${entry.path===row.conductor?'selected':''}>${escape(entry.path.slice(row.group.folder.length+1))}</option>`).join('')}</select></label>`:''}${row.status==='ready'?`<fieldset ${disabled}><legend class="sr-only">Review ${escape(title)}</legend><div class="import-fields">${field(row,'japaneseTitle','Japanese title')}${field(row,'englishTitle','English title')}${field(row,'songKey','Song group')}${field(row,'label','Arrangement label')}<label><span class="field-label">Ensemble</span><select class="ui-field" data-field="ensemble" name="import-${row.index}-ensemble">${['','Orchestra','Marching Band','Concert Band','Chamber ensemble','Solo','Other'].map(value=>`<option ${row.ensemble===value?'selected':''} value="${value}">${value||'Not set'}</option>`).join('')}</select></label>${field(row,'artist','Creator / artist')}<label class="import-wide"><span class="field-label">Conductor PDF</span><select class="ui-field" data-action="conductor" name="import-${row.index}-conductor">${row.group.pdfs.map(entry=>`<option value="${escape(entry.path)}" ${entry.path===row.conductor?'selected':''}>${escape(entry.path.slice(row.group.folder.length+1))}</option>`).join('')}</select></label>${field(row,'instruments','Instruments (comma-separated)')}${field(row,'genre','Genre')}${field(row,'driveLink','Google Drive folder link','url')}<label><span class="field-label">Add to existing song</span><select class="ui-field" data-field="existingId" name="import-${row.index}-existingId"><option value="">Create a new song group</option>${library.map(song=>`<option value="${escape(song.id)}" ${song.id===row.existingId?'selected':''}>${escape(song.title||'Untitled score')}</option>`).join('')}</select></label></div><label class="checkbox-label import-default"><input type="radio" name="import-default-${M.id(row.songKey)}" data-action="default" ${row.isDefault?'checked':''} /> Show this arrangement first for this song</label>${row.notes.length?`<ul class="import-notes">${row.notes.map(note=>`<li>${escape(note)}</li>`).join('')}</ul>`:''}</fieldset>`:''}</div></article>`;
  }
  function renderRows() {$('import-rows').innerHTML=state.rows.map(rowHTML).join('');summary();}
  function renderRow(row) {const old=$('import-row-'+row.index);if(old)old.outerHTML=rowHTML(row);else $('import-rows').insertAdjacentHTML('beforeend',rowHTML(row));summary();}
  async function rerun(row) {
    if(state.busy||state.publishing)return;
    state.busy=true;row.status='scanning';renderRow(row);controls();status('Reading the selected conductor PDF…');
    try{await analyze(row);}catch(reason){row.status='failed';row.failure=safeMessage(reason);}
    finally{state.busy=false;renderRow(row);controls();status('Review the updated cover and recommendations.');}
  }
  function bytesBase64(bytes){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
  async function github(path,method='GET',body) {
    const response=await fetch('https://api.github.com/repos/Unbranded1/Unbranded1.github.io/'+path,{method,headers:{Authorization:'Bearer '+window.scoreAdminBridge.token,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw Error(response.status===401||response.status===403?'GitHub rejected the cover upload. Check the saved token and Contents write permission.':`Cover publishing failed (${response.status}). Retry after checking your connection.`);
    return response.json();
  }
  async function publish() {
    if(state.busy||state.publishing)return;
    try{
      admin();error();const rows=state.rows.filter(row=>row.selected&&row.status==='ready'&&!row.published);if(!rows.length)return;
      if(!window.scoreAdminBridge.token){error('Save a GitHub token in Backup & Data to publish the generated cover JPGs, then return here. Your review stays in this queue.');return;}
      for(const row of rows){
        if(row.driveLink&&!/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+(?:\?[^\s<>]*)?$/.test(row.driveLink))throw Error('Use a Google Drive folder link for '+row.group.folder+'.');
        if(!row.songKey)throw Error('Enter a song group so arrangements can be grouped correctly.');
      }
      for(const songKey of new Set(rows.map(row=>row.songKey))){
        const destinations=new Set(rows.filter(row=>row.songKey===songKey).map(row=>row.existingId).filter(Boolean));
        if(destinations.size>1)throw Error('Choose the same destination song for arrangements in '+songKey+'.');
      }
      state.publishing=true;controls();renderRows();status('Saving cover JPGs…');
      const head=await github('git/ref/heads/main'),commit=await github('git/commits/'+head.object.sha),tree=[];
      for(let i=0;i<rows.length;i++){
        const row=rows[i],bytes=new Uint8Array(await row.cover.arrayBuffer());
        const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,12);
        row.publishedCover='previews/imported/'+M.id(row.group.folder)+'-'+digest+'.jpg';
        const blob=await github('git/blobs','POST',{encoding:'base64',content:bytesBase64(bytes)});
        tree.push({path:row.publishedCover,mode:'100644',type:'blob',sha:blob.sha});status(`Saving cover JPGs (${i+1}/${rows.length})…`);
      }
      const newTree=await github('git/trees','POST',{base_tree:commit.tree.sha,tree});
      const newCommit=await github('git/commits','POST',{message:'Add reviewed score cover JPGs',tree:newTree.sha,parents:[head.object.sha]});
      await github('git/refs/heads/main','PATCH',{sha:newCommit.sha,force:false});
      status('Publishing reviewed score information…');
      const payload=rows.map(row=>({songKey:row.songKey,existingId:row.existingId,isDefault:row.isDefault,japaneseTitle:row.japaneseTitle,englishTitle:row.englishTitle,title:[row.japaneseTitle,row.englishTitle].filter(Boolean).join(' - '),variant:{id:'arrangement-'+M.id(row.group.folder),sourceFolder:row.group.folder,label:row.label,ensemble:row.ensemble,arrangement:row.ensemble,artist:row.artist,tags:[...new Set([row.ensemble,...row.instruments.split(',').map(x=>x.trim())].filter(Boolean))],genres:row.genre.split(',').map(x=>x.trim()).filter(Boolean),previewImg:row.publishedCover,coverWidth:row.coverWidth,coverHeight:row.coverHeight,driveLink:row.driveLink,desc:'',video:'',audioFile:'',pdfFile:'',musescoreLink:'',difficulty:'',links:[]}}));
      const result=await window.scoreAdminBridge.commitImports($('import-destination').value,payload);
      for(const row of rows)row.published=true;
      status(`${quantity(result.arrangements,'arrangement')} in ${quantity(result.songs,'song')} ${result.live?'published':'saved to the local draft'}. Cover JPGs appear after GitHub Pages finishes deploying.`);
    }catch(reason){error(safeMessage(reason));status('Publishing needs attention. Your reviewed arrangements remain in the queue.');}
    finally{state.publishing=false;renderRows();controls();}
  }
  $('score-zip').addEventListener('change',event=>start(event.target.files,true));
  $('score-folder').addEventListener('change',event=>start(event.target.files,false));
  $('import-clear').addEventListener('click',()=>clearQueue());
  $('import-stop').addEventListener('click',()=>{state.stopped=true;status('Stopping after the current arrangement…');});
  $('import-resume').addEventListener('click',async()=>{if(state.busy)return;state.busy=true;state.stopped=false;controls();try{await scanRows();}finally{state.busy=false;controls();}});
  $('import-publish').addEventListener('click',publish);
  $('import-select-all').addEventListener('change',event=>{for(const row of state.rows)if(!row.published)row.selected=event.target.checked;renderRows();});
  $('import-destination').addEventListener('change',()=>{for(const row of state.rows)row.existingId='';renderRows();});
  $('import-rows').addEventListener('input',event=>{
    const article=event.target.closest('[data-index]');if(!article)return;const row=state.rows[Number(article.dataset.index)],field=event.target.dataset.field;
    if(field){row[field]=event.target.value.trim();row.dirty.add(field);summary();}
  });
  $('import-rows').addEventListener('change',event=>{
    const article=event.target.closest('[data-index]');if(!article)return;const row=state.rows[Number(article.dataset.index)],action=event.target.dataset.action;
    if(action==='select'){row.selected=event.target.checked;summary();}
    else if(action==='default'){state.rows.filter(other=>other.songKey===row.songKey).forEach(other=>{other.isDefault=other===row;});renderRows();}
    else if(action==='conductor'){row.conductor=event.target.value;rerun(row);}
    else if(event.target.dataset.field==='songKey'){row.songKey=M.key(row.songKey);row.isDefault=!state.rows.some(other=>other!==row&&other.songKey===row.songKey&&other.isDefault);renderRows();}
  });
  $('import-rows').addEventListener('click',event=>{if(event.target.closest('[data-action="retry"]')){const article=event.target.closest('[data-index]');rerun(state.rows[Number(article.dataset.index)]);}});
  window.addEventListener('beforeunload',event=>{if(state.busy||state.publishing||state.rows.some(row=>row.status==='ready'&&!row.published)){event.preventDefault();event.returnValue='';}});
  // Read-only diagnostics support checking large-file behavior without retaining input bytes.
  window.ScoreImporter={get summary(){return{arrangements:state.rows.length,ready:state.rows.filter(r=>r.status==='ready').length,failed:state.rows.filter(r=>r.status==='failed').length,skippedVideos:state.videoCount,pdfBytes:state.pdfBytes,busy:state.busy};}};
})();
