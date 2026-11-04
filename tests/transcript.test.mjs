import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTranscript, validateWords} from '../src/transcript.mjs';

const w=(text,start,end)=>({text,start,end});

test('whisper.cpp full JSON joins sub-word tokens and punctuation into timed words',()=>{
 const json={transcription:[{tokens:[
  {text:'[_BEG_]',offsets:{from:0,to:0}},
  {text:' Most',offsets:{from:10,to:210}},
  {text:' found',offsets:{from:260,to:500}},
  {text:'ers',offsets:{from:500,to:740}},
  {text:' day',offsets:{from:1780,to:1920}},
  {text:'.',offsets:{from:2250,to:2280}},
  {text:'[_TT_114]',offsets:{from:2280,to:2280}}
 ]},{tokens:[{text:' Next',offsets:{from:3000,to:3300}}]}]};
 assert.deepEqual(parseTranscript(json),[w('Most',.01,.21),w('founders',.26,.74),w('day.',1.78,1.92),w('Next',3,3.3)]);
});

test('OpenAI Whisper / WhisperX segment words are trimmed and missing times are filled from neighbours',()=>{
 const json={segments:[{words:[{word:' Hello',start:.5,end:.9},{word:' 2026',start:undefined,end:undefined},{word:' world',start:1.4,end:1.8}]}]};
 assert.deepEqual(parseTranscript(json),[w('Hello',.5,.9),w('2026',.9,1.4),w('world',1.4,1.8)]);
});

test('normalized transcripts round-trip',()=>{
 const words=[w('One',0,.4),w('two',.5,.8)];
 assert.deepEqual(parseTranscript({words}),words);
});

test('rejects unknown formats, empty transcripts and words that run backwards',()=>{
 assert.throws(()=>parseTranscript({}),/format/i);
 assert.throws(()=>parseTranscript({words:[]}),/no words/i);
 assert.throws(()=>validateWords([w('a',1,.5)]),/word 1/i);
 assert.throws(()=>validateWords([w('a',1,1.5),w('b',.5,.8)]),/word 2/i);
 assert.throws(()=>validateWords([w('',0,1)]),/word 1/i);
});

test('small overlaps from aligners are clamped instead of rejected',()=>{
 assert.deepEqual(validateWords([w('a',0,1.02),w('b',1,1.5)]),[w('a',0,1),w('b',1,1.5)]);
});

// --- Audio-silence refinement (whisper.cpp word times drift into pauses) ---
import {refineWords, parseSilences, silenceThreshold} from '../src/transcript.mjs';
test('punctuation tokens do not stretch the word in front of them across a pause',()=>{
 const json={transcription:[{tokens:[{text:' work',offsets:{from:2330,to:2460}},{text:'.',offsets:{from:4080,to:4080}}]}]};
 assert.deepEqual(parseTranscript(json),[w('work.',2.33,2.46)]);
});
test('refineWords pulls words that drifted into a silence back onto the speech before it',()=>{
 const words=[w('work.',2.33,2.46),w("Here's",4.09,4.99),w('the',4.99,5.45),w('fix.',5.45,5.92),w('Write',5.93,6.36)];
 const silences=[{start:2.59,end:4.133},{start:4.92,end:5.94}];
 const out=refineWords(words,silences);
 assert.deepEqual(out[0],w('work.',2.33,2.46),'words already inside speech are untouched');
 for(const x of out.slice(1,4)){assert.ok(x.start>=4.133-1e-9&&x.end<=4.92+1e-9,`${x.text} ${x.start}-${x.end}`);}
 assert.ok(out[1].start<out[2].start&&out[2].start<out[3].start,'order and proportions are kept');
 assert.equal(out[4].start,5.94,'a word starting just before speech resumes snaps to the speech');
});
test('parseSilences reads ffmpeg silencedetect output, closing an open silence at the end',()=>{
 const stderr='[silencedetect @ 0x1] silence_start: 2.591312\n[silencedetect @ 0x1] silence_end: 4.133063 | silence_duration: 1.54\n[silencedetect @ 0x1] silence_start: 12.2';
 assert.deepEqual(parseSilences(stderr,13),[{start:2.591,end:4.133},{start:12.2,end:13}]);
});
test('silence threshold follows the recording level within sane bounds',()=>{
 assert.equal(silenceThreshold(-21.4,-80),-60);assert.equal(silenceThreshold(-21.4,-50),-33);
});

// --- review fixes ---
test('refineWords never writes a word that ends before it starts, and a stray word far from the previous speech joins the next',()=>{
 const out=refineWords([w('Hi',3.5,3.8),w('there',4.2,4.6)],[{start:0,end:2},{start:2.3,end:4}]);
 assert.deepEqual(validateWords(out),out);
 assert.ok(out[0].start>=4,'Hi is 1.2 s after the breath at 2.0–2.3 but 0.2 s before speech resumes at 4.0');
});
test('silence threshold sits clear of noise peaks (floor + 18 dB) and well below speech',()=>{
 assert.equal(silenceThreshold(-22,-60.5),-42,'room noise measured on the noisy test recording');
 assert.equal(silenceThreshold(-22,-Infinity),-60,'digital silence');
 assert.equal(silenceThreshold(-30,-38),-42,'noisy room: never closer than 12 dB to the average level');
});
test('a word stranded in a pause after a sentence end joins the next sentence (recogniser ran early)',()=>{
 const words=[w('work.',2.2,2.5),w("Here's",2.87,3.1),w('the',4.2,4.4),w('fix.',4.4,4.8)];
 const out=refineWords(words,[{start:2.6,end:4.12}]);
 assert.ok(out[1].start>=4.12,`Here's should move after the pause, got ${out[1].start}`);
 const late=refineWords([w('Here',4.09,4.5),w('the',4.99,5.45),w('fix.',5.45,5.92),w('Write',5.93,6.3)],[{start:4.92,end:5.94}]);
 assert.ok(late[1].end<=4.92&&late[2].end<=4.92,'a sentence that ran late into the pause stays with its start');
});
