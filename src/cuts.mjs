// Rough-cut proposal from word timings (SOURCE clock). This only suggests cuts:
// a person or assistant still judges takes, restarts and how each join sounds.
import {validateWords} from './transcript.mjs';
const FPS=30;
const EDGE=0.05; // a silence this close to either end of the recording counts as lead-in / tail
const FILLERS=new Set(['um','uh','erm','uhm','ah','hmm','mm']);
const bare=text=>text.toLowerCase().replace(/[^a-z0-9']/g,'');
const isFiller=w=>FILLERS.has(bare(w.text));
export const CUT_DEFAULTS={padBefore:0.1,padAfter:0.15,maxPause:0.35,removeFillers:false};

export function proposeCuts(input,sourceDuration,options={}){
 const o={...CUT_DEFAULTS,...options};
 const all=validateWords(input);
 const flags=reviewFlags(all,o);
 const {ranges,decisions}=o.silences?fromSilences(all,sourceDuration,o,flags):fromWordGaps(all.filter(w=>!(o.removeFillers&&isFiller(w))),o);
 // Removed fillers are cut on whole frames, rounded outward, so no part of them survives.
 const fillerCuts=o.removeFillers?all.filter(isFiller).map(w=>[Math.floor(w.start*FPS+1e-6)/FPS,Math.ceil(w.end*FPS-1e-6)/FPS]):[];
 return finish(subtract(ranges,fillerCuts),sourceDuration,o,decisions,flags);
}

function reviewFlags(all,o){
 const flags=[];
 all.forEach((word,i)=>{
  if(isFiller(word))flags.push({type:'filler',at:word.start,text:word.text,note:o.removeFillers?'removed':'kept; cut it if it sounds like a stumble'});
  const prev=all[i-1];
  if(prev&&bare(prev.text)&&bare(prev.text)===bare(word.text)&&!isFiller(word))flags.push({type:'repeat',at:prev.start,text:`${prev.text} ${word.text}`,note:'possible restart; keep only if deliberate'});
 });
 return flags;
}

// Fallback when only word times are known: tighten gaps between words.
function fromWordGaps(words,o){
 if(!words.length)throw new Error('Transcript has no words left to keep.');
 const decisions=[];
 const ranges=[[words[0].start-o.padBefore,words[0].end+o.padAfter]];
 for(let i=1;i<words.length;i++){
  const prev=words[i-1],word=words[i],gap=word.start-prev.end;
  const at=Math.round(prev.end*1000)/1000;
  if(gap>o.maxPause){
   decisions.push({at,gap:+gap.toFixed(3),action:'CUT',reason:`${gap.toFixed(2)} s pause tightened to ${(o.padAfter+o.padBefore).toFixed(2)} s`});
   ranges.push([word.start-o.padBefore,word.end+o.padAfter]);
  }else{
   if(gap>0.05)decisions.push({at,gap:+gap.toFixed(3),action:'KEEP',reason:`${gap.toFixed(2)} s pause is within the ${o.maxPause} s limit`});
   ranges.at(-1)[1]=word.end+o.padAfter;
  }
 }
 return {ranges,decisions};
}

// Preferred: cut only where the audio is actually silent, so no sound is removed by accident.
function fromSilences(all,sourceDuration,o,flags){
 const decisions=[];const cuts=[];
 for(const s of o.silences){
  const lead=s.start<=EDGE,tail=s.end>=sourceDuration-EDGE,len=s.end-s.start;
  const a=lead?0:s.start+o.padAfter,b=tail?sourceDuration:s.end-o.padBefore;
  const at=Math.round(s.start*1000)/1000;
  if(!lead&&!tail&&len<=o.maxPause){if(len>0.05)decisions.push({at,gap:+len.toFixed(3),action:'KEEP',reason:`${len.toFixed(2)} s pause is within the ${o.maxPause} s limit`});continue;}
  if(b<=a)continue;
  if(all.some(w=>w.start>=a&&w.start<b)){decisions.push({at,gap:+len.toFixed(3),action:'KEEP',reason:'a transcript word starts inside this silence; check the recording'});continue;}
  decisions.push({at,gap:+len.toFixed(3),action:'CUT',reason:lead?'lead-in silence trimmed':tail?'trailing silence trimmed':`${len.toFixed(2)} s pause tightened to ${(o.padAfter+o.padBefore).toFixed(2)} s`});
  // The recogniser placed a word here but the audio says silence: its time was corrected. Listen.
  for(const w of o.heard??[])if(w.start>=a&&w.start<b)flags.push({type:'moved',at:w.start,text:w.text,note:'heard inside this pause and moved onto the speech next to it; listen that no quiet word is being cut'});
  cuts.push([a,b]);
 }
 // Sound the recogniser found no words in: kept, but worth a listen (a missed word or a noise).
 let from=0;
 for(const s of [...o.silences,{start:sourceDuration,end:sourceDuration}]){
  if(s.start-from>=0.15&&!all.some(w=>w.end>from&&w.start<s.start))flags.push({type:'unworded',at:from,text:`${(s.start-from).toFixed(2)} s of sound`,note:'no transcript words here: a missed word, a breath or a noise. Kept.'});
  from=Math.max(from,s.end);
 }
 return {ranges:subtract([[0,sourceDuration]],cuts),decisions};
}

/** ranges minus cuts (both lists of [start,end] seconds). */
function subtract(ranges,cuts){
 let out=ranges.map(r=>[...r]);
 for(const [a,b] of cuts){
  out=out.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[...(a>s?[[s,a]]:[]),...(b<e?[[b,e]]:[])]);
 }
 return out;
}

function finish(ranges,sourceDuration,o,decisions,flags){
 // Snap outward to whole frames and clamp to the source, then merge ranges that touch.
 const last=Math.floor(sourceDuration*FPS+1e-6);
 const clips=[];
 for(const [a,b] of ranges.sort((x,y)=>x[0]-y[0])){
  const start=Math.max(0,Math.floor(a*FPS+1e-6)),end=Math.min(last,Math.ceil(b*FPS-1e-6));
  if(end<=start)continue;
  const prev=clips.at(-1);
  if(prev&&start<=prev[1])prev[1]=Math.max(prev[1],end);else clips.push([start,end]);
 }
 const kept=clips.reduce((sum,[a,b])=>sum+b-a,0);
 flags.sort((x,y)=>x.at-y.at);
 const {silences,heard,...options}=o;
 return {clips:clips.map(([a,b])=>({start:a/FPS,end:b/FPS})),decisions,flags,removedSeconds:sourceDuration-kept/FPS,options};
}

/** Apply a new proposal inside the clips you already have: hand-removed takes stay removed,
 *  and each piece keeps the zoom/focus of the clip it came from. */
export function clipsWithin(existing,proposed){
 const out=[];
 for(const clip of existing){
  const {start,end,...framing}=clip;
  for(const p of proposed){
   const a=Math.max(start,p.start),b=Math.min(end,p.end);
   if(Math.round(b*FPS)>Math.round(a*FPS))out.push({start:a,end:b,...framing});
  }
 }
 return out;
}
