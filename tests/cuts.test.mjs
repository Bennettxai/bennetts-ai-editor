import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeCuts} from '../src/cuts.mjs';

const w=(text,start,end)=>({text,start,end});
const words=[w('Most',1,1.3),w('founders',1.35,1.8),w('waste',2.9,3.2),w('time.',3.25,3.6),w('Here',3.7,3.9)];

test('trims the head and tail and tightens long pauses, keeping padding around every word',()=>{
 const {clips,removedSeconds}=proposeCuts(words,10);
 // Pads: 0.1 s before a word, 0.15 s after. Clip edges snap outward to the 30 fps grid.
 const frames=clips.map(c=>[Math.round(c.start*30),Math.round(c.end*30)]);
 assert.deepEqual(frames,[[27,59],[84,122]]); // 0.9–1.95→1.967 and 2.8–4.05→4.067
 for(const c of clips)for(const v of [c.start,c.end])assert.equal(v,Math.round(v*30)/30);
 assert.ok(Math.abs(removedSeconds-(10-(32+38)/30))<1e-9);
});

test('every word stays fully inside a kept clip',()=>{
 const {clips}=proposeCuts(words,10);
 for(const word of words)assert.ok(clips.some(c=>c.start<=word.start&&c.end>=word.end),word.text);
});

test('short pauses are kept, and the log says why for every gap',()=>{
 const {clips,decisions}=proposeCuts([w('a',0,.5),w('b',.7,1)],1);
 assert.equal(clips.length,1);
 assert.deepEqual(decisions.map(d=>d.action),['KEEP']);
 assert.match(decisions[0].reason,/pause/i);
});

test('fillers and repeated words are flagged for review, not removed by default',()=>{
 const {flags,clips}=proposeCuts([w('So',0,.2),w('um,',.3,.5),w('the',.6,.7),w('the',.75,.9),w('plan',.95,1.2)],2);
 assert.deepEqual(flags.map(f=>f.type),['filler','repeat']);
 assert.equal(clips.length,1);
});

test('removeFillers cuts filler words out like silence',()=>{
 const {clips}=proposeCuts([w('So',0,.2),w('um',.9,1.4),w('here',2,2.3)],3,{removeFillers:true});
 assert.ok(clips.every(c=>!(c.start<1.15&&c.end>1.15)),'filler midpoint must be outside kept clips');
});

test('options control the pause threshold; clips never leave the source',()=>{
 const {clips}=proposeCuts([w('a',.02,.5),w('b',.9,1.98)],2,{maxPause:1});
 assert.deepEqual(clips,[{start:0,end:2}]);
 assert.throws(()=>proposeCuts([],2),/no words/i);
});

test('with detected silences, only real silence is cut and sound without transcript words is kept but flagged',()=>{
 const ws=[w('busy',2,2.3),w('work.',2.33,2.46),w('Here',4.2,4.5),w('fix.',4.6,4.9)];
 // lead-in silence 0–2; pause 2.59–4.13; an unworded noise 5.2–5.6 between silences 4.92–5.2 and 5.6–7
 const silences=[{start:0,end:2},{start:2.59,end:4.13},{start:4.92,end:5.2},{start:5.6,end:7}];
 const {clips,flags,decisions}=proposeCuts(ws,7,{silences});
 const frames=clips.map(c=>[Math.round(c.start*30),Math.round(c.end*30)]);
 assert.deepEqual(frames[0],[57,83],'head trimmed to speech − 0.1 s pad; pause tightened to 2.59 + 0.15 = 2.74 s → frame 83 rounding outward');
 assert.ok(clips.some(c=>c.start<=5.2&&c.end>=5.6),'unworded sound is never cut');
 assert.ok(flags.some(f=>f.type==='unworded'&&Math.abs(f.at-5.2)<1e-9));
 assert.ok(decisions.filter(d=>d.action==='CUT').length>=2);
 assert.ok(clips.at(-1).end<=5.6+0.15+1/30,'trailing silence trimmed');
});

// --- review fixes ---
test('removed fillers are cut on whole frames so none of the filler survives (silence mode)',()=>{
 const {clips}=proposeCuts([w('So',.5,1),w('um',1.01,1.4),w('yes',1.42,1.9)],2.2,{silences:[{start:0,end:.4},{start:2,end:2.2}],removeFillers:true});
 for(const c of clips)assert.ok(!(c.end>1.01+1e-9&&c.start<1.4-1e-9),`clip ${c.start}-${c.end} overlaps the filler`);
});
test('removeFillers also cuts short fillers in word-gap mode',()=>{
 const {clips}=proposeCuts([w('So',.2,.5),w('um,',.55,.8),w('here',.85,1.2)],1.5,{removeFillers:true});
 for(const c of clips)assert.ok(!(c.end>.55+1e-9&&c.start<.8-1e-9),`clip ${c.start}-${c.end} overlaps the filler`);
});
test('a silence ending within 50 ms of the end is treated as the tail',()=>{
 const {clips}=proposeCuts([w('a',2.4,3)],5,{silences:[{start:0,end:2.3},{start:3,end:4.97}]});
 assert.equal(clips.length,1);assert.ok(clips[0].end<3.3);
});
test('a recognised word moved out of a pause that gets cut is flagged for a listen',()=>{
 const heard=[w('I',.5,.7),w('okay',2,2.4),w('then',2.9,3.3)];
 const {flags}=proposeCuts([w('I',.5,.7),w('okay',1.5,1.8),w('then',2.9,3.3)],4,{silences:[{start:1.8,end:2.8}],heard});
 assert.ok(flags.some(f=>f.type==='moved'&&/okay/.test(f.text)));
});
test('clipsWithin keeps hand-made cuts and framing when a new proposal is applied',async()=>{
 const {clipsWithin}=await import('../src/cuts.mjs');
 const existing=[{start:0,end:4,zoom:1.2,focusX:40},{start:6,end:10}];
 const proposed=[{start:.5,end:2},{start:3,end:8}];
 assert.deepEqual(clipsWithin(existing,proposed),[{start:.5,end:2,zoom:1.2,focusX:40},{start:3,end:4,zoom:1.2,focusX:40},{start:6,end:8}]);
});

test('every proposal the tool makes passes its own validator once captions are built (500 random recordings)',async()=>{
 const {validateEdit,durationFrames}=await import('../src/edit.mjs');
 const {mapWords,captionsFromWords}=await import('../src/captions.mjs');
 let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let n=0;n<500;n++){
  const words=[];const silences=[];let t=rand()*1.5;
  if(t>0.25)silences.push({start:0,end:t});
  for(let i=0;i<3+Math.floor(rand()*12);i++){
   const len=0.05+rand()*0.5;words.push(w(rand()<.1?'um':'word',t,t+len));t+=len;
   const gap=rand()<.3?0.2+rand()*1.5:rand()*0.1;
   if(gap>0.2)silences.push({start:t+0.02,end:t+gap-0.02});
   t+=gap;
  }
  const duration=t+rand()*0.8;
  if(duration-t>0.25)silences.push({start:t+0.02,end:duration});
  for(const options of [{silences},{silences,removeFillers:true},{},{removeFillers:true}]){
   const {clips}=proposeCuts(words,duration,options);
   const edit={title:'t',source:'p/x.mp4',clips,captionStyle:'word'};
   edit.captions=captionsFromWords(mapWords(words,clips),durationFrames(edit)/30);
   assert.doesNotThrow(()=>validateEdit(edit),`case ${n} ${JSON.stringify(options).slice(0,40)}`);
  }
 }
});
