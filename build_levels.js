/* Generates levels 4-12 as aligned tile strings and validates gameplay-critical
   invariants (player start, safe goal with no death-pit after it, ground under
   every checkpoint, pickup, upgrade, and boss). Prints JS ready to paste into
   data/pixel-quest-levels.js. */
'use strict';

const ROWS = 12;
const FLOOR = 10;               // main ground row (0-indexed); row 11 is bedrock

// ---- a tiny grid builder ----
function makeGrid(W) {
  return Array.from({ length: ROWS }, () => Array(W).fill(' '));
}
function floor(g, c0, c1, rows = [FLOOR, 11]) {           // solid ground [c0,c1]
  for (const r of rows) for (let c = c0; c <= c1; c++) g[r][c] = '#';
}
function plat(g, r, c0, c1, ch = '=') { for (let c = c0; c <= c1; c++) g[r][c] = ch; }
function coins(g, r, cs) { for (const c of cs) g[r][c] = 'o'; }
function coinRow(g, r, c0, c1, step = 2) { for (let c = c0; c <= c1; c += step) g[r][c] = 'o'; }
function spikes(g, r, c0, c1) { for (let c = c0; c <= c1; c++) g[r][c] = '^'; }
function put(g, r, c, ch) { g[r][c] = ch; }

function toStrings(g) { return g.map(row => row.join('').replace(/\s+$/,'')); }

