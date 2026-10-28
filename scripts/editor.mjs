#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {safeSlug,validateEdit,durationFrames,mediaPath} from '../src/edit.mjs';
import {parseSrt,mapCaptions} from '../src/captions.mjs';
const root=process.cwd();
function execute(command,args,options={}){
 const result=spawnSync(command,args,{encoding:'utf8',...options});
 if(result.error)throw new Error(`Cannot run ${command}. Install it and add it to PATH. ${result.error.message}`);
 if(result.status!==0)throw new Error(`${command} failed: ${result.stderr||'see output above'}`);
 return result.stdout;
}
function probe(file){
 const info=JSON.parse(execute('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',file]));
 if(!info.streams?.some(s=>s.codec_type==='video'))throw new Error('Input needs a video stream.');
 const duration=Number(info.format.duration);if(!Number.isFinite(duration)||duration<=0)throw new Error('Cannot determine media duration.');
 return duration;
}
function project(slug){safeSlug(slug);return path.join(root,'projects',slug);}
function load(slug,replaceCaptions=false){
 const filename=path.join(project(slug),'edit.json');
 if(!fs.existsSync(filename))throw new Error(`Project not found: ${filename}. Run npm run init -- ${slug} --input /path/to/video.mp4`);
 const parsed=JSON.parse(fs.readFileSync(filename,'utf8'));
 const edit=validateEdit(replaceCaptions?{...parsed,captions:[]}:parsed);
 for(const relative of [edit.source,...(edit.sfx??[]).map(x=>x.src),...(edit.music?[edit.music.src]:[])]){
  const filename=mediaPath(root,relative);if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())throw new Error(`Media missing: public/${relative}`);
 }
 const duration=probe(mediaPath(root,edit.source));
 if(edit.clips.some(c=>c.end>duration+.001))throw new Error(`Clip end exceeds source duration (${duration}s).`);
 return edit;
}
function init(slug,input){
 const dir=project(slug);const assets=path.join(root,'public','projects',slug);
 if(fs.existsSync(dir)||fs.existsSync(assets))throw new Error(`Project ${slug} already exists; choose another name.`);
 if(!input||!fs.existsSync(input)||!fs.statSync(input).isFile())throw new Error('Input file is missing. Use --input /path/to/video.mp4');
 const duration=probe(path.resolve(input));
 const ext=path.extname(input).toLowerCase();if(!['.mp4','.mov','.m4v','.webm'].includes(ext))throw new Error('Use MP4, MOV, M4V or WebM input.');
 const source=`projects/${slug}/input${ext}`;
 const end=Math.floor(duration*30)/30;if(end<=0)throw new Error('Input is shorter than one frame.');
 const edit={title:slug.split('-').join(' '),source,clips:[{start:0,end}],captions:[],cards:[],sfx:[]};
 fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(path.resolve(input),path.join(root,'public',source));
 fs.writeFileSync(path.join(dir,'edit.json'),JSON.stringify(edit,null,2)+'\n');
 console.log(`Created projects/${slug}/edit.json. Edit it, then run npm run validate -- ${slug}`);
 return edit;
}
function render(slug,draft=false){
 const edit=load(slug);const props=path.join(project(slug),'.render-props.json');
 fs.writeFileSync(props,JSON.stringify({edit}));fs.mkdirSync(path.join(root,'output'),{recursive:true});
 const cli=path.join(root,'node_modules','@remotion','cli','remotion-cli.js');
 const output=draft?`output/drafts/${slug}.mp4`:`output/${slug}.mp4`;
 fs.mkdirSync(path.dirname(path.join(root,output)),{recursive:true});
 const quality=draft?['--crf','28','--scale','0.5']:['--crf','20'];
 execute(process.execPath,[cli,'render','src/index.ts','BennettsEditor',output,'--props',props,'--codec','h264',...quality,'--concurrency','2'],{stdio:'inherit'});
 console.log(`Exported ${output}`);
}
function captions(slug,args){
 if(args[0]!=='--srt'||!args[1]||args.length>3||(args[2]!==undefined&&args[2]!=='--apply'))throw new Error('Usage: npm run captions -- <slug> --srt /path/to/source.srt [--apply]');
 const edit=load(slug,true);
 const filename=path.resolve(args[1]);
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())throw new Error('SRT file is missing. Use --srt /path/to/source.srt');
 const sourceCues=parseSrt(fs.readFileSync(filename,'utf8'));
 const mapped=mapCaptions(sourceCues,edit.clips);
 const proposed=validateEdit({...edit,captions:mapped});
 const proposalFile=path.join(project(slug),'captions.proposed.json');
 fs.writeFileSync(proposalFile,JSON.stringify(mapped,null,2)+'\n');
 console.log(`Wrote ${mapped.length} output-clock caption segments to projects/${slug}/captions.proposed.json.`);
 console.log('Cues spanning a cut repeat their full phrase in each retained segment. Review text and timing; this is not word alignment.');
 if(args[2]==='--apply'){
  fs.writeFileSync(path.join(project(slug),'edit.json'),JSON.stringify(proposed,null,2)+'\n');
  console.log('Applied captions to edit.json. Existing clips, cards, music and SFX were preserved.');
 }else console.log('edit.json was not changed. Add --apply to replace its captions after review.');
}
function demo(){
 const slug='demo';if(fs.existsSync(project(slug))||fs.existsSync(path.join(root,'public/projects/demo')))throw new Error('Demo already exists. Run npm run render -- demo to render it again.');
 const temp=path.join(root,'.demo-input.mp4');
 try {
  execute('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=540x960:rate=30','-f','lavfi','-i','sine=frequency=330:sample_rate=48000','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-af','volume=0.08','-y',temp]);
  const edit=init(slug,temp);
  edit.sfx=[{src:'sfx/click.ogg',start:0.2,volume:0.2},{src:'sfx/whoosh-1.wav',start:1.5,volume:0.15}];edit.title="Bennett’s AI Editor";edit.clips=[{start:0,end:1.5},{start:2,end:4}];edit.cards=[{start:0,end:1.5,text:'One idea. One clean edit.'}];edit.captions=[{start:1.5,end:2.5,text:'KEEP IT SIMPLE'},{start:2.5,end:3.5,text:'MAKE YOUR FIRST VIDEO'}];
  fs.writeFileSync(path.join(project(slug),'edit.json'),JSON.stringify(edit,null,2)+'\n');render(slug);
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
try{
 const [command,slug,...args]=process.argv.slice(2);
 if(command==='init')init(slug,args[0]==='--input'?args[1]:undefined);
 else if(command==='validate'){const edit=load(slug);console.log(`Valid: ${durationFrames(edit)} frames, ${(durationFrames(edit)/30).toFixed(2)} seconds, 1080×1920 at 30fps.`);}
 else if(command==='render')render(slug);
 else if(command==='draft')render(slug,true);
 else if(command==='captions')captions(slug,args);
 else if(command==='demo')demo();
 else throw new Error('Usage: npm run init -- <slug> --input <video> | npm run validate -- <slug> | npm run render -- <slug> | npm run draft -- <slug> | npm run captions -- <slug> --srt <file> [--apply] | npm run demo');
}catch(error){console.error(`Editor: ${error.message}`);process.exitCode=1;}
