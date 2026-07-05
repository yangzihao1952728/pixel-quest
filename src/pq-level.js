/* =========================================================================
   pq-level.js — world model: level parsing, entity factories, tile/physics
   collision, enemy & boss behaviour. Reads external LEVEL_DATA; emits particles
   / toasts / shake via cross-module helpers (PQ.spawnBurst, PQ.spawnRing, …).
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const ctx = PQ.ctx;
const {
  TS, GRAVITY, ENEMY_SPEED, SKILLS, UPGRADES, THEMES,
  LEVELS, LEVEL_THEMES, LEVEL_PICKUPS, LEVEL_UPGRADES, LEVEL_CHECKPOINTS,
  LEVEL_ELITES, LEVEL_ENEMIES, LEVEL_BOSSES, LEVEL_TREASURES, LEVEL_DATA,
} = PQ;
const SFX = PQ.audio.SFX;

const SOLID = new Set(Array.isArray(LEVEL_DATA.solidTiles) ? LEVEL_DATA.solidTiles : ['#','B','=']);
PQ.SOLID = SOLID;

function parseLevel(idx) {
  const game = PQ.state.game;
  const raw = LEVELS[idx];
  const cols = Math.max(...raw.map(r => r.length));
  const rows = raw.length;
  const tiles = [];
  game.enemies = []; game.coinsArr = []; game.treasures = []; game.spikes = []; game.particles = []; game.effects = [];
  game.projectiles = []; game.enemyProjectiles = []; game.pickups = []; game.upgradePickups = []; game.checkpoints = [];
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
  applyLevelEnemies(idx);
  applyLevelBosses(idx);
  applyLevelTreasures(idx);
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
  PQ.buildBackground();
}

function makePlayer(x, y) {
  return { x, y, w:26, h:36, vx:0, vy:0, onGround:false,
           facing:1, coyote:0, buffer:0, animT:0, dead:false, deadT:0, invuln:0,
           airJumps:0,        // remaining mid-air jumps (needs double-jump skill)
           dashing:0, dashCD:0, dashDir:1,
           fireCD:0, poundCD:0, shieldCD:0,
           wallDir:0, wallSlide:false, wallKick:0, wallKickFrom:0,   // wall-jump state
           gliding:false, glideLiftUsed:false, pounding:false };
}
function makeSlime(x, y) {
  return { x:x+6, y:y+TS-26, w:28, h:26, vx:ENEMY_SPEED, speed:ENEMY_SPEED, baseSpeed:ENEMY_SPEED,
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
function makeSpecialEnemy(x, y, spec={}) {
  const type = spec.type || 'spitter';
  if (type === 'spitter') return makeSpitter(x, y);
  if (type === 'charger') return makeCharger(x, y);
  if (type === 'brute') return makeBrute(x, y);
  return makeSlime(x, y);
}
function makeSpitter(x, y) {
  const e = makeSlime(x, y);
  const bottom = e.y + e.h, cx = e.x + e.w/2;
  Object.assign(e, {
    type:'spitter', elite:true, ranged:true, hp:2, maxHp:2,
    w:34, h:30, speed:ENEMY_SPEED*0.55, baseSpeed:ENEMY_SPEED*0.55,
    shootCD:45 + Math.floor(Math.random()*45), artKey:'enemies.spitter',
  });
  e.x = cx - e.w/2; e.y = bottom - e.h; e.vx = Math.sign(e.vx || 1) * e.speed;
  return e;
}
function makeCharger(x, y) {
  const e = makeSlime(x, y);
  const bottom = e.y + e.h, cx = e.x + e.w/2;
  Object.assign(e, {
    type:'charger', elite:true, aggressive:true, hp:2, maxHp:2,
    w:38, h:30, speed:ENEMY_SPEED*1.15, baseSpeed:ENEMY_SPEED*1.15,
    chargeSpeed:ENEMY_SPEED*3.35, chargeCD:80, chargeT:0, artKey:'enemies.charger',
  });
  e.x = cx - e.w/2; e.y = bottom - e.h; e.vx = Math.sign(e.vx || 1) * e.speed;
  return e;
}
function makeBrute(x, y) {
  const e = makeSlime(x, y);
  const bottom = e.y + e.h, cx = e.x + e.w/2;
  Object.assign(e, {
    type:'brute', elite:true, hp:3, maxHp:3,
    w:44, h:36, speed:ENEMY_SPEED*0.82, baseSpeed:ENEMY_SPEED*0.82,
    jumpCD:90 + Math.floor(Math.random()*45), artKey:'enemies.brute',
  });
  e.x = cx - e.w/2; e.y = bottom - e.h; e.vx = Math.sign(e.vx || 1) * e.speed;
  return e;
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
    jumpCD:isKing ? 100 : 70, attackCD:isKing ? 140 : 70, boltCD:isKing ? 115 : 0, chargeT:0, interruptT:0,
    artKey:isKing ? 'enemies.bigBoss' : 'enemies.miniBoss',
    name:isKing ? '星渊王' : '水晶史莱姆',
  };
}

// ---------------------------------------------------------------------------
// Tile helpers
// ---------------------------------------------------------------------------
function tileAt(col, row) {
  const game = PQ.state.game;
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
  const game = PQ.state.game;
  if (!game.skills[skill] && !reserved.has(skill)) return { skill, replaced:false };
  const choices = PQ.SKILL_IDS.filter(id => !game.skills[id] && !reserved.has(id));
  if (!choices.length) return null;
  return { skill:choices[Math.floor(Math.random()*choices.length)], replaced:true };
}
function applyLevelElites(idx) {
  const game = PQ.state.game;
  for (const sp of (LEVEL_ELITES[idx] || [])) {
    const x = sp.col * TS, y = sp.row * TS;
    const existing = game.enemies.find(e => Math.abs((e.x+e.w/2) - (x+TS/2)) < TS*0.55 &&
                                           Math.abs((e.y+e.h) - (y+TS)) < TS*0.7);
    if (existing) promoteElite(existing);
    else game.enemies.push(makeEliteSlime(x, y));
  }
}
function applyLevelEnemies(idx) {
  const game = PQ.state.game;
  for (const sp of (LEVEL_ENEMIES[idx] || [])) {
    game.enemies.push(makeSpecialEnemy(sp.col * TS, sp.row * TS, sp));
  }
}
function applyLevelBosses(idx) {
  const game = PQ.state.game;
  for (const sp of (LEVEL_BOSSES[idx] || [])) {
    game.enemies.push(makeBossSlime(sp.col * TS, sp.row * TS, sp));
  }
}
function applyLevelTreasures(idx) {
  const game = PQ.state.game;
  for (const tr of (LEVEL_TREASURES[idx] || [])) {
    const value = Math.max(1, Math.floor(Number(tr.value) || 5));
    game.treasures.push({
      x:tr.col*TS+TS/2, y:tr.row*TS+TS/2, type:tr.type || 'diamond',
      value, taken:false, spin:Math.random()*Math.PI*2, vx:0, vy:0,
    });
  }
}
function livingGoalBoss() {
  const game = PQ.state.game;
  return game.enemies.find(e => e.alive && e.boss && e.gateGoal) || null;
}
function damageEnemy(e, amount=1, color='#7bd389') {
  const game = PQ.state.game;
  if (!e.alive) return false;
  e.hp -= amount;
  e.hurtT = 10;
  PQ.spawnBurst(e.x+e.w/2, e.y+e.h/2, color, e.boss ? 18 : e.elite ? 12 : 8);
  if (e.hp <= 0) {
    e.alive = false; e.squishT = 0; SFX.stomp();
    PQ.spawnRing(e.x+e.w/2, e.y+e.h/2, color, e.boss ? 24 : e.elite ? 12 : 8, e.boss ? 3.4 : e.elite ? 2.8 : 2);
    if (game.upgrades.dashChain) game.player.dashCD = 0;
    if (e.boss) {
      game.shake = Math.max(game.shake, 16);
      PQ.showTextToast(e.name || 'Boss', '已击败，终点已解锁', '#ffd93b', '★');
    }
    return true;
  }
  SFX.stomp();
  if (e.boss && e.type === 'kingSlime' && e.hp <= e.maxHp/2 && !e.phase2) {
    e.phase2 = true;
    game.shake = Math.max(game.shake, 10);
    PQ.spawnRing(e.x+e.w/2, e.y+e.h/2, '#b19cff', 24, 3);
  }
  e.vx = -Math.sign(e.vx || 1) * (e.speed || ENEMY_SPEED);
  return false;
}
function spawnEnemyProjectile(source, opts={}) {
  const game = PQ.state.game;
  const p = game.player;
  if (!p) return;
  const sx = source.x + source.w/2;
  const sy = source.y + source.h*0.45;
  const dx = (p.x+p.w/2) - sx;
  const dy = (p.y+p.h*0.45) - sy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const speed = opts.speed || 4.2;
  game.enemyProjectiles.push({
    x:sx, y:sy,
    vx:opts.vx ?? dx/len*speed,
    vy:opts.vy ?? dy/len*speed,
    r:opts.r || 7,
    life:opts.life || 120,
    color:opts.color || '#89f7fe',
    type:opts.type || 'bolt',
    gravity:opts.gravity || 0,
  });
  PQ.spawnBurst(sx, sy, opts.color || '#89f7fe', opts.burst || 4);
}
function updateEnemyIntent(s) {
  const game = PQ.state.game;
  const p = game.player;
  if (!p || s.boss) return;
  if (s.type === 'spitter') {
    s.speed = s.baseSpeed;
    if (s.shootCD > 0) s.shootCD--;
    const dx = (p.x+p.w/2) - (s.x+s.w/2);
    const dy = (p.y+p.h/2) - (s.y+s.h/2);
    if (Math.abs(dx) < 380 && Math.abs(dy) < 120) {
      s.vx = Math.sign(dx || s.vx || 1) * s.speed;
      if (s.shootCD <= 0) {
        spawnEnemyProjectile(s, { speed:4.1, color:'#79f2ff', type:'spit', life:105 });
        s.shootCD = 95;
      }
    }
  } else if (s.type === 'charger') {
    if (s.chargeCD > 0) s.chargeCD--;
    const dx = (p.x+p.w/2) - (s.x+s.w/2);
    const dy = Math.abs((p.y+p.h/2) - (s.y+s.h/2));
    if (s.chargeT > 0) {
      s.chargeT--;
      s.speed = s.chargeSpeed;
      s.vx = Math.sign(s.vx || dx || 1) * s.speed;
    } else {
      s.speed = s.baseSpeed;
      if (Math.abs(dx) < 270 && dy < 72 && s.chargeCD <= 0 && s.onGround) {
        s.chargeT = 28;
        s.chargeCD = 110;
        s.vx = Math.sign(dx || 1) * s.chargeSpeed;
        PQ.spawnRing(s.x+s.w/2, s.y+s.h/2, '#ffe066', 8, 1.8);
      }
    }
  } else if (s.type === 'brute') {
    s.speed = s.baseSpeed;
    if (s.jumpCD > 0) s.jumpCD--;
    if (s.onGround && s.jumpCD <= 0) {
      s.vy = -8.6;
      s.jumpCD = 110;
    }
  }
}
function isSpikeNearRect(x, y, w, h) {
  const game = PQ.state.game;
  return game.spikes.some(sp => x < sp.x+TS-6 && x+w > sp.x+6 && y+h > sp.y+16 && y < sp.y+TS);
}
function isEnemyNearPoint(x, y, radius=70) {
  const game = PQ.state.game;
  return game.enemies.some(e => e.alive && Math.hypot((e.x+e.w/2)-x, (e.y+e.h/2)-y) < radius);
}
function canStandAt(x, y, w=26, h=36) {
  const probes = [[x+2,y+2],[x+w-2,y+2],[x+2,y+h-2],[x+w-2,y+h-2]];
  if (probes.some(([px,py]) => isSolidAtPx(px, py))) return false;
  if (!isSolidAtPx(x+w*0.5, y+h+2)) return false;
  return !isSpikeNearRect(x, y, w, h) && !isEnemyNearPoint(x+w/2, y+h/2);
}
function findSafeRespawn(cp, player) {
  const game = PQ.state.game;
  const p = player || game.player;
  const w = p?.w || 26, h = p?.h || 36;
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
function updateBossIntent(s) {
  const game = PQ.state.game;
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
  if (s.boltCD > 0) s.boltCD--;
  if (s.type === 'miniSlime' && s.onGround && s.jumpCD <= 0) {
    s.vy = -9.2;
    s.jumpCD = s.hp <= s.maxHp/2 ? 48 : 68;
    game.shake = Math.max(game.shake, 3);
  }
  if (s.type === 'miniSlime' && s.attackCD <= 0) {
    spawnEnemyProjectile(s, { speed:4.4, color:'#89f7fe', type:'crystal', life:105 });
    s.attackCD = s.hp <= s.maxHp/2 ? 78 : 105;
  }
  if (s.type === 'kingSlime' && s.onGround) {
    if (s.boltCD <= 0) {
      const color = s.phase2 ? '#ff4fd8' : '#b19cff';
      spawnEnemyProjectile(s, { speed:s.phase2 ? 4.6 : 3.8, color, type:'voidBolt', life:120 });
      if (s.phase2) {
        spawnEnemyProjectile(s, { vx:-3.8, vy:-1.4, gravity:0.055, color, type:'voidBolt', life:130 });
        spawnEnemyProjectile(s, { vx:3.8, vy:-1.4, gravity:0.055, color, type:'voidBolt', life:130 });
      }
      s.boltCD = s.phase2 ? 92 : 125;
    }
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
  const game = PQ.state.game;
  const cx = s.x+s.w/2, y = s.y+s.h;
  game.effects.push({ type:'bossShock', x:cx, y, t:0, life:34, radius:s.phase2 ? 150 : 110, hit:false });
  PQ.spawnRing(cx, y, '#b19cff', 22, 3.2);
  game.shake = Math.max(game.shake, 12);
}

Object.assign(PQ, {
  parseLevel, makePlayer, makeSlime, makeEliteSlime, promoteElite, makeBossSlime,
  makeSpecialEnemy, makeSpitter, makeCharger, makeBrute,
  tileAt, isSolidAtPx, moveEntity, aabb,
  resolvePickupSkill, applyLevelElites, applyLevelEnemies, applyLevelBosses, applyLevelTreasures,
  livingGoalBoss, damageEnemy, spawnEnemyProjectile, updateEnemyIntent,
  isSpikeNearRect, isEnemyNearPoint, canStandAt, findSafeRespawn,
  updateBossIntent, spawnBossShockwave,
});
})();
