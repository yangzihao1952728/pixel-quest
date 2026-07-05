/* =========================================================================
   pq-art.js — external art manifest loading + spritesheet frame drawing.
   Art is supplied through assets/pixel-quest-assets.js; missing or unloaded
   resources return null and callers fall back to procedural canvas drawing.
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const ctx = PQ.ctx;

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

PQ.art = { ART, ART_IMAGES, resolveAssetSrc, loadArtAssets, getArtImage, firstArtImage, animationFrame, drawArtFrame, drawArtKey };

// Kick off image loading as soon as the manifest is available.
loadArtAssets();
})();
