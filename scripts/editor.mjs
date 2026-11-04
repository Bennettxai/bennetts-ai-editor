#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {safeSlug,validateEdit,lintEdit,durationFrames,mediaPath,FPS} from '../src/edit.mjs';
import {parseSrt,mapCaptions,mapWords,captionsFromWords} from '../src/captions.mjs';
import {parseTranscript,parseSilences,silenceThreshold,noiseFloor,refineWords} from '../src/transcript.mjs';
import {proposeCuts,clipsWithin} from '../src/cuts.mjs';
import {loudnormFilter,parseLoudnorm,MASTER} from '../src/audio.mjs';
import {review} from './review.mjs';
const root=process.cwd();
const USAGE=`Usage:
  npm run init -- <slug> --input <video>
  npm run transcribe -- <slug> [--json <whisper.json>] [--model <ggml model>]
  npm run cut -- <slug> [--max-pause 0.35] [--remove-fillers] [--apply [--replace-captions]]
  npm run captions -- <slug> --words [--group 1] [--apply]   |   --srt <file> [--apply]
  npm run words -- <slug>
  npm run validate -- <slug>
  npm run draft -- <slug> [--guides]
  npm run render -- <slug> [--no-master]
  npm run review -- <slug> [--draft]
  npm run demo`;
export function execute(command,args,options={}){
 const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:64*1024*1024,...options});
 if(result.error)throw new Error(`Cannot run ${command}. Install it and add it to PATH. ${result.error.message}`);
 if(result.status!==0)throw new Error(`${command} failed: ${result.stderr||'see output above'}`);
 return result;
}
function probe(file){
 const info=JSON.parse(execute('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',file]).stdout);
 if(!info.streams?.some(s=>s.codec_type==='video'))throw new Error('Input needs a video stream.');
 const duration=Number(info.format.duration);if(!Number.isFinite(duration)||duration<=0)throw new Error('Cannot determine media duration.');
 return duration;
}
function project(slug){safeSlug(slug);return path.join(root,'projects',slug);}
const projectFile=(slug,name)=>path.join(project(slug),name);
const writeJson=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function flag(args,name){const i=args.indexOf(name);if(i<0)return undefined;const v=args[i+1];if(v===undefined||v.startsWith('--'))throw new Error(`${name} needs a value.\n${USAGE}`);return v;}
function readEdit(slug){
 const filename=projectFile(slug,'edit.json');
 if(!fs.existsSync(filename))throw new Error(`Project not found: ${filename}. Run npm run init -- ${slug} --input /path/to/video.mp4`);
 return JSON.parse(fs.readFileSync(filename,'utf8'));
}
// Custom scenes live in TSX the CLI can't import; check the registry by name so typos fail before a render.
function checkCustomScenes(edit){
 const names=(edit.visuals??[]).filter(v=>v.scene==='custom').map(v=>v.component);
 if(!names.length)return;
 const file=path.join(root,'src/scenes/custom/index.tsx');
 const block=/customScenes[^=]*=\s*\{([^}]*)\}/.exec(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'')?.[1]??'';
 const registered=new Set([...block.matchAll(/([A-Z][A-Za-z0-9]*)\s*(?:[:,]|$)/g)].map(m=>m[1]));
 for(const name of names)if(!registered.has(name))throw new Error(`Custom scene ${name} is not registered in src/scenes/custom/index.tsx (customScenes).`);
}
function checkMedia(edit){
 checkCustomScenes(edit);
 const files=[edit.source,...(edit.sfx??[]).map(x=>x.src),...(edit.music?[edit.music.src]:[]),...(edit.visuals??[]).filter(v=>v.src).map(v=>v.src)];
 for(const relative of files){const filename=mediaPath(root,relative);if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())throw new Error(`Media missing: public/${relative}`);}
 const duration=probe(mediaPath(root,edit.source));
 if(edit.clips.some(c=>c.end>duration+.001))throw new Error(`Clip end exceeds source duration (${duration}s).`);
 return duration;
}
function load(slug,replaceCaptions=false){
 const parsed=readEdit(slug);
 const edit=validateEdit(replaceCaptions?{...parsed,captions:[]}:parsed);
 checkMedia(edit);
 return edit;
}
function transcriptData(slug){
 const file=projectFile(slug,'transcript.json');
 if(!fs.existsSync(file))throw new Error(`No transcript yet. Run npm run transcribe -- ${slug}`);
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 return {words:parseTranscript(data),silences:Array.isArray(data.silences)?data.silences:undefined,heard:Array.isArray(data.heard)?data.heard:undefined};
}
// 16 kHz mono WAV on the VIDEO's clock: audio that starts late is padded with silence, so the
// recogniser, the silence detector and the renderer all agree on what "2.0 s" means.
function extractWav(source,wav){
 execute('ffmpeg',['-v','error','-y','-i',source,'-vn','-af','aresample=async=1:first_pts=0','-ar','16000','-ac','1','-c:a','pcm_s16le',wav]);
}
const transcriptWords=slug=>transcriptData(slug).words;
// Silences measured from the audio itself, relative to how loud this recording is.
function detectSilences(file,duration){
 const mean=/mean_volume: (-?[\d.]+) dB/.exec(execute('ffmpeg',['-hide_banner','-nostats','-i',file,'-vn','-af','volumedetect','-f','null','-']).stderr);
 if(!mean)return {silences:[],threshold:null};
 const levels=[...execute('ffmpeg',['-hide_banner','-nostats','-i',file,'-vn','-af','asetnsamples=800,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-','-f','null','-']).stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map(m=>m[1]==='-inf'?-Infinity:Number(m[1]));
 const threshold=silenceThreshold(Number(mean[1]),noiseFloor(levels));
 const out=execute('ffmpeg',['-hide_banner','-nostats','-i',file,'-vn','-af',`silencedetect=noise=${threshold}dB:d=0.2`,'-f','null','-']).stderr;
 // Audio that stops before the picture: the rest of the video is silent too.
 const audioEnd=Number(execute('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=duration','-of','csv=p=0',file]).stdout.trim());
 const end=Number.isFinite(audioEnd)&&audioEnd>0?Math.min(audioEnd,duration):duration;
 const silences=parseSilences(out,end);
 if(end<duration-0.05){const last=silences.at(-1);if(last&&last.end>=end-0.05)last.end=duration;else silences.push({start:Math.round(end*1000)/1000,end:duration});}
 return {silences,threshold};
}
function init(slug,input){
 const dir=project(slug);const assets=path.join(root,'public','projects',slug);
 if(fs.existsSync(dir)||fs.existsSync(assets))throw new Error(`Project ${slug} already exists; choose another name.`);
 if(!input||!fs.existsSync(input)||!fs.statSync(input).isFile())throw new Error('Input file is missing. Use --input /path/to/video.mp4');
 const duration=probe(path.resolve(input));
 const ext=path.extname(input).toLowerCase();if(!['.mp4','.mov','.m4v','.webm'].includes(ext))throw new Error('Use MP4, MOV, M4V or WebM input.');
 const source=`projects/${slug}/input${ext}`;
 const end=Math.floor(duration*FPS)/FPS;if(end<=0)throw new Error('Input is shorter than one frame.');
 const edit={title:slug.split('-').join(' '),source,clips:[{start:0,end}],captions:[],cards:[],sfx:[]};
 fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(path.resolve(input),path.join(root,'public',source));
 writeJson(path.join(dir,'edit.json'),edit);
 console.log(`Created projects/${slug}/edit.json. Next: npm run transcribe -- ${slug}`);
 return edit;
}

