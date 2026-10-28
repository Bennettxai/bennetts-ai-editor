// Run after `npm run demo` (or re-render demo). Checks the real delivered MP4.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','output/demo.mp4'],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);
const data=JSON.parse(probe.stdout);
const video=data.streams.find(s=>s.codec_type==='video');
assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.r_frame_rate,'30/1');
assert.equal(Number(video.nb_frames),105);
assert.ok(data.streams.some(s=>s.codec_type==='audio'));
assert.ok(Math.abs(Number(data.format.duration)-3.5)<0.1);
console.log('Real demo MP4 verified: 1080×1920, 30fps, 105 frames, audio present.');
