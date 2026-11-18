import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),cli=path.join(root,'scripts/editor.mjs');
let diagnostics;
try{diagnostics=await import('../scripts/doctor.mjs');}catch{}
const requireApi=()=>assert.equal(typeof diagnostics?.diagnose,'function','doctor must expose dependency diagnostics');
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-doctor-'));return {dir,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}

test('doctor reports missing required commands and Node below 22 with remedies',()=>{
 requireApi();const f=fixture();try{
  const result=diagnostics.diagnose({root:f.dir,nodeVersion:'20.19.0',env:{PATH:f.dir},home:f.dir});
  assert.equal(result.ok,false);for(const name of ['node','ffmpeg','ffprobe','remotion']){assert.equal(result.checks[name].state,'unavailable');assert.ok(result.checks[name].remedy.length>10,name);}
  assert.equal(result.workflows.importedTranscript,false);assert.equal(result.workflows.localTranscription,false);
 }finally{f.cleanup();}
});
test('missing optional whisper and models do not block imported-transcript workflows',()=>{
 requireApi();const f=fixture();try{
  for(const bin of ['ffmpeg','ffprobe']){const found=spawnSync('/usr/bin/which',[bin],{encoding:'utf8'}).stdout.trim();fs.symlinkSync(found,path.join(f.dir,bin));}
  fs.symlinkSync(path.join(root,'node_modules'),path.join(f.dir,'node_modules'));
  fs.copyFileSync(path.join(root,'package.json'),path.join(f.dir,'package.json'));
  const result=diagnostics.diagnose({root:f.dir,env:{PATH:f.dir},home:f.dir});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.workflows.importedTranscript,true);assert.equal(result.workflows.localTranscription,false);
  assert.equal(result.checks.whisper.state,'unavailable');assert.equal(result.checks.model.state,'unavailable');
 }finally{f.cleanup();}
});
test('a failing installed executable is unavailable, and doctor CLI returns JSON with exit 1',()=>{
 requireApi();const f=fixture();try{
  fs.writeFileSync(path.join(f.dir,'ffmpeg'),'#!/bin/sh\nexit 42\n',{mode:0o755});
  const result=diagnostics.diagnose({root:f.dir,env:{PATH:f.dir},home:f.dir});assert.equal(result.checks.ffmpeg.state,'unavailable');assert.match(result.checks.ffmpeg.detail,/42/);
  const command=spawnSync(process.execPath,[cli,'doctor','--json'],{cwd:f.dir,env:{...process.env,PATH:f.dir},encoding:'utf8'});
  assert.equal(command.status,1);const parsed=JSON.parse(command.stdout);assert.equal(parsed.schemaVersion,1);assert.equal(parsed.ok,false);assert.equal(parsed.checks.ffprobe.state,'unavailable');
 }finally{f.cleanup();}
});
test('explicit models must be readable files and cannot fall back to a valid discovered model',()=>{
 requireApi();const f=fixture();try{
  fs.mkdirSync(path.join(f.dir,'models'));const valid=path.join(f.dir,'models/ggml-base.en.bin');fs.writeFileSync(valid,'test model');
  assert.equal(diagnostics.findModel(undefined,{root:f.dir,home:f.dir,env:{}}),valid);
  for(const explicit of [path.join(f.dir,'missing.bin'),path.join(f.dir,'models')])assert.throws(()=>diagnostics.findModel(explicit,{root:f.dir,home:f.dir,env:{WHISPER_MODEL:valid}}),/requested model.*file/i);
  const result=diagnostics.diagnose({root:f.dir,home:f.dir,env:{PATH:f.dir},model:path.join(f.dir,'missing.bin')});assert.equal(result.ok,false);assert.match(result.checks.model.detail,/requested model/i);
 }finally{f.cleanup();}
});

test('an unrelated executable named main cannot certify whisper.cpp readiness',()=>{
 requireApi();const f=fixture();try{
  fs.writeFileSync(path.join(f.dir,'main'),'#!/bin/sh\necho "usage: main [application options]"\n',{mode:0o755});
  const result=diagnostics.diagnose({root:f.dir,env:{PATH:f.dir},home:f.dir});assert.equal(result.checks.whisper.state,'unavailable');
 }finally{f.cleanup();}
});
