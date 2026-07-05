# Pixel Quest 12 关扩展与维护计划

本文档是后续维护 `Pixel Quest` 12 关版本的开发依据。当前 12 关第一版已接入，后续继续围绕新主题资源、技能强化、boss、商店和角色资源解耦做平衡与迭代。

## 目标与原则

- 保持当前轻量架构：原生 HTML、CSS、JavaScript 和 Canvas 2D，无构建步骤、无 npm 依赖。
- 关卡、资源、存档和玩法逻辑继续解耦：关卡数据放在 `data/pixel-quest-levels.js`，图片资源通过 `assets/pixel-quest-assets.js` 的 manifest 挂载。
- 缺失图片资源时必须继续走 Canvas 程序化 fallback，不允许因为资源未完成导致游戏无法运行。
- 后续关卡不复用前 6 关主题。第 7-12 关使用全新的主题、美术 key 和背景资源。
- 第 7-12 关每关都必须提供一个技能强化拾取物，强化已有技能效果，不新增操作按键。
- 第 7 关包含小 boss，第 12 关包含大 boss。boss 存活时终点被锁定，击败后才能过关。
- 第 7-12 关采用更长的分段路线，并通过远程怪、冲锋怪、重装怪、钻石奖励和 boss 专属技能形成递进难度曲线。
- 商店继续支持永久成长，并新增“下次游玩额外生命”这类单局消耗品。
- 初始角色与角色图片资源必须通过 manifest key 解耦，不把具体图片路径写进玩法逻辑。

## 关卡结构

| 关卡 | 定位 | 主题 | 核心内容 | 关键资源 |
| --- | --- | --- | --- | --- |
| 1 | 基础教学 | 草原 | 二段跳、基础平台、普通史莱姆 | 现有 meadow |
| 2 | 移动教学 | 洞窟 | 冲刺、尖刺、精英史莱姆 | 现有 cave |
| 3 | 远程教学 | 天空 | 火球、空中平台、远程清怪 | 现有 sky |
| 4 | 跨越教学 | 熔岩 | 滑翔、长沟、危险地形 | 现有 lava |
| 5 | 收集教学 | 冰雪 | 金币磁铁、金币路线、滑行感 | 现有 snow |
| 6 | 组合教学 | 终焉洞穴 | 震地、蹬墙、全技能准备 | 现有 cave |
| 7 | 综合考核 | 水晶遗迹 `crystal` | 星跃强化、远程怪预告、小 boss | 新 crystal tiles/background/boss/enemies |
| 8 | 空中路线 | 菌光森林 `fungal` | 浮游滑翔、纵向路线、空中远程怪 | 新 fungal tiles/background/enemies |
| 9 | 速度路线 | 机械工坊 `gearworks` | 连环冲刺、冲锋怪、速度奖励线 | 新 gearworks tiles/background/enemies |
| 10 | 战斗路线 | 霓虹雨城 `neon` | 爆裂火球、混合敌群、钻石诱导路线 | 新 neon tiles/background/enemies/items |
| 11 | 技巧路线 | 时钟高塔 `clockwork` | 墙面蓄力、蹬墙挑战、重装怪压制 | 新 clockwork tiles/background/enemies |
| 12 | 终局战 | 星渊王座 `void` | 裂地冲击、大 boss、弹幕与震波 | 新 void tiles/background/boss/fx |

第 1-6 关保持当前教学节奏，主要用于解锁基础技能。第 7-12 关默认玩家已经具备完整基础技能，地图设计应围绕技能组合、强化效果和 boss 战展开。

当前平衡版已将第 7-12 关拉长为多段路线：第 7 关做综合复习并引入远程压力；第 8 关强调滑翔与空中平台；第 9 关强调冲刺节奏与冲锋怪；第 10 关强调火球/爆裂火球处理敌群；第 11 关强调墙跳和重装怪压制；第 12 关前半段热身，后半段进入大 boss 场地。

## 强力敌人与奖励

新增外置数据字段：

```js
enemies: {
  6: [{ col:34, row:9, type:'spitter' }],
},
treasures: {
  6: [{ col:53, row:4, type:'diamond', value:5 }],
},
```

强力敌人类型：