// ---------- transcribe ----------
function findModel(explicit){
 const candidates=[explicit,process.env.WHISPER_MODEL].filter(Boolean);
 for(const dir of [path.join(root,'models'),path.join(os.homedir(),'.whisper-models')]){
  if(!fs.existsSync(dir))continue;
  const found=fs.readdirSync(dir).filter(f=>/^ggml-.*\.bin$/.test(f));
  const pick=['small.en','base.en','medium.en','small','base','medium','large'].map(n=>found.find(f=>f.includes(`-${n}`))).find(Boolean)??found[0];
  if(pick)candidates.push(path.join(dir,pick));
 }
 const model=candidates.find(f=>fs.existsSync(f));
 if(!model)throw new Error('No whisper.cpp model found. Download one (see docs/TRANSCRIBE.md) into models/ or ~/.whisper-models/, pass --model, or import an existing transcript with --json.');
 return model;
}
function transcribe(slug,args){
 const edit=validateEdit(readEdit(slug));
 const json=flag(args,'--json');let words,engine;
 if(json){
  if(!fs.existsSync(json))throw new Error(`Transcript JSON not found: ${json}`);
  words=parseTranscript(JSON.parse(fs.readFileSync(json,'utf8')));engine=`imported ${path.basename(json)}`;
 }else{
  const model=findModel(flag(args,'--model'));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'transcribe-'));
  try{
   const wav=path.join(temp,'audio.wav');
   extractWav(mediaPath(root,edit.source),wav);
   const bin=['whisper-cli','whisper-cpp','main'].find(b=>!spawnSync(b,['--help']).error);
   if(!bin)throw new Error('whisper.cpp is not installed (whisper-cli). See docs/TRANSCRIBE.md, or import a transcript with --json.');
   console.log(`Transcribing with ${bin} and ${path.basename(model)}…`);
   execute(bin,['-m',model,'-f',wav,'-ojf','-of',path.join(temp,'out'),'-np']);
   words=parseTranscript(JSON.parse(fs.readFileSync(path.join(temp,'out.json'),'utf8')));engine=`whisper.cpp ${path.basename(model)}`;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 }
 const source=mediaPath(root,edit.source);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'silences-'));
 let silences,threshold;
 try{const wav=path.join(temp,'audio.wav');extractWav(source,wav);({silences,threshold}=detectSilences(wav,probe(source)));}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
 const heard=words;
 words=refineWords(words,silences);
 writeJson(projectFile(slug,'transcript.json'),{clock:'source',engine,silenceThreshold:threshold,silences,words,heard});
 console.log(`Wrote ${words.length} timed words and ${silences.length} silences (below ${threshold} dB) to projects/${slug}/transcript.json (source clock).`);
 console.log('Read it back against the recording: names, numbers and jargon are the usual mistakes. Fix the text in transcript.json; keep the times.');
}

