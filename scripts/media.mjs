import {spawnSync} from 'node:child_process';
import {parseFps} from '../src/format.mjs';

function inspect(file,args){
 const result=spawnSync('ffprobe',['-v','error',...args,'-of','json',file],{encoding:'utf8',maxBuffer:64*1024*1024});
 if(result.error||result.status!==0)throw new Error(`Cannot inspect input with ffprobe. Install FFmpeg and check the file. ${result.error?.message??result.stderr}`);
 return JSON.parse(result.stdout);
}
const numeric=value=>Number.isFinite(Number(value))?Number(value):null;
export function probeSource(file){
 const info=inspect(file,['-show_streams','-show_format']);
 const video=info.streams?.find(s=>s.codec_type==='video'),audio=info.streams?.find(s=>s.codec_type==='audio');
 if(!video)throw new Error('Input needs a video stream.');
 const {fps,fpsRatio}=parseFps(video.r_frame_rate);
 // Check every presentation timestamp. Average and nominal rates alone can hide variable cadence.
 const decoded=inspect(file,['-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time']);
 const timestamps=(decoded.frames??[]).map(f=>numeric(f.best_effort_timestamp_time));
 const [n,d]=String(video.time_base).split('/').map(Number);
 const tick=Number.isFinite(n/d)?n/d:0;
 const tolerance=Math.max(0.000002,tick*1.1);
 const variableFrameRate=timestamps.some((t,i)=>t===null||(i>0&&(t<=timestamps[i-1]||Math.abs(t-timestamps[i-1]-1/fps)>tolerance)));
 const streamDuration=numeric(video.duration);
 // MP4 muxers may shorten the final packet by one time-base tick. CFR keeps every decoded frame.
 const duration=variableFrameRate?(streamDuration??timestamps.length/fps):timestamps.length/fps;
 if(!timestamps.length||!Number.isFinite(duration)||duration<=0)throw new Error('Cannot determine video duration and frame timestamps. Convert to a CFR working copy before importing.');
 if(!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width<=0||video.height<=0)throw new Error('Cannot determine source video dimensions.');
 return {
  video:{codec:video.codec_name,width:video.width,height:video.height,fpsRatio,averageFrameRate:video.avg_frame_rate,timeBase:video.time_base,startTime:numeric(video.start_time)??0,streamDuration,duration,frameCount:timestamps.length,variableFrameRate},
  audio:audio?{codec:audio.codec_name,startTime:numeric(audio.start_time)??0,duration:numeric(audio.duration)}:null,
  container:{startTime:numeric(info.format?.start_time),duration:numeric(info.format?.duration)},
  normalization:null,
 };
}
// Shell-safe, no-overwrite instruction: the original always remains separate from the working copy.
export function cfrInstruction(file,fpsRatio){
 const quote=value=>`'${String(value).replaceAll("'","'\\''")}'`;
 const output=file.replace(/\.[^/.]+$/,'')+'.working-cfr.mp4';
 return `ffmpeg -n -i ${quote(file)} -map 0:v:0 -map 0:a? -vf ${quote(`fps=${fpsRatio}`)} -fps_mode cfr -c:v libx264 -crf 10 -c:a aac ${quote(output)}`;
}
