/* =========================================================================
   pq-input.js — keyboard + touch input.
   Holds the shared keys state in PQ.state.keys (stable reference, mutated in
   place). Hold-state (left/right/jump) and edge-triggered one-shot actions
   (dash/fire/pound) live side by side; simulation clears the edges each tick.
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;

const keys = { left:false, right:false, jump:false, jumpPressed:false,
               dashPressed:false, firePressed:false, poundPressed:false };
PQ.state.keys = keys;

const KEYMAP = {
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
  ArrowUp:'jump', KeyW:'jump', Space:'jump',
};
// edge-triggered actions (one shot per press)
const EDGE_KEYS = {
  ShiftLeft:'dashPressed', ShiftRight:'dashPressed', KeyL:'dashPressed',
  KeyJ:'firePressed', KeyX:'firePressed',
  KeyS:'poundPressed', ArrowDown:'poundPressed',
};

addEventListener('keydown', e => {
  const a = KEYMAP[e.code];
  if (a) { e.preventDefault(); if (a==='jump' && !keys.jump) keys.jumpPressed=true; keys[a]=true; }
  if (EDGE_KEYS[e.code]) { e.preventDefault(); keys[EDGE_KEYS[e.code]]=true; }
  if (e.code === 'KeyP') PQ.togglePause();
});
addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) { e.preventDefault(); keys[a]=false; } });

function bindTouch(id, action) {
  const el = document.getElementById(id);
  if (!el) return;                 // control not present in this build — skip gracefully
  const isEdge = (action==='dashPressed' || action==='firePressed' || action==='poundPressed');
  const on  = e => { e.preventDefault(); if (action==='jump' && !keys.jump) keys.jumpPressed=true;
                     if (isEdge) keys[action]=true; else keys[action]=true; };
  const off = e => { e.preventDefault(); if (!isEdge) keys[action]=false; };
  el.addEventListener('touchstart', on,  {passive:false});
  el.addEventListener('touchend',   off, {passive:false});
  el.addEventListener('touchcancel',off, {passive:false});
  el.addEventListener('mousedown',  on);
  el.addEventListener('mouseup',    off);
}

PQ.bindTouch = bindTouch;
PQ.KEYMAP = KEYMAP;
PQ.EDGE_KEYS = EDGE_KEYS;

bindTouch('btnLeft','left'); bindTouch('btnRight','right'); bindTouch('btnJump','jump');
bindTouch('btnDash','dashPressed'); bindTouch('btnFire','firePressed'); bindTouch('btnPound','poundPressed');
})();
