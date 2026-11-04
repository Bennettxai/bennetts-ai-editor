import React from 'react';
import {clipPresentation,musicLevel} from './presentation.mjs';
import {DEFAULT_VISUAL_HEIGHT,SAFE,captionTop,footageRect,splitProgress,stageRect} from './layout.mjs';
import {AbsoluteFill,Audio,Composition,OffthreadVideo,Sequence,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {Scene} from './scenes';
import {FPS,Visual,fonts,tokens} from './scenes/kit';

type Range = {start:number;end:number};
type TextRange = Range & {text:string};
type Sound = {src:string;volume?:number};
export type Edit = {title:string;source:string;clips:Array<Range & {zoom?:number;focusX?:number;focusY?:number}>;captions?:TextRange[];captionStyle?:'word'|'phrase';cards?:TextRange[];visuals?:Visual[];layout?:{visualHeight?:number};sfx?:Array<Sound & {start:number}>;music?:Sound};
type Props = {edit:Edit;guides?:boolean};
const frames=(seconds:number)=>Math.round(seconds*FPS);
const length=(clip:Range)=>frames(clip.end)-frames(clip.start);
const duration=(edit:Edit)=>edit.clips.reduce((sum,clip)=>sum+length(clip),0);

// A card that opens the video appears fully formed: frame 1 must be a finished picture.
const Card:React.FC<{text:string;instant?:boolean;durationInFrames?:number}>=({text,instant,durationInFrames=90})=>{
 const frame=useCurrentFrame();
 const drift=interpolate(frame,[0,durationInFrames],[1,1.03],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}); // holds never freeze
 const opacity=instant?1:interpolate(frame,[0,7],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return <AbsoluteFill style={{background:tokens.background,justifyContent:'center',transform:`scale(${drift})`,padding:`${SAFE.top}px ${1080-SAFE.right}px ${1920-SAFE.bottom}px ${SAFE.left+30}px`,opacity}}>
  <div style={{fontFamily:fonts.mono,fontSize:23,letterSpacing:5,color:tokens.secondary,marginBottom:40}}>BENNETT LEGACY</div>
  <div style={{width:96,height:3,background:tokens.paper,marginBottom:48}}/>
  <div style={{fontSize:94,fontWeight:750,lineHeight:1.08,letterSpacing:-4,overflowWrap:'anywhere'}}>{text}</div>
  <div style={{marginTop:65,paddingTop:28,borderTop:`1px solid ${tokens.line}`,fontSize:22,color:tokens.muted,fontFamily:fonts.mono}}>ONE IDEA AT A TIME.</div>
 </AbsoluteFill>;
};

const Caption:React.FC<{text:string;style:'word'|'phrase';top:number}>=({text,style,top})=>style==='word'
 // One word, pops on and off with no fade: timing comes from the transcript, not from easing.
 ?<div style={{position:'absolute',left:SAFE.left,right:1080-SAFE.right,top,transform:'translateY(-50%)',textAlign:'center',fontFamily:fonts.sans,fontWeight:900,fontSize:78,letterSpacing:'-0.02em',lineHeight:1,color:'#fff',WebkitTextStroke:'1.5px #fff',textShadow:'0 4px 14px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.35)'}}>{text}</div>
 :<div style={{position:'absolute',left:72,right:72,top,transform:'translateY(-50%)',textAlign:'center',fontSize:57,fontWeight:800,lineHeight:1.12,textShadow:'0 3px 12px black',overflowWrap:'anywhere'}}><span style={{background:'rgba(10,10,10,.82)',padding:'12px 22px',boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'}}>{text}</span></div>;

const Guides:React.FC<{visualHeight:number}>=({visualHeight})=><AbsoluteFill style={{pointerEvents:'none'}}>
 <div style={{position:'absolute',left:SAFE.left,top:SAFE.top,width:SAFE.right-SAFE.left,height:SAFE.bottom-SAFE.top,border:'3px dashed rgba(255,60,60,.85)'}}/>
 <div style={{position:'absolute',left:0,right:0,top:visualHeight,borderTop:'2px dashed rgba(80,160,255,.8)'}}/>
 <div style={{position:'absolute',left:SAFE.left+8,top:SAFE.top+8,fontFamily:fonts.mono,fontSize:20,color:'rgba(255,90,90,.95)'}}>SAFE ZONE</div>
</AbsoluteFill>;

const Editor:React.FC<Props>=({edit,guides})=>{
 const frame=useCurrentFrame();
 const visuals=edit.visuals??[];
 const visualHeight=edit.layout?.visualHeight??DEFAULT_VISUAL_HEIGHT;
 const total=duration(edit);
 const split=splitProgress(frame,visuals,FPS,total);
 const rect=footageRect(split,visualHeight);
 const stage=stageRect(visualHeight);
 const style=edit.captionStyle??'phrase';
 const caption=edit.captions?.find(c=>frame>=frames(c.start)&&frame<frames(c.end));
 let offset=0;
 return <AbsoluteFill style={{background:tokens.background,color:tokens.paper,fontFamily:fonts.sans}}>
  <div style={{position:'absolute',left:0,right:0,top:rect.top,height:rect.height,overflow:'hidden'}}>
   {edit.source&&edit.clips.map((clip,index)=>{const from=offset;offset+=length(clip);return <Sequence key={index} from={from} durationInFrames={length(clip)}>
    <OffthreadVideo src={staticFile(edit.source)} startFrom={frames(clip.start)} endAt={frames(clip.end)} style={{width:'100%',height:'100%',...clipPresentation(clip)}}/>
   </Sequence>;})}
   <AbsoluteFill style={{background:'linear-gradient(180deg, rgba(0,0,0,.48), transparent 26%, transparent 65%, rgba(0,0,0,.5))',opacity:1-split}}/>
  </div>
  {split>0&&<div style={{position:'absolute',left:0,right:0,top:rect.top,borderTop:`1px solid ${tokens.line}`}}/>}
  <div style={{position:'absolute',left:72,right:72,top:90,fontFamily:fonts.mono,fontSize:22,letterSpacing:4,textShadow:'0 2px 8px black'}}>BENNETT LEGACY</div>
  {/* The visual zone ends where the footage begins, so footage sliding up wipes the scene away. */}
  <div style={{position:'absolute',left:0,right:0,top:0,height:rect.top,overflow:'hidden'}}>
   {visuals.map((visual,index)=>{const from=frames(visual.start),len=frames(visual.end)-from;return <Sequence key={index} from={from} durationInFrames={len}>
    <div style={{position:'absolute',left:stage.left,top:stage.top,width:stage.width,height:stage.height}}><Scene visual={visual} stage={stage} durationInFrames={len} holdToEnd={from+len>=total}/></div>
   </Sequence>;})}
  </div>
  {(edit.cards??[]).map((card,index)=><Sequence key={index} from={frames(card.start)} durationInFrames={length(card)}><Card text={card.text} instant={frames(card.start)===0} durationInFrames={length(card)}/></Sequence>)}
  {caption&&<Caption text={caption.text} style={style} top={captionTop(split,visualHeight,style==='word'?undefined:1480)}/>}
  {guides&&<Guides visualHeight={visualHeight}/>}
  {edit.music&&<Audio src={staticFile(edit.music.src)} volume={musicLevel(frame,total,edit.music.volume??0.18)} loop/>}
  {(edit.sfx??[]).map((cue,index)=><Sequence key={index} from={frames(cue.start)} durationInFrames={Math.max(1,total-frames(cue.start))}><Audio src={staticFile(cue.src)} volume={cue.volume??0.25}/></Sequence>)}
 </AbsoluteFill>;
};
const sample:Edit={title:"Bennett’s AI Editor",source:'',clips:[{start:0,end:3}],cards:[{start:0,end:3,text:'Your next video starts here.'}]};
const Welcome:React.FC=()=><AbsoluteFill style={{background:tokens.background,color:tokens.paper,fontFamily:fonts.sans}}><Card text='Your next video starts here.' instant/></AbsoluteFill>;
export const Root:React.FC=()=><>
 <Composition id='Welcome' component={Welcome} width={1080} height={1920} fps={FPS} durationInFrames={90}/>
 <Composition id='BennettsEditor' component={Editor} width={1080} height={1920} fps={FPS} durationInFrames={90} defaultProps={{edit:sample,guides:false}} calculateMetadata={({props})=>({durationInFrames:duration(props.edit)})}/>
</>;
