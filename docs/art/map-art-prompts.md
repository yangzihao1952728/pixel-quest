# Pixel Quest 地图美术资源绘制提示词

这份文档给后续美术 agent 使用，只绘制地图与环境资源，不修改玩法代码、碰撞盒、关卡字符串或实体尺寸。

## 基础规格

- 游戏类型：2D 横版像素平台跳跃游戏。
- 内部分辨率：`960x540`。
- 地图 tile 尺寸：`40x40 px`。
- 输出格式：透明背景 PNG，像素风，硬边，无抗锯齿，无模糊，无投影溢出。
- 图块必须可无缝拼接，边缘不能出现半透明脏边。
- 美术只负责显示；碰撞仍由地图字符 `#`、`B`、`=`、`^` 控制。
- 保持明亮、清晰、适合小屏辨认。危险物必须比背景更醒目。

## 目录与命名

建议输出到：

```text
assets/sprites/tiles/
  meadow-ground.png
  meadow-ground-top.png
  meadow-brick.png
  meadow-platform.png
  meadow-spike.png
  cave-ground.png
  cave-ground-top.png
  cave-brick.png
  cave-platform.png
  cave-spike.png
  sky-ground.png
  sky-ground-top.png
  sky-brick.png
  sky-platform.png
  sky-spike.png
  lava-ground.png
  lava-ground-top.png
  lava-brick.png
  lava-platform.png
  lava-spike.png
  snow-ground.png
  snow-ground-top.png
  snow-brick.png
  snow-platform.png
  snow-spike.png
  crystal-ground.png
  crystal-ground-top.png
  crystal-brick.png
  crystal-platform.png
  crystal-spike.png
  fungal-ground.png
  fungal-ground-top.png
  fungal-brick.png
  fungal-platform.png
  fungal-spike.png
  gearworks-ground.png
  gearworks-ground-top.png
  gearworks-brick.png
  gearworks-platform.png
  gearworks-spike.png
  neon-ground.png
  neon-ground-top.png
  neon-brick.png
  neon-platform.png
  neon-spike.png
  clockwork-ground.png
  clockwork-ground-top.png
  clockwork-brick.png
  clockwork-platform.png
  clockwork-spike.png
  void-ground.png
  void-ground-top.png
  void-brick.png
  void-platform.png
  void-spike.png

assets/backgrounds/
  meadow-far.png
  meadow-mid.png
  cave-far.png
  cave-mid.png
  sky-far.png
  sky-mid.png
  lava-far.png
  lava-mid.png
  snow-far.png
  snow-mid.png
  crystal-far.png
  crystal-mid.png
  fungal-far.png
  fungal-mid.png
  gearworks-far.png
  gearworks-mid.png
  neon-far.png
  neon-mid.png
  clockwork-far.png
  clockwork-mid.png
  void-far.png
  void-mid.png

assets/sprites/characters/
  rookie.png
  scout.png
  ember.png
  guard.png
  volt.png
  oracle.png

assets/sprites/enemies/
  slime.png
  elite-slime.png
  spitter.png
  charger.png
  brute.png
  mini-boss.png
  big-boss.png

assets/sprites/items/
  coin.png
  diamond.png
  checkpoint.png
  goal.png
  skill-orb-aegis.png
  skill-orb-quick-cast.png

assets/sprites/fx/
  enemy-bolt.png
  aegis.png
```

每个 tile 文件是单张 `40x40` PNG。背景 `far` 和 `mid` 都是 `960x540` PNG，其中 `mid` 需要左右无缝循环。

角色 spritesheet 使用透明 PNG，单帧 `32x40`，帧序为 idle、run 1-4、jump、fall、dead。敌人 spritesheet 使用透明 PNG，底部居中锚点，尺寸以 `assets/pixel-quest-assets.js` manifest 为准。道具和 FX 也以 manifest 的 `frameW/frameH/anchor` 为准。

## 通用负面提示词

用于所有图片：

```text
no text, no logo, no watermark, no realistic rendering, no blur, no anti-aliasing, no soft gradients, no painterly brush strokes, no 3D perspective, no isometric view, no UI, no characters, no enemies, no coins, no oversized decorations crossing tile bounds, no transparent glow spilling outside the canvas
```

## Tile 通用提示词模板

把 `{theme}`、`{asset}`、`{description}` 替换成具体主题和资源。

