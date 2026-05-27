# BeatEmUp Demo（Streets of Rage 4 風）

Godot 4.6 橫向捲軸格鬥 demo —— 目前只是 **ColorRect 純色塊 placeholder 階段**，沒有 script、沒有物理、沒有戰鬥邏輯，只是把場景骨架 + 角色配置定下來。

## 場景結構

```
scenes/
├── levels/city.tscn        ← 主場景（main scene，1280×720 viewport，世界 4000×720）
├── actors/
│   ├── player.tscn         ← 藍 64×128
│   ├── goon.tscn           ← 紅 56×120（街頭混混）
│   ├── heavy.tscn          ← 暗紅 88×160（高大壯碩打手）
│   ├── slasher.tscn        ← 橘 44×104（瘦小快速）
│   └── thrower.tscn        ← 綠 56×120（遠距離丟石頭）
└── props/
    ├── barrel.tscn         ← 木桶棕 48×64
    └── crate.tscn          ← 木箱橘棕 56×56
```

## city.tscn 場景配置

- **世界尺寸**：4000×720，分 5 區段（每段 800px，垂直白條 + SEG 1–5 文字標記）
- **背景層**（從遠到近）：
  - Sky 深藍紫 #1d2235
  - BuildingsFar 較淺 #2a2d3a（y=180–520）
  - BuildingsNear 最暗 #161922（y=300–540）
  - Ground 柏油 #1a1a1a（y=540–720）
  - GroundEdge 黃線 y=540
- **道具**：10 個（6 桶 + 4 箱）散落 5 區段地面
- **角色配置**：
  - SEG 1：Player（180, 580）
  - SEG 2：Goon×2（980, 1420）
  - SEG 3：Slasher×2（1780, 2200）
  - SEG 4：Goon（2620）+ Heavy（2900）
  - SEG 5：Thrower（3420）+ Heavy（3820）終點 boss

## 怎麼開

```bash
# 用本機 Godot 4.6 打開
godot --path /home/gamezpika/eduarena-skill-demo/godot_beatemup -e

# 或直接跑遊戲（會看到靜態擺位畫面，無互動）
godot --path /home/gamezpika/eduarena-skill-demo/godot_beatemup
```

## 沒做（之後再加）

- 玩家控制 / 物理 / 攻擊判定
- 敵人 AI
- 鏡頭跟隨 + 區段觸發 enemy wave
- 真實美術 sprite（目前都是 ColorRect 純色塊）
- 桶箱破壞 / 掉道具
- HUD（血條、計分、終極技條）