- `spitter`：远程怪，血量 2，会朝玩家发射晶弹/能量弹，适合放在平台或安全距离外制造节奏压力。
- `charger`：冲锋怪，血量 2，玩家进入横向范围后会短距离高速冲刺，适合第 9 关之后的速度路线。
- `brute`：重装怪，血量 3，体型更大且周期性跳跃压制，适合第 10-12 关作为火球、冲刺和震地的综合考验。

奖励类型：

- `diamond`：钻石，默认价值 5 金币。放置数量应少于金币，用于引导高风险奖励路线，不要铺满主路线。

## 新主题与资源清单

新增主题必须在 `game.js` 的 `THEMES` fallback 调色板和 `assets/pixel-quest-assets.js` 的资源 manifest 中同步登记。

### 水晶遗迹 `crystal`

- 视觉方向：紫蓝水晶、发光遗迹、碎晶尖刺、冷色背景光。
- 主题资源：
  - `tiles.crystal.ground`
  - `tiles.crystal.groundTop`
  - `tiles.crystal.brick`
  - `tiles.crystal.platform`
  - `tiles.crystal.spike`
  - `backgrounds.crystal.far`
  - `backgrounds.crystal.mid`
- 玩法用途：第 7 关综合考核，小 boss 战场前保留一段安全热身路线。

### 菌光森林 `fungal`

- 视觉方向：荧光蘑菇、孢子雾、藤蔓、柔和绿蓝色光。
- 主题资源：
  - `tiles.fungal.ground`
  - `tiles.fungal.groundTop`
  - `tiles.fungal.brick`
  - `tiles.fungal.platform`
  - `tiles.fungal.spike`
  - `backgrounds.fungal.far`
  - `backgrounds.fungal.mid`
- 玩法用途：第 8 关强调空中停留、滑翔控制和奖励金币路线。

### 机械工坊 `gearworks`

- 视觉方向：齿轮、钢梁、铆钉、蒸汽、金属高光。
- 主题资源：
  - `tiles.gearworks.ground`
  - `tiles.gearworks.groundTop`
  - `tiles.gearworks.brick`
  - `tiles.gearworks.platform`
  - `tiles.gearworks.spike`
  - `backgrounds.gearworks.far`
  - `backgrounds.gearworks.mid`
- 玩法用途：第 9 关强调速度、冲刺节奏和敌人刷新冲刺的路线设计。

### 霓虹雨城 `neon`

- 视觉方向：夜雨城市、霓虹广告、湿润地面、电光尖刺。
- 主题资源：
  - `tiles.neon.ground`
  - `tiles.neon.groundTop`
  - `tiles.neon.brick`
  - `tiles.neon.platform`
  - `tiles.neon.spike`
  - `backgrounds.neon.far`
  - `backgrounds.neon.mid`
- 玩法用途：第 10 关强调战斗密度、火球溅射和中距离清怪。

### 时钟高塔 `clockwork`

- 视觉方向：铜制钟塔、齿轮墙、钟面远景、摆锤装饰。
- 主题资源：
  - `tiles.clockwork.ground`
  - `tiles.clockwork.groundTop`
  - `tiles.clockwork.brick`
  - `tiles.clockwork.platform`
  - `tiles.clockwork.spike`
  - `backgrounds.clockwork.far`
  - `backgrounds.clockwork.mid`
- 玩法用途：第 11 关强调蹬墙、竖向路线和全技能混合考验。

### 星渊王座 `void`

- 视觉方向：暗紫虚空、星纹平台、裂隙背景、王座剪影。
- 主题资源：
  - `tiles.void.ground`
  - `tiles.void.groundTop`
  - `tiles.void.brick`
  - `tiles.void.platform`
  - `tiles.void.spike`
  - `backgrounds.void.far`
  - `backgrounds.void.mid`
- 玩法用途：第 12 关最终 boss 场地。地图前半段只做短热身，主要内容留给 boss 战。

## 技能强化设计

技能强化是第 7-12 关的主要成长点。强化拾取物应放在主路线可见且安全的位置，像技能球一样提供明确反馈。

