# EduArena 地圖技術 Demo

EduArena 海洋地圖純前端技術展示站。

**展示技術**：
- DOGTOR 風 3D 透視縮放海洋地圖
- 慣性視差（前景/中景/背景三層）
- 手寫彈簧物理引擎（stiffness 50 / damping 20 / mass 1）
- 「消失點釘背景天際線」深度模型
- 拖曳手感 + 焦點放大可點

## 看 Demo

線上：<https://gamezpika.github.io/eduarena-skill-demo/>

## 本地跑

```bash
cd eduarena-skill-demo
python3 -m http.server 8000
# 瀏覽器開 http://localhost:8000
```

## 檔案結構

```
.
├── index.html                  ← 入口頁
├── static/
│   ├── css/
│   │   ├── starmap.css         ← 海洋地圖樣式（與 EduArena 同源）
│   │   └── demo.css            ← Demo 站 baseline 樣式 + 彈窗
│   └── js/
│       ├── starmap.js          ← 海洋地圖物理引擎（與 EduArena 同源）
│       └── mock-eduapi.js      ← 假裝 EduArena 後端 + 點島彈窗
└── assets/images/              ← 海洋圖 + 5 島 + 圖標
```

## 回收到 EduArena Production

`starmap.js` / `starmap.css` 跟 EduArena 同源，未來在 demo 站調好的手感要搬回去：

```bash
# 在 EduArena repo 執行
cp ../eduarena-skill-demo/static/css/starmap.css static/css/
cp ../eduarena-skill-demo/static/js/starmap.js static/js/
cp ../eduarena-skill-demo/assets/images/*.png assets/images/

# 把 assets 路徑從相對 (assets/) 改回絕對 (/assets/)
sed -i 's|"assets/|"/assets/|g; s|'\''assets/|'\''/assets/|g' static/js/starmap.js
sed -i 's|url("assets/|url("/assets/|g' static/css/starmap.css

# 確認後 commit
git add static/css/starmap.css static/js/starmap.js assets/images/
git commit -m "feat(map): 海洋地圖（從 demo 站回收）"
git push
```

**不要搬**：`mock-eduapi.js` / `demo.css` / `index.html`（這三個是 demo 站專用）。

## 來源

從 EduArena tag `exp/ocean-white-0517`（commit `5d928c2`）萃取。
