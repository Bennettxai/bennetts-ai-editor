// Word-level transcripts on the SOURCE clock: [{text,start,end}] in seconds.
// Accepts whisper.cpp full JSON (-ojf), OpenAI Whisper / WhisperX JSON, or this normalized form.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=v=>Math.round(v*1000)/1000;

function fromWhisperCpp(json){
 const words=[];
 for(const segment of json.transcription){
  for(const token of segment.tokens??[]){
   const text=String(token.text??'');
   if(!text.trim()||/^\s*\[_/.test(text))continue;
   const start=token.offsets?.from/1000,end=token.offsets?.to/1000;
   const last=words.at(-1);
   if(/^\s/.test(text)||!last)words.push({text:text.trim(),start,end});
   else{last.text+=text.trim();if(/[\p{L}\p{N}]/u.test(text))last.end=end;} // punctuation tokens carry bogus times
  }
 }
 return words;
}

function fromSegments(json){
 const raw=json.segments.flatMap(s=>s.words??[]).map(x=>({text:String(x.word??x.text??'').trim(),start:x.start,end:x.end})).filter(x=>x.text);
 // Aligners leave some tokens (numbers, symbols) untimed. Borrow times from neighbours.
 raw.forEach((x,i)=>{
  if(!finite(x.start))x.start=raw.slice(0,i).reverse().find(p=>finite(p.end))?.end??0;
  if(!finite(x.end))x.end=raw.slice(i+1).find(n=>finite(n.start))?.start??x.start;
 });
 return raw;
}

export function validateWords(words){
 if(!Array.isArray(words)||!words.length)throw new Error('Transcript has no words.');
 const out=words.map(x=>({text:typeof x?.text==='string'?x.text.trim():'',start:x?.start,end:x?.end}));
 out.forEach((x,i)=>{
  if(!x.text||!finite(x.start)||!finite(x.end)||x.start<0||x.end<x.start)throw new Error(`Transcript word ${i+1} needs text and a start/end in seconds with end ≥ start.`);
  const prev=out[i-1];
  if(prev){
   if(x.start<prev.start)throw new Error(`Transcript word ${i+1} starts before the word in front of it.`);
   if(prev.end>x.start)prev.end=x.start; // aligners overlap neighbours by a few ms
  }
 });
 return out.map(x=>({text:x.text,start:round(x.start),end:round(x.end)}));
}

export function parseTranscript(json){
 if(Array.isArray(json?.transcription))return validateWords(fromWhisperCpp(json));
 if(Array.isArray(json?.segments))return validateWords(fromSegments(json));
 if(Array.isArray(json?.words))return validateWords(json.words);
 throw new Error('Unknown transcript format. Use whisper.cpp JSON (-ojf), OpenAI Whisper/WhisperX JSON with word timestamps, or {"words":[{"text","start","end"}]}.');
}

// whisper.cpp word times drift into pauses. Real silences from the audio are more trustworthy:
// words are kept in order but squeezed onto the stretch of speech they belong to.
export function parseSilences(stderr,duration){
 const out=[];
 for(const m of String(stderr).matchAll(/silence_(start|end): (-?[\d.]+)/g)){
  const t=Math.max(0,Math.round(Number(m[2])*1000)/1000);
  if(m[1]==='start')out.push({start:t,end:duration});else if(out.length)out.at(-1).end=t;
 }
 return out.filter(s=>s.end>s.start);
}
// ffmpeg's silencedetect compares sample PEAKS, which sit ~12 dB above a noise floor's RMS. So silence
// = up to 18 dB over the measured floor, but never closer than 12 dB to the average level (quiet speech
// stays speech) and never below -60 dB.
export function silenceThreshold(meanVolume,noiseFloor=-Infinity){
 return Math.round(Math.min(Math.max(noiseFloor+18,-60),meanVolume-12));
}
// 10th-percentile of short-window RMS levels = the noise floor between words.
export function noiseFloor(levels){
 const sorted=levels.map(v=>Number.isFinite(v)?v:-120).sort((a,b)=>a-b);
 return sorted.length?sorted[Math.floor(sorted.length*0.1)]:-Infinity;
}
export function refineWords(words,silences){
 if(!silences?.length)return words;
 const segments=[];let from=0;
 for(const s of silences){if(s.start>from)segments.push([from,s.start]);from=Math.max(from,s.end);}
 segments.push([from,Infinity]);
 const overlap=(w,[a,b])=>Math.min(w.end,b)-Math.max(w.start,a);
 let floor=0;
 const assigned=words.map((w,i)=>{
  let best=-1,score=0;
  segments.forEach((seg,i)=>{const o=overlap(w,seg);if(o>score){score=o;best=i;}});
  if(best<0){
   // A word wholly inside a silence. Recognisers drift both ways, so use the sentence: after a
   // sentence end it starts the next speech; a sentence-ending word finishes the previous one;
   // otherwise it goes to whichever speech is closer.
   const prev=Math.max(0,segments.findLastIndex(([a])=>a<=w.start)),next=Math.min(prev+1,segments.length-1);
   const ends=t=>/[.!?]["”']?$/.test(t??'');
   if(ends(words[i-1]?.text))best=next;
   else if(ends(w.text))best=prev;
   else best=w.start-segments[prev][1]<=segments[next][0]-w.end?prev:next;
  }
  floor=Math.max(floor,best);return floor;
 });
 const out=words.map(w=>({...w}));
 segments.forEach(([a,b],i)=>{
  const idx=assigned.map((s,j)=>s===i?j:-1).filter(j=>j>=0);
  if(!idx.length)return;
  const lo=Math.min(...idx.map(j=>words[j].start)),hi=Math.max(...idx.map(j=>words[j].end));
  const A=Math.max(a,Math.min(lo,b)),B=Math.max(A,Math.min(b,Math.max(hi,a)));
  if(A===lo&&B===hi)return;
  const map=t=>hi>lo?A+(t-lo)*(B-A)/(hi-lo):A;
  for(const j of idx){out[j].start=round(map(words[j].start));out[j].end=round(map(words[j].end));}
 });
 return validateWords(out);
}