// ---------- cut ----------
function overlayErrors(edit){try{validateEdit(edit);return null;}catch(error){return error.message;}}
function cut(slug,args){
 const edit=validateEdit(readEdit(slug));const duration=checkMedia(edit);
 const maxPause=flag(args,'--max-pause');
 const {words:spoken,silences,heard}=transcriptData(slug);
 if(maxPause!==undefined&&!(Number(maxPause)>=0.1&&Number(maxPause)<=3))throw new Error('--max-pause must be 0.1–3 seconds.');
 const result=proposeCuts(spoken,duration,{...(maxPause?{maxPause:Number(maxPause)}:{}),removeFillers:args.includes('--remove-fillers'),...(silences?{silences,heard}:{})});
 writeJson(projectFile(slug,'cuts.proposed.json'),result);
 const kept=durationFrames({clips:result.clips})/FPS;
 console.log(`Proposed ${result.clips.length} clips: ${kept.toFixed(2)} s kept, ${result.removedSeconds.toFixed(2)} s removed.`);
 for(const d of result.decisions)console.log(`  ${d.action.padEnd(4)} at ${d.at.toFixed(2)} s  ${d.reason}`);
 for(const f of result.flags)console.log(`  ${f.type.toUpperCase()} at ${f.at.toFixed(2)} s  "${f.text}"  ${f.note}`);
 console.log(`Full log: projects/${slug}/cuts.proposed.json. Listen to every join before approving.`);
 if(!args.includes('--apply')){console.log('edit.json was not changed. Add --apply after review.');return;}
 if(edit.captionStyle!=='word'&&edit.captions?.length&&!args.includes('--replace-captions'))throw new Error('This project has phrase captions, and cutting would move them off their words. Re-import them after cutting (npm run captions -- <slug> --srt …), or add --replace-captions to switch to word captions.');
 // Cut only inside the clips you already have: takes you removed stay removed, framing is kept.
 const clips=clipsWithin(edit.clips,result.clips);
 const next={...edit,clips,captionStyle:'word'};
 next.captions=captionsFromWords(mapWords(transcriptWords(slug),clips),durationFrames(next)/FPS);
 const problem=overlayErrors(next);
 if(problem)throw new Error(`Cuts not applied: ${problem} Re-time or remove those items first (cuts change every output time).`);
 writeJson(projectFile(slug,'edit.json'),next);
 console.log('Applied cuts and rebuilt word captions. Cards, visuals and SFX use output times: re-check them now (npm run words lists the new times).');
}

// ---------- captions ----------
function captions(slug,args){
 if(args[0]==='--words'){
  const edit=load(slug,true);const group=Number(flag(args,'--group')??1);
  if(!Number.isInteger(group)||group<1||group>5)throw new Error('--group must be 1–5 words.');
  const total=durationFrames(edit)/FPS;
  const mapped=captionsFromWords(mapWords(transcriptWords(slug),edit.clips),total,{group});
  const proposed=validateEdit({...edit,captions:mapped,captionStyle:'word'});
  writeJson(projectFile(slug,'captions.proposed.json'),mapped);
  console.log(`Wrote ${mapped.length} word captions to projects/${slug}/captions.proposed.json.`);
  if(args.includes('--apply')){writeJson(projectFile(slug,'edit.json'),proposed);console.log('Applied word captions to edit.json.');}
  else console.log('edit.json was not changed. Add --apply to use them.');
  return;
 }
 if(args[0]!=='--srt'||!args[1]||args.length>3||(args[2]!==undefined&&args[2]!=='--apply'))throw new Error('Usage: npm run captions -- <slug> --words [--group N] [--apply]  |  --srt /path/to/source.srt [--apply]');
 const edit=load(slug,true);
 const filename=path.resolve(args[1]);
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())throw new Error('SRT file is missing. Use --srt /path/to/source.srt');
 const mapped=mapCaptions(parseSrt(fs.readFileSync(filename,'utf8')),edit.clips);
 const proposed=validateEdit({...edit,captions:mapped});
 writeJson(projectFile(slug,'captions.proposed.json'),mapped);
 console.log(`Wrote ${mapped.length} output-clock caption segments to projects/${slug}/captions.proposed.json.`);
 console.log('Cues spanning a cut repeat their full phrase in each retained segment. Review text and timing; this is not word alignment.');
 if(args[2]==='--apply'){
  writeJson(projectFile(slug,'edit.json'),proposed);
  console.log('Applied captions to edit.json. Existing clips, cards, music and SFX were preserved.');
 }else console.log('edit.json was not changed. Add --apply to replace its captions after review.');
}

