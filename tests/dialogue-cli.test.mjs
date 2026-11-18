import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=path.resolve('scripts/editor.mjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dialogue-cli-')),input=path.join(root,'source.mp4');
 const ff=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=64x64:r=30:d=3','-f','lavfi','-i','sine=frequency=220:duration=3','-c:v','libx264','-c:a','aac','-shortest',input]);assert.equal(ff.status,0,ff.stderr?.toString());
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});
 assert.equal(run('init','talk','--input',input).status,0);
 const dir=path.join(root,'projects/talk');const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const write=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
 write('transcript.json',{clock:'source',words:[{text:'Hello',start:.2,end:.6},{text:'world',start:1.5,end:1.9}]});
 return {root,dir,run,read,write,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('--apply requires an existing saved proposal and never generates one as a side effect',()=>{
 const f=fixture();try{const before=f.read('edit.json'),r=f.run('cut','talk','--apply');assert.notEqual(r.status,0,'missing saved plan must refuse application');assert.match(r.stderr,/proposal|npm run cut/i);assert.deepEqual(f.read('edit.json'),before);assert.equal(fs.existsSync(path.join(f.dir,'cuts.proposed.json')),false);}finally{f.cleanup();}
});
test('--apply --plan uses the exact edited saved selection and refuses proposal-generation flags',()=>{
 const f=fixture();try{
  const file=path.join(f.root,'reviewed.json');let r=f.run('cut','talk','--plan',file);assert.equal(r.status,0,r.stderr);
  const plan=JSON.parse(fs.readFileSync(file));plan.clips=[{start:1.4,end:2.1}];fs.writeFileSync(file,JSON.stringify(plan));const saved=fs.readFileSync(file,'utf8');
  const before=f.read('edit.json');r=f.run('cut','talk','--apply','--plan',file,'--remove-fillers');assert.notEqual(r.status,0);assert.deepEqual(f.read('edit.json'),before);
  r=f.run('cut','talk','--apply','--plan',file);assert.equal(r.status,0,r.stderr);assert.deepEqual(f.read('edit.json').clips,[{start:1.4,end:2.1}]);assert.equal(fs.readFileSync(file,'utf8'),saved);assert.deepEqual(f.read('edit.json').captions.map(c=>c.text),['WORLD']);
  r=f.run('dialogue','talk');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/listening[\s\S]*pending/);
 }finally{f.cleanup();}
});
test('words, captions, draft and review reject stale revision clocks before writing outputs',()=>{
 const f=fixture();try{
  assert.equal(f.run('cut','talk').status,0);let r=f.run('cut','talk','--apply');assert.equal(r.status,0,r.stderr);
  const edit=f.read('edit.json');edit.clips=[{start:1.4,end:2.1}];edit.captions=[];f.write('edit.json',edit);const originalWords=fs.readFileSync(path.join(f.dir,'words.output.json'),'utf8');
  for(const args of [['words','talk'],['captions','talk','--words','--apply'],['draft','talk'],['review','talk','--draft']]){r=f.run(...args);assert.notEqual(r.status,0);assert.match(r.stderr,/stale|snapshot/i);}
  assert.equal(fs.readFileSync(path.join(f.dir,'words.output.json'),'utf8'),originalWords);
  r=f.run('dialogue','talk','--snapshot');assert.equal(r.status,0,r.stderr);assert.equal(f.read('dialogue/current.json').revision,'v002');assert.deepEqual(f.read('edit.json').captions.map(c=>c.text),['WORLD']);assert.equal(f.run('words','talk').status,0);
 }finally{f.cleanup();}
});
test('corrected transcript adoption clears stale in-bounds overlays only on explicit request',()=>{
 const f=fixture();try{
  f.run('cut','talk');assert.equal(f.run('cut','talk','--apply').status,0);
  const edit=f.read('edit.json');edit.cards=[{start:0,end:.2,text:'Old'}];f.write('edit.json',edit);
  const t=f.read('transcript.json');t.words[0].text='Corrected';f.write('transcript.json',t);
  let r=f.run('dialogue','talk','--snapshot');assert.notEqual(r.status,0);assert.match(r.stderr,/clear-overlays/);assert.deepEqual(f.read('edit.json'),edit);
  r=f.run('dialogue','talk','--snapshot','--clear-overlays');assert.equal(r.status,0,r.stderr);assert.deepEqual(f.read('edit.json').cards,[]);assert.equal(f.read('edit.json').captions[0].text,'CORRECTED');
 }finally{f.cleanup();}
});
