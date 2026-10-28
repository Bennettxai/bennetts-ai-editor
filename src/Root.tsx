import React from 'react';
import {AbsoluteFill,Audio,Composition,OffthreadVideo,Sequence,interpolate,staticFile,useCurrentFrame} from 'remotion';

type Range = {start:number;end:number};
type TextRange = Range & {text:string};
type Sound = {src:string;volume?:number};
export type Edit = {title:string;source:string;clips:Range[];captions?:TextRange[];cards?:TextRange[];sfx?:Array<Sound & {start:number}>;music?:Sound};
type Props = {edit:Edit};
const FPS=30;
const tokens={background:'#0a0a0a',paper:'#f2f2f2',secondary:'#a0a0a0',muted:'#5c5c5c',line:'rgba(255,255,255,0.1)'};
const frames=(seconds:number)=>Math.round(seconds*FPS);
const length=(clip:Range)=>frames(clip.end)-frames(clip.start);
const duration=(edit:Edit)=>edit.clips.reduce((sum,clip)=>sum+length(clip),0);

const Card:React.FC<{text:string}>=({text})=>{
 const frame=useCurrentFrame();
 const opacity=interpolate(frame,[0,7],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return <AbsoluteFill style={{background:tokens.background,justifyContent:'center',padding:'160px 90px',opacity}}>
  <div style={{fontFamily:'monospace',fontSize:23,letterSpacing:5,color:tokens.secondary,marginBottom:40}}>BENNETT LEGACY</div>
  <div style={{width:96,height:3,background:tokens.paper,marginBottom:48}}/>
  <div style={{fontSize:94,fontWeight:750,lineHeight:1.08,letterSpacing:-4,overflowWrap:'anywhere'}}>{text}</div>
  <div style={{marginTop:65,paddingTop:28,borderTop:`1px solid ${tokens.line}`,fontSize:22,color:tokens.muted,fontFamily:'monospace'}}>ONE IDEA AT A TIME.</div>
 </AbsoluteFill>;
};
const Editor:React.FC<Props>=({edit})=>{
 const frame=useCurrentFrame();
 const caption=edit.captions?.find(c=>frame>=frames(c.start)&&frame<frames(c.end));
 let offset=0;
 return <AbsoluteFill style={{background:tokens.background,color:tokens.paper,fontFamily:'Arial, Helvetica, sans-serif'}}>
  {edit.source&&edit.clips.map((clip,index)=>{const from=offset;offset+=length(clip);return <Sequence key={index} from={from} durationInFrames={length(clip)}>
   <OffthreadVideo src={staticFile(edit.source)} startFrom={frames(clip.start)} endAt={frames(clip.end)} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
  </Sequence>;})}
  <AbsoluteFill style={{background:'linear-gradient(180deg, rgba(0,0,0,.48), transparent 26%, transparent 65%, rgba(0,0,0,.5))',pointerEvents:'none'}}/>
  <div style={{position:'absolute',left:72,right:72,top:90,fontFamily:'monospace',fontSize:22,letterSpacing:4,textShadow:'0 2px 8px black'}}>BENNETT LEGACY</div>
  {(edit.cards??[]).map((card,index)=><Sequence key={index} from={frames(card.start)} durationInFrames={length(card)}><Card text={card.text}/></Sequence>)}
  {caption&&<div style={{position:'absolute',bottom:330,left:72,right:72,textAlign:'center',fontSize:57,fontWeight:800,lineHeight:1.12,textShadow:'0 3px 12px black',overflowWrap:'anywhere'}}><span style={{background:'rgba(10,10,10,.82)',padding:'12px 22px',boxDecorationBreak:'clone'}}>{caption.text}</span></div>}
  {edit.music&&<Audio src={staticFile(edit.music.src)} volume={edit.music.volume??0.08} loop/>}
  {(edit.sfx??[]).map((cue,index)=><Sequence key={index} from={frames(cue.start)} durationInFrames={Math.max(1,duration(edit)-frames(cue.start))}><Audio src={staticFile(cue.src)} volume={cue.volume??0.25}/></Sequence>)}
 </AbsoluteFill>;
};
const sample:Edit={title:"Bennett’s AI Editor",source:'',clips:[{start:0,end:3}],cards:[{start:0,end:3,text:'Your next video starts here.'}]};
const Welcome:React.FC=()=><AbsoluteFill style={{background:tokens.background,color:tokens.paper,fontFamily:'Arial, sans-serif'}}><Card text='Your next video starts here.'/></AbsoluteFill>;
export const Root:React.FC=()=><>
 <Composition id='Welcome' component={Welcome} width={1080} height={1920} fps={FPS} durationInFrames={90}/>
 <Composition id='BennettsEditor' component={Editor} width={1080} height={1920} fps={FPS} durationInFrames={90} defaultProps={{edit:sample}} calculateMetadata={({props})=>({durationInFrames:duration(props.edit)})}/>
</>;
