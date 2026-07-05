/* =========================================================================
   pq-render.js — all canvas drawing: parallax background, tiles, props,
   enemies, player, particles, effects, boss HUD. Procedural fallback art is
   used whenever a manifest image is missing. Includes two de-duplications:
   drawEnemyHpBar (was inlined twice in drawEnemies) and drawOrb (collapses the
   near-identical skill-orb / upgrade-orb drawers into one parameterized helper).
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const ctx = PQ.ctx;
const { VIEW_W, VIEW_H, TS, POUND_SHOCK, SKILLS, UPGRADES, CHARACTERS } = PQ;
const { drawArtKey, drawArtFrame, firstArtImage, getArtImage } = PQ.art;

// ---------------------------------------------------------------------------
// Background (parallax) — pre-rendered layers
// ---------------------------------------------------------------------------
let bgFar, bgMid;
function drawBackgroundLayers() {
  const game = PQ.state.game;
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
  const T = PQ.state.game.theme;
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
  const game = PQ.state.game;
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
  drawTreasures();
  drawGoal();
  drawProjectiles();
  drawEnemyProjectiles();
  drawEffects();
  drawEnemies();
  drawParticles();
  drawPlayer();

  ctx.restore();
  drawBossHud();
}

function themedArtKeys(domain, name) {
  return [`${domain}.${PQ.state.game.themeId}.${name}`, `${domain}.default.${name}`];
}
function drawTileArt(name, x, y) {
  return drawArtKey(themedArtKeys('tiles', name), null, x, y, { anchorX:0, anchorY:0, w:TS, h:TS });
}

function drawTiles() {
  const game = PQ.state.game;
  const c0 = Math.max(0, Math.floor(game.camX/TS));
  const c1 = Math.min(game.cols-1, Math.floor((game.camX+VIEW_W)/TS)+1);
  const r0 = Math.max(0, Math.floor(game.camY/TS));
  const r1 = Math.min(game.rows-1, Math.floor((game.camY+VIEW_H)/TS)+1);
  for (let r=r0; r<=r1; r++) for (let c=c0; c<=c1; c++) {
    const ch = game.tiles[r][c];
    if (ch===' ') continue;
    const x=c*TS, y=r*TS;
    const topOpen = PQ.tileAt(c,r-1)===' ';
    if (ch==='=') drawPlatformTile(x,y,topOpen);
    else if (ch==='B') drawBrickTile(x,y);
    else drawGroundTile(x,y,topOpen);
  }
}
function drawGroundTile(x,y,grassTop){
  if (drawTileArt(grassTop ? 'groundTop' : 'ground', x, y)) return;
  const T = PQ.state.game.theme;
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
  const T = PQ.state.game.theme;
  ctx.fillStyle=T.brick; ctx.fillRect(x,y,TS,TS);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2;
  ctx.strokeRect(x+1,y+1,TS-2,TS/2-1); ctx.strokeRect(x+1,y+TS/2,TS-2,TS/2-1);
  ctx.beginPath(); ctx.moveTo(x+TS/2,y+1); ctx.lineTo(x+TS/2,y+TS/2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+2,y+2,TS-4,3);
}
function drawPlatformTile(x,y){
  if (drawTileArt('platform', x, y)) return;
  const T = PQ.state.game.theme;
  ctx.fillStyle=T.plat; ctx.fillRect(x,y,TS,TS-14);
  ctx.fillStyle=T.grassLt; ctx.fillRect(x,y,TS,7);
  ctx.fillStyle=T.grass; ctx.fillRect(x,y+7,TS,3);
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(x,y+TS-16,TS,2);
}

function drawSpikes(){
  const T = PQ.state.game.theme;
  for (const sp of PQ.state.game.spikes){
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
  for (const c of PQ.state.game.coinsArr){
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

function drawTreasures(){
  for (const tr of PQ.state.game.treasures){
    if (tr.taken) continue;
    const y = tr.y + Math.sin(tr.spin)*4;
    if (drawArtKey(`items.${tr.type || 'diamond'}`, 'spin', tr.x, y, { animTime:tr.spin*20 })) continue;
    const pulse = 0.5 + 0.5*Math.sin(tr.spin*2);
    ctx.save(); ctx.translate(tr.x, y); ctx.rotate(Math.sin(tr.spin)*0.2);
    ctx.globalAlpha = 0.32 + pulse*0.18;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.arc(0, 0, 20+pulse*4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d7fbff';
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(13,-3); ctx.lineTo(8,13); ctx.lineTo(-8,13); ctx.lineTo(-13,-3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(5,-3); ctx.lineTo(0,13); ctx.lineTo(-5,-3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-4,-10,3,8);
    ctx.restore();
  }
}

// Checkpoint banners — grey & limp until touched, then green & waving.
function drawCheckpoints(){
  for (const cp of PQ.state.game.checkpoints){
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
  const game = PQ.state.game;
  if (!game.goal) return;
  const gx=game.goal.x, gy=game.goal.y;
  const locked = !!PQ.livingGoalBoss();
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

// Dedup A — boss / elite HP bar. Drawn identically on both the art-asset path
// and the procedural fallback path; lifted here so it lives in one place.
function drawEnemyHpBar(s, cx) {
  if (!(s.elite || s.boss)) return;
  const barW = s.boss ? Math.min(54, s.w + 8) : 26;
  ctx.fillStyle = '#2b1240';
  ctx.fillRect(cx - barW/2, s.y - 16, barW, 4);
  ctx.fillStyle = s.boss ? '#ffd93b' : '#ff6bcb';
  ctx.fillRect(cx - barW/2 + 1, s.y - 15, (barW - 2) * (s.hp / s.maxHp), 2);
}

function drawEnemies(){
  for (const s of PQ.state.game.enemies){
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
      drawEnemyHpBar(s, cx);
      continue;
    }
    const bossKing = s.boss && s.type === 'kingSlime';
    const enemyPalette = s.type === 'spitter'
      ? ['#198f90', '#79f2ff', '#064e55']
      : s.type === 'charger'
        ? ['#b45309', '#ffe066', '#5f2504']
        : s.type === 'brute'
          ? ['#7f1d1d', '#ff9f1c', '#3f0d0d']
          : null;
    const body = s.boss ? (s.hurtT>0 ? '#e6d7ff' : bossKing ? '#33205f' : '#5b3d96')
               : enemyPalette ? (s.hurtT>0 ? '#fdd7aa' : enemyPalette[0])
               : s.elite ? (s.hurtT>0 ? '#f5a6ff' : '#9d4edd') : (s.hurtT>0 ? '#b8f5c0' : '#5cb867');
    const shine = s.boss ? (bossKing ? '#b19cff' : '#89f7fe') : enemyPalette ? enemyPalette[1] : s.elite ? '#d879ff' : '#7bd389';
    const mouth = s.boss ? '#130b2a' : enemyPalette ? enemyPalette[2] : s.elite ? '#57207a' : '#256b30';
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
      drawEnemyHpBar(s, cx);
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
    if (s.type === 'spitter') {
      ctx.fillStyle = shine;
      ctx.fillRect(cx+look*9-2, s.y+18+bob, 5, 3);
    } else if (s.type === 'charger') {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(cx-13, s.y+5+bob, 6, 8);
      ctx.fillRect(cx+7, s.y+5+bob, 6, 8);
    } else if (s.type === 'brute') {
      ctx.fillStyle = '#111827';
      ctx.fillRect(cx-16, s.y+18+bob, 32, 4);
    }
    ctx.fillStyle='rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(cx, by, s.w*0.42, 4,0,0,Math.PI*2); ctx.fill();
  }
}

function drawParticles(){
  for (const pt of PQ.state.game.particles){
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x-pt.size/2, pt.y-pt.size/2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// Dedup B — one parameterized glowing-orb drawer serves both skill power-ups
// and run-only upgrades. The two differ only in a handful of numbers (glow
// radius/alpha, an optional white stroke ring, gradient stops/shade, glyph
// colour, sparkle count/step); those live in SKILL_ORB_CONF / UPGRADE_ORB_CONF.
const SKILL_ORB_CONF = {
  glyphColor: '#1a1a2e',
  artOverlayColor: '#1a1a2e',
  artSparkles: { count:3, r:20, step:2.1 },
  glow: [0.30, 0.25, 22, 4],
  strokeRing: false,
  grad: { offX:5, offY:6, r:16, mid:0.4, shade:-40 },
  orbR: 15,
  fbSparkles: { count:3, r0:20, r1:0, step:2.1 },
};
const UPGRADE_ORB_CONF = {
  glyphColor: '#102a43',
  artOverlayColor: '#1a1a2e',
  artSparkles: null,
  glow: [0.34, 0.26, 24, 5],
  strokeRing: true,
  grad: { offX:6, offY:7, r:17, mid:0.45, shade:-50 },
  orbR: 15,
  fbSparkles: { count:4, r0:22, r1:3, step:Math.PI/2 },
};
function drawOrb(x, y, bob, color, glyph, artKeys, conf) {
  const pulse = 0.5 + 0.5*Math.sin(bob*2);
  const orbAsset = firstArtImage(artKeys);
  if (orbAsset) {
    drawArtFrame(orbAsset, 'pulse', x, y, { animTime:bob*20 });
    if (orbAsset.overlayGlyph) {
      ctx.fillStyle = conf.artOverlayColor; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(glyph, x, y+1);
    }
    if (conf.artSparkles) {
      const { count, r, step } = conf.artSparkles;
      for (let i=0;i<count;i++){ const a=bob+i*step;
        ctx.fillStyle='rgba(255,255,255,0.8)';
        ctx.fillRect(x+Math.cos(a)*r-1, y+Math.sin(a)*r-1, 2, 2); }
    }
    return;
  }
  const [glowA0, glowA1, glowR0, glowR1] = conf.glow;
  ctx.globalAlpha = glowA0 + pulse*glowA1;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, glowR0+pulse*glowR1, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  if (conf.strokeRing) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI*2); ctx.stroke();
  }
  const gd = conf.grad;
  const g = ctx.createRadialGradient(x-gd.offX, y-gd.offY, 2, x, y, gd.r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(gd.mid, color); g.addColorStop(1, shade(color, gd.shade));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, conf.orbR, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = conf.glyphColor; ctx.font = 'bold 18px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(glyph, x, y+1);
  const sp = conf.fbSparkles;
  for (let i=0;i<sp.count;i++){ const a=bob+i*sp.step, r=sp.r0+pulse*sp.r1;
    ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.fillRect(x+Math.cos(a)*r-1, y+Math.sin(a)*r-1, 2, 2); }
}

// Skill power-ups: floating glowing orb with a unique glyph inside
function drawPickups(){
  const game = PQ.state.game;
  for (const pk of game.pickups){
    if (pk.taken) continue;
    const s = SKILLS[pk.skill];
    const y = pk.y + Math.sin(pk.bob)*5;
    drawOrb(pk.x, y, pk.bob, s.color, s.glyph, [`items.skillOrb.${pk.skill}`, 'items.skillOrb'], SKILL_ORB_CONF);
  }
  ctx.textAlign='start'; ctx.textBaseline='alphabetic';
}

function drawUpgradePickups(){
  const game = PQ.state.game;
  for (const up of game.upgradePickups){
    if (up.taken) continue;
    const u = UPGRADES[up.upgrade];
    if (!u) continue;
    const y = up.y + Math.sin(up.bob)*5;
    drawOrb(up.x, y, up.bob, u.color, u.glyph, [`items.upgradeOrb.${up.upgrade}`, 'items.upgradeOrb'], UPGRADE_ORB_CONF);
  }
  ctx.textAlign='start'; ctx.textBaseline='alphabetic';
}

// Fireballs: spinning flame core with a bright trailing glow
function drawProjectiles(){
  for (const fb of PQ.state.game.projectiles){
    if (drawArtKey('fx.fireball', 'fly', fb.x, fb.y, { animTime:PQ.state.game.time, rotation:fb.spin, flip:fb.vx<0 })) continue;
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

function drawEnemyProjectiles(){
  for (const ep of PQ.state.game.enemyProjectiles){
    if (drawArtKey('fx.enemyBolt', 'fly', ep.x, ep.y, { animTime:PQ.state.game.time, rotation:PQ.state.game.time*0.1 })) continue;
    const r = ep.r || 7;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = ep.color || '#89f7fe';
    ctx.beginPath(); ctx.arc(ep.x, ep.y, r+7, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ep.color || '#89f7fe';
    ctx.beginPath(); ctx.arc(ep.x, ep.y, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ep.x-2, ep.y-r+2, 3, r);
  }
  ctx.globalAlpha = 1;
}

function drawEffects() {
  const game = PQ.state.game;
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
  const game = PQ.state.game;
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
  const game = PQ.state.game;
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

Object.assign(PQ, {
  render, buildBackground, drawBackgroundLayers,
  themedArtKeys, drawTileArt,
  drawTiles, drawGroundTile, drawBrickTile, drawPlatformTile,
  drawSpikes, drawCoins, drawTreasures, drawCheckpoints, drawGoal, drawGoalLock,
  drawEnemyHpBar, drawEnemies, drawParticles,
  drawOrb, drawPickups, drawUpgradePickups,
  drawProjectiles, drawEnemyProjectiles, drawEffects, drawBossHud, drawPlayer, shade,
});
})();
