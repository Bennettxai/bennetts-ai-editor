// Two-pass EBU R128 mastering: measure, then apply one static correction (linear=true avoids pumping).
export const MASTER={integrated:-14,truePeak:-1,lra:11};
const base=`loudnorm=I=${MASTER.integrated}:TP=${MASTER.truePeak}:LRA=${MASTER.lra}`;
export function loudnormFilter(measured){
 if(!measured)return `${base}:print_format=json`;
 const m=measured;
 return `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`;
}
export function parseLoudnorm(stderr){
 const blocks=String(stderr).match(/\{[^{}]*"input_i"[^{}]*\}/g);
 if(!blocks)return null;
 const data=JSON.parse(blocks.at(-1));
 if(!Number.isFinite(Number(data.input_i)))return null; // silent track
 return data;
}
