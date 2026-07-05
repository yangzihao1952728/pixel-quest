/* =========================================================================
   pq-ui.js — DOM overlays (title / level select / shop / end / pause), the
   shop purchase flow, the HUD, and game-flow transitions (startGame / endGame /
   togglePause). All DOM is owned here; canvas HUD drawing stays in pq-render.js.
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const {
  LEVELS, LIFE_UPGRADE_COSTS, NEXT_RUN_LIFE_COST, NEXT_RUN_LIFE_MAX,
  SHOP_SKILLS, SKILL_IDS, SKILLS, CHARACTERS,
} = PQ;

const titleScreen = document.getElementById('titleScreen');
const endScreen   = document.getElementById('endScreen');
const pauseScreen = document.getElementById('pauseScreen');
const levelScreen = document.getElementById('levelScreen');
const shopScreen  = document.getElementById('shopScreen');
const menuStats   = document.getElementById('menuStats');
const levelStats  = document.getElementById('levelStats');
const shopStats   = document.getElementById('shopStats');
const levelGrid   = document.getElementById('levelGrid');
const upgradeGrid = document.getElementById('upgradeGrid');
const skillShopGrid = document.getElementById('skillShopGrid');
const skinGrid = document.getElementById('skinGrid');
const importSaveFile = document.getElementById('importSaveFile');

function hideScreens() {
  for (const el of [titleScreen, endScreen, pauseScreen, levelScreen, shopScreen])
    el?.classList.add('hidden');
}
function statMarkup() {
  const save = PQ.state.save;
  const hero = PQ.selectedCharacter();
  const ownedSkills = SKILL_IDS.filter(id => save.purchasedSkills[id]).length;
  return `<span>💰 ${save.coins}</span><span>🏁 ${save.highestLevel}/${LEVELS.length}</span>` +
         `<span>❤️ ${3 + save.lifeUpgrades + (hero.lifeBonus || 0)}${save.nextRunLives ? ` +${save.nextRunLives}` : ''}</span>` +
         `<span>🎭 ${hero.name}</span><span>✦ ${ownedSkills}/${SKILL_IDS.length}</span>`;
}
function refreshMetaUI() {
  const game = PQ.state.game, save = PQ.state.save;
  game.save = save;
  if (game.state !== 'playing') {
    game.hero = PQ.selectedCharacter();
    game.stats = PQ.makeHeroStats(game.hero);
  }
  const html = statMarkup();
  if (menuStats) menuStats.innerHTML = html;
  if (levelStats) levelStats.innerHTML = html;
  if (shopStats) shopStats.innerHTML = html;
  const bankEl = document.getElementById('bank');
  if (bankEl) bankEl.textContent = save.coins;
}
function showTitle() {
  const game = PQ.state.game;
  game.state = 'title';
  hideScreens();
  titleScreen.classList.remove('hidden');
  refreshMetaUI();
  renderLevelSelect();
  renderShop();
}
function showLevelSelect() {
  PQ.state.game.state = 'title';
  hideScreens();
  renderLevelSelect();
  levelScreen.classList.remove('hidden');
}
function showShop() {
  PQ.state.game.state = 'title';
  hideScreens();
  renderShop();
  shopScreen.classList.remove('hidden');
}
function renderLevelSelect() {
  if (!levelGrid) return;
  const save = PQ.state.save;
  refreshMetaUI();
  levelGrid.innerHTML = '';
  PQ.LEVEL_NAMES.forEach((name, i) => {
    const locked = i + 1 > save.highestLevel;
    const btn = document.createElement('button');
    btn.className = `tile ${locked ? 'locked' : ''}`;
    btn.disabled = locked;
    btn.innerHTML = `<h3>${i+1}. ${name}</h3><p>${locked ? '未解锁' : '已解锁'}</p>` +
                    `<span class="tag">${locked ? '🔒' : '▶'} ${locked ? '继续推进冒险' : '开始挑战'}</span>`;
    if (!locked) btn.addEventListener('click', () => startGame(i));
    levelGrid.appendChild(btn);
  });
}
function renderShop() {
  if (!upgradeGrid || !skillShopGrid || !skinGrid) return;
  const save = PQ.state.save;
  refreshMetaUI();
  upgradeGrid.innerHTML = '';
  const lifeMaxed = save.lifeUpgrades >= LIFE_UPGRADE_COSTS.length;
  const lifeCost = LIFE_UPGRADE_COSTS[save.lifeUpgrades] || 0;
  const life = document.createElement('div');
  life.className = 'tile';
  life.innerHTML = `<h3>生命上限 +1</h3><p>当前额外生命：${save.lifeUpgrades}</p>` +
                   `<p class="cost">${lifeMaxed ? '已满级' : `价格 ${lifeCost} 金币`}</p>`;
  const lifeBtn = document.createElement('button');
  lifeBtn.className = 'btn small gold';
  lifeBtn.textContent = lifeMaxed ? '已满级' : '购买';
  lifeBtn.disabled = lifeMaxed || save.coins < lifeCost;
  lifeBtn.addEventListener('click', buyLifeUpgrade);
  life.appendChild(lifeBtn);
  upgradeGrid.appendChild(life);

  const nextRunMaxed = save.nextRunLives >= NEXT_RUN_LIFE_MAX;
  const nextLife = document.createElement('div');
  nextLife.className = 'tile';
  nextLife.innerHTML = `<h3>下次冒险生命 +1</h3><p>下次开局额外生命：${save.nextRunLives}/${NEXT_RUN_LIFE_MAX}</p>` +
                       `<p class="cost">${nextRunMaxed ? '已达上限' : `价格 ${NEXT_RUN_LIFE_COST} 金币`}</p>`;
  const nextLifeBtn = document.createElement('button');
  nextLifeBtn.className = 'btn small alt';
  nextLifeBtn.textContent = nextRunMaxed ? '已达上限' : '购买';
  nextLifeBtn.disabled = nextRunMaxed || save.coins < NEXT_RUN_LIFE_COST;
  nextLifeBtn.addEventListener('click', buyNextRunLife);
  nextLife.appendChild(nextLifeBtn);
  upgradeGrid.appendChild(nextLife);

  skillShopGrid.innerHTML = '';
  for (const id of SKILL_IDS) {
    const item = SHOP_SKILLS[id], s = SKILLS[id];
    const known = PQ.isSkillKnown(id);
    const owned = save.purchasedSkills[id];
    const tile = document.createElement('div');
    tile.className = `tile ${known ? '' : 'locked'}`;
    tile.innerHTML = `<h3 style="color:${s.color}">${s.glyph} ${s.name}</h3><p>${s.hint}</p>` +
                     `<p class="cost">${owned ? '已购买' : known ? `价格 ${item.cost} 金币` : `第 ${item.level} 关后发现`}</p>`;
    const btn = document.createElement('button');
    btn.className = 'btn small alt';
    btn.textContent = owned ? '已拥有' : '购买';
    btn.disabled = owned || !known || save.coins < item.cost;
    btn.addEventListener('click', () => buySkill(id));
    tile.appendChild(btn);
    skillShopGrid.appendChild(tile);
  }

  skinGrid.innerHTML = '';
  for (const [id, ch] of Object.entries(CHARACTERS)) {
    const owned = !!save.ownedSkins[id], selected = save.selectedSkin === id;
    const tile = document.createElement('div');
    tile.className = `tile ${owned ? '' : 'locked'}`;
    const skills = ch.skills.length ? ch.skills.map(s => SKILLS[s].name).join(' / ') : '无';
    tile.innerHTML = `<h3><span style="color:${ch.cap}">■</span> ${ch.name}</h3><p>${ch.desc}</p>` +
                     `<p>初始技能：${skills}<br>速度 ${Math.round(ch.move*100)}% · 跳跃 ${Math.round(ch.jump*100)}% · 生命 +${ch.lifeBonus}</p>` +
                     `<p class="cost">${owned ? (selected ? '使用中' : '已拥有') : `价格 ${ch.cost} 金币`}</p>`;
    const btn = document.createElement('button');
    btn.className = selected ? 'btn small gold' : 'btn small alt';
    btn.textContent = selected ? '使用中' : owned ? '选择' : '购买';
    btn.disabled = selected || (!owned && save.coins < ch.cost);
    btn.addEventListener('click', () => buyOrSelectSkin(id));
    tile.appendChild(btn);
    skinGrid.appendChild(tile);
  }
}
function buyLifeUpgrade() {
  const save = PQ.state.save;
  const cost = LIFE_UPGRADE_COSTS[save.lifeUpgrades];
  if (cost == null || save.coins < cost) return;
  save.coins -= cost;
  save.lifeUpgrades++;
  PQ.commitSave();
}
function buyNextRunLife() {
  const save = PQ.state.save;
  if (save.nextRunLives >= NEXT_RUN_LIFE_MAX || save.coins < NEXT_RUN_LIFE_COST) return;
  save.coins -= NEXT_RUN_LIFE_COST;
  save.nextRunLives++;
  PQ.commitSave();
}
function buySkill(skill) {
  const save = PQ.state.save;
  const item = SHOP_SKILLS[skill];
  if (!item || save.purchasedSkills[skill] || !PQ.isSkillKnown(skill) || save.coins < item.cost) return;
  save.coins -= item.cost;
  save.purchasedSkills[skill] = true;
  save.unlockedSkills[skill] = true;
  PQ.commitSave();
}
function buyOrSelectSkin(id) {
  const save = PQ.state.save;
  const ch = CHARACTERS[id];
  if (!ch) return;
  if (!save.ownedSkins[id]) {
    if (save.coins < ch.cost) return;
    save.coins -= ch.cost;
    save.ownedSkins[id] = true;
  }
  save.selectedSkin = id;
  PQ.commitSave();
}
function exportSaveFile() {
  const blob = new Blob([JSON.stringify(PQ.state.save, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixel-quest-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
function importSave(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      PQ.state.save = PQ.normalizeSave(JSON.parse(String(reader.result || '{}')));
      PQ.state.game.save = PQ.state.save;
      PQ.commitSave();
      showShop();
    } catch (e) {
      alert('存档文件无法读取');
    }
  };
  reader.readAsText(file);
}

function startGame(levelIndex = 0){
  const game = PQ.state.game, save = PQ.state.save;
  PQ.audio.actx(); // unlock audio on user gesture
  const maxIndex = Math.min(save.highestLevel - 1, LEVELS.length - 1);
  const startIndex = Math.max(0, Math.min(levelIndex, maxIndex));
  game.state='playing'; game.startLevelIndex=startIndex; game.levelIndex=startIndex; game.coins=0;
  game.hero = PQ.selectedCharacter();
  game.stats = PQ.makeHeroStats(game.hero);
  const nextRunBonus = save.nextRunLives || 0;
  game.lives = game.stats.maxLives + nextRunBonus;
  if (nextRunBonus > 0) {
    save.nextRunLives = 0;
    PQ.commitSave(false);
  }
  game.skills = PQ.buildStartingSkills(startIndex);
  game.upgrades = {};
  game.toast = null;
  document.getElementById('toast')?.classList.remove('show');
  PQ.parseLevel(startIndex);
  hideScreens();
  updateHUD();
}
function endGame(won){
  const game = PQ.state.game, save = PQ.state.save;
  game.state = won ? 'win' : 'lose';
  document.getElementById('endTitle').textContent = won ? '🎉 通关啦！' : '💀 游戏结束';
  document.getElementById('endText').innerHTML = won
    ? `你穿越了全部 ${LEVELS.length} 个关卡！<br>本局收集 <b>${game.coins}</b> 枚金币，银行金币 <b>${save.coins}</b>。`
    : `别灰心，再来一次！<br>本局收集 <b>${game.coins}</b> 枚金币，银行金币 <b>${save.coins}</b>。`;
  hideScreens();
  endScreen.classList.remove('hidden');
}
function togglePause(){
  const game = PQ.state.game;
  if (game.state==='playing'){ game.state='paused'; pauseScreen.classList.remove('hidden'); }
  else if (game.state==='paused'){ game.state='playing'; pauseScreen.classList.add('hidden'); }
}
function updateHUD(){
  const game = PQ.state.game, save = PQ.state.save;
  document.getElementById('coins').textContent = game.coins;
  document.getElementById('bank').textContent = save.coins;
  document.getElementById('lives').textContent = Math.max(0,game.lives);
  document.getElementById('level').textContent = game.levelIndex+1;
  document.getElementById('time').textContent = Math.floor(game.time/60);
  // skill badges light up when unlocked
  for (const el of document.querySelectorAll('#skills .skill'))
    el.classList.toggle('on', !!game.skills[el.dataset.skill]);
}

document.getElementById('startBtn').addEventListener('click', () => startGame(PQ.state.save.highestLevel-1));
document.getElementById('levelBtn').addEventListener('click', showLevelSelect);
document.getElementById('shopBtn').addEventListener('click', showShop);
document.getElementById('levelBackBtn').addEventListener('click', showTitle);
document.getElementById('shopBackBtn').addEventListener('click', showTitle);
document.getElementById('againBtn').addEventListener('click', () => startGame(PQ.state.game.startLevelIndex));
document.getElementById('menuBtn').addEventListener('click', showTitle);
document.getElementById('exportSaveBtn').addEventListener('click', exportSaveFile);
document.getElementById('importSaveBtn').addEventListener('click', () => importSaveFile?.click());
importSaveFile?.addEventListener('change', e => {
  importSave(e.target.files && e.target.files[0]);
  e.target.value = '';
});

Object.assign(PQ, {
  hideScreens, statMarkup, refreshMetaUI, showTitle, showLevelSelect, showShop,
  renderLevelSelect, renderShop, buyLifeUpgrade, buyNextRunLife, buySkill, buyOrSelectSkin,
  exportSaveFile, importSave, updateHUD, startGame, endGame, togglePause,
});
})();
