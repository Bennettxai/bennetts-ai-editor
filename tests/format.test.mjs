import test from 'node:test';
import assert from 'node:assert/strict';
import {durationFrames,validateEdit} from '../src/edit.mjs';
import {mapCaptions,mapWords,captionsFromWords} from '../src/captions.mjs';
import {proposeCuts,clipsWithin} from '../src/cuts.mjs';
import {splitProgress,splitRanges} from '../src/layout.mjs';
import {musicLevel} from '../src/presentation.mjs';
import {evaluate} from '../scripts/review.mjs';
const format=await import('../src/format.mjs').catch(()=>null);
const edit=(fps='60/1')=>({title:'Timing',source:'input.mp4',format:{fps,resolution:'4k'},clips:[{start:0,end:1}],captions:[],cards:[]});

test('format preserves legacy exports and reduces exact rational rates',()=>{
 assert.ok(format,'shared format module must exist');
 assert.deepEqual(format.getFormat({}),{fps:30,fpsRatio:'30/1',width:1080,height:1920,scale:1});
 assert.deepEqual(format.getFormat(edit('60000/2002')),{fps:30000/1001,fpsRatio:'30000/1001',width:2160,height:3840,scale:2});
 assert.equal(format.getFormat({...edit('24'),format:{fps:'24',resolution:'1080p'}}).fpsRatio,'24/1');
});

test('format rejects malformed, approximate decimal, unsupported rates and resolutions',()=>{
 for(const fps of ['0','-30','0/1','30/0','NaN','Infinity','29.97','1/1000','121','60000/0','3/2/1','9007199254740992/1',{},[30],null]){
  assert.throws(()=>validateEdit(edit(fps)),/fps|frame rate/i,JSON.stringify(fps));
 }
 for(const value of [null,[],{}, {fps:'30',resolution:'8k'}])assert.throws(()=>validateEdit({...edit(),format:value}),/format|resolution|fps/i);
});

test('durations and one-frame validation use selected frame boundaries at 24, 60 and NTSC rates',()=>{
 for(const [fps,end,want] of [['24',.1,2],['60',.1,6],['30000/1001',1.001,30]]){
  assert.equal(durationFrames({...edit(fps),clips:[{start:0,end}]}),want);
 }
 assert.doesNotThrow(()=>validateEdit({...edit(),clips:[{start:0,end:1/60}]}));
 assert.throws(()=>validateEdit({...edit('24'),clips:[{start:.021,end:.022}]}),/frame/);
 assert.equal(durationFrames({clips:[{start:0,end:.1}]}),3,'legacy callers stay 30fps');
});

test('caption and word boundaries retain frames that exist at 60fps',()=>{
 const clips=[{start:1/60,end:3/60}];
 assert.deepEqual(mapCaptions([{start:1/60,end:2/60,text:'one'}],clips,60),[{start:0,end:1/60,text:'one'}]);
 assert.deepEqual(mapWords([{start:1/60,end:2/60,text:'one'}],clips,60),[{start:0,end:1/60,text:'one'}]);
 assert.deepEqual(captionsFromWords([{text:'one',start:0,end:1/60},{text:'two',start:1/60,end:2/60}],2/60,{minDwell:0,fps:60}),[{text:'ONE',start:0,end:1/60},{text:'TWO',start:1/60,end:2/60}]);
 const fps=30000/1001;
 assert.deepEqual(mapWords([{text:'ntsc',start:1.001,end:1.1011}],[{start:1.001,end:1.2012}],fps),[{text:'ntsc',start:0,end:3/fps}]);
});

test('cut proposals snap outward on the selected clock and retain single-frame intersections',()=>{
 assert.deepEqual(proposeCuts([{text:'go',start:.025,end:.06}],1,{padBefore:0,padAfter:0},60).clips,[{start:1/60,end:4/60}]);
 assert.deepEqual(clipsWithin([{start:0,end:2/60,zoom:1.1}],[{start:1/60,end:2/60}],60),[{start:1/60,end:2/60,zoom:1.1}]);
 const [clip]=proposeCuts([{text:'go',start:1.001,end:1.1011}],2,{padBefore:0,padAfter:0},30000/1001).clips;
 assert.ok(Math.abs(clip.start-1.001)<1e-12);assert.equal(clip.end,1.1011);
});

test('scene layout and music envelopes keep their durations when fps doubles',()=>{
 assert.deepEqual(splitRanges([{start:1,end:2},{start:2.3,end:3}],60),[[60,180]]);
 assert.ok(Math.abs(splitProgress(9,[{start:0,end:2}],60)-.875)<1e-12);
 assert.equal(musicLevel(15,180,.1,60),.05);
});

test('review uses selected output dimensions and exact equivalent rational rates',()=>{
 const analysis={lufs:-14,truePeak:-1,channels:[-20,-20],freezes:[],blacks:[]};
 const probe={width:2160,height:3840,fps:'60000/2002',frames:30,audio:true};
 const opts={analysis,expectedFrames:30,format:{fps:30000/1001,fpsRatio:'30000/1001',width:2160,height:3840,scale:2}};
 assert.deepEqual(evaluate({...opts,probe}).filter(c=>!c.pass),[]);
 assert.deepEqual(evaluate({...opts,probe:{...probe,width:540,height:960},draft:true}).filter(c=>!c.pass),[]);
 assert.equal(evaluate({...opts,probe:{...probe,fps:'2997/100'}}).find(c=>c.name==='fps').pass,false,'29.97 is not exact NTSC');
 assert.equal(evaluate({...opts,probe:{...probe,frames:29}}).find(c=>c.name==='frames').pass,false);
});

test('visual reveal frames share the quantized timeline and scale default animation staggers',()=>{
 assert.equal(typeof format?.relativeFrame,'function');
 assert.equal(format.relativeFrame({start:1.001},1.5015,30000/1001),15);
 assert.equal(format.relativeFrame({start:1},1.25,60),15);
 assert.equal(format.revealFrame({start:1,at:[1.25]},0,6,2,60),15);
 assert.equal(format.revealFrame({start:1},2,6,2,60),28);
});
