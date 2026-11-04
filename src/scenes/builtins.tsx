import React from 'react';
import {Img,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {SceneFrame,SceneProps,arrive,fitSize,fonts,relFrame,revealAt,tokens,useEnter} from './kit';

const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

/** Big statement. Words land on their spoken times (`at`), one word can be emphasised. */
export const Headline:React.FC<SceneProps>=(p)=>{
 const {visual,stage}=p;const frame=useCurrentFrame();
 const words:string[]=visual.text.split(/\s+/);
 const longest=Math.max(...words.map(w=>w.length));
 const size=Math.min(fitSize(Math.min(visual.text.length,18),stage.width,124,0.52),fitSize(longest,stage.width,124,0.6));
 const emphasis=visual.emphasis;
 return <SceneFrame {...p}>
  <div style={{fontFamily:fonts.sans,fontWeight:800,fontSize:size,lineHeight:1.02,letterSpacing:-size*0.035,color:tokens.paper,display:'flex',flexWrap:'wrap',columnGap:size*0.26}}>
   {words.map((word,i)=>{
    const t=interpolate(frame,[revealAt(visual,i,3),revealAt(visual,i,3)+9],[0,1],{...clamp,easing:arrive});
    const underline=i===emphasis?interpolate(frame,[revealAt(visual,i,3)+4,revealAt(visual,i,3)+16],[0,1],{...clamp,easing:arrive}):0;
    return <span key={i} style={{position:'relative',display:'inline-block',opacity:t,transform:`translateY(${(1-t)*size*0.4}px)`,color:emphasis===undefined||i===emphasis?tokens.paper:tokens.secondary}}>
     {word}
     {i===emphasis&&<span style={{position:'absolute',left:0,bottom:-size*0.08,height:Math.max(4,size*0.06),width:`${underline*100}%`,background:tokens.paper}}/>}
    </span>;
   })}
  </div>
 </SceneFrame>;
};

/** A number that counts up, with a short label underneath. */
export const NumberScene:React.FC<SceneProps>=(p)=>{
 const {visual,stage}=p;const frame=useCurrentFrame();
 const land=visual.at?.[0]!==undefined?relFrame(visual,visual.at[0]):22;
 const t=interpolate(frame,[2,Math.max(land,8)],[0,1],{...clamp,easing:arrive});
 const from=visual.from??0;const decimals=visual.decimals??(Number.isInteger(visual.value)?0:1);
 const shown=(from+(visual.value-from)*t).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
 const finalText=`${visual.prefix??''}${Number(visual.value).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}${visual.suffix??''}`;
 const size=Math.min(fitSize(finalText.length,stage.width,260,0.62),stage.height*0.62);
 const enter=useEnter(0,10);
 const label=useEnter(Math.max(land-4,6),12);
 return <SceneFrame {...p}>
  <div style={{fontFamily:fonts.sans,fontWeight:800,fontSize:size,lineHeight:0.92,letterSpacing:-size*0.045,color:tokens.paper,fontVariantNumeric:'tabular-nums',opacity:enter,transform:`translateY(${(1-enter)*30}px)`,whiteSpace:'nowrap'}}>
   {visual.prefix}{shown}<span style={{color:tokens.secondary}}>{visual.suffix}</span>
  </div>
  <div style={{height:3,background:tokens.paper,width:`${t*38}%`,marginTop:size*0.14,marginBottom:22}}/>
  {visual.label&&<div style={{fontFamily:fonts.mono,fontSize:30,letterSpacing:3,textTransform:'uppercase',color:tokens.secondary,opacity:label,transform:`translateY(${(1-label)*12}px)`}}>{visual.label}</div>}
 </SceneFrame>;
};

/** Numbered steps revealed one by one; the newest step is bright, earlier ones dim. */
export const List:React.FC<SceneProps>=(p)=>{
 const {visual,stage}=p;const frame=useCurrentFrame();
 const items:string[]=visual.items;
 const title=useEnter(0,10);
 const room=stage.height-(visual.title?70:0)-(visual.kicker?48:0);
 const row=Math.min(96,room/items.length);
 const size=Math.min(54,row*0.58,fitSize(Math.max(...items.map(i=>i.length)),stage.width-110,54,0.52));
 const starts=items.map((_,i)=>revealAt(visual,i,10,6));
 const current=starts.filter(s=>frame>=s).length-1;
 return <SceneFrame {...p}>
  {visual.title&&<div style={{fontFamily:fonts.sans,fontWeight:700,fontSize:34,color:tokens.secondary,marginBottom:26,opacity:title}}>{visual.title}</div>}
  {items.map((item,i)=>{
   const t=interpolate(frame,[starts[i],starts[i]+10],[0,1],{...clamp,easing:arrive});
   return <div key={i} style={{display:'flex',alignItems:'baseline',gap:28,height:row,borderTop:`1px solid ${tokens.line}`,paddingTop:row*0.16,opacity:t,transform:`translateX(${(1-t)*-24}px)`}}>
    <span style={{fontFamily:fonts.mono,fontSize:24,color:tokens.muted,width:48}}>{String(i+1).padStart(2,'0')}</span>
    <span style={{fontFamily:fonts.sans,fontWeight:700,fontSize:size,letterSpacing:-1,color:i===current?tokens.paper:tokens.secondary}}>{item}</span>
   </div>;
  })}
 </SceneFrame>;
};

/** Horizontal bar chart; bars grow in sequence, one bar can be highlighted. */
export const Bars:React.FC<SceneProps>=(p)=>{
 const {visual,stage}=p;const frame=useCurrentFrame();
 const bars:Array<{label:string;value:number}>=visual.bars;
 const max=Math.max(...bars.map(b=>b.value),1e-9);
 const title=useEnter(0,10);
 const room=stage.height-(visual.title?64:0)-(visual.kicker?48:0);
 const row=Math.min(92,room/bars.length);
 const hi=visual.highlight;
 return <SceneFrame {...p}>
  {visual.title&&<div style={{fontFamily:fonts.sans,fontWeight:700,fontSize:34,color:tokens.secondary,marginBottom:22,opacity:title}}>{visual.title}</div>}
  {bars.map((bar,i)=>{
   const start=revealAt(visual,i,4,4);
   const t=interpolate(frame,[start,start+18],[0,1],{...clamp,easing:arrive});
   const on=hi===undefined||hi===i;
   return <div key={i} style={{height:row}}>
    <div style={{display:'flex',justifyContent:'space-between',fontFamily:fonts.mono,fontSize:Math.min(24,row*0.3),color:on?tokens.paper:tokens.secondary,marginBottom:row*0.08,opacity:Math.min(1,t*2)}}>
     <span>{bar.label}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{Math.round(bar.value*t).toLocaleString('en-US')}{visual.unit??''}</span>
    </div>
    <div style={{height:row*0.3,background:tokens.surface,borderRadius:3,overflow:'hidden'}}>
     <div style={{height:'100%',width:`${(bar.value/max)*100*t}%`,background:on?tokens.paper:tokens.dim,borderRadius:3}}/>
    </div>
   </div>;
  })}
 </SceneFrame>;
};

/** Serif payoff line. Use it once, for the sentence the video is about. */
export const Quote:React.FC<SceneProps>=(p)=>{
 const {visual,stage}=p;const frame=useCurrentFrame();
 const words:string[]=visual.text.split(/\s+/);
 const size=Math.min(fitSize(Math.min(visual.text.length,22),stage.width,92,0.48),stage.height/3.4);
 const rule=useEnter(0,14);
 const by=useEnter(words.length*2+10,12);
 return <SceneFrame {...p}>
  <div style={{width:`${rule*90}px`,height:2,background:tokens.paper,marginBottom:34}}/>
  <div style={{fontFamily:fonts.serif,fontStyle:'italic',fontSize:size,lineHeight:1.12,color:tokens.paper,letterSpacing:-0.5}}>
   {words.map((w,i)=>{const t=interpolate(frame,[revealAt(visual,i,2,4),revealAt(visual,i,2,4)+12],[0,1],{...clamp,easing:arrive});return <span key={i} style={{opacity:t,display:'inline-block',transform:`translateY(${(1-t)*14}px)`,marginRight:size*0.24}}>{w}</span>;})}
  </div>
  {visual.attribution&&<div style={{fontFamily:fonts.mono,fontSize:22,letterSpacing:3,color:tokens.secondary,marginTop:30,opacity:by,textTransform:'uppercase'}}>{visual.attribution}</div>}
 </SceneFrame>;
};

/** A screenshot or image from public/, framed, with a slow push and an optional highlight box. */
export const ImageScene:React.FC<SceneProps>=(p)=>{
 const {visual,stage,durationInFrames}=p;const frame=useCurrentFrame();
 const enter=useEnter(0,14);
 const push=interpolate(frame,[0,durationInFrames],[1,1.06],clamp);
 const h=visual.highlight;
 const hiStart=h?(h.at!==undefined?relFrame(visual,h.at):Math.round(durationInFrames*0.35)):0;
 const hi=h?interpolate(frame,[hiStart,hiStart+12],[0,1],{...clamp,easing:arrive}):0;
 const height=stage.height-(visual.kicker?48:0);
 return <SceneFrame {...p}>
  <div style={{position:'relative',width:stage.width,height,borderRadius:18,overflow:'hidden',border:`1px solid ${tokens.line}`,background:tokens.surface,opacity:enter,transform:`translateY(${(1-enter)*26}px)`}}>
   <div style={{position:'absolute',inset:0,transform:`scale(${push})`,transformOrigin:h?`${h.x+h.w/2}% ${h.y+h.h/2}%`:'50% 50%'}}>
    <Img src={staticFile(visual.src)} style={{width:'100%',height:'100%',objectFit:visual.fit??'cover'}}/>
    {h&&<div style={{position:'absolute',left:`${h.x}%`,top:`${h.y}%`,width:`${h.w}%`,height:`${h.h}%`,borderRadius:10,border:`3px solid ${tokens.paper}`,boxShadow:`0 0 0 2000px rgba(0,0,0,${0.5*hi})`,opacity:hi,transform:`scale(${1.08-0.08*hi})`}}/>}
   </div>
  </div>
 </SceneFrame>;
};
