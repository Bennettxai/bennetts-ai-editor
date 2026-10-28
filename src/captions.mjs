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