// ---------------------------------------------------------------------------
// Level 4 — LAVA : learn GLIDE. Long gaps you clear by gliding. Safe finish.
// glide pickup at col 10,row 6 ; checkpoints col 30 & 70 row 9
// ---------------------------------------------------------------------------
function level4() {
  const W = 100; const g = makeGrid(W);
  // opening plateau
  floor(g, 0, 16);
  put(g, FLOOR - 1, 2, 'P');                    // start
  plat(g, 7, 8, 12);                            // step up to the glide orb (orb floats at row6)
  coins(g, 5, [9, 10, 11]);
  // lava gap 17-23 (fall = death pit -> respawns at checkpoint/start)
  floor(g, 24, 40);                             // checkpoint col30 lands here
  spikes(g, FLOOR - 1, 34, 36);
  coinRow(g, 4, 18, 23);                         // coins across the glide gap (reward)
  plat(g, 5, 19, 22);
  // gap 41-49
  floor(g, 50, 66);
  plat(g, 6, 43, 47); coins(g, 5, [44, 45, 46]);
  spikes(g, FLOOR - 1, 56, 59);
  // gap 67-74
  floor(g, 75, 99);                             // checkpoint col80 lands here
  plat(g, 6, 68, 72); coins(g, 5, [69, 70, 71]);
  // GOAL on solid ground with ground continuing to the map edge (no fall!)
  put(g, FLOOR - 1, 96, 'G');
  coinRow(g, FLOOR - 2, 84, 92, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 5 — SNOW : learn MAGNET. Coin-dense, slippery-feeling gaps.
// magnet pickup col30,row5 ; checkpoints col40 & 90 row9
// ---------------------------------------------------------------------------
function level5() {
  const W = 105; const g = makeGrid(W);
  floor(g, 0, 14);
  put(g, FLOOR - 1, 2, 'P');
  put(g, 8, 6, 's');
  plat(g, 6, 10, 14); coins(g, 5, [11, 12, 13]);
  // gap
  floor(g, 22, 42);                              // extends to cover magnet area + checkpoint 40
  plat(g, 6, 28, 32);                            // step to the magnet orb (orb floats row5)
  coinRow(g, 3, 24, 34);                          // magnet makes these easy to sweep
  put(g, FLOOR - 1, 26, 's');
  // gap
  floor(g, 44, 60);
  plat(g, 6, 48, 53); coins(g, 5, [49, 50, 51]);
  spikes(g, FLOOR - 1, 56, 58);
  put(g, 8, 52, 's');
  // gap
  floor(g, 68, 99);                               // checkpoint col90 lands here
  plat(g, 5, 62, 66); coinRow(g, 4, 62, 66, 1);
  put(g, 8, 74, 's'); put(g, 8, 82, 's');
  spikes(g, FLOOR - 1, 86, 88);
  // GOAL with ground to the edge
  put(g, FLOOR - 1, 96, 'G');
  coinRow(g, FLOOR - 2, 90, 94, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 6 — CAVE FINALE : learn GROUND-POUND then WALL-JUMP. A vertical shaft
// requires wall-jumping up. Everything before the goal is safe standing.
// groundPound col50,row4 ; wallJump col66,row8 ; checkpoints col30,65,102 row9
// ---------------------------------------------------------------------------
function level6() {
  const W = 116; const g = makeGrid(W);
  // ---- opening: slimes + spikes over a continuous floor ----
  floor(g, 0, 20);
  put(g, FLOOR - 1, 2, 'P');
  put(g, 8, 8, 's'); put(g, 8, 14, 's');
  plat(g, 6, 10, 14); coins(g, 5, [11, 12, 13]);
  spikes(g, FLOOR - 1, 17, 18);
  // ---- gap -> mid section (checkpoint col30 sits on this floor) ----
  floor(g, 26, 46);
  plat(g, 6, 22, 25); coins(g, 5, [23, 24]);
  put(g, 8, 34, 's'); put(g, 8, 40, 's');
  spikes(g, FLOOR - 1, 37, 38);
  // ground-pound orb floats at row4 over a platform at row6
  plat(g, 6, 48, 52); coins(g, 5, [49, 51]);
  floor(g, 48, 52);                               // solid landing under the pound platform
  // ---- gap -> wall-jump section (main floor stays clear & safe) ----
  floor(g, 58, 84);
  // wall-jump orb floats at row6 over a low ledge (row8) just before the chute
  plat(g, 8, 62, 66); coins(g, 7, [63, 64, 65]);
  // OPTIONAL bonus chute: two walls hang ABOVE the floor (rows 2-7) so you can
  // still walk underneath — the coins up top are only reachable by wall-kicking.
  for (let r = 2; r <= 7; r++) { g[r][72] = 'B'; g[r][76] = 'B'; }
  coins(g, 3, [73, 74, 75]); coins(g, 5, [73, 75]);
  // ---- final safe run (checkpoint col95 lives here) ----
  floor(g, 79, 99);
  put(g, 8, 88, 's'); put(g, 8, 94, 's');
  spikes(g, FLOOR - 1, 91, 92);
  // ---- final stretch to the goal, ground continues to the edge ----
  floor(g, 100, 115);
  put(g, FLOOR - 1, 110, 'G');
  coinRow(g, FLOOR - 2, 102, 108, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 7 — CRYSTAL : all-skill review, starJump upgrade, mini boss gate.
// ---------------------------------------------------------------------------
function level7() {
  const W = 140; const g = makeGrid(W);
  floor(g, 0, 18);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 8, 14); coins(g, 6, [9, 10, 11, 12]);
  floor(g, 24, 46);
  put(g, FLOOR - 1, 31, 's'); spikes(g, FLOOR - 1, 39, 41);
  plat(g, 6, 50, 56); coinRow(g, 5, 50, 56);
  floor(g, 58, 72);
  put(g, FLOOR - 1, 64, 's');
  plat(g, 7, 76, 82); coinRow(g, 6, 76, 82);
  floor(g, 86, 99);
  put(g, FLOOR - 1, 92, 's'); spikes(g, FLOOR - 1, 96, 97);
  floor(g, 104, 139);
  plat(g, 6, 108, 112); coinRow(g, 5, 108, 112);
  put(g, FLOOR - 1, 134, 'G');
  coinRow(g, 8, 121, 131, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 8 — FUNGAL : air time and glide control, floatGlide upgrade.
// ---------------------------------------------------------------------------
function level8() {
  const W = 146; const g = makeGrid(W);
  floor(g, 0, 14);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 9, 13); coins(g, 6, [10, 11, 12]);
  floor(g, 24, 36);
  put(g, FLOOR - 1, 30, 's');
  plat(g, 6, 39, 45); coinRow(g, 4, 39, 45);
  plat(g, 4, 50, 55); coinRow(g, 3, 50, 55);
  floor(g, 62, 76); spikes(g, FLOOR - 1, 68, 70);
  plat(g, 5, 80, 86); coinRow(g, 4, 80, 86);
  floor(g, 91, 105);
  put(g, FLOOR - 1, 98, 's');
  plat(g, 6, 110, 116); coinRow(g, 5, 110, 116);
  floor(g, 122, 145);
  put(g, FLOOR - 1, 138, 'G');
  coinRow(g, 8, 128, 136, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 9 — GEARWORKS : speed lanes and dash rhythm, dashChain upgrade.
// ---------------------------------------------------------------------------
function level9() {
  const W = 150; const g = makeGrid(W);
  floor(g, 0, 16);
  put(g, FLOOR - 1, 2, 'P'); put(g, FLOOR - 1, 8, 's');
  plat(g, 7, 20, 26); coinRow(g, 6, 20, 26);
  floor(g, 31, 48); spikes(g, FLOOR - 1, 38, 40);
  plat(g, 7, 51, 57); coins(g, 6, [52, 53, 54, 55]);
  floor(g, 62, 78); put(g, FLOOR - 1, 70, 's');
  plat(g, 5, 82, 89); coinRow(g, 4, 82, 89);
  floor(g, 94, 111); spikes(g, FLOOR - 1, 102, 104);
  plat(g, 6, 114, 120); coinRow(g, 5, 114, 120);
  floor(g, 124, 149);
  put(g, FLOOR - 1, 143, 'G');
  coinRow(g, 8, 130, 140, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 10 — NEON : enemy clusters and fireball routing, burstFireball upgrade.
// ---------------------------------------------------------------------------
function level10() {
  const W = 152; const g = makeGrid(W);
  floor(g, 0, 20);
  put(g, FLOOR - 1, 2, 'P'); put(g, FLOOR - 1, 9, 's'); put(g, FLOOR - 1, 15, 's');
  plat(g, 6, 24, 30); coinRow(g, 5, 24, 30);
  floor(g, 36, 55); put(g, FLOOR - 1, 44, 's');
  plat(g, 6, 50, 55); coins(g, 5, [51, 52, 53]);
  floor(g, 61, 80);
  put(g, FLOOR - 1, 67, 's'); put(g, FLOOR - 1, 75, 's'); spikes(g, FLOOR - 1, 77, 78);
  plat(g, 5, 84, 91); coinRow(g, 4, 84, 91);
  floor(g, 96, 116); put(g, FLOOR - 1, 105, 's'); spikes(g, FLOOR - 1, 112, 113);
  plat(g, 6, 120, 126); coinRow(g, 5, 120, 126);
  floor(g, 130, 151);
  put(g, FLOOR - 1, 145, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 11 — CLOCKWORK : wall-jump shafts, wallFocus upgrade.
// ---------------------------------------------------------------------------
function level11() {
  const W = 148; const g = makeGrid(W);
  floor(g, 0, 14);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 9, 13); coins(g, 6, [10, 11, 12]);
  floor(g, 22, 36); spikes(g, FLOOR - 1, 29, 31);
  for (let r = 3; r <= 8; r++) { g[r][42] = 'B'; g[r][47] = 'B'; }
  coinRow(g, 4, 43, 46);
  floor(g, 51, 64); put(g, FLOOR - 1, 58, 's');
  plat(g, 6, 56, 61); coins(g, 5, [57, 58, 59]);
  for (let r = 2; r <= 8; r++) { g[r][74] = 'B'; g[r][80] = 'B'; }
  coinRow(g, 3, 75, 79);
  floor(g, 85, 100); put(g, FLOOR - 1, 92, 's');
  plat(g, 6, 104, 110); coinRow(g, 5, 104, 110);
  floor(g, 114, 147);
  spikes(g, FLOOR - 1, 124, 126);
  put(g, FLOOR - 1, 141, 'G');
  coinRow(g, 8, 130, 138, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 12 — VOID : short warmup, quakePound upgrade, final boss gate.
// ---------------------------------------------------------------------------
function level12() {
  const W = 154; const g = makeGrid(W);
  floor(g, 0, 18);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 10, 16); coins(g, 6, [11, 12, 13, 14]);
  floor(g, 25, 45);
  plat(g, 7, 28, 34); coinRow(g, 6, 28, 34);
  put(g, FLOOR - 1, 38, 's'); spikes(g, FLOOR - 1, 41, 42);
  floor(g, 51, 68);
  plat(g, 5, 56, 62); coinRow(g, 4, 56, 62);
  floor(g, 76, 153);
  put(g, FLOOR - 1, 86, 's'); spikes(g, FLOOR - 1, 97, 99);
  coinRow(g, 8, 105, 116, 3);
  put(g, FLOOR - 1, 148, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
const levels = {
  3: level4(), 4: level5(), 5: level6(),
  6: level7(), 7: level8(), 8: level9(), 9: level10(), 10: level11(), 11: level12(),
};
const CP = {
  3: [[30,9],[80,9]], 4: [[40,9],[90,9]], 5: [[30,9],[65,9],[102,9]],
  6: [[45,9],[104,9]], 7: [[35,9],[92,9]], 8: [[45,9],[94,9]],
  9: [[50,9],[96,9]], 10: [[51,9],[114,9]], 11: [[51,9],[76,9]],
};
const PK = { 3: [[10,6]], 4: [[30,5]], 5: [[50,4],[64,6]] };
const UP = {
  6: [[78,5,'starJump']], 7: [[42,3,'floatGlide']], 8: [[84,3,'dashChain']],
  9: [[52,4,'burstFireball']], 10: [[58,4,'wallFocus']], 11: [[30,5,'quakePound']],
};
const BOSS = {
  6: [[116,9,'miniSlime',10]], 11: [[118,9,'kingSlime',22]],
};
const ENEMIES = {
  6: [[34,9,'spitter'], [63,9,'charger'], [108,9,'spitter'], [122,9,'brute']],
  7: [[67,9,'charger'], [96,9,'charger'], [112,3,'spitter'], [130,9,'brute']],
  8: [[70,9,'charger'], [100,9,'charger'], [116,5,'spitter'], [132,9,'brute']],
  9: [[43,9,'spitter'], [66,9,'charger'], [104,9,'brute'], [122,5,'spitter'], [136,9,'charger']],
  10: [[58,9,'spitter'], [92,9,'charger'], [107,5,'spitter'], [128,9,'brute']],
  11: [[60,3,'spitter'], [86,9,'charger'], [102,9,'brute']],
};
const TREASURES = {
  6: [[53,4,'diamond',5], [126,7,'diamond',5]],
  7: [[55,2,'diamond',5], [132,7,'diamond',5]],
  8: [[24,5,'diamond',5], [86,3,'diamond',5]],
  9: [[88,3,'diamond',5], [124,5,'diamond',5]],
  10: [[42,2,'diamond',5], [134,7,'diamond',5]],
  11: [[59,3,'diamond',5], [110,7,'diamond',5]],
};

function solid(ch){ return ch==='#'||ch==='B'||ch==='='; }
function cell(rows, r, c){ const line = rows[r]||''; return line[c]||' '; }

let ok = true;
for (const idx of Object.keys(levels).map(Number).sort((a,b)=>a-b)) {
  const rows = levels[idx];
  const W = Math.max(...rows.map(r=>r.length));
  const problems = [];
  // player start
  if (!rows.some(r=>r.includes('P'))) problems.push('no P');
  // goal + safe finish: find G, ensure ground below and no pit to the right edge
  let gr=-1, gc=-1;
  rows.forEach((r,ri)=>{ const ci=r.indexOf('G'); if(ci>=0){gr=ri;gc=ci;} });
  if (gc<0) problems.push('no G');
  else {
    if (!solid(cell(rows, gr+1, gc))) problems.push(`goal col${gc} has no ground beneath`);
    // no death pit after goal: every column from gc..W-1 must have some solid tile in rows gr+1..11
    for (let c=gc;c<W;c++){
      let grounded=false;
      for (let r=gr+1;r<ROWS;r++) if (solid(cell(rows,r,c))) {grounded=true;break;}
      if(!grounded){ problems.push(`DEATH PIT after goal at col${c}`); break; }
    }
  }
  // checkpoints: ground directly below the flag row
  for (const [c,r] of (CP[idx] || [])) {
    if (!solid(cell(rows, r+1, c)) && !solid(cell(rows, r, c)))
      problems.push(`checkpoint col${c},row${r}: no ground below`);
  }
  // pickups: orb cell should be empty (not embedded in solid) & have a platform below within 3 rows
  for (const [c,r] of (PK[idx] || [])) {
    if (solid(cell(rows,r,c))) problems.push(`pickup col${c},row${r} embedded in solid`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(ROWS-1,r+4); rr++) if (solid(cell(rows,rr,c))) {support=true;break;}
    if(!support) problems.push(`pickup col${c},row${r}: nothing to stand on below`);
  }
  for (const [c,r,id] of (UP[idx] || [])) {
    if (solid(cell(rows,r,c))) problems.push(`upgrade ${id} col${c},row${r} embedded in solid`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(ROWS-1,r+4); rr++) if (solid(cell(rows,rr,c))) {support=true;break;}
    if(!support) problems.push(`upgrade ${id} col${c},row${r}: nothing to stand on below`);
  }
  for (const [c,r,type,hp] of (BOSS[idx] || [])) {
    if (solid(cell(rows,r,c))) problems.push(`boss ${type} col${c},row${r} embedded in solid`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(ROWS-1,r+4); rr++) if (solid(cell(rows,rr,c))) {support=true;break;}
    if(!support) problems.push(`boss ${type} col${c},row${r}: nothing to stand on below`);
    if (!Number.isFinite(hp) || hp <= 0) problems.push(`boss ${type}: invalid hp ${hp}`);
  }
  for (const [c,r,type] of (ENEMIES[idx] || [])) {
    if (solid(cell(rows,r,c))) problems.push(`enemy ${type} col${c},row${r} embedded in solid`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(ROWS-1,r+4); rr++) if (solid(cell(rows,rr,c))) {support=true;break;}
    if(!support) problems.push(`enemy ${type} col${c},row${r}: nothing to stand on below`);
  }
  for (const [c,r,type,value] of (TREASURES[idx] || [])) {
    if (solid(cell(rows,r,c))) problems.push(`treasure ${type} col${c},row${r} embedded in solid`);
    let support=false;
    for (let rr=r+1; rr<=Math.min(ROWS-1,r+4); rr++) if (solid(cell(rows,rr,c))) {support=true;break;}
    if(!support) problems.push(`treasure ${type} col${c},row${r}: nothing to stand on below`);
    if (!Number.isFinite(value) || value <= 0) problems.push(`treasure ${type}: invalid value ${value}`);
  }
  console.log(`--- Level ${idx+1}  width=${W}  rows=${rows.length}  ${problems.length?'❌ '+problems.join(' | '):'✅ OK'}`);
  if (problems.length) ok=false;
}

// emit JS
function emit(rows){
  return '[\n' + rows.map(r=>JSON.stringify(r)).join(',\n') + ',\n]';
}
console.log('\n===GENERATED===');
for (const idx of Object.keys(levels).map(Number).sort((a,b)=>a-b)) {
  console.log(`// -------- Level ${idx+1} --------`);
  console.log(emit(levels[idx])+',');
}
console.log('// checkpoints');
console.log(JSON.stringify(CP, null, 2));
console.log('// upgrades');
console.log(JSON.stringify(UP, null, 2));
console.log('// bosses');
console.log(JSON.stringify(BOSS, null, 2));
console.log('// enemies');
console.log(JSON.stringify(ENEMIES, null, 2));
console.log('// treasures');
console.log(JSON.stringify(TREASURES, null, 2));
console.log('===END===  ok='+ok);
