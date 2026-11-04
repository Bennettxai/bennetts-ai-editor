// Browser-safe layout math shared by the renderer and tests. 1080×1920 at 30 fps.
export const W=1080,H=1920,FPS=30;
// Instagram Reels safe area: the 4:5 feed crop and the app's own buttons hide everything outside it.
export const SAFE={top:290,bottom:1630,left:60,right:950};
export const DEFAULT_VISUAL_HEIGHT=768; // 40 % visuals on top, 60 % footage below
const ENTER=10,EXIT=8,BRIDGE=15; // frames. Arrive slow, leave fast; gaps under 0.5 s stay split.
const easeOut=t=>1-Math.pow(1-t,3);
const easeIn=t=>t*t*t;
const clamp=t=>Math.max(0,Math.min(1,t));
export function splitRanges(visuals=[],fps=FPS){
 const ranges=[];
 for(const v of visuals){
  const a=Math.round(v.start*fps),b=Math.round(v.end*fps),prev=ranges.at(-1);
  if(prev&&a-prev[1]<BRIDGE)prev[1]=b;else ranges.push([a,b]);
 }
 return ranges;
}
// 0 = footage full screen, 1 = footage in the bottom zone with a scene on top.
export function splitProgress(frame,visuals=[],fps=FPS,totalFrames=Infinity){
 for(const [a,b] of splitRanges(visuals,fps)){
  if(frame<a||frame>=b)continue;
  const exit=b>=totalFrames?0:Math.min(EXIT,Math.floor((b-a)/3)),enter=Math.min(ENTER,Math.floor((b-a)/3));
  if(exit&&frame>=b-exit)return 1-easeIn(clamp((frame-(b-exit)+1)/exit));
  return easeOut(clamp((frame-a+1)/enter));
 }
 return 0;
}
export function footageRect(progress,visualHeight=DEFAULT_VISUAL_HEIGHT){
 const top=Math.round(visualHeight*progress);
 return {top,height:H-top};
}
// Where scenes may draw: the visual zone clipped to the safe area, with a little air above the seam.
export function stageRect(visualHeight=DEFAULT_VISUAL_HEIGHT){
 return {left:SAFE.left,top:SAFE.top,width:SAFE.right-SAFE.left,height:visualHeight-SAFE.top-36};
}
// Caption centre line: lower-middle of the frame when full screen, on the seam when split.
export const FULL_CAPTION_Y=1100;
export function captionTop(progress,visualHeight=DEFAULT_VISUAL_HEIGHT,fullY=FULL_CAPTION_Y){
 return Math.round(fullY+(visualHeight-fullY)*progress);
}
