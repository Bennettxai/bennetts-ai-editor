import fs from 'node:fs';
import path from 'node:path';
export const FPS=30;
export function safeSlug(slug) {
 if(typeof slug!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>70) throw new Error('Project name must use lowercase letters, numbers and single hyphens.');
 return slug;
}
function assetName(value) {
 if(typeof value!=='string'||!value||value.startsWith('/')||value.includes('\\')||value.includes(':')||value.split('/').some(x=>!x||x==='.'||x==='..')) throw new Error('Media must be a relative path inside public/, without traversal or URLs.');
 return value;
}
export function mediaPath(root,relative) {
 assetName(relative);
 const base=path.resolve(root,'public');
 const candidate=path.resolve(base,relative);
 let ancestor=candidate;while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;}
 const resolved=fs.realpathSync(ancestor);
 const realBase=fs.realpathSync(base);
 if(resolved!==realBase&&!resolved.startsWith(realBase+path.sep))throw new Error('Media path escapes public/ through a symlink.');
 return candidate;
}
const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
export function durationFrames(edit) {return edit.clips.reduce((total,c)=>total+Math.round(c.end*FPS)-Math.round(c.start*FPS),0);}
function rows(value,label){if(!Array.isArray(value))throw new Error(`${label} must be an array.`);return value;}
function volume(value,label){if(value!==undefined&&(!finite(value)||value<0||value>1))throw new Error(`${label} volume must be between 0 and 1.`);}
export function validateEdit(edit) {
 if(!edit||typeof edit!=='object')throw new Error('Edit must be a JSON object.');
 assetName(edit.source);
 if(typeof edit.title!=='string'||!edit.title.trim()||edit.title.length>120)throw new Error('Title must contain 1–120 characters.');
 const clips=rows(edit.clips,'clips');if(!clips.length)throw new Error('At least one clip is required.');
 let last=0;
 for(const c of clips){if(!c||!finite(c.start)||!finite(c.end)||c.start<last||c.end<=c.start||Math.round(c.end*FPS)<=Math.round(c.start*FPS))throw new Error('Clip ranges must be finite, positive, chronological and nonoverlapping (at least one frame).');last=c.end;}
 for(const clip of clips){
  if(clip.zoom!==undefined&&(!finite(clip.zoom)||clip.zoom<1||clip.zoom>1.5))throw new Error('Clip zoom must be between 1 and 1.5.');
  for(const key of ['focusX','focusY'])if(clip[key]!==undefined&&(!finite(clip[key])||clip[key]<0||clip[key]>100))throw new Error('Clip focus must be between 0 and 100.');
 }
 const total=durationFrames(edit)/FPS;
 for(const key of ['captions','cards']){
  let prev=0;
  for(const row of rows(edit[key]??[],key)){
   if(!row||!finite(row.start)||!finite(row.end)||row.start<prev||row.end<=row.start||row.end>total||Math.round(row.end*FPS)<=Math.round(row.start*FPS))throw new Error(`${key} must use nonoverlapping output-clock ranges inside ${total}s.`);
   if(typeof row.text!=='string'||!row.text.trim()||row.text.length>(key==='captions'?100:120))throw new Error(`${key} text is missing or too long.`);
   prev=row.end;
  }
 }
 for(const cue of rows(edit.sfx??[],'sfx')){if(!cue||!finite(cue.start)||cue.start<0||cue.start>=total||Math.round(cue.start*FPS)>=durationFrames(edit))throw new Error('Sound cue start must be inside the output duration.');assetName(cue.src);volume(cue.volume,'SFX');}
 if(edit.music!==undefined&&edit.music!==null){assetName(edit.music.src);volume(edit.music.volume,'Music');}
 if(edit.captionStyle!==undefined&&!['word','phrase'].includes(edit.captionStyle))throw new Error('captionStyle must be "word" or "phrase".');
 if(edit.layout!==undefined){
  const h=edit.layout?.visualHeight;
  if(!edit.layout||typeof edit.layout!=='object'||(h!==undefined&&(!Number.isInteger(h)||h<600||h>1000)))throw new Error('layout.visualHeight must be a whole number of pixels from 600 to 1000 (default 768).');
 }
 let prev=0;
 for(const [i,visual] of rows(edit.visuals??[],'visuals').entries()){
  const fail=message=>{throw new Error(`visuals[${i}] (${visual?.scene??'?'}): ${message}`);};
  if(!visual||!finite(visual.start)||!finite(visual.end)||visual.start<prev||visual.end>total+1e-9)fail(`needs output-clock start/end inside ${total}s that do not overlap the visual before it.`);
  if(visual.end-visual.start<0.7)fail('must stay on screen at least 0.7 s.');
  prev=visual.end;
  const check=typeof visual.scene==='string'&&Object.hasOwn(SCENES,visual.scene)?SCENES[visual.scene]:null;if(!check)fail(`unknown scene. Use one of: ${Object.keys(SCENES).join(', ')}.`);
  check(visual,fail);
  if(visual.kicker!==undefined)text(visual.kicker,24,'kicker',fail);
  const times=[...(visual.at??[]),...(visual.highlight?.at!==undefined?[visual.highlight.at]:[])];
  if(visual.at!==undefined&&!Array.isArray(visual.at))fail('at must be an array of output-clock seconds.');
  let last=visual.start;
  for(const t of visual.at??[]){if(!finite(t)||t<last||t>=visual.end)fail('reveal times in at must be ascending and inside the visual\'s start/end.');last=t;}
  for(const t of times)if(!finite(t)||t<visual.start||t>=visual.end)fail('reveal times must be inside the visual\'s start/end.');
 }
 return edit;
}
function text(value,max,label,fail){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${label} must be 1–${max} characters.`);}
const pct=v=>finite(v)&&v>=0&&v<=100;
// Built-in scenes. Each check receives the visual and a fail(message) callback.
export const SCENES={
 headline(v,fail){text(v.text,80,'text',fail);if(v.at&&v.at.length>v.text.split(/\s+/).length)fail('at has more reveal times than words.');if(v.emphasis!==undefined&&(!Number.isInteger(v.emphasis)||v.emphasis<0))fail('emphasis is a word index starting at 0.');},
 number(v,fail){if(!finite(v.value))fail('value must be a number.');if(v.from!==undefined&&!finite(v.from))fail('from must be a number.');for(const k of ['prefix','suffix'])if(v[k]!==undefined&&(typeof v[k]!=='string'||v[k].length>8))fail(`${k} must be up to 8 characters.`);if(v.label!==undefined)text(v.label,40,'label',fail);if(v.decimals!==undefined&&![0,1,2].includes(v.decimals))fail('decimals must be 0, 1 or 2.');},
 list(v,fail){if(v.title!==undefined)text(v.title,40,'title',fail);if(!Array.isArray(v.items)||v.items.length<1||v.items.length>5)fail('items must list 1–5 short lines.');v.items.forEach(x=>text(x,40,'each item',fail));if(v.at&&v.at.length!==v.items.length)fail('at needs one reveal time per item.');},
 bars(v,fail){if(v.title!==undefined)text(v.title,40,'title',fail);if(!Array.isArray(v.bars)||v.bars.length<2||v.bars.length>6)fail('bars must have 2–6 entries.');for(const b of v.bars){text(b?.label,24,'bar label',fail);if(!finite(b.value)||b.value<0)fail('bar values must be numbers ≥ 0.');}if(v.unit!==undefined&&(typeof v.unit!=='string'||v.unit.length>6))fail('unit must be up to 6 characters.');if(v.highlight!==undefined&&(!Number.isInteger(v.highlight)||v.highlight<0||v.highlight>=v.bars.length))fail('highlight is a bar index.');},
 quote(v,fail){text(v.text,90,'text',fail);if(v.attribution!==undefined)text(v.attribution,40,'attribution',fail);},
 image(v,fail){try{assetName(v.src);}catch{fail('src must be an image path inside public/.');}const h=v.highlight;if(h!==undefined&&(!h||![h.x,h.y,h.w,h.h].every(pct)))fail('highlight needs x, y, w, h as percentages of the image.');if(v.fit!==undefined&&!['contain','cover'].includes(v.fit))fail('fit is contain or cover.');},
 custom(v,fail){if(typeof v.component!=='string'||!/^[A-Z][A-Za-z0-9]{0,40}$/.test(v.component))fail('component must be a PascalCase name registered in src/scenes/custom/index.tsx.');if(v.props!==undefined&&(typeof v.props!=='object'||v.props===null||Array.isArray(v.props)))fail('props must be an object.');}
};
// Craft warnings: things that render fine but usually read badly. Never blocks a render.
export function lintEdit(edit){
 const out=[];
 (edit.visuals??[]).forEach((v,i)=>{
  const words=[v.text,v.title,...(v.items??[])].filter(Boolean).map(t=>t.split(/\s+/).length);
  if(words.some(n=>n>6))out.push(`visuals[${i}] (${v.scene}): keep on-screen text to 3–6 words a line; the voice carries the detail.`);
  const lastReveal=Math.max(v.start,...(v.at??[]));
  if(v.end-lastReveal<1)out.push(`visuals[${i}] (${v.scene}): the last reveal is up for less than 1 s; hold it at least 1 s.`);
  const prev=edit.visuals[i-1];
  if(prev&&prev.scene===v.scene&&v.start-prev.end<1)out.push(`visuals[${i}]: same scene type twice in a row; vary the layout between beats.`);
 });
 if((edit.sfx??[]).some(s=>s.start<3))out.push('sfx: a sound in the first 3 s competes with the hook; start effects after it.');
 if(edit.captionStyle!=='word'&&(edit.captions??[]).some(c=>c.text.split(/\s+/).length>7))out.push('captions: some phrases run past 7 words; shorter pages read faster on a phone.');
 return out;
}
