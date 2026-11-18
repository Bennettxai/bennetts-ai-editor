import fs from 'node:fs';
import path from 'node:path';
import {safeSlug,validateEdit,mediaPath} from '../src/edit.mjs';
import {parseTranscript} from '../src/transcript.mjs';
import {dialogueStatus,artifactStatus} from '../src/dialogue.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const fileExists=file=>{try{return fs.statSync(file).isFile();}catch{return false;}};
export function projectStatus(root,slug){
 safeSlug(slug);
 const dir=path.join(root,'projects',slug),editFile=path.join(dir,'edit.json'),transcript=path.join(dir,'transcript.json');
 const result={schemaVersion:1,project:slug,ok:true,import:{state:'missing',issues:[]},transcript:{state:'missing',issues:[]},dialogue:{revision:null,integrity:'legacy',issues:[],gates:null},artifacts:{},issues:[],nextSteps:[]};
 let edit;
 try{
  if(!fileExists(editFile))throw new Error(`Project edit is missing: ${editFile}. Run npm run init -- ${slug} --input <video>.`);
  edit=validateEdit(read(editFile));const source=mediaPath(root,edit.source);
  result.import={state:fileExists(source)?'ready':'missing',source:edit.source,issues:fileExists(source)?[]:[`Source is missing: ${source}. Restore the imported media.`]};
 }catch(error){result.import={state:fileExists(editFile)?'invalid':'missing',issues:[error.message]};}
 if(fileExists(transcript)){
  try{const data=read(transcript);if(data.clock&&data.clock!=='source')throw new Error('transcript.json must use the source clock.');const words=parseTranscript(data);result.transcript={state:'available',wordCount:words.length,engine:data.engine??null,issues:[]};}
  catch(error){result.transcript={state:'invalid',issues:[`${error.message} Correct transcript.json or import a valid word-level transcript.`]};}
 }
 if(edit)result.dialogue=dialogueStatus(root,slug,edit);
 for(const [name,relative] of Object.entries({draft:`output/drafts/${slug}.mp4`,final:`output/${slug}.mp4`,draftReview:`output/review/${slug}-draft/report.json`,finalReview:`output/review/${slug}/report.json`})){
  const file=path.join(root,relative);let artifact=edit?artifactStatus(root,slug,edit,file):{state:fs.existsSync(file)?'unverified':'missing',issues:fs.existsSync(file)?['Cannot verify without a valid edit.']:[]};
  if(name.endsWith('Review')&&artifact.state==='current'){
   try{const report=read(file);if(!Array.isArray(report.checks)||!report.checks.length||report.checks.some(c=>typeof c.name!=='string'||typeof c.pass!=='boolean'))throw new Error('Technical report checks are missing or malformed. Run review again.');artifact.technicalChecks={passed:report.checks.filter(c=>c.pass).length,total:report.checks.length,failed:report.checks.filter(c=>!c.pass).map(c=>c.name)};}
   catch(error){artifact={state:'stale',issues:[error.message]};}
  }
  result.artifacts[name]={path:relative,...artifact};
 }
 result.issues=[...result.import.issues,...result.transcript.issues,...result.dialogue.issues,...Object.values(result.artifacts).flatMap(a=>a.issues)];
 result.ok=result.import.state==='ready'&&result.transcript.state!=='invalid'&&result.dialogue.integrity!=='stale'&&!Object.values(result.artifacts).some(a=>a.state==='stale');
 if(!edit)result.nextSteps.push(`Restore a valid projects/${slug}/edit.json, or run npm run init -- ${slug} --input <video> for a new project.`);
 if(result.import.issues.length)result.nextSteps.push(...result.import.issues);
 if(result.transcript.state!=='available')result.nextSteps.push(`npm run transcribe -- ${slug} [--json <transcript.json>]`);
 if(result.dialogue.integrity==='stale')result.nextSteps.push(`Inspect the reported dialogue issues. Restore unintended changes; for intended timeline/transcript changes use npm run dialogue -- ${slug} --snapshot [--clear-overlays]. Never remove an active transaction lock.`);
 for(const [name,command] of [['draft','draft'],['final','render']])if(result.artifacts[name].state!=='current')result.nextSteps.push(`npm run ${command} -- ${slug} (creates a current ${name} receipt)`);
 for(const [name,flag] of [['draftReview',' --draft'],['finalReview','']])if(result.artifacts[name].state!=='current')result.nextSteps.push(`npm run review -- ${slug}${flag} after rendering the current media`);
 const pending=Object.entries(result.dialogue.gates??{}).filter(([,g])=>g.state!=='pass').map(([name])=>name);
 if(!result.dialogue.gates||pending.length)result.nextSteps.push(`Human review is pending${pending.length?`: ${pending.join(', ')}`:''}. Technical reports do not certify take selection, cut coverage or listening.`);
 return result;
}
export function formatStatus(s){
 return [`Project: ${s.project}`,`Import: ${s.import.state}`,`Transcript: ${s.transcript.state}${s.transcript.wordCount?` (${s.transcript.wordCount} words)`:''}`,`Dialogue: ${s.dialogue.revision??'unversioned'}; ${s.dialogue.integrity}`,...Object.entries(s.dialogue.gates??{}).map(([name,g])=>`${name}: ${g.state}${g.recordedState?` (previously recorded ${g.recordedState})`:''}`),...Object.entries(s.artifacts).map(([name,a])=>`${name}: ${a.state}${a.technicalChecks?`; technical checks ${a.technicalChecks.passed}/${a.technicalChecks.total}`:''}`),...s.issues.map(x=>`Issue: ${x}`),...s.nextSteps].join('\n');
}