```text
Create a single 40x40 pixel art platformer map tile for Pixel Quest.
Theme: {theme}.
Asset: {asset}.
Description: {description}.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size, designed to tile seamlessly with adjacent 40x40 tiles. Keep all visible art inside the 40x40 canvas. Use a limited palette, strong silhouettes, clean highlights, and subtle 1-2 pixel texture details. No text, no characters, no UI.
```

## 草原 Meadow

调性：明亮、温暖、入门关卡，绿色草地、棕色土壤、轻松童话感。

```text
Create a single 40x40 pixel art platformer map tile for Pixel Quest.
Theme: sunny meadow.
Asset: ground.
Description: compact brown soil block with small pebble pixels and earthy texture, no grass on top, seamless on all sides.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size, designed to tile seamlessly with adjacent 40x40 tiles. Keep all visible art inside the 40x40 canvas. Use warm browns, small tan speckles, subtle darker bottom and right edge pixels. No text, no characters, no UI.
```

```text
Create a single 40x40 pixel art platformer map tile for Pixel Quest.
Theme: sunny meadow.
Asset: ground top.
Description: brown soil block with a bright green grass cap across the top 8-10 pixels, tiny grass teeth and highlights, seamless horizontally.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size, designed to tile seamlessly with adjacent 40x40 tiles. Keep all visible art inside the 40x40 canvas. Use warm browns, lively greens, clean top silhouette. No text, no characters, no UI.
```

```text
Create a single 40x40 pixel art platformer map tile for Pixel Quest.
Theme: sunny meadow.
Asset: brick.
Description: reddish brown castle brick block, two rows of chunky rectangular stones, dark mortar lines, small top-left highlights.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size, designed to tile seamlessly with adjacent 40x40 tiles. Keep all visible art inside the 40x40 canvas. No text, no characters, no UI.
```

```text
Create a single 40x40 pixel art platformer map tile for Pixel Quest.
Theme: sunny meadow.
Asset: floating platform.
Description: wooden plank platform occupying the upper 26 pixels of the tile, grass trim on top, transparent empty space in the lower 14 pixels.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size, designed to tile seamlessly horizontally. Keep visible art inside the 40x40 canvas. No text, no characters, no UI.
```

```text
Create a single 40x40 pixel art hazard tile for Pixel Quest.
Theme: sunny meadow.
Asset: spike.
Description: three sharp silver metal triangular spikes rising from a dark base strip at the bottom, high contrast, clearly dangerous.
Orthographic side-view 2D platform game tile, crisp pixel art, transparent background, hard square pixels, readable at small size. Keep all visible art inside the 40x40 canvas. No text, no characters, no UI.
```

## 洞窟 Cave

调性：紫灰岩洞、神秘、低饱和，但地形仍要清楚。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest cave theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark purple-gray stone with mineral speckles, seamless.
Ground top: same stone with muted mossy teal top edge.
Brick: blocky cave-cut purple stone bricks with dark cracks.
Floating platform: flat dark stone ledge in upper 26 pixels, transparent lower 14 pixels, moss rim.
Spike: three pale gray crystal spikes on a dark base, clearly hazardous.
No text, no characters, no UI, transparent background for each tile.
```

## 云端 Sky

调性：轻盈、白云、浅蓝高空，平台边缘要和天空背景区分。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest sky theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: soft white cloud-stone block with pale blue shadow pixels, seamless.
Ground top: cloud-stone with bright icy-blue top rim.
Brick: pale blue-gray floating ruins block, clean rectangular stone pattern.
Floating platform: compact cloud platform in upper 26 pixels, transparent lower 14 pixels, bright top highlight.
Spike: three light gray wind-crystal spikes with blue shadows, readable and dangerous.
No text, no characters, no UI, transparent background for each tile.
```

## 熔岩 Lava

调性：高危险、火山岩、暗红地形，避免整张图太黑，尖刺要非常醒目。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest lava theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark volcanic rock block with red ember cracks, seamless, readable silhouette.
Ground top: volcanic rock with burnt orange crust along the top edge.
Brick: dark red basalt brick block with glowing crack pixels.
Floating platform: scorched stone ledge in upper 26 pixels, transparent lower 14 pixels, orange hot rim.
Spike: three black obsidian spikes with orange rim highlights on a dark base, clearly hazardous.
No text, no characters, no UI, transparent background for each tile.
```

## 雪岭 Snow

调性：冷色、雪层、矿道质感，白色资源必须有蓝灰边线避免融进背景。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest snow theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: compact blue-gray frozen earth block with snow flecks, seamless.
Ground top: frozen earth with thick white snow cap and pale blue shadow outline.
Brick: icy stone brick block, blue-gray mortar, frosty highlights.
Floating platform: icy wooden or stone ledge in upper 26 pixels, transparent lower 14 pixels, snow cap on top.
Spike: three icy blue-white spikes with darker blue outline on a base strip, clearly hazardous.
No text, no characters, no UI, transparent background for each tile.
```

