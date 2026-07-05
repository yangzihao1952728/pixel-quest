/* =========================================================================
   pq-audio.js — tiny WebAudio sound effects. All SFX are synthesized; no
   audio assets. The AudioContext is created lazily and unlocked on the first
   user gesture (see startGame → actx).
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;

let AC = null;
function actx(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function beep(freq, dur, type='square', vol=0.06, slide=0) {
  const ac = actx(); if(!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(60,freq+slide), ac.currentTime+dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime+dur);
}
const SFX = {
  jump:  () => beep(420, 0.14, 'square', 0.05, 260),
  djump: () => beep(640, 0.16, 'square', 0.05, 320),
  coin:  () => { beep(880,0.06,'square',0.05); setTimeout(()=>beep(1320,0.09,'square',0.05),60); },
  stomp: () => beep(200, 0.12, 'sawtooth', 0.06, -120),
  hurt:  () => beep(300, 0.35, 'sawtooth', 0.07, -220),
  dash:  () => beep(190, 0.16, 'sawtooth', 0.06, 420),
  fire:  () => beep(540, 0.12, 'square', 0.05, -200),
  power: () => [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,0.13,'triangle',0.06),i*75)),
  win:   () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.16,'square',0.06),i*130)),
};

PQ.audio = { actx, beep, SFX };
})();
