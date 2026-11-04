import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnalysis, evaluate} from '../scripts/review.mjs';

const stderr=`[Parsed_freezedetect_2 @ 0xa] lavfi.freezedetect.freeze_start: 0
[Parsed_freezedetect_2 @ 0xa] lavfi.freezedetect.freeze_duration: 1.5
[Parsed_freezedetect_2 @ 0xa] lavfi.freezedetect.freeze_end: 1.5
[Parsed_freezedetect_2 @ 0xa] lavfi.freezedetect.freeze_start: 9.2
[Parsed_blackdetect_3 @ 0xa] black_start:0 black_end:1.5 black_duration:1.5
[Parsed_ebur128_0 @ 0xa] t: 1.2 TARGET:-23 LUFS    M: -20.1 S:-120.7     I: -19.0 LUFS
[Parsed_ebur128_0 @ 0xa] Summary:
    I:         -21.9 LUFS
    Threshold: -31.9 LUFS
  True peak:
    Peak:      -12.8 dBFS
[Parsed_astats_1 @ 0xa] Channel: 1
[Parsed_astats_1 @ 0xa] RMS level dB: -21.095053
[Parsed_astats_1 @ 0xa] Channel: 2
[Parsed_astats_1 @ 0xa] RMS level dB: -inf`;

test('parses loudness summary, true peak, per-channel level, freezes (open-ended too) and black frames',()=>{
 const a=parseAnalysis(stderr,10);
 assert.equal(a.lufs,-21.9);assert.equal(a.truePeak,-12.8);
 assert.deepEqual(a.channels,[-21.095053,-Infinity]);
 assert.deepEqual(a.freezes,[{start:0,end:1.5},{start:9.2,end:10}]);
 assert.deepEqual(a.blacks,[{start:0,end:1.5}]);
});

test('evaluate turns measurements into pass/fail checks against the quality bar',()=>{
 const probe={width:1080,height:1920,fps:'30/1',frames:300,audio:true};
 const checks=evaluate({probe,analysis:parseAnalysis(stderr,10),expectedFrames:300,draft:false});
 const byName=Object.fromEntries(checks.map(c=>[c.name,c]));
 assert.equal(byName.size.pass,true);assert.equal(byName.frames.pass,true);
 assert.equal(byName.loudness.pass,false);
 assert.equal(byName.stereo.pass,false,'one silent channel plays in one ear only');
 assert.equal(byName['first frame'].pass,false,'video opens on black');
 assert.equal(byName.stills.pass,false,'2.3 s frozen in 10 s is over 1 s per 30 s');
 const good=evaluate({probe,analysis:{lufs:-14.2,truePeak:-1.4,channels:[-20,-20.5],freezes:[],blacks:[]},expectedFrames:300,draft:false});
 assert.deepEqual(good.filter(c=>!c.pass),[]);
});

test('drafts are checked at half size and skip the loudness target',()=>{
 const checks=evaluate({probe:{width:540,height:960,fps:'30/1',frames:300,audio:true},analysis:{lufs:-30,truePeak:-10,channels:[-20,-20],freezes:[],blacks:[]},expectedFrames:300,draft:true});
 assert.deepEqual(checks.filter(c=>!c.pass),[]);
});
