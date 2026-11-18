// Filesystem-backed dialogue revisions. Source seconds are sampled on the OUTPUT frame clock;
// a rate override does not turn those indexes into native decoded-source frame numbers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {safeSlug,mediaPath,validateEdit,durationFrames} from './edit.mjs';
import {getFormat,frameAt} from './format.mjs';
import {parseTranscript} from './transcript.mjs';
import {captionsFromWords,mapWords} from './captions.mjs';
import {clipsWithin} from './cuts.mjs';
const HUMAN_GATES=['takeSelection','cutCoverage','listening'];
const DEPENDENTS=['words.output.json','captions.proposed.json','.render-props.json'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const encode=value=>JSON.stringify(value,null,2)+'\n';
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function fileSha256(file){
 const digest=crypto.createHash('sha256'),buffer=Buffer.alloc(1024*1024),fd=fs.openSync(file,'r');
 try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)digest.update(buffer.subarray(0,n));}finally{fs.closeSync(fd);}
 return digest.digest('hex');
}
function paths(root,slug){safeSlug(slug);const project=path.join(root,'projects',slug);return {project,dialogue:path.join(project,'dialogue'),transcript:path.join(project,'transcript.json'),edit:path.join(project,'edit.json')};}
function atomicWrite(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});const temp=`${file}.${crypto.randomUUID()}.tmp`;
 try{fs.writeFileSync(temp,typeof value==='string'||Buffer.isBuffer(value)?value:encode(value));fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}
}
function clipsKey(edit){const {fps}=getFormat(edit);return edit.clips.map(({start,end,...rest})=>({startFrame:frameAt(start,fps),endFrame:frameAt(end,fps),...rest}));}
function clockKey(edit){return hash({fps:getFormat(edit).fpsRatio,clips:clipsKey(edit).map(({startFrame,endFrame})=>({startFrame,endFrame}))});}
function identity(root,slug,edit){
 const {transcript}=paths(root,slug);
 return {source:edit.source,sourceSha256:fileSha256(mediaPath(root,edit.source)),transcriptSha256:fs.existsSync(transcript)?fileSha256(transcript):null,baseClipsSha256:hash(clipsKey(edit)),fps:getFormat(edit).fpsRatio};
}
function parseSourceWords(bytes){const t=JSON.parse(bytes.toString('utf8'));if(t.clock&&t.clock!=='source')throw new Error('transcript.json must use the source clock.');return parseTranscript(t);}
function sourceWords(root,slug){const file=paths(root,slug).transcript;if(!fs.existsSync(file))throw new Error(`No transcript. Run npm run transcribe -- ${slug} first.`);return parseSourceWords(fs.readFileSync(file));}
function pointerSha(root,slug){const file=path.join(paths(root,slug).dialogue,'current.json');return fs.existsSync(file)?fileSha256(file):null;}
function captureRevisionInputs(root,slug,edit){
 const p=paths(root,slug),transcriptBytes=fs.readFileSync(p.transcript),inputIdentity=identity(root,slug,edit);
 const inputs={identity:inputIdentity,editSha256:hash(edit),transcriptBytes,words:parseSourceWords(transcriptBytes),pointerSha256:pointerSha(root,slug)};
 if(crypto.createHash('sha256').update(transcriptBytes).digest('hex')!==inputIdentity.transcriptSha256)throw new Error('Transcript changed while reading dialogue inputs. Retry after reviewing the change.');
 assertRevisionInputs(root,slug,edit,inputs);return inputs;
}
function assertRevisionInputs(root,slug,edit,inputs){
 if(hash(identity(root,slug,edit))!==hash(inputs.identity)||hash(read(paths(root,slug).edit))!==inputs.editSha256||pointerSha(root,slug)!==inputs.pointerSha256)throw new Error('Dialogue inputs or working edit changed during the transaction. Review the concurrent change and retry; no new revision can be published.');
}

