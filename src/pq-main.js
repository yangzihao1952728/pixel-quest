/* =========================================================================
   pq-main.js — application bootstrap, main loop, responsive canvas, and the
   DevTools debug hooks. Loaded LAST: it materializes PQ.state.game (which the
   other modules only shell out) and then drives the first frame, so every
   function it calls is already defined on PQ.
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const { VIEW_W, VIEW_H, THEMES, UPGRADE_IDS } = PQ;

// ---------------------------------------------------------------------------
// Game state — created here (after save/character helpers are available).
// `game` and `keys` are stable references; only `save` is ever reassigned.
// ---------------------------------------------------------------------------
function makeGameState() {
  return {
    state: 'title',   // title | playing | paused | win | lose
    levelIndex: 0,
    startLevelIndex: 0,
    coins: 0,
    lives: 3,
    save: PQ.state.save,
    hero: PQ.selectedCharacter(),
    stats: PQ.makeHeroStats(PQ.selectedCharacter()),
    time: 0,          // frames elapsed in level
    tiles: [],        // 2D array of solid-tile chars
    cols: 0, rows: 0,
    worldW: 0, worldH: 0,
    camX: 0, camY: 0,
    spawn: {x:0, y:0},
    player: null,
    enemies: [],
    coinsArr: [],
    treasures: [],
    spikes: [],
    goal: null,
    particles: [],
    effects: [],          // renderer-only timed effects, no gameplay state
    pickups: [],        // skill power-ups on the map
    upgradePickups: [], // run-only skill upgrades on later maps
    projectiles: [],    // active fireballs
    enemyProjectiles: [], // hostile bolts and boss attacks
    checkpoints: [],    // flag objects {x,y,active}
    checkpoint: null,   // currently active respawn point {x,y}
    theme: THEMES.meadow,
    themeId: 'meadow',
    skills: { doubleJump:false, dash:false, fireball:false, glide:false, magnet:false, groundPound:false, wallJump:false, aegis:false, quickCast:false },
    upgrades: {},
    toast: null,        // {skill, t}
    shake: 0,
  };
}
PQ.state.game = makeGameState();
const game = PQ.state.game;

// ---------------------------------------------------------------------------
// Main loop (fixed timestep)
// ---------------------------------------------------------------------------
let acc=0, last=performance.now();
const STEP = 1000/60;
function frame(now){
  acc += Math.min(now-last, 100); last=now;
  while (acc >= STEP){ PQ.update(); acc -= STEP; }
  PQ.updateToast();
  PQ.render();
  PQ.updateHUD();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Responsive canvas scaling (keep 16:9, integer-ish scale)
// ---------------------------------------------------------------------------
function fit(){
  const pad=24;
  const scale = Math.min((innerWidth-pad)/VIEW_W, (innerHeight-pad)/VIEW_H);
  PQ.canvas.style.width  = Math.floor(VIEW_W*scale)+'px';
  PQ.canvas.style.height = Math.floor(VIEW_H*scale)+'px';
}
addEventListener('resize', fit); fit();

// Debug hook — inspect/cheat/test from devtools.
window.PIXEL_QUEST = game;
window.__pq = {
  keys: PQ.state.keys, step: () => PQ.update(),
  load: (i) => { game.levelIndex = i; PQ.parseLevel(i); document.getElementById('level').textContent = i+1; },
  tp:   (x, y) => { game.player.x = x; game.player.y = y; game.player.vx = 0; game.player.vy = 0; },
  give: (s) => { if (s) game.skills[s] = true; else for (const k in game.skills) game.skills[k] = true; },
  upgrade: (u) => { if (u) game.upgrades[u] = true; else for (const k of UPGRADE_IDS) game.upgrades[k] = true; },
  save: () => PQ.state.save,
};

PQ.frame = frame;
PQ.fit = fit;

// Bootstrap — run after every module has decorated PQ.
PQ.refreshMetaUI();
PQ.renderLevelSelect();
PQ.renderShop();
PQ.updateHUD();
PQ.buildBackground();
PQ.hydrateSaveFromFile();
requestAnimationFrame(frame);
})();
