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

test('a dropped frame on a coarse 1/30 time base is refused before mutation',()=>{
 const {dir,input,run}=fixture('30',['-vf',"select='not(eq(n,15))'",'-fps_mode','vfr','-video_track_timescale','30']);try{
  const before=hash(input),result=run('init','talk','--input',input);
  assert.notEqual(result.status,0,'one missing frame must not be hidden by a whole-frame clock tolerance');
  assert.match(result.stderr,/variable.frame.rate/i);assert.match(result.stderr,/ffmpeg/);
  assert.equal(fs.existsSync(path.join(dir,'projects/talk')),false);assert.equal(fs.existsSync(path.join(dir,'public/projects/talk')),false);assert.equal(hash(input),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('regular CFR remains importable on a coarse 1/30 time base',()=>{
 const {dir,input,run,read}=fixture('30',['-video_track_timescale','30']);try{
  const result=run('init','talk','--input',input);assert.equal(result.status,0,result.stderr);
  assert.equal(read('source.probe.json').video.timeBase,'1/30');assert.equal(read('source.probe.json').video.frameCount,33);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('delayed video is refused and its working-copy command preserves the audio/video clock and tail',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-offset-origin-'));
 try{
  const input=path.join(dir,"offset's.mp4");
  const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i',"color=red:s=64x96:r=30:d=1,drawbox=c=blue:t=fill:enable='gte(t,0.5)'",'-f','lavfi','-i',"sine=frequency=330:duration=1.5,volume='gte(t,0.75)':eval=frame",'-vf','setpts=PTS+0.5/TB','-fps_mode','passthrough','-c:v','libx264','-c:a','aac',input],{encoding:'utf8'});assert.equal(ff.status,0,ff.stderr);
  const before=hash(input),run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:dir,encoding:'utf8'});
  const result=run('init','talk','--input',input);
  assert.notEqual(result.status,0,'delayed video must not be imported on a zero-based seek clock');assert.match(result.stderr,/video.*origin|video.*start/i);
  assert.equal(fs.existsSync(path.join(dir,'projects/talk')),false);assert.equal(fs.existsSync(path.join(dir,'public/projects/talk')),false);assert.equal(hash(input),before);
  const command=result.stderr.split('\n').find(line=>line.startsWith('ffmpeg '));assert.ok(command,'provide the exact safe working-copy command');
  const normalized=spawnSync('sh',['-c',command],{cwd:dir,encoding:'utf8'});assert.equal(normalized.status,0,normalized.stderr);
  const working=input.replace(/\.mp4$/,'.working-cfr.mp4');
  const imported=run('init','talk','--input',working);assert.equal(imported.status,0,imported.stderr);
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'projects/talk/source.probe.json'),'utf8'));
  assert.equal(meta.video.startTime,0);assert.equal(meta.video.frameCount,45);assert.equal(meta.video.duration,1.5);assert.equal(meta.audio.startTime,0);
  const pixel=seconds=>{const r=spawnSync('ffmpeg',['-v','error','-ss',String(seconds),'-i',working,'-frames:v','1','-vf','crop=2:2:iw/2:ih/2,scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-']);assert.equal(r.status,0,r.stderr?.toString());return [...r.stdout];};
  assert.ok(pixel(.9)[0]>240,'red footage must still be present at its original container time');assert.ok(pixel(1.1)[2]>240,'the final blue footage must not be truncated or shifted earlier');
  const sound=spawnSync('ffmpeg',['-hide_banner','-nostats','-i',working,'-vn','-af','silencedetect=noise=-40dB:d=0.2','-f','null','-'],{encoding:'utf8'});assert.equal(sound.status,0,sound.stderr);
  const onset=Number(/silence_end: ([\d.]+)/.exec(sound.stderr)?.[1]);assert.ok(Math.abs(onset-.75)<.05,`audio onset must stay near 0.75s, got ${onset}`);
  assert.equal(hash(input),before,'normalizing a working copy must not change original bytes');
  fs.appendFileSync(working,'existing working copy sentinel');const existing=hash(working);
  spawnSync('sh',['-c',command],{cwd:dir,encoding:'utf8'});
  assert.equal(hash(working),existing,'the diagnostic must not overwrite an existing working copy');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
