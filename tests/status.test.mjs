import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {snapshotDialogue,writeArtifactReceipt,captureArtifactDependency,recordDialogueReview,fileSha256} from '../src/dialogue.mjs';
const cli=path.resolve('scripts/editor.mjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'editor-status-')),dir=path.join(root,'projects/talk');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(root,'public/projects/talk'),{recursive:true});fs.writeFileSync(path.join(root,'public/projects/talk/input.mp4'),'fixture source');
 const edit={title:'Talk',source:'projects/talk/input.mp4',clips:[{start:0,end:2}],captions:[],cards:[],sfx:[]};
 const write=(name,value)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};write('edit.json',edit);
 const run=(...args)=>spawnSync(process.execPath,[cli,'status','talk',...args],{cwd:root,encoding:'utf8'});
 const get=()=>{const r=run('--json');assert.ok(r.stdout.startsWith('{'),r.stderr);return {exit:r.status,status:JSON.parse(r.stdout)};};
 const transcript=()=>write('transcript.json',{clock:'source',engine:'imported fixture.json',words:[{text:'Hello',start:.2,end:.6}]});
 const artifact=(name,receipt=true)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,name.endsWith('.json')?JSON.stringify({checks:[{name:'size',pass:false}]}):'fixture render');if(receipt)writeArtifactReceipt(root,'talk',JSON.parse(fs.readFileSync(path.join(dir,'edit.json'))),file);return file;};
 return {root,dir,edit,write,run,get,transcript,artifact,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('status reports imported media without transcript or outputs as usable legacy, not reviewed',()=>{
 const f=fixture();try{const {exit,status:s}=f.get();assert.equal(exit,0);assert.equal(s.schemaVersion,1);assert.equal(s.import.state,'ready');assert.equal(s.transcript.state,'missing');assert.equal(s.dialogue.integrity,'legacy');assert.equal(s.dialogue.gates,null);for(const a of Object.values(s.artifacts))assert.equal(a.state,'missing');assert.ok(s.nextSteps.some(x=>x.includes('transcribe')));assert.match(f.run().stdout,/not.*review|pending/i);}finally{f.cleanup();}
});
test('status uses revision integrity, current receipts and effective listening without certifying technical reports',()=>{
 const f=fixture();try{
  f.transcript();snapshotDialogue(f.root,'talk',f.edit,{sourceDuration:2});const edit=JSON.parse(fs.readFileSync(path.join(f.dir,'edit.json')));
  const draft=f.artifact('output/drafts/talk.mp4'),final=f.artifact('output/talk.mp4',false),report=f.artifact('output/review/talk-draft/report.json');
  writeArtifactReceipt(f.root,'talk',edit,report,{dependencies:[captureArtifactDependency(f.root,'talk',edit,draft)]});
  let s=f.get().status;assert.equal(s.transcript.state,'available');assert.equal(s.transcript.wordCount,1);assert.equal(s.dialogue.revision,'v001');assert.equal(s.dialogue.gates.listening.state,'pending');assert.equal(s.artifacts.draft.state,'current');assert.equal(s.artifacts.final.state,'unverified');assert.equal(s.artifacts.draftReview.state,'current');assert.deepEqual(s.artifacts.draftReview.technicalChecks,{passed:0,total:1,failed:['size']});
  recordDialogueReview(f.root,'talk',edit,{revision:'v001',reviewer:'Test fixture',reviewedAt:'2026-11-17T12:00:00Z',gates:{listening:{state:'pass',evidence:'Synthetic assertion fixture, not real listening',media:{path:'output/drafts/talk.mp4',sha256:fileSha256(draft)}}}});
  assert.equal(f.get().status.dialogue.gates.listening.state,'pass');fs.appendFileSync(draft,'changed');writeArtifactReceipt(f.root,'talk',edit,draft);
  s=f.get().status;assert.equal(s.dialogue.gates.listening.state,'pending');assert.equal(s.artifacts.draftReview.state,'stale');assert.equal(s.artifacts.draftReview.technicalChecks,undefined);
  f.write('transcript.json',{words:[{text:'Changed',start:.2,end:.6}]});const changed=f.get();assert.equal(changed.exit,1);assert.equal(changed.status.dialogue.integrity,'stale');assert.equal(changed.status.artifacts.draft.state,'stale');assert.ok(changed.status.nextSteps.some(x=>x.includes('--snapshot')));
  fs.rmSync(final);
 }finally{f.cleanup();}
});
test('status gives structured failures for malformed edit/transcript, missing media and broken revision pointers',()=>{
 const f=fixture();try{
  f.write('transcript.json',{words:[{text:'bad',start:2,end:1}]});let r=f.get();assert.equal(r.exit,1);assert.equal(r.status.transcript.state,'invalid');
  f.transcript();f.write('dialogue/current.json',{revision:'not-a-revision'});r=f.get();assert.equal(r.exit,1);assert.equal(r.status.dialogue.integrity,'stale');
  fs.rmSync(path.join(f.root,'public/projects/talk/input.mp4'));r=f.get();assert.equal(r.status.import.state,'missing');assert.equal(r.exit,1);
  fs.writeFileSync(path.join(f.dir,'edit.json'),'{');r=f.get();assert.equal(r.exit,1);assert.equal(r.status.import.state,'invalid');assert.ok(r.status.issues.length);
  fs.rmSync(path.join(f.dir,'edit.json'));r=f.get();assert.equal(r.status.import.state,'missing');assert.ok(r.status.nextSteps.some(x=>x.includes('npm run init')));
 }finally{f.cleanup();}
});

for(const [name,gate] of [['null',null],['invalid state',{state:'approved',evidence:'Original evidence must be preserved'}]]){
 test(`status JSON fails safely for a saved review gate with ${name}`,()=>{
  const f=fixture();try{
   f.transcript();snapshotDialogue(f.root,'talk',f.edit,{sourceDuration:2});
   const file=path.join(f.dir,'dialogue/v001/review.json'),review=JSON.parse(fs.readFileSync(file));review.gates.takeSelection=gate;fs.writeFileSync(file,JSON.stringify(review));const before=fs.readFileSync(file,'utf8');
   const {exit,status}=f.get();assert.equal(exit,1);assert.equal(status.ok,false);assert.equal(status.dialogue.integrity,'stale');assert.equal(status.dialogue.gates,null);assert.match(status.issues.join(' '),/review\.json.*restore/i);
   const plain=f.run();assert.equal(plain.status,1);assert.match(plain.stdout,/review\.json/);assert.equal(plain.stderr,'');assert.equal(fs.readFileSync(file,'utf8'),before,'status preserves malformed saved evidence');
  }finally{f.cleanup();}
 });
}