function currentRevision(root,slug){
 const {dialogue}=paths(root,slug),pointer=path.join(dialogue,'current.json');
 if(!fs.existsSync(pointer))return null;
 const current=read(pointer);if(!/^v\d{3,}$/.test(current.revision))throw new Error('Invalid dialogue revision pointer.');
 const dir=path.join(dialogue,current.revision),receipt=read(path.join(dir,'receipt.json'));
 if(receipt.revision!==current.revision||hash(receipt)!==current.receiptSha256)throw new Error('Dialogue revision receipt changed or is incomplete.');
 for(const [file,expected] of Object.entries(receipt.files))if(path.basename(file)!==file||fileSha256(path.join(dir,file))!==expected)throw new Error(`Dialogue snapshot changed: ${file}`);
 return {current,dir,receipt};
}
function revisionStatus(root,slug,edit){
 try{
  const {dialogue}=paths(root,slug);
  if(fs.existsSync(path.join(dialogue,'.lock')))return {revision:null,integrity:'stale',issues:['Dialogue transaction is locked or interrupted; inspect dialogue/.lock and revision files before removing the lock.'],gates:null};
  const revision=currentRevision(root,slug);if(!revision)return {revision:null,integrity:'legacy',issues:[],gates:null};
  const actual=identity(root,slug,edit),issues=[];
  for(const key of Object.keys(actual))if(actual[key]!==revision.receipt.identity[key])issues.push(`${key} changed`);
  const reviewFile=path.join(revision.dir,'review.json'),review=read(reviewFile),gates=review?.gates;
  const gateNames=['technical',...HUMAN_GATES],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(!object(gates)||gateNames.some(name=>!object(gates[name])||!['pending','pass','fail'].includes(gates[name].state))||Object.keys(gates).some(name=>!gateNames.includes(name)))throw new Error(`Malformed saved review gates in ${path.relative(root,reviewFile)}. Preserve the file and restore valid review evidence from reviews/ or a backup before retrying; each gate needs state pending, pass or fail.`);
  return {revision:revision.current.revision,integrity:issues.length?'stale':'current',issues,gates};
 }catch(error){return {revision:null,integrity:'stale',issues:[error.message],gates:null};}
}
export function dialogueStatus(root,slug,edit){
 const status=revisionStatus(root,slug,edit),gate=status.gates?.listening;
 if(gate&&gate.state!=='pending'){
  const issues=dependencyIssues(root,slug,edit,gate.media??{},new Set());
  if(!gate.media?.receiptSha256)issues.push('Listening evidence has no captured render receipt; review the current file again.');
  if(issues.length)status.gates={...status.gates,listening:{...gate,state:'pending',recordedState:gate.state,issues}};
 }
 return status;
}
export function assertDialogueIntegrity(root,slug,edit){
 const status=dialogueStatus(root,slug,edit);
 if(status.integrity==='stale')throw new Error(`Stale dialogue dependencies: ${status.issues.join('; ')}. Review the changes, then run npm run dialogue -- ${slug} --snapshot [--clear-overlays] to adopt the current timeline/transcript. Restore changed source media if unintended.`);
 return status;
}
export function dialogueOutput(root,slug,edit){
 assertDialogueIntegrity(root,slug,edit);const current=currentRevision(root,slug);
 if(current)return {...read(path.join(current.dir,'transcript.output.json')),identity:current.receipt.identity};
 return {clock:'output',fps:getFormat(edit).fpsRatio,words:mapWords(sourceWords(root,slug),edit.clips,getFormat(edit).fps),identity:identity(root,slug,edit),revision:null};
}
export function createProposal(root,slug,edit,result,sourceDuration){
 assertDialogueIntegrity(root,slug,edit);sourceWords(root,slug);
 return {...result,schemaVersion:1,kind:'dialogue-cut-plan',identity:identity(root,slug,edit),sourceDuration,clips:clipsWithin(edit.clips,result.clips,getFormat(edit).fps),partialWordExceptions:[]};
}
function validateRanges(edit,clips,words,sourceDuration,exceptions=[],baseClips=null){
 const {fps}=getFormat(edit),lastFrame=Math.floor(sourceDuration*fps+1e-6);
 if(!Number.isFinite(sourceDuration)||lastFrame<1)throw new Error('A probed positive sourceDuration is required.');
 if(!Array.isArray(clips)||!clips.length)throw new Error('Plan needs at least one retained clip.');
 if(!Array.isArray(exceptions))throw new Error('partialWordExceptions must be an array.');
 for(const exception of exceptions){
  const clip=clips[exception?.clipIndex],word=words[exception?.wordIndex];
  if(!exception||!Number.isInteger(exception.clipIndex)||!Number.isInteger(exception.wordIndex)||!clip||!word||exception.sourceStartFrame!==frameAt(clip.start,fps)||exception.sourceEndFrame!==frameAt(clip.end,fps)||typeof exception.reason!=='string'||!exception.reason.trim()||typeof exception.reviewer!=='string'||!exception.reviewer.trim())throw new Error('Each partial-word exception needs a valid clipIndex, wordIndex, exact sourceStartFrame/sourceEndFrame, reviewer and reason.');
 }

 let endFrame=0;
 return clips.map((clip,index)=>{
  const a=frameAt(clip?.start,fps),b=frameAt(clip?.end,fps);
  if(!Number.isFinite(clip?.start)||!Number.isFinite(clip?.end)||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<endFrame||b<=a||b>lastFrame||Math.abs(clip.start*fps-a)>1e-5||Math.abs(clip.end*fps-b)>1e-5)throw new Error(`Clip ${index}: ranges must be positive, chronological, nonoverlapping, on whole frames and inside the source.`);
  endFrame=b;
  const owner=baseClips?.find(c=>a>=frameAt(c.start,fps)&&b<=frameAt(c.end,fps));
  if(baseClips&&!owner)throw new Error(`Clip ${index} crosses a base clip boundary or restores a removed take. Select a range inside one base clip.`);
  words.forEach((word,wordIndex)=>{
   const start=frameAt(word.start,fps),end=Math.max(start+1,frameAt(word.end,fps));
   if(start<b&&end>a&&(start<a||end>b)){
    const exception=exceptions.find(e=>e?.clipIndex===index&&e.wordIndex===wordIndex&&typeof e.reason==='string'&&e.reason.trim()&&typeof e.reviewer==='string'&&e.reviewer.trim());
    if(!exception)throw new Error(`Partial word cut at clip ${index}, word ${wordIndex} (${word.text}). Preserve the whole word or record partialWordExceptions with clipIndex, wordIndex, sourceStartFrame, sourceEndFrame, reviewer and reason.`);
   }
  });
  const {start,end,...framing}=owner??clip;return {start:clip.start,end:clip.end,...framing};
 });
}
function manifestFor(edit,words,nativeFps){
 const {fps,fpsRatio}=getFormat(edit);let offset=0;const output=[];
 const clips=edit.clips.map((clip,clipIndex)=>{
  const a=frameAt(clip.start,fps),b=frameAt(clip.end,fps),mapping={sourceStartFrame:a,sourceEndFrame:b,outputStartFrame:offset,outputEndFrame:offset+b-a};
  words.forEach((word,sourceWordIndex)=>{
   const s=frameAt(word.start,fps),e=Math.max(s+1,frameAt(word.end,fps)),start=Math.max(a,s),end=Math.min(b,e);
   if(end>start)output.push({text:word.text,start:(offset+start-a)/fps,end:(offset+end-a)/fps,sourceWordIndex,clipIndex,...(s<a||e>b?{partial:true}:{})});
  });
  offset+=b-a;return mapping;
 });
 return {manifest:{frameClock:'source-time-at-output-fps',fps:fpsRatio,nativeSourceFps:nativeFps??null,totalFrames:offset,clips},output:{clock:'output',fps:fpsRatio,words:output}};
}
function hasOverlays(edit){return ['cards','visuals','sfx'].some(key=>edit[key]?.length);}
function buildNext(edit,clips,words,invalidates,options){
 if(invalidates&&hasOverlays(edit)&&!options.clearOverlays)throw new Error('Changed dialogue timing invalidates cards, visuals and SFX even when still in bounds. Add --clear-overlays to archive and clear them, then rebuild on the new output clock.');
 if(edit.captionStyle!=='word'&&edit.captions?.length&&!options.replaceCaptions)throw new Error('This project has phrase captions. Add --replace-captions to rebuild word captions after reviewing the transcript.');
 const next={...edit,clips,captionStyle:'word',...(invalidates&&options.clearOverlays?{cards:[],visuals:[],sfx:[]}: {})};
 const mapped=manifestFor(next,words);next.captions=captionsFromWords(mapped.output.words,durationFrames(next)/getFormat(next).fps,{fps:getFormat(next).fps});return validateEdit(next);
}
function commitRevision(root,slug,before,next,plan,kind,inputs){
 const p=paths(root,slug);fs.mkdirSync(p.dialogue,{recursive:true});
 const lock=path.join(p.dialogue,'.lock');let lockFd;
 try{lockFd=fs.openSync(lock,'wx');}catch{throw new Error('Dialogue transaction already locked; inspect dialogue/.lock before retrying.');}
 fs.writeFileSync(lockFd,encode({pid:process.pid,startedAt:new Date().toISOString()}));
 let dir,temp,keepLock=false;const backups=new Map();
 const preserve=file=>{if(!backups.has(file))backups.set(file,fs.existsSync(file)?fs.readFileSync(file):null);};
 try{
  assertRevisionInputs(root,slug,before,inputs);
  const previous=currentRevision(root,slug);
  const nums=fs.readdirSync(p.dialogue).filter(x=>/^v\d{3,}$/.test(x)).map(x=>Number(x.slice(1)));
  const revision=`v${String(Math.max(0,...nums)+1).padStart(3,'0')}`;dir=path.join(p.dialogue,revision);temp=path.join(p.dialogue,`.${revision}-${crypto.randomUUID()}`);fs.mkdirSync(temp);
  const nativeFile=path.join(p.project,'source.probe.json'),nativeFps=fs.existsSync(nativeFile)?read(nativeFile).video?.fpsRatio:null;
  const {manifest,output}=manifestFor(next,inputs.words,nativeFps);output.revision=revision;
  const snapshot={'edit.before.json':before,'edit.after.json':next,'plan.json':plan,'manifest.json':manifest,'transcript.output.json':output};
  for(const [name,value] of Object.entries(snapshot))fs.writeFileSync(path.join(temp,name),encode(value));
  fs.writeFileSync(path.join(temp,'transcript.source.json'),inputs.transcriptBytes);
  const archive=path.join(temp,'archive');fs.mkdirSync(archive);
  for(const name of DEPENDENTS){const file=path.join(p.project,name);if(fs.existsSync(file))fs.copyFileSync(file,path.join(archive,name));}
  if(previous)for(const name of ['edit.after.json','transcript.source.json','review.json'])fs.copyFileSync(path.join(previous.dir,name),path.join(archive,`previous.${name}`));
  for(const suffix of [slug,`${slug}-draft`]){const reviewDir=path.join(root,'output/review',suffix);if(fs.existsSync(reviewDir))fs.cpSync(reviewDir,path.join(archive,'review',suffix),{recursive:true});}
  for(const relative of [`output/${slug}.mp4.receipt.json`,`output/drafts/${slug}.mp4.receipt.json`]){const file=path.join(root,relative);if(fs.existsSync(file))fs.copyFileSync(file,path.join(archive,relative.includes('drafts')?'draft.receipt.json':'final.receipt.json'));}
  const gates={technical:{state:'pass',evidence:'Validated identity, whole-frame ranges, full-word preservation or explicit exceptions, contiguous frame mapping and edit schema.'},...Object.fromEntries(HUMAN_GATES.map(k=>[k,{state:'pending',evidence:null}]))};
  fs.writeFileSync(path.join(temp,'review.json'),encode({revision,gates}));
  const files=Object.fromEntries([...Object.keys(snapshot),'transcript.source.json'].map(name=>[name,fileSha256(path.join(temp,name))]));
  const receipt={schemaVersion:1,revision,kind,createdAt:new Date().toISOString(),previousRevision:previous?.current.revision??null,identity:{...inputs.identity,baseClipsSha256:hash(clipsKey(next)),fps:getFormat(next).fpsRatio},files};
  fs.writeFileSync(path.join(temp,'receipt.json'),encode(receipt));
  // Publish a complete snapshot first, then atomically replace each working file and the pointer last.
  // A killed process leaves the lock: integrity checks fail closed until the transaction is inspected.
  assertRevisionInputs(root,slug,before,inputs);
  fs.renameSync(temp,dir);temp=null;
  for(const file of [p.edit,...DEPENDENTS.map(name=>path.join(p.project,name)),path.join(p.dialogue,'current.json')])preserve(file);
  atomicWrite(p.edit,next);for(const name of DEPENDENTS)fs.rmSync(path.join(p.project,name),{force:true});
  atomicWrite(path.join(p.project,'words.output.json'),{...output,identity:receipt.identity});
  assertRevisionInputs(root,slug,next,{...inputs,identity:receipt.identity,editSha256:hash(next)});
  atomicWrite(path.join(p.dialogue,'current.json'),{revision,receiptSha256:hash(receipt)});
  return next;
 }catch(error){
  try{
   for(const [file,bytes] of backups){if(bytes===null)fs.rmSync(file,{force:true});else if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))atomicWrite(file,bytes);}
   if(dir)fs.rmSync(dir,{recursive:true,force:true});
  }catch(recoveryError){keepLock=true;throw new Error(`Dialogue rollback interrupted: ${recoveryError.message}. Keep dialogue/.lock until edit.json, words.output.json and current.json are restored from the complete revision snapshots. Original error: ${error.message}`);}
  throw error;
 }finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});fs.closeSync(lockFd);if(!keepLock)fs.rmSync(lock,{force:true});}
}
export function applyProposal(root,slug,edit,plan,options={}){
 assertDialogueIntegrity(root,slug,edit);
 if(plan?.schemaVersion!==1||plan.kind!=='dialogue-cut-plan'||!plan.identity)throw new Error('Anonymous or legacy cut plan: generate a new identity-bound proposal with npm run cut.');
 const inputs=captureRevisionInputs(root,slug,edit),actual=inputs.identity;for(const key of Object.keys(actual))if(actual[key]!==plan.identity[key])throw new Error(`Cut plan ${key} does not match current project. Generate and review a new proposal.`);
 const words=inputs.words,clips=validateRanges(edit,plan.clips,words,options.sourceDuration,plan.partialWordExceptions,edit.clips);
 const next=buildNext(edit,clips,words,clockKey(edit)!==clockKey({...edit,clips}),options);
 return commitRevision(root,slug,edit,next,plan,'cut',inputs);
}
export function snapshotDialogue(root,slug,edit,options={}){
 const inputs=captureRevisionInputs(root,slug,edit),previous=currentRevision(root,slug),words=inputs.words;
 const clips=validateRanges(edit,edit.clips,words,options.sourceDuration,options.partialWordExceptions??[]);
 const currentIdentity=inputs.identity,prior=previous?.receipt.identity;
 if(prior&&(prior.source!==currentIdentity.source||prior.sourceSha256!==currentIdentity.sourceSha256))throw new Error('Source media changed. Restore the original source, or import the replacement as a new project; --snapshot adopts only timeline/transcript changes.');
 const invalidates=previous?(clockKey(read(path.join(previous.dir,'edit.after.json')))!==clockKey(edit)||prior.sourceSha256!==currentIdentity.sourceSha256||prior.transcriptSha256!==currentIdentity.transcriptSha256):true;
 const next=buildNext(edit,clips,words,invalidates,options);
 return commitRevision(root,slug,edit,next,{kind:'manual-snapshot',partialWordExceptions:options.partialWordExceptions??[]},'snapshot',inputs);
}
export function recordDialogueReview(root,slug,edit,input){
 const status=assertDialogueIntegrity(root,slug,edit);if(!status.revision)throw new Error('Create a dialogue revision before recording review evidence.');
 if(input?.revision!==status.revision)throw new Error('Review revision must match the current dialogue revision.');
 if(typeof input.reviewer!=='string'||!input.reviewer.trim()||typeof input.reviewedAt!=='string'||!Number.isFinite(Date.parse(input.reviewedAt)))throw new Error('Review needs reviewer and reviewedAt (ISO timestamp).');
 if(!input.gates||!Object.keys(input.gates).length||Object.keys(input.gates).some(k=>!HUMAN_GATES.includes(k)))throw new Error('Review gates must name takeSelection, cutCoverage or listening; technical integrity is computed separately.');
 const current=currentRevision(root,slug),review=read(path.join(current.dir,'review.json'));
 for(const [name,gate] of Object.entries(input.gates)){
  if(!gate||!['pending','pass','fail'].includes(gate.state)||(gate.state!=='pending'&&(typeof gate.evidence!=='string'||!gate.evidence.trim())))throw new Error(`${name}: pass/fail requires recorded evidence.`);
  if(name==='listening'&&gate.state!=='pending'){
   if(!gate.media||typeof gate.media.path!=='string'||!gate.media.sha256||fileSha256(path.resolve(root,gate.media.path))!==gate.media.sha256)throw new Error('Listening evidence needs media.path and matching media.sha256 for the file actually heard.');
   if(artifactStatus(root,slug,edit,path.resolve(root,gate.media.path)).state!=='current')throw new Error('Listening evidence must reference a current rendered file with its matching receipt; old or unverified renders cannot certify this revision.');
  }
  review.gates[name]={...gate,...(name==='listening'&&gate.state!=='pending'?{media:{...gate.media,receiptSha256:fileSha256(`${path.resolve(root,gate.media.path)}.receipt.json`)}}:{}),reviewer:input.reviewer,reviewedAt:input.reviewedAt};
 }
 const history=path.join(current.dir,'reviews');fs.mkdirSync(history,{recursive:true});
 const name=`${Date.now()}-${crypto.randomUUID()}.json`;atomicWrite(path.join(history,name),input);atomicWrite(path.join(current.dir,'review.json'),review);return review;
}
export function artifactIdentity(root,slug,edit){return {...identity(root,slug,edit),editSha256:hash(edit),revision:currentRevision(root,slug)?.current.revision??null};}
export function writeArtifactReceipt(root,slug,edit,file,{expectedIdentity,dependencies=[]}={}){
 assertDialogueIntegrity(root,slug,edit);const currentIdentity=artifactIdentity(root,slug,edit);
 if((expectedIdentity&&hash(expectedIdentity)!==hash(currentIdentity))||hash(read(paths(root,slug).edit))!==hash(edit))throw new Error('Project dependencies changed during the render/review. Re-run it against the current project before recording a receipt.');
 const receipt={schemaVersion:1,createdAt:new Date().toISOString(),identity:currentIdentity,outputSha256:fileSha256(file),dependencies};
 const issues=dependencies.flatMap(dependency=>dependencyIssues(root,slug,edit,dependency,new Set([path.resolve(file)])));
 if(issues.length)throw new Error(`Reviewed artifact dependency changed: ${issues.join('; ')}`);
 atomicWrite(`${file}.receipt.json`,receipt);return receipt;
}
function artifactState(root,slug,edit,file,seen){
 const absolute=path.resolve(file);if(seen.has(absolute))return {state:'stale',issues:['Artifact receipt dependency cycle.']};seen=new Set([...seen,absolute]);
 if(!fs.existsSync(file))return {state:'missing',issues:[]};
 if(!fs.existsSync(`${file}.receipt.json`))return {state:'unverified',issues:['No render receipt for existing file.']};
 try{
  const receipt=read(`${file}.receipt.json`),status=revisionStatus(root,slug,edit),issues=[...status.issues];
  if(hash(receipt.identity)!==hash(artifactIdentity(root,slug,edit)))issues.push('Render dependencies changed.');
  if(receipt.outputSha256!==fileSha256(file))issues.push('Output file bytes changed.');
  for(const dependency of receipt.dependencies??[])issues.push(...dependencyIssues(root,slug,edit,dependency,seen));
  return {state:issues.length?'stale':'current',issues,createdAt:receipt.createdAt};
 }catch(error){return {state:'stale',issues:[error.message]};}
}