## 水晶遗迹 Crystal

调性：紫蓝水晶、发光遗迹、冷色轮廓。地形要像古代遗迹与碎晶混合，危险物使用更亮的青紫尖晶。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest crystal ruins theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark indigo stone block with embedded violet and cyan crystal chips, seamless on all sides.
Ground top: same stone with a luminous blue crystal dust cap across the top 8 pixels, clean readable edge.
Brick: ancient purple-blue ruin brick with bevel pixels, small glowing rune cracks, no readable text.
Floating platform: broken crystal-stone ledge in upper 26 pixels, transparent lower 14 pixels, cyan rim light.
Spike: three jagged translucent cyan-violet crystal spikes on a dark base, very sharp silhouette and high contrast.
No text, no characters, no UI, transparent background for each tile.
```

## 菌光森林 Fungal

调性：荧光蘑菇、孢子雾、藤蔓、柔和绿蓝光。保持童话感，但平台边缘必须清楚。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest bioluminescent fungal forest theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark damp earth block with teal moss pixels and tiny mushroom roots, seamless.
Ground top: earth block with glowing moss and small mushroom caps along the top edge, readable walkable surface.
Brick: compact root-wrapped stone block with muted green-blue fungus spots, clean rectangular silhouette.
Floating platform: thick mushroom shelf or vine-bound wood in upper 26 pixels, transparent lower 14 pixels, soft cyan underside.
Spike: three thorny pale mushroom or vine spikes on a dark base, visibly dangerous despite organic theme.
No text, no characters, no UI, transparent background for each tile.
```

## 机械工坊 Gearworks

调性：齿轮、钢梁、铆钉、蒸汽、金属高光。避免复杂机械件跨出 tile 边界。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest gearworks factory theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark steel floor block with rivets, brass seams, and subtle oil stain pixels, seamless.
Ground top: metal block with bright brass safety edge along the top 8 pixels, readable platform surface.
Brick: stacked industrial metal plates with bolts and panel seams, chunky rectangular pattern.
Floating platform: narrow steel beam in upper 26 pixels, transparent lower 14 pixels, yellow-black edge accents.
Spike: three polished steel hazard spikes with orange warning base, sharp and high contrast.
No text, no characters, no UI, transparent background for each tile.
```

## 霓虹雨城 Neon

调性：夜雨城市、霓虹广告反光、湿润地面、电光尖刺。不要在 tile 内放文字或 logo。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest neon rain city theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: dark wet asphalt or rooftop block with cyan and magenta reflected pixels, seamless.
Ground top: same block with bright rain-slick top rim and small puddle highlights, clear walkable edge.
Brick: dark city wall brick with neon reflections, rectangular blocks, no signs or letters.
Floating platform: wet metal catwalk in upper 26 pixels, transparent lower 14 pixels, cyan rail-light trim without text.
Spike: three electric blue hazard spikes or lightning rods on a dark base, very bright dangerous silhouette.
No text, no characters, no UI, transparent background for each tile.
```

## 时钟高塔 Clockwork

