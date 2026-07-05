/* =========================================================================
   pq-save.js — persistent progression.
   Save sources (newest wins): localStorage auto-save > save/pixel-quest-save.js
   mirror > fetched save/pixel-quest-save.json. `save` lives at PQ.state.save and
   is reassigned on import/apply, so readers must always go through PQ.state.save.
   ========================================================================= */
(() => {
'use strict';
const PQ = window.PQ;
const {
  SKILL_IDS, CHARACTERS, SHOP_SKILLS, LEVEL_NAMES, LEVEL_PICKUPS,
  LIFE_UPGRADE_COSTS, NEXT_RUN_LIFE_COST, NEXT_RUN_LIFE_MAX,
  SAVE_KEY, SAVE_JSON_FILE,
  MOVE_ACCEL, MOVE_MAX, JUMP_VEL, AIR_JUMP_VEL,
} = PQ;

function blankSkills(value=false) {
  return Object.fromEntries(SKILL_IDS.map(id => [id, value]));
}
function makeDefaultSave() {
  const unlockedSkills = blankSkills(false);
  unlockedSkills.doubleJump = true;
  return {
    version: 2,
    updatedAt: 0,
    coins: 0,
    highestLevel: 1,
    lifeUpgrades: 0,
    nextRunLives: 0,
    purchasedSkills: blankSkills(false),
    unlockedSkills,
    ownedSkins: { rookie:true, scout:false, ember:false, guard:false, volt:false, oracle:false },
    selectedSkin: 'rookie',
  };
}
function normalizeSave(raw) {
  const base = makeDefaultSave();
  const src = raw && typeof raw === 'object' ? raw : {};
  base.updatedAt = Math.max(0, Math.floor(Number(src.updatedAt) || Number(src.lastSavedAt) || 0));
  base.coins = Math.max(0, Math.floor(Number(src.coins) || 0));
  base.highestLevel = Math.max(1, Math.min(LEVEL_NAMES.length, Math.floor(Number(src.highestLevel) || 1)));
  base.lifeUpgrades = Math.max(0, Math.min(LIFE_UPGRADE_COSTS.length, Math.floor(Number(src.lifeUpgrades) || 0)));
  base.nextRunLives = Math.max(0, Math.min(NEXT_RUN_LIFE_MAX, Math.floor(Number(src.nextRunLives) || 0)));
  for (const id of SKILL_IDS) {
    base.purchasedSkills[id] = !!(src.purchasedSkills && src.purchasedSkills[id]);
    base.unlockedSkills[id] = !!(src.unlockedSkills && src.unlockedSkills[id]) || base.purchasedSkills[id] || base.unlockedSkills[id];
  }
  for (const id of Object.keys(CHARACTERS))
    base.ownedSkins[id] = id === 'rookie' || !!(src.ownedSkins && src.ownedSkins[id]);
  base.selectedSkin = base.ownedSkins[src.selectedSkin] ? src.selectedSkin : 'rookie';
  return base;
}
function readLocalStorageSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const stored = normalizeSave(parsed);
    if (!Number(parsed.updatedAt)) stored.updatedAt = 1; // legacy browser save beats the default file.
    return stored;
  } catch (e) { return null; }
}
function readScriptSaveFile() {
  const data = window.PIXEL_QUEST_SAVE_FILE || window.PIXEL_QUEST_SAVE;
  return data ? normalizeSave(data) : null;
}
function pickNewestSave(candidates) {
  return candidates.filter(Boolean).reduce((best, item) =>
    !best || (item.updatedAt || 0) >= (best.updatedAt || 0) ? item : best, null);
}
function loadSave() {
  return pickNewestSave([readLocalStorageSave(), readScriptSaveFile()]) || makeDefaultSave();
}
function persistSave(stamp=true) {
  const save = PQ.state.save;
  if (stamp) save.updatedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
function commitSave(updatePanels=true) {
  persistSave();
  PQ.refreshMetaUI();
  if (updatePanels) {
    PQ.renderLevelSelect();
    PQ.renderShop();
  }
}
function applySave(nextSave, mirrorToLocalStorage=false) {
  PQ.state.save = normalizeSave(nextSave);
  const game = PQ.state.game;
  game.save = PQ.state.save;
  if (game.state !== 'playing') {
    game.hero = selectedCharacter();
    game.stats = makeHeroStats(game.hero);
  }
  if (mirrorToLocalStorage) persistSave(false);
  PQ.refreshMetaUI();
  PQ.renderLevelSelect();
  PQ.renderShop();
}
async function hydrateSaveFromFile() {
  let fetched = null;
  try {
    const res = await fetch(SAVE_JSON_FILE, { cache:'no-store' });
    if (res.ok) fetched = normalizeSave(await res.json());
  } catch (e) {}
  const chosen = pickNewestSave([PQ.state.save, readScriptSaveFile(), fetched, readLocalStorageSave()]);
  if (chosen && JSON.stringify(chosen) !== JSON.stringify(PQ.state.save)) applySave(chosen, true);
}
function unlockLevel(levelNumber) {
  const save = PQ.state.save;
  const next = Math.max(1, Math.min(LEVEL_NAMES.length, levelNumber));
  if (next > save.highestLevel) { save.highestLevel = next; commitSave(); }
}
function unlockSkillInSave(skill) {
  const save = PQ.state.save;
  if (!skill || !PQ.SKILLS[skill]) return;
  if (!save.unlockedSkills[skill]) { save.unlockedSkills[skill] = true; commitSave(); }
}
function selectedCharacter() {
  const save = PQ.state.save;
  const id = CHARACTERS[save.selectedSkin] ? save.selectedSkin : 'rookie';
  return CHARACTERS[id];
}
function makeHeroStats(hero) {
  const save = PQ.state.save;
  return {
    moveAccel: MOVE_ACCEL * (hero.move || 1),
    moveMax: MOVE_MAX * (hero.move || 1),
    jumpVel: JUMP_VEL * (hero.jump || 1),
    airJumpVel: AIR_JUMP_VEL * (hero.jump || 1),
    maxLives: 3 + save.lifeUpgrades + (hero.lifeBonus || 0),
  };
}
function buildStartingSkills(startLevelIndex) {
  const save = PQ.state.save;
  const skills = blankSkills(false);
  const hero = selectedCharacter();
  for (const id of hero.skills || []) skills[id] = true;
  for (const id of SKILL_IDS) if (save.purchasedSkills[id]) skills[id] = true;
  for (let i=0; i<startLevelIndex; i++)
    for (const pk of (LEVEL_PICKUPS[i] || [])) skills[pk.skill] = true;
  return skills;
}
function isSkillKnown(skill) {
  const save = PQ.state.save;
  const item = SHOP_SKILLS[skill];
  return !!(save.unlockedSkills[skill] || save.purchasedSkills[skill] || (item && save.highestLevel >= item.level));
}
function addCollectedCoin(n=1) {
  const game = PQ.state.game, save = PQ.state.save;
  game.coins += n;
  save.coins += n;
  commitSave(false);
}

Object.assign(PQ, {
  blankSkills, makeDefaultSave, normalizeSave, readLocalStorageSave, readScriptSaveFile,
  pickNewestSave, loadSave, persistSave, commitSave, applySave, hydrateSaveFromFile,
  unlockLevel, unlockSkillInSave, selectedCharacter, makeHeroStats, buildStartingSkills,
  isSkillKnown, addCollectedCoin,
});

// Initialize the runtime save now that every dependency is loaded.
PQ.state.save = loadSave();
})();
