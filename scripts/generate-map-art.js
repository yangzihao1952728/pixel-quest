#!/usr/bin/env node
/* Generate Pixel Quest map art assets from docs/art/map-art-prompts.md.
   The output is deterministic, dependency-free PNG pixel art. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const TILE_DIR = path.join(ROOT, 'assets', 'sprites', 'tiles');
const BG_DIR = path.join(ROOT, 'assets', 'backgrounds');
const PREVIEW_FILE = path.join(ROOT, 'docs', 'art', 'map-art-preview.png');

const TILE_SIZE = 40;
const VIEW_W = 960;
const VIEW_H = 540;

const THEMES = {
  meadow: {
    ground: '#7a4a24', ground2: '#8a5a2c', groundDark: '#553116', speck: '#b9783f',
    cap: '#57a83f', capLt: '#7bd95a', capDark: '#34792d',
    brick: '#a84c35', brickLt: '#c96b4a', mortar: '#6e2f26',
    platform: '#b9783f', platformLt: '#dd9b5d', platformDark: '#6f3f21',
    spike: '#a9b5c0', spikeLt: '#edf4fb', spikeDark: '#687581', base: '#56616c',
    far: ['#84cff2', '#aee2fb', '#dff5ff'], hill: '#98cf91', hill2: '#b5dda7',
    sun: '#fff0a0', midA: '#6dad55', midB: '#4f8d45', trunk: '#725032'
  },
  cave: {
    ground: '#33303f', ground2: '#443e55', groundDark: '#242433', speck: '#6e6682',
    cap: '#567a6a', capLt: '#7fa58f', capDark: '#334f48',
    brick: '#463b5e', brickLt: '#63557a', mortar: '#292336',
    platform: '#504a64', platformLt: '#716b84', platformDark: '#2a2837',
    spike: '#8c92a2', spikeLt: '#d1d7e5', spikeDark: '#4e5364', base: '#252937',
    far: ['#14182b', '#202640', '#30243d'], hill: '#25263a', hill2: '#34304a',
    sun: '#6f6082', midA: '#3b334b', midB: '#4d4b62', trunk: '#2a2532'
  },
  sky: {
    ground: '#e7f3fb', ground2: '#cfe3f1', groundDark: '#9fbfd5', speck: '#b5d4e8',
    cap: '#9adcff', capLt: '#d7f6ff', capDark: '#75b7de',
    brick: '#b0c4de', brickLt: '#dce8f5', mortar: '#7f98b4',
    platform: '#eaf7ff', platformLt: '#ffffff', platformDark: '#aacde4',
    spike: '#b7c3d3', spikeLt: '#f4fbff', spikeDark: '#7e91a5', base: '#6e8094',
    far: ['#67c2ff', '#a9defc', '#edf9ff'], hill: '#ffffff', hill2: '#d8efff',
    sun: '#fff1a5', midA: '#ffffff', midB: '#d9efff', trunk: '#b89c63'
  },
  lava: {
    ground: '#321416', ground2: '#4c2020', groundDark: '#1c0808', speck: '#822e22',
    cap: '#8f4a27', capLt: '#d07838', capDark: '#5f2518',
    brick: '#642525', brickLt: '#934239', mortar: '#220909',
    platform: '#563030', platformLt: '#a45a32', platformDark: '#200808',
    spike: '#2d1718', spikeLt: '#f08a3a', spikeDark: '#120506', base: '#1c0707',
    far: ['#240808', '#411111', '#642817'], hill: '#531818', hill2: '#381010',
    sun: '#ff9d39', midA: '#6c2117', midB: '#a6451f', trunk: '#2b0b0b'
  },
  snow: {
    ground: '#b8c8d9', ground2: '#d3dee9', groundDark: '#7c93a9', speck: '#ecf7ff',
    cap: '#f7fcff', capLt: '#ffffff', capDark: '#a9c7db',
    brick: '#9eb0c4', brickLt: '#d4e4f1', mortar: '#6e849b',
    platform: '#b9c8d7', platformLt: '#ffffff', platformDark: '#7790a5',
    spike: '#bce9ff', spikeLt: '#ffffff', spikeDark: '#5c8bad', base: '#617487',
    far: ['#9fc6e8', '#cfe6f7', '#f6fbff'], hill: '#dfeaf3', hill2: '#f7fbff',
    sun: '#fff2bf', midA: '#7f9db2', midB: '#dceaf4', trunk: '#6c5b49'
  },
  crystal: {
    ground: '#211c45', ground2: '#33256b', groundDark: '#14112c', speck: '#52d6ff',
    cap: '#3aa8ff', capLt: '#9af3ff', capDark: '#5d3cb4',
    brick: '#3c327b', brickLt: '#6a57c7', mortar: '#1a153d',
    platform: '#30265e', platformLt: '#7adfff', platformDark: '#161431',
    spike: '#74e6ff', spikeLt: '#f2fcff', spikeDark: '#7e4ee8', base: '#17142d',
    far: ['#171436', '#221d4f', '#33236a'], hill: '#33275e', hill2: '#49347c',
    sun: '#75dfff', midA: '#46328a', midB: '#5de0ff', trunk: '#21193e'
  },
  fungal: {
    ground: '#1f2d26', ground2: '#2f4a3c', groundDark: '#111914', speck: '#66d7b7',
    cap: '#44b890', capLt: '#83f0d4', capDark: '#25745f',
    brick: '#35433e', brickLt: '#5f7b70', mortar: '#18261f',
    platform: '#5a4a36', platformLt: '#d986cf', platformDark: '#23332c',
    spike: '#d8e6bf', spikeLt: '#f9ffe6', spikeDark: '#6cae8b', base: '#17221b',
    far: ['#13211e', '#1c342d', '#284a3f'], hill: '#1f3b32', hill2: '#285247',
    sun: '#7af0cd', midA: '#346855', midB: '#64cfae', trunk: '#403027'
  },
  gearworks: {
    ground: '#30363d', ground2: '#474f58', groundDark: '#1c2025', speck: '#c49542',
    cap: '#c79034', capLt: '#ffd06a', capDark: '#7e561c',
    brick: '#4a5158', brickLt: '#6c7880', mortar: '#22282d',
    platform: '#3d464e', platformLt: '#f0b647', platformDark: '#1c2228',
    spike: '#bbc7cf', spikeLt: '#ffffff', spikeDark: '#65727b', base: '#9b4c21',
    far: ['#1f252b', '#30373d', '#45433b'], hill: '#34383b', hill2: '#4b4132',
    sun: '#d7b064', midA: '#4b535a', midB: '#9a6e2b', trunk: '#262c31'
  },
  neon: {
    ground: '#141a2a', ground2: '#242b41', groundDark: '#080c18', speck: '#22f2ff',
    cap: '#20d6ff', capLt: '#ff4df0', capDark: '#0b6e95',
    brick: '#1d2540', brickLt: '#34405e', mortar: '#091024',
    platform: '#242b3c', platformLt: '#36f4ff', platformDark: '#090d18',
    spike: '#28e8ff', spikeLt: '#dffcff', spikeDark: '#0b75ff', base: '#151729',
    far: ['#081120', '#101b35', '#1b2546'], hill: '#131d2e', hill2: '#202943',
    sun: '#ff4df0', midA: '#152138', midB: '#2af0ff', trunk: '#0d1526'
  },
  clockwork: {
    ground: '#6b4b2d', ground2: '#8a663d', groundDark: '#3c2818', speck: '#59a66b',
    cap: '#d29a3f', capLt: '#ffe08a', capDark: '#8b5d22',
    brick: '#745338', brickLt: '#aa7a45', mortar: '#3a271a',
    platform: '#7d582f', platformLt: '#f2bd55', platformDark: '#3c2713',
    spike: '#d39a42', spikeLt: '#ffe39a', spikeDark: '#7a4a20', base: '#302015',
    far: ['#2c2119', '#45311f', '#654529'], hill: '#594127', hill2: '#76552e',
    sun: '#d6a852', midA: '#7d5b31', midB: '#bd8436', trunk: '#3a2618'
  },
  void: {
    ground: '#17122d', ground2: '#28204e', groundDark: '#090614', speck: '#91a6ff',
    cap: '#7a5cff', capLt: '#d9c9ff', capDark: '#2a46a0',
    brick: '#251d46', brickLt: '#4a3c78', mortar: '#0c0920',
    platform: '#21183f', platformLt: '#8c6cff', platformDark: '#090614',
    spike: '#332157', spikeLt: '#d9c9ff', spikeDark: '#080511', base: '#0a0718',
    far: ['#070512', '#100b25', '#1b1238'], hill: '#1b1538', hill2: '#2b1e55',
    sun: '#a99cff', midA: '#2a1d54', midB: '#6d5cff', trunk: '#100b22'
  }
};

const THEME_NAMES = Object.keys(THEMES);

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

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addSpeckles(img, palette, seedText, yStart = 0, yEnd = TILE_SIZE, density = 18) {
  const rng = mulberry32(seedFor(seedText));
  for (let i = 0; i < density; i++) {
    const x = Math.floor(rng() * 36) + 2;
    const y = Math.floor(rng() * (yEnd - yStart - 3)) + yStart + 1;
    const w = rng() > 0.65 ? 3 : 2;
    const h = rng() > 0.72 ? 2 : 1;
    rect(img, x, y, w, h, rng() > 0.55 ? palette.speck : palette.ground2);
  }
}

function tinyCrystal(img, x, y, color, light) {
  polygon(img, [[x, y + 7], [x + 4, y], [x + 8, y + 7]], color);
  line(img, x + 4, y + 1, x + 4, y + 6, light, 1);
}

function mushroomCap(img, x, y, cap, stem, light) {
  rect(img, x + 3, y + 5, 3, 7, stem);
  ellipse(img, x + 5, y + 4, 7, 5, cap);
  rect(img, x + 1, y + 4, 9, 3, cap);
  rect(img, x + 4, y + 1, 3, 2, light);
}

function rivet(img, x, y, color, light) {
  rect(img, x, y, 4, 4, color);
  rect(img, x + 1, y, 2, 1, light);
}

function miniGear(img, cx, cy, color, light) {
  rect(img, cx - 2, cy - 6, 4, 12, color);
  rect(img, cx - 6, cy - 2, 12, 4, color);
  rect(img, cx - 4, cy - 4, 8, 8, color);
  rect(img, cx - 1, cy - 1, 2, 2, light);
}

function starSpeckles(img, seedText, colors, count, yStart = 4, yEnd = 36) {
  const rng = mulberry32(seedFor(seedText));
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * 36) + 2;
    const y = Math.floor(rng() * (yEnd - yStart)) + yStart;
    setPixel(img, x, y, colors[Math.floor(rng() * colors.length)]);
    if (rng() > 0.78) setPixel(img, x + 1, y, colors[0]);
  }
}

function drawGroundTile(theme, top) {
  const p = THEMES[theme];
  const img = makeImage(TILE_SIZE, TILE_SIZE);
  rect(img, 0, 0, 40, 40, p.ground);
  rect(img, 0, 36, 40, 4, p.groundDark);
  rect(img, 36, 0, 4, 40, p.groundDark);
  addSpeckles(img, p, `${theme}-ground`, top ? 10 : 0, 37, theme === 'lava' ? 22 : 18);

  if (!top) {
    if (theme === 'lava') {
      line(img, 5, 25, 17, 25, p.capLt);
      line(img, 17, 25, 23, 32, p.capLt);
      line(img, 30, 8, 34, 20, p.capLt);
    } else if (theme === 'crystal') {
      tinyCrystal(img, 6, 22, p.capDark, p.capLt);
      tinyCrystal(img, 25, 8, p.spikeDark, p.speck);
      line(img, 13, 30, 23, 25, p.capLt, 1);
    } else if (theme === 'fungal') {
      line(img, 4, 15, 20, 27, p.capDark, 1);
      line(img, 24, 8, 34, 18, p.capDark, 1);
      mushroomCap(img, 7, 24, p.platformLt, p.capDark, p.capLt);
    } else if (theme === 'gearworks') {
      rivet(img, 5, 8, p.groundDark, p.capLt);
      rivet(img, 28, 24, p.groundDark, p.capLt);
      line(img, 0, 18, 40, 18, p.capDark, 1);
      line(img, 19, 0, 19, 36, p.capDark, 1);
    } else if (theme === 'neon') {
      line(img, 4, 12, 16, 12, p.cap, 1);
      line(img, 23, 28, 34, 28, p.capLt, 1);
      setPixel(img, 12, 25, p.speck);
      setPixel(img, 31, 9, p.capLt);
    } else if (theme === 'clockwork') {
      miniGear(img, 13, 13, p.capDark, p.capLt);
      miniGear(img, 29, 28, p.ground2, p.speck);
      line(img, 0, 20, 40, 20, p.capDark, 1);
    } else if (theme === 'void') {
      starSpeckles(img, `${theme}-ground-stars`, [p.speck, p.capLt, p.midB], 14);
      line(img, 5, 26, 16, 31, p.cap, 1);
      line(img, 27, 10, 35, 17, p.midB, 1);
    }
    return img;
  }

  if (theme === 'snow') {
    rect(img, 0, 0, 40, 8, p.capLt);
    rect(img, 0, 8, 40, 3, p.cap);
    rect(img, 0, 11, 40, 2, p.capDark);
    rect(img, 5, 7, 8, 4, p.capLt);
    rect(img, 20, 6, 10, 5, p.capLt);
  } else if (theme === 'sky') {
    rect(img, 0, 0, 40, 6, p.capLt);
    rect(img, 0, 6, 40, 4, p.cap);
    rect(img, 0, 10, 40, 2, p.capDark);
    ellipse(img, 8, 8, 8, 5, p.capLt);
    ellipse(img, 24, 7, 10, 5, p.capLt);
  } else if (theme === 'crystal') {
    rect(img, 0, 0, 40, 5, p.capLt);
    rect(img, 0, 5, 40, 4, p.cap);
    rect(img, 0, 9, 40, 3, p.capDark);
    tinyCrystal(img, 6, 1, p.spike, p.spikeLt);
    tinyCrystal(img, 25, 0, p.spikeDark, p.capLt);
  } else if (theme === 'fungal') {
    rect(img, 0, 0, 40, 5, p.capLt);
    rect(img, 0, 5, 40, 5, p.cap);
    rect(img, 0, 10, 40, 2, p.capDark);
    mushroomCap(img, 5, 1, p.platformLt, p.capDark, p.capLt);
    mushroomCap(img, 24, 0, p.spike, p.capDark, p.capLt);
  } else if (theme === 'gearworks') {
    rect(img, 0, 0, 40, 4, p.capLt);
    rect(img, 0, 4, 40, 5, p.cap);
    rect(img, 0, 9, 40, 3, p.capDark);
    for (let x = 5; x < 40; x += 13) rivet(img, x, 3, p.capDark, p.capLt);
  } else if (theme === 'neon') {
    rect(img, 0, 0, 40, 3, p.capLt);
    rect(img, 0, 3, 40, 4, p.cap);
    rect(img, 0, 7, 40, 4, p.capDark);
    line(img, 5, 2, 16, 2, p.speck, 1);
    line(img, 24, 4, 35, 4, p.capLt, 1);
  } else if (theme === 'clockwork') {
    rect(img, 0, 0, 40, 4, p.capLt);
    rect(img, 0, 4, 40, 5, p.cap);
    rect(img, 0, 9, 40, 3, p.capDark);
    for (let x = 2; x < 40; x += 8) rect(img, x, 8, 4, 3, p.capDark);
  } else if (theme === 'void') {
    rect(img, 0, 0, 40, 4, p.capLt);
    rect(img, 0, 4, 40, 5, p.cap);
    rect(img, 0, 9, 40, 3, p.capDark);
    starSpeckles(img, `${theme}-ground-top-stars`, [p.speck, p.capLt], 8, 14, 34);
  } else {
    rect(img, 0, 0, 40, 5, p.capLt);
    rect(img, 0, 5, 40, 5, p.cap);
    rect(img, 0, 10, 40, 2, p.capDark);
    for (let x = 0; x < 40; x += 8) {
      rect(img, x + 1, 10, 4, 3, p.cap);
      if (x % 16 === 0) rect(img, x + 5, 9, 2, 4, p.capLt);
    }
  }
  return img;
}

function drawBrickTile(theme) {
  const p = THEMES[theme];
  const img = makeImage(TILE_SIZE, TILE_SIZE);
  rect(img, 0, 0, 40, 40, p.brick);
  rect(img, 0, 0, 40, 3, p.brickLt);
  rect(img, 0, 37, 40, 3, p.mortar);
  rect(img, 37, 0, 3, 40, p.mortar);
  rect(img, 0, 18, 40, 3, p.mortar);
  rect(img, 19, 0, 3, 18, p.mortar);
  rect(img, 10, 21, 3, 19, p.mortar);
  rect(img, 28, 21, 3, 19, p.mortar);
  rect(img, 3, 4, 11, 2, p.brickLt);
  rect(img, 23, 4, 10, 2, p.brickLt);
  rect(img, 4, 24, 6, 2, p.brickLt);
  rect(img, 15, 24, 9, 2, p.brickLt);
  if (theme === 'lava') {
    line(img, 6, 31, 15, 31, p.spikeLt);
    line(img, 25, 10, 33, 15, p.spikeLt);
  }
  if (theme === 'cave') {
    line(img, 6, 33, 13, 28, p.groundDark);
    line(img, 25, 8, 31, 14, p.groundDark);
  }
  if (theme === 'crystal') {
    line(img, 6, 31, 15, 25, p.capLt);
    line(img, 24, 10, 34, 14, p.speck);
    tinyCrystal(img, 28, 25, p.spikeDark, p.spikeLt);
  }
  if (theme === 'fungal') {
    line(img, 2, 11, 16, 19, p.capDark, 2);
    line(img, 24, 2, 37, 17, p.capDark, 1);
    rect(img, 7, 27, 4, 3, p.capLt);
    rect(img, 28, 30, 5, 2, p.platformLt);
  }
  if (theme === 'gearworks') {
    rect(img, 0, 12, 40, 2, p.capDark);
    rect(img, 0, 27, 40, 2, p.capDark);
    for (let x = 4; x < 40; x += 14) {
      rivet(img, x, 6, p.groundDark, p.capLt);
      rivet(img, x + 5, 22, p.groundDark, p.capLt);
    }
  }
  if (theme === 'neon') {
    line(img, 5, 5, 14, 5, p.cap, 1);
    line(img, 23, 26, 34, 26, p.capLt, 1);
    rect(img, 16, 13, 5, 1, p.speck);
    rect(img, 30, 8, 4, 1, p.capLt);
  }
  if (theme === 'clockwork') {
    miniGear(img, 11, 11, p.capDark, p.capLt);
    miniGear(img, 29, 28, p.ground2, p.speck);
    line(img, 0, 9, 40, 9, p.cap, 1);
  }
  if (theme === 'void') {
    starSpeckles(img, `${theme}-brick-stars`, [p.speck, p.capLt], 9);
    line(img, 8, 31, 16, 24, p.cap, 1);
    line(img, 27, 9, 35, 16, p.midB, 1);
  }
  return img;
}

function drawPlatformTile(theme) {
  const p = THEMES[theme];
  const img = makeImage(TILE_SIZE, TILE_SIZE);
  if (theme === 'sky') {
    ellipse(img, 9, 14, 11, 9, p.platformLt);
    ellipse(img, 22, 12, 14, 10, p.platformLt);
    ellipse(img, 32, 16, 9, 8, p.platformLt);
    rect(img, 4, 15, 32, 9, p.platform);
    rect(img, 6, 23, 28, 3, p.platformDark);
    rect(img, 5, 5, 30, 4, p.capLt);
  } else {
    rect(img, 0, 0, 40, 26, p.platform);
    rect(img, 0, 0, 40, 5, p.platformLt);
    rect(img, 0, 23, 40, 3, p.platformDark);
    if (theme === 'meadow') {
      rect(img, 0, 0, 40, 5, p.capLt);
      rect(img, 0, 5, 40, 4, p.cap);
      for (let x = 4; x < 40; x += 10) line(img, x, 11, x + 6, 22, p.platformDark);
    } else if (theme === 'snow') {
      rect(img, 0, 0, 40, 7, p.capLt);
      rect(img, 0, 7, 40, 3, p.capDark);
      rect(img, 8, 0, 9, 9, p.capLt);
      rect(img, 24, 0, 10, 8, p.capLt);
    } else if (theme === 'lava') {
      rect(img, 0, 0, 40, 4, p.capLt);
      rect(img, 0, 4, 40, 3, p.cap);
      line(img, 9, 14, 17, 18, p.capLt);
      line(img, 25, 8, 34, 8, p.capLt);
    } else if (theme === 'crystal') {
      rect(img, 0, 0, 40, 4, p.capLt);
      rect(img, 0, 4, 40, 5, p.cap);
      rect(img, 0, 22, 40, 4, p.platformDark);
      tinyCrystal(img, 5, 11, p.spikeDark, p.spikeLt);
      tinyCrystal(img, 27, 9, p.spike, p.capLt);
      line(img, 13, 19, 25, 14, p.speck, 1);
    } else if (theme === 'fungal') {
      ellipse(img, 11, 9, 16, 8, p.platformLt);
      ellipse(img, 28, 10, 17, 8, p.spike);
      rect(img, 0, 8, 40, 14, p.platform);
      rect(img, 0, 20, 40, 6, p.platformDark);
      rect(img, 3, 0, 34, 5, p.capLt);
      mushroomCap(img, 7, 3, p.platformLt, p.capDark, p.capLt);
    } else if (theme === 'gearworks') {
      rect(img, 0, 0, 40, 5, p.capLt);
      rect(img, 0, 5, 40, 4, p.cap);
      for (let x = 0; x < 40; x += 10) rect(img, x, 0, 5, 5, x % 20 === 0 ? p.capDark : p.capLt);
      rect(img, 0, 22, 40, 4, p.platformDark);
      rivet(img, 8, 12, p.groundDark, p.capLt);
      rivet(img, 28, 12, p.groundDark, p.capLt);
    } else if (theme === 'neon') {
      rect(img, 0, 0, 40, 4, p.capLt);
      rect(img, 0, 4, 40, 4, p.cap);
      rect(img, 0, 22, 40, 4, p.platformDark);
      line(img, 4, 12, 16, 12, p.speck, 1);
      line(img, 23, 16, 35, 16, p.capLt, 1);
      for (let x = 5; x < 40; x += 10) rect(img, x, 8, 2, 14, p.ground2);
    } else if (theme === 'clockwork') {
      rect(img, 0, 0, 40, 5, p.capLt);
      rect(img, 0, 5, 40, 4, p.cap);
      rect(img, 0, 22, 40, 4, p.platformDark);
      miniGear(img, 10, 15, p.capDark, p.capLt);
      miniGear(img, 29, 15, p.capDark, p.capLt);
      rect(img, 18, 20, 4, 6, p.cap);
    } else if (theme === 'void') {
      rect(img, 0, 0, 40, 4, p.capLt);
      rect(img, 0, 4, 40, 5, p.cap);
      rect(img, 0, 22, 40, 4, p.platformDark);
      starSpeckles(img, `${theme}-platform-stars`, [p.speck, p.capLt], 9, 9, 22);
      line(img, 8, 18, 17, 14, p.midB, 1);
      line(img, 24, 13, 34, 19, p.capLt, 1);
    } else {
      rect(img, 0, 0, 40, 4, p.capLt);
      rect(img, 0, 4, 40, 4, p.cap);
      rect(img, 6, 10, 6, 2, p.brickLt);
      rect(img, 24, 17, 8, 2, p.brickLt);
    }
  }
  return img;
}

function drawSpikeTile(theme) {
  const p = THEMES[theme];
  const img = makeImage(TILE_SIZE, TILE_SIZE);
  rect(img, 0, 36, 40, 4, p.base);
  rect(img, 0, 34, 40, 2, p.spikeDark);
  for (let i = 0; i < 3; i++) {
    const x = i * 13 + 2;
    if (theme === 'crystal') {
      polygon(img, [[x, 36], [x + 5, 8], [x + 12, 36]], p.spikeDark);
      polygon(img, [[x + 2, 35], [x + 6, 10], [x + 10, 35]], p.spike);
      polygon(img, [[x + 6, 24], [x + 12, 15], [x + 10, 31]], p.capDark);
      line(img, x + 6, 11, x + 5, 34, p.spikeLt, 1);
    } else if (theme === 'fungal') {
      polygon(img, [[x + 1, 36], [x + 6, 11], [x + 11, 36]], p.spikeDark);
      polygon(img, [[x + 3, 35], [x + 6, 14], [x + 9, 35]], p.spike);
      line(img, x + 6, 16, x + 3, 31, p.spikeLt, 1);
      rect(img, x + 8, 27, 3, 3, p.platformLt);
    } else if (theme === 'clockwork') {
      polygon(img, [[x + 1, 36], [x + 6, 8], [x + 11, 36]], p.spikeDark);
      polygon(img, [[x + 3, 35], [x + 6, 10], [x + 9, 35]], p.spike);
      rect(img, x + 5, 17, 3, 15, p.spikeLt);
      rect(img, x + 4, 28, 5, 3, p.capDark);
    } else if (theme === 'neon') {
      polygon(img, [[x, 36], [x + 6, 9], [x + 12, 36]], p.spikeDark);
      polygon(img, [[x + 2, 35], [x + 6, 12], [x + 10, 35]], p.spike);
      line(img, x + 6, 13, x + 6, 34, p.spikeLt, 1);
      line(img, x + 3, 24, x + 9, 20, p.capLt, 1);
    } else if (theme === 'void') {
      polygon(img, [[x, 36], [x + 6, 8], [x + 12, 36]], p.spikeDark);
      polygon(img, [[x + 2, 35], [x + 6, 12], [x + 10, 35]], p.spike);
      line(img, x + 6, 13, x + 6, 34, p.spikeLt, 1);
      setPixel(img, x + 4, 21, p.speck);
      setPixel(img, x + 8, 28, p.capLt);
    } else {
      polygon(img, [[x, 36], [x + 6, 9], [x + 12, 36]], p.spikeDark);
      polygon(img, [[x + 2, 35], [x + 6, 12], [x + 10, 35]], p.spike);
      line(img, x + 6, 13, x + 6, 34, p.spikeLt, 1);
      if (theme === 'lava') line(img, x + 8, 18, x + 10, 35, p.spikeLt, 1);
    }
  }
  return img;
}

function drawFarBackground(theme) {
  const p = THEMES[theme];
  const img = makeImage(VIEW_W, VIEW_H, p.far[0]);
  rect(img, 0, 160, VIEW_W, 190, p.far[1]);
  rect(img, 0, 350, VIEW_W, 190, p.far[2]);

  if (theme === 'meadow') {
    ellipse(img, 820, 90, 44, 44, p.sun);
    for (let x = -80; x < VIEW_W + 160; x += 210) ellipse(img, x, 458, 150, 110, p.hill2);
    for (let x = 40; x < VIEW_W + 160; x += 240) ellipse(img, x, 470, 170, 120, p.hill);
    cloudCluster(img, 150, 100, '#f6fdff');
    cloudCluster(img, 520, 80, '#eef9ff');
  } else if (theme === 'cave') {
    ellipse(img, 770, 120, 42, 42, p.sun);
    for (let x = -60; x < VIEW_W + 120; x += 180) {
      polygon(img, [[x, 540], [x + 60, 280], [x + 130, 540]], p.hill);
      polygon(img, [[x + 80, 0], [x + 140, 210], [x + 210, 0]], p.hill2);
    }
    crystalCluster(img, 680, 365, '#6f7da0', '#b3c3ff');
    crystalCluster(img, 280, 390, '#5b6687', '#9fb1e6');
  } else if (theme === 'sky') {
    ellipse(img, 805, 78, 38, 38, p.sun);
    cloudCluster(img, 180, 150, '#f8fdff');
    cloudCluster(img, 470, 95, '#ffffff');
    cloudCluster(img, 735, 200, '#edf8ff');
    for (let x = 90; x < VIEW_W; x += 260) {
      polygon(img, [[x, 355], [x + 90, 330], [x + 160, 355], [x + 120, 388], [x + 40, 390]], '#cfe6f5');
    }
  } else if (theme === 'lava') {
    ellipse(img, 790, 100, 46, 46, p.sun);
    for (let x = -80; x < VIEW_W + 100; x += 210) {
      polygon(img, [[x, 540], [x + 80, 250], [x + 190, 540]], p.hill2);
      rect(img, x + 72, 420, 34, 120, '#c0451d');
    }
    for (let x = 0; x < VIEW_W; x += 90) rect(img, x, 505 + ((x / 90) % 2) * 8, 55, 8, '#d85a23');
  } else if (theme === 'crystal') {
    ellipse(img, 790, 88, 38, 38, p.sun);
    for (let x = -40; x < VIEW_W + 80; x += 185) {
      polygon(img, [[x, 540], [x + 60, 260], [x + 130, 540]], p.hill);
      polygon(img, [[x + 80, 540], [x + 138, 310], [x + 210, 540]], p.hill2);
    }
    for (let x = 120; x < VIEW_W; x += 290) {
      rect(img, x, 280, 24, 180, p.trunk);
      rect(img, x + 92, 280, 24, 180, p.trunk);
      polygon(img, [[x - 14, 285], [x + 58, 230], [x + 130, 285]], p.hill2);
    }
    crystalCluster(img, 650, 430, p.hill2, p.midB);
  } else if (theme === 'fungal') {
    ellipse(img, 790, 95, 34, 34, p.sun);
    for (let x = -80; x < VIEW_W + 120; x += 210) {
      rect(img, x + 75, 290, 34, 210, p.trunk);
      ellipse(img, x + 92, 270, 118, 54, p.hill);
      ellipse(img, x + 125, 300, 76, 36, p.hill2);
    }
    for (let i = 0; i < 80; i++) {
      const rng = mulberry32(seedFor(`fungal-far-${i}`));
      setPixel(img, Math.floor(rng() * VIEW_W), 130 + Math.floor(rng() * 300), i % 2 ? p.capLt : p.midB);
    }
  } else if (theme === 'gearworks') {
    ellipse(img, 790, 90, 36, 36, p.sun);
    largeGear(img, 180, 305, 72, p.hill, p.hill2);
    largeGear(img, 530, 240, 58, p.hill, p.hill2);
    largeGear(img, 820, 340, 86, p.hill, p.hill2);
    for (let x = 50; x < VIEW_W; x += 180) {
      rect(img, x, 150, 22, 330, p.trunk);
      rect(img, x - 22, 220, 120, 18, p.hill2);
      rect(img, x + 35, 310, 145, 16, p.hill);
    }
  } else if (theme === 'neon') {
    ellipse(img, 800, 90, 30, 30, p.sun);
    for (let x = 30; x < VIEW_W; x += 90) {
      const h = 140 + (x % 4) * 38;
      rect(img, x, 540 - h, 52, h, x % 180 === 0 ? p.hill2 : p.hill);
      rect(img, x + 9, 540 - h + 30, 8, 30, p.cap);
      rect(img, x + 31, 540 - h + 70, 10, 20, p.capLt);
    }
    for (let x = 0; x < VIEW_W; x += 35) line(img, x, 70, x - 18, 150, '#1b355c', 1);
  } else if (theme === 'clockwork') {
    ellipse(img, 785, 96, 38, 38, p.sun);
    largeGear(img, 185, 285, 76, p.hill, p.hill2);
    largeGear(img, 595, 330, 92, p.hill, p.hill2);
    for (let x = 100; x < VIEW_W; x += 250) {
      rect(img, x, 120, 42, 420, p.trunk);
      polygon(img, [[x - 30, 190], [x + 21, 145], [x + 72, 190]], p.hill2);
      rect(img, x - 22, 190, 86, 20, p.hill2);
    }
    line(img, 480, 105, 480, 380, p.hill2, 3);
    ellipse(img, 480, 398, 36, 54, p.hill2);
  } else if (theme === 'void') {
    ellipse(img, 790, 92, 34, 34, p.sun);
    for (let x = -80; x < VIEW_W + 120; x += 250) {
      polygon(img, [[x, 540], [x + 110, 330], [x + 230, 540]], p.hill);
    }
    polygon(img, [[430, 510], [455, 315], [505, 280], [555, 315], [580, 510]], p.hill2);
    rect(img, 455, 420, 100, 90, p.hill2);
    line(img, 180, 115, 250, 210, p.midB, 2);
    line(img, 640, 120, 600, 245, p.capLt, 2);
    for (let i = 0; i < 140; i++) {
      const rng = mulberry32(seedFor(`void-far-${i}`));
      setPixel(img, Math.floor(rng() * VIEW_W), Math.floor(rng() * 360), i % 3 ? p.speck : p.capLt);
    }
  } else {
    ellipse(img, 790, 90, 40, 40, p.sun);
    for (let x = -90; x < VIEW_W + 120; x += 220) {
      polygon(img, [[x, 520], [x + 120, 245], [x + 250, 520]], p.hill);
      polygon(img, [[x + 55, 520], [x + 128, 300], [x + 198, 520]], p.hill2);
    }
    for (let x = 0; x < VIEW_W; x += 64) rect(img, x, 210 + (x % 3) * 18, 28, 3, '#edf6fc');
  }
  return img;
}

function cloudCluster(img, cx, cy, color) {
  ellipse(img, cx, cy, 34, 20, color);
  ellipse(img, cx + 34, cy + 5, 28, 17, color);
  ellipse(img, cx - 30, cy + 8, 24, 15, color);
  rect(img, cx - 36, cy + 12, 86, 11, color);
}

function wispyCloud(img, cx, cy, color) {
  ellipse(img, cx, cy, 26, 9, color);
  ellipse(img, cx + 36, cy + 5, 22, 7, color);
  ellipse(img, cx - 34, cy + 6, 18, 6, color);
  line(img, cx + 64, cy + 1, cx + 76, cy + 1, color, 2);
  line(img, cx - 62, cy + 2, cx - 50, cy + 2, color, 2);
}

function crystalCluster(img, x, y, dark, light) {
  polygon(img, [[x, y], [x + 24, y - 74], [x + 44, y]], dark);
  polygon(img, [[x + 35, y], [x + 54, y - 55], [x + 70, y]], dark);
  line(img, x + 25, y - 68, x + 25, y - 8, light, 2);
  line(img, x + 55, y - 50, x + 55, y - 8, light, 2);
}

function largeGear(img, cx, cy, r, color, light) {
  for (let a = 0; a < 8; a++) {
    const px = Math.round(cx + Math.cos(a * Math.PI / 4) * r);
    const py = Math.round(cy + Math.sin(a * Math.PI / 4) * r);
    rect(img, px - 8, py - 8, 16, 16, color);
  }
  ellipse(img, cx, cy, r, r, color);
  ellipse(img, cx, cy, Math.max(6, r - 16), Math.max(6, r - 16), light);
  ellipse(img, cx, cy, Math.max(4, r - 24), Math.max(4, r - 24), color);
  line(img, cx - r + 10, cy, cx + r - 10, cy, light, 3);
  line(img, cx, cy - r + 10, cx, cy + r - 10, light, 3);
}

function drawMidBackground(theme) {
  const p = THEMES[theme];
  const img = makeImage(VIEW_W, VIEW_H);
  if (theme === 'meadow') {
    for (let x = 80; x < VIEW_W - 80; x += 160) {
      ellipse(img, x, 470, 70, 34, p.midA);
      ellipse(img, x + 42, 462, 52, 28, p.midB);
      rect(img, x - 12, 380, 18, 98, p.trunk);
      ellipse(img, x - 4, 360, 44, 34, p.midB);
      ellipse(img, x - 36, 382, 34, 26, p.midA);
      ellipse(img, x + 32, 384, 34, 26, p.midA);
    }
  } else if (theme === 'cave') {
    for (let x = 90; x < VIEW_W - 90; x += 145) {
      polygon(img, [[x, 540], [x + 24, 405], [x + 52, 540]], p.midA);
      polygon(img, [[x + 54, 0], [x + 82, 160], [x + 112, 0]], p.trunk);
      if (x % 2 === 0) crystalCluster(img, x + 18, 455, p.midB, p.spikeLt);
    }
  } else if (theme === 'sky') {
    for (let x = 90; x < VIEW_W - 190; x += 180) {
      wispyCloud(img, x, 335 + (x % 3) * 18, '#edf8ff');
      polygon(img, [[x + 58, 270], [x + 92, 255], [x + 124, 272], [x + 108, 288], [x + 76, 292], [x + 66, 284]], p.midB);
      line(img, x + 137, 248, x + 174, 253, '#eef9ff', 2);
    }
  } else if (theme === 'lava') {
    for (let x = 90; x < VIEW_W - 160; x += 150) {
      polygon(img, [[x, 540], [x + 9, 438], [x + 28, 392], [x + 51, 414], [x + 66, 540]], '#4b1713');
      polygon(img, [[x + 62, 540], [x + 76, 466], [x + 103, 424], [x + 126, 450], [x + 140, 540]], '#38100f');
      rect(img, x - 10, 518, 118, 6, '#7e2b17');
      line(img, x + 31, 416, x + 37, 480, '#9c3519', 2);
    }
  } else if (theme === 'crystal') {
    for (let x = 90; x < VIEW_W - 120; x += 155) {
      polygon(img, [[x, 540], [x + 22, 395], [x + 54, 540]], p.midA);
      polygon(img, [[x + 42, 540], [x + 68, 432], [x + 98, 540]], p.trunk);
      crystalCluster(img, x + 18, 468, p.hill2, p.midB);
      rect(img, x + 105, 372, 16, 112, p.trunk);
      rect(img, x + 86, 392, 55, 12, p.hill2);
    }
  } else if (theme === 'fungal') {
    for (let x = 95; x < VIEW_W - 130; x += 145) {
      rect(img, x + 16, 390, 16, 130, p.trunk);
      ellipse(img, x + 24, 372, 56, 26, p.midA);
      ellipse(img, x + 58, 430, 38, 20, p.hill2);
      line(img, x - 28, 260, x + 8, 440, p.capDark, 2);
      for (let i = 0; i < 8; i++) setPixel(img, x + 74 + i * 6, 350 + (i % 3) * 16, p.midB);
    }
  } else if (theme === 'gearworks') {
    for (let x = 120; x < VIEW_W - 150; x += 190) {
      largeGear(img, x, 420, 46, p.midA, p.trunk);
      rect(img, x - 70, 310, 34, 180, p.trunk);
      rect(img, x + 58, 290, 28, 200, p.trunk);
      rect(img, x - 64, 365, 132, 10, p.hill2);
      rect(img, x - 48, 452, 150, 8, p.hill);
    }
  } else if (theme === 'neon') {
    for (let x = 90; x < VIEW_W - 120; x += 135) {
      const h = 88 + (x % 4) * 20;
      rect(img, x, 520 - h, 52, h, p.midA);
      rect(img, x + 8, 520 - h + 18, 30, 6, p.cap);
      rect(img, x + 18, 520 - h + 52, 18, 5, p.capLt);
      line(img, x - 16, 315, x - 40, 430, '#18345a', 1);
      line(img, x + 64, 300, x + 40, 420, '#18345a', 1);
    }
  } else if (theme === 'clockwork') {
    for (let x = 110; x < VIEW_W - 150; x += 170) {
      largeGear(img, x, 390, 42, p.midA, p.trunk);
      rect(img, x - 70, 320, 24, 180, p.trunk);
      rect(img, x + 52, 300, 22, 210, p.trunk);
      line(img, x + 8, 265, x + 8, 456, p.hill2, 2);
      ellipse(img, x + 8, 468, 22, 34, p.hill2);
    }
  } else if (theme === 'void') {
    for (let x = 95; x < VIEW_W - 140; x += 165) {
      polygon(img, [[x, 462], [x + 40, 428], [x + 78, 462], [x + 58, 486], [x + 18, 486]], p.midA);
      polygon(img, [[x + 22, 540], [x + 48, 485], [x + 78, 540]], p.trunk);
      line(img, x + 92, 320, x + 140, 384, p.midB, 2);
      line(img, x + 116, 386, x + 90, 458, p.capLt, 1);
      setPixel(img, x + 18, 312, p.speck);
      setPixel(img, x + 68, 358, p.capLt);
    }
  } else {
    for (let x = 95; x < VIEW_W - 90; x += 150) {
      rect(img, x - 5, 400, 10, 110, p.trunk);
      polygon(img, [[x, 300], [x - 44, 420], [x + 44, 420]], p.midA);
      polygon(img, [[x, 345], [x - 54, 480], [x + 54, 480]], p.midA);
      rect(img, x - 48, 472, 96, 7, p.midB);
      polygon(img, [[x + 50, 520], [x + 68, 430], [x + 84, 520]], p.midB);
    }
  }
  return img;
}

function scaleBlit(src, dst, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y * src.height / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x * src.width / dw));
      const sidx = (sy * src.width + sx) * 4;
      const a = src.data[sidx + 3];
      if (a === 0) continue;
      const didx = ((dy + y) * dst.width + dx + x) * 4;
      dst.data[didx] = src.data[sidx];
      dst.data[didx + 1] = src.data[sidx + 1];
      dst.data[didx + 2] = src.data[sidx + 2];
      dst.data[didx + 3] = a;
    }
  }
}

function checker(img, x, y, w, h) {
  for (let py = y; py < y + h; py += 8) {
    for (let px = x; px < x + w; px += 8) {
      rect(img, px, py, 8, 8, ((px + py) / 8) % 2 === 0 ? '#263040' : '#1a2230');
    }
  }
}

function makePreview(generated) {
  const rowH = 148;
  const img = makeImage(1120, 20 + rowH * THEME_NAMES.length, '#111827');
  THEME_NAMES.forEach((theme, row) => {
    const y = 18 + row * rowH;
    for (let i = 0; i < 5; i++) checker(img, 18 + i * 52, y, 48, 48);
    scaleBlit(generated.tiles[`${theme}-ground`], img, 22, y + 4, 40, 40);
    scaleBlit(generated.tiles[`${theme}-ground-top`], img, 74, y + 4, 40, 40);
    scaleBlit(generated.tiles[`${theme}-brick`], img, 126, y + 4, 40, 40);
    scaleBlit(generated.tiles[`${theme}-platform`], img, 178, y + 4, 40, 40);
    scaleBlit(generated.tiles[`${theme}-spike`], img, 230, y + 4, 40, 40);
    scaleBlit(generated.backgrounds[`${theme}-far`], img, 310, y, 384, 108);
    rect(img, 706, y, 384, 108, '#1b2433');
    scaleBlit(generated.backgrounds[`${theme}-mid`], img, 706, y, 384, 108);
  });
  return img;
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
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

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

function alphaAt(img, x, y) {
  return img.data[(y * img.width + x) * 4 + 3];
}

function samePixel(img, x1, x2, y) {
  const a = (y * img.width + x1) * 4;
  const b = (y * img.width + x2) * 4;
  return img.data[a] === img.data[b] &&
    img.data[a + 1] === img.data[b + 1] &&
    img.data[a + 2] === img.data[b + 2] &&
    img.data[a + 3] === img.data[b + 3];
}

function validate(generated) {
  for (const [name, img] of Object.entries(generated.tiles)) {
    if (img.width !== 40 || img.height !== 40) throw new Error(`${name} is not 40x40`);
    if (name.endsWith('-platform')) {
      for (let y = 26; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          if (alphaAt(img, x, y) !== 0) throw new Error(`${name} lower 14px must be transparent`);
        }
      }
    }
  }
  for (const [name, img] of Object.entries(generated.backgrounds)) {
    if (img.width !== 960 || img.height !== 540) throw new Error(`${name} is not 960x540`);
    if (name.endsWith('-mid')) {
      for (let y = 0; y < img.height; y++) {
        if (!samePixel(img, 0, img.width - 1, y)) throw new Error(`${name} left/right edges do not match`);
      }
    }
  }
}

function main() {
  ensureDir(TILE_DIR);
  ensureDir(BG_DIR);
  ensureDir(path.dirname(PREVIEW_FILE));

  const generated = { tiles: {}, backgrounds: {} };
  for (const theme of THEME_NAMES) {
    generated.tiles[`${theme}-ground`] = drawGroundTile(theme, false);
    generated.tiles[`${theme}-ground-top`] = drawGroundTile(theme, true);
    generated.tiles[`${theme}-brick`] = drawBrickTile(theme);
    generated.tiles[`${theme}-platform`] = drawPlatformTile(theme);
    generated.tiles[`${theme}-spike`] = drawSpikeTile(theme);
    generated.backgrounds[`${theme}-far`] = drawFarBackground(theme);
    generated.backgrounds[`${theme}-mid`] = drawMidBackground(theme);
  }

  generated.preview = makePreview(generated);
  validate(generated);

  let written = 0;
  for (const [name, img] of Object.entries(generated.tiles)) {
    savePng(path.join(TILE_DIR, `${name}.png`), img);
    written++;
  }
  for (const [name, img] of Object.entries(generated.backgrounds)) {
    savePng(path.join(BG_DIR, `${name}.png`), img);
    written++;
  }
  savePng(PREVIEW_FILE, generated.preview);

  console.log(`Generated ${written} art assets.`);
  console.log(`Tiles: ${path.relative(ROOT, TILE_DIR)}`);
  console.log(`Backgrounds: ${path.relative(ROOT, BG_DIR)}`);
  console.log(`Preview: ${path.relative(ROOT, PREVIEW_FILE)}`);
}

main();
