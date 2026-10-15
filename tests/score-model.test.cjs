const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const M=require('../score-model.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../initial-arrangements.js'),'utf8'),context);
const seed=JSON.parse(JSON.stringify(context.window.InitialArrangements));
const entry=path=>({path,size:10000});

test('recursively groups instruments and sibling arrangements without grouping unrelated songs',()=>{
  const groups=M.groupEntries([
    'Music/Hikaru Nara/Google Drive.txt','Music/Hikaru Nara/Hikaru Nara.pdf','Music/Hikaru Nara/strings/part_violin.pdf',
    'Music/Idol/Orchestra/Idol.pdf','Music/Idol/Marching Band/Idol.pdf',
    'Music/Other/Bang Bang Marching Band/Bang Bang.pdf','Music/Other/Flamewall/Flamewall.pdf'
  ].map(entry));
  assert.equal(groups.length,5);
  assert.equal(groups.find(g=>g.folder.endsWith('Hikaru Nara')).pdfs.length,2);
  assert.equal(groups.filter(g=>g.songKey==='idol').length,2);
  assert.equal(groups.find(g=>g.folder.endsWith('Bang Bang Marching Band')).songKey,'bang bang marching band');
  assert.equal(M.groupEntries([entry('Score.pdf')])[0].pdfs.length,1);
});

test('instrument filenames with underscores count; strings take priority over marching percussion',()=>{
  const tags=M.detectInstruments('part_Violin_I.pdf Trumpet_in_Bb.pdf Tenor_Drums.pdf');
  assert.deepEqual(tags,['Trumpet','Violin','Tenor Drums']);
  assert.equal(M.classify(tags),'Orchestra');
  assert.equal(M.classify(M.detectInstruments('Sousaphone Tenor Drums')),'Marching Band');
  assert.equal(M.classify(M.detectInstruments('Flute Clarinet Tuba')),'Concert Band');
  assert(!M.detectInstruments('Contrabass Flute').includes('Contrabass'));
});

test('ranks an unlabelled conductor above instrument parts, even inside subfolders',()=>{
  assert(M.conductorRank(entry('Song/Song.pdf'),'Song')>M.conductorRank(entry('Song/strings/Violin.pdf'),'Song'));
  assert(M.conductorRank(entry('Song/Full Score.pdf'),'Song')>M.conductorRank(entry('Song/Trumpet_in_Bb.pdf'),'Song'));
});

test('keeps Japanese and English titles separate and leaves romanization uncertain',()=>{
  const line=(text,size=22,centerRatio=.5)=>({text,size,yRatio:.96,centerRatio});
  assert.deepEqual(M.titles([line('光るなら'),line('Hikaru Nara',14)],'Hikaru Nara','Hikaru Nara'),{japanese:'光るなら',english:''});
  assert.deepEqual(M.titles([line('アイドル'),line('Idol - Aidoru',14)],'Idol','Idol'),{japanese:'アイドル',english:'Idol'});
  assert.equal(M.titles([line('残響散歌'),line('Demon Slayer OP 3 Entertainment District Arc',14)],'Zankyou Sanka','Zankyou Sanka').english,'');
  assert.equal(M.titles([line('TVB News Theme'),line('顧嘉煇',14,.94)],'TVB News Theme','TVB News Theme').japanese,'');
  assert.equal(M.titles([line('Untitled score')],'Haaland','Haaland').english,'Haaland');
});

test('initial collection has all 35 arrangements in 28 songs, with valid covers and distinct Drive links',()=>{
  const library=M.normalizeLibrary(seed);
  assert.equal(seed.length,35);
  assert.equal(library.length,28);
  assert.equal(library.flatMap(s=>s.variants).length,35);
  assert.equal(new Set(seed.map(s=>s.driveLink)).size,35);
  for(const item of seed){
    assert.match(item.driveLink,/^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+$/);
    assert(fs.existsSync(path.join(__dirname,'..',item.previewImg)));
    assert(item.coverWidth>=900);
    assert(!JSON.stringify(item).includes(String.fromCharCode(8212)));
  }
});

test('migration adds missing arrangements, repairs links, preserves unknown scores and is idempotent',()=>{
  const old=seed.slice(0,34).map(s=>({...s,sourceKey:undefined,sourceFolder:undefined}));
  old.find(s=>s.id==='v-be-a-flower').driveLink=old.find(s=>s.id==='v-ao-no-sumika').driveLink;
  old.push({id:'custom-song',title:'My custom score',video:'abcdefghijk',tags:[],links:[]});
  const migrated=M.seedLibrary(old,seed),again=M.seedLibrary(migrated,seed);
  assert.equal(migrated.length,29);
  assert.equal(migrated.flatMap(s=>s.variants).length,36);
  assert.equal(again.flatMap(s=>s.variants).length,36);
  assert(migrated.some(s=>s.id==='custom-song'));
  assert.equal(migrated.find(s=>s.id==='v-be-a-flower').variants[0].driveLink,seed.find(s=>s.id==='v-be-a-flower').driveLink);
});

test('normalization preserves default selection, legacy deep links, blanks and per-variant media',()=>{
  const old=[{id:'v-idol-marching',title:'Idol - Marching Band',arrangement:'Marching Band',video:'abcdefghijk',tags:[],links:[]},{id:'v-idol-orchestra',title:'Idol - Orchestra',arrangement:'Orchestra',video:'lmnopqrstuv',tags:[],links:[]}];
  const [song]=M.normalizeLibrary(old);
  assert.equal(song.variants.length,2);
  assert(song.legacyIds.includes('v-idol-orchestra'));
  song.defaultVariantId=song.variants[1].id;
  assert.equal(M.variants(song)[0].legacyId,'v-idol-orchestra');
  assert.equal(M.merged(song,M.variants(song)[0]).video,'lmnopqrstuv');
  assert.equal(M.normalizeLibrary([{id:'a',title:'',tags:[]},{id:'b',title:'',tags:[]}]).length,2);
});

test('variant links from backups cannot introduce script URLs or external media',()=>{
  const [song]=M.normalizeLibrary([{id:'a',title:'A',variants:[{id:'v',label:'',arrangement:'',links:[{url:'javascript:alert(1)'},{url:'https://example.com',label:''}],driveLink:'javascript:alert(1)',previewImg:'https://elsewhere.example/score.jpg',audioFile:'../other.mp3'}]}]);
  assert.equal(song.variants[0].label,'');
  assert.equal(song.variants[0].links.length,1);
  assert.equal(song.variants[0].driveLink,'');
  assert.equal(song.variants[0].previewImg,'');
  assert.equal(song.variants[0].audioFile,'');
});
