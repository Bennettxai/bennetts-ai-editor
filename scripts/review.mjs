// Measures a rendered MP4 against the quality bar and writes a contact sheet for a sound-off read.
// It never judges taste; that is the critic's job (see .claude/skills/review-video).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {durationFrames,lintEdit} from '../src/edit.mjs';
import {SAFE,W,H} from '../src/layout.mjs';
import {MASTER} from '../src/audio.mjs';

const num=v=>v==='-inf'?-Infinity:Number(v);
export function parseAnalysis(stderr,duration){
 const text=String(stderr);
 const summary=text.slice(text.lastIndexOf('Summary:'));
 const lufs=/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary);
 const peak=/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary);
 const channels=[...text.matchAll(/RMS level dB: (-?[\d.]+|-inf)/g)].map(m=>num(m[1]));
 const freezes=[];
 for(const m of text.matchAll(/freeze_(start|end): ([\d.]+)/g)){
  if(m[1]==='start')freezes.push({start:Number(m[2]),end:duration});else if(freezes.length)freezes.at(-1).end=Number(m[2]);
 }
 const blacks=[...text.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m=>({start:Number(m[1]),end:Number(m[2])}));
 return {lufs:lufs?num(lufs[1]):null,truePeak:peak?num(peak[1]):null,channels,freezes,blacks};
}

export function evaluate({probe,analysis,expectedFrames,draft}){
 const checks=[];const add=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 const [w,h]=draft?[W/2,H/2]:[W,H];
 add('size',probe.width===w&&probe.height===h,`${probe.width}×${probe.height} (want ${w}×${h})`);
 add('fps',probe.fps==='30/1',`${probe.fps}`);
 add('frames',Math.abs(probe.frames-expectedFrames)<=1,`${probe.frames} frames (edit says ${expectedFrames})`);
 add('audio',probe.audio,probe.audio?'audio stream present':'no audio stream');
 if(!draft){
  add('loudness',analysis.lufs!==null&&Math.abs(analysis.lufs-MASTER.integrated)<=1,`${analysis.lufs} LUFS integrated (want ${MASTER.integrated} ± 1)`);
  add('true peak',analysis.truePeak!==null&&analysis.truePeak<=MASTER.truePeak+0.3,`${analysis.truePeak} dBTP (ceiling ${MASTER.truePeak})`);
 }
 const [l,r]=analysis.channels;
 add('stereo',analysis.channels.length<2||(Number.isFinite(l)&&Number.isFinite(r)&&Math.abs(l-r)<12),analysis.channels.length<2?'mono':`L ${l.toFixed?.(1)} dB / R ${r.toFixed?.(1)} dB RMS`);
 add('first frame',!analysis.blacks.some(b=>b.start<0.05),'frame 1 must be a finished picture, not black');
 const seconds=(probe.frames||1)/30;
 const frozen=analysis.freezes.reduce((s,f)=>s+f.end-f.start,0);
 add('stills',frozen<=Math.max(1,seconds/30),`${frozen.toFixed(2)} s with no movement over 0.5 s stretches${analysis.freezes.length?` at ${analysis.freezes.map(f=>f.start.toFixed(1)+' s').join(', ')}`:''} (allowed 1 s per 30 s)`);
 return checks;
}

function run(command,args){
 const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:256*1024*1024});
 if(r.error||r.status!==0)throw new Error(`${command} failed: ${r.error?.message??r.stderr}`);
 return r;
}

export function review(root,slug,{draft=false,edit}){
 const file=path.join(root,draft?`output/drafts/${slug}.mp4`:`output/${slug}.mp4`);
 if(!fs.existsSync(file))throw new Error(`Nothing to review at ${path.relative(root,file)}. Run npm run ${draft?'draft':'render'} -- ${slug} first.`);
 const dir=path.join(root,'output/review',draft?`${slug}-draft`:slug);fs.mkdirSync(dir,{recursive:true});
 const info=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).stdout);
 const video=info.streams.find(s=>s.codec_type==='video');
 const duration=Number(info.format.duration);
 const probe={width:video.width,height:video.height,fps:video.r_frame_rate,frames:Number(video.nb_frames),audio:info.streams.some(s=>s.codec_type==='audio')};
 const graph=probe.audio
  ?['-filter_complex','[0:a]ebur128=peak=true,astats=measure_overall=none:measure_perchannel=RMS_level[a];[0:v]freezedetect=n=0.003:d=0.5,blackdetect=d=0.1:pix_th=0.10:pic_th=0.999[v]','-map','[v]','-map','[a]']
  :['-vf','freezedetect=n=0.003:d=0.5,blackdetect=d=0.1:pix_th=0.10:pic_th=0.999'];
 const analysis=parseAnalysis(run('ffmpeg',['-hide_banner','-nostats','-i',file,...graph,'-f','null','-']).stderr,duration);
 const checks=evaluate({probe,analysis,expectedFrames:durationFrames(edit),draft});
 // Contact sheet: 2 frames a second, safe zone drawn in red, 8 across.
 const tw=180,th=320,sx=tw/W,sy=th/H;
 const box=`drawbox=x=${Math.round(SAFE.left*sx)}:y=${Math.round(SAFE.top*sy)}:w=${Math.round((SAFE.right-SAFE.left)*sx)}:h=${Math.round((SAFE.bottom-SAFE.top)*sy)}:color=red@0.7:t=1`;
 const rows=Math.max(1,Math.ceil(duration*2/8));
 run('ffmpeg',['-v','error','-y','-i',file,'-vf',`fps=2,scale=${tw}:${th},${box},tile=8x${rows}:padding=4:color=0x222222`,'-frames:v','1','-update','1',path.join(dir,'contact.jpg')]);
 const warnings=lintEdit(edit);
 const report={file:path.relative(root,file),duration,probe,analysis,checks,warnings};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,(k,v)=>v===-Infinity?'-inf':v,2)+'\n');
 const md=[`# Review: ${slug}${draft?' (draft)':''}`,'',`File: \`${report.file}\` · ${duration.toFixed(2)} s`,'','| Check | Result | Detail |','|---|---|---|',
  ...checks.map(c=>`| ${c.name} | ${c.pass?'pass':'**FAIL**'} | ${c.detail} |`),'',
  warnings.length?'## Craft warnings\n\n'+warnings.map(w=>`- ${w}`).join('\n'):'No craft warnings.','',
  '## Still to do by eye and ear','','- Read `contact.jpg` (2 frames a second, left to right, 8 per row) with the sound off: does each panel make sense on its own? Is anything outside the red safe box?',
  '- Watch it full screen at normal speed with headphones: every cut, every caption, music under the voice.','- Then run the critic (see the review-video skill) and fix the worst problem first.'].join('\n');
 fs.writeFileSync(path.join(dir,'report.md'),md+'\n');
 const failed=checks.filter(c=>!c.pass);
 for(const c of checks)console.log(`${c.pass?'  ok  ':'  FAIL'}  ${c.name.padEnd(11)} ${c.detail}`);
 for(const w of warnings)console.log(`  warn  ${w}`);
 console.log(`\n${failed.length?`${failed.length} check(s) failed.`:'All measured checks passed.'} Report: ${path.relative(root,dir)}/report.md, contact sheet: ${path.relative(root,dir)}/contact.jpg`);
 return report;
}
