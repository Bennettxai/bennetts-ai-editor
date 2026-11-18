// Real local render check; opt-in because Chromium + a native 4K encode are heavier than unit tests.
// node --test tests/format-render.mjs (EDITOR_MEDIA_EVIDENCE_DIR retains the generated artifacts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve('.'),dir=process.env.EDITOR_MEDIA_EVIDENCE_DIR??fs.mkdtempSync(path.join(os.tmpdir(),'editor-native-render-'));
const cli=path.join(root,'scripts/editor.mjs');
function run(command,args,cwd=dir){const r=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout);return r;}
const editor=(...args)=>run(process.execPath,[cli,...args]);
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).stdout);

test('real native-rate drafts and 4K finals retain exact rational fps, frame count and audio',()=>{
 fs.mkdirSync(dir,{recursive:true});
 try{
  for(const name of ['src','node_modules'])if(!fs.existsSync(path.join(dir,name)))fs.symlinkSync(path.join(root,name),path.join(dir,name));
  fs.copyFileSync(path.join(root,'package.json'),path.join(dir,'package.json'));
  const input=path.join(dir,'native.mp4');
  run('ffmpeg',['-v','error','-n','-f','lavfi','-i','testsrc2=s=2160x3840:r=30000/1001:d=1.001','-f','lavfi','-i','sine=frequency=330:duration=1.001','-c:v','libx264','-preset','ultrafast','-crf','10','-c:a','aac',input]);
  editor('init','native','--input',input);
  const editFile=path.join(dir,'projects/native/edit.json'),edit=JSON.parse(fs.readFileSync(editFile,'utf8'));
  edit.captionStyle='word';edit.captions=[{start:0,end:.5,text:'NATIVE'},{start:.5,end:1.001,text:'TIMING'}];
  edit.visuals=[{scene:'number',start:0,end:1.001,value:30,at:[.5]}];
  fs.writeFileSync(editFile,JSON.stringify(edit));
  editor('draft','native');
  const draft=probe('output/drafts/native.mp4'),dv=draft.streams.find(s=>s.codec_type==='video');
  assert.equal(dv.width,540);assert.equal(dv.height,960);assert.equal(dv.r_frame_rate,'30000/1001');assert.equal(dv.nb_frames,'30');
  editor('review','native','--draft');
  const draftReview=JSON.parse(fs.readFileSync(path.join(dir,'output/review/native-draft/report.json'),'utf8'));
  for(const name of ['size','fps','frames'])assert.equal(draftReview.checks.find(c=>c.name===name).pass,true,name);
  editor('render','native','--no-master');
  const before=run('ffmpeg',['-v','error','-i','output/native.mp4','-map','0:v:0','-c','copy','-f','md5','-']).stdout;
  editor('render','native');
  const after=run('ffmpeg',['-v','error','-i','output/native.mp4','-map','0:v:0','-c','copy','-f','md5','-']).stdout;
  assert.equal(after,before,'mastering must copy the encoded video bytes');
  const final=probe('output/native.mp4'),video=final.streams.find(s=>s.codec_type==='video');
  assert.equal(video.width,2160);assert.equal(video.height,3840);assert.equal(video.r_frame_rate,'30000/1001');assert.equal(video.nb_frames,'30');assert.ok(final.streams.some(s=>s.codec_type==='audio'));
  editor('init','round-trip','--input',path.join(dir,'output/native.mp4'));
  const roundTrip=JSON.parse(fs.readFileSync(path.join(dir,'projects/round-trip/edit.json'),'utf8'));
  assert.equal(Math.round(roundTrip.clips[0].end*(30000/1001)),30,'reimport retains last frame despite mux duration rounding');
  editor('review','native');
  const review=JSON.parse(fs.readFileSync(path.join(dir,'output/review/native/report.json'),'utf8'));
  for(const name of ['size','fps','frames','loudness','true peak'])assert.equal(review.checks.find(c=>c.name===name).pass,true,name);
 }finally{if(!process.env.EDITOR_MEDIA_EVIDENCE_DIR)fs.rmSync(dir,{recursive:true,force:true});}
});
