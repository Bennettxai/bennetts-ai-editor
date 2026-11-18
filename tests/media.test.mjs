import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const cli=path.resolve('scripts/editor.mjs');
function fixture(rate='30000/1001',extra=[]){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-format-'));
 const input=path.join(dir,'source.mp4');
 const result=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i',`testsrc2=s=64x96:r=${rate}:d=1.1`,'-f','lavfi','-i','sine=duration=1.1','-c:v','libx264','-c:a','aac',...extra,input],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,'projects/talk',name),'utf8'));
 return {dir,input,run,read};
}
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('init preserves native fractional fps, defaults to 4K, records probe facts and copies original bytes',()=>{
 const {dir,input,run,read}=fixture();try{
  const before=hash(input),result=run('init','talk','--input',input);assert.equal(result.status,0,result.stderr);
  const edit=read('edit.json');assert.deepEqual(edit.format,{fps:'30000/1001',resolution:'4k'});
  assert.equal(edit.clips[0].end,1.1011);
  const media=read('source.probe.json');assert.equal(media.video.width,64);assert.equal(media.video.height,96);assert.equal(media.video.fpsRatio,'30000/1001');assert.equal(media.video.frameCount,33);assert.equal(media.video.variableFrameRate,false);assert.equal(media.video.startTime,0);assert.equal(typeof media.audio.startTime,'number');assert.equal(media.normalization,null);
  assert.equal(hash(input),before);assert.equal(hash(path.join(dir,'public',edit.source)),before);
  const valid=run('validate','talk');assert.equal(valid.status,0,valid.stderr);assert.match(valid.stdout,/2160×3840/);assert.match(valid.stdout,/30000\/1001/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('explicit resolution and fps options are validated before project creation',()=>{
 const {dir,input,run,read}=fixture('60');try{
  for(const args of [['--fps','121'],['--fps','29.97'],['--resolution','8k']]){
   const result=run('init','talk','--input',input,...args);assert.notEqual(result.status,0);assert.equal(fs.existsSync(path.join(dir,'projects/talk')),false);
  }
  const result=run('init','talk','--resolution','1080p','--fps','24','--input',input);assert.equal(result.status,0,result.stderr);assert.deepEqual(read('edit.json').format,{fps:'24/1',resolution:'1080p'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('variable-rate inputs are refused with a safe working-copy instruction before any project mutation',()=>{
 const {dir,input,run}=fixture('30',['-vf',"select='not(eq(mod(n,10),0))'",'-fps_mode','vfr']);try{
  const before=hash(input),result=run('init','talk','--input',input);
  assert.notEqual(result.status,0);assert.match(result.stderr,/variable.frame.rate/i);assert.match(result.stderr,/ffmpeg/);assert.match(result.stderr,/-n/);assert.match(result.stderr,/working.cfr/i);
  assert.equal(fs.existsSync(path.join(dir,'projects/talk')),false);assert.equal(fs.existsSync(path.join(dir,'public/projects/talk')),false);assert.equal(hash(input),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('validation bounds clips to the video stream when audio runs longer',()=>{
 const {dir,input,run,read}=fixture('30',['-af','apad=pad_dur=1']);try{
  assert.equal(run('init','talk','--input',input).status,0);
  const edit=read('edit.json');edit.clips=[{start:0,end:1.5}];
  fs.writeFileSync(path.join(dir,'projects/talk/edit.json'),JSON.stringify(edit));
  const result=run('validate','talk');assert.notEqual(result.status,0);assert.match(result.stderr,/source duration/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
