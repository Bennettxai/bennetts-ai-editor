import React from 'react';
import {Easing,interpolate,useCurrentFrame} from 'remotion';

// Bennett Legacy tokens. Change these (and branding/README.md) to restyle every scene at once.
export const tokens={background:'#0a0a0a',surface:'#141414',paper:'#f2f2f2',secondary:'#9c9c9c',muted:'#5c5c5c',line:'#242424',dim:'#3a3a3a'};
export const fonts={sans:'Inter, "Helvetica Neue", Arial, sans-serif',mono:'"SF Mono", Menlo, Consolas, monospace',serif:'Georgia, "Times New Roman", serif'};
export const FPS=30;

export type Visual={scene:string;start:number;end:number;at?:number[];kicker?:string;[key:string]:any};
export type Stage={width:number;height:number};
export type SceneProps={visual:Visual;stage:Stage;durationInFrames:number;holdToEnd?:boolean};

// Arrive slow (ease out), leave fast (ease in). Never linear.
export const arrive=Easing.bezier(0.16,1,0.3,1);
export const leave=Easing.bezier(0.7,0,0.84,0);
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

/** Output-clock seconds → frame relative to the visual's first frame. */
export const relFrame=(visual:Visual,seconds:number)=>Math.round(seconds*FPS)-Math.round(visual.start*FPS);
/** Reveal frame for item i: its `at` time if given, otherwise a short stagger from the start. */
export const revealAt=(visual:Visual,i:number,stagger=6,lead=2)=>visual.at?.[i]!==undefined?relFrame(visual,visual.at[i]):lead+i*stagger;

/** 0→1 entrance that starts at `from` (relative frame) and lasts `frames`. */
export function useEnter(from=0,frames=12){
 const frame=useCurrentFrame();
 return interpolate(frame,[from,from+frames],[0,1],{...clamp,easing:arrive});
}
/** 1→0 over the last `frames` of the scene. */
export function useExit(durationInFrames:number,frames=7){
 const frame=useCurrentFrame();
 return interpolate(frame,[durationInFrames-frames,durationInFrames],[1,0],{...clamp,easing:leave});
}

/** Wraps every scene: kicker label, quick exit, and a slow drift so holds never freeze. */
export const SceneFrame:React.FC<{visual:Visual;stage:Stage;durationInFrames:number;holdToEnd?:boolean;children:React.ReactNode;align?:'center'|'start'}>=({visual,stage,durationInFrames,holdToEnd,children,align='center'})=>{
 const frame=useCurrentFrame();
 const exit=useExit(durationInFrames);
 const out=holdToEnd?1:exit; // the video's last frame is a finished picture too
 const kicker=useEnter(0,10);
 const drift=interpolate(frame,[0,durationInFrames],[0,-8],clamp); // a slow rise, so holds never freeze and nothing grows past the safe zone
 return <div style={{position:'absolute',inset:0,width:stage.width,height:stage.height,opacity:out,transform:`translateY(${(1-out)*-18+drift}px)`,display:'flex',flexDirection:'column',justifyContent:align==='center'?'center':'flex-start'}}>
  {visual.kicker&&<div style={{fontFamily:fonts.mono,fontSize:22,letterSpacing:4,textTransform:'uppercase',color:tokens.secondary,marginBottom:26,opacity:kicker,transform:`translateY(${(1-kicker)*10}px)`}}>{visual.kicker}</div>}
  {children}
 </div>;
};

/** Font size that keeps a line of `chars` characters inside `width` (rough average glyph width). */
export const fitSize=(chars:number,width:number,max:number,ratio=0.56)=>Math.min(max,Math.floor(width/(Math.max(chars,1)*ratio)));