| 关卡 | 强化 ID | 强化名称 | 基础技能 | 效果 |
| --- | --- | --- | --- | --- |
| 7 | `starJump` | 星跃 | 二段跳 | 二段跳高度略提升，并在使用时产生短暂无伤粒子反馈 |
| 8 | `floatGlide` | 浮游滑翔 | 滑翔 | 滑翔下降速度降低，首次滑翔时允许轻微上抬 |
| 9 | `dashChain` | 连环冲刺 | 冲刺 | 击败敌人后刷新一次冲刺，落地冷却略缩短 |
| 10 | `burstFireball` | 爆裂火球 | 火球 | 火球命中后产生小范围爆炸，对附近敌人造成 1 点伤害 |
| 11 | `wallFocus` | 墙面蓄力 | 蹬墙 | 墙滑速度更慢，蹬墙跳水平和垂直速度略提升 |
| 12 | `quakePound` | 裂地冲击 | 震地 | 震地范围扩大，并可打断大 boss 的指定攻击状态 |

实现要求：

- 不新增键位，不增加移动端按钮。
- 强化默认是本局内状态，存储在运行态 `game.upgrades`。
- 如果后续决定让强化永久化，再新增存档字段，不能把永久化逻辑混进第一版实现。
- 从中途选关开始时，`buildStartingSkills()` 应继续自动继承此前关卡的基础技能；强化是否自动继承需在实现时明确。如果没有永久强化系统，推荐只在当前局拾取后生效。

## Boss 设计

### 通用规则

- `LEVEL_DATA.bosses` 控制 boss 出现，不在 tilemap 中硬编码 boss 字符。
- boss 作为敌人实体扩展，复用现有伤害入口：踩踏、冲刺、火球、震地都能造成伤害。
- boss 存活时终点锁定。玩家触碰终点时不切关，并显示提示，例如“先击败 boss”。
- boss 死亡后终点恢复可触发。
- boss 战显示顶部血条。非 boss 关不显示 boss 血条。
- boss 坐标必须经过 `verify_game.js` 校验，不能嵌入实体块，且附近必须有可站立支撑。

### 小 boss：水晶史莱姆

- 出现关卡：第 7 关。
- 推荐 ID：`miniSlime`
- 推荐 manifest key：`enemies.miniBoss`
- 血量建议：6-8。
- 行为：
  - 比精英史莱姆更大，基础左右巡逻。
  - 周期性短跳，落地时产生小范围视觉震动。
  - 低血量时速度略提升。
- 验收重点：
  - 玩家能通过踩踏、冲刺、火球、震地击败。
  - 击败前无法过终点，击败后能正常进入第 8 关。

### 大 boss：星渊王

- 出现关卡：第 12 关。
- 推荐 ID：`kingSlime`
- 推荐 manifest key：`enemies.bigBoss`
- 血量建议：14-18。
- 行为：
  - 一阶段：慢速巡逻、跳跃压制、接触伤害。
  - 一阶段已增加虚空弹幕，迫使玩家移动和跳跃避让。
  - 二阶段：血量低于 50% 后进入，移动更快，增加三向虚空弹幕和蓄力震波。
  - 震地强化 `quakePound` 可打断蓄力震波，但不能取消普通弹幕。
- 验收重点：
  - 血条清晰，二阶段反馈明显。
  - 击败前不能最终通关，击败后触发结算。
  - 玩家死亡并从检查点复活后 boss 状态处理明确。推荐第一版在重生时保持当前关卡实体状态，不额外恢复 boss 血量；如果实现成本过高，可以在文档和代码注释中明确重生会重置本关。

## 商店与角色

### 技能库扩展

当前技能库在 7 个基础技能之外新增两个被动技能：

- `aegis` / 星盾护体：周期性抵挡一次伤害，不新增按键，适合帮助玩家应对后半程弹幕和冲锋失误。
- `quickCast` / 疾速施法：降低火球冷却，并让火球贯穿一次敌人，适合第 10 关之后的混合敌群。

新增被动技能仍走 `SKILLS` / `SHOP_SKILLS` / 存档技能布尔表，不需要移动端新增按钮。

### 永久生命升级

- 保留现有 `lifeUpgrades`。
- 继续作为永久成长，影响每次开局最大生命。
- 价格表仍由 `LIFE_UPGRADE_COSTS` 控制。

### 下次游玩额外生命

- 新增商店消耗品：“下次冒险生命 +1”。
- 推荐存档字段：`nextRunLives`。
- 购买后立即写入存档，但只在下一次 `startGame()` 生效。
- 开局时：
  - `game.lives = game.stats.maxLives + save.nextRunLives`
  - 随后清零 `save.nextRunLives` 并持久化。
