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
  const W = 110; const g = makeGrid(W);
  floor(g, 0, 18);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 8, 13); coins(g, 6, [9, 10, 11]);
  floor(g, 24, 45);
  put(g, FLOOR - 1, 31, 's'); spikes(g, FLOOR - 1, 39, 41);
  plat(g, 6, 48, 54); coinRow(g, 5, 48, 54);
  floor(g, 55, 73);
  put(g, FLOOR - 1, 64, 's');
  plat(g, 7, 76, 80); coins(g, 6, [77, 78, 79]);
  floor(g, 82, 109);
  put(g, FLOOR - 1, 88, 's'); put(g, FLOOR - 1, 104, 'G');
  coinRow(g, 8, 92, 100, 2);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 8 — FUNGAL : air time and glide control, floatGlide upgrade.
// ---------------------------------------------------------------------------
function level8() {
  const W = 106; const g = makeGrid(W);
  floor(g, 0, 14);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 9, 13); coins(g, 6, [10, 11, 12]);
  floor(g, 22, 34);
  put(g, FLOOR - 1, 28, 's');
  plat(g, 6, 38, 45); coinRow(g, 4, 38, 45);
  plat(g, 4, 50, 55); coinRow(g, 3, 50, 55);
  floor(g, 58, 72); spikes(g, FLOOR - 1, 64, 66);
  plat(g, 6, 76, 82); coins(g, 5, [77, 79, 81]);
  floor(g, 88, 105);
  put(g, FLOOR - 1, 94, 's'); put(g, FLOOR - 1, 101, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 9 — GEARWORKS : speed lanes and dash rhythm, dashChain upgrade.
// ---------------------------------------------------------------------------
function level9() {
  const W = 112; const g = makeGrid(W);
  floor(g, 0, 16);
  put(g, FLOOR - 1, 2, 'P'); put(g, FLOOR - 1, 8, 's');
  plat(g, 7, 18, 23); coinRow(g, 6, 18, 23);
  floor(g, 28, 43); spikes(g, FLOOR - 1, 34, 36);
  plat(g, 7, 46, 51); coins(g, 6, [47, 48, 49]);
  floor(g, 55, 70); put(g, FLOOR - 1, 61, 's');
  plat(g, 6, 74, 80); coinRow(g, 5, 74, 80);
  floor(g, 84, 111);
  put(g, FLOOR - 1, 91, 's'); spikes(g, FLOOR - 1, 98, 99); put(g, FLOOR - 1, 105, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 10 — NEON : enemy clusters and fireball routing, burstFireball upgrade.
// ---------------------------------------------------------------------------
function level10() {
  const W = 112; const g = makeGrid(W);
  floor(g, 0, 20);
  put(g, FLOOR - 1, 2, 'P'); put(g, FLOOR - 1, 9, 's'); put(g, FLOOR - 1, 15, 's');
  plat(g, 6, 24, 30); coinRow(g, 5, 24, 30);
  floor(g, 34, 52); put(g, FLOOR - 1, 42, 's');
  plat(g, 6, 50, 55); coins(g, 5, [51, 52, 53]);
  floor(g, 58, 77);
  put(g, FLOOR - 1, 64, 's'); put(g, FLOOR - 1, 71, 's'); spikes(g, FLOOR - 1, 74, 75);
  plat(g, 5, 80, 85); coinRow(g, 4, 80, 85);
  floor(g, 89, 111);
  put(g, FLOOR - 1, 96, 's'); put(g, FLOOR - 1, 106, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 11 — CLOCKWORK : wall-jump shafts, wallFocus upgrade.
// ---------------------------------------------------------------------------
function level11() {
  const W = 108; const g = makeGrid(W);
  floor(g, 0, 14);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 9, 13); coins(g, 6, [10, 11, 12]);
  floor(g, 20, 33); spikes(g, FLOOR - 1, 27, 29);
  for (let r = 3; r <= 8; r++) { g[r][38] = 'B'; g[r][42] = 'B'; }
  coinRow(g, 4, 39, 41);
  floor(g, 45, 58); put(g, FLOOR - 1, 51, 's');
  plat(g, 6, 56, 61); coins(g, 5, [57, 58, 59]);
  for (let r = 2; r <= 8; r++) { g[r][67] = 'B'; g[r][72] = 'B'; }
  coinRow(g, 3, 68, 71);
  floor(g, 76, 107);
  put(g, FLOOR - 1, 84, 's'); spikes(g, FLOOR - 1, 91, 93); put(g, FLOOR - 1, 102, 'G');
  return toStrings(g);
}

// ---------------------------------------------------------------------------
// Level 12 — VOID : short warmup, quakePound upgrade, final boss gate.
// ---------------------------------------------------------------------------
function level12() {
  const W = 112; const g = makeGrid(W);
  floor(g, 0, 18);
  put(g, FLOOR - 1, 2, 'P');
  plat(g, 7, 10, 15); coins(g, 6, [11, 12, 13]);
  floor(g, 24, 42);
  plat(g, 7, 28, 32); coins(g, 6, [29, 30, 31]);
  put(g, FLOOR - 1, 36, 's'); spikes(g, FLOOR - 1, 39, 40);
  floor(g, 48, 63);
  plat(g, 5, 54, 59); coinRow(g, 4, 54, 59);
  floor(g, 70, 111);
  put(g, FLOOR - 1, 78, 's'); put(g, FLOOR - 1, 105, 'G');
  coinRow(g, 8, 88, 100, 3);
  return toStrings(g);
}

// ---------------------------------------------------------------------------
const levels = {
  3: level4(), 4: level5(), 5: level6(),
  6: level7(), 7: level8(), 8: level9(), 9: level10(), 10: level11(), 11: level12(),
};
const CP = {
  3: [[30,9],[80,9]], 4: [[40,9],[90,9]], 5: [[30,9],[65,9],[102,9]],
  6: [[40,9],[82,9]], 7: [[32,9],[88,9]], 8: [[40,9],[84,9]],
  9: [[46,9],[89,9]], 10: [[45,9],[76,9]], 11: [[48,9],[70,9]],
};
const PK = { 3: [[10,6]], 4: [[30,5]], 5: [[50,4],[64,6]] };
const UP = {
  6: [[78,5,'starJump']], 7: [[42,5,'floatGlide']], 8: [[48,5,'dashChain']],
  9: [[52,4,'burstFireball']], 10: [[58,4,'wallFocus']], 11: [[30,5,'quakePound']],
};
const BOSS = {
  6: [[92,9,'miniSlime',8]], 11: [[82,9,'kingSlime',16]],
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
console.log('===END===  ok='+ok);
