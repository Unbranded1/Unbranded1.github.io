"""Isolated browser checks. All external requests are blocked or mocked.

Requires Python Playwright and Chromium. See README.md for commands.
No production credentials, writes, or contact submissions are used.
"""
import argparse,base64,functools,http.server,json,tempfile,threading,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO=Path(__file__).resolve().parents[1]

def pdf(title,instrument):
    content=f'BT /F1 22 Tf 220 758 Td ({title}) Tj ET\nBT /F1 12 Tf 35 700 Td ({instrument}) Tj ET\n'.encode()
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',f'<< /Length {len(content)} >>\nstream\n'.encode()+content+b'endstream']
    data=b'%PDF-1.4\n';offsets=[0]
    for index,obj in enumerate(objects,1):
        offsets.append(len(data));data+=f'{index} 0 obj\n'.encode()+obj+b'\nendobj\n'
    xref=len(data);data+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    data+=b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    return data+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def check_arrangement_switching(page,seed):
    score_id='v-ritn-simplified'
    selector=f'#vault-grid [data-score-variant="{score_id}"]'
    orchestra=next(s for s in seed if s['id']=='v-ritn-orchestra')
    for width,layout in [(1440,'grid'),(375,'grid'),(1440,'list'),(375,'list')]:
        page.set_viewport_size({'width':width,'height':900})
        page.evaluate("layout=>{showView('access');clearScoreFilters('vault');setLayout('vault',layout)}",layout)
        picker=page.locator(selector)
        picker.scroll_into_view_if_needed()
        picker.focus()
        page.evaluate("window.__untouchedScore=document.querySelector('#vault-grid article');window.__untouchedCover=window.__untouchedScore.querySelector('img')")
        before=picker.bounding_box()['y']
        picker.select_option('v-ritn-orchestra-arrangement')
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        assert picker.input_value()=='v-ritn-orchestra-arrangement'
        assert page.evaluate("__untouchedScore.isConnected && __untouchedCover.isConnected"),'Switching replaced unrelated scores'
        assert picker.evaluate('el=>el===document.activeElement')
        assert abs(picker.bounding_box()['y']-before)<=2,(width,layout,before,picker.bounding_box()['y'])
        card=picker.locator('xpath=ancestor::article')
        assert card.locator('img').get_attribute('src')==orchestra['previewImg']
        assert card.locator('a[href*="drive.google.com"]').get_attribute('href')==orchestra['driveLink']
    page.evaluate("setEnsFilter('vault','concert band')")
    picker=page.locator(selector)
    picker.select_option('v-ritn-orchestra-arrangement')
    assert picker.input_value()=='v-ritn-orchestra-arrangement','The category filter undid the manual version choice'
    page.evaluate("clearScoreFilters('vault');openScore('vault','v-ritn-simplified',false)")
    modal_picker=page.locator('#score-modal [data-score-variant]')
    modal_picker.scroll_into_view_if_needed();modal_picker.focus()
    before=modal_picker.bounding_box()['y']
    modal_picker.select_option('v-ritn-marching-arrangement')
    assert abs(modal_picker.bounding_box()['y']-before)<=2
    assert modal_picker.evaluate('el=>el===document.activeElement')
    page.evaluate("$('score-modal').close()")
    assert page.locator(selector).input_value()=='v-ritn-marching-arrangement'
    # Give the isolated public fixture two variants to exercise the home-page picker.
    page.evaluate("""()=>{
      const song=state.catalog[0];window.__originalPublic=structuredClone(song);
      const variant=structuredClone(song.variants[0]);variant.id='featured-test-variant';variant.label='Alternate';
      song.variants.push(variant);state.featured=song.id;renderFeatured();showView('home');
    }""")
    featured=page.locator('#featured-card [data-score-variant]')
    featured.scroll_into_view_if_needed();featured.focus()
    before=featured.bounding_box()['y']
    featured.select_option('featured-test-variant')
    assert featured.evaluate('el=>el===document.activeElement'),'Featured selection lost focus to the hidden catalog'
    assert abs(featured.bounding_box()['y']-before)<=2
    page.evaluate("state.catalog[0]=window.__originalPublic;renderFeatured();clearScoreFilters('vault');setLayout('vault','grid')")
    page.set_viewport_size({'width':1440,'height':1000})
    print('PASS: grid/list version switching preserves scroll, focus, unrelated cards, selected cover/link, filters, modal and featured pickers',flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--browser-executable')
    parser.add_argument('--published-fixture',type=Path)
    parser.add_argument('--screenshots',type=Path)
    args=parser.parse_args()
    seed=json.loads((REPO/'initial-arrangements.js').read_text(encoding='utf-8').split('window.InitialArrangements = ',1)[1].strip().rstrip(';'))
    published=json.loads(args.published_fixture.read_text(encoding='utf-8')) if args.published_fixture else {
        'format':'sheet-music-portfolio-backup','version':3,'catalog':[{'id':'public-score','title':'Published score','desc':'Remove this description','tags':[],'links':[]}],
        'vault':[{k:v for k,v in score.items() if k not in ['sourceKey','sourceFolder']} for score in seed if score['id']!='v-renai-melody'],
        'social':{},'genres':['Classical','J-Pop'],'texts':{'catalogSub':'Old catalog instructions','contactSub':'Old contact instructions'},'faq':[],
        'featured':'','siteStatus':{'down':True,'downSince':1792025319670,'etaMin':120}}
    with tempfile.TemporaryDirectory(prefix='score-site-tests-') as directory:
        work=Path(directory);folder=work/'Bundle';folder.mkdir()
        for label,instrument in [('Orchestra','Violin'),('Marching Band','Tenor Drums')]:
            root=folder/'Sample'/label;root.mkdir(parents=True)
            (root/'Score.pdf').write_bytes(pdf('Sample',instrument));(root/'Alternate_Flute.pdf').write_bytes(pdf('Sample alternate','Flute'))
            (root/'strings').mkdir();(root/'strings'/'part_violin.pdf').write_bytes(pdf('Sample part','Violin')) if label=='Orchestra' else None
            (root/'Google Drive.txt').write_text('https://drive.google.com/drive/folders/fixture-'+label.replace(' ','-'),encoding='utf-8')
            (root/'preview.mp4').write_bytes(b'Never upload this video')
        archive=work/'arrangements.zip'
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as zipped:
            for file in folder.rglob('*'):
                if file.is_file():zipped.write(file,file.relative_to(work).as_posix())
        broken=work/'broken.zip';broken.write_bytes(b'not a ZIP')
        melody=work/'melody.zip'
        with zipfile.ZipFile(melody,'w') as zipped:
            zipped.writestr('Renai Circulation/Melody/strings/Renai-Violin.pdf',pdf('Renai Circulation','Violin'))
            zipped.writestr('Renai Circulation/Melody/Renai-Tuba.pdf',pdf('Renai Circulation','Tuba'))
        parts=work/'parts.zip'
        with zipfile.ZipFile(parts,'w') as zipped:
            zipped.writestr('Sample/Sample-Flute.pdf',pdf('Sample','Flute'))
            zipped.writestr('Sample/Sample-Clarinet.pdf',pdf('Sample','Clarinet'))
        recoverable=work/'recoverable.zip'
        with zipfile.ZipFile(recoverable,'w') as zipped:
            zipped.writestr('Broken/Full Score.pdf',b'not a PDF');zipped.writestr('Broken/Trumpet.pdf',pdf('Recovered','Trumpet'))
        batch=work/'batch.zip'
        with zipfile.ZipFile(batch,'w') as zipped:
            for index in range(20):zipped.writestr(f'Batch/Piece {index:02d}/Score.pdf',pdf(f'Piece {index:02d}','Flute'))
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(REPO)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser=playwright.chromium.launch(headless=True,**({'executable_path':args.browser_executable} if args.browser_executable else {}))
                page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.on('dialog',lambda dialog:dialog.accept())
                page.route('https://**/*',lambda route:route.abort())
                page.route('**/data.json',lambda route:route.fulfill(json=published))
                page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
                page.wait_for_function('stateLoaded')
                assert page.evaluate("state.siteStatus.down && document.documentElement.classList.contains('sitedown')")
                page.evaluate("showView('scores')")
                assert page.evaluate("currentView==='home'")
                page.evaluate("showView('admin')")
                assert page.locator('#admin-login').is_visible()
                assert page.evaluate("state.catalog.every(s=>s.variants.every(v=>v.desc===''))")
                assert page.evaluate('state.vault.length')==28
                assert page.evaluate('state.vault.flatMap(s=>s.variants).length')==35
                assert page.locator('#view-vote,#view-games,#page-help-modal,.brand-mark').count()==0
                assert page.evaluate("!validPublished({format:'sheet-music-portfolio-backup',catalog:[{id:'x',title:'X',variants:[null]}],vault:[]})")
                print('PASS: maintenance, sign-in route, published content migration, removed sections',flush=True)

                page.evaluate("state.access='admin';applyAccess();applySiteStatus();showView('access')")
                melody_tab=page.locator('#vault-ensemble-tabs').get_by_role('button',name='Melody',exact=True)
                melody_tab.click()
                assert melody_tab.get_attribute('aria-pressed')=='true'
                assert melody_tab.evaluate('el=>el===document.activeElement')
                assert page.locator('#vault-ens-select').input_value()=='melody'
                assert page.locator('#vault-grid article').count()==3
                page.locator('#vault-search').fill('renai')
                assert page.locator('#vault-grid article').count()==1
                assert page.locator('#vault-grid h2').inner_text()=='恋愛サーキュレーション - Renai Circulation',page.locator('#vault-grid h2').inner_text().encode('unicode_escape').decode()
                assert page.locator('#vault-grid [data-score-variant]').input_value()=='v-renai-melody-arrangement'
                assert page.locator('#vault-grid a[href*="drive.google.com"]').get_attribute('href')==next(s['driveLink'] for s in seed if s['id']=='v-renai-melody')
                assert page.locator('#vault-grid img').get_attribute('src')=='previews/imported/v-renai-melody.jpg'
                page.evaluate("clearScoreFilters('vault');showView('scores')")
                page.locator('#catalog-ensemble-tabs').get_by_role('button',name='Melody',exact=True).click()
                assert page.locator('#catalog-results').inner_text().startswith('0 of ')
                page.evaluate("clearScoreFilters('catalog')")
                print('PASS: Melody category, keyboard focus, filter synchronization, Renai title/variant/cover/link and empty category',flush=True)

                check_arrangement_switching(page,seed)

                page.evaluate("state.access='admin';applyAccess();applySiteStatus();showView('access');openScoreById('v-idol-orchestra')")
                assert page.locator('#score-modal').is_visible()
                orchestra_id=page.locator('#score-modal [data-score-variant]').input_value()
                assert orchestra_id.startswith('v-idol-orchestra')
                orchestra=page.locator('#score-modal .score-actions a[href*="drive.google.com"]').get_attribute('href')
                variants=page.locator('#score-modal option').evaluate_all('items=>items.map(item=>item.value)')
                page.locator('#score-modal [data-score-variant]').select_option(next(value for value in variants if value!=orchestra_id))
                assert page.locator('#score-modal .score-actions a[href*="drive.google.com"]').get_attribute('href')!=orchestra
                page.evaluate("$('score-modal').close();startEdit('vault','v-idol-marching')")
                page.locator('#v-variant-select').select_option(orchestra_id)
                page.evaluate("makeDefaultVariant('vault')")
                for name in ['title','artist','arrangement','desc','drive','audio','pdf','preview','musescore']:page.locator('#v-'+name).fill('')
                page.evaluate("saveScore('vault');closeConfirmModal(true)")
                assert page.evaluate("state.vault.find(s=>s.id==='v-idol-marching').title==='' && isDraft()")
                page.reload(wait_until='networkidle');page.wait_for_function('stateLoaded')
                assert page.evaluate("state.vault.find(s=>s.id==='v-idol-marching').title===''")
                assert page.evaluate("state.vault.find(s=>s.id==='v-idol-marching').defaultVariantId")==orchestra_id
                page.evaluate("state.access='admin';applyAccess();applySiteStatus();showView('admin');setAdminTab('text');openEditModal('catalogSub')")
                page.locator('#edit-modal-input').fill('');page.evaluate('saveEditModal();closeConfirmModal(true)')
                assert page.evaluate("Object.hasOwn(state.texts,'catalogSub') && state.texts.catalogSub==='' && getComputedStyle(document.querySelector('[data-edit=catalogSub]')).display==='none'")
                with page.expect_download() as download:page.evaluate('exportData()')
                backup_path=work/'backup.json';download.value.save_as(backup_path)
                backup=json.loads(backup_path.read_text(encoding='utf-8'));assert backup['version']==4 and 'voting' not in backup and 'games' not in backup
                assert sum(len(s['variants']) for s in backup['vault'])==35
                print('PASS: variant links, legacy deep links, default selection, blank fields, persistence and backup',flush=True)

                page.evaluate("setAdminTab('import')")
                page.locator('#score-zip').set_input_files(str(broken));page.wait_for_function('() => !ScoreImporter.summary.busy')
                assert page.locator('#import-error').inner_text()
                page.locator('#score-zip').set_input_files(str(recoverable));page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.failed===1')
                page.locator('[data-action=conductor]').select_option('Broken/Trumpet.pdf')
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===1')
                assert 'instrument part' in page.locator('.import-notes').inner_text()
                page.locator('#import-clear').click()
                page.locator('#score-zip').set_input_files(str(melody))
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===1')
                assert page.locator('[data-field=ensemble]').input_value()=='Melody'
                assert page.locator('[data-field=label]').input_value()=='Melody'
                assert page.locator('[data-field=englishTitle]').input_value()=='Renai Circulation'
                page.locator('[data-field=ensemble]').select_option('Other')
                page.locator('[data-action=conductor]').select_option('Renai Circulation/Melody/strings/Renai-Violin.pdf')
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===1')
                assert page.locator('[data-field=ensemble]').input_value()=='Other'
                page.locator('#import-clear').click()
                page.locator('#score-zip').set_input_files(str(parts))
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===1')
                assert page.locator('[data-field=ensemble]').input_value()=='Other'
                assert page.locator('[data-field=label]').input_value()=='N/A'
                page.locator('#import-clear').click()
                print('PASS: recursive Melody recognition with strings, romaji fallback, manual override and parts-only Other/N/A',flush=True)
                page.locator('#score-folder').set_input_files(str(folder))
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===2')
                assert page.evaluate('ScoreImporter.summary.skippedVideos')==2
                assert page.locator('[data-field=ensemble]').evaluate_all('items=>items.map(item=>item.value)')==['Marching Band','Orchestra']
                page.locator('#import-publish').click();assert 'GitHub token' in page.locator('#import-error').inner_text()
                page.locator('#import-clear').click()
                page.locator('#score-zip').set_input_files(str(batch))
                page.locator('#import-stop').click()
                page.wait_for_function('()=>!ScoreImporter.summary.busy')
                assert page.evaluate('ScoreImporter.summary.ready')<20
                assert 'Scan paused' in page.locator('#import-status').inner_text()
                page.locator('#import-resume').click()
                page.wait_for_function('()=>!ScoreImporter.summary.busy && ScoreImporter.summary.ready===20')
                page.locator('#import-clear').click()
                page.locator('#score-zip').set_input_files(str(archive))
                page.wait_for_function('() => !ScoreImporter.summary.busy && ScoreImporter.summary.ready===2')
                assert page.locator('#import-summary').inner_text().startswith('2 arrangements selected in 1 song')
                page.locator('[data-action=select]').first.uncheck()
                assert page.locator('#import-select-all').evaluate('input=>input.indeterminate')
                page.locator('#import-select-all').check()
                print('PASS: malformed ZIP, failed PDF recovery, recursive folder and ZIP imports, selection',flush=True)

                calls=[];mode={'failure':True}
                def github(route):
                    request=route.request;endpoint=request.url.split('Unbranded1.github.io/',1)[1]
                    body=request.post_data_json if request.post_data else None
                    calls.append({'method':request.method,'path':endpoint,'body':body})
                    if mode['failure']:route.fulfill(status=403,json={'message':'Forbidden'});return
                    result={'object':{'sha':'head'}} if endpoint.startswith('git/ref/heads') else {'tree':{'sha':'base'}} if endpoint=='git/commits/head' else {'sha':'fixture-sha'}
                    route.fulfill(json=result)
                page.route('https://api.github.com/repos/Unbranded1/Unbranded1.github.io/**',github)
                page.evaluate("localStorage.setItem(LS.ghToken,'fixture-token')")
                page.locator('#import-publish').click();page.wait_for_function("() => document.querySelector('#import-error').textContent.includes('GitHub rejected')")
                assert page.evaluate('ScoreImporter.summary.ready')==2
                mode['failure']=False
                page.evaluate("fbUser={uid:'test'};fbdb={};fbTools={doc:()=>({}),setDoc:async()=>{throw Error('fixture failure')}}")
                before=page.evaluate('state.vault.length')
                page.locator('#import-publish').click();page.wait_for_function("() => document.querySelector('#import-error').textContent.includes('score publishing failed')")
                assert page.evaluate('state.vault.length')==before
                assert page.locator('[data-state=ready]').count()==2
                page.evaluate("fbTools.setDoc=async(ref,payload)=>{window.__published=structuredClone(payload)}")
                page.locator('#import-publish').click();page.wait_for_function("() => document.querySelector('#import-status').textContent.includes('2 arrangements in 1 song published')")
                assert page.evaluate("state.vault.find(s=>s.sourceKey==='sample').variants.length")==2
                assert not page.evaluate('isDraft()')
                assert page.evaluate('__published.siteStatus.down')
                blobs=[call for call in calls if call['path']=='git/blobs']
                assert len(blobs)==4
                assert all(base64.b64decode(call['body']['content']).startswith(b'\xff\xd8') for call in blobs)
                assert all(item['path'].endswith('.jpg') for call in calls if call['path']=='git/trees' for item in call['body']['tree'])
                assert all(call['body']['force'] is False for call in calls if call['method']=='PATCH')
                assert page.locator('#import-publish').is_disabled()
                print('PASS: token/permission errors, Firebase failure recovery, JPG-only uploads, safe main updates',flush=True)

                page.evaluate("fbUser=null;state.siteStatus.down=false;applySiteStatus()")
                for width in [320,375,768,1440]:
                    page.set_viewport_size({'width':width,'height':1000})
                    for view in ['home','scores','access','admin']:
                        page.evaluate('view=>showView(view)',view)
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,view)
                    for tab in page.locator('#admin-section-select option').evaluate_all('options=>options.map(option=>option.value)'):
                        page.evaluate('tab=>setAdminTab(tab)',tab)
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,tab)
                if args.screenshots:
                    args.screenshots.mkdir(parents=True,exist_ok=True)
                    page.set_viewport_size({'width':375,'height':1000})
                    page.evaluate("$('toast').classList.add('hidden')")
                    page.evaluate("showView('access')");page.screenshot(path=str(args.screenshots/'vault-mobile.png'))
                    page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(args.screenshots/'vault-desktop.png'))
                    page.evaluate("showView('admin');setAdminTab('import')");page.screenshot(path=str(args.screenshots/'import-desktop.png'))
                    page.emulate_media(color_scheme='dark');page.wait_for_timeout(250);page.screenshot(path=str(args.screenshots/'import-dark.png'))
                assert not errors,errors
                print('PASS: all public views and admin sections at 320, 375, 768 and 1440 pixels; no JavaScript errors',flush=True)
                browser.close()
        finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