- 建议设置购买上限，例如最多 3 点，避免单局生命膨胀。
- UI 中应明确这是“下次游玩”效果，不是永久升级。

### 初始角色

当前角色结构保留：

- `rookie`：均衡角色。
- `scout`：速度更快，自带二段跳。
- `ember`：自带火球，跳跃略弱。
- `guard`：生命更多，自带震地。
- `volt`：电光游侠，速度更快，自带冲刺和疾速施法。
- `oracle`：星辉先知，跳跃略强，自带磁铁和星盾。

维护要求：

- 角色数值仍由 `CHARACTERS` 控制。
- 角色图片通过 `assets/pixel-quest-assets.js` 的 manifest key 解耦：
  - `characters.rookie`
  - `characters.scout`
  - `characters.ember`
  - `characters.guard`
- 未配置角色图片时继续使用 `game.js` 中的程序化角色 fallback。
- 新增角色时必须同步：
  - `CHARACTERS`
  - 角色商店 UI
  - 默认存档结构 `ownedSkins`
  - manifest key
  - README 角色说明

## 数据接口

`data/pixel-quest-levels.js` 应扩展为 12 关数据源。建议新增字段如下。

```js
window.PIXEL_QUEST_LEVEL_DATA = {
  version: 2,
  names: [...],       // 12 项
  themes: [...],      // 12 项，第 7-12 项必须为新主题
  solidTiles: ['#', 'B', '='],
  pickups: {...},     // 基础技能球
  upgrades: {
    6: [{ col: 78, row: 5, upgrade: 'starJump' }],
    7: [{ col: 42, row: 5, upgrade: 'floatGlide' }],
    8: [{ col: 48, row: 5, upgrade: 'dashChain' }],
    9: [{ col: 52, row: 4, upgrade: 'burstFireball' }],
    10: [{ col: 58, row: 4, upgrade: 'wallFocus' }],
    11: [{ col: 30, row: 5, upgrade: 'quakePound' }],
  },
  checkpoints: {...},
  elites: {...},
  bosses: {
    6: [{ col: 116, row: 9, type: 'miniSlime', hp: 10, gateGoal: true }],
    11: [{ col: 118, row: 9, type: 'kingSlime', hp: 22, gateGoal: true }],
  },
  enemies: {
    6: [{ col: 34, row: 9, type: 'spitter' }],
  },
  treasures: {
    6: [{ col: 53, row: 4, type: 'diamond', value: 5 }],
  },
  levels: [...]
};
```

注意：数组索引仍使用 0 基。第 7 关索引是 `6`，第 12 关索引是 `11`。

## 资源 Manifest

`assets/pixel-quest-assets.js` 需要预留并维护稳定 key。路径可以为空字符串，表示暂时使用 Canvas fallback。

### 新主题 tiles

每个新主题都需要以下 key：

- `tiles.<theme>.ground`
- `tiles.<theme>.groundTop`
- `tiles.<theme>.brick`
- `tiles.<theme>.platform`
- `tiles.<theme>.spike`

主题列表：

- `crystal`
- `fungal`
- `gearworks`
- `neon`
- `clockwork`
- `void`

### 新主题 backgrounds

每个新主题都需要以下 key：

- `backgrounds.<theme>.far`
- `backgrounds.<theme>.mid`

背景尺寸继续以 960x540 为基础，和现有背景资源保持一致。

### Boss 与角色

Boss key：

- `enemies.miniBoss`
- `enemies.bigBoss`
- `enemies.spitter`
- `enemies.charger`
- `enemies.brute`

角色 key：

- `characters.rookie`
- `characters.scout`
- `characters.ember`
- `characters.guard`
- `characters.volt`
- `characters.oracle`

道具与特效 key：

- `items.diamond`
- `items.skillOrb.aegis`
- `items.skillOrb.quickCast`
- `fx.enemyBolt`
- `fx.aegis`

角色 spritesheet 继续采用透明 PNG、底部居中锚点。不要用图片尺寸改变玩家碰撞盒。

## 实现路线

1. 数据先行
   - 更新 `build_levels.js`，生成第 7-12 关地图。
   - 更新 `data/pixel-quest-levels.js` 的 `names/themes/levels/checkpoints/elites/upgrades/bosses`。
   - 更新 `verify_game.js`，先让数据校验能识别 12 关、新主题、强化和 boss。

