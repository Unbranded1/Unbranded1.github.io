/* Shared score normalization and local import analysis. */
(function (root) {
  'use strict';
  const clean = value => String(value ?? '').replaceAll(String.fromCharCode(8212), '-').trim();
  const key = value => clean(value).normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const id = value => { let hash = 2166136261; for (const c of key(value)) { hash ^= c.codePointAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); };
  const fields = ['artist','arrangement','difficulty','desc','video','previewImg','driveLink','musescoreLink','audioFile','pdfFile','sourceFolder','sourceKey','ensemble','label','coverWidth','coverHeight'];
  const webUrl=value=>/^https?:\/\//i.test(String(value||''))?clean(value):'';
  const localFile=(value,extensions)=>{
    const path=clean(value);
    if(!path)return '';
    if(typeof location!=='undefined'&&path.startsWith(location.origin+'/'))return path;
    return new RegExp('^[\\w][\\w./ %\\-]*\\.('+extensions+')$','i').test(path)&&!path.split('/').includes('..')?path:'';
  };
  const instruments = [
    ['Piccolo', /\bpiccolo(?![ _-]*trumpet)\b/i], ['Flute', /\bflutes?\b/i], ['Oboe', /\boboes?\b/i], ['English Horn', /\b(?:english[ _-]*horn|cor[ _-]*anglais)\b/i],
    ['Bassoon', /\b(?:contra)?bassoons?\b/i], ['Bass Clarinet', /\bbass[ _-]*clarinets?\b/i], ['Clarinet', /\bclarinets?\b/i],
    ['Soprano Saxophone', /\bsoprano[ _-]*sax(?:ophone)?s?\b/i], ['Alto Saxophone', /\balto[ _-]*sax(?:ophone)?s?\b/i], ['Tenor Saxophone', /\btenor[ _-]*sax(?:ophone)?s?\b/i], ['Baritone Saxophone', /\bbaritone[ _-]*sax(?:ophone)?s?\b/i], ['Saxophone', /\bsax(?:ophone)?s?\b/i],
    ['Trumpet', /\btrumpets?\b/i], ['Horn', /\bhorns?(?:[ _-]*in[ _-]*f)?\b/i], ['Trombone', /\btrombones?\b/i], ['Euphonium', /\b(?:euphoniums?|baritone[ _-]*horns?)\b/i], ['Tuba', /\btubas?\b/i], ['Sousaphone', /\bsousaphones?\b/i],
    ['Violin', /\b(?:violins?|violons?)\b/i], ['Viola', /\bviolas?\b/i], ['Cello', /\b(?:cellos?|violoncellos?|violoncelli)\b/i], ['Contrabass', /\b(?:contrabass(?:es)?|double[ _-]*bass(?:es)?)(?![ _-]*(?:flute|sax))\b/i],
    ['Piano', /\bpianos?\b/i], ['Harp', /\bharps?\b/i], ['Guitar', /\bguitars?\b/i], ['Drum Kit', /\b(?:drum[ _-]*kit|drum[ _-]*set)\b/i], ['Snare Drum', /\bsnare[ _-]*drums?\b/i], ['Tenor Drums', /\b(?:tenor[ _-]*drums?|quads|quints)\b/i], ['Bass Drum', /\bbass[ _-]*drums?\b/i], ['Timpani', /\btimpani\b/i], ['Cymbals', /\bcymbals?\b/i], ['Glockenspiel', /\bglockenspiel\b/i], ['Xylophone', /\bxylophone\b/i], ['Marimba', /\bmarimba\b/i], ['Vibraphone', /\bvibraphone\b/i], ['Triangle', /\btriangle\b/i], ['Tambourine', /\btambourine\b/i]
  ];
  const instrumentFolder = /^(?:brass|strings?|woodwinds?(?: \(not flutes\))?|flutes?(?: and double reeds)?|percussion|saxes|orchestral|guitars?|piano|flute and clarinet|sax \+ low|sax \+ flute|clarinet \+ drums)$/i;
  const hasJapanese = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
  const ensembles = ['Concert Band','Marching Band','Orchestra','Melody','Other'];
  function detectInstruments(text) {
    text=String(text).replace(/_/g,' ');
    const found = instruments.filter(([,pattern]) => pattern.test(text)).map(([name]) => name);
    if (found.some(name => name.endsWith('Saxophone') && name !== 'Saxophone')) return found.filter(name => name !== 'Saxophone');
    return found;
  }
  function classify(tags, evidence = '', source = '') {
    if (/(?:^|[^a-z])melod(?:y|ies)(?:$|[^a-z])/i.test(source) || /\bmelody[ _-]*(?:only|parts?|pack|piece)\b|\b(?:only|unison)[ _-]*melody\b/i.test(evidence)) return 'Melody';
    if (tags.some(tag => ['Violin','Viola','Cello','Contrabass'].includes(tag))) return 'Orchestra';
    if (/marching[ _-]*band|tenor[ _-]*drums?|quads|quints|sousaphone|bass[ _-]*drums\b/i.test(evidence+' '+source) || tags.includes('Tenor Drums') || tags.includes('Sousaphone')) return 'Marching Band';
    return tags.length ? 'Concert Band' : '';
  }
  function conductorRank(entry, folder) {
    const name = entry.path.split('/').pop().replace(/\.pdf$/i,'');
    let rank = /(?:full[ _-]*score|conductor|score[ _-]*full|総譜)/i.test(name) ? 100 : 0;
    rank += detectInstruments(name).length ? -45 : 45;
    if (key(name) === key(folder.split('/').pop())) rank += 35;
    rank += Math.min(12, Math.log2(Math.max(1,entry.size || 1)) / 2);
    rank -= Math.max(0, entry.path.slice(folder.length+1).split('/').length-1)*3;
    return rank;
  }
  function titles(lines, fileName, folderName) {
    const excluded=/^(?:arr\.?|arranged|composed|composer|transcri|作曲|編曲|untitled score|swing|moderato|allegro|accel\.?|opt\.?|con brio|andante|full ver|op\s*\d)|arrangement|shortened|\b(?:OP|ED)\s*\d|\barc\b|https?:|www\./i;
    const usable = lines.map(line=>({...line,text:line.text.replace(/\s*-\s*Shortened\s*$/i,'').replace(/^Tv Size\s*-\s*/i,'').replace(/\s*\((?:aidoru)\)$/i,'')})).filter(line => line.yRatio >= 0.84 && line.text.length > 1 && line.text.length < 200 && !excluded.test(line.text) && !detectInstruments(line.text).length && (line.size>=12 || key(line.text)===key(fileName)) && (line.size>=18 || line.centerRatio===undefined || line.centerRatio<0.8));
    const max = Math.max(0, ...usable.map(line => line.size));
    const large = usable.filter(line => line.size >= Math.max(12,max*0.5)).sort((a,b)=> Number(key(b.text)===key(fileName))-Number(key(a.text)===key(fileName)) || b.size-a.size || b.yRatio-a.yRatio);
    const japanese = large.find(line => hasJapanese(line.text) && (line.centerRatio===undefined || line.centerRatio<0.75))?.text || (hasJapanese(fileName) && !detectInstruments(fileName).length ? fileName : '');
    const romanized = /^(?:hikaru nara|renai circulation|fukashig[ai] no carte|ao no sumika|zankyou sanka|nanairo symphony|yuusha|kizuna no kiseki|ano yume wo nazotte|yoru ni kakeru|aidoru|hana ni natte|kaibutsu|tabun)(?:\s+(?:melody|orchestra|marching band))?$/i;
    const latin = large.filter(line => !hasJapanese(line.text) && /[a-z]{2}/i.test(line.text) && !/^(?:yoasobi|ayase|ikura|arr\.|branden yip)$/i.test(line.text));
    let english = latin.find(line=>!romanized.test(line.text))?.text || latin[0]?.text || '';
    if(english.includes(' - '))english=english.split(' - ').filter(part=>!romanized.test(part)&&!excluded.test(part)).join(' - ');
    if (!english) english = [fileName,folderName].find(name=>!hasJapanese(name) && !detectInstruments(name).length && !/^(?:full score|score|conductor|untitled score|melody|orchestra|marching band|concert band)$/i.test(name) && /[a-z]{2}/i.test(name)) || '';
    if (key(english).startsWith(key(folderName)+' ') && /^(?:melody(?: pack)?|orchestra|marching band|concert band)$/.test(key(english).slice(key(folderName).length+1))) english=english.replace(/\s+(?:melody(?:\s+pack)?|orchestra|marching band|concert band)$/i,'');
    return {japanese:clean(japanese),english:clean(english)};
  }
  function groupEntries(entries) {
    const files = entries.filter(entry => /\.(pdf|txt)$/i.test(entry.path)).map(entry=>entry.path.includes('/')?entry:{...entry,path:'Archive root/'+entry.path});
    const parents = new Set(files.map(entry => entry.path.slice(0,entry.path.lastIndexOf('/'))));
    const explicit = new Set(files.filter(entry => /\.txt$/i.test(entry.path)).map(entry => entry.path.slice(0,entry.path.lastIndexOf('/'))));
    const roots = new Set(explicit);
    for (const folder of parents) {
      if (instrumentFolder.test(folder.split('/').pop())) continue;
      const pdfs = files.filter(entry => entry.path.startsWith(folder+'/') && entry.path.slice(folder.length+1).indexOf('/')<0 && /\.pdf$/i.test(entry.path));
      if (pdfs.length) roots.add(folder);
    }
    // An instrument-only folder inherits the nearest arrangement root, including PDF-only imports.
    for (const folder of parents) {
      if ([...roots].some(parent => folder===parent || folder.startsWith(parent+'/'))) continue;
      let candidate = folder;
      while (instrumentFolder.test(candidate.split('/').pop())) candidate=candidate.slice(0,candidate.lastIndexOf('/'));
      if (candidate) roots.add(candidate);
    }
    const groups = [...roots].sort().map(folder => ({folder,entries:[]}));
    for (const entry of files) {
      const group = groups.filter(g => entry.path.startsWith(g.folder+'/')).sort((a,b)=>b.folder.length-a.folder.length)[0];
      if (group) group.entries.push(entry);
    }
    const valid = groups.filter(group => group.entries.some(entry=>/\.pdf$/i.test(entry.path)));
    for (const group of valid) {
      const ancestor = valid.filter(other => other!==group && group.folder.startsWith(other.folder+'/')).sort((a,b)=>b.folder.length-a.folder.length)[0];
      const parent = group.folder.slice(0,group.folder.lastIndexOf('/'));
      const siblings = valid.filter(other => other.folder.slice(0,other.folder.lastIndexOf('/'))===parent);
      const name=key(group.folder.split('/').pop()),parentName=key(parent.split('/').pop());
      const variantName=/^(?:orchestra|marching band|concert band|melody|simplified|ritn)(?:\s|$)/i.test(name) || (name.startsWith(parentName+' ')&&/orchestra|marching|concert|melody|simplified/i.test(name.slice(parentName.length)));
      group.songFolder = ancestor?.folder || ((siblings.length>1 || name==='melody') && variantName ? parent : group.folder);
      group.songKey = key(group.songFolder.split('/').pop());
      group.pdfs = group.entries.filter(entry=>/\.pdf$/i.test(entry.path)).sort((a,b)=>conductorRank(b,group.folder)-conductorRank(a,group.folder));
    }
    return valid;
  }
  function variantFrom(score) {
    let label=clean(score.variantLabel || score.arrangement);
    if(score.id==='v-ritn-simplified')label='Concert Band - simplified';
    if(score.id==='v-ritn-concert')label='Concert Band - original';
    const variant={id:score.variantId || score.id+'-arrangement',label,legacyId:score.id,tags:[...(score.tags||[])],genres:[...(score.genres||[])],links:[...(score.links||[])]};
    for (const field of fields) if (score[field]!==undefined) variant[field]=score[field];
    return variant;
  }
  function legacyGroup(score) {
    if (score.sourceKey) return score.sourceKey;
    if (/^v-ritn-/.test(score.id)) return 'legacy-racing-into-the-night';
    if (/^v-idol-/.test(score.id)) return 'legacy-idol';
    if (/^v-haaland-/.test(score.id)) return 'legacy-haaland';
    return 'legacy-'+(key(clean(score.title).replace(/\s+-\s+(?:orchestra|marching band|concert band|melody pack|simplified)$/i,''))||score.id);
  }
  function normalizeLibrary(library) {
    const result=[], groups=new Map();
    for (const original of library) {
      const score=JSON.parse(JSON.stringify(original));
      score.title=clean(score.title);
      const groupKey=score.sourceKey || legacyGroup(score);
      const existing=groups.get(groupKey);
      let variants=Array.isArray(score.variants)&&score.variants.length ? score.variants : [variantFrom(score)];
      variants=variants.map((variant,index)=>{
        const normalized={...variant,id:variant.id || score.id+'-v'+index,label:clean(variant.label ?? variant.arrangement),tags:Array.isArray(variant.tags)?variant.tags.map(clean):[],genres:Array.isArray(variant.genres)?variant.genres.map(clean):[],links:Array.isArray(variant.links)?variant.links.filter(link=>webUrl(link?.url)).map(link=>({label:clean(link.label),url:webUrl(link.url)})):[]};
        for(const field of fields)if(typeof normalized[field]==='string')normalized[field]=clean(normalized[field]);
        for(const field of ['driveLink','musescoreLink'])normalized[field]=webUrl(normalized[field]);
        for(const [field,extensions]of [['previewImg','png|jpe?g|webp|gif'],['audioFile','mp3|m4a|wav|ogg'],['pdfFile','pdf']])normalized[field]=localFile(normalized[field],extensions);
        return normalized;
      });
      if (existing) { existing.variants.push(...variants.filter(v=>!existing.variants.some(e=>e.id===v.id))); existing.legacyIds=[...new Set([...(existing.legacyIds||[]),score.id,...(score.legacyIds||[])])]; }
      else { score.sourceKey=groupKey; score.variants=variants; score.defaultVariantId=variants.some(v=>v.id===score.defaultVariantId)?score.defaultVariantId:variants[0].id; score.title=score.title.replace(/\s+-\s+(?:orchestra|marching band|concert band|melody pack|simplified)$/i,''); groups.set(groupKey,score); result.push(score); }
    }
    return result;
  }
  function variants(score) {
    const list=score.variants?.length ? score.variants : [variantFrom(score)];
    return [...list].sort((a,b)=>Number(b.id===score.defaultVariantId)-Number(a.id===score.defaultVariantId));
  }
  function seedLibrary(library,seed) {
    const result=JSON.parse(JSON.stringify(library));
    const driveId=value=>String(value||'').match(/\/folders\/([\w-]+)/)?.[1];
    const preserve=(source,existing)=>{
      const changes={...source};
      for(const field of ['artist','difficulty','dateAdded','video','audioFile','pdfFile','musescoreLink','links','desc','genres'])if(existing[field]!==undefined)changes[field]=existing[field];
      return changes;
    };
    for(const source of seed){
      let item=result.find(item=>item.id===source.id || item.variants?.some(v=>v.legacyId===source.id));
      if(!item&&source.driveLink)item=result.find(item=>driveId(item.driveLink)===driveId(source.driveLink));
      if(item?.variants?.length){
        const variant=item.variants.find(v=>v.legacyId===source.id || v.id===source.id || (v.driveLink&&driveId(v.driveLink)===driveId(source.driveLink)));
        if(variant)Object.assign(variant,preserve(source,variant),{id:variant.id,legacyId:source.id});
        else item.variants.push(variantFrom(source));
        item.sourceKey=source.sourceKey;item.title=source.title;
      }else if(item)Object.assign(item,preserve(source,item),{id:item.id});
      else result.push(JSON.parse(JSON.stringify(source)));
    }
    return normalizeLibrary(result);
  }
  function merged(score,variant) { return {...score,...variant,id:score.id,title:score.title,variantId:variant.id,variants:score.variants}; }
  const api={clean,key,id,detectInstruments,classify,conductorRank,titles,groupEntries,variantFrom,normalizeLibrary,seedLibrary,variants,merged,hasJapanese,ensembles};
  root.ScoreModel=api;
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
