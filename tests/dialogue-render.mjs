// Opt-in real media acceptance: imported transcript, reviewed multi-cut plan, native 59.94 fps draft.
// EDITOR_DIALOGUE_EVIDENCE_DIR=/tmp/editor-dialogue node --test tests/dialogue-render.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {artifactStatus,dialogueStatus} from '../src/dialogue.mjs';
const root=path.resolve('.'),dir=process.env.EDITOR_DIALOGUE_EVIDENCE_DIR??fs.mkdtempSync(path.join(os.tmpdir(),'editor-dialogue-render-'));
function run(command,args,options={}){const r=spawnSync(command,args,{cwd:dir,encoding:'utf8',maxBuffer:16*1024*1024,...options});assert.equal(r.status,0,r.stderr||r.stdout);return r;}
const editor=(...args)=>run(process.execPath,[path.join(root,'scripts/editor.mjs'),...args]);
const read=relative=>JSON.parse(fs.readFileSync(path.join(dir,relative),'utf8'));
const write=(relative,value)=>fs.writeFileSync(path.join(dir,relative),JSON.stringify(value,null,2)+'\n');
test('real 60000/1001 three-clip draft retains reviewed frames, mapped words and audible windows',()=>{
 fs.mkdirSync(dir,{recursive:true});
 try{
  for(const name of ['src','node_modules'])fs.symlinkSync(path.join(root,name),path.join(dir,name));fs.copyFileSync(path.join(root,'package.json'),path.join(dir,'package.json'));
  run('ffmpeg',['-v','error','-n','-f','lavfi','-i',"color=c=red:s=540x960:r=60000/1001:d=3.003,drawbox=x=0:y=0:w=iw:h=ih:color=green:t=fill:enable='gte(t,1.001)',drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(t,2.002)'",'-f','lavfi','-i',"aevalsrc='0.125*sin(2*PI*440*t)*(between(t,0.1001,0.4004)+between(t,1.1011,1.4014)+between(t,2.1021,2.4024))':s=48000:d=3.003",'-c:v','libx264','-preset','ultrafast','-crf','10','-c:a','aac','source.mp4']);
  editor('init','talk','--input',path.join(dir,'source.mp4'));
  write('import.json',{words:[{text:'Red',start:.1001,end:.4004},{text:'Green',start:1.1011,end:1.4014},{text:'Blue',start:2.1021,end:2.4024}]});
  editor('transcribe','talk','--json',path.join(dir,'import.json'));editor('cut','talk');
  const plan=read('projects/talk/cuts.proposed.json');plan.clips=[{start:0,end:.5005},{start:1.001,end:1.5015},{start:2.002,end:2.5025}];plan.decisions=[{action:'KEEP',reason:'Synthetic test selections; not a semantic/listening review'}];write('reviewed.json',plan);
  editor('cut','talk','--apply','--plan',path.join(dir,'reviewed.json'));editor('captions','talk','--words','--apply');editor('words','talk');
  const words=read('projects/talk/words.output.json').words;
  assert.deepEqual(words.map(w=>Math.round(w.start*60000/1001)),[6,36,66]);assert.deepEqual(words.map(w=>Math.round(w.end*60000/1001)),[24,54,84]);
  assert.deepEqual(read('projects/talk/dialogue/v001/manifest.json').clips.map(c=>[c.sourceStartFrame,c.sourceEndFrame,c.outputStartFrame,c.outputEndFrame]),[[0,30,0,30],[60,90,30,60],[120,150,60,90]]);
  const edit=read('projects/talk/edit.json');edit.visuals=[{scene:'headline',start:0,end:1.5015,text:'FRAME CLOCK',at:[0,.2]}];write('projects/talk/edit.json',edit);
  const result=editor('draft','talk');assert.match(result.stdout,/listening: pending/);
  const output=path.join(dir,'output/drafts/talk.mp4'),probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-of','json',output]).stdout),video=probe.streams.find(s=>s.codec_type==='video');
  assert.equal(video.width,540);assert.equal(video.height,960);assert.equal(video.r_frame_rate,'60000/1001');assert.equal(video.nb_frames,'90');assert.ok(probe.streams.some(s=>s.codec_type==='audio'));
  assert.equal(artifactStatus(dir,'talk',edit,output).state,'current');
  for(const [second,dominant] of [[.2,0],[.7,1],[1.2,2]]){
   const pixels=run('ffmpeg',['-v','error','-ss',String(second),'-i',output,'-vf','crop=2:2:270:700,format=rgb24','-frames:v','1','-f','rawvideo','-'],{encoding:null}).stdout;
   assert.ok(pixels[dominant]>pixels[(dominant+1)%3]*2&&pixels[dominant]>pixels[(dominant+2)%3]*2,`expected channel ${dominant} at output ${second}: ${[...pixels.subarray(0,3)]}`);
  }
  const samples=run('ffmpeg',['-v','error','-i',output,'-vn','-ar','48000','-ac','1','-f','f32le','-'],{encoding:null}).stdout;
  function rms(a,b){let sum=0,count=0;for(let i=Math.round(a*48000);i<Math.round(b*48000);i++){const value=samples.readFloatLE(i*4);sum+=value*value;count++;}return Math.sqrt(sum/count);}
  for(const offset of [0,.5005,1.001])assert.ok(rms(offset+.15,offset+.3)>rms(offset+.01,offset+.06)*5,'tone must follow each mapped word onset with quiet lead-in');
  editor('review','talk','--draft');
  const report=read('output/review/talk-draft/report.json');for(const name of ['size','fps','frames','audio'])assert.equal(report.checks.find(c=>c.name===name).pass,true,name);
  assert.equal(report.dialogue.gates.listening.state,'pending');assert.equal(dialogueStatus(dir,'talk',edit).gates.takeSelection.state,'pending');
  assert.equal(artifactStatus(dir,'talk',edit,path.join(dir,'output/review/talk-draft/report.json')).state,'current');
  const transcript=read('projects/talk/transcript.json');transcript.words[0].text='Changed';write('projects/talk/transcript.json',transcript);
  assert.equal(artifactStatus(dir,'talk',edit,output).state,'stale');
  const rejected=spawnSync(process.execPath,[path.join(root,'scripts/editor.mjs'),'draft','talk'],{cwd:dir,encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/snapshot/);
  write('projects/talk/transcript.json',{...transcript,words:[{...transcript.words[0],text:'Red'},...transcript.words.slice(1)]});
 }finally{if(!process.env.EDITOR_DIALOGUE_EVIDENCE_DIR)fs.rmSync(dir,{recursive:true,force:true});}
});
