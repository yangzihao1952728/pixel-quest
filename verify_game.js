'use strict';
const fs = require('fs');
const vm = require('vm');

function loadLevelData() {
  const src = fs.readFileSync('data/pixel-quest-levels.js', 'utf8');
  const sandbox = { window:{} };
  vm.runInNewContext(src, sandbox, { filename:'data/pixel-quest-levels.js' });
  const data = sandbox.window.PIXEL_QUEST_LEVEL_DATA;
  if (!data || !Array.isArray(data.levels)) throw new Error('PIXEL_QUEST_LEVEL_DATA.levels not found');
  return data;
}

const DATA = loadLevelData();
const LEVELS = DATA.levels;
const PICKUPS = DATA.pickups || {};
const CHECKPOINTS = DATA.checkpoints || {};
const ELITES = DATA.elites || {};
const UPGRADES = DATA.upgrades || {};
const BOSSES = DATA.bosses || {};

const SOLID = new Set(Array.isArray(DATA.solidTiles) ? DATA.solidTiles : ['#','B','=']);
const cell = (rows,r,c) => { const l = rows[r] || ''; return l[c] || ' '; };
const solid = ch => SOLID.has(ch);
const NEW_THEMES = new Set(['crystal','fungal','gearworks','neon','clockwork','void']);
const OLD_THEMES = new Set(['meadow','cave','sky','lava','snow']);
const EXPECTED_UPGRADES = {
  6: 'starJump',
  7: 'floatGlide',
  8: 'dashChain',
  9: 'burstFireball',
  10: 'wallFocus',
  11: 'quakePound',
};
const EXPECTED_BOSSES = {
  6: 'miniSlime',
  11: 'kingSlime',
};

function findMarks(rows, chars) {
  const out = [];
  rows.forEach((line, r) => {
    for (let c=0; c<line.length; c++) if (chars.includes(line[c])) out.push({ ch:line[c], r, c });
  });
  return out;
}

let ok = true;
function failGlobal(msg) {
  console.error(`GLOBAL FAIL ${msg}`);
  ok = false;
}
if (LEVELS.length !== 12) failGlobal(`expected 12 levels, got ${LEVELS.length}`);
if (!Array.isArray(DATA.names) || DATA.names.length !== LEVELS.length)
  failGlobal(`names length ${DATA.names && DATA.names.length} != levels length ${LEVELS.length}`);
if (!Array.isArray(DATA.themes) || DATA.themes.length !== LEVELS.length)
  failGlobal(`themes length ${DATA.themes && DATA.themes.length} != levels length ${LEVELS.length}`);

LEVELS.forEach((rows, idx) => {
  const W = Math.max(...rows.map(r => r.length)), H = rows.length;
  const prob = [];
  const theme = DATA.themes && DATA.themes[idx];
  if (idx >= 6) {
    if (!NEW_THEMES.has(theme)) prob.push(`level ${idx+1} must use a new theme, got ${theme}`);
    if (OLD_THEMES.has(theme)) prob.push(`level ${idx+1} reuses old theme ${theme}`);
  }
  if (!rows.some(r => r.includes('P'))) prob.push('no P');
  let gr=-1, gc=-1;
  rows.forEach((r,ri) => { const ci = r.indexOf('G'); if (ci >= 0) { gr=ri; gc=ci; } });
  if (gc < 0) prob.push('no G');
  else {
    if (!solid(cell(rows,gr+1,gc))) prob.push(`goal@${gc} no ground below`);
    for (let c=gc; c<W; c++) {
      let grounded=false;
      for (let r=gr+1; r<H; r++) if (solid(cell(rows,r,c))) { grounded=true; break; }
      if (!grounded) { prob.push(`DEATH PIT after goal @col${c}`); break; }
    }
  }

  const hazards = findMarks(rows, '^s');
  for (const cp of (CHECKPOINTS[idx] || [])) {
    const { col:c, row:r } = cp;
    if (!solid(cell(rows,r+1,c)) && !solid(cell(rows,r,c))) prob.push(`cp@${c},${r} no ground`);
    for (const h of hazards) {
      if (h.ch === '^' && Math.abs(h.c-c) <= 1 && Math.abs(h.r-r) <= 1) prob.push(`cp@${c},${r} too close to spike@${h.c},${h.r}`);
      if (h.ch === 's' && Math.abs(h.c-c) <= 2 && Math.abs(h.r-r) <= 1) prob.push(`cp@${c},${r} too close to slime@${h.c},${h.r}`);
    }
  }

  for (const pk of (PICKUPS[idx] || [])) {
    const { col:c, row:r } = pk;
    if (solid(cell(rows,r,c))) prob.push(`pickup@${c},${r} embedded`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(H-1,r+4); rr++) if (solid(cell(rows,rr,c))) { support=true; break; }
    if (!support) prob.push(`pickup@${c},${r} no support`);
  }

  const levelUpgrades = UPGRADES[idx] || [];
  if (idx >= 6) {
    if (levelUpgrades.length !== 1) prob.push(`expected exactly 1 upgrade, got ${levelUpgrades.length}`);
    if (EXPECTED_UPGRADES[idx] && levelUpgrades[0] && levelUpgrades[0].upgrade !== EXPECTED_UPGRADES[idx])
      prob.push(`expected upgrade ${EXPECTED_UPGRADES[idx]}, got ${levelUpgrades[0].upgrade}`);
  }
  for (const up of levelUpgrades) {
    const { col:c, row:r } = up;
    if (solid(cell(rows,r,c))) prob.push(`upgrade@${c},${r} embedded`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(H-1,r+4); rr++) if (solid(cell(rows,rr,c))) { support=true; break; }
    if (!support) prob.push(`upgrade@${c},${r} no support`);
  }

  for (const e of (ELITES[idx] || [])) {
    const { col:c, row:r } = e;
    if (solid(cell(rows,r,c))) prob.push(`elite@${c},${r} embedded`);
    const alreadySlime = cell(rows,r,c) === 's';
    let support = alreadySlime;
    for (let rr=r+1; rr<=Math.min(H-1,r+4); rr++) if (solid(cell(rows,rr,c))) { support=true; break; }
    if (!support) prob.push(`elite@${c},${r} no support`);
  }

  const levelBosses = BOSSES[idx] || [];
  if (EXPECTED_BOSSES[idx]) {
    if (!levelBosses.some(b => b.type === EXPECTED_BOSSES[idx])) prob.push(`missing boss ${EXPECTED_BOSSES[idx]}`);
    if (!levelBosses.some(b => b.type === EXPECTED_BOSSES[idx] && b.gateGoal)) prob.push(`boss ${EXPECTED_BOSSES[idx]} must gate goal`);
  }
  for (const b of levelBosses) {
    const { col:c, row:r } = b;
    if (solid(cell(rows,r,c))) prob.push(`boss ${b.type}@${c},${r} embedded`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(H-1,r+4); rr++) if (solid(cell(rows,rr,c))) { support=true; break; }
    if (!support) prob.push(`boss ${b.type}@${c},${r} no support`);
    if (!Number.isFinite(Number(b.hp)) || Number(b.hp) <= 0) prob.push(`boss ${b.type}@${c},${r} invalid hp`);
  }

  console.log(`L${idx+1} w=${W} h=${H} ${prob.length ? 'FAIL '+prob.join(' | ') : 'OK'}`);
  if (prob.length) ok = false;
});
console.log('ALL OK =', ok);
process.exit(ok ? 0 : 1);
