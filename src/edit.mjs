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
 return edit;
}
