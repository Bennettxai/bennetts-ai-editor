// Browser-safe presentation helpers, shared by rendering and tests.
export function clipPresentation(clip) {
 const focus=`${clip.focusX??50}% ${clip.focusY??0}%`;
 return {objectFit:'cover',objectPosition:focus,transform:`scale(${clip.zoom??1})`,transformOrigin:focus};
}
export function musicLevel(frame,totalFrames,volume=0.08) {
 const ramp=Math.min(15,Math.max(1,(totalFrames-1)/2));
 return volume*Math.max(0,Math.min(1,frame/ramp,(totalFrames-1-frame)/ramp));
}
