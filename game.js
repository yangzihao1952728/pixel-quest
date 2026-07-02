/* =========================================================================
   像素冒险 · Pixel Quest — a self-contained side-scrolling platformer.
   Art can be supplied through assets/pixel-quest-assets.js, with procedural
   canvas fallback art kept for missing or not-yet-loaded resources.
   ========================================================================= */
(() => {
'use strict';

// ---------------------------------------------------------------------------
// Canvas & constants
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = canvas.width;    // 960
const VIEW_H = canvas.height;   // 540
const TS = 40;                  // tile size in px

// ---------------------------------------------------------------------------
// External art resources
// ---------------------------------------------------------------------------
const ART = window.PIXEL_QUEST_ASSETS || {};
const ART_IMAGES = {};

function resolveAssetSrc(src) {
  if (!src) return '';
  if (/^(data:|blob:|https?:|file:|\/)/i.test(src)) return src;
  return `${ART.basePath || ''}${src}`;
}

function loadArtAssets() {
  const images = ART.images || {};
  for (const [key, def] of Object.entries(images)) {
    const src = resolveAssetSrc(def && def.src);
    ART_IMAGES[key] = { key, ...(def || {}), src, image:null, loaded:false, failed:false };
    if (!src) continue;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { ART_IMAGES[key].loaded = true; };
    img.onerror = () => { ART_IMAGES[key].failed = true; };
    img.src = src;
    ART_IMAGES[key].image = img;
  }
}

function getArtImage(key) {
  const asset = ART_IMAGES[key];
  if (!asset || !asset.image || !asset.loaded || asset.failed) return null;
  return asset;
}

function firstArtImage(keys) {
  for (const key of keys) {
    const asset = getArtImage(key);
    if (asset) return asset;
  }
  return null;
}

function animationFrame(asset, animation, animTime=0) {
  const anim = asset.animations && asset.animations[animation];
  if (Array.isArray(anim) && anim.length) {
    const speed = asset.frameSpeed || 8;
    return anim[Math.floor(animTime / speed) % anim.length];
  }
  if (Number.isFinite(asset.frame)) return asset.frame;
  return 0;
}

function drawArtFrame(asset, animation, x, y, opts={}) {
  if (!asset || !asset.image) return false;
  const img = asset.image;
  const fw = opts.frameW || asset.frameW || img.naturalWidth || img.width;
  const fh = opts.frameH || asset.frameH || img.naturalHeight || img.height;
  if (!fw || !fh) return false;
  const frame = opts.frame ?? animationFrame(asset, animation, opts.animTime || 0);
  const framesPerRow = Math.max(1, Math.floor((img.naturalWidth || img.width) / fw));
  const sx = (frame % framesPerRow) * fw;
  const sy = Math.floor(frame / framesPerRow) * fh;
  const dw = opts.w || asset.drawW || fw * (opts.scale || asset.scale || 1);
  const dh = opts.h || asset.drawH || fh * (opts.scale || asset.scale || 1);
  const ax = (opts.anchorX ?? asset.anchorX ?? fw / 2) * (dw / fw);
  const ay = (opts.anchorY ?? asset.anchorY ?? fh / 2) * (dh / fh);
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  ctx.translate(x, y);
  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.flip) ctx.scale(-1, 1);
  const dx = opts.flip ? ax - dw : -ax;
  ctx.drawImage(img, sx, sy, fw, fh, dx, -ay, dw, dh);
  ctx.restore();
  return true;
}

function drawArtKey(keys, animation, x, y, opts={}) {
  const list = Array.isArray(keys) ? keys : [keys];
  const asset = firstArtImage(list);
  return asset ? drawArtFrame(asset, animation, x, y, opts) : false;
}

loadArtAssets();

const GRAVITY      = 0.75;
const MOVE_ACCEL   = 0.9;
const MOVE_MAX     = 5.2;
const FRICTION     = 0.80;
const AIR_FRICTION = 0.92;
const JUMP_VEL     = 14.2;
const AIR_JUMP_VEL = 13.0;      // double-jump is slightly weaker
const COYOTE_MAX   = 6;         // frames of coyote time
const BUFFER_MAX   = 7;         // frames of jump-buffer
const ENEMY_SPEED  = 1.3;
const BOUNCE_VEL   = 9.5;       // stomp bounce
// --- skill tuning ---
const DASH_SPEED   = 13;        // dash velocity
const DASH_TIME    = 11;        // dash duration (frames)
const DASH_CD      = 42;        // dash cooldown (frames)
const FIRE_CD      = 22;        // fireball cooldown (frames)
const FIRE_VX      = 11;        // fireball speed
const FIRE_LIFE    = 55;        // fireball range (frames)
const GLIDE_VY     = 1.6;       // max fall speed while gliding
const MAGNET_R     = 135;       // coin attract radius
const POUND_VY     = 19;        // ground-pound descent speed
const POUND_SHOCK  = 95;        // ground-pound kill radius (px)
const WALL_SLIDE_VY = 2.4;      // max fall speed while clinging to a wall
const WALL_JUMP_VX  = 8.5;      // horizontal kick off a wall
const WALL_JUMP_VY  = 13.2;     // vertical kick off a wall

// Skill metadata: icon/color/label shown in HUD & toast
const SKILLS = {
  doubleJump:  { name:'二段跳',   glyph:'✦', color:'#8ecae6', hint:'空中再跳一次' },
  dash:        { name:'闪电冲刺', glyph:'⚡', color:'#ffe066', hint:'Shift 冲刺 · 无敌穿敌' },
  fireball:    { name:'烈焰火球', glyph:'✺', color:'#ff6b35', hint:'J / X 发射火球' },
  glide:       { name:'风之滑翔', glyph:'✈', color:'#b388ff', hint:'空中长按跳跃缓慢滑翔' },
  magnet:      { name:'金币磁铁', glyph:'◎', color:'#ff5c8a', hint:'自动吸附附近金币' },
  groundPound: { name:'震地震击', glyph:'▼', color:'#ff9f1c', hint:'空中按 S/↓ 下砸 · 范围震敌' },
  wallJump:    { name:'飞檐走壁', glyph:'⇄', color:'#4dd6c4', hint:'贴墙下滑 · 蹬墙跳跃' },
};
const SKILL_IDS = Object.keys(SKILLS);
const UPGRADES = {
  starJump:      { name:'星跃',     glyph:'✦', color:'#bde0fe', skill:'doubleJump',  hint:'二段跳更高，并获得短暂无伤反馈' },
  floatGlide:    { name:'浮游滑翔', glyph:'✈', color:'#cdb4db', skill:'glide',       hint:'滑翔下降更慢，首次滑翔轻微上抬' },
  dashChain:     { name:'连环冲刺', glyph:'⚡', color:'#f9dc5c', skill:'dash',        hint:'击败敌人刷新冲刺，落地冷却更快' },
  burstFireball: { name:'爆裂火球', glyph:'✺', color:'#ff8f3d', skill:'fireball',    hint:'火球命中后产生小范围爆炸' },
  wallFocus:     { name:'墙面蓄力', glyph:'⇄', color:'#64dfdf', skill:'wallJump',    hint:'墙滑更慢，蹬墙跳更强' },
  quakePound:    { name:'裂地冲击', glyph:'▼', color:'#f4a261', skill:'groundPound', hint:'震地范围扩大，并可打断终局 boss' },
};
const UPGRADE_IDS = Object.keys(UPGRADES);

// Save/shop metadata. A real save file lives under save/pixel-quest-save.json.
// localStorage remains the browser-safe auto-save layer for runtime progress.
const SAVE_KEY = 'pixelQuest.save.v2';
const SAVE_JSON_FILE = 'save/pixel-quest-save.json';
const LIFE_UPGRADE_COSTS = [35, 70, 120];

// Level maps and per-level placements are external data resources.
const LEVEL_DATA = window.PIXEL_QUEST_LEVEL_DATA || {};
const LEVELS = Array.isArray(LEVEL_DATA.levels) ? LEVEL_DATA.levels : [];
if (!LEVELS.length) throw new Error('Missing PIXEL_QUEST_LEVEL_DATA.levels. Load data/pixel-quest-levels.js before game.js.');
const LEVEL_NAMES = Array.isArray(LEVEL_DATA.names) && LEVEL_DATA.names.length
  ? LEVEL_DATA.names
  : LEVELS.map((_, i) => `Level ${i + 1}`);
const LEVEL_THEMES = Array.isArray(LEVEL_DATA.themes) ? LEVEL_DATA.themes : [];
const LEVEL_PICKUPS = LEVEL_DATA.pickups || {};
const LEVEL_CHECKPOINTS = LEVEL_DATA.checkpoints || {};
const LEVEL_ELITES = LEVEL_DATA.elites || {};
const LEVEL_UPGRADES = LEVEL_DATA.upgrades || {};
const LEVEL_BOSSES = LEVEL_DATA.bosses || {};
const SHOP_SKILLS = {
  doubleJump:  { cost:45,  level:1 },
  dash:        { cost:60,  level:2 },
  fireball:    { cost:75,  level:3 },
  glide:       { cost:85,  level:4 },
  magnet:      { cost:80,  level:5 },
  groundPound: { cost:95,  level:6 },
  wallJump:    { cost:105, level:6 },
};
const NEXT_RUN_LIFE_COST = 28;
const NEXT_RUN_LIFE_MAX = 3;
const CHARACTERS = {
  rookie: {
    id:'rookie', name:'红帽旅人', cost:0, desc:'均衡的初始角色',
    body:'#3a86ff', bodyDark:'#2f6fd6', cap:'#e94560', capDark:'#c9324b', pants:'#2b2d42',
    move:1, jump:1, lifeBonus:0, skills:[]
  },
  scout: {
    id:'scout', name:'风语斥候', cost:85, desc:'速度更快，自带二段跳',
    body:'#30c58d', bodyDark:'#17966a', cap:'#8ecae6', capDark:'#4da3c7', pants:'#203a43',
    move:1.12, jump:1.02, lifeBonus:0, skills:['doubleJump']
  },
  ember: {
    id:'ember', name:'余烬术士', cost:120, desc:'起手火球，跳跃略弱',
    body:'#ff6b35', bodyDark:'#c94d24', cap:'#5f2a7a', capDark:'#3c1852', pants:'#372338',
    move:0.98, jump:0.96, lifeBonus:0, skills:['fireball']
  },
  guard: {
    id:'guard', name:'磐石守卫', cost:150, desc:'生命更多，自带震地',
    body:'#b0c4de', bodyDark:'#758ba3', cap:'#ff9f1c', capDark:'#b86a0c', pants:'#343a40',
    move:0.92, jump:0.94, lifeBonus:1, skills:['groundPound']
  },
};

// --- per-level themes (map diversity) ---
const THEMES = {
  meadow: { sky:['#8ed6f5','#bfe9ff','#e8f7ff'], hill:'#a7d9a0', sun:'#fff3b0',
            cloud:'rgba(255,255,255,0.9)', trunk:'#6b4a2b', leaf:'#5aa85a',
            ground:'#7a4a24', speck:'#8a5a2c', grass:'#57a83f', grassLt:'#6cc24a',
            brick:'#b5533a', plat:'#c8874e', spike:'#9aa5b1', spikeLt:'#cfd8e3', spikeBase:'#5a6570',
            fog:null },
  cave:   { sky:['#161a2e','#222a44','#332440'], hill:'#222a3a', sun:'#6a5a7a',
            cloud:'rgba(120,140,180,0.18)', trunk:'#33291f', leaf:'#3c6a4e',
            ground:'#33303f', speck:'#423d52', grass:'#567a6a', grassLt:'#789a86',
            brick:'#463b5e', plat:'#504a64', spike:'#828896', spikeLt:'#aeb4c2', spikeBase:'#262a36',
            fog:'rgba(15,8,25,0.30)' },
  sky:    { sky:['#6ec6ff','#aee0ff','#eaf7ff'], hill:'#ffffff', sun:'#fff3b0',
            cloud:'rgba(255,255,255,0.95)', trunk:'#9a7a4a', leaf:'#86cc68',
            ground:'#dfe8f0', speck:'#cdd9e8', grass:'#9adcff', grassLt:'#c4eeff',
            brick:'#b0c4de', plat:'#d2dcea', spike:'#aeb0c0', spikeLt:'#e2e4f0', spikeBase:'#6e7080',
            fog:null },
  lava:   { sky:['#240808','#451414','#6a2a16'], hill:'#5a1a1a', sun:'#ffae42',
            cloud:'rgba(255,120,60,0.28)', trunk:'#3a1a0a', leaf:'#7a4a2a',
            ground:'#3a1a1a', speck:'#5a2a2a', grass:'#8a4a2a', grassLt:'#aa6a3a',
            brick:'#6a2a2a', plat:'#5a3030', spike:'#4a2a2a', spikeLt:'#8a4a2a', spikeBase:'#1f0808',
            fog:'rgba(40,0,0,0.22)' },
  snow:   { sky:['#9fc6e8','#cfe6f7','#f4fafe'], hill:'#e8f0f7', sun:'#fff6cf',
            cloud:'rgba(255,255,255,0.92)', trunk:'#5a4a3a', leaf:'#9ab8c8',
            ground:'#cdd6e0', speck:'#b8c4d2', grass:'#e8f0f7', grassLt:'#ffffff',
            brick:'#a0afc0', plat:'#c2cdda', spike:'#9aa6b4', spikeLt:'#e2e8f0', spikeBase:'#5a6470',
            fog:null },
  crystal:{ sky:['#15162f','#26214a','#3b2a66'], hill:'#47306d', sun:'#89f7fe',
            cloud:'rgba(120,220,255,0.18)', trunk:'#2f2758', leaf:'#5f7bd8',
            ground:'#342055', speck:'#5f3d88', grass:'#58d5ff', grassLt:'#a3f7ff',
            brick:'#4a3480', plat:'#6248a7', spike:'#67e8f9', spikeLt:'#d7fbff', spikeBase:'#23173f',
            fog:'rgba(46,20,86,0.24)' },
  fungal: { sky:['#0f2a2c','#173f3a','#28524a'], hill:'#23503f', sun:'#8fffd1',
            cloud:'rgba(150,255,220,0.16)', trunk:'#3d2b25', leaf:'#55bf89',
            ground:'#263a2e', speck:'#3f5a45', grass:'#4ee39a', grassLt:'#9dffd0',
            brick:'#365346', plat:'#6aa56f', spike:'#d9ff9d', spikeLt:'#f4ffd2', spikeBase:'#1a2a22',
            fog:'rgba(18,70,58,0.22)' },
  gearworks:{ sky:['#2a2a32','#3f3b3a','#6a4c32'], hill:'#4b443d', sun:'#ffcd75',
            cloud:'rgba(220,210,190,0.20)', trunk:'#4a3321', leaf:'#8a7049',
            ground:'#3f444b', speck:'#6f7278', grass:'#c49a44', grassLt:'#f1c66a',
            brick:'#6c5b4a', plat:'#7f8790', spike:'#c4c9cf', spikeLt:'#f2f4f6', spikeBase:'#2b2f35',
            fog:'rgba(90,70,45,0.18)' },
  neon:   { sky:['#081126','#10193d','#1b2854'], hill:'#16264d', sun:'#ff4fd8',
            cloud:'rgba(54,245,255,0.16)', trunk:'#20263a', leaf:'#2de2e6',
            ground:'#1f2737', speck:'#2de2e6', grass:'#ff4fd8', grassLt:'#39ffbc',
            brick:'#2b3450', plat:'#264a6b', spike:'#38f5ff', spikeLt:'#e7ffff', spikeBase:'#101827',
            fog:'rgba(255,79,216,0.14)' },
  clockwork:{ sky:['#2b2118','#4a351f','#805f33'], hill:'#5d452b', sun:'#ffdf8e',
            cloud:'rgba(255,220,150,0.16)', trunk:'#52351f', leaf:'#b88332',
            ground:'#5e4a32', speck:'#8c6b3a', grass:'#d5a44b', grassLt:'#ffd36f',
            brick:'#765331', plat:'#9a713a', spike:'#c9973d', spikeLt:'#ffe2a0', spikeBase:'#34251a',
            fog:'rgba(80,50,25,0.18)' },
  void:   { sky:['#080717','#15102d','#27174a'], hill:'#1a1539', sun:'#b19cff',
            cloud:'rgba(142,120,255,0.16)', trunk:'#1e1733', leaf:'#6651c7',
            ground:'#21163c', speck:'#5846a8', grass:'#8f7cff', grassLt:'#d7ceff',
            brick:'#312052', plat:'#3d2d73', spike:'#7c68ff', spikeLt:'#d8d0ff', spikeBase:'#100b22',
            fog:'rgba(10,5,28,0.28)' },
};
// Level maps, pickups, checkpoints, and elite placements live in
// data/pixel-quest-levels.js so designers can iterate on them without
// touching simulation or rendering code.

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = { left:false, right:false, jump:false, jumpPressed:false,
               dashPressed:false, firePressed:false, poundPressed:false };

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
  if (e.code === 'KeyP') togglePause();
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
bindTouch('btnLeft','left'); bindTouch('btnRight','right'); bindTouch('btnJump','jump');
bindTouch('btnDash','dashPressed'); bindTouch('btnFire','firePressed'); bindTouch('btnPound','poundPressed');

// ---------------------------------------------------------------------------
// Tiny WebAudio sound effects
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Persistent progression
// ---------------------------------------------------------------------------
function blankSkills(value=false) {
  return Object.fromEntries(SKILL_IDS.map(id => [id, value]));
}
function makeDefaultSave() {
  const unlockedSkills = blankSkills(false);
  unlockedSkills.doubleJump = true;
  return {
    version: 2,
    updatedAt: 0,
    coins: 0,
    highestLevel: 1,
    lifeUpgrades: 0,
    nextRunLives: 0,
    purchasedSkills: blankSkills(false),
    unlockedSkills,
    ownedSkins: { rookie:true, scout:false, ember:false, guard:false },
    selectedSkin: 'rookie',
  };
}
function normalizeSave(raw) {
  const base = makeDefaultSave();
  const src = raw && typeof raw === 'object' ? raw : {};
  base.updatedAt = Math.max(0, Math.floor(Number(src.updatedAt) || Number(src.lastSavedAt) || 0));
  base.coins = Math.max(0, Math.floor(Number(src.coins) || 0));
  base.highestLevel = Math.max(1, Math.min(LEVEL_NAMES.length, Math.floor(Number(src.highestLevel) || 1)));
  base.lifeUpgrades = Math.max(0, Math.min(LIFE_UPGRADE_COSTS.length, Math.floor(Number(src.lifeUpgrades) || 0)));
  base.nextRunLives = Math.max(0, Math.min(NEXT_RUN_LIFE_MAX, Math.floor(Number(src.nextRunLives) || 0)));
  for (const id of SKILL_IDS) {
    base.purchasedSkills[id] = !!(src.purchasedSkills && src.purchasedSkills[id]);
    base.unlockedSkills[id] = !!(src.unlockedSkills && src.unlockedSkills[id]) || base.purchasedSkills[id] || base.unlockedSkills[id];
  }
  for (const id of Object.keys(CHARACTERS))
    base.ownedSkins[id] = id === 'rookie' || !!(src.ownedSkins && src.ownedSkins[id]);
  base.selectedSkin = base.ownedSkins[src.selectedSkin] ? src.selectedSkin : 'rookie';
  return base;
}
function readLocalStorageSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const stored = normalizeSave(parsed);
    if (!Number(parsed.updatedAt)) stored.updatedAt = 1; // legacy browser save beats the default file.
    return stored;
  } catch (e) { return null; }
}
function readScriptSaveFile() {
  const data = window.PIXEL_QUEST_SAVE_FILE || window.PIXEL_QUEST_SAVE;
  return data ? normalizeSave(data) : null;
}
function pickNewestSave(candidates) {
  return candidates.filter(Boolean).reduce((best, item) =>
    !best || (item.updatedAt || 0) >= (best.updatedAt || 0) ? item : best, null);
}
function loadSave() {
  return pickNewestSave([readLocalStorageSave(), readScriptSaveFile()]) || makeDefaultSave();
}
function persistSave(stamp=true) {
  if (stamp) save.updatedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
function commitSave(updatePanels=true) {
  persistSave();
  refreshMetaUI();
  if (updatePanels) {
    renderLevelSelect();
    renderShop();
  }
}
function applySave(nextSave, mirrorToLocalStorage=false) {
  save = normalizeSave(nextSave);
  game.save = save;
  if (game.state !== 'playing') {
    game.hero = selectedCharacter();
    game.stats = makeHeroStats(game.hero);
  }
  if (mirrorToLocalStorage) persistSave(false);
  refreshMetaUI();
  renderLevelSelect();
  renderShop();
}
async function hydrateSaveFromFile() {
  let fetched = null;
  try {
    const res = await fetch(SAVE_JSON_FILE, { cache:'no-store' });
    if (res.ok) fetched = normalizeSave(await res.json());
  } catch (e) {}
  const chosen = pickNewestSave([save, readScriptSaveFile(), fetched, readLocalStorageSave()]);
  if (chosen && JSON.stringify(chosen) !== JSON.stringify(save)) applySave(chosen, true);
}
function unlockLevel(levelNumber) {
  const next = Math.max(1, Math.min(LEVEL_NAMES.length, levelNumber));
  if (next > save.highestLevel) { save.highestLevel = next; commitSave(); }
}
function unlockSkillInSave(skill) {
  if (!skill || !SKILLS[skill]) return;
  if (!save.unlockedSkills[skill]) { save.unlockedSkills[skill] = true; commitSave(); }
}
function selectedCharacter() {
  const id = CHARACTERS[save.selectedSkin] ? save.selectedSkin : 'rookie';
  return CHARACTERS[id];
}
function makeHeroStats(hero) {
  return {
    moveAccel: MOVE_ACCEL * (hero.move || 1),
    moveMax: MOVE_MAX * (hero.move || 1),
    jumpVel: JUMP_VEL * (hero.jump || 1),
    airJumpVel: AIR_JUMP_VEL * (hero.jump || 1),
    maxLives: 3 + save.lifeUpgrades + (hero.lifeBonus || 0),
  };
}
function buildStartingSkills(startLevelIndex) {
  const skills = blankSkills(false);
  const hero = selectedCharacter();
  for (const id of hero.skills || []) skills[id] = true;
  for (const id of SKILL_IDS) if (save.purchasedSkills[id]) skills[id] = true;
  for (let i=0; i<startLevelIndex; i++)
    for (const pk of (LEVEL_PICKUPS[i] || [])) skills[pk.skill] = true;
  return skills;
}
function isSkillKnown(skill) {
  const item = SHOP_SKILLS[skill];
  return !!(save.unlockedSkills[skill] || save.purchasedSkills[skill] || (item && save.highestLevel >= item.level));
}
let save = loadSave();

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const game = {
  state: 'title',   // title | playing | paused | win | lose
  levelIndex: 0,
  startLevelIndex: 0,
  coins: 0,
  lives: 3,
  save,
  hero: selectedCharacter(),
  stats: makeHeroStats(selectedCharacter()),
  time: 0,          // frames elapsed in level
  tiles: [],        // 2D array of solid-tile chars
  cols: 0, rows: 0,
  worldW: 0, worldH: 0,
  camX: 0, camY: 0,
  spawn: {x:0, y:0},
  player: null,
  enemies: [],
  coinsArr: [],
  spikes: [],
  goal: null,
  particles: [],
  effects: [],          // renderer-only timed effects, no gameplay state
  pickups: [],        // skill power-ups on the map
  upgradePickups: [], // run-only skill upgrades on later maps
  projectiles: [],    // active fireballs
  checkpoints: [],    // flag objects {x,y,active}
  checkpoint: null,   // currently active respawn point {x,y}
  theme: THEMES.meadow,
  themeId: 'meadow',
  skills: { doubleJump:false, dash:false, fireball:false, glide:false, magnet:false, groundPound:false, wallJump:false },
  upgrades: {},
  toast: null,        // {skill, t}
  shake: 0,
};

const SOLID = new Set(Array.isArray(LEVEL_DATA.solidTiles) ? LEVEL_DATA.solidTiles : ['#','B','=']);

function parseLevel(idx) {
  const raw = LEVELS[idx];
  const cols = Math.max(...raw.map(r => r.length));
  const rows = raw.length;
  const tiles = [];
  game.enemies = []; game.coinsArr = []; game.spikes = []; game.particles = []; game.effects = [];
  game.projectiles = []; game.pickups = []; game.upgradePickups = []; game.checkpoints = [];
  game.checkpoint = null; game.goal = null;
  game.themeId = LEVEL_THEMES[idx] || 'meadow';
  game.theme = THEMES[game.themeId] || THEMES.meadow;

  for (let r=0; r<rows; r++) {
    const line = raw[r].padEnd(cols, ' ');
    const row = [];
    for (let c=0; c<cols; c++) {
      const ch = line[c];
      const x = c*TS, y = r*TS;
      if (SOLID.has(ch)) { row.push(ch); continue; }
      row.push(' ');
      switch (ch) {
        case 'P': game.spawn = {x, y}; break;
        case 'o': game.coinsArr.push({x:x+TS/2, y:y+TS/2, taken:false, spin:Math.random()*Math.PI*2, vx:0, vy:0}); break;
        case 's': game.enemies.push(makeSlime(x, y)); break;
        case '^': game.spikes.push({x, y}); break;
        case 'G': game.goal = {x:x+TS/2, y:y}; break;
      }
    }
    tiles.push(row);
  }
  game.tiles = tiles;
  game.cols = cols; game.rows = rows;
  game.worldW = cols*TS; game.worldH = rows*TS;
  game.player = makePlayer(game.spawn.x, game.spawn.y);
  applyLevelElites(idx);
  applyLevelBosses(idx);
  // place this level's skill power-ups (if any) — skills persist across levels,
  // so a pickup already owned is rerolled into another unowned skill when possible.
  const reservedPickupSkills = new Set();
  for (const pk of (LEVEL_PICKUPS[idx] || [])) {
    const resolved = resolvePickupSkill(pk.skill, reservedPickupSkills);
    if (!resolved) continue;
    reservedPickupSkills.add(resolved.skill);
    game.pickups.push({ x:pk.col*TS+TS/2, y:pk.row*TS+TS/2, skill:resolved.skill,
                        sourceSkill:pk.skill, replaced:resolved.replaced,
                        taken:false, bob:Math.random()*Math.PI*2 });
  }
  for (const up of (LEVEL_UPGRADES[idx] || [])) {
    if (!UPGRADES[up.upgrade] || game.upgrades[up.upgrade]) continue;
    game.upgradePickups.push({ x:up.col*TS+TS/2, y:up.row*TS+TS/2, upgrade:up.upgrade,
                               taken:false, bob:Math.random()*Math.PI*2 });
  }
  // place checkpoint flags
  for (const cp of (LEVEL_CHECKPOINTS[idx]||[]))
    game.checkpoints.push({ x:cp.col*TS+TS/2, y:cp.row*TS+TS, active:false, t:0 });
  game.time = 0;
  game.camX = 0; game.camY = 0;
  buildBackground();
}

function makePlayer(x, y) {
  return { x, y, w:26, h:36, vx:0, vy:0, onGround:false,
           facing:1, coyote:0, buffer:0, animT:0, dead:false, deadT:0, invuln:0,
           airJumps:0,        // remaining mid-air jumps (needs double-jump skill)
           dashing:0, dashCD:0, dashDir:1,
           fireCD:0, poundCD:0,
           wallDir:0, wallSlide:false, wallKick:0, wallKickFrom:0,   // wall-jump state
           gliding:false, glideLiftUsed:false, pounding:false };
}
function makeSlime(x, y) {
  return { x:x+6, y:y+TS-26, w:28, h:26, vx:ENEMY_SPEED, speed:ENEMY_SPEED,
           alive:true, elite:false, hp:1, maxHp:1, hurtT:0, squishT:0, animT:Math.random()*10 };
}
function makeEliteSlime(x, y) {
  const e = makeSlime(x, y);
  promoteElite(e);
  return e;
}
function promoteElite(e) {
  const bottom = e.y + e.h, cx = e.x + e.w/2;
  e.elite = true; e.maxHp = 2; e.hp = Math.max(e.hp || 1, 2);
  e.w = 36; e.h = 32; e.speed = ENEMY_SPEED * 1.28;
  e.x = cx - e.w/2; e.y = bottom - e.h;
  e.vx = Math.sign(e.vx || 1) * e.speed;
}
function makeBossSlime(x, y, spec={}) {
  const type = spec.type || 'miniSlime';
  const isKing = type === 'kingSlime';
  const w = isKing ? 72 : 52;
  const h = isKing ? 58 : 44;
  const hp = Math.max(1, Math.floor(Number(spec.hp) || (isKing ? 16 : 8)));
  return {
    x:x + TS/2 - w/2, y:y + TS - h, w, h,
    vx:isKing ? ENEMY_SPEED*0.62 : ENEMY_SPEED*0.78, vy:0,
    speed:isKing ? ENEMY_SPEED*0.62 : ENEMY_SPEED*0.78,
    baseSpeed:isKing ? ENEMY_SPEED*0.62 : ENEMY_SPEED*0.78,
    alive:true, elite:true, boss:true, type, gateGoal:!!spec.gateGoal,
    hp, maxHp:hp, hurtT:0, squishT:0, animT:Math.random()*10,
    jumpCD:isKing ? 100 : 70, attackCD:isKing ? 140 : 0, chargeT:0, interruptT:0,
    artKey:isKing ? 'enemies.bigBoss' : 'enemies.miniBoss',
    name:isKing ? '星渊王' : '水晶史莱姆',
  };
}

// ---------------------------------------------------------------------------
// Tile helpers
// ---------------------------------------------------------------------------
function tileAt(col, row) {
  if (row<0 || row>=game.rows || col<0 || col>=game.cols) return ' ';
  return game.tiles[row][col];
}
function isSolidAtPx(px, py) {
  return SOLID.has(tileAt(Math.floor(px/TS), Math.floor(py/TS)));
}

// AABB vs tilemap collision, axis-separated
function moveEntity(e) {
  // --- Horizontal ---
  e.x += e.vx;
  let top = Math.floor(e.y/TS), bot = Math.floor((e.y+e.h-1)/TS);
  if (e.vx > 0) {
    let col = Math.floor((e.x+e.w)/TS);
    for (let r=top; r<=bot; r++) if (SOLID.has(tileAt(col,r))) { e.x = col*TS - e.w - 0.01; e.vx = 0; e.hitWall=true; break; }
  } else if (e.vx < 0) {
    let col = Math.floor(e.x/TS);
    for (let r=top; r<=bot; r++) if (SOLID.has(tileAt(col,r))) { e.x = (col+1)*TS + 0.01; e.vx = 0; e.hitWall=true; break; }
  }
  // --- Vertical ---
  e.y += e.vy;
  e.onGround = false;
  let left = Math.floor(e.x/TS), right = Math.floor((e.x+e.w-1)/TS);
  if (e.vy > 0) {
    let row = Math.floor((e.y+e.h)/TS);
    for (let c=left; c<=right; c++) if (SOLID.has(tileAt(c,row))) { e.y = row*TS - e.h - 0.01; e.vy = 0; e.onGround = true; break; }
  } else if (e.vy < 0) {
    let row = Math.floor(e.y/TS);
    for (let c=left; c<=right; c++) if (SOLID.has(tileAt(c,row))) { e.y = (row+1)*TS + 0.01; e.vy = 0; break; }
  }
}

function aabb(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function resolvePickupSkill(skill, reserved=new Set()) {
  if (!game.skills[skill] && !reserved.has(skill)) return { skill, replaced:false };
  const choices = SKILL_IDS.filter(id => !game.skills[id] && !reserved.has(id));
  if (!choices.length) return null;
  return { skill:choices[Math.floor(Math.random()*choices.length)], replaced:true };
}
function applyLevelElites(idx) {
  for (const sp of (LEVEL_ELITES[idx] || [])) {
    const x = sp.col * TS, y = sp.row * TS;
    const existing = game.enemies.find(e => Math.abs((e.x+e.w/2) - (x+TS/2)) < TS*0.55 &&
                                           Math.abs((e.y+e.h) - (y+TS)) < TS*0.7);
    if (existing) promoteElite(existing);
    else game.enemies.push(makeEliteSlime(x, y));
  }
}
function applyLevelBosses(idx) {
  for (const sp of (LEVEL_BOSSES[idx] || [])) {
    game.enemies.push(makeBossSlime(sp.col * TS, sp.row * TS, sp));
  }
}
function livingGoalBoss() {
  return game.enemies.find(e => e.alive && e.boss && e.gateGoal) || null;
}
function damageEnemy(e, amount=1, color='#7bd389') {
  if (!e.alive) return false;
  e.hp -= amount;
  e.hurtT = 10;
  spawnBurst(e.x+e.w/2, e.y+e.h/2, color, e.boss ? 18 : e.elite ? 12 : 8);
  if (e.hp <= 0) {
    e.alive = false; e.squishT = 0; SFX.stomp();
    spawnRing(e.x+e.w/2, e.y+e.h/2, color, e.boss ? 24 : e.elite ? 12 : 8, e.boss ? 3.4 : e.elite ? 2.8 : 2);
    if (game.upgrades.dashChain) game.player.dashCD = 0;
    if (e.boss) {
      game.shake = Math.max(game.shake, 16);
      showTextToast(e.name || 'Boss', '已击败，终点已解锁', '#ffd93b', '★');
    }
    return true;
  }
  SFX.stomp();
  if (e.boss && e.type === 'kingSlime' && e.hp <= e.maxHp/2 && !e.phase2) {
    e.phase2 = true;
    game.shake = Math.max(game.shake, 10);
    spawnRing(e.x+e.w/2, e.y+e.h/2, '#b19cff', 24, 3);
  }
  e.vx = -Math.sign(e.vx || 1) * (e.speed || ENEMY_SPEED);
  return false;
}
function isSpikeNearRect(x, y, w, h) {
  return game.spikes.some(sp => x < sp.x+TS-6 && x+w > sp.x+6 && y+h > sp.y+16 && y < sp.y+TS);
}
function isEnemyNearPoint(x, y, radius=70) {
  return game.enemies.some(e => e.alive && Math.hypot((e.x+e.w/2)-x, (e.y+e.h/2)-y) < radius);
}
function canStandAt(x, y, w=26, h=36) {
  const probes = [[x+2,y+2],[x+w-2,y+2],[x+2,y+h-2],[x+w-2,y+h-2]];
  if (probes.some(([px,py]) => isSolidAtPx(px, py))) return false;
  if (!isSolidAtPx(x+w*0.5, y+h+2)) return false;
  return !isSpikeNearRect(x, y, w, h) && !isEnemyNearPoint(x+w/2, y+h/2);
}
function findSafeRespawn(cp, player=game.player) {
  const w = player?.w || 26, h = player?.h || 36;
  const baseCol = Math.floor(cp.x / TS);
  const baseRow = Math.floor(cp.y / TS);
  const candidates = [];
  for (let dc=0; dc<=8; dc++) {
    const offsets = dc === 0 ? [0] : [-dc, dc];
    for (const off of offsets) {
      const col = baseCol + off;
      if (col < 0 || col >= game.cols) continue;
      for (let row=Math.max(0, baseRow-3); row<=Math.min(game.rows-1, baseRow+2); row++) {
        if (!SOLID.has(tileAt(col, row))) continue;
        const x = col*TS + TS/2 - w/2;
        const y = row*TS - h - 2;
        candidates.push({ x, y, score:Math.abs(off)*10 + Math.abs(row-baseRow) });
      }
    }
  }
  candidates.sort((a,b) => a.score - b.score);
  return candidates.find(pos => canStandAt(pos.x, pos.y, w, h)) ||
         { x:cp.x-w/2, y:cp.y-h-2 };
}
function addCollectedCoin(n=1) {
  game.coins += n;
  save.coins += n;
  commitSave(false);
}
function updateBossIntent(s) {
  if (!s.boss) return;
  const phaseBoost = s.phase2 ? 1.35 : 1;
  s.speed = s.baseSpeed * phaseBoost;
  if (s.interruptT > 0) {
    s.interruptT--;
    s.chargeT = 0;
    return;
  }
  if (s.jumpCD > 0) s.jumpCD--;
  if (s.attackCD > 0) s.attackCD--;
  if (s.type === 'miniSlime' && s.onGround && s.jumpCD <= 0) {
    s.vy = -9.2;
    s.jumpCD = s.hp <= s.maxHp/2 ? 48 : 68;
    game.shake = Math.max(game.shake, 3);
  }
  if (s.type === 'kingSlime' && s.onGround) {
    if (s.phase2 && s.attackCD <= 0 && s.chargeT <= 0) {
      s.chargeT = 36;
      s.attackCD = 140;
    }
    if (s.chargeT > 0) {
      s.chargeT--;
      s.vx *= 0.75;
      if (s.chargeT === 1) {
        spawnBossShockwave(s);
        s.vy = -8.5;
      }
    } else if (s.jumpCD <= 0) {
      s.vy = s.phase2 ? -10.2 : -8.8;
      s.jumpCD = s.phase2 ? 58 : 82;
    }
  }
}
function spawnBossShockwave(s) {
  const cx = s.x+s.w/2, y = s.y+s.h;
  game.effects.push({ type:'bossShock', x:cx, y, t:0, life:34, radius:s.phase2 ? 150 : 110, hit:false });
  spawnRing(cx, y, '#b19cff', 22, 3.2);
  game.shake = Math.max(game.shake, 12);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update() {
  if (game.state !== 'playing') return;
  game.time++;
  const p = game.player;

  if (p.dead) {
    p.deadT++;
    p.vy += GRAVITY; p.y += p.vy;           // little death hop
    if (p.deadT > 70) respawnOrLose();
    updateParticles();
    updateEffects();
    if (game.shake>0) game.shake--;
    return;
  }

  // --- dash (overrides normal horizontal control while active) ---
  if (p.dashing > 0) {
    p.dashing--;
    p.vx = p.dashDir * DASH_SPEED;
    p.vy = 0;                                   // glide during dash
    p.invuln = Math.max(p.invuln, 2);           // i-frames while dashing
    if (p.dashing % 2 === 0)
      game.particles.push({ x:p.x+p.w/2 - p.dashDir*8, y:p.y+p.h/2, vx:-p.dashDir*1.5, vy:0,
                            life:0.5, color:SKILLS.dash.color, size:7 });
  } else {
    if (p.dashCD > 0) p.dashCD = Math.max(0, p.dashCD - (game.upgrades.dashChain && p.onGround ? 3 : 1));
    // --- horizontal input ---
    const dir = (keys.right?1:0) - (keys.left?1:0);
    // during a wall-kick, ignore input pushing back into the wall so the launch reads cleanly
    const suppress = p.wallKick > 0 && dir === p.wallKickFrom;
    if (dir !== 0 && !suppress) { p.vx += dir*game.stats.moveAccel; p.facing = dir; }
    p.vx *= p.onGround ? FRICTION : AIR_FRICTION;
    p.vx = Math.max(-game.stats.moveMax, Math.min(game.stats.moveMax, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;
    // --- dash trigger ---
    if (keys.dashPressed && game.skills.dash && p.dashCD === 0) {
      p.dashing = DASH_TIME; p.dashCD = DASH_CD; p.dashDir = p.facing || 1;
      SFX.dash(); game.shake = Math.max(game.shake, 4);
      spawnRing(p.x+p.w/2, p.y+p.h/2, SKILLS.dash.color, 12, 2.4);
    }
  }
  keys.dashPressed = false;

  // --- wall detection (for wall-slide / wall-jump) ---
  // Look one pixel past each side, at two heights, for a solid tile.
  p.wallDir = 0;
  if (game.skills.wallJump && !p.onGround) {
    const midY = p.y + p.h*0.5, lowY = p.y + p.h - 4;
    const rightWall = isSolidAtPx(p.x+p.w+1, midY) || isSolidAtPx(p.x+p.w+1, lowY);
    const leftWall  = isSolidAtPx(p.x-1,     midY) || isSolidAtPx(p.x-1,     lowY);
    if (rightWall && (keys.right || p.wallSlide)) p.wallDir = 1;
    else if (leftWall && (keys.left || p.wallSlide)) p.wallDir = -1;
    else if (rightWall && p.vy > 0 && keys.right) p.wallDir = 1;
    else if (leftWall && p.vy > 0 && keys.left)  p.wallDir = -1;
  }
  // are we actively clinging? (airborne, touching wall, descending)
  p.wallSlide = (p.wallDir !== 0 && !p.onGround && p.vy > -1 && p.dashing === 0 && !p.pounding);
  if (p.wallKick > 0) p.wallKick--;

  // --- jump: coyote + buffer + DOUBLE JUMP + WALL JUMP ---
  if (p.onGround) { p.coyote = COYOTE_MAX; p.airJumps = game.skills.doubleJump ? 1 : 0; p.glideLiftUsed = false; }
  else if (p.coyote>0) p.coyote--;
  if (keys.jumpPressed) { p.buffer = BUFFER_MAX; keys.jumpPressed=false; }
  else if (p.buffer>0) p.buffer--;
  if (p.buffer > 0) {
    if (p.coyote > 0) {                                    // grounded / coyote jump
      p.vy = -game.stats.jumpVel; p.buffer=0; p.coyote=0; p.onGround=false; p.dashing=0; SFX.jump();
      spawnRing(p.x+p.w/2, p.y+p.h, '#ffffff', 8, 1.6);
    } else if (p.wallSlide && p.wallDir !== 0) {           // ★ WALL JUMP ★ (kick off the wall)
      const focus = game.upgrades.wallFocus ? 1.14 : 1;
      p.vy = -WALL_JUMP_VY*focus; p.vx = -p.wallDir*WALL_JUMP_VX*focus; p.facing = -p.wallDir;
      p.wallKick = 9; p.wallKickFrom = p.wallDir; p.wallSlide = false; p.buffer = 0; p.dashing = 0;
      p.airJumps = game.skills.doubleJump ? 1 : 0;         // refresh air jump after a wall kick
      SFX.djump();
      spawnRing(p.x + (p.wallDir>0?p.w:0), p.y+p.h/2, SKILLS.wallJump.color, 16, 2.6);
      game.shake = Math.max(game.shake, 3);
    } else if (p.airJumps > 0) {                           // ★ DOUBLE JUMP ★
      p.vy = -game.stats.airJumpVel * (game.upgrades.starJump ? 1.12 : 1); p.airJumps--; p.buffer=0; p.dashing=0; SFX.djump();
      spawnRing(p.x+p.w/2, p.y+p.h/2, game.upgrades.starJump ? UPGRADES.starJump.color : SKILLS.doubleJump.color, game.upgrades.starJump ? 24 : 18, 2.6);
      if (game.upgrades.starJump) p.invuln = Math.max(p.invuln, 14);
      game.shake = Math.max(game.shake, game.upgrades.starJump ? 5 : 3);
    }
  }
  // variable jump height (release early = shorter hop)
  if (!keys.jump && p.vy < -6) p.vy = -6;

  // --- fireball ---
  if (p.fireCD > 0) p.fireCD--;
  if (keys.firePressed && game.skills.fireball && p.fireCD === 0 && p.dashing === 0 && !p.pounding) {
    game.projectiles.push({ x:p.x+p.w/2 + p.facing*16, y:p.y+12, vx:p.facing*FIRE_VX, vy:0,
                            life:FIRE_LIFE, spin:0 });
    p.fireCD = FIRE_CD; SFX.fire();
    spawnBurst(p.x+p.w/2+p.facing*20, p.y+12, '#ffae00', 5);
  }
  keys.firePressed = false;

  // --- ground pound (S / ↓) : slam straight down, shockwave on landing ---
  if (p.poundCD > 0) p.poundCD--;
  if (keys.poundPressed && game.skills.groundPound && !p.onGround && !p.pounding && p.dashing===0) {
    p.pounding = true; p.vy = POUND_VY; p.vx *= 0.3; p.gliding = false;
    SFX.dash(); spawnRing(p.x+p.w/2, p.y, SKILLS.groundPound.color, 8, 1.6);
  }
  keys.poundPressed = false;
  if (p.pounding) p.invuln = Math.max(p.invuln, 2);        // invulnerable while slamming

  // --- gravity (suspended while dashing); GLIDE, POUND & WALL-SLIDE override fall speed ---
  if (p.dashing === 0) {
    p.vy += GRAVITY;
    if (p.pounding) {
      p.vy = Math.max(p.vy, POUND_VY); p.gliding = false;   // force fast descent
    } else if (game.skills.glide && keys.jump && p.vy > (game.upgrades.floatGlide ? 0.4 : GLIDE_VY)) {   // ★ GLIDE ★
      if (game.upgrades.floatGlide && !p.gliding && !p.glideLiftUsed) {
        p.vy = Math.min(p.vy, -0.8);
        p.glideLiftUsed = true;
        spawnRing(p.x+p.w/2, p.y+p.h, UPGRADES.floatGlide.color, 10, 1.4);
      } else {
        p.vy = game.upgrades.floatGlide ? 1.05 : GLIDE_VY;
      }
      p.gliding = true;
      if (game.time % 3 === 0)
        game.particles.push({ x:p.x+p.w/2+(Math.random()-0.5)*16, y:p.y+p.h, vx:0, vy:0.6,
                              life:0.4, color:SKILLS.glide.color, size:3 });
    } else p.gliding = false;
    if (p.wallSlide && p.vy > (game.upgrades.wallFocus ? 1.45 : WALL_SLIDE_VY)) {              // ★ WALL SLIDE ★ (cling & descend slowly)
      p.vy = game.upgrades.wallFocus ? 1.45 : WALL_SLIDE_VY;
      if (game.time % 4 === 0)
        game.particles.push({ x:p.x+(p.wallDir>0?p.w:0), y:p.y+p.h*0.5+(Math.random()-0.5)*10,
                              vx:-p.wallDir*0.5, vy:0.4, life:0.4, color:SKILLS.wallJump.color, size:3 });
    }
    if (!p.pounding && p.vy > 18) p.vy = 18;
  } else p.gliding = false;

  p.hitWall = false;
  const wasPounding = p.pounding;
  moveEntity(p);
  // keep the hero inside the level — you can never run off the left/right edge into the void
  p.x = Math.max(0, Math.min(game.worldW - p.w, p.x));
  if (p.dashing > 0 && p.hitWall) p.dashing = 0;          // bonk: dash ends on wall
  if (wasPounding && p.onGround) poundShockwave();        // slammed into the ground
  if (Math.abs(p.vx) > 0.4 && p.onGround) p.animT += Math.abs(p.vx)*0.06; else p.animT = 0;
  if (p.invuln>0) p.invuln--;

  // fell out of world — but the finish line is NEVER a death: if you're at/past the
  // goal you simply clear the level instead of dying.
  if (p.y > game.worldH + 100) {
    if (game.goal && !livingGoalBoss() && (p.x + p.w/2) > game.goal.x - TS) return reachGoal();
    return hurt();
  }

  // --- enemies ---
  for (const s of game.enemies) {
    if (!s.alive) { s.squishT++; continue; }
    s.animT += 0.12;
    const wasOnGround = !!s.onGround;
    updateBossIntent(s);
    s.vy = (s.vy||0) + GRAVITY;
    // capture travel direction BEFORE moveEntity (which zeroes vx on wall hit)
    const dir = Math.sign(s.vx) || 1;
    // ledge detection: is there solid ground just ahead & below?
    const aheadX = dir>0 ? s.x+s.w+1 : s.x-1;
    const footY  = s.y+s.h+2;
    const groundAhead = isSolidAtPx(aheadX, footY);
    s.hitWall = false;
    moveEntity(s);
    if (s.boss && !wasOnGround && s.onGround) {
      spawnRing(s.x+s.w/2, s.y+s.h, s.type === 'kingSlime' ? '#b19cff' : '#89f7fe', s.type === 'kingSlime' ? 18 : 12, 2.2);
      game.shake = Math.max(game.shake, s.type === 'kingSlime' ? 8 : 5);
    }
    const speed = s.speed || ENEMY_SPEED;
    if (s.hitWall || (!groundAhead && s.onGround)) s.vx = -dir*speed;
    else s.vx = dir*speed;
    if (s.hurtT > 0) s.hurtT--;

    // collide w/ player
    if (aabb(p, s)) {
      if (p.dashing > 0 || p.pounding) {                 // dash / pound plows through & shreds
        damageEnemy(s, p.pounding ? 2 : 1, p.pounding ? SKILLS.groundPound.color : SKILLS.dash.color);
        spawnRing(s.x+s.w/2, s.y+s.h/2, (p.pounding?SKILLS.groundPound:SKILLS.dash).color, 8, 2);
        game.shake = Math.max(game.shake, 4);
      } else if (p.invuln===0) {
        const stomping = p.vy > 1 && (p.y + p.h) - s.y < (s.boss ? 32 : 22);
        if (stomping) {
          damageEnemy(s, 1, s.elite ? '#d879ff' : '#7bd389');
          p.vy = -BOUNCE_VEL;
          game.shake = 4;
        } else {
          return hurt();
        }
      }
    }
  }

  // --- fireballs ---
  for (const fb of game.projectiles) {
    fb.life--; fb.spin += 0.5; fb.x += fb.vx;
    if (Math.random() < 0.8)
      game.particles.push({ x:fb.x - Math.sign(fb.vx)*6, y:fb.y + (Math.random()-0.5)*6,
                            vx:-Math.sign(fb.vx)*0.6, vy:(Math.random()-0.5), life:0.4,
                            color: Math.random()<.5 ? '#ffd93b' : '#ff5500', size:3 });
    if (isSolidAtPx(fb.x, fb.y)) { fb.life = 0; explodeFire(fb.x, fb.y); }
    else for (const s of game.enemies) {
      const hitW = s.boss ? s.w/2 + 8 : 18;
      const hitH = s.boss ? s.h/2 + 8 : 20;
      if (s.alive && Math.abs(fb.x-(s.x+s.w/2))<hitW && Math.abs(fb.y-(s.y+s.h/2))<hitH) {
        damageEnemy(s, 1, '#ffae00'); fb.life=0; explodeFire(fb.x, fb.y, s);
        game.shake = Math.max(game.shake, 4); break;
      }
    }
  }
  game.projectiles = game.projectiles.filter(fb => fb.life>0 && fb.x>-50 && fb.x<game.worldW+50);

  // --- skill power-ups ---
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    pk.bob += 0.08;
    if (Math.abs((p.x+p.w/2)-pk.x)<30 && Math.abs((p.y+p.h/2)-pk.y)<34) {
      pk.taken=true; game.skills[pk.skill]=true; unlockSkillInSave(pk.skill); SFX.power();
      spawnRing(pk.x, pk.y, SKILLS[pk.skill].color, 26, 3);
      spawnBurst(pk.x, pk.y, SKILLS[pk.skill].color, 14);
      showToast(pk.skill, pk.replaced ? `已拥有 ${SKILLS[pk.sourceSkill].name}，转化为 ${SKILLS[pk.skill].name}` : null);
      game.shake = 6;
    }
  }

  // --- run-only skill upgrades ---
  for (const up of game.upgradePickups) {
    if (up.taken) continue;
    up.bob += 0.08;
    const meta = UPGRADES[up.upgrade];
    if (Math.abs((p.x+p.w/2)-up.x)<30 && Math.abs((p.y+p.h/2)-up.y)<34) {
      up.taken = true; game.upgrades[up.upgrade] = true; SFX.power();
      if (meta && meta.skill) game.skills[meta.skill] = true;
      spawnRing(up.x, up.y, meta ? meta.color : '#ffd93b', 30, 3.2);
      spawnBurst(up.x, up.y, meta ? meta.color : '#ffd93b', 18);
      showUpgradeToast(up.upgrade);
      game.shake = 7;
    }
  }

  // --- checkpoints: touching a flag makes it the respawn point ---
  for (const cp of game.checkpoints) {
    cp.t += 0.1;
    if (!cp.active && Math.abs((p.x+p.w/2)-cp.x)<30 && Math.abs((p.y+p.h)-cp.y)<50) {
      cp.active = true; game.checkpoint = findSafeRespawn(cp, p);
      for (const o of game.checkpoints) o.active = (o === cp);   // only latest is "active"
      p.invuln = Math.max(p.invuln, 45);
      SFX.power(); spawnRing(cp.x, cp.y-20, '#7ee787', 18, 2.6);
      spawnBurst(cp.x, cp.y-20, '#7ee787', 10);
    }
  }

  // --- coins (with magnet attraction if skilled) ---
  for (const c of game.coinsArr) {
    if (c.taken) continue;
    c.spin += 0.16;
    if (game.skills.magnet) {                                // ★ MAGNET ★
      const dx = (p.x+p.w/2)-c.x, dy = (p.y+p.h/2)-c.y, d = Math.hypot(dx,dy);
      if (d < MAGNET_R && d > 1) { c.vx += dx/d*1.1; c.vy += dy/d*1.1; }
      c.vx *= 0.86; c.vy *= 0.86; c.x += c.vx; c.y += c.vy;
    }
    if (Math.abs((p.x+p.w/2)-c.x) < 26 && Math.abs((p.y+p.h/2)-c.y) < 30) {
      c.taken=true; addCollectedCoin(1); SFX.coin();
      spawnBurst(c.x, c.y, '#ffd93b', 6);
    }
  }

  // --- spikes ---
  for (const sp of game.spikes) {
    if (p.invuln===0 && p.x < sp.x+TS-6 && p.x+p.w > sp.x+6 && p.y+p.h > sp.y+16 && p.y < sp.y+TS)
      return hurt();
  }

  // --- goal ---
  if (game.goal && Math.abs((p.x+p.w/2)-game.goal.x) < 30 && p.y+p.h > game.goal.y-10) {
    const gate = livingGoalBoss();
    if (gate) {
      p.vx = -Math.abs(p.vx || 2);
      p.x = Math.min(p.x, game.goal.x - p.w - 26);
      if (!game.toast || game.toast.kind !== 'goalLocked')
        showTextToast('终点封印', `先击败 ${gate.name || 'Boss'}`, '#ffd93b', '!', { kind:'goalLocked' });
      return;
    }
    return reachGoal();
  }

  updateParticles();
  updateEffects();
  if (game.shake>0) game.shake--;

  // --- camera (follows player, clamped) ---
  const targetX = p.x + p.w/2 - VIEW_W/2;
  const targetY = p.y + p.h/2 - VIEW_H/2;
  game.camX += (targetX - game.camX) * 0.12;
  game.camY += (targetY - game.camY) * 0.10;
  game.camX = Math.max(0, Math.min(game.worldW - VIEW_W, game.camX));
  game.camY = Math.max(0, Math.min(game.worldH - VIEW_H, game.camY));
}

function hurt() {
  const p = game.player;
  if (p.dead) return;
  p.dead = true; p.deadT = 0; p.vy = -10; SFX.hurt();
  game.shake = 10;
  spawnBurst(p.x+p.w/2, p.y+p.h/2, '#e94560', 14);
}
function respawnOrLose() {
  game.lives--;
  if (game.lives <= 0) { endGame(false); return; }
  // respawn at last checkpoint if one was touched, else level start
  const r = game.checkpoint || game.spawn;
  const p = makePlayer(r.x, r.y);
  p.invuln = 60;
  game.player = p;
}
// ground-pound landing: shockwave that flattens nearby enemies
function poundShockwave() {
  const p = game.player;
  p.pounding = false; p.vy = -BOUNCE_VEL*0.7;            // little bounce
  p.invuln = Math.max(p.invuln, 18);
  const cx = p.x+p.w/2, cy = p.y+p.h;
  const radius = game.upgrades.quakePound ? 140 : POUND_SHOCK;
  const shockColor = game.upgrades.quakePound ? UPGRADES.quakePound.color : SKILLS.groundPound.color;
  game.effects.push({ type:'groundPoundShock', x:cx, y:cy-10, t:0, life:18, radius });
  spawnRing(cx, cy, shockColor, game.upgrades.quakePound ? 38 : 28, 4.4);
  spawnBurst(cx, cy, '#ffd93b', 16);
  // debris flying up
  for (let i=0;i<10;i++) game.particles.push({ x:cx+(Math.random()-0.5)*60, y:cy, vx:(Math.random()-0.5)*5, vy:-2-Math.random()*4, life:0.7, color:game.theme.ground, size:3+Math.random()*3 });
  game.shake = 12; SFX.stomp();
  for (const s of game.enemies) {
    if (!s.alive) continue;
    const d = Math.hypot((s.x+s.w/2)-cx, (s.y+s.h/2)-cy);
    if (d < radius) {
      if (game.upgrades.quakePound && s.boss && s.type === 'kingSlime') {
        s.interruptT = 48;
        s.chargeT = 0;
        spawnRing(s.x+s.w/2, s.y+s.h/2, UPGRADES.quakePound.color, 18, 2.8);
      }
      damageEnemy(s, s.elite ? 2 : 1, shockColor);
      spawnRing(s.x+s.w/2, s.y+s.h/2, shockColor, 6, 2);
    }
  }
}
function reachGoal() {
  SFX.win();
  spawnBurst(game.goal.x, game.goal.y, '#ffd93b', 30);
  if (game.levelIndex < LEVELS.length-1) {
    unlockLevel(game.levelIndex + 2);
    game.levelIndex++;
    parseLevel(game.levelIndex);
    document.getElementById('level').textContent = game.levelIndex+1;
  } else {
    unlockLevel(LEVELS.length);
    endGame(true);
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
function spawnBurst(x, y, color, n) {
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, sp = 1+Math.random()*4;
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,color,size:2+Math.random()*3});
  }
}
// expanding ring of particles — used for jumps, dashes, pickups, explosions
function spawnRing(x, y, color, n, speed=2) {
  for (let i=0;i<n;i++){
    const a = (i/n)*Math.PI*2 + Math.random()*0.2, sp = speed*(0.6+Math.random()*0.8);
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.6,color,size:3+Math.random()*2});
  }
}
function explodeFire(x, y, primary=null) {
  spawnRing(x, y, '#ff7b00', game.upgrades.burstFireball ? 22 : 12, game.upgrades.burstFireball ? 3.2 : 2.6);
  spawnBurst(x, y, '#ffd93b', game.upgrades.burstFireball ? 14 : 8);
  if (!game.upgrades.burstFireball) return;
  for (const s of game.enemies) {
    if (!s.alive || s === primary) continue;
    const d = Math.hypot((s.x+s.w/2)-x, (s.y+s.h/2)-y);
    if (d < 72) damageEnemy(s, 1, UPGRADES.burstFireball.color);
  }
}

// "skill unlocked" banner
function showToast(skill, detail=null) {
  const el = document.getElementById('toast');
  if (!el) return;
  const s = SKILLS[skill];
  el.style.setProperty('--tc', s.color);
  el.innerHTML = `<span class="tg">${s.glyph}</span> 解锁 <b>${s.name}</b><br><small>${detail || s.hint}</small>`;
  el.classList.add('show');
  game.toast = { skill, t: 0 };
}
function showUpgradeToast(upgrade) {
  const u = UPGRADES[upgrade];
  if (!u) return;
  showTextToast(`强化 ${u.name}`, u.hint, u.color, u.glyph, { upgrade });
}
function showTextToast(title, detail, color='#ffffff', glyph='!', extra={}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.style.setProperty('--tc', color);
  el.innerHTML = `<span class="tg">${glyph}</span> <b>${title}</b><br><small>${detail || ''}</small>`;
  el.classList.add('show');
  game.toast = { ...extra, kind:extra.kind || title, t:0 };
}
function updateToast() {
  if (!game.toast) return;
  game.toast.t++;
  if (game.toast.t > 150) {                       // ~2.5s
    document.getElementById('toast')?.classList.remove('show');
    game.toast = null;
  }
}
function updateParticles() {
  for (const pt of game.particles) { pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.25; pt.life-=0.03; }
  game.particles = game.particles.filter(pt => pt.life>0);
}
function updateEffects() {
  for (const fx of game.effects) {
    fx.t++; fx.life--;
    if (fx.type === 'bossShock' && !fx.hit && game.state === 'playing') {
      const p = game.player;
      const radius = (fx.radius || 120) * Math.min(1, fx.t / 22);
      const footY = p.y + p.h;
      if (!p.dead && p.invuln === 0 && Math.abs((p.x+p.w/2)-fx.x) < radius &&
          footY > fx.y - 24 && footY < fx.y + 36) {
        fx.hit = true;
        hurt();
      }
    }
  }
  game.effects = game.effects.filter(fx => fx.life > 0);
}

// ---------------------------------------------------------------------------
// Background (parallax) — pre-rendered layers
// ---------------------------------------------------------------------------
let bgFar, bgMid;
function drawBackgroundLayers() {
  const far = getArtImage(`backgrounds.${game.themeId}.far`);
  if (far) ctx.drawImage(far.image, 0, 0, VIEW_W, VIEW_H);
  else if (bgFar) ctx.drawImage(bgFar, 0, 0);

  const mid = getArtImage(`backgrounds.${game.themeId}.mid`);
  const mx = -(game.camX*0.3 % VIEW_W);
  if (mid) {
    ctx.drawImage(mid.image, mx, -game.camY*0.15, VIEW_W, VIEW_H);
    ctx.drawImage(mid.image, mx+VIEW_W, -game.camY*0.15, VIEW_W, VIEW_H);
  } else if (bgMid) {
    ctx.drawImage(bgMid, mx, -game.camY*0.15);
    ctx.drawImage(bgMid, mx+VIEW_W, -game.camY*0.15);
  }
}
function buildBackground() {
  const T = game.theme;
  // Far layer: sky gradient + hills + sun/moon
  bgFar = document.createElement('canvas');
  bgFar.width = VIEW_W; bgFar.height = VIEW_H;
  const f = bgFar.getContext('2d');
  const grad = f.createLinearGradient(0,0,0,VIEW_H);
  grad.addColorStop(0,T.sky[0]); grad.addColorStop(0.6,T.sky[1]); grad.addColorStop(1,T.sky[2]);
  f.fillStyle = grad; f.fillRect(0,0,VIEW_W,VIEW_H);
  f.fillStyle = T.hill;
  for (let i=0;i<6;i++){ const cx=i*200-40, cy=VIEW_H-90, rw=200, rh=150;
    f.beginPath(); f.ellipse(cx,cy,rw,rh,0,Math.PI,0); f.fill(); }
  f.fillStyle = T.sun; f.beginPath(); f.arc(VIEW_W-120,90,46,0,Math.PI*2); f.fill();

  // Mid layer: clouds + trees (themed)
  bgMid = document.createElement('canvas');
  bgMid.width = VIEW_W; bgMid.height = VIEW_H;
  const m = bgMid.getContext('2d');
  m.fillStyle = T.cloud;
  const clouds=[[120,90],[380,60],[640,110],[840,70]];
  for (const [cx,cy] of clouds){ for(const [dx,dy,r] of [[0,0,26],[30,6,20],[-28,8,20],[10,-14,18]]){ m.beginPath(); m.arc(cx+dx,cy+dy,r,0,Math.PI*2); m.fill(); } }
  for (let i=0;i<8;i++){ const tx=i*135+30, base=VIEW_H-60;
    m.fillStyle=T.trunk; m.fillRect(tx-6, base-40, 12, 46);
    m.fillStyle=T.leaf;
    for(const [dx,dy,r] of [[0,-60,34],[-24,-44,26],[24,-44,26],[0,-30,30]]){ m.beginPath(); m.arc(tx+dx,base+dy,r,0,Math.PI*2); m.fill(); }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  ctx.save();
  let sx=0, sy=0;
  if (game.shake>0){ sx=(Math.random()-0.5)*game.shake; sy=(Math.random()-0.5)*game.shake; }
  ctx.clearRect(0,0,VIEW_W,VIEW_H);

  drawBackgroundLayers();

  ctx.translate(-Math.round(game.camX)+sx, -Math.round(game.camY)+sy);

  drawTiles();
  drawSpikes();
  drawCheckpoints();
  drawPickups();
  drawUpgradePickups();
  drawCoins();
  drawGoal();
  drawProjectiles();
  drawEffects();
  drawEnemies();
  drawParticles();
  drawPlayer();

  ctx.restore();
  drawBossHud();
}

function themedArtKeys(domain, name) {
  return [`${domain}.${game.themeId}.${name}`, `${domain}.default.${name}`];
}
function drawTileArt(name, x, y) {
  return drawArtKey(themedArtKeys('tiles', name), null, x, y, { anchorX:0, anchorY:0, w:TS, h:TS });
}

function drawTiles() {
  const c0 = Math.max(0, Math.floor(game.camX/TS));
  const c1 = Math.min(game.cols-1, Math.floor((game.camX+VIEW_W)/TS)+1);
  const r0 = Math.max(0, Math.floor(game.camY/TS));
  const r1 = Math.min(game.rows-1, Math.floor((game.camY+VIEW_H)/TS)+1);
  for (let r=r0; r<=r1; r++) for (let c=c0; c<=c1; c++) {
    const ch = game.tiles[r][c];
    if (ch===' ') continue;
    const x=c*TS, y=r*TS;
    const topOpen = tileAt(c,r-1)===' ';
    if (ch==='=') drawPlatformTile(x,y,topOpen);
    else if (ch==='B') drawBrickTile(x,y);
    else drawGroundTile(x,y,topOpen);
  }
}
function drawGroundTile(x,y,grassTop){
  if (drawTileArt(grassTop ? 'groundTop' : 'ground', x, y)) return;
  const T = game.theme;
  ctx.fillStyle = T.ground; ctx.fillRect(x,y,TS,TS);
  ctx.fillStyle = T.speck;
  ctx.fillRect(x+3,y+6,8,8); ctx.fillRect(x+24,y+14,9,9); ctx.fillRect(x+14,y+26,8,8);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x,y+TS-4,TS,4); ctx.fillRect(x+TS-4,y,4,TS);
  if (grassTop) {
    ctx.fillStyle=T.grass; ctx.fillRect(x,y,TS,10);
    ctx.fillStyle=T.grassLt; ctx.fillRect(x,y,TS,5);
    ctx.fillStyle=T.grass;
    for(let i=0;i<TS;i+=8){ ctx.fillRect(x+i,y+9,4,4); }
  }
  ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.strokeRect(x+0.5,y+0.5,TS-1,TS-1);
}
function drawBrickTile(x,y){
  if (drawTileArt('brick', x, y)) return;
  const T = game.theme;
  ctx.fillStyle=T.brick; ctx.fillRect(x,y,TS,TS);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2;
  ctx.strokeRect(x+1,y+1,TS-2,TS/2-1); ctx.strokeRect(x+1,y+TS/2,TS-2,TS/2-1);
  ctx.beginPath(); ctx.moveTo(x+TS/2,y+1); ctx.lineTo(x+TS/2,y+TS/2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+2,y+2,TS-4,3);
}
function drawPlatformTile(x,y){
  if (drawTileArt('platform', x, y)) return;
  const T = game.theme;
  ctx.fillStyle=T.plat; ctx.fillRect(x,y,TS,TS-14);
  ctx.fillStyle=T.grassLt; ctx.fillRect(x,y,TS,7);
  ctx.fillStyle=T.grass; ctx.fillRect(x,y+7,TS,3);
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(x,y+TS-16,TS,2);
}

function drawSpikes(){
  const T = game.theme;
  for (const sp of game.spikes){
    const x=sp.x, y=sp.y;
    if (drawTileArt('spike', x, y)) continue;
    ctx.fillStyle=T.spike;
    for (let i=0;i<3;i++){
      const bx=x+i*13+3;
      ctx.beginPath(); ctx.moveTo(bx,y+TS); ctx.lineTo(bx+6,y+14); ctx.lineTo(bx+12,y+TS); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle=T.spikeLt;
    for (let i=0;i<3;i++){ const bx=x+i*13+3; ctx.beginPath(); ctx.moveTo(bx+5,y+TS); ctx.lineTo(bx+6,y+16); ctx.lineTo(bx+7,y+TS); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle=T.spikeBase; ctx.fillRect(x,y+TS-4,TS,4);
  }
}

function drawCoins(){
  for (const c of game.coinsArr){
    if (c.taken) continue;
    if (drawArtKey('items.coin', 'spin', c.x, c.y, { animTime:c.spin*20 })) continue;
    const w = Math.abs(Math.cos(c.spin))*14 + 3;   // spin squash
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.fillStyle='#e0a81e';
    ctx.beginPath(); ctx.ellipse(0,0,w,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffd93b';
    ctx.beginPath(); ctx.ellipse(0,0,w*0.7,11,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.6)';
    if (w>7) ctx.fillRect(-2,-7,3,14);
    ctx.restore();
  }
}

// Checkpoint banners — grey & limp until touched, then green & waving.
function drawCheckpoints(){
  for (const cp of game.checkpoints){
    const baseY = cp.y, poleTop = baseY - TS*2.2;
    if (drawArtKey('items.checkpoint', cp.active ? 'active' : 'inactive', cp.x, baseY, { animTime:cp.t*20 })) continue;
    ctx.fillStyle = '#b8c0cc';
    ctx.fillRect(cp.x-2, poleTop, 4, TS*2.2);                       // pole
    ctx.fillStyle = cp.active ? '#7ee787' : '#5a6570';
    ctx.beginPath(); ctx.arc(cp.x, poleTop, 5, 0, Math.PI*2); ctx.fill();
    const wave = cp.active ? Math.sin(cp.t)*4 : 0;
    ctx.fillStyle = cp.active ? '#3fb950' : 'rgba(120,130,145,0.7)';
    ctx.beginPath();
    ctx.moveTo(cp.x+2, poleTop+4);
    ctx.lineTo(cp.x+2+30, poleTop+4+wave+6);
    ctx.lineTo(cp.x+2, poleTop+4+24);
    ctx.closePath(); ctx.fill();
    if (cp.active){                                                 // sparkle when active
      const s = 0.5+0.5*Math.sin(cp.t*2);
      ctx.globalAlpha = 0.3+s*0.4; ctx.fillStyle='#7ee787';
      ctx.beginPath(); ctx.arc(cp.x, poleTop, 9+s*3, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawGoal(){
  if (!game.goal) return;
  const gx=game.goal.x, gy=game.goal.y;
  const locked = !!livingGoalBoss();
  if (drawArtKey('items.goal', 'wave', gx, gy+TS, { animTime:game.time, alpha:locked ? 0.55 : 1 })) {
    if (locked) drawGoalLock(gx, gy);
    return;
  }
  const poleTop = gy - TS*3;
  ctx.fillStyle='#dfe6ee'; ctx.fillRect(gx-3, poleTop, 6, TS*3);   // pole
  ctx.fillStyle=locked ? '#9aa5b1' : '#ffd93b'; ctx.beginPath(); ctx.arc(gx,poleTop,7,0,Math.PI*2); ctx.fill();
  // waving flag
  const t = game.time*0.15;
  ctx.fillStyle=locked ? '#657082' : '#e94560';
  ctx.beginPath();
  ctx.moveTo(gx+3, poleTop+6);
  ctx.lineTo(gx+3+46, poleTop+6+Math.sin(t)*4+8);
  ctx.lineTo(gx+3, poleTop+6+34);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillRect(gx+16, poleTop+18, 8, 8);
  ctx.fillStyle='#7a4a24'; ctx.fillRect(gx-10, gy-6, 20, TS+6);   // base
  ctx.fillStyle='#8a5a2c'; ctx.fillRect(gx-10, gy-6, 20, 5);
  if (locked) drawGoalLock(gx, gy);
}
function drawGoalLock(gx, gy) {
  const y = gy - TS*1.7;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffd93b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(gx+22, y, 10, 0, Math.PI*2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(13,27,42,0.85)';
  ctx.fillRect(gx+12, y+6, 20, 18);
  ctx.strokeRect(gx+12.5, y+6.5, 19, 17);
  ctx.restore();
}

function drawEnemies(){
  for (const s of game.enemies){
    const artKey = s.artKey || (s.elite ? 'enemies.eliteSlime' : 'enemies.slime');
    if (!s.alive){
      if (s.squishT<18 && drawArtKey(artKey, 'dead', s.x+s.w/2, s.y+s.h, { animTime:s.squishT, alpha:1-s.squishT/18 })) continue;
      if (s.squishT<18){ // squish poof
        const k=1-s.squishT/18;
        ctx.fillStyle=s.boss ? `rgba(177,156,255,${k})` : `rgba(123,211,137,${k})`;
        ctx.beginPath(); ctx.ellipse(s.x+s.w/2, s.y+s.h-4, s.w/2*(1+ (1-k)), 6*k,0,0,Math.PI*2); ctx.fill();
      }
      continue;
    }
    const bob = Math.sin(s.animT)*3;
    const cx=s.x+s.w/2, by=s.y+s.h;
    const anim = s.hurtT>0 ? 'hurt' : s.chargeT>0 ? 'charge' : !s.onGround ? 'jump' : 'walk';
    if (drawArtKey(artKey, anim, cx, by, { animTime:s.animT*24, flip:s.vx<0 })) {
      if (s.elite || s.boss) {
        const barW = s.boss ? Math.min(54, s.w+8) : 26;
        ctx.fillStyle = '#2b1240';
        ctx.fillRect(cx-barW/2, s.y-16, barW, 4);
        ctx.fillStyle = s.boss ? '#ffd93b' : '#ff6bcb';
        ctx.fillRect(cx-barW/2+1, s.y-15, (barW-2)*(s.hp/s.maxHp), 2);
      }
      continue;
    }
    const bossKing = s.boss && s.type === 'kingSlime';
    const body = s.boss ? (s.hurtT>0 ? '#e6d7ff' : bossKing ? '#33205f' : '#5b3d96')
               : s.elite ? (s.hurtT>0 ? '#f5a6ff' : '#9d4edd') : (s.hurtT>0 ? '#b8f5c0' : '#5cb867');
    const shine = s.boss ? (bossKing ? '#b19cff' : '#89f7fe') : s.elite ? '#d879ff' : '#7bd389';
    const mouth = s.boss ? '#130b2a' : s.elite ? '#57207a' : '#256b30';
    if (s.elite || s.boss) {
      ctx.globalAlpha = 0.22 + 0.08*Math.sin(s.animT*2);
      ctx.fillStyle = s.boss ? shine : '#d879ff';
      ctx.beginPath(); ctx.ellipse(cx, by-10, s.w*0.7, s.h*0.55, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle=body;
    ctx.beginPath();
    ctx.moveTo(s.x, by);
    ctx.quadraticCurveTo(s.x, s.y+4+bob, cx, s.y+2+bob);
    ctx.quadraticCurveTo(s.x+s.w, s.y+4+bob, s.x+s.w, by);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=shine;
    ctx.beginPath(); ctx.ellipse(cx, s.y+8+bob, s.w*0.32, 5,0,0,Math.PI*2); ctx.fill();
    if (s.elite || s.boss) {
      ctx.fillStyle = s.boss ? '#89f7fe' : '#ffd93b';
      const crownW = s.boss ? 28 : 20;
      ctx.fillRect(cx-crownW/2, s.y-7+bob, crownW, 4);
      ctx.fillRect(cx-5, s.y-12+bob, 4, 7);
      ctx.fillRect(cx+4, s.y-12+bob, 4, 7);
      if (s.boss) ctx.fillRect(cx-1, s.y-16+bob, 4, 10);
      ctx.fillStyle = '#2b1240';
      const barW = s.boss ? Math.min(54, s.w+8) : 26;
      ctx.fillRect(cx-barW/2, s.y-16, barW, 4);
      ctx.fillStyle = s.boss ? '#ffd93b' : '#ff6bcb';
      ctx.fillRect(cx-barW/2+1, s.y-15, (barW-2)*(s.hp/s.maxHp), 2);
    }
    // eyes
    const look = Math.sign(s.vx);
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(cx-6, s.y+13+bob,4,0,Math.PI*2); ctx.arc(cx+6, s.y+13+bob,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a1a2e';
    ctx.beginPath(); ctx.arc(cx-6+look*1.5, s.y+13+bob,2,0,Math.PI*2); ctx.arc(cx+6+look*1.5, s.y+13+bob,2,0,Math.PI*2); ctx.fill();
    // mouth
    ctx.strokeStyle=mouth; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx, s.y+19+bob, 3, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(cx, by, s.w*0.42, 4,0,0,Math.PI*2); ctx.fill();
  }
}

function drawParticles(){
  for (const pt of game.particles){
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x-pt.size/2, pt.y-pt.size/2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// Skill power-ups: floating glowing orb with a unique glyph inside
function drawPickups(){
  for (const pk of game.pickups){
    if (pk.taken) continue;
    const s = SKILLS[pk.skill];
    const bob = Math.sin(pk.bob)*5;
    const x = pk.x, y = pk.y + bob;
    const pulse = 0.5 + 0.5*Math.sin(pk.bob*2);
    const orbAsset = firstArtImage([`items.skillOrb.${pk.skill}`, 'items.skillOrb']);
    if (orbAsset) {
      drawArtFrame(orbAsset, 'pulse', x, y, { animTime:pk.bob*20 });
      if (orbAsset.overlayGlyph) {
        ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(s.glyph, x, y+1);
      }
      for (let i=0;i<3;i++){ const a=pk.bob+i*2.1, r=20;
        ctx.fillStyle='rgba(255,255,255,0.8)';
        ctx.fillRect(x+Math.cos(a)*r-1, y+Math.sin(a)*r-1, 2, 2); }
      continue;
    }
    // outer glow
    ctx.globalAlpha = 0.30 + pulse*0.25;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(x, y, 22+pulse*4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    // orb body
    const g = ctx.createRadialGradient(x-5, y-6, 2, x, y, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, s.color); g.addColorStop(1, shade(s.color, -40));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2); ctx.fill();
    // glyph
    ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(s.glyph, x, y+1);
    // sparkles
    for (let i=0;i<3;i++){ const a=pk.bob+i*2.1, r=20;
      ctx.fillStyle='rgba(255,255,255,0.8)';
      ctx.fillRect(x+Math.cos(a)*r-1, y+Math.sin(a)*r-1, 2, 2); }
  }
  ctx.textAlign='start'; ctx.textBaseline='alphabetic';
}

function drawUpgradePickups(){
  for (const up of game.upgradePickups){
    if (up.taken) continue;
    const u = UPGRADES[up.upgrade];
    if (!u) continue;
    const bob = Math.sin(up.bob)*5;
    const x = up.x, y = up.y + bob;
    const pulse = 0.5 + 0.5*Math.sin(up.bob*2);
    const orbAsset = firstArtImage([`items.upgradeOrb.${up.upgrade}`, 'items.upgradeOrb']);
    if (orbAsset) {
      drawArtFrame(orbAsset, 'pulse', x, y, { animTime:up.bob*20 });
      if (orbAsset.overlayGlyph) {
        ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(u.glyph, x, y+1);
      }
      continue;
    }
    ctx.globalAlpha = 0.34 + pulse*0.26;
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(x, y, 24+pulse*5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI*2); ctx.stroke();
    const g = ctx.createRadialGradient(x-6, y-7, 2, x, y, 17);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, u.color); g.addColorStop(1, shade(u.color, -50));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#102a43'; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(u.glyph, x, y+1);
    for (let i=0;i<4;i++){
      const a=up.bob+i*Math.PI/2, r=22+pulse*3;
      ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillRect(x+Math.cos(a)*r-1, y+Math.sin(a)*r-1, 2, 2);
    }
  }
  ctx.textAlign='start'; ctx.textBaseline='alphabetic';
}

// Fireballs: spinning flame core with a bright trailing glow
function drawProjectiles(){
  for (const fb of game.projectiles){
    if (drawArtKey('fx.fireball', 'fly', fb.x, fb.y, { animTime:game.time, rotation:fb.spin, flip:fb.vx<0 })) continue;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffae00';
    ctx.beginPath(); ctx.arc(fb.x, fb.y, 12, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(fb.x, fb.y); ctx.rotate(fb.spin);
    const g = ctx.createRadialGradient(0,0,1,0,0,8);
    g.addColorStop(0,'#fff3b0'); g.addColorStop(0.5,'#ffd93b'); g.addColorStop(1,'#ff5500');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    // little flame tails
    ctx.fillStyle='#ff7b00';
    ctx.beginPath(); ctx.moveTo(-Math.sign(fb.vx)*6,-4); ctx.lineTo(-Math.sign(fb.vx)*14,0); ctx.lineTo(-Math.sign(fb.vx)*6,4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawEffects() {
  for (const fx of game.effects) {
    if (fx.type === 'groundPoundShock') {
      if (!drawArtKey('fx.groundPoundShock', 'burst', fx.x, fx.y, { animTime:fx.t, alpha:Math.min(1, fx.life / 12) })) {
        ctx.globalAlpha = Math.min(0.7, fx.life / 18);
        ctx.strokeStyle = game.upgrades.quakePound ? UPGRADES.quakePound.color : SKILLS.groundPound.color;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y+8, (fx.radius || POUND_SHOCK)*(fx.t/18), 12, 0, 0, Math.PI*2); ctx.stroke();
      }
    } else if (fx.type === 'bossShock') {
      const k = Math.min(1, fx.t / 22);
      ctx.globalAlpha = Math.max(0, fx.life / 34) * 0.75;
      ctx.strokeStyle = '#b19cff';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(fx.x, fx.y+4, (fx.radius || 120)*k, 14, 0, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = '#b19cff';
      ctx.fillRect(fx.x-(fx.radius || 120)*k, fx.y-2, (fx.radius || 120)*k*2, 4);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBossHud() {
  const boss = game.enemies.find(e => e.alive && e.boss);
  if (!boss || game.state !== 'playing') return;
  const w = 360, h = 14, x = (VIEW_W - w)/2, y = 82;
  ctx.save();
  ctx.fillStyle = 'rgba(13,27,42,0.82)';
  ctx.fillRect(x-10, y-8, w+20, 36);
  ctx.fillStyle = '#dfe6ee';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(boss.name || 'Boss', x, y-2);
  ctx.fillStyle = '#2b1240';
  ctx.fillRect(x, y+4, w, h);
  ctx.fillStyle = boss.phase2 ? '#ff4fd8' : '#ffd93b';
  ctx.fillRect(x+2, y+6, Math.max(0, (w-4) * boss.hp / boss.maxHp), h-4);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.55;
  ctx.strokeRect(x+0.5, y+4.5, w-1, h-1);
  ctx.restore();
}

// darken/lighten a hex color by amt (-255..255) — used for orb shading
function shade(hex, amt){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

// Hero — drawn with vector shapes, animated by walk/jump state
function drawPlayer(){
  const p = game.player;
  if (!p) return;
  if (p.invuln>0 && Math.floor(p.invuln/4)%2===0 && !p.dead) return; // blink
  const cx = p.x + p.w/2, top = p.y;
  const hero = game.hero || CHARACTERS.rookie;
  // dash aura (drawn in world space, behind the hero)
  if (p.dashing > 0) {
    if (!drawArtKey('fx.dashAura', 'active', cx - p.dashDir*6, top+p.h/2, { animTime:game.time, flip:p.dashDir<0, alpha:0.8 })) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = SKILLS.dash.color;
      ctx.beginPath(); ctx.ellipse(cx - p.dashDir*6, top+p.h/2, p.w*0.9, p.h*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // wall-slide friction sparks + cling glow (against the wall side)
  if (p.wallSlide && !p.dead) {
    const wx = p.wallDir>0 ? p.x+p.w : p.x;
    if (!drawArtKey('fx.wallSlide', 'active', wx, top+p.h/2, { animTime:game.time, flip:p.wallDir<0, alpha:0.75 })) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = SKILLS.wallJump.color;
      ctx.beginPath(); ctx.ellipse(wx, top+p.h/2, 5, p.h*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  {
    const dead = p.dead;
    const inAir = !p.onGround && !dead;
    const anim = dead ? 'dead' : inAir ? (p.vy < 0 ? 'jump' : 'fall') : (Math.abs(p.vx) > 0.4 ? 'run' : 'idle');
    if (drawArtKey(`characters.${hero.id || 'rookie'}`, anim, cx, top+p.h, {
      animTime:game.time,
      flip:p.facing<0,
      rotation:dead ? Math.min(p.deadT*0.05, 1.4) : 0,
    })) return;
  }
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(p.facing, 1);
  const dead = p.dead;
  if (dead) ctx.rotate(Math.min(p.deadT*0.05, 1.4));

  const walk = Math.sin(p.animT*3);
  const inAir = !p.onGround && !dead;

  // shadow
  if (!inAir && !dead){ ctx.save(); ctx.scale(p.facing,1);
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0,p.h,13,4,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  // legs
  ctx.fillStyle=hero.pants || '#2b2d42';
  if (inAir){ ctx.fillRect(-9,24,7,12); ctx.fillRect(2,22,7,12); }
  else { const s=walk*4; ctx.fillRect(-9,24,7,12-Math.max(0,s)); ctx.fillRect(2,24,7,12+Math.min(0,s)); ctx.fillRect(-9+s,32,8,4); ctx.fillRect(2-s,32,8,4); }
  // shoes
  ctx.fillStyle='#5a3a1e'; ctx.fillRect(-10,34,9,3); ctx.fillRect(1,34,9,3);

  // body
  ctx.fillStyle=hero.body || '#3a86ff'; ctx.fillRect(-10,12,20,15);
  ctx.fillStyle=hero.bodyDark || '#2f6fd6'; ctx.fillRect(-10,22,20,5);
  // belt
  ctx.fillStyle='#ffd93b'; ctx.fillRect(-10,24,20,3);

  // arm
  ctx.fillStyle='#ffcf9e';
  if (inAir) ctx.fillRect(6,10,6,10); else ctx.fillRect(6,14+walk*2,6,10);

  // head
  ctx.fillStyle='#ffcf9e'; ctx.fillRect(-9,-6,18,18);
  // hair/cap
  ctx.fillStyle=hero.cap || '#e94560'; ctx.fillRect(-10,-9,20,7); ctx.fillRect(6,-6,6,4);
  ctx.fillStyle=hero.capDark || '#c9324b'; ctx.fillRect(-10,-4,20,2);
  // eye
  if (dead){ ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(2,1); ctx.lineTo(7,6); ctx.moveTo(7,1); ctx.lineTo(2,6); ctx.stroke();
  } else {
    ctx.fillStyle='#fff'; ctx.fillRect(2,0,6,6);
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(5,1,3,4);
  }
  // cheek
  ctx.fillStyle='rgba(233,69,96,0.35)'; ctx.fillRect(-6,5,4,3);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main loop (fixed timestep)
// ---------------------------------------------------------------------------
let acc=0, last=performance.now();
const STEP = 1000/60;
function frame(now){
  acc += Math.min(now-last, 100); last=now;
  while (acc >= STEP){ update(); acc -= STEP; }
  updateToast();
  render();
  updateHUD();
  requestAnimationFrame(frame);
}
function updateHUD(){
  document.getElementById('coins').textContent = game.coins;
  document.getElementById('bank').textContent = save.coins;
  document.getElementById('lives').textContent = Math.max(0,game.lives);
  document.getElementById('level').textContent = game.levelIndex+1;
  document.getElementById('time').textContent = Math.floor(game.time/60);
  // skill badges light up when unlocked
  for (const el of document.querySelectorAll('#skills .skill'))
    el.classList.toggle('on', !!game.skills[el.dataset.skill]);
}

// ---------------------------------------------------------------------------
// Screens / flow
// ---------------------------------------------------------------------------
const titleScreen = document.getElementById('titleScreen');
const endScreen   = document.getElementById('endScreen');
const pauseScreen = document.getElementById('pauseScreen');
const levelScreen = document.getElementById('levelScreen');
const shopScreen  = document.getElementById('shopScreen');
const menuStats   = document.getElementById('menuStats');
const levelStats  = document.getElementById('levelStats');
const shopStats   = document.getElementById('shopStats');
const levelGrid   = document.getElementById('levelGrid');
const upgradeGrid = document.getElementById('upgradeGrid');
const skillShopGrid = document.getElementById('skillShopGrid');
const skinGrid = document.getElementById('skinGrid');
const importSaveFile = document.getElementById('importSaveFile');

function hideScreens() {
  for (const el of [titleScreen, endScreen, pauseScreen, levelScreen, shopScreen])
    el?.classList.add('hidden');
}
function statMarkup() {
  const hero = selectedCharacter();
  const ownedSkills = SKILL_IDS.filter(id => save.purchasedSkills[id]).length;
  return `<span>💰 ${save.coins}</span><span>🏁 ${save.highestLevel}/${LEVELS.length}</span>` +
         `<span>❤️ ${3 + save.lifeUpgrades + (hero.lifeBonus || 0)}${save.nextRunLives ? ` +${save.nextRunLives}` : ''}</span>` +
         `<span>🎭 ${hero.name}</span><span>✦ ${ownedSkills}/${SKILL_IDS.length}</span>`;
}
function refreshMetaUI() {
  game.save = save;
  if (game.state !== 'playing') {
    game.hero = selectedCharacter();
    game.stats = makeHeroStats(game.hero);
  }
  const html = statMarkup();
  if (menuStats) menuStats.innerHTML = html;
  if (levelStats) levelStats.innerHTML = html;
  if (shopStats) shopStats.innerHTML = html;
  const bankEl = document.getElementById('bank');
  if (bankEl) bankEl.textContent = save.coins;
}
function showTitle() {
  game.state = 'title';
  hideScreens();
  titleScreen.classList.remove('hidden');
  refreshMetaUI();
  renderLevelSelect();
  renderShop();
}
function showLevelSelect() {
  game.state = 'title';
  hideScreens();
  renderLevelSelect();
  levelScreen.classList.remove('hidden');
}
function showShop() {
  game.state = 'title';
  hideScreens();
  renderShop();
  shopScreen.classList.remove('hidden');
}
function renderLevelSelect() {
  if (!levelGrid) return;
  refreshMetaUI();
  levelGrid.innerHTML = '';
  LEVEL_NAMES.forEach((name, i) => {
    const locked = i + 1 > save.highestLevel;
    const btn = document.createElement('button');
    btn.className = `tile ${locked ? 'locked' : ''}`;
    btn.disabled = locked;
    btn.innerHTML = `<h3>${i+1}. ${name}</h3><p>${locked ? '未解锁' : '已解锁'}</p>` +
                    `<span class="tag">${locked ? '🔒' : '▶'} ${locked ? '继续推进冒险' : '开始挑战'}</span>`;
    if (!locked) btn.addEventListener('click', () => startGame(i));
    levelGrid.appendChild(btn);
  });
}
function renderShop() {
  if (!upgradeGrid || !skillShopGrid || !skinGrid) return;
  refreshMetaUI();
  upgradeGrid.innerHTML = '';
  const lifeMaxed = save.lifeUpgrades >= LIFE_UPGRADE_COSTS.length;
  const lifeCost = LIFE_UPGRADE_COSTS[save.lifeUpgrades] || 0;
  const life = document.createElement('div');
  life.className = 'tile';
  life.innerHTML = `<h3>生命上限 +1</h3><p>当前额外生命：${save.lifeUpgrades}</p>` +
                   `<p class="cost">${lifeMaxed ? '已满级' : `价格 ${lifeCost} 金币`}</p>`;
  const lifeBtn = document.createElement('button');
  lifeBtn.className = 'btn small gold';
  lifeBtn.textContent = lifeMaxed ? '已满级' : '购买';
  lifeBtn.disabled = lifeMaxed || save.coins < lifeCost;
  lifeBtn.addEventListener('click', buyLifeUpgrade);
  life.appendChild(lifeBtn);
  upgradeGrid.appendChild(life);

  const nextRunMaxed = save.nextRunLives >= NEXT_RUN_LIFE_MAX;
  const nextLife = document.createElement('div');
  nextLife.className = 'tile';
  nextLife.innerHTML = `<h3>下次冒险生命 +1</h3><p>下次开局额外生命：${save.nextRunLives}/${NEXT_RUN_LIFE_MAX}</p>` +
                       `<p class="cost">${nextRunMaxed ? '已达上限' : `价格 ${NEXT_RUN_LIFE_COST} 金币`}</p>`;
  const nextLifeBtn = document.createElement('button');
  nextLifeBtn.className = 'btn small alt';
  nextLifeBtn.textContent = nextRunMaxed ? '已达上限' : '购买';
  nextLifeBtn.disabled = nextRunMaxed || save.coins < NEXT_RUN_LIFE_COST;
  nextLifeBtn.addEventListener('click', buyNextRunLife);
  nextLife.appendChild(nextLifeBtn);
  upgradeGrid.appendChild(nextLife);

  skillShopGrid.innerHTML = '';
  for (const id of SKILL_IDS) {
    const item = SHOP_SKILLS[id], s = SKILLS[id];
    const known = isSkillKnown(id);
    const owned = save.purchasedSkills[id];
    const tile = document.createElement('div');
    tile.className = `tile ${known ? '' : 'locked'}`;
    tile.innerHTML = `<h3 style="color:${s.color}">${s.glyph} ${s.name}</h3><p>${s.hint}</p>` +
                     `<p class="cost">${owned ? '已购买' : known ? `价格 ${item.cost} 金币` : `第 ${item.level} 关后发现`}</p>`;
    const btn = document.createElement('button');
    btn.className = 'btn small alt';
    btn.textContent = owned ? '已拥有' : '购买';
    btn.disabled = owned || !known || save.coins < item.cost;
    btn.addEventListener('click', () => buySkill(id));
    tile.appendChild(btn);
    skillShopGrid.appendChild(tile);
  }

  skinGrid.innerHTML = '';
  for (const [id, ch] of Object.entries(CHARACTERS)) {
    const owned = !!save.ownedSkins[id], selected = save.selectedSkin === id;
    const tile = document.createElement('div');
    tile.className = `tile ${owned ? '' : 'locked'}`;
    const skills = ch.skills.length ? ch.skills.map(s => SKILLS[s].name).join(' / ') : '无';
    tile.innerHTML = `<h3><span style="color:${ch.cap}">■</span> ${ch.name}</h3><p>${ch.desc}</p>` +
                     `<p>初始技能：${skills}<br>速度 ${Math.round(ch.move*100)}% · 跳跃 ${Math.round(ch.jump*100)}% · 生命 +${ch.lifeBonus}</p>` +
                     `<p class="cost">${owned ? (selected ? '使用中' : '已拥有') : `价格 ${ch.cost} 金币`}</p>`;
    const btn = document.createElement('button');
    btn.className = selected ? 'btn small gold' : 'btn small alt';
    btn.textContent = selected ? '使用中' : owned ? '选择' : '购买';
    btn.disabled = selected || (!owned && save.coins < ch.cost);
    btn.addEventListener('click', () => buyOrSelectSkin(id));
    tile.appendChild(btn);
    skinGrid.appendChild(tile);
  }
}
function buyLifeUpgrade() {
  const cost = LIFE_UPGRADE_COSTS[save.lifeUpgrades];
  if (cost == null || save.coins < cost) return;
  save.coins -= cost;
  save.lifeUpgrades++;
  commitSave();
}
function buyNextRunLife() {
  if (save.nextRunLives >= NEXT_RUN_LIFE_MAX || save.coins < NEXT_RUN_LIFE_COST) return;
  save.coins -= NEXT_RUN_LIFE_COST;
  save.nextRunLives++;
  commitSave();
}
function buySkill(skill) {
  const item = SHOP_SKILLS[skill];
  if (!item || save.purchasedSkills[skill] || !isSkillKnown(skill) || save.coins < item.cost) return;
  save.coins -= item.cost;
  save.purchasedSkills[skill] = true;
  save.unlockedSkills[skill] = true;
  commitSave();
}
function buyOrSelectSkin(id) {
  const ch = CHARACTERS[id];
  if (!ch) return;
  if (!save.ownedSkins[id]) {
    if (save.coins < ch.cost) return;
    save.coins -= ch.cost;
    save.ownedSkins[id] = true;
  }
  save.selectedSkin = id;
  commitSave();
}
function exportSaveFile() {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixel-quest-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function importSave(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      save = normalizeSave(JSON.parse(String(reader.result || '{}')));
      game.save = save;
      commitSave();
      showShop();
    } catch (e) {
      alert('存档文件无法读取');
    }
  };
  reader.readAsText(file);
}

function startGame(levelIndex = 0){
  actx(); // unlock audio on user gesture
  const maxIndex = Math.min(save.highestLevel - 1, LEVELS.length - 1);
  const startIndex = Math.max(0, Math.min(levelIndex, maxIndex));
  game.state='playing'; game.startLevelIndex=startIndex; game.levelIndex=startIndex; game.coins=0;
  game.hero = selectedCharacter();
  game.stats = makeHeroStats(game.hero);
  const nextRunBonus = save.nextRunLives || 0;
  game.lives = game.stats.maxLives + nextRunBonus;
  if (nextRunBonus > 0) {
    save.nextRunLives = 0;
    commitSave(false);
  }
  game.skills = buildStartingSkills(startIndex);
  game.upgrades = {};
  game.toast = null;
  document.getElementById('toast')?.classList.remove('show');
  parseLevel(startIndex);
  hideScreens();
  updateHUD();
}
function endGame(won){
  game.state = won ? 'win' : 'lose';
  document.getElementById('endTitle').textContent = won ? '🎉 通关啦！' : '💀 游戏结束';
  document.getElementById('endText').innerHTML = won
    ? `你穿越了全部 ${LEVELS.length} 个关卡！<br>本局收集 <b>${game.coins}</b> 枚金币，银行金币 <b>${save.coins}</b>。`
    : `别灰心，再来一次！<br>本局收集 <b>${game.coins}</b> 枚金币，银行金币 <b>${save.coins}</b>。`;
  hideScreens();
  endScreen.classList.remove('hidden');
}
function togglePause(){
  if (game.state==='playing'){ game.state='paused'; pauseScreen.classList.remove('hidden'); }
  else if (game.state==='paused'){ game.state='playing'; pauseScreen.classList.add('hidden'); }
}

document.getElementById('startBtn').addEventListener('click', () => startGame(save.highestLevel-1));
document.getElementById('levelBtn').addEventListener('click', showLevelSelect);
document.getElementById('shopBtn').addEventListener('click', showShop);
document.getElementById('levelBackBtn').addEventListener('click', showTitle);
document.getElementById('shopBackBtn').addEventListener('click', showTitle);
document.getElementById('againBtn').addEventListener('click', () => startGame(game.startLevelIndex));
document.getElementById('menuBtn').addEventListener('click', showTitle);
document.getElementById('exportSaveBtn').addEventListener('click', exportSaveFile);
document.getElementById('importSaveBtn').addEventListener('click', () => importSaveFile?.click());
importSaveFile?.addEventListener('change', e => {
  importSave(e.target.files && e.target.files[0]);
  e.target.value = '';
});

// ---------------------------------------------------------------------------
// Responsive canvas scaling (keep 16:9, integer-ish scale)
// ---------------------------------------------------------------------------
function fit(){
  const pad=24;
  const scale = Math.min((innerWidth-pad)/VIEW_W, (innerHeight-pad)/VIEW_H);
  canvas.style.width  = Math.floor(VIEW_W*scale)+'px';
  canvas.style.height = Math.floor(VIEW_H*scale)+'px';
}
addEventListener('resize', fit); fit();

// Debug hook — inspect/cheat/test from devtools.
window.PIXEL_QUEST = game;
window.__pq = {
  keys, step: () => update(),
  load: (i) => { game.levelIndex = i; parseLevel(i); document.getElementById('level').textContent = i+1; },
  tp:   (x, y) => { game.player.x = x; game.player.y = y; game.player.vx = 0; game.player.vy = 0; },
  give: (s) => { if (s) game.skills[s] = true; else for (const k in game.skills) game.skills[k] = true; },
  upgrade: (u) => { if (u) game.upgrades[u] = true; else for (const k of UPGRADE_IDS) game.upgrades[k] = true; },
  save: () => save,
};

refreshMetaUI();
renderLevelSelect();
renderShop();
updateHUD();
buildBackground();
hydrateSaveFromFile();
requestAnimationFrame(frame);
})();
