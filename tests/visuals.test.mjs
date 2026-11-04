import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEdit, lintEdit} from '../src/edit.mjs';
import {splitProgress, footageRect, stageRect, captionTop, SAFE} from '../src/layout.mjs';
import {loudnormFilter, parseLoudnorm, MASTER} from '../src/audio.mjs';

const base=()=>({title:'T',source:'projects/x/input.mp4',clips:[{start:0,end:20}],captions:[],cards:[],sfx:[]});
const v=(scene,start,end,extra={})=>({scene,start,end,...extra});

test('accepts every built-in scene with its required fields',()=>{
 const visuals=[
  v('headline',3,5,{text:'Write it down first',at:[3.2,3.6]}),
  v('number',5.5,7,{value:3,suffix:' hrs',label:'lost every day'}),
  v('list',7.5,10,{title:'The fix',items:['Write it','Do it first'],at:[7.6,8.5]}),
  v('bars',10.5,12,{bars:[{label:'Email',value:40},{label:'Deep work',value:10}],unit:'%',highlight:1}),
  v('quote',12.5,14,{text:'Do the one thing.'}),
  v('image',14.5,16,{src:'projects/x/shot.png',highlight:{x:10,y:20,w:30,h:10,at:15}}),
  v('custom',16.5,18,{component:'MyScene',props:{anything:true}})
 ];
 assert.equal(validateEdit({...base(),visuals,layout:{visualHeight:820},captionStyle:'word'}).visuals.length,7);
});

test('rejects unknown scenes, missing fields, overlaps, reveal times outside the visual and bad layout',()=>{
 const bad=[
  [v('spinner',1,2)],
  [v('headline',1,2)],
  [v('number',1,2,{value:'3'})],
  [v('list',1,3,{items:[]})],
  [v('list',1,3,{items:['a'],at:[0.5]})],
  [v('bars',1,2,{bars:[{label:'a',value:-1}]})],
  [v('image',1,2,{src:'../escape.png'})],
  [v('custom',1,2,{component:'not a name'})],
  [v('quote',1,2,{text:'a'}),v('quote',1.5,3,{text:'b'})],
  [v('quote',19,21,{text:'past the end'})],
  [v('quote',1,1.2,{text:'too short to read'})]
 ];
 for(const visuals of bad)assert.throws(()=>validateEdit({...base(),visuals}),/visual/i,JSON.stringify(visuals));
 for(const layout of [{visualHeight:300},{visualHeight:1500},{visualHeight:'768'}])assert.throws(()=>validateEdit({...base(),layout}),/layout/i);
 assert.throws(()=>validateEdit({...base(),captionStyle:'karaoke'}),/captionStyle/);
});

test('lint flags craft problems without failing validation',()=>{
 const edit={...base(),
  visuals:[v('headline',0.5,2.5,{text:'This headline has far too many words in it'}),v('headline',2.6,4,{text:'Again'})],
  sfx:[{src:'sfx/pop.ogg',start:1}]};
 const warnings=lintEdit(validateEdit(edit)).join('\n');
 assert.match(warnings,/words/i);
 assert.match(warnings,/same scene/i);
 assert.match(warnings,/first 3 s/i);
 assert.deepEqual(lintEdit(validateEdit({...base(),visuals:[v('quote',4,6,{text:'Do it first.'})]})),[]);
});

test('footage slides into the bottom zone only while a visual is on screen',()=>{
 const visuals=[v('quote',2,4,{text:'x'}),v('quote',4.3,6,{text:'y'})];
 assert.equal(splitProgress(0,visuals),0);
 assert.equal(splitProgress(Math.round(3*30),visuals),1);
 assert.equal(splitProgress(Math.round(4.15*30),visuals),1,'short gaps between visuals stay split instead of bouncing');
 assert.equal(splitProgress(Math.round(8*30),visuals),0);
 const entering=splitProgress(61,visuals);assert.ok(entering>0&&entering<1);
 assert.deepEqual(footageRect(0,768),{top:0,height:1920});
 assert.deepEqual(footageRect(1,768),{top:768,height:1152});
});

test('scene stage and captions stay inside the Reels safe zone',()=>{
 const stage=stageRect(768);
 assert.ok(stage.left>=SAFE.left&&stage.left+stage.width<=SAFE.right);
 assert.ok(stage.top>=SAFE.top&&stage.top+stage.height<=768);
 assert.equal(captionTop(1,768),768);
 assert.ok(captionTop(0,768)>=SAFE.top&&captionTop(0,768)<=SAFE.bottom-100);
});

test('mastering measures then applies a static loudness correction to -14 LUFS / -1 dBTP',()=>{
 assert.equal(MASTER.integrated,-14);assert.equal(MASTER.truePeak,-1);
 assert.match(loudnormFilter(),/print_format=json/);
 const stderr='[Parsed_loudnorm_0 @ 0x1]\n{\n "input_i" : "-23.40",\n "input_tp" : "-6.10",\n "input_lra" : "4.20",\n "input_thresh" : "-33.60",\n "target_offset" : "0.20"\n}\n';
 const measured=parseLoudnorm(stderr);assert.equal(measured.input_i,'-23.40');
 const filter=loudnormFilter(measured);
 for(const part of ['I=-14','TP=-1','measured_I=-23.40','measured_TP=-6.10','offset=0.20','linear=true'])assert.ok(filter.includes(part),part);
 assert.equal(parseLoudnorm('no audio here'),null);
 assert.equal(parseLoudnorm('{"input_i" : "-inf"}'),null,'silent tracks are skipped');
});

test('scene names that are object built-ins are rejected',()=>{
 for(const scene of ['toString','constructor','__proto__','hasOwnProperty'])assert.throws(()=>validateEdit({...base(),visuals:[v(scene,1,2)]}),/unknown scene/i);
});

test('a visual that runs to the end of the video holds instead of exiting on the last frames',()=>{
 const visuals=[v('quote',2,4,{text:'x'})];
 assert.equal(splitProgress(119,visuals,30,120),1,'last frame of the video stays split');
 assert.ok(splitProgress(119,visuals)<1,'without the total it still exits');
});
