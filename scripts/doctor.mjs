// Read-only dependency checks. No downloads, model loading, or render is performed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const modelHelp='Download a whisper.cpp ggml model into models/ or ~/.whisper-models/, set WHISPER_MODEL, or pass --model <file>. See docs/TRANSCRIBE.md. You can import a transcript with --json without local ASR.';
function isFile(file){try{fs.accessSync(file,fs.constants.R_OK);return fs.statSync(file).isFile();}catch{return false;}}
export function findModel(explicit,{root=process.cwd(),home=os.homedir(),env=process.env}={}){
 if(explicit!==undefined){const file=path.resolve(root,explicit);if(!isFile(file))throw new Error(`Requested model must be a readable file: ${file}. ${modelHelp}`);return file;}
 if(env.WHISPER_MODEL){const file=path.resolve(root,env.WHISPER_MODEL);if(!isFile(file))throw new Error(`WHISPER_MODEL must be a readable file: ${file}. ${modelHelp}`);return file;}
 for(const dir of [path.join(root,'models'),path.join(home,'.whisper-models')]){
  let found;try{found=fs.readdirSync(dir).filter(f=>/^ggml-.*\.bin$/.test(f)&&isFile(path.join(dir,f))).sort();}catch{continue;}
  const pick=['small.en','base.en','medium.en','small','base','medium','large'].map(n=>found.find(f=>f===`ggml-${n}.bin`)).find(Boolean)??found[0];
  if(pick)return path.join(dir,pick);
 }
 throw new Error(`No whisper.cpp model found. ${modelHelp}`);
}
function command(command,args,{env=process.env,cwd=process.cwd()}={}){
 const result=spawnSync(command,args,{env,cwd,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
 return {ok:!result.error&&result.status===0,output:`${result.stdout??''}\n${result.stderr??''}`,detail:result.error?.message??(result.status!==0?`Exited ${result.status}: ${(result.stderr||result.stdout).trim().slice(0,500)}`:(result.stdout||result.stderr).trim().split('\n')[0]||'Command succeeded.')};
}
export function findWhisper({env=process.env,root=process.cwd()}={}){
 for(const bin of ['whisper-cli','whisper-cpp','main']){
  const result=command(bin,['--help'],{env,cwd:root});
  if(result.ok&&/--output-json-full|\b-ojf\b/.test(result.output)&&/--model/.test(result.output))return bin;
 }
 throw new Error('No usable whisper.cpp executable found. Install whisper.cpp and put whisper-cli on PATH. See docs/TRANSCRIBE.md, or import a transcript with --json.');
}
export function diagnose({root=process.cwd(),nodeVersion=process.versions.node,env=process.env,home=os.homedir(),model}={}){
 const checks={};const check=(name,required,ok,detail,remedy)=>checks[name]={required,state:ok?'ready':'unavailable',detail,...(!ok?{remedy}:{})};
 const nodeParts=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(nodeVersion);
 const nodeReady=nodeParts&&(Number(nodeParts[1])>22||(Number(nodeParts[1])===22&&Number(nodeParts[2])>=12));
 check('node',true,nodeReady,`Node ${nodeVersion}`,'Install Node.js 22.12.0 or newer (stable release), reopen the terminal, then run npm ci.');
 for(const name of ['ffmpeg','ffprobe']){const result=command(name,['-version'],{env,cwd:root});check(name,true,result.ok,result.detail,'Install FFmpeg (including ffprobe) and add its executable directory to PATH.');}
 const cli=path.join(root,'node_modules/@remotion/cli/remotion-cli.js');
 const remotion=isFile(cli)?command(process.execPath,[cli,'versions'],{env,cwd:root}):{ok:false,detail:'Local Remotion CLI is missing.'};
 check('remotion',true,remotion.ok,remotion.ok?'Remotion CLI runs and installed package versions agree. Browser launch is checked by rendering.':remotion.detail,'Run npm ci from the editor directory, then npm run doctor. For a missing render browser, run npx remotion browser ensure.');
 try{check('whisper',false,true,findWhisper({root,env}));}catch(error){check('whisper',false,false,error.message,'Install whisper.cpp, or use npm run transcribe -- <slug> --json <transcript.json>.');}
 try{check('model',false,true,findModel(model,{root,home,env}));checks.model.validation='readable-file-only';}catch(error){check('model',false,false,error.message,modelHelp);}
 const requiredReady=Object.values(checks).filter(c=>c.required).every(c=>c.state==='ready');
 return {schemaVersion:1,ok:requiredReady&&(model===undefined||checks.model.state==='ready'),checks,workflows:{importedTranscript:requiredReady,localTranscription:requiredReady&&checks.whisper.state==='ready'&&checks.model.state==='ready'},notes:['Model readiness verifies a readable file, not model contents. A real transcription validates model compatibility.','Doctor does not launch a render browser. A successful render verifies the browser and graphics runtime.']};
}
export function formatDoctor(result){
 return ['AI Video Editor diagnostics',...Object.entries(result.checks).map(([name,c])=>`${name}: ${c.state}${c.required?'':' (optional)'} — ${c.detail}${c.remedy?`\n  ${c.remedy}`:''}`),`Imported-transcript workflow: ${result.workflows.importedTranscript?'ready':'unavailable'}`,`Local transcription: ${result.workflows.localTranscription?'ready':'unavailable'}`,...result.notes].join('\n');
}