2. 资源与 fallback
   - 在 `game.js` 的 `THEMES` 中添加 6 个新主题 fallback 调色板。
   - 在 `assets/pixel-quest-assets.js` 中预留新主题、boss、角色 key。
   - 确认未提供 PNG 时游戏仍能渲染。

3. 技能强化逻辑
   - 新增 `UPGRADES` 元数据。
   - 新增运行态 `game.upgrades`。
   - 解析并绘制强化拾取物。
   - 将 6 个强化效果接入现有技能逻辑。

4. Boss 逻辑
   - 新增 boss 创建、更新、伤害和绘制逻辑。
   - 复用现有 `damageEnemy()` 或扩展为能处理 boss 血量、阶段和死亡事件。
   - 接入终点锁定与 boss 血条。

5. 商店与角色
   - 新增 `nextRunLives` 存档字段和商店购买项。
   - `startGame()` 消耗下次生命加成。
   - 确认角色资源继续通过 manifest key 加载，fallback 正常。

6. 文档与截图
   - 更新 README 的关卡数、主题、技能强化、boss 和商店说明。
   - 如果视觉变化明显，更新 `docs/screenshots/`。

## 验证与验收

基础校验：

```bash
node verify_game.js
```

`verify_game.js` 必须覆盖：

- 总关卡数为 12。
- `names`、`themes`、`levels` 长度一致。
- 第 7-12 关使用新主题，不复用 `meadow`、`cave`、`sky`、`lava`、`snow`。
- 每关存在 `P` 和 `G`。
- 终点下方有地面，终点后没有死亡坑。
- checkpoint、pickup、upgrade、elite、boss 坐标不嵌入实体块。
- checkpoint、pickup、upgrade、elite、boss 附近有可站立支撑。
- 第 7 关存在 `miniSlime`，第 12 关存在 `kingSlime`。
- 第 7-12 关每关都有一个强化拾取物。

手动或调试钩子验收：

- `window.__pq.load(6)`：进入第 7 关，确认小 boss 存活时不能过终点，击败后能进入第 8 关。
- `window.__pq.load(11)`：进入第 12 关，确认大 boss 存活时不能通关，击败后进入胜利结算。
- 拾取第 7-12 关强化物，确认 HUD 或 toast 有反馈，强化效果立即生效。
- 在商店购买“下次冒险生命 +1”，开始游戏后生命增加，并在开局后清零。
- 切换初始角色后开始游戏，确认角色能力和 fallback 绘制正常。
- 在缺失新主题 PNG 的情况下，所有新关卡仍能用 Canvas fallback 正常显示。

## 维护约定

- 新增或修改关卡时，必须同步更新 `data/pixel-quest-levels.js` 和 `verify_game.js`。
- 大幅调整第 7-12 关地图时，优先修改 `build_levels.js`，再把生成结果同步回关卡数据。
- 新增主题时，必须同步：
  - `game.js` 的 `THEMES`
  - `assets/pixel-quest-assets.js` 的 tile/background key
  - `data/pixel-quest-levels.js` 的 `themes`
  - `verify_game.js` 的主题校验
  - README 说明
- 新增技能强化时，必须同步：
  - `UPGRADES` 元数据
  - 拾取物绘制与提示
  - 对应技能逻辑
  - `verify_game.js` 的强化校验
  - README 操作或玩法说明
- 新增 boss 时，必须同步：
  - `LEVEL_DATA.bosses`
  - boss 创建与更新逻辑
  - boss 绘制或 manifest key
  - 终点锁定规则
  - `verify_game.js` 的 boss 校验
  - README boss 规则说明
- 新增特殊敌人或宝物时，必须同步：
  - `LEVEL_DATA.enemies` / `LEVEL_DATA.treasures`
  - 实体工厂、AI、绘制和碰撞逻辑
  - `verify_game.js` 的坐标/类型校验
  - `assets/pixel-quest-assets.js` 的 manifest key
  - README 规则说明
- 新增角色时，必须同步：
  - `CHARACTERS`
  - 存档默认值
  - 商店 UI
  - `assets/pixel-quest-assets.js`
  - README 角色说明
- 不要删除 `window.PIXEL_QUEST` 和 `window.__pq` 调试钩子。它们是后续关卡测试、boss 验收和截图流程的重要入口。
