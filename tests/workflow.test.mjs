import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cli=path.resolve('scripts/editor.mjs');
function fixture(seconds=6){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-v2-'));
 const input=path.join(dir,'talk.mp4');
 const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=black:s=64x64:r=30:d=${seconds}`,'-f','lavfi','-i',`sine=frequency=220:duration=${seconds},volume='between(t,0.45,1.7)+between(t,2.75,3.05)+between(t,3.95,4.95)':eval=frame`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',input]);
 assert.equal(ff.status,0,ff.stderr?.toString());
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(run('init','talk','--input',input).status,0);
 const words={words:[{text:'Most',start:.5,end:.8},{text:'people',start:.85,end:1.2},{text:'quit.',start:1.25,end:1.6},{text:'Um,',start:2.8,end:3},{text:'here',start:4,end:4.3},{text:'is',start:4.35,end:4.5},{text:'why.',start:4.55,end:4.9}]};
 const json=path.join(dir,'words.json');fs.writeFileSync(json,JSON.stringify(words));
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,'projects/talk',name),'utf8'));
 const write=(name,value)=>fs.writeFileSync(path.join(dir,'projects/talk',name),JSON.stringify(value,null,2));
 return {dir,run,json,read,write};
}

test('transcribe imports an existing word-level JSON into transcript.json',()=>{
 const {dir,run,json,read}=fixture();
 try{
  const result=run('transcribe','talk','--json',json);assert.equal(result.status,0,result.stderr);
  const t=read('transcript.json');assert.equal(t.words.length,7);assert.ok(t.silences.length>=3,'silences come from the audio');assert.equal(t.words[0].text,'Most');assert.equal(t.clock,'source');
  assert.notEqual(run('transcribe','talk','--json','missing.json').status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('cut writes a proposal with a decision log, and --apply replaces clips and rebuilds word captions',()=>{
 const {dir,run,json,read}=fixture();
 try{
  assert.notEqual(run('cut','talk').status,0,'needs a transcript first');
  run('transcribe','talk','--json',json);
  const before=read('edit.json');
  let result=run('cut','talk');assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/filler/i);
  const proposal=read('cuts.proposed.json');assert.ok(proposal.clips.length>=2);assert.ok(proposal.decisions.some(d=>d.action==='CUT'));
  assert.deepEqual(read('edit.json'),before,'proposal alone must not touch edit.json');
  result=run('cut','talk','--apply','--remove-fillers');assert.equal(result.status,0,result.stderr);
  const edit=read('edit.json');assert.deepEqual(edit.clips,read('cuts.proposed.json').clips);
  assert.equal(edit.captionStyle,'word');assert.deepEqual(edit.captions.map(c=>c.text),['MOST','PEOPLE','QUIT','HERE','IS','WHY']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('cut --apply refuses to strand cards or visuals outside the new length',()=>{
 const {dir,run,json,read,write}=fixture();
 try{
  run('transcribe','talk','--json',json);
  const edit=read('edit.json');edit.cards=[{start:4,end:5.5,text:'Late card'}];write('edit.json',edit);
  const result=run('cut','talk','--apply');assert.notEqual(result.status,0);assert.match(result.stderr,/cards/);
  assert.deepEqual(read('edit.json'),edit);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('captions --words builds grouped captions from the transcript; words prints the output clock',()=>{
 const {dir,run,json,read}=fixture();
 try{
  run('transcribe','talk','--json',json);
  let result=run('captions','talk','--words','--group','3','--apply');assert.equal(result.status,0,result.stderr);
  assert.deepEqual(read('edit.json').captions.map(c=>c.text),['MOST PEOPLE QUIT','UM','HERE IS WHY']);
  result=run('words','talk');assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/0\.50\s+Most/);
  assert.equal(read('words.output.json').words[0].start,.5);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('transcribe runs local whisper.cpp end to end when it is installed',{skip:spawnSync('whisper-cli',['--help']).error?'whisper-cli not installed':false},()=>{
 const say=spawnSync('say',['--version']);
 if(say.error)return; // speech synthesis is only available on macOS
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-whisper-'));
 try{
  const aiff=path.join(dir,'s.aiff'),mp4=path.join(dir,'s.mp4');
  assert.equal(spawnSync('say',['-o',aiff,'Write the one thing down, then do it first.']).status,0);
  assert.equal(spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=30','-i',aiff,'-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',mp4]).status,0);
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
  assert.equal(run('init','spoken','--input',mp4).status,0);
  const result=run('transcribe','spoken');
  if(/No whisper.cpp model/.test(result.stderr))return; // no model downloaded on this machine
  assert.equal(result.status,0,result.stderr);
  const t=JSON.parse(fs.readFileSync(path.join(dir,'projects/spoken/transcript.json'),'utf8'));
  assert.match(t.words.map(w=>w.text).join(' ').toLowerCase(),/one thing down/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// --- review fixes ---
test('silences and words share one clock even when the audio stream starts late',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-offset-'));
 try{
  const input=path.join(dir,'late.mp4');
  // Audio starts 0.5 s into the container; it is loud 0.5–1.5 s of its own time, i.e. 1.0–2.0 s of the video.
  const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=30:d=4','-itsoffset','0.5','-f','lavfi','-i',"sine=frequency=220:duration=3.5,volume='between(t,0.5,1.5)':eval=frame",'-map','0:v','-map','1:a','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',input]);
  assert.equal(ff.status,0,ff.stderr?.toString());
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
  assert.equal(run('init','late','--input',input).status,0);
  fs.writeFileSync(path.join(dir,'w.json'),JSON.stringify({words:[{text:'tone',start:1.05,end:1.95}]}));
  const result=run('transcribe','late','--json',path.join(dir,'w.json'));assert.equal(result.status,0,result.stderr);
  const t=JSON.parse(fs.readFileSync(path.join(dir,'projects/late/transcript.json'),'utf8'));
  const speech=t.silences.find(s=>s.start>0.5);
  assert.ok(Math.abs(t.silences[0].end-1)<0.1,`lead-in silence should end near 1.0 s, got ${JSON.stringify(t.silences)}`);
  assert.ok(speech&&Math.abs(speech.start-2)<0.1,`speech should end near 2.0 s, got ${JSON.stringify(t.silences)}`);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('re-applying cuts keeps hand-removed takes and framing, and refuses to replace phrase captions',()=>{
 const {dir,run,json,read,write}=fixture();
 try{
  run('transcribe','talk','--json',json);
  const edit=read('edit.json');edit.clips=[{start:0,end:3.5,zoom:1.2,focusX:40}];edit.captions=[];write('edit.json',edit);
  let result=run('cut','talk','--apply');assert.equal(result.status,0,result.stderr);
  const clips=read('edit.json').clips;
  assert.ok(clips.every(c=>c.end<=3.5+1e-9&&c.zoom===1.2&&c.focusX===40),JSON.stringify(clips));
  const phrase=read('edit.json');phrase.captionStyle='phrase';phrase.captions=[{start:0,end:.5,text:'Hand written'}];write('edit.json',phrase);
  result=run('cut','talk','--apply');assert.notEqual(result.status,0);assert.match(result.stderr,/phrase captions/i);
  result=run('cut','talk','--apply','--replace-captions');assert.equal(result.status,0,result.stderr);assert.equal(read('edit.json').captionStyle,'word');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('validate rejects a custom scene that is not registered',()=>{
 const {dir,read,write}=fixture();
 try{
  fs.symlinkSync(path.resolve('src'),path.join(dir,'src'));
  const edit=read('edit.json');edit.visuals=[{scene:'custom',component:'NotThere',start:.5,end:2}];write('edit.json',edit);
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
  let result=run('validate','talk');assert.notEqual(result.status,0);assert.match(result.stderr,/NotThere/);
  edit.visuals[0].component='ProgressExample';write('edit.json',edit);
  result=run('validate','talk');assert.equal(result.status,0,result.stderr);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
