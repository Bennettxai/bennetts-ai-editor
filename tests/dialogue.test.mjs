import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const api=await import('../src/dialogue.mjs').catch(()=>({}));
const json=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dialogue-'));
 const dir=path.join(root,'projects/talk');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(root,'public'),{recursive:true});
 fs.writeFileSync(path.join(root,'public/input.mp4'),'original media bytes');
 const edit={title:'Talk',source:'input.mp4',format:{fps:'60000/1001',resolution:'4k'},clips:[{start:0,end:2.002,zoom:1.1}],captions:[],cards:[],sfx:[]};
 const transcript={clock:'source',words:[{text:'First',start:.1001,end:.4004},{text:'Second',start:1.001,end:1.4014}]};
 json(path.join(dir,'edit.json'),edit);json(path.join(dir,'transcript.json'),transcript);
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const write=(name,data)=>json(path.join(dir,name),data);
 const plan=()=>api.createProposal(root,'talk',edit,{clips:[{start:0,end:.5005},{start:1.001,end:1.5015}],decisions:[{action:'CUT',reason:'Reviewed pause'}],flags:[]},2.002);
 const apply=(p,options={})=>api.applyProposal(root,'talk',read('edit.json'),p,{sourceDuration:2.002,...options});
 return {root,dir,edit,transcript,read,write,plan,apply,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('saved selections become exact contiguous fractional-rate mappings with pending human gates',()=>{
 assert.equal(typeof api.createProposal,'function','dialogue proposal API must exist');const f=fixture();
 try{
  const plan=f.plan();plan.clips[1].end=1.7017;
  const next=f.apply(plan);assert.deepEqual(next.clips.map(c=>[c.start,c.end]),[[0,.5005],[1.001,1.7017]]);
  assert.ok(next.clips.every(c=>c.zoom===1.1));assert.deepEqual(next.captions.map(c=>c.text),['FIRST','SECOND']);
  const current=f.read('dialogue/current.json');assert.equal(current.revision,'v001');
  const manifest=f.read('dialogue/v001/manifest.json');assert.equal(manifest.fps,'60000/1001');assert.equal(manifest.frameClock,'source-time-at-output-fps');
  assert.deepEqual(manifest.clips.map(c=>[c.sourceStartFrame,c.sourceEndFrame,c.outputStartFrame,c.outputEndFrame]),[[0,30,0,30],[60,102,30,72]]);
  assert.deepEqual(f.read('dialogue/v001/transcript.output.json').words.map(w=>[w.text,w.start,w.end]),[['First',.10010000000000001,.40040000000000003],['Second',.5005000000000001,.9009]]);
  assert.deepEqual(f.read('dialogue/v001/edit.before.json'),f.edit);
  const status=api.dialogueStatus(f.root,'talk',next);assert.equal(status.integrity,'current');assert.equal(status.gates.technical.state,'pass');
  for(const gate of ['takeSelection','cutCoverage','listening'])assert.equal(status.gates[gate].state,'pending');
 }finally{f.cleanup();}
});
test('plans reject changed dependencies and malformed or unsafe ranges without mutating any project state',()=>{
 assert.equal(typeof api.createProposal,'function','dialogue proposal API must exist');
 for(const mutate of [
  (f,p)=>{p.identity.sourceSha256='wrong';},(f,p)=>{p.identity.transcriptSha256='wrong';},(f,p)=>{p.identity.baseClipsSha256='wrong';},(f,p)=>{p.identity.fps='30/1';},
  (f,p)=>{delete p.identity;},(f,p)=>{p.clips=[];},(f,p)=>{p.clips=[{start:0,end:3.003}];},(f,p)=>{p.clips=[{start:.002,end:.5005}];},
  (f,p)=>{p.clips=[{start:1.001,end:1.5015},{start:0,end:.5005}];},(f,p)=>{p.clips=[{start:0,end:.5005},{start:.4004,end:1.5015}];}
 ]){
  const f=fixture();try{const p=f.plan();mutate(f,p);assert.throws(()=>f.apply(p));assert.deepEqual(f.read('edit.json'),f.edit);assert.equal(fs.existsSync(path.join(f.dir,'dialogue/current.json')),false);}finally{f.cleanup();}
 }
 const f=fixture();try{
  const edit={...f.edit,clips:[{start:0,end:.5005},{start:1.001,end:2.002}]};f.write('edit.json',edit);
  const p=api.createProposal(f.root,'talk',edit,{clips:edit.clips,decisions:[],flags:[]},2.002);p.clips=[{start:0,end:1.5015}];
  assert.throws(()=>f.apply(p),/base clip|removed|intersect/i);
 }finally{f.cleanup();}
});
test('partial words require explicit evidence for that exact range and source word',()=>{
 assert.equal(typeof api.createProposal,'function','dialogue proposal API must exist');const f=fixture();
 try{const p=f.plan();p.clips=[{start:.2002,end:.5005}];assert.throws(()=>f.apply(p),/partial.word/i);
  p.partialWordExceptions=[{clipIndex:0,wordIndex:0,sourceStartFrame:12,sourceEndFrame:30,reason:'Checked this recognizer boundary against the recording',reviewer:'Editor'}];
  const next=f.apply(p);assert.deepEqual(next.captions.map(c=>c.text),['FIRST']);assert.equal(f.read('dialogue/v001/transcript.output.json').words[0].partial,true);
 }finally{f.cleanup();}
});
test('a changed cut rejects even in-bounds overlays and explicit clearing archives recovery data',()=>{
 assert.equal(typeof api.createProposal,'function','dialogue proposal API must exist');const f=fixture();
 try{
  const edit={...f.edit,cards:[{start:0,end:.2,text:'Old timing'}],visuals:[{start:0,end:.8,scene:'headline',text:'Old visual'}],sfx:[{start:.1,src:'tick.wav'}]};f.write('edit.json',edit);
  const p=api.createProposal(f.root,'talk',edit,{clips:[{start:1.001,end:2.002}],decisions:[],flags:[]},2.002);
  f.write('words.output.json',{clock:'output',words:[{text:'Stale',start:0,end:.2}]});f.write('captions.proposed.json',[{text:'Stale'}]);
  assert.throws(()=>f.apply(p),/clear-overlays/);assert.deepEqual(f.read('edit.json'),edit);
  const next=f.apply(p,{clearOverlays:true});for(const key of ['cards','visuals','sfx'])assert.deepEqual(next[key],[]);
  assert.deepEqual(f.read('dialogue/v001/edit.before.json'),edit);assert.equal(f.read('dialogue/v001/archive/words.output.json').words[0].text,'Stale');
  assert.equal(fs.existsSync(path.join(f.dir,'captions.proposed.json')),false);assert.equal(f.read('words.output.json').words[0].text,'Second');
 }finally{f.cleanup();}
});
test('manual transcript or timeline changes become stale and snapshot adopts them with reset gates',()=>{
 assert.equal(typeof api.snapshotDialogue,'function','manual adoption API must exist');const f=fixture();
 try{
  let next=f.apply(f.plan());
  api.recordDialogueReview(f.root,'talk',next,{revision:'v001',reviewer:'A human',reviewedAt:'2026-11-17T12:00:00Z',gates:{takeSelection:{state:'pass',evidence:'Compared complete takes in source'},cutCoverage:{state:'pass',evidence:'Audited all gaps and rejected ranges'}}});
  assert.equal(api.dialogueStatus(f.root,'talk',next).gates.takeSelection.state,'pass');
  f.write('transcript.json',{...f.transcript,words:[{...f.transcript.words[0],text:'Corrected'},f.transcript.words[1]]});
  assert.equal(api.dialogueStatus(f.root,'talk',next).integrity,'stale');assert.throws(()=>api.assertDialogueIntegrity(f.root,'talk',next),/snapshot/);
  next=api.snapshotDialogue(f.root,'talk',next,{sourceDuration:2.002});assert.equal(f.read('dialogue/current.json').revision,'v002');assert.equal(next.captions[0].text,'CORRECTED');
  assert.equal(api.dialogueStatus(f.root,'talk',next).gates.takeSelection.state,'pending');assert.equal(f.read('dialogue/v001/review.json').gates.takeSelection.state,'pass');
  next={...next,clips:[{start:1.001,end:1.5015}],cards:[{start:0,end:.1,text:'Stale'}]};f.write('edit.json',next);
  assert.throws(()=>api.snapshotDialogue(f.root,'talk',next,{sourceDuration:2.002}),/clear-overlays/);
  next=api.snapshotDialogue(f.root,'talk',next,{sourceDuration:2.002,clearOverlays:true});assert.equal(f.read('dialogue/current.json').revision,'v003');assert.deepEqual(next.cards,[]);
 }finally{f.cleanup();}
});
test('source replacement cannot silently render and invalid review evidence cannot pass a gate',()=>{
 assert.equal(typeof api.assertDialogueIntegrity,'function','integrity API must exist');const f=fixture();
 try{
  const next=f.apply(f.plan());
  assert.throws(()=>api.recordDialogueReview(f.root,'talk',next,{revision:'v001',reviewer:'Editor',gates:{listening:{state:'pass'}}}),/evidence|reviewedAt/);
  assert.throws(()=>api.recordDialogueReview(f.root,'talk',next,{revision:'v000',reviewer:'Editor',reviewedAt:'2026-11-17T12:00:00Z',gates:{takeSelection:{state:'pass',evidence:'Old review'}}}),/revision/);
  fs.appendFileSync(path.join(f.root,'public/input.mp4'),' replacement');assert.equal(api.dialogueStatus(f.root,'talk',next).integrity,'stale');assert.throws(()=>api.assertDialogueIntegrity(f.root,'talk',next),/source/);
 }finally{f.cleanup();}
});
test('render receipts bind actual output bytes and current source, transcript, edit and revision',()=>{
 assert.equal(typeof api.writeArtifactReceipt,'function','render receipt API must exist');const f=fixture();
 try{
  const next=f.apply(f.plan()),file=path.join(f.root,'draft.mp4');fs.writeFileSync(file,'rendered bytes');
  assert.equal(api.artifactStatus(f.root,'talk',next,file).state,'unverified');api.writeArtifactReceipt(f.root,'talk',next,file);
  assert.equal(api.artifactStatus(f.root,'talk',next,file).state,'current');
  assert.equal(api.artifactStatus(f.root,'talk',{...next,title:'New title'},file).state,'stale');
  fs.appendFileSync(file,'changed');assert.equal(api.artifactStatus(f.root,'talk',next,file).state,'stale');
 }finally{f.cleanup();}
});
test('legacy projects without a dialogue revision keep working',()=>{
 assert.equal(typeof api.dialogueStatus,'function','dialogue status API must exist');const f=fixture();
 try{fs.rmSync(path.join(f.dir,'transcript.json'));assert.equal(api.dialogueStatus(f.root,'talk',f.edit).integrity,'legacy');assert.doesNotThrow(()=>api.assertDialogueIntegrity(f.root,'talk',f.edit));}finally{f.cleanup();}
});
test('partial-word exceptions are bound to the exact range and malformed exceptions fail before mutation',()=>{
 const f=fixture();try{
  const p=f.plan();p.clips=[{start:.2002,end:.5005}];
  const valid={clipIndex:0,wordIndex:0,sourceStartFrame:12,sourceEndFrame:30,reviewer:'Editor',reason:'Reviewed exact boundary'};
  for(const invalid of [null,{...valid,sourceStartFrame:6},{...valid,sourceEndFrame:42},{...valid,reviewer:''},{...valid,clipIndex:1}]){
   p.partialWordExceptions=[invalid];assert.throws(()=>f.apply(p),/exception|partial.word/i);assert.deepEqual(f.read('edit.json'),f.edit);
  }
  p.partialWordExceptions=[valid];assert.doesNotThrow(()=>f.apply(p));
 }finally{f.cleanup();}
});
test('listening passes require the current rendered media, not an old file with matching bytes',()=>{
 const f=fixture();try{
  let next=f.apply(f.plan());const file=path.join(f.root,'draft.mp4');fs.writeFileSync(file,'draft');api.writeArtifactReceipt(f.root,'talk',next,file);
  const evidence={revision:'v001',reviewer:'Listener',reviewedAt:'2026-11-17T12:00:00Z',gates:{listening:{state:'pass',evidence:'Actually listened through every join',media:{path:'draft.mp4',sha256:api.fileSha256(file)}}}};
  api.recordDialogueReview(f.root,'talk',next,evidence);assert.equal(api.dialogueStatus(f.root,'talk',next).gates.listening.state,'pass');
  f.write('transcript.json',{...f.transcript,words:[{...f.transcript.words[0],text:'Correction'},f.transcript.words[1]]});next=api.snapshotDialogue(f.root,'talk',next,{sourceDuration:2.002});
  assert.throws(()=>api.recordDialogueReview(f.root,'talk',next,{...evidence,revision:'v002'}),/current|stale|render/i);
  assert.equal(api.dialogueStatus(f.root,'talk',next).gates.listening.state,'pending');
 }finally{f.cleanup();}
});
test('snapshot adopts only a manual timeline/transcript and refuses replaced source media',()=>{
 const f=fixture();try{const next=f.apply(f.plan());fs.appendFileSync(path.join(f.root,'public/input.mp4'),'replaced');assert.throws(()=>api.snapshotDialogue(f.root,'talk',next,{sourceDuration:2.002}),/source.*(restore|import)|restore.*source/i);assert.equal(f.read('dialogue/current.json').revision,'v001');}finally{f.cleanup();}
});
test('tampered immutable snapshots and interrupted transactions fail closed',()=>{
 const f=fixture();try{const next=f.apply(f.plan());f.write('dialogue/v001/manifest.json',{});assert.equal(api.dialogueStatus(f.root,'talk',next).integrity,'stale');assert.throws(()=>api.assertDialogueIntegrity(f.root,'talk',next),/snapshot changed/);}finally{f.cleanup();}
 const g=fixture();try{const next=g.apply(g.plan());g.write('dialogue/.lock',{pid:999999});assert.match(api.dialogueStatus(g.root,'talk',next).issues[0],/locked|interrupted/);assert.throws(()=>g.apply(g.plan()),/locked|interrupted/);}finally{g.cleanup();}
});
test('a failed working-file commit restores prior bytes and leaves no published revision',t=>{
 const f=fixture();try{
  // Inject only the final pointer rename failure after the edit/words have been written.
  const rename=fs.renameSync;
  t.mock.method(fs,'renameSync',(from,to)=>{if(to===path.join(f.dir,'dialogue/current.json'))throw new Error('Disk commit failure');return rename(from,to);});
  assert.throws(()=>f.apply(f.plan()));assert.deepEqual(f.read('edit.json'),f.edit);assert.equal(fs.existsSync(path.join(f.dir,'dialogue/current.json')),false);assert.deepEqual(fs.readdirSync(path.join(f.dir,'dialogue')),[]);
 }finally{f.cleanup();}
});
test('receipts reject dependencies changed while a render was running',()=>{
 const f=fixture();try{
  assert.equal(typeof api.artifactIdentity,'function','render start identity must be capturable');
  const expected=api.artifactIdentity(f.root,'talk',f.edit),file=path.join(f.root,'draft.mp4');fs.writeFileSync(file,'rendered');
  fs.appendFileSync(path.join(f.root,'public/input.mp4'),'changed during render');
  assert.throws(()=>api.writeArtifactReceipt(f.root,'talk',f.edit,file,{expectedIdentity:expected}),/changed.*render|render.*changed/i);assert.equal(fs.existsSync(`${file}.receipt.json`),false);
 }finally{f.cleanup();}
});
test('failed rollback retains its lock so a partially committed revision cannot appear current',t=>{
 const f=fixture();try{
  const rename=fs.renameSync;let editWrites=0;
  t.mock.method(fs,'renameSync',(from,to)=>{
   if(to===path.join(f.dir,'edit.json')&&++editWrites>1)throw new Error('Recovery disk failure');
   if(to===path.join(f.dir,'dialogue/current.json'))throw new Error('Commit disk failure');return rename(from,to);
  });
  assert.throws(()=>f.apply(f.plan()),/recover|rollback|interrupted/i);assert.equal(fs.existsSync(path.join(f.dir,'dialogue/.lock')),true);assert.equal(api.dialogueStatus(f.root,'talk',f.read('edit.json')).integrity,'stale');
 }finally{f.cleanup();}
});
