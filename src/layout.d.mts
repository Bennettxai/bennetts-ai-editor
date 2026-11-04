type Timed={start:number;end:number};
export const W:number,H:number,FPS:number,DEFAULT_VISUAL_HEIGHT:number,FULL_CAPTION_Y:number;
export const SAFE:{top:number;bottom:number;left:number;right:number};
export function splitRanges(visuals?:Timed[],fps?:number):Array<[number,number]>;
export function splitProgress(frame:number,visuals?:Timed[],fps?:number,totalFrames?:number):number;
export function footageRect(progress:number,visualHeight?:number):{top:number;height:number};
export function stageRect(visualHeight?:number):{left:number;top:number;width:number;height:number};
export function captionTop(progress:number,visualHeight?:number,fullY?:number):number;
