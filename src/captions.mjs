// SRT times refer to source footage. Imported caption times refer to the edit.
const FPS=30;
const frame=seconds=>Math.round(seconds*FPS);
function timestamp(value,cue){
 const match=/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(value);
 if(!match)throw new Error(`SRT cue ${cue}: use HH:MM:SS,mmm timestamps.`);
 const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3])+Number(match[4])/1000;
 if(!Number.isFinite(seconds))throw new Error(`SRT cue ${cue}: timestamp is too large.`);
 return seconds;
}
export function parseSrt(input){
 if(typeof input!=='string'||!input.trim())throw new Error('SRT file contains no caption cues.');
 const blocks=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n[\t ]*\n+/);
 let previousEnd=0;
 return blocks.map((block,index)=>{
  const lines=block.split('\n');
  if(!/^\d+$/.test(lines[0].trim()))throw new Error(`SRT cue ${index+1}: expected a numeric cue index.`);
  const timing=lines[1]?.trim().split(/\s+-->\s+/);
  if(!timing||timing.length!==2)throw new Error(`SRT cue ${index+1}: expected start --> end timestamps.`);
  const start=timestamp(timing[0],index+1),end=timestamp(timing[1],index+1);
  if(end<=start||start<previousEnd)throw new Error(`SRT cue ${index+1}: timestamps must be chronological, nonoverlapping and have positive duration.`);
  previousEnd=end;
  const text=lines.slice(2).join(' ').replace(/\s+/g,' ').trim();
  if(!text||text.length>100)throw new Error(`SRT caption ${index+1}: text must contain 1–100 characters; shorten this phrase before importing.`);
  return {start,end,text};
 });
}
export function mapCaptions(cues,clips){
 const result=[];let outputOffset=0;
 for(const clip of clips){
  const clipStart=frame(clip.start),clipEnd=frame(clip.end);
  for(const cue of cues){
   const start=Math.max(frame(cue.start),clipStart),end=Math.min(frame(cue.end),clipEnd);
   if(end>start)result.push({start:(outputOffset+start-clipStart)/FPS,end:(outputOffset+end-clipStart)/FPS,text:cue.text});
  }
  outputOffset+=clipEnd-clipStart;
 }
 return result;
}

// --- Word captions from a word-level transcript ---
// Keep a word when its onset survives the cut; clamp its end to the clip.
export function mapWords(words,clips){
 const out=[];let offset=0;
 for(const clip of clips){
  const a=frame(clip.start),b=frame(clip.end);
  for(const w of words){
   const s=frame(w.start);
   if(s>=a&&s<b)out.push({text:w.text,start:(offset+s-a)/FPS,end:(offset+Math.min(Math.max(frame(w.end),s+1),b)-a)/FPS});
  }
  offset+=b-a;
 }
 return out;
}
const display=text=>text.toUpperCase().replace(/[^\p{L}\p{N}'’\- ]/gu,'').replace(/^['’\-]+|['’\-]+$/g,'').trim();
// One word at a time (group 1) by default: it pops on at its onset, runs into the next word during
// speech, stays up at least minDwell, and the screen goes blank in pauses longer than maxPause.
export function captionsFromWords(words,totalSeconds,{group=1,minDwell=0.18,maxPause=0.18}={}){
 const pages=[];let page=[];
 words.forEach((w,i)=>{
  if(!display(w.text))return;
  page.push(w);
  const next=words[i+1];
  if(page.length>=group||/[.!?]["”']?$/.test(w.text)||!next||next.start-w.end>maxPause){pages.push(page);page=[];}
 });
 if(page.length)pages.push(page);
 const caps=[];
 pages.forEach((p,i)=>{
  const next=pages[i+1]?.[0];
  const start=p[0].start,spoken=p.at(-1).end;
  let end=next&&next.start-spoken<=maxPause?next.start:spoken;
  end=Math.min(Math.max(end,start+minDwell),next?next.start:totalSeconds,totalSeconds);
  caps.push({start,end,text:p.map(x=>display(x.text)).join(' ')});
 });
 // Keep every caption at least one frame long and never overlapping its neighbour.
 const out=[];
 for(const c of caps){
  const prev=out.at(-1);
  const start=prev?Math.max(c.start,prev.end):c.start;
  if(frame(c.end)<=frame(start)){
   if(prev){prev.text=`${prev.text} ${c.text}`.slice(0,100);prev.end=Math.max(prev.end,c.end);continue;}
   out.push({start,end:Math.min(totalSeconds,start+1/FPS),text:c.text});continue;
  }
  out.push({start,end:c.end,text:c.text});
 }
 return out;
}
