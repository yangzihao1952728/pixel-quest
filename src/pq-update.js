/* =========================================================================
   pq-update.js — fixed-timestep simulation, plus the particle/effect and toast
   helpers it drives. update() is the per-frame model tick; render (pq-render.js)
   only draws. Cross-module calls go through PQ.* (parseLevel, damageEnemy, …).
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const {
  GRAVITY, FRICTION, AIR_FRICTION, COYOTE_MAX, BUFFER_MAX,
  DASH_SPEED, DASH_TIME, DASH_CD, FIRE_CD, FIRE_VX, FIRE_LIFE,
  GLIDE_VY, MAGNET_R, POUND_VY, POUND_SHOCK,
  WALL_SLIDE_VY, WALL_JUMP_VX, WALL_JUMP_VY, BOUNCE_VEL,
  TS, VIEW_W, VIEW_H, ENEMY_SPEED, SKILLS, UPGRADES,
} = PQ;
const SFX = PQ.audio.SFX;

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update() {
  const game = PQ.state.game;
  if (game.state !== 'playing') return;
  game.time++;
  const p = game.player;
  const keys = PQ.state.keys;

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
    const rightWall = PQ.isSolidAtPx(p.x+p.w+1, midY) || PQ.isSolidAtPx(p.x+p.w+1, lowY);
    const leftWall  = PQ.isSolidAtPx(p.x-1,     midY) || PQ.isSolidAtPx(p.x-1,     lowY);
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
                            life:FIRE_LIFE, spin:0, pierce:game.skills.quickCast ? 1 : 0 });
    p.fireCD = game.skills.quickCast ? Math.max(10, Math.floor(FIRE_CD * 0.65)) : FIRE_CD; SFX.fire();
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
  PQ.moveEntity(p);
  // keep the hero inside the level — you can never run off the left/right edge into the void
  p.x = Math.max(0, Math.min(game.worldW - p.w, p.x));
  if (p.dashing > 0 && p.hitWall) p.dashing = 0;          // bonk: dash ends on wall
  if (wasPounding && p.onGround) poundShockwave();        // slammed into the ground
  if (Math.abs(p.vx) > 0.4 && p.onGround) p.animT += Math.abs(p.vx)*0.06; else p.animT = 0;
  if (p.invuln>0) p.invuln--;
  if (p.shieldCD>0) p.shieldCD--;

  // fell out of world — but the finish line is NEVER a death: if you're at/past the
  // goal you simply clear the level instead of dying.
  if (p.y > game.worldH + 100) {
    if (game.goal && !PQ.livingGoalBoss() && (p.x + p.w/2) > game.goal.x - TS) return reachGoal();
    return hurt();
  }

  // --- enemies ---
  for (const s of game.enemies) {
    if (!s.alive) { s.squishT++; continue; }
    s.animT += 0.12;
    const wasOnGround = !!s.onGround;
    PQ.updateEnemyIntent(s);
    PQ.updateBossIntent(s);
    s.vy = (s.vy||0) + GRAVITY;
    // capture travel direction BEFORE moveEntity (which zeroes vx on wall hit)
    const dir = Math.sign(s.vx) || 1;
    // ledge detection: is there solid ground just ahead & below?
    const aheadX = dir>0 ? s.x+s.w+1 : s.x-1;
    const footY  = s.y+s.h+2;
    const groundAhead = PQ.isSolidAtPx(aheadX, footY);
    s.hitWall = false;
    PQ.moveEntity(s);
    if (s.boss && !wasOnGround && s.onGround) {
      spawnRing(s.x+s.w/2, s.y+s.h, s.type === 'kingSlime' ? '#b19cff' : '#89f7fe', s.type === 'kingSlime' ? 18 : 12, 2.2);
      game.shake = Math.max(game.shake, s.type === 'kingSlime' ? 8 : 5);
    }
    const speed = s.speed || ENEMY_SPEED;
    if (s.hitWall || (!groundAhead && s.onGround)) s.vx = -dir*speed;
    else s.vx = dir*speed;
    if (s.hurtT > 0) s.hurtT--;

    // collide w/ player
    if (PQ.aabb(p, s)) {
      if (p.dashing > 0 || p.pounding) {                 // dash / pound plows through & shreds
        PQ.damageEnemy(s, p.pounding ? 2 : 1, p.pounding ? SKILLS.groundPound.color : SKILLS.dash.color);
        spawnRing(s.x+s.w/2, s.y+s.h/2, (p.pounding?SKILLS.groundPound:SKILLS.dash).color, 8, 2);
        game.shake = Math.max(game.shake, 4);
      } else if (p.invuln===0) {
        const stomping = p.vy > 1 && (p.y + p.h) - s.y < (s.boss ? 32 : 22);
        if (stomping) {
          PQ.damageEnemy(s, 1, s.elite ? '#d879ff' : '#7bd389');
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
    if (PQ.isSolidAtPx(fb.x, fb.y)) { fb.life = 0; explodeFire(fb.x, fb.y); }
    else for (const s of game.enemies) {
      const hitW = s.boss ? s.w/2 + 8 : 18;
      const hitH = s.boss ? s.h/2 + 8 : 20;
      if (s.alive && Math.abs(fb.x-(s.x+s.w/2))<hitW && Math.abs(fb.y-(s.y+s.h/2))<hitH) {
        PQ.damageEnemy(s, 1, '#ffae00');
        if (fb.pierce > 0) {
          fb.pierce--;
          fb.x += Math.sign(fb.vx || 1) * 16;
        } else {
          fb.life=0;
        }
        explodeFire(fb.x, fb.y, s);
        game.shake = Math.max(game.shake, 4); break;
      }
    }
  }
  game.projectiles = game.projectiles.filter(fb => fb.life>0 && fb.x>-50 && fb.x<game.worldW+50);

  // --- hostile bolts from ranged enemies and bosses ---
  for (const ep of game.enemyProjectiles) {
    ep.life--;
    ep.vy += ep.gravity || 0;
    ep.x += ep.vx; ep.y += ep.vy;
    if (game.time % 2 === 0)
      game.particles.push({ x:ep.x, y:ep.y, vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.6,
                            life:0.35, color:ep.color || '#89f7fe', size:2+Math.random()*2 });
    if (PQ.isSolidAtPx(ep.x, ep.y)) {
      ep.life = 0;
      spawnRing(ep.x, ep.y, ep.color || '#89f7fe', 6, 1.5);
      continue;
    }
    if (!p.dead && p.invuln === 0 && Math.abs((p.x+p.w/2)-ep.x) < p.w/2 + (ep.r || 7) &&
        Math.abs((p.y+p.h/2)-ep.y) < p.h/2 + (ep.r || 7)) {
      ep.life = 0;
      spawnRing(ep.x, ep.y, ep.color || '#89f7fe', 10, 2.2);
      return hurt();
    }
  }
  game.enemyProjectiles = game.enemyProjectiles.filter(ep => ep.life>0 && ep.x>-80 && ep.x<game.worldW+80 && ep.y>-80 && ep.y<game.worldH+120);

  // --- skill power-ups ---
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    pk.bob += 0.08;
    if (Math.abs((p.x+p.w/2)-pk.x)<30 && Math.abs((p.y+p.h/2)-pk.y)<34) {
      pk.taken=true; game.skills[pk.skill]=true; PQ.unlockSkillInSave(pk.skill); SFX.power();
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
      cp.active = true; game.checkpoint = PQ.findSafeRespawn(cp, p);
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
      c.taken=true; PQ.addCollectedCoin(1); SFX.coin();
      spawnBurst(c.x, c.y, '#ffd93b', 6);
    }
  }

  // --- treasures: rare, higher-value pickups such as diamonds ---
  for (const tr of game.treasures) {
    if (tr.taken) continue;
    tr.spin += 0.12;
    if (game.skills.magnet) {
      const dx = (p.x+p.w/2)-tr.x, dy = (p.y+p.h/2)-tr.y, d = Math.hypot(dx,dy);
      if (d < MAGNET_R*0.9 && d > 1) { tr.vx += dx/d*0.9; tr.vy += dy/d*0.9; }
      tr.vx *= 0.86; tr.vy *= 0.86; tr.x += tr.vx; tr.y += tr.vy;
    }
    if (Math.abs((p.x+p.w/2)-tr.x) < 28 && Math.abs((p.y+p.h/2)-tr.y) < 32) {
      tr.taken = true; PQ.addCollectedCoin(tr.value || 5); SFX.coin();
      spawnRing(tr.x, tr.y, '#7dd3fc', 14, 2.8);
      spawnBurst(tr.x, tr.y, '#d7fbff', 10);
    }
  }

  // --- spikes ---
  for (const sp of game.spikes) {
    if (p.invuln===0 && p.x < sp.x+TS-6 && p.x+p.w > sp.x+6 && p.y+p.h > sp.y+16 && p.y < sp.y+TS)
      return hurt();
  }

  // --- goal ---
  if (game.goal && Math.abs((p.x+p.w/2)-game.goal.x) < 30 && p.y+p.h > game.goal.y-10) {
    const gate = PQ.livingGoalBoss();
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
  const game = PQ.state.game;
  const p = game.player;
  if (p.dead) return;
  if (game.skills.aegis && p.shieldCD <= 0) {
    p.shieldCD = 720;
    p.invuln = Math.max(p.invuln, 85);
    game.shake = Math.max(game.shake, 8);
    SFX.power();
    spawnRing(p.x+p.w/2, p.y+p.h/2, SKILLS.aegis.color, 28, 3.4);
    spawnBurst(p.x+p.w/2, p.y+p.h/2, '#d7fbff', 12);
    showTextToast(SKILLS.aegis.name, '抵挡了一次伤害', SKILLS.aegis.color, SKILLS.aegis.glyph, { kind:'aegis' });
    return;
  }
  p.dead = true; p.deadT = 0; p.vy = -10; SFX.hurt();
  game.shake = 10;
  spawnBurst(p.x+p.w/2, p.y+p.h/2, '#e94560', 14);
}
function respawnOrLose() {
  const game = PQ.state.game;
  game.lives--;
  if (game.lives <= 0) { PQ.endGame(false); return; }
  // respawn at last checkpoint if one was touched, else level start
  const r = game.checkpoint || game.spawn;
  const p = PQ.makePlayer(r.x, r.y);
  p.invuln = 60;
  game.player = p;
}
// ground-pound landing: shockwave that flattens nearby enemies
function poundShockwave() {
  const game = PQ.state.game;
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
      PQ.damageEnemy(s, s.elite ? 2 : 1, shockColor);
      spawnRing(s.x+s.w/2, s.y+s.h/2, shockColor, 6, 2);
    }
  }
}
function reachGoal() {
  const game = PQ.state.game;
  SFX.win();
  spawnBurst(game.goal.x, game.goal.y, '#ffd93b', 30);
  if (game.levelIndex < PQ.LEVELS.length-1) {
    PQ.unlockLevel(game.levelIndex + 2);
    game.levelIndex++;
    PQ.parseLevel(game.levelIndex);
    document.getElementById('level').textContent = game.levelIndex+1;
  } else {
    PQ.unlockLevel(PQ.LEVELS.length);
    PQ.endGame(true);
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
function spawnBurst(x, y, color, n) {
  const game = PQ.state.game;
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, sp = 1+Math.random()*4;
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,color,size:2+Math.random()*3});
  }
}
// expanding ring of particles — used for jumps, dashes, pickups, explosions
function spawnRing(x, y, color, n, speed=2) {
  const game = PQ.state.game;
  for (let i=0;i<n;i++){
    const a = (i/n)*Math.PI*2 + Math.random()*0.2, sp = speed*(0.6+Math.random()*0.8);
    game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.6,color,size:3+Math.random()*2});
  }
}
function explodeFire(x, y, primary=null) {
  const game = PQ.state.game;
  spawnRing(x, y, '#ff7b00', game.upgrades.burstFireball ? 22 : 12, game.upgrades.burstFireball ? 3.2 : 2.6);
  spawnBurst(x, y, '#ffd93b', game.upgrades.burstFireball ? 14 : 8);
  if (!game.upgrades.burstFireball) return;
  for (const s of game.enemies) {
    if (!s.alive || s === primary) continue;
    const d = Math.hypot((s.x+s.w/2)-x, (s.y+s.h/2)-y);
    if (d < 72) PQ.damageEnemy(s, 1, UPGRADES.burstFireball.color);
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
  PQ.state.game.toast = { skill, t: 0 };
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
  PQ.state.game.toast = { ...extra, kind:extra.kind || title, t:0 };
}
function updateToast() {
  const game = PQ.state.game;
  if (!game.toast) return;
  game.toast.t++;
  if (game.toast.t > 150) {                       // ~2.5s
    document.getElementById('toast')?.classList.remove('show');
    game.toast = null;
  }
}
function updateParticles() {
  const game = PQ.state.game;
  for (const pt of game.particles) { pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.25; pt.life-=0.03; }
  game.particles = game.particles.filter(pt => pt.life>0);
}
function updateEffects() {
  const game = PQ.state.game;
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

Object.assign(PQ, {
  update, hurt, respawnOrLose, poundShockwave, reachGoal,
  spawnBurst, spawnRing, explodeFire, updateParticles, updateEffects,
  showToast, showUpgradeToast, showTextToast, updateToast,
});
})();