// ---------- words (output clock, for syncing visuals and SFX) ----------
function words(slug){
 const edit=validateEdit(readEdit(slug));
 const mapped=mapWords(transcriptWords(slug),edit.clips);
 writeJson(projectFile(slug,'words.output.json'),{clock:'output',words:mapped});
 console.log(mapped.map(w=>`${w.start.toFixed(2).padStart(7)}  ${w.text}`).join('\n'));
 console.log(`\n${mapped.length} words on the finished-edit clock. Saved to projects/${slug}/words.output.json.`);
}

// ---------- render + master ----------
function master(file){
 const measure=execute('ffmpeg',['-hide_banner','-nostats','-i',file,'-af',loudnormFilter(),'-f','null','-']);
 const measured=parseLoudnorm(measure.stderr);
 if(!measured){console.log('No audio to master.');return;}
 const temp=file.replace(/\.mp4$/,'.mastering.mp4');
 execute('ffmpeg',['-v','error','-y','-i',file,'-map','0','-c:v','copy','-af',loudnormFilter(measured),'-ar','48000','-c:a','aac','-b:a','256k','-movflags','+faststart',temp]);
 fs.renameSync(temp,file);
 console.log(`Mastered audio to ${MASTER.integrated} LUFS integrated, ${MASTER.truePeak} dBTP peak ceiling (measured ${measured.input_i} LUFS before).`);
}
function render(slug,args=[],draft=false){
 const edit=load(slug);const props=projectFile(slug,'.render-props.json');
 for(const warning of lintEdit(edit))console.warn(`Warning: ${warning}`);
 writeJson(props,{edit,guides:args.includes('--guides')});
 const cli=path.join(root,'node_modules','@remotion','cli','remotion-cli.js');
 const output=draft?`output/drafts/${slug}.mp4`:`output/${slug}.mp4`;
 fs.mkdirSync(path.dirname(path.join(root,output)),{recursive:true});
 const quality=draft?['--crf','28','--scale','0.5']:['--crf','18'];
 execute(process.execPath,[cli,'render','src/index.ts','BennettsEditor',output,'--props',props,'--codec','h264',...quality,'--concurrency','2'],{stdio:'inherit'});
 if(!draft&&!args.includes('--no-master'))master(path.join(root,output));
 console.log(`Exported ${output}${draft?'':`. Next: npm run review -- ${slug}`}`);
}
function demo(){
 const slug='demo';if(fs.existsSync(project(slug))||fs.existsSync(path.join(root,'public/projects/demo')))throw new Error('Demo already exists. Run npm run render -- demo to render it again.');
 const temp=path.join(root,'.demo-input.mp4');
 try{
  execute('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=540x960:rate=30,hue=h=t*90','-f','lavfi','-i','sine=frequency=330:sample_rate=48000','-t','7','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-af','volume=0.3','-y',temp]);
  const edit=init(slug,temp);
  const demoEdit=JSON.parse(fs.readFileSync(path.join(root,'scripts/demo-edit.json'),'utf8'));
  writeJson(projectFile(slug,'edit.json'),{...edit,...demoEdit,source:edit.source});
  render(slug);
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}

try{
 const [command,slug,...args]=process.argv.slice(2);
 if(command==='init')init(slug,args[0]==='--input'?args[1]:undefined);
 else if(command==='transcribe')transcribe(slug,args);
 else if(command==='cut')cut(slug,args);
 else if(command==='captions')captions(slug,args);
 else if(command==='words')words(slug);
 else if(command==='validate'){
  const edit=load(slug);const warnings=lintEdit(edit);
  console.log(`Valid: ${durationFrames(edit)} frames, ${(durationFrames(edit)/FPS).toFixed(2)} seconds, 1080×1920 at ${FPS}fps.`);
  for(const w of warnings)console.log(`Warning: ${w}`);
 }
 else if(command==='render')render(slug,args);
 else if(command==='draft')render(slug,args,true);
 else if(command==='review')review(root,slug,{draft:args.includes('--draft'),edit:load(slug)});
 else if(command==='demo')demo();
 else throw new Error(USAGE);
}catch(error){console.error(`Editor: ${error.message}`);process.exitCode=1;}
