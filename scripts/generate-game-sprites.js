#!/usr/bin/env node
/* Generate Pixel Quest gameplay sprite assets from docs/art/map-art-prompts.md.
   The output is deterministic, dependency-free PNG pixel art. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const CHARACTER_DIR = path.join(ROOT, 'assets', 'sprites', 'characters');
const ENEMY_DIR = path.join(ROOT, 'assets', 'sprites', 'enemies');
const ITEM_DIR = path.join(ROOT, 'assets', 'sprites', 'items');
const FX_DIR = path.join(ROOT, 'assets', 'sprites', 'fx');
const PREVIEW_FILE = path.join(ROOT, 'docs', 'art', 'game-sprite-preview.png');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    alpha
  ];
}

function withAlpha(hex, alpha) {
  return hexToRgba(hex, alpha);
}

function makeImage(width, height, fill = null) {
  const img = { width, height, data: new Uint8Array(width * height * 4) };
  if (fill) rect(img, 0, 0, width, height, fill);
  return img;
}

function setPixel(img, x, y, color) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  const idx = (y * img.width + x) * 4;
  img.data[idx] = rgba[0];
  img.data[idx + 1] = rgba[1];
  img.data[idx + 2] = rgba[2];
  img.data[idx + 3] = rgba[3];
}

function getPixel(img, x, y) {
  const idx = (y * img.width + x) * 4;
  return [
    img.data[idx],
    img.data[idx + 1],
    img.data[idx + 2],
    img.data[idx + 3]
  ];
}

function rect(img, x, y, w, h, color) {
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(img.width, Math.ceil(x + w));
  const y1 = Math.min(img.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * img.width + px) * 4;
      img.data[idx] = rgba[0];
      img.data[idx + 1] = rgba[1];
      img.data[idx + 2] = rgba[2];
      img.data[idx + 3] = rgba[3];
    }
  }
}

function line(img, x0, y0, x1, y1, color, thickness = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    rect(img, x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function polygon(img, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(img.height - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    const scan = y + 0.5;
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) {
        const t = (scan - a[1]) / (b[1] - a[1]);
        intersections.push(a[0] + t * (b[0] - a[0]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(intersections[i]));
      const x1 = Math.min(img.width - 1, Math.floor(intersections[i + 1]));
      for (let x = x0; x <= x1; x++) setPixel(img, x, y, color);
    }
  }
}

function ellipse(img, cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(img.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(img.height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(img, x, y, color);
    }
  }
}

function ellipseOutline(img, cx, cy, rx, ry, color, thickness = 2) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(img.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(img.height - 1, Math.ceil(cy + ry));
  const irx = Math.max(1, rx - thickness);
  const iry = Math.max(1, ry - thickness);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const innerX = (x + 0.5 - cx) / irx;
      const innerY = (y + 0.5 - cy) / iry;
      if (nx * nx + ny * ny <= 1 && innerX * innerX + innerY * innerY >= 1) {
        setPixel(img, x, y, color);
      }
    }
  }
}

function blit(src, dst, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const rgba = getPixel(src, x, y);
      if (rgba[3] === 0) continue;
      setPixel(dst, dx + x, dy + y, rgba);
    }
  }
}

function scaleBlitRegion(src, dst, sx, sy, sw, sh, dx, dy, scale) {
  const dw = sw * scale;
  const dh = sh * scale;
  for (let y = 0; y < dh; y++) {
    const py = sy + Math.floor(y / scale);
    for (let x = 0; x < dw; x++) {
      const px = sx + Math.floor(x / scale);
      const rgba = getPixel(src, px, py);
      if (rgba[3] === 0) continue;
      setPixel(dst, dx + x, dy + y, rgba);
    }
  }
}

function spriteSheet(frameW, frameH, frameCount, drawFrame) {
  const sheet = makeImage(frameW * frameCount, frameH);
  for (let i = 0; i < frameCount; i++) {
    blit(drawFrame(i), sheet, i * frameW, 0);
  }
  return sheet;
}

function eyePair(img, cx, y, look = 1, size = 3) {
  rect(img, cx - 7, y, size + 2, size + 2, '#ffffff');
  rect(img, cx + 3, y, size + 2, size + 2, '#ffffff');
  rect(img, cx - 5 + look, y + 1, size, size, '#101426');
  rect(img, cx + 5 + look, y + 1, size, size, '#101426');
}

function spark(img, cx, cy, color, light = '#ffffff') {
  rect(img, cx, cy - 3, 2, 8, color);
  rect(img, cx - 3, cy, 8, 2, color);
  setPixel(img, cx + 1, cy + 1, light);
}

function starDust(img, seed, colors, count) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < count; i++) {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const n = (t ^ (t >>> 14)) >>> 0;
    const x = n % img.width;
    const y = (n >>> 9) % img.height;
    const color = colors[i % colors.length];
    setPixel(img, x, y, color);
    if ((n & 7) === 0) setPixel(img, x + 1, y, color);
  }
}

function shadow(img, cx, y, rx, color = [0, 0, 0, 46]) {
  ellipse(img, cx, y, rx, 3, color);
}

function deadBlobFrame(frameW, frameH, colors, wide = 1) {
  const img = makeImage(frameW, frameH);
  const cx = Math.floor(frameW / 2);
  const by = frameH - 2;
  shadow(img, cx, by, Math.floor(frameW * 0.32));
  ellipse(img, cx, by - 5, Math.floor(frameW * 0.28 * wide), 7, colors.body);
  rect(img, cx - 9, by - 9, 18, 3, colors.dark);
  line(img, cx - 8, by - 10, cx - 3, by - 5, '#101426', 1);
  line(img, cx - 3, by - 10, cx - 8, by - 5, '#101426', 1);
  line(img, cx + 4, by - 10, cx + 9, by - 5, '#101426', 1);
  line(img, cx + 9, by - 10, cx + 4, by - 5, '#101426', 1);
  return img;
}

function drawSpitterFrame(frame) {
  const img = makeImage(44, 40);
  const cx = 22;
  const by = 38;
  const bob = frame < 4 ? [0, -1, 0, 1][frame] : 0;
  const hurt = frame === 4;
  if (frame === 5) return deadBlobFrame(44, 40, { body: '#2dd4bf', dark: '#064e55' }, 1.05);
  shadow(img, cx, by, 14);
  ellipse(img, cx, by - 10 + bob, 17, 12, hurt ? '#d7fff7' : '#148c91');
  rect(img, cx - 14, by - 11 + bob, 28, 11, hurt ? '#d7fff7' : '#148c91');
  ellipse(img, cx - 2, by - 19 + bob, 10, 7, hurt ? '#ffffff' : '#24c8bd');
  polygon(img, [[cx - 5, by - 26 + bob], [cx + 1, by - 35 + bob], [cx + 7, by - 26 + bob]], '#79f2ff');
  line(img, cx + 1, by - 33 + bob, cx + 1, by - 26 + bob, '#effcff', 1);
  eyePair(img, cx - 1, by - 17 + bob, 1, 3);
  rect(img, cx + 12, by - 14 + bob, frame === 6 ? 12 : 8, 6, '#064e55');
  rect(img, cx + 16, by - 13 + bob, frame === 6 ? 9 : 4, 4, '#79f2ff');
  rect(img, cx + 12, by - 23 + bob, 5, 8, '#0d7378');
  if (frame === 6) {
    ellipse(img, cx + 25, by - 10 + bob, 7, 7, withAlpha('#79f2ff', 150));
    spark(img, cx + 27, by - 10 + bob, '#effcff');
  }
  rect(img, cx - 7, by - 5 + bob, 14, 2, '#064e55');
  return img;
}

function drawChargerFrame(frame) {
  const img = makeImage(48, 40);
  const cx = 24;
  const by = 38;
  const bob = frame < 4 ? [0, 1, 0, -1][frame] : 0;
  const charge = frame >= 6;
  if (frame === 5) return deadBlobFrame(48, 40, { body: '#d97706', dark: '#5f2504' }, 1.15);
  const hurt = frame === 4;
  shadow(img, cx, by, 15);
  ellipse(img, cx + (charge ? 3 : 0), by - 10 + bob, charge ? 18 : 16, charge ? 10 : 12, hurt ? '#ffe8bf' : '#b45309');
  rect(img, cx - 14 + (charge ? 4 : 0), by - 11 + bob, charge ? 30 : 27, 11, hurt ? '#ffe8bf' : '#b45309');
  ellipse(img, cx + 4, by - 18 + bob, 10, 6, '#f59e0b');
  polygon(img, [[cx - 16, by - 24 + bob], [cx - 25, by - 30 + bob], [cx - 19, by - 16 + bob]], '#fff1a8');
  polygon(img, [[cx + 8, by - 24 + bob], [cx + 17, by - 31 + bob], [cx + 13, by - 16 + bob]], '#fff1a8');
  line(img, cx - 22, by - 27 + bob, cx - 18, by - 17 + bob, '#c2410c', 1);
  line(img, cx + 15, by - 28 + bob, cx + 12, by - 17 + bob, '#c2410c', 1);
  eyePair(img, cx + 1, by - 17 + bob, charge ? 2 : 1, 3);
  rect(img, cx - 12, by - 6 + bob, 25, 3, '#5f2504');
  rect(img, cx - 11, by - 8 + bob, 6, 2, '#ffedd5');
  rect(img, cx + 4, by - 8 + bob, 6, 2, '#ffedd5');
  if (charge) {
    rect(img, 3, by - 15, 9, 2, withAlpha('#ffe066', 180));
    rect(img, 1, by - 9, 12, 2, withAlpha('#ffe066', 150));
  }
  return img;
}

function drawBruteFrame(frame) {
  const img = makeImage(56, 48);
  const cx = 28;
  const by = 46;
  const bob = frame < 4 ? [0, -1, 0, 1][frame] : 0;
  if (frame === 5) return deadBlobFrame(56, 48, { body: '#991b1b', dark: '#3f0d0d' }, 1.28);
  const hurt = frame === 4;
  const jump = frame === 6;
  shadow(img, cx, by, 19);
  ellipse(img, cx, by - 15 + bob - (jump ? 4 : 0), 22, 18, hurt ? '#ffd6bd' : '#7f1d1d');
  rect(img, cx - 19, by - 18 + bob - (jump ? 4 : 0), 38, 16, hurt ? '#ffd6bd' : '#7f1d1d');
  rect(img, cx - 19, by - 27 + bob - (jump ? 4 : 0), 38, 8, '#3f0d0d');
  rect(img, cx - 15, by - 30 + bob - (jump ? 4 : 0), 30, 5, '#ff9f1c');
  rect(img, cx - 22, by - 15 + bob - (jump ? 4 : 0), 7, 13, '#3f0d0d');
  rect(img, cx + 15, by - 15 + bob - (jump ? 4 : 0), 7, 13, '#3f0d0d');
  eyePair(img, cx, by - 22 + bob - (jump ? 4 : 0), 1, 3);
  rect(img, cx - 15, by - 10 + bob - (jump ? 4 : 0), 30, 4, '#111827');
  rect(img, cx - 12, by - 10 + bob - (jump ? 4 : 0), 4, 4, '#fef3c7');
  rect(img, cx + 8, by - 10 + bob - (jump ? 4 : 0), 4, 4, '#fef3c7');
  rect(img, cx - 16, by - 3 + bob, 9, 5, '#3f0d0d');
  rect(img, cx + 7, by - 3 + bob, 9, 5, '#3f0d0d');
  if (jump) {
    rect(img, cx - 23, by - 7, 46, 2, withAlpha('#ff9f1c', 150));
  }
  return img;
}

function drawMiniBossFrame(frame) {
  const img = makeImage(64, 56);
  const cx = 32;
  const by = 54;
  const bob = frame < 4 ? [0, -1, 0, 1][frame] : 0;
  if (frame === 5) return deadBlobFrame(64, 56, { body: '#6d28d9', dark: '#241447' }, 1.35);
  const hurt = frame === 4;
  const jump = frame === 6;
  const y = by - (jump ? 6 : 0);
  shadow(img, cx, by, 22);
  ellipse(img, cx, y - 14 + bob, 25, 18, withAlpha('#7dd3fc', 70));
  ellipse(img, cx, y - 13 + bob, 23, 17, hurt ? '#f3e8ff' : '#5b3d96');
  rect(img, cx - 19, y - 14 + bob, 38, 14, hurt ? '#f3e8ff' : '#5b3d96');
  polygon(img, [[cx - 18, y - 28 + bob], [cx - 12, y - 44 + bob], [cx - 5, y - 28 + bob]], '#89f7fe');
  polygon(img, [[cx - 2, y - 31 + bob], [cx + 5, y - 48 + bob], [cx + 12, y - 31 + bob]], '#b19cff');
  polygon(img, [[cx + 13, y - 27 + bob], [cx + 19, y - 41 + bob], [cx + 24, y - 27 + bob]], '#89f7fe');
  line(img, cx + 5, y - 46 + bob, cx + 5, y - 31 + bob, '#ffffff', 1);
  eyePair(img, cx, y - 21 + bob, 1, 4);
  rect(img, cx - 9, y - 9 + bob, 18, 3, '#241447');
  rect(img, cx - 20, y - 3 + bob, 10, 5, '#3b236e');
  rect(img, cx + 10, y - 3 + bob, 10, 5, '#3b236e');
  if (jump) ellipseOutline(img, cx, by - 4, 28, 7, withAlpha('#89f7fe', 155), 2);
  return img;
}

function drawBigBossFrame(frame) {
  const img = makeImage(96, 80);
  const cx = 48;
  const by = 78;
  const walk = frame < 4;
  const charge = frame >= 7;
  const bob = walk ? [0, -1, 0, 1][frame] : 0;
  if (frame === 5) return deadBlobFrame(96, 80, { body: '#2a174f', dark: '#090614' }, 1.45);
  const hurt = frame === 4;
  const jump = frame === 6;
  const y = by - (jump ? 8 : 0);
  shadow(img, cx, by, 34);
  ellipse(img, cx, y - 23 + bob, 39, 28, withAlpha('#8c6cff', charge ? 100 : 60));
  ellipse(img, cx, y - 22 + bob, 35, 27, hurt ? '#d9c9ff' : '#33205f');
  rect(img, cx - 31, y - 23 + bob, 62, 24, hurt ? '#d9c9ff' : '#33205f');
  polygon(img, [[cx - 27, y - 42 + bob], [cx - 19, y - 59 + bob], [cx - 10, y - 42 + bob]], '#6d5cff');
  polygon(img, [[cx - 8, y - 46 + bob], [cx, y - 68 + bob], [cx + 8, y - 46 + bob]], '#a99cff');
  polygon(img, [[cx + 10, y - 42 + bob], [cx + 20, y - 60 + bob], [cx + 29, y - 42 + bob]], '#6d5cff');
  rect(img, cx - 28, y - 43 + bob, 56, 5, '#090614');
  line(img, cx, y - 66 + bob, cx, y - 46 + bob, '#ffffff', 1);
  eyePair(img, cx, y - 30 + bob, charge ? 2 : 1, 5);
  rect(img, cx - 18, y - 15 + bob, 36, 5, '#090614');
  rect(img, cx - 15, y - 12 + bob, 5, 5, '#d9c9ff');
  rect(img, cx + 10, y - 12 + bob, 5, 5, '#d9c9ff');
  rect(img, cx - 35, y - 8 + bob, 14, 7, '#17122d');
  rect(img, cx + 21, y - 8 + bob, 14, 7, '#17122d');
  starDust(img, `big-boss-${frame}`, ['#91a6ff', '#d9c9ff', '#6d5cff'], charge ? 24 : 14);
  if (charge) {
    ellipseOutline(img, cx, y - 25 + bob, 43, 33, withAlpha('#d9c9ff', 175), 2);
    line(img, cx - 42, y - 21, cx + 42, y - 21, withAlpha('#6d5cff', 140), 2);
  }
  if (jump) ellipseOutline(img, cx, by - 6, 42, 9, withAlpha('#a99cff', 155), 3);
  return img;
}

function drawDiamondSheet() {
  const widths = [13, 10, 5, 3, 5, 10];
  return spriteSheet(28, 28, 6, frame => {
    const img = makeImage(28, 28);
    const cx = 14;
    const top = 3;
    const mid = 12;
    const bot = 25;
    const w = widths[frame];
    ellipse(img, cx, 15, 13, 13, withAlpha('#38bdf8', 52));
    polygon(img, [[cx - w, mid], [cx - Math.max(2, Math.floor(w * 0.55)), top], [cx + Math.max(2, Math.floor(w * 0.55)), top], [cx + w, mid], [cx, bot]], '#38bdf8');
    polygon(img, [[cx - Math.max(1, Math.floor(w * 0.55)), top], [cx, mid], [cx - w, mid]], '#d7fbff');
    polygon(img, [[cx + Math.max(1, Math.floor(w * 0.55)), top], [cx, mid], [cx + w, mid]], '#7dd3fc');
    polygon(img, [[cx - w, mid], [cx, mid], [cx, bot]], '#0ea5e9');
    polygon(img, [[cx + w, mid], [cx, mid], [cx, bot]], '#0369a1');
    rect(img, cx - 4, 6, Math.max(2, Math.floor(w / 2)), 2, '#ffffff');
    return img;
  });
}

function drawSkillOrb(kind) {
  const isAegis = kind === 'aegis';
  return spriteSheet(40, 40, 4, frame => {
    const img = makeImage(40, 40);
    const pulse = frame === 1 || frame === 3 ? 2 : frame === 2 ? 4 : 0;
    const main = isAegis ? '#7dd3fc' : '#ffd166';
    const dark = isAegis ? '#2563eb' : '#b45309';
    const light = isAegis ? '#effcff' : '#fff7ad';
    ellipse(img, 20, 20, 18 + pulse, 18 + pulse, withAlpha(main, 54));
    ellipseOutline(img, 20, 20, 17, 17, withAlpha(light, 140), 2);
    ellipse(img, 20, 20, 13, 13, main);
    ellipse(img, 16, 15, 5, 4, light);
    if (isAegis) {
      polygon(img, [[20, 8], [30, 13], [27, 26], [20, 33], [13, 26], [10, 13]], '#effcff');
      polygon(img, [[20, 11], [27, 15], [25, 25], [20, 29], [15, 25], [13, 15]], dark);
      rect(img, 19, 14, 2, 11, '#effcff');
      rect(img, 16, 19, 8, 2, '#effcff');
    } else {
      polygon(img, [[22, 7], [14, 22], [21, 21], [17, 33], [29, 17], [22, 18]], '#fff7ad');
      rect(img, 27, 9, 4, 4, '#ffffff');
      rect(img, 9, 27, 3, 3, '#ffffff');
      line(img, 9, 14, 15, 10, light, 2);
      line(img, 27, 29, 32, 24, light, 2);
      rect(img, 18, 16, 6, 4, dark);
    }
    return img;
  });
}

function drawEnemyBoltSheet() {
  return spriteSheet(32, 32, 4, frame => {
    const img = makeImage(32, 32);
    const cx = 16;
    const cy = 16;
    const colors = frame % 2 === 0
      ? ['#89f7fe', '#dffcff', '#0b75ff']
      : ['#b19cff', '#f3e8ff', '#6d5cff'];
    ellipse(img, cx, cy, 14, 14, withAlpha(colors[0], 58));
    polygon(img, [[cx - 11, cy], [cx - 2, cy - 8], [cx + 12, cy - 4], [cx + 6, cy + 3], [cx + 12, cy + 8], [cx - 2, cy + 7]], colors[0]);
    polygon(img, [[cx - 6, cy], [cx + 1, cy - 4], [cx + 8, cy], [cx + 1, cy + 4]], colors[1]);
    line(img, 3, cy - 6 + frame, cx - 8, cy - 2, colors[2], 2);
    line(img, 4, cy + 6 - frame, cx - 8, cy + 2, colors[2], 2);
    rect(img, cx + 6, cy - 2, 4, 4, '#ffffff');
    return img;
  });
}

function drawAegisSheet() {
  return spriteSheet(64, 64, 4, frame => {
    const img = makeImage(64, 64);
    const pulse = frame * 3;
    ellipse(img, 32, 32, 26 + pulse, 26 + pulse, withAlpha('#7dd3fc', 28));
    ellipseOutline(img, 32, 32, 24 + pulse, 24 + pulse, withAlpha('#dffcff', 150 - frame * 20), 2);
    ellipseOutline(img, 32, 32, 18, 18, withAlpha('#7dd3fc', 180), 2);
    polygon(img, [[32, 12], [46, 19], [42, 39], [32, 51], [22, 39], [18, 19]], withAlpha('#effcff', 180));
    polygon(img, [[32, 16], [42, 21], [39, 37], [32, 46], [25, 37], [22, 21]], withAlpha('#2563eb', 170));
    rect(img, 31, 22, 2, 17, '#effcff');
    rect(img, 25, 29, 14, 2, '#effcff');
    spark(img, 15 + frame * 2, 17 + frame, '#ffffff');
    spark(img, 48 - frame, 45 - frame * 2, '#dffcff');
    return img;
  });
}

function drawCharacterFrame(kind, frame) {
  const palettes = {
    volt: {
      skin: '#ffcf9e', hair: '#152238', cap: '#ffd23f', capDark: '#2563eb',
      body: '#2563eb', bodyDark: '#143b8f', pants: '#102a43', trim: '#fff176',
      spark: '#7dd3fc'
    },
    oracle: {
      skin: '#f2d5ff', hair: '#e0f2fe', cap: '#9d7cff', capDark: '#5b4abf',
      body: '#7dd3fc', bodyDark: '#4c6edb', pants: '#2a2455', trim: '#f8fafc',
      spark: '#d9c9ff'
    }
  };
  const p = palettes[kind];
  const img = makeImage(32, 40);
  const cx = 16;
  const by = 38;
  const runOffsets = [0, -2, 1, 2];
  const isRun = frame >= 1 && frame <= 4;
  const jump = frame === 5;
  const fall = frame === 6;
  const dead = frame === 7;
  if (dead) {
    shadow(img, cx, by, 12);
    rect(img, 8, 23, 18, 8, p.body);
    rect(img, 22, 19, 8, 8, p.skin);
    rect(img, 21, 17, 9, 3, p.cap);
    line(img, 25, 21, 29, 25, '#101426', 1);
    line(img, 29, 21, 25, 25, '#101426', 1);
    rect(img, 7, 31, 7, 3, p.pants);
    rect(img, 16, 31, 8, 3, p.pants);
    return img;
  }
  const step = isRun ? runOffsets[frame - 1] : 0;
  shadow(img, cx, by, 10);
  if (jump) {
    rect(img, 7, 25, 6, 10, p.pants);
    rect(img, 18, 23, 6, 11, p.pants);
    rect(img, 4, 15, 5, 9, p.skin);
    rect(img, 24, 15, 5, 9, p.skin);
  } else if (fall) {
    rect(img, 7, 25, 6, 11, p.pants);
    rect(img, 19, 25, 6, 11, p.pants);
    rect(img, 3, 14, 6, 5, p.skin);
    rect(img, 24, 14, 6, 5, p.skin);
  } else {
    rect(img, 7 + step, 25, 6, 11, p.pants);
    rect(img, 19 - step, 25, 6, 11, p.pants);
    rect(img, 6 + step, 34, 8, 3, '#5a3a1e');
    rect(img, 18 - step, 34, 8, 3, '#5a3a1e');
    rect(img, 23, 14 + (isRun ? step : 0), 5, 11, p.skin);
  }
  rect(img, 7, 13, 18, 14, p.body);
  rect(img, 7, 22, 18, 5, p.bodyDark);
  rect(img, 7, 24, 18, 3, p.trim);
  rect(img, 8, 3, 16, 13, p.skin);
  rect(img, 7, 1, 18, 7, p.cap);
  rect(img, 20, 5, 6, 4, p.capDark);
  rect(img, 8, 7, 16, 2, p.capDark);
  rect(img, 18, 7, 5, 5, '#ffffff');
  rect(img, 21, 8, 2, 3, '#101426');
  rect(img, 10, 13, 4, 2, withAlpha('#e94560', 90));
  if (kind === 'volt') {
    polygon(img, [[25, 2], [29, 7], [25, 7], [30, 14], [22, 7], [25, 7]], p.spark);
    rect(img, 3, 19, 3, 3, p.spark);
  } else {
    spark(img, 4, 11, p.spark);
    rect(img, 13, 2, 2, 2, '#f8fafc');
    rect(img, 6, 20, 4, 4, '#d9c9ff');
  }
  return img;
}

function drawCharacterSheet(kind) {
  return spriteSheet(32, 40, 8, frame => drawCharacterFrame(kind, frame));
}

function generateAssets() {
  return {
    characters: {
      'volt.png': { img: drawCharacterSheet('volt'), width: 256, height: 40 },
      'oracle.png': { img: drawCharacterSheet('oracle'), width: 256, height: 40 },
    },
    enemies: {
      'spitter.png': { img: spriteSheet(44, 40, 7, drawSpitterFrame), width: 308, height: 40 },
      'charger.png': { img: spriteSheet(48, 40, 8, drawChargerFrame), width: 384, height: 40 },
      'brute.png': { img: spriteSheet(56, 48, 7, drawBruteFrame), width: 392, height: 48 },
      'mini-boss.png': { img: spriteSheet(64, 56, 7, drawMiniBossFrame), width: 448, height: 56 },
      'big-boss.png': { img: spriteSheet(96, 80, 10, drawBigBossFrame), width: 960, height: 80 },
    },
    items: {
      'diamond.png': { img: drawDiamondSheet(), width: 168, height: 28 },
      'skill-orb-aegis.png': { img: drawSkillOrb('aegis'), width: 160, height: 40 },
      'skill-orb-quick-cast.png': { img: drawSkillOrb('quickCast'), width: 160, height: 40 },
    },
    fx: {
      'enemy-bolt.png': { img: drawEnemyBoltSheet(), width: 128, height: 32 },
      'aegis.png': { img: drawAegisSheet(), width: 256, height: 64 },
    },
  };
}

function checker(img, x, y, w, h) {
  for (let py = y; py < y + h; py += 8) {
    for (let px = x; px < x + w; px += 8) {
      rect(img, px, py, 8, 8, ((px + py) / 8) % 2 === 0 ? '#263040' : '#1a2230');
    }
  }
}

function previewSheet(preview, sheet, frameW, frameH, frameCount, x, y, scale = 2) {
  for (let i = 0; i < frameCount; i++) {
    const px = x + i * (frameW * scale + 6);
    checker(preview, px - 2, y - 2, frameW * scale + 4, frameH * scale + 4);
    scaleBlitRegion(sheet, preview, i * frameW, 0, frameW, frameH, px, y, scale);
  }
}

function makePreview(assets) {
  const preview = makeImage(1180, 720, '#111827');
  previewSheet(preview, assets.characters['volt.png'].img, 32, 40, 8, 20, 20, 2);
  previewSheet(preview, assets.characters['oracle.png'].img, 32, 40, 8, 20, 120, 2);
  previewSheet(preview, assets.enemies['spitter.png'].img, 44, 40, 7, 20, 220, 2);
  previewSheet(preview, assets.enemies['charger.png'].img, 48, 40, 8, 20, 320, 2);
  previewSheet(preview, assets.enemies['brute.png'].img, 56, 48, 7, 20, 420, 1);
  previewSheet(preview, assets.enemies['mini-boss.png'].img, 64, 56, 7, 500, 420, 1);
  previewSheet(preview, assets.enemies['big-boss.png'].img, 96, 80, 10, 20, 520, 1);
  previewSheet(preview, assets.items['diamond.png'].img, 28, 28, 6, 820, 20, 2);
  previewSheet(preview, assets.items['skill-orb-aegis.png'].img, 40, 40, 4, 820, 100, 2);
  previewSheet(preview, assets.items['skill-orb-quick-cast.png'].img, 40, 40, 4, 820, 200, 2);
  previewSheet(preview, assets.fx['enemy-bolt.png'].img, 32, 32, 4, 820, 310, 2);
  previewSheet(preview, assets.fx['aegis.png'].img, 64, 64, 4, 820, 400, 1);
  return preview;
}

function hasOpaquePixel(img) {
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] > 0) return true;
  }
  return false;
}

function validate(assets) {
  for (const group of Object.values(assets)) {
    for (const [name, asset] of Object.entries(group)) {
      if (asset.img.width !== asset.width || asset.img.height !== asset.height) {
        throw new Error(`${name} expected ${asset.width}x${asset.height}, got ${asset.img.width}x${asset.img.height}`);
      }
      if (!hasOpaquePixel(asset.img)) throw new Error(`${name} is blank`);
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function savePng(file, img) {
  fs.writeFileSync(file, encodePng(img));
}

function main() {
  ensureDir(CHARACTER_DIR);
  ensureDir(ENEMY_DIR);
  ensureDir(ITEM_DIR);
  ensureDir(FX_DIR);
  ensureDir(path.dirname(PREVIEW_FILE));

  const assets = generateAssets();
  validate(assets);

  const groups = [
    [CHARACTER_DIR, assets.characters],
    [ENEMY_DIR, assets.enemies],
    [ITEM_DIR, assets.items],
    [FX_DIR, assets.fx],
  ];
  let written = 0;
  for (const [dir, group] of groups) {
    for (const [file, asset] of Object.entries(group)) {
      savePng(path.join(dir, file), asset.img);
      written++;
    }
  }
  savePng(PREVIEW_FILE, makePreview(assets));

  console.log(`Generated ${written} gameplay sprite assets.`);
  console.log(`Characters: ${path.relative(ROOT, CHARACTER_DIR)}`);
  console.log(`Enemies: ${path.relative(ROOT, ENEMY_DIR)}`);
  console.log(`Items: ${path.relative(ROOT, ITEM_DIR)}`);
  console.log(`FX: ${path.relative(ROOT, FX_DIR)}`);
  console.log(`Preview: ${path.relative(ROOT, PREVIEW_FILE)}`);
}

main();
