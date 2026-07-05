/* =========================================================================
   pq-core.js — Pixel Quest namespace root.
   Owns: canvas/context, view + physics + skill-tuning constants, skill /
   upgrade / shop / character / theme metadata, external level data, and the
   shared mutable-state shell (PQ.state). Loaded before every other module.
   ========================================================================= */
window.PQ = window.PQ || {};
(() => {
'use strict';
const PQ = window.PQ;

// ---------------------------------------------------------------------------
// Canvas & view constants
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
PQ.canvas = canvas;
PQ.ctx = ctx;
PQ.VIEW_W = canvas.width;    // 960
PQ.VIEW_H = canvas.height;   // 540
PQ.TS = 40;                  // tile size in px

// ---------------------------------------------------------------------------
// Physics & skill-tuning constants
// ---------------------------------------------------------------------------
PQ.GRAVITY      = 0.75;
PQ.MOVE_ACCEL   = 0.9;
PQ.MOVE_MAX     = 5.2;
PQ.FRICTION     = 0.80;
PQ.AIR_FRICTION = 0.92;
PQ.JUMP_VEL     = 14.2;
PQ.AIR_JUMP_VEL = 13.0;      // double-jump is slightly weaker
PQ.COYOTE_MAX   = 6;         // frames of coyote time
PQ.BUFFER_MAX   = 7;         // frames of jump-buffer
PQ.ENEMY_SPEED  = 1.3;
PQ.BOUNCE_VEL   = 9.5;       // stomp bounce
// --- skill tuning ---
PQ.DASH_SPEED   = 13;        // dash velocity
PQ.DASH_TIME    = 11;        // dash duration (frames)
PQ.DASH_CD      = 42;        // dash cooldown (frames)
PQ.FIRE_CD      = 22;        // fireball cooldown (frames)
PQ.FIRE_VX      = 11;        // fireball speed
PQ.FIRE_LIFE    = 55;        // fireball range (frames)
PQ.GLIDE_VY     = 1.6;       // max fall speed while gliding
PQ.MAGNET_R     = 135;       // coin attract radius
PQ.POUND_VY     = 19;        // ground-pound descent speed
PQ.POUND_SHOCK  = 95;        // ground-pound kill radius (px)
PQ.WALL_SLIDE_VY = 2.4;      // max fall speed while clinging to a wall
PQ.WALL_JUMP_VX  = 8.5;      // horizontal kick off a wall
PQ.WALL_JUMP_VY  = 13.2;     // vertical kick off a wall

// ---------------------------------------------------------------------------
// Skill metadata: icon/color/label shown in HUD & toast
// ---------------------------------------------------------------------------
PQ.SKILLS = {
  doubleJump:  { name:'二段跳',   glyph:'✦', color:'#8ecae6', hint:'空中再跳一次' },
  dash:        { name:'闪电冲刺', glyph:'⚡', color:'#ffe066', hint:'Shift 冲刺 · 无敌穿敌' },
  fireball:    { name:'烈焰火球', glyph:'✺', color:'#ff6b35', hint:'J / X 发射火球' },
  glide:       { name:'风之滑翔', glyph:'✈', color:'#b388ff', hint:'空中长按跳跃缓慢滑翔' },
  magnet:      { name:'金币磁铁', glyph:'◎', color:'#ff5c8a', hint:'自动吸附附近金币' },
  groundPound: { name:'震地震击', glyph:'▼', color:'#ff9f1c', hint:'空中按 S/↓ 下砸 · 范围震敌' },
  wallJump:    { name:'飞檐走壁', glyph:'⇄', color:'#4dd6c4', hint:'贴墙下滑 · 蹬墙跳跃' },
  aegis:       { name:'星盾护体', glyph:'◆', color:'#7dd3fc', hint:'周期性抵挡一次伤害' },
  quickCast:   { name:'疾速施法', glyph:'✹', color:'#ffb703', hint:'火球冷却降低，并可贯穿一次敌人' },
};
PQ.SKILL_IDS = Object.keys(PQ.SKILLS);
PQ.UPGRADES = {
  starJump:      { name:'星跃',     glyph:'✦', color:'#bde0fe', skill:'doubleJump',  hint:'二段跳更高，并获得短暂无伤反馈' },
  floatGlide:    { name:'浮游滑翔', glyph:'✈', color:'#cdb4db', skill:'glide',       hint:'滑翔下降更慢，首次滑翔轻微上抬' },
  dashChain:     { name:'连环冲刺', glyph:'⚡', color:'#f9dc5c', skill:'dash',        hint:'击败敌人刷新冲刺，落地冷却更快' },
  burstFireball: { name:'爆裂火球', glyph:'✺', color:'#ff8f3d', skill:'fireball',    hint:'火球命中后产生小范围爆炸' },
  wallFocus:     { name:'墙面蓄力', glyph:'⇄', color:'#64dfdf', skill:'wallJump',    hint:'墙滑更慢，蹬墙跳更强' },
  quakePound:    { name:'裂地冲击', glyph:'▼', color:'#f4a261', skill:'groundPound', hint:'震地范围扩大，并可打断终局 boss' },
};
PQ.UPGRADE_IDS = Object.keys(PQ.UPGRADES);

// ---------------------------------------------------------------------------
// Save / shop metadata. A real save file lives under save/pixel-quest-save.json.
// localStorage remains the browser-safe auto-save layer for runtime progress.
// ---------------------------------------------------------------------------
PQ.SAVE_KEY = 'pixelQuest.save.v2';
PQ.SAVE_JSON_FILE = 'save/pixel-quest-save.json';
PQ.LIFE_UPGRADE_COSTS = [35, 70, 120];
PQ.NEXT_RUN_LIFE_COST = 28;
PQ.NEXT_RUN_LIFE_MAX = 3;

PQ.SHOP_SKILLS = {
  doubleJump:  { cost:45,  level:1 },
  dash:        { cost:60,  level:2 },
  fireball:    { cost:75,  level:3 },
  glide:       { cost:85,  level:4 },
  magnet:      { cost:80,  level:5 },
  groundPound: { cost:95,  level:6 },
  wallJump:    { cost:105, level:6 },
  aegis:       { cost:135, level:7 },
  quickCast:   { cost:150, level:10 },
};

PQ.CHARACTERS = {
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
  volt: {
    id:'volt', name:'电光游侠', cost:220, desc:'更快的战斗角色，自带冲刺与疾速施法',
    body:'#ffd166', bodyDark:'#d4941e', cap:'#118ab2', capDark:'#0b5f7e', pants:'#1d3557',
    move:1.08, jump:0.98, lifeBonus:0, skills:['dash','quickCast']
  },
  oracle: {
    id:'oracle', name:'星辉先知', cost:240, desc:'收集与容错更强，自带磁铁和星盾',
    body:'#cdb4db', bodyDark:'#9d77b8', cap:'#7dd3fc', capDark:'#3b82f6', pants:'#2b1240',
    move:0.96, jump:1.02, lifeBonus:0, skills:['magnet','aegis']
  },
};

// ---------------------------------------------------------------------------
// Per-level themes (fallback visual palette diversity).
// ---------------------------------------------------------------------------
PQ.THEMES = {
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

// ---------------------------------------------------------------------------
// Level maps and per-level placements are external data resources, loaded via
// data/pixel-quest-levels.js (must load before these modules).
// ---------------------------------------------------------------------------
const LEVEL_DATA = window.PIXEL_QUEST_LEVEL_DATA || {};
PQ.LEVEL_DATA = LEVEL_DATA;
const LEVELS = Array.isArray(LEVEL_DATA.levels) ? LEVEL_DATA.levels : [];
if (!LEVELS.length) throw new Error('Missing PIXEL_QUEST_LEVEL_DATA.levels. Load data/pixel-quest-levels.js before the PQ modules.');
PQ.LEVELS = LEVELS;
PQ.LEVEL_NAMES = Array.isArray(LEVEL_DATA.names) && LEVEL_DATA.names.length
  ? LEVEL_DATA.names
  : LEVELS.map((_, i) => `Level ${i + 1}`);
PQ.LEVEL_THEMES = Array.isArray(LEVEL_DATA.themes) ? LEVEL_DATA.themes : [];
PQ.LEVEL_PICKUPS = LEVEL_DATA.pickups || {};
PQ.LEVEL_CHECKPOINTS = LEVEL_DATA.checkpoints || {};
PQ.LEVEL_ELITES = LEVEL_DATA.elites || {};
PQ.LEVEL_ENEMIES = LEVEL_DATA.enemies || {};
PQ.LEVEL_UPGRADES = LEVEL_DATA.upgrades || {};
PQ.LEVEL_BOSSES = LEVEL_DATA.bosses || {};
PQ.LEVEL_TREASURES = LEVEL_DATA.treasures || {};

// ---------------------------------------------------------------------------
// Shared mutable state. `save` is reassigned on import/apply — always read it
// fresh via PQ.state.save. `game` / `keys` are stable references, mutated in place.
// ---------------------------------------------------------------------------
PQ.state = { game:null, save:null, keys:null };
})();