调性：铜制钟塔、齿轮墙、钟面远景、摆锤装饰。平台主体要像铜/石混合结构，边缘稳定。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest clockwork tower theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: aged bronze and stone block with tiny gear teeth and patina pixels, seamless.
Ground top: bronze-stone block with polished golden top rail across the upper 8 pixels, readable edge.
Brick: clock tower masonry with brass inlays and small gear motifs, no clock numbers or text.
Floating platform: narrow brass beam with rivets in upper 26 pixels, transparent lower 14 pixels, slight pendulum-inspired underside.
Spike: three sharp brass clock-hand spikes on a dark base, clearly hazardous.
No text, no characters, no UI, transparent background for each tile.
```

## 星渊王座 Void

调性：暗紫虚空、星纹平台、裂隙背景、王座剪影。地形不能过暗，玩家和 boss 必须仍然醒目。

```text
Create five separate 40x40 transparent PNG pixel art tiles for Pixel Quest astral void throne theme: ground, ground top, brick, floating platform, spike.
Style: orthographic side-view 2D platformer, crisp hard pixels, no anti-aliasing.
Ground: deep violet obsidian block with tiny star speckles and blue rim cracks, seamless.
Ground top: obsidian block with bright lavender astral edge along the top 8 pixels, readable walkable surface.
Brick: dark throne-room stone brick with star-rune cracks, chunky block pattern, no readable symbols.
Floating platform: floating void-stone slab in upper 26 pixels, transparent lower 14 pixels, purple-blue rim glow kept inside canvas.
Spike: three black-violet void crystal spikes with bright lavender edge highlights on a dark base, unmistakably dangerous.
No text, no characters, no UI, transparent background for each tile.
```

## 背景 Far Layer 提示词

`far` 是静态远景，尺寸 `960x540`，不需要透明。不要出现会被误认为平台的硬边横线。

```text
Create a 960x540 pixel art far background for a side-scrolling 2D platformer called Pixel Quest.
Theme: {meadow/cave/sky/lava/snow/crystal/fungal/gearworks/neon/clockwork/void}.
No characters, no UI, no text, no coins, no foreground platforms.
Use layered distant scenery with soft pixel-art silhouettes, clear sky or ambient backdrop, low contrast behind the playfield, readable but not distracting. Crisp pixel art, no blur, no anti-aliasing, no realistic painting.
```

主题补充：

- `meadow-far.png`：蓝天、远山、柔和太阳，清新草原。
- `cave-far.png`：深紫洞穴空间、远处岩壁、微弱晶体光。
- `sky-far.png`：高空蓝天、大云层、远处漂浮岛剪影。
- `lava-far.png`：火山洞、暗红天空、远处熔岩光，不要太刺眼。
- `snow-far.png`：冰蓝天空、远山、风雪雾气，保持低对比。
- `crystal-far.png`：巨大紫蓝晶簇、远处遗迹拱门、冷色微光，低对比。
- `fungal-far.png`：深林剪影、巨型蘑菇伞盖、孢子微光，不要遮挡主场景。
- `gearworks-far.png`：工坊深处、巨大齿轮剪影、蒸汽管线，金属色低饱和。
- `neon-far.png`：雨夜城市天际线、霓虹反光、远处广告牌只做抽象色块，不出现文字。
- `clockwork-far.png`：钟塔内部远景、钟面剪影、铜色齿轮层次，不出现数字。
- `void-far.png`：暗紫星渊、远处王座剪影、裂隙星光，保持可读但不抢戏。

## 背景 Mid Layer 提示词

`mid` 是中景视差层，尺寸 `960x540`，左右必须无缝循环。底部元素可以丰富，但不要像实体平台一样抢眼。

```text
Create a seamless horizontally looping 960x540 pixel art midground background for Pixel Quest.
Theme: {meadow/cave/sky/lava/snow/crystal/fungal/gearworks/neon/clockwork/void}.
Side-scrolling 2D platformer mid layer, left edge and right edge must match perfectly for endless horizontal tiling. No characters, no UI, no text, no coins, no foreground collision platforms. Use decorative scenery only, lower contrast than gameplay objects, crisp pixel art, no blur, no anti-aliasing.
```

主题补充：

- `meadow-mid.png`：树丛、小山、远处树干，左右无缝。
- `cave-mid.png`：石笋、岩柱、暗色藤蔓或晶体，左右无缝。
- `sky-mid.png`：云团、漂浮远岛、小旗或风带，但不能像可站平台。
- `lava-mid.png`：岩柱、远处熔岩河、热气像素，不要遮挡主场景。
- `snow-mid.png`：松树剪影、冰柱、远处矿道支架，左右无缝。
- `crystal-mid.png`：中景碎晶柱、遗迹石柱、漂浮晶尘，左右无缝。
- `fungal-mid.png`：蘑菇丛、藤蔓层、孢子光点，左右无缝且低对比。
- `gearworks-mid.png`：齿轮组、钢梁、蒸汽管道，左右无缝，不像可站平台。
- `neon-mid.png`：雨棚、远处灯箱色块、湿润屋顶剪影，左右无缝，无文字。
- `clockwork-mid.png`：铜管、齿轮墙、摆锤剪影，左右无缝，不出现数字或 UI。
- `void-mid.png`：漂浮星石、裂隙光带、王座台阶远影，左右无缝，不像实体平台。

## 角色与敌人资源提示词

以下内容可直接交给美术 agent。只绘制透明 PNG spritesheet，不修改玩法代码、碰撞盒或 manifest 尺寸。

### 角色

通用要求：

```text
Create a transparent PNG pixel-art character spritesheet for Pixel Quest.
Side-view 2D platformer hero, 32x40 frame size, bottom-center anchored, crisp hard pixels, no anti-aliasing, no blur.
Frames in order: idle, run 1, run 2, run 3, run 4, jump, fall, dead.
Readable silhouette at small size, no weapons larger than the frame, no text, no UI.
```

角色差异：

- `rookie.png`：红帽蓝衣均衡旅人，明亮主角感。
- `scout.png`：轻装绿色/青色斥候，速度感强，披风或围巾不能超出帧太多。
- `ember.png`：橙红术士，火焰主题帽檐或手套，避免大面积发光遮挡身体。
- `guard.png`：银灰重甲守卫，橙色头盔点缀，体型仍保持 26x36 碰撞盒可读。
- `volt.png`：黄色/蓝色电光游侠，轻甲、短电弧装饰，突出速度。
- `oracle.png`：淡紫/天蓝星辉先知，护符或星纹装饰，突出星盾和收集倾向。

### 敌人与 Boss

```text
Create transparent PNG pixel-art enemy spritesheets for Pixel Quest.
Side-view 2D platformer enemies, bottom-center anchored, crisp hard pixels, no anti-aliasing, no blur.
Use strong silhouettes and distinct color language so players can identify behavior before contact.
No text, no UI, no realistic rendering.
```

- `spitter.png`：远程怪，青蓝晶体/毒囊造型，嘴部或晶管清楚，帧包含 walk、hurt、dead、charge。
- `charger.png`：冲锋怪，橙黄角或护额，身体前倾，charge 帧要明显表达高速准备。
- `brute.png`：重装怪，暗红厚重体型，跳跃/落地压迫感强，不能看起来像 boss。
- `mini-boss.png`：水晶史莱姆，紫蓝水晶冠，包含 walk、hurt、dead、jump。
- `big-boss.png`：星渊王，暗紫王冠与虚空星纹，包含 walk、hurt、dead、jump、charge。

## 道具与 FX 资源提示词

- `diamond.png`：28x28 透明 PNG spritesheet，6 帧旋转，高价值青蓝钻石，亮度高于金币但不遮挡角色。
- `skill-orb-aegis.png`：40x40 透明 PNG，星盾护体技能球，蓝白护盾符号，pulse 4 帧。
- `skill-orb-quick-cast.png`：40x40 透明 PNG，疾速施法技能球，金色火花/法术加速符号，pulse 4 帧。
- `enemy-bolt.png`：32x32 透明 PNG，4 帧飞行弹幕，可同时适配晶弹和虚空弹，主体清楚、危险色明显。
- `aegis.png`：64x64 透明 PNG，4 帧护盾爆发，围绕玩家中心，不要大面积不透明遮挡场景。

## 美术 Agent 任务包

优先级：

1. 绘制 `spitter.png`、`charger.png`、`brute.png`、`enemy-bolt.png`，先解决新增难度机制的可读性。
2. 绘制 `mini-boss.png`、`big-boss.png`、`aegis.png`，强化 boss 战和星盾反馈。
3. 绘制 `diamond.png`、`skill-orb-aegis.png`、`skill-orb-quick-cast.png`，补齐奖励与技能识别。
4. 绘制 `volt.png`、`oracle.png`，再回补旧角色 spritesheet。

交付后需要把实际文件路径填入 `assets/pixel-quest-assets.js` 对应 key，并在缺图 fallback 仍可运行的前提下做浏览器截图验收。

## 验收清单

- 每个 tile 是 `40x40`，背景是 `960x540`。
- `platform` 下方 14px 透明，避免看起来像完整实心块。
- `spike` 必须在 40x40 内，底部有基座，三角轮廓清楚。
- `groundTop` 和 `ground` 可以上下拼接，不出现明显断层。
- 同一主题的五个 tile 使用同一调色板。
- 不包含角色、怪物、金币、文字、按钮或 UI 元素。
- 放进游戏后，玩家、敌人、金币和技能球必须仍然比地图更醒目。
