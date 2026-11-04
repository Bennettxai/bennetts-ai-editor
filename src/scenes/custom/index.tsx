import React from 'react';
import {interpolate,useCurrentFrame} from 'remotion';
import {SceneFrame,SceneProps,fonts,tokens,useEnter} from '../kit';

// Your own scenes. Write a component that takes SceneProps, register it below, then use it from
// edit.json as {"scene":"custom","component":"<Name>","props":{...},"start":…,"end":…}.
// Rules: every value comes from useCurrentFrame() (no timers, CSS transitions or Math.random),
// stay inside `stage`, and use `tokens` so the scene matches the rest of the video.

/** Example: a progress track that fills to `props.percent` with a label. */
export const ProgressExample:React.FC<SceneProps>=(p)=>{
 const frame=useCurrentFrame();
 const percent=Number(p.visual.props?.percent??50);
 const t=interpolate(frame,[4,28],[0,percent/100],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const label=useEnter(10,12);
 return <SceneFrame {...p}>
  <div style={{height:28,background:tokens.surface,borderRadius:14,overflow:'hidden',border:`1px solid ${tokens.line}`}}>
   <div style={{height:'100%',width:`${t*100}%`,background:tokens.paper}}/>
  </div>
  <div style={{display:'flex',justifyContent:'space-between',marginTop:24,fontFamily:fonts.mono,fontSize:28,color:tokens.secondary,opacity:label}}>
   <span>{String(p.visual.props?.label??'').toUpperCase()}</span><span style={{color:tokens.paper}}>{Math.round(t*100)}%</span>
  </div>
 </SceneFrame>;
};

export const customScenes:Record<string,React.FC<SceneProps>>={
 ProgressExample,
};