function dependencyIssues(root,slug,edit,dependency,seen){
 try{
  if(typeof dependency.path!=='string'||!dependency.sha256)throw new Error('Artifact dependency needs path and sha256.');
  const file=path.resolve(root,dependency.path),issues=[];
  if(fileSha256(file)!==dependency.sha256)issues.push(`Reviewed media bytes changed: ${dependency.path}`);
  const receiptHash=fs.existsSync(`${file}.receipt.json`)?fileSha256(`${file}.receipt.json`):null;
  if(receiptHash!==dependency.receiptSha256)issues.push(`Reviewed media receipt changed: ${dependency.path}`);
  if(receiptHash){const state=artifactState(root,slug,edit,file,seen);if(state.state!=='current')issues.push(`Reviewed media is ${state.state}: ${state.issues.join('; ')}`);}
  return issues;
 }catch(error){return [error.message];}
}
export function artifactStatus(root,slug,edit,file){return artifactState(root,slug,edit,file,new Set());}
export function captureArtifactDependency(root,slug,edit,file){
 const status=artifactStatus(root,slug,edit,file);if(!['current','unverified'].includes(status.state))throw new Error(`Cannot capture ${status.state} reviewed artifact: ${status.issues.join('; ')}`);
 const dependency={path:path.relative(root,file),sha256:fileSha256(file),receiptSha256:fs.existsSync(`${file}.receipt.json`)?fileSha256(`${file}.receipt.json`):null};
 const issues=dependencyIssues(root,slug,edit,dependency,new Set());if(issues.length)throw new Error(`Reviewed artifact changed while capturing: ${issues.join('; ')}`);return dependency;
}
