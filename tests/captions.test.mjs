import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseSrt, mapCaptions} from '../src/captions.mjs';

const cue=(start,end,text='Hello')=>({start,end,text});
test('parses BOM, CRLF, multiline captions and decimal timestamps',()=>{
 const srt='\uFEFF1\r\n00:00:01,250 --> 00:00:02,500\r\nHello\r\nworld\r\n\r\n2\r\n00:00:03.000 --> 00:00:04.000\r\nNext thought\r\n';
 assert.deepEqual(parseSrt(srt),[cue(1.25,2.5,'Hello world'),cue(3,4,'Next thought')]);
});
test('rejects malformed, reversed, overlapping and overlong source cues',()=>{
 for(const srt of ['', '1\n00:00:60,000 --> 00:01:01,000\nBad', '1\n00:00:02,000 --> 00:00:01,000\nBackwards', '1\n00:00:00,000 --> 00:00:01,000\n'+ 'x'.repeat(101), '1\n00:00:00,000 --> 00:00:02,000\nOne\n\n2\n00:00:01,000 --> 00:00:03,000\nTwo','1\n00:00:00,000 --> 00:00:01,000']) assert.throws(()=>parseSrt(srt),/SRT|caption|cue/i);
});
test('maps captions through hard cuts, excludes removed cues, and splits repeated phrase at a cut',()=>{
 const result=mapCaptions([cue(0,1,'Removed'),cue(1.5,4.5,'Spanning cut'),cue(5,7,'Clipped end')],[{start:2,end:3},{start:4,end:6}]);
 assert.deepEqual(result,[cue(0,1,'Spanning cut'),cue(1,1.5,'Spanning cut'),cue(2,3,'Clipped end')]);
});
test('maps source and output clocks with independently rounded 30fps boundaries',()=>{
 assert.deepEqual(mapCaptions([cue(.1,.3,'First'),cue(1.05,1.19,'Second')],[{start:.12,end:.28},{start:1.02,end:1.2}]),[cue(0,4/30,'First'),cue(5/30,9/30,'Second')]);
 assert.deepEqual(mapCaptions([cue(.001,.01)],[{start:0,end:1}]),[]);
});
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-captions-'));
 const input=path.join(dir,'source with spaces.mp4');
 const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=30','-t','1','-c:v','libx264','-pix_fmt','yuv420p',input]);assert.equal(ff.status,0,ff.stderr?.toString());
 const cli=path.resolve('scripts/editor.mjs');
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8',maxBuffer:4*1024*1024});
 const result=run('init','test-video','--input',input);assert.equal(result.status,0,result.stderr);
 return {dir,run};
}
test('CLI proposal is non-destructive; --apply replaces captions and preserves overlays',()=>{
 const {dir,run}=fixture();
 try{
  const editFile=path.join(dir,'projects/test-video/edit.json');
  const edit=JSON.parse(fs.readFileSync(editFile,'utf8'));
  edit.cards=[{start:0,end:.5,text:'A title card'}];edit.captions=[{start:0,end:.5,text:'Old caption'}];
  fs.writeFileSync(editFile,JSON.stringify(edit,null,2));const before=fs.readFileSync(editFile,'utf8');
  const srt=path.join(dir,'captions with spaces.srt');fs.writeFileSync(srt,'1\n00:00:00,000 --> 00:00:00,500\nNew caption\n');
  let result=run('captions','test-video','--srt',srt);assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(editFile,'utf8'),before);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'projects/test-video/captions.proposed.json'),'utf8')),[cue(0,.5,'New caption')]);
  result=run('captions','test-video','--srt',srt,'--apply');assert.equal(result.status,0,result.stderr);
  const after=JSON.parse(fs.readFileSync(editFile,'utf8'));assert.deepEqual(after.captions,[cue(0,.5,'New caption')]);assert.deepEqual(after.cards,edit.cards);assert.deepEqual(after.clips,edit.clips);assert.deepEqual(after.sfx,edit.sfx);
  assert.notEqual(run('captions','test-video','--srt','missing.srt').status,0);
  assert.notEqual(run('captions','test-video','--srt',srt,'--aply').status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('draft CLI renders 540x960 without overwriting own or similarly named project finals',()=>{
 const {dir,run}=fixture();
 try{
  fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'));
  fs.symlinkSync(path.resolve('src'),path.join(dir,'src'));
  fs.copyFileSync('tsconfig.json',path.join(dir,'tsconfig.json'));
  fs.mkdirSync(path.join(dir,'output'));const final=path.join(dir,'output/test-video.mp4');fs.writeFileSync(final,'existing final');
  const otherFinal=path.join(dir,'output/test-video-draft.mp4');fs.writeFileSync(otherFinal,'other project final');
  const result=run('draft','test-video');assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
  assert.equal(fs.readFileSync(final,'utf8'),'existing final');
  assert.equal(fs.readFileSync(otherFinal,'utf8'),'other project final');
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames','-of','json',path.join(dir,'output/drafts/test-video.mp4')],{encoding:'utf8'});assert.equal(probe.status,0,probe.stderr);
  const stream=JSON.parse(probe.stdout).streams[0];assert.equal(stream.width,540);assert.equal(stream.height,960);assert.equal(Number(stream.nb_frames),30);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('caption import repairs stale captions after cuts but still rejects stale cards without writing edit',()=>{
 const {dir,run}=fixture();
 try{
  const editFile=path.join(dir,'projects/test-video/edit.json');
  const edit=JSON.parse(fs.readFileSync(editFile,'utf8'));
  edit.clips=[{start:0,end:.5}];edit.cards=[{start:0,end:.3,text:'Valid card'}];edit.captions=[{start:0,end:1,text:'Stale caption'}];
  fs.writeFileSync(editFile,JSON.stringify(edit,null,2));const before=fs.readFileSync(editFile,'utf8');
  const srt=path.join(dir,'source.srt');fs.writeFileSync(srt,'1\n00:00:00,000 --> 00:00:01,000\nUpdated phrase\n');
  let result=run('captions','test-video','--srt',srt);assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(editFile,'utf8'),before);
  result=run('captions','test-video','--srt',srt,'--apply');assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(editFile,'utf8')).captions,[cue(0,.5,'Updated phrase')]);
  edit.cards=[{start:0,end:1,text:'Stale card'}];fs.writeFileSync(editFile,JSON.stringify(edit));const invalid=fs.readFileSync(editFile,'utf8');
  result=run('captions','test-video','--srt',srt,'--apply');assert.notEqual(result.status,0);assert.match(result.stderr,/cards/);assert.equal(fs.readFileSync(editFile,'utf8'),invalid);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
