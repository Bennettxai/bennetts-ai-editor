// Browser-safe timing contract. JSON stores exact rates; Remotion receives their numeric value.
export const LEGACY_FPS=30;
export function parseFps(value){
 const match=['string','number'].includes(typeof value)?/^(\d+)(?:\/(\d+))?$/.exec(String(value)):null;
 if(!match)throw new Error('fps must be an integer or exact rational such as 30 or 30000/1001 (not a rounded decimal).');
 const numerator=Number(match[1]),denominator=Number(match[2]??1);
 const fps=numerator/denominator;
 if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||denominator<=0||!Number.isFinite(fps)||fps<1||fps>120)throw new Error('Unsupported frame rate: fps must be between 1 and 120 with positive safe-integer numerator and denominator.');
 let a=numerator,b=denominator;while(b){[a,b]=[b,a%b];}
 return {fps,fpsRatio:`${numerator/a}/${denominator/a}`};
}
export function getFormat(edit={}){
 const value=edit.format;
 if(value===undefined)return {fps:30,fpsRatio:'30/1',width:1080,height:1920,scale:1};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('format must specify fps and resolution.');
 const {fps,fpsRatio}=parseFps(value.fps);
 if(!['4k','1080p'].includes(value.resolution))throw new Error('format.resolution must be 4k or 1080p.');
 const scale=value.resolution==='4k'?2:1;
 return {fps,fpsRatio,width:1080*scale,height:1920*scale,scale};
}
// All timeline edges use nearest frame; cut proposals separately round outward to preserve speech.
export const frameAt=(seconds,fps=LEGACY_FPS)=>Math.round(seconds*fps);
export const clipFrames=(clip,fps=LEGACY_FPS)=>frameAt(clip.end,fps)-frameAt(clip.start,fps);
export const timelineFrames=(edit,fps=getFormat(edit).fps)=>edit.clips.reduce((sum,clip)=>sum+clipFrames(clip,fps),0);
// Animation durations formerly authored in 30fps frames retain their duration at every project rate.
export const motionFrames=(frames,fps=LEGACY_FPS)=>frames*fps/LEGACY_FPS;
export const relativeFrame=(visual,seconds,fps=LEGACY_FPS)=>frameAt(seconds,fps)-frameAt(visual.start,fps);
export const revealFrame=(visual,index,stagger=6,lead=2,fps=LEGACY_FPS)=>visual.at?.[index]!==undefined?relativeFrame(visual,visual.at[index],fps):motionFrames(lead+index*stagger,fps);
