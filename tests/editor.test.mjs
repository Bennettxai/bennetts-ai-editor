import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateEdit, durationFrames, safeSlug, mediaPath} from '../src/edit.mjs';
const example = () => ({title:'My first video', source:'projects/demo/input.mp4', clips:[{start:1,end:2.5},{start:3,end:4}], captions:[{start:0,end:1,text:'Hello'}], cards:[{start:1,end:2,text:'One idea'}], sfx:[]});
test('hard cuts sum only retained footage at 30 fps',()=>assert.equal(durationFrames(example()),75));
test('valid edit accepts output-clock captions and returns the edit',()=>assert.equal(validateEdit(example()).title,'My first video'));
test('rejects overlap, reversed, empty and nonfinite source ranges',()=>{
 for(const clips of [[],[{start:2,end:1}],[{start:0,end:2},{start:1,end:3}],[{start:0,end:Infinity}],[{start:-1,end:1}]]) assert.throws(()=>validateEdit({...example(),clips}),/clip|finite|range/i);
});
test('rejects caption and card timestamps outside edited duration',()=>{
 for(const key of ['captions','cards']) for(const row of [{start:0,end:3,text:'too long'},{start:1,end:0,text:'reversed'},{start:0,end:1,text:''}]) assert.throws(()=>validateEdit({...example(),[key]:[row]}));
});
test('rejects invalid or too-late sound cues and loud music',()=>{
 for(const sfx of [[{src:'sfx/pop.wav',start:2.5,volume:.2}],[{src:'sfx/pop.wav',start:2.499,volume:.2}],[{src:'sfx/pop.wav',start:-1}],[{src:'sfx/pop.wav',start:0,volume:3}]]) assert.throws(()=>validateEdit({...example(),sfx}));
 assert.throws(()=>validateEdit({...example(),music:{src:'music/a.mp3',volume:2}}));
});
test('rejects traversal, URLs, absolute paths and symlink media escapes',()=>{
 for(const value of ['../secret','/tmp/x','a/b','..','demo;rm']) assert.throws(()=>safeSlug(value));
 for(const source of ['../secret.mp4','https://example.com/x.mp4','/tmp/x.mp4','a/../../x.mp4','a\\x.mp4']) assert.throws(()=>validateEdit({...example(),source}));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'editor-path-'));
 try {fs.mkdirSync(path.join(root,'public')); fs.symlinkSync(os.tmpdir(),path.join(root,'public','escape')); assert.throws(()=>mediaPath(root,'escape/file.mp4'));} finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('CLI creates project from actual media and refuses overwrite or missing files',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'editor-init-'));
 const input=path.join(root,'source with spaces.mp4');
 try {
  const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=30','-t','1','-c:v','libx264','-pix_fmt','yuv420p',input]); assert.equal(ff.status,0,ff.stderr?.toString());
  const cli=path.resolve('scripts/editor.mjs');
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});
  let result=run('init','test-video','--input',input);assert.equal(result.status,0,result.stderr);
  assert.ok(fs.existsSync(path.join(root,'public/projects/test-video/input.mp4')));
  const edit=JSON.parse(fs.readFileSync(path.join(root,'projects/test-video/edit.json'),'utf8'));assert.equal(edit.clips[0].end,1);
  assert.equal(run('validate','test-video').status,0);
  assert.notEqual(run('init','test-video','--input',input).status,0);
  assert.notEqual(run('init','missing','--input','no-such-file.mp4').status,0);
  edit.clips[0].end=5;fs.writeFileSync(path.join(root,'projects/test-video/edit.json'),JSON.stringify(edit));
  result=run('validate','test-video');assert.notEqual(result.status,0);assert.match(result.stderr,/source duration/i);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('clip framing rejects invalid zoom or focal points but accepts moderate punch-ins',()=>{
 for(const extra of [{zoom:.9},{zoom:2},{zoom:NaN},{focusX:-1},{focusY:101},{focusX:'50'}]){
  assert.throws(()=>validateEdit({...example(),clips:[{start:0,end:2.5,...extra}]}),/zoom|focus/i);
 }
 assert.equal(validateEdit({...example(),clips:[{start:0,end:2.5,zoom:1.2,focusX:60,focusY:20}]}).clips[0].zoom,1.2);
});

test('clip presentation applies framing without altering timeline length',async()=>{
 const {clipPresentation}=await import('../src/presentation.mjs');
 assert.equal(typeof clipPresentation,'function');
 assert.deepEqual(clipPresentation({start:0,end:2,zoom:1.2,focusX:60,focusY:20}),{
  objectFit:'cover',objectPosition:'60% 20%',transform:'scale(1.2)',transformOrigin:'60% 20%'
 });
 assert.equal(clipPresentation({start:0,end:2}).transform,'scale(1)');
});

test('music fades at both edit boundaries and never exceeds selected level',async()=>{
 const {musicLevel}=await import('../src/presentation.mjs');
 assert.equal(typeof musicLevel,'function');
 assert.equal(musicLevel(0,90,.1),0);
 assert.equal(musicLevel(15,90,.1),.1);
 assert.equal(musicLevel(89,90,.1),0);
 assert.equal(musicLevel(74,90,.1),.1);
 assert.ok(musicLevel(4,8,.1)>0 && musicLevel(4,8,.1)<=.1);
});
