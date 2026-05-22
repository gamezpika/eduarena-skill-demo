/**
 * 3D 探索地圖 — Three.js Phase 3 完整版
 * Phase 1: cube + capsule | 2: primitives | 3a: chibi sprite | 3b: 天空+雲+草地
 * 3c: Perlin 地形 + Instanced 樹草石 (學 Bruno Simon)
 * 3d: ES module + UnrealBloom + ACES tone mapping
 * 3e: GLTF 第三人稱角色 (Soldier) + AnimationMixer walk/idle 切換
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

(function () {
    "use strict";

    const POPUPS = {
        shop:    { icon: "🏪", title: "商店",     body: "服裝/職業道具/節日造型<br>多主題輪換上架", color: 0xe74c3c },
        exam:    { icon: "🎓", title: "考試中心",  body: "5 科檢定考與模擬考<br>通過獲得認證證書", color: 0xecf0f1 },
        farm:    { icon: "🐄", title: "農田",     body: "養動物、收穫資源<br>每日任務獎勵金幣", color: 0xf1c40f },
        pvp:     { icon: "⚔️", title: "PK 競技場", body: "三種模式：同年級對戰<br>大亂鬥 / 朋友房間", color: 0x95a5a6 },
        boss:    { icon: "🏰", title: "魔王塔",   body: "5 科魔王戰 T1 / T2 / T3<br>累積學習換取榮譽勳章", color: 0x6c3483 },
        museum:  { icon: "🏛", title: "偉人館",   body: "25 chibi 偉人圖鑑<br>+ 名人九宮格遊戲", color: 0xbdc3c7 },
        quest:   { icon: "📋", title: "任務告示板", body: "每日任務 / 成就 / 限時挑戰<br>共 10 種類型", color: 0x8b4513 },
        chinese: { icon: "📖", title: "國語島",   body: "讀寫、注音、閱讀、成語<br>6 個年級 36 章節", color: 0xc0392b },
        english: { icon: "🔤", title: "英文島",   body: "單字、文法、聽力、口說<br>含 ABC 字母與聽力重組", color: 0x3498db },
        math:    { icon: "🔢", title: "數學島",   body: "加減乘除、分數、幾何<br>6 個年級 36 章節", color: 0xe67e22 },
        science: { icon: "🔬", title: "自然島",   body: "生物、物質、能量、地球<br>含實驗題與圖示題", color: 0x2ecc71 },
        social:  { icon: "🌏", title: "社會島",   body: "歷史、地理、公民<br>含台灣社會與世界文化", color: 0x9b59b6 },
    };

    // 12 建築 3D 座標（x, z）— 對應 world.html top%/left% 平面分布
    // top:0~100% → z:-40~+40 (深度), left:0~100% → x:-40~+40
    const BUILDINGS = [
        { key: "chinese", x: -35, z: -35, h: 6 },
        { key: "boss",    x:   0, z: -35, h: 12 },  // 魔王塔最高
        { key: "english", x:  30, z: -35, h: 8 },
        { key: "shop",    x: -30, z: -10, h: 5 },
        { key: "exam",    x:   0, z: -10, h: 7 },   // 考試中心較大
        { key: "museum",  x:  30, z: -10, h: 5 },
        { key: "pvp",     x: -30, z:  10, h: 4 },
        { key: "farm",    x:   0, z:  10, h: 3 },
        { key: "quest",   x:  30, z:  10, h: 4 },
        { key: "math",    x: -35, z:  35, h: 7 },
        { key: "social",  x:   0, z:  35, h: 6 },
        { key: "science", x:  35, z:  35, h: 8 },
    ];

    // ─── Three.js scene 初始化
    const canvas = document.getElementById("scene-canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    // Phase 3d: ACES filmic tone mapping + sRGB（電影感）
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb0d8e8, 80, 250);

    // ─── 天空盒 gradient sphere（內側）
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 64; skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext("2d");
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0,    "#4a90e2");  // 頂部深藍
    skyGrad.addColorStop(0.5,  "#87ceeb");  // 中段天藍
    skyGrad.addColorStop(0.85, "#ffd9a8");  // 地平線暖橘
    skyGrad.addColorStop(1,    "#ffb380");  // 底部暖橘
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, 64, 256);
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(220, 32, 16),
        new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);

    // ─── 飄雲 sprite billboard（8 朵隨機飄）
    const cloudCanvas = document.createElement("canvas");
    cloudCanvas.width = 256; cloudCanvas.height = 128;
    const cloudCtx = cloudCanvas.getContext("2d");
    cloudCtx.fillStyle = "rgba(255,255,255,0)";
    cloudCtx.fillRect(0, 0, 256, 128);
    // 多個重疊圓畫蓬鬆雲
    cloudCtx.fillStyle = "rgba(255,255,255,0.92)";
    [
        [80, 70, 45], [130, 55, 55], [180, 70, 40],
        [60, 85, 30], [150, 90, 35], [200, 85, 28]
    ].forEach(([x, y, r]) => {
        cloudCtx.beginPath();
        cloudCtx.arc(x, y, r, 0, Math.PI * 2);
        cloudCtx.fill();
    });
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    const clouds = [];
    function rand(min, max) { return Math.random() * (max - min) + min; }
    for (let i = 0; i < 10; i++) {
        const mat = new THREE.SpriteMaterial({
            map: cloudTex, transparent: true, opacity: rand(0.55, 0.85),
            depthWrite: false, fog: false
        });
        const c = new THREE.Sprite(mat);
        const w = rand(20, 36);
        c.scale.set(w, w * 0.5, 1);
        c.position.set(rand(-100, 100), rand(30, 50), rand(-100, 100));
        scene.add(c);
        clouds.push({ mesh: c, speed: rand(0.015, 0.045) });
    }

    // ─── Phase 3g: 飛鳥 (Flamingo / Parrot / Stork) 各自圓形軌道飛
    const birds = [];
    const birdLoader = new GLTFLoader();
    [
        { name: "Flamingo", scale: 0.06, radius: 38, speed: 0.6, height: 28 },
        { name: "Parrot",   scale: 0.06, radius: 52, speed: 1.0, height: 35 },
        { name: "Stork",    scale: 0.06, radius: 45, speed: 0.45, height: 42 },
    ].forEach((spec, idx) => {
        birdLoader.load(
            `https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/${spec.name}.glb`,
            gltf => {
                const bird = gltf.scene;
                bird.scale.setScalar(spec.scale);
                bird.traverse(c => { if (c.isMesh) c.castShadow = false; });
                scene.add(bird);
                const bMixer = new THREE.AnimationMixer(bird);
                if (gltf.animations.length > 0) {
                    bMixer.clipAction(gltf.animations[0]).play();
                }
                birds.push({
                    mesh: bird, mixer: bMixer,
                    radius: spec.radius, speed: spec.speed,
                    phase: idx * 2.1, height: spec.height,
                });
            },
            null,
            err => console.warn(`Bird ${spec.name} load failed`, err)
        );
    });

    const camera = new THREE.PerspectiveCamera(
        50, window.innerWidth / window.innerHeight, 0.1, 500
    );

    // ─── 光源
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.1);
    sun.position.set(50, 100, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // ─── Phase 3g: 太陽 LensFlare 光暈
    const flareTexLoader = new THREE.TextureLoader();
    const flare0 = flareTexLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/lensflare/lensflare0.png');
    const flare3 = flareTexLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/lensflare/lensflare3.png');
    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(flare0, 320, 0, sun.color));
    lensflare.addElement(new LensflareElement(flare3, 50, 0.6));
    lensflare.addElement(new LensflareElement(flare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(flare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(flare3, 70, 1));
    sun.add(lensflare);

    // ─── 草地 noise texture
    const grassCanvas = document.createElement("canvas");
    grassCanvas.width = 256; grassCanvas.height = 256;
    const grassCtx = grassCanvas.getContext("2d");
    grassCtx.fillStyle = "#7cb342";
    grassCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
        const shade = Math.random();
        if (shade < 0.5) grassCtx.fillStyle = "rgba(102, 153, 51, 0.5)";
        else if (shade < 0.85) grassCtx.fillStyle = "rgba(140, 200, 80, 0.4)";
        else grassCtx.fillStyle = "rgba(200, 230, 130, 0.6)";
        grassCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 4);
    }
    const grassTex = new THREE.CanvasTexture(grassCanvas);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(15, 15);

    // ─── Phase 3c: Perlin-like noise 地形起伏（中央區 flatten 給建築站平地）
    // 學自 brunosimon/infinite-world: 細分 plane + vertex displacement
    function terrainHeight(x, z) {
        // 距中心 r：r < 28 完全平，r > 50 完整起伏，r=28~50 漸進
        const r = Math.hypot(x, z);
        const flatRadius = 28;
        const fullHeightRadius = 50;
        let factor = (r - flatRadius) / (fullHeightRadius - flatRadius);
        factor = Math.max(0, Math.min(1, factor));
        // 多 octave noise（用 sin/cos 模擬 Perlin，UMD 不依賴 SimplexNoise）
        const h =
            Math.sin(x * 0.08) * Math.cos(z * 0.08) * 3 +
            Math.sin(x * 0.2 + z * 0.15) * 1.2 +
            Math.cos(z * 0.32 - x * 0.1) * 0.6;
        return h * factor;
    }

    const groundGeo = new THREE.PlaneGeometry(120, 120, 80, 80);
    const positions = groundGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);
        positions.setZ(i, terrainHeight(x, z));
    }
    positions.needsUpdate = true;
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({ map: grassTex });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── Phase 3c: Instanced trees + grass tufts (大量裝飾不卡)
    // 學自 brunosimon/folio: InstancedMesh 一次 draw 上千個 instance
    function placeInstanced(geo, mat, count, options) {
        const inst = new THREE.InstancedMesh(geo, mat, count);
        const dummy = new THREE.Object3D();
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = (Math.random() - 0.5) * 110;
            const z = (Math.random() - 0.5) * 110;
            const r = Math.hypot(x, z);
            // 避開中央建築區
            if (r < options.minR) continue;
            if (r > 56) continue;  // 別到地圖邊外
            const y = terrainHeight(x, z) + (options.yOffset || 0);
            dummy.position.set(x, y, z);
            const s = options.scaleMin + Math.random() * (options.scaleMax - options.scaleMin);
            dummy.scale.set(s, s * (options.tall || 1), s);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        inst.count = placed;
        inst.castShadow = options.castShadow !== false;
        inst.receiveShadow = true;
        scene.add(inst);
        return inst;
    }

    // 樹冠（綠色 cone）
    placeInstanced(
        new THREE.ConeGeometry(1.2, 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x2d6a4f, flatShading: true }),
        180, { minR: 32, yOffset: 2.5, scaleMin: 0.7, scaleMax: 1.4, tall: 1.2 }
    );
    // 樹幹（棕色 cylinder）
    placeInstanced(
        new THREE.CylinderGeometry(0.25, 0.35, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x5d4037 }),
        180, { minR: 32, yOffset: 0.75, scaleMin: 0.7, scaleMax: 1.4 }
    );
    // 草叢（小綠 cone 散布）
    placeInstanced(
        new THREE.ConeGeometry(0.3, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x66bb6a, flatShading: true }),
        400, { minR: 18, yOffset: 0.25, scaleMin: 0.5, scaleMax: 1.2, castShadow: false }
    );
    // 石頭（灰 box scatter）
    placeInstanced(
        new THREE.BoxGeometry(1, 0.6, 1),
        new THREE.MeshStandardMaterial({ color: 0x9e9e9e, flatShading: true }),
        50, { minR: 20, yOffset: 0.3, scaleMin: 0.6, scaleMax: 1.3 }
    );

    // ─── Phase 3: 12 建築用 chibi sprite billboard（沿用 EDUDEMO 既有 sprite）
    const SPRITE_MAP = {
        boss:    "assets/images/village/village_boss.png",
        shop:    "assets/images/village/village_shop.png",
        exam:    "assets/images/world/academy.png",
        museum:  "assets/images/world/museum.png",
        pvp:     "assets/images/village/village_pvp.png",
        farm:    "assets/images/village/village_farm.png",
        quest:   "assets/images/world/quest.png",
        chinese: "assets/images/island_chinese.png",
        english: "assets/images/island_english.png",
        math:    "assets/images/island_math.png",
        science: "assets/images/island_science.png",
        social:  "assets/images/island_social.png",
    };
    const SPRITE_SIZE = {  // 每建築 sprite 尺寸（不同建築可差別大）
        boss: 12, shop: 10, exam: 12, museum: 10, pvp: 9, farm: 9, quest: 7,
        chinese: 14, english: 14, math: 12, science: 14, social: 14,
    };

    // ─── Phase 4 試做: 5 科目島用 primitives 拼 3D（取代 sprite billboard）
    const ISLAND_3D_KEYS = ['chinese', 'english', 'math', 'science', 'social'];
    const islandAnimUpdaters = [];  // 每島自己的 animation update 函式

    // 每島專屬字體（label 用）
    const ISLAND_FONTS = {
        chinese: { font: "bold 36px 'Ma Shan Zheng', 'DFKai-SB', 'STKaiti', cursive", color: "#ffd6d6", text: "國 語 島" },
        english: { font: "bold 32px 'Playfair Display', 'Georgia', serif", color: "#cde7ff", text: "English Isle" },
        math:    { font: "bold 36px 'Courier New', monospace", color: "#fff3c4", text: "1 2 3 數 學" },
        science: { font: "italic 32px 'Comic Sans MS', cursive", color: "#c9f3d0", text: "✦ 自 然" },
        social:  { font: "900 32px 'Arial Black', sans-serif", color: "#e1ccff", text: "🌏 SOCIAL 社會" },
    };

    const buildingMeshes = [];
    const textureLoader = new THREE.TextureLoader();
    BUILDINGS.forEach(b => {
        const opts = POPUPS[b.key];
        const size = SPRITE_SIZE[b.key] || 8;

        if (ISLAND_3D_KEYS.includes(b.key)) {
            // Phase 4: 3D primitives 拼
            const island = make3DIsland(b.key);
            island.group.position.set(b.x, 0, b.z);
            scene.add(island.group);
            if (island.update) islandAnimUpdaters.push(island.update);

            // hitbox 給 raycaster
            const hitbox = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitbox.position.set(b.x, size / 2, b.z);
            hitbox.userData.key = b.key;
            scene.add(hitbox);
            buildingMeshes.push(hitbox);

            // 特色字體 label
            const fontSpec = ISLAND_FONTS[b.key];
            const labelCanvas = document.createElement("canvas");
            labelCanvas.width = 512; labelCanvas.height = 96;
            const ctx = labelCanvas.getContext("2d");
            ctx.fillStyle = "rgba(0,0,0,0.78)";
            roundRect(ctx, 0, 0, 512, 96, 20);
            ctx.fillStyle = fontSpec.color;
            ctx.font = fontSpec.font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fontSpec.text, 256, 48);
            const labelTexture = new THREE.CanvasTexture(labelCanvas);
            const labelMat = new THREE.SpriteMaterial({ map: labelTexture, depthTest: false });
            const label = new THREE.Sprite(labelMat);
            label.position.set(b.x, size + 3, b.z);
            label.scale.set(12, 2.25, 1);
            scene.add(label);
        } else {
            // 其他 7 建築：保留 sprite billboard
            const url = SPRITE_MAP[b.key];
            const texture = textureLoader.load(url);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            const spriteMat = new THREE.SpriteMaterial({
                map: texture, transparent: true, depthWrite: false, sizeAttenuation: true
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(size, size, 1);
            sprite.position.set(b.x, size / 2, b.z);
            scene.add(sprite);

            const hitbox = new THREE.Mesh(
                new THREE.BoxGeometry(size * 0.7, size, size * 0.7),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitbox.position.set(b.x, size / 2, b.z);
            hitbox.userData.key = b.key;
            scene.add(hitbox);
            buildingMeshes.push(hitbox);

            // 一般 label
            const labelCanvas = document.createElement("canvas");
            labelCanvas.width = 256; labelCanvas.height = 64;
            const ctx = labelCanvas.getContext("2d");
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            roundRect(ctx, 0, 0, 256, 64, 12);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 32px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(opts.icon + " " + opts.title, 128, 32);
            const labelTexture = new THREE.CanvasTexture(labelCanvas);
            const labelMat = new THREE.SpriteMaterial({ map: labelTexture, depthTest: false });
            const label = new THREE.Sprite(labelMat);
            label.position.set(b.x, size + 2, b.z);
            label.scale.set(8, 2, 1);
            scene.add(label);
        }
    });

    // ─── 5 個科目島工廠（return {group, update}）
    function make3DIsland(key) {
        switch (key) {
            case "chinese":  return makeChineseIsland();
            case "english":  return makeEnglishIsland();
            case "math":     return makeMathIsland();
            case "science":  return makeScienceIsland();
            case "social":   return makeSocialIsland();
        }
    }

    function makeChineseIsland() {
        const g = new THREE.Group();
        // 中式塔 3 層 (Cylinder + Cone 紅瓦頂交錯)
        const colors = { wall: 0xc0392b, roof: 0x8b0000, base: 0x6d4c41 };
        const wallMat = new THREE.MeshStandardMaterial({ color: colors.wall });
        const roofMat = new THREE.MeshStandardMaterial({ color: colors.roof });
        const baseMat = new THREE.MeshStandardMaterial({ color: colors.base });
        const heights = [2, 1.8, 1.6];
        const radii = [3.2, 2.6, 2.0];
        let y = 0;
        // 底座
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4, 1, 16), baseMat);
        base.position.y = 0.5; base.castShadow = true; g.add(base);
        y = 1;
        for (let i = 0; i < 3; i++) {
            // 牆
            const wall = new THREE.Mesh(new THREE.CylinderGeometry(radii[i], radii[i], heights[i], 8), wallMat);
            wall.position.y = y + heights[i] / 2; wall.castShadow = true; g.add(wall);
            y += heights[i];
            // 屋頂
            const roof = new THREE.Mesh(new THREE.ConeGeometry(radii[i] + 0.6, 1, 8), roofMat);
            roof.position.y = y + 0.5; roof.castShadow = true; g.add(roof);
            y += 1;
        }
        // 塔頂風鈴
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfdc500 }));
        bell.position.y = y + 0.5; g.add(bell);
        return {
            group: g,
            update: dt => {
                bell.rotation.z = Math.sin(Date.now() * 0.003) * 0.4;
            }
        };
    }

    function makeEnglishIsland() {
        const g = new THREE.Group();
        // 西方城堡: 4 角塔 + 中央方塔
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2980b9 });
        // 中央主塔
        const main = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), wallMat);
        main.position.y = 2; main.castShadow = true; g.add(main);
        const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2, 4), roofMat);
        mainRoof.position.y = 5; mainRoof.castShadow = true; g.add(mainRoof);
        // 4 角小塔
        const flags = [];
        [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([x, z]) => {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4, 8), wallMat);
            t.position.set(x, 2, z); t.castShadow = true; g.add(t);
            const r = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 8), roofMat);
            r.position.set(x, 4.75, z); r.castShadow = true; g.add(r);
            // 旗
            const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            flagPole.position.set(x, 6.2, z); g.add(flagPole);
            const flagMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, side: THREE.DoubleSide });
            const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), flagMat);
            flag.position.set(x + 0.3, 6.6, z); g.add(flag);
            flags.push(flag);
        });
        return {
            group: g,
            update: dt => {
                // 旗子飄動
                flags.forEach((f, i) => {
                    f.rotation.y = Math.sin(Date.now() * 0.004 + i) * 0.6;
                });
            }
        };
    }

    function makeMathIsland() {
        const g = new THREE.Group();
        // 金字塔
        const pyramid = new THREE.Mesh(
            new THREE.ConeGeometry(3.5, 5, 4),
            new THREE.MeshStandardMaterial({ color: 0xe67e22, flatShading: true })
        );
        pyramid.position.y = 2.5; pyramid.castShadow = true;
        pyramid.rotation.y = Math.PI / 4; g.add(pyramid);
        // 算盤架 (兩根 cylinder 平行)
        const frame = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const beadMat = new THREE.MeshStandardMaterial({ color: 0xfdc500 });
        const beads = [];
        [-1, 1].forEach(side => {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), frame);
            bar.position.set(2.5, 2 + side * 0.6, 0); bar.rotation.z = Math.PI / 2;
            g.add(bar);
            // 5 顆珠在 bar 上
            for (let i = -2; i <= 2; i++) {
                const bead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), beadMat);
                bead.position.set(2.5 + i * 0.65, 2 + side * 0.6, 0);
                bead.userData.basex = bead.position.x;
                bead.userData.row = side;
                g.add(bead);
                beads.push(bead);
            }
        });
        return {
            group: g,
            update: dt => {
                // 算盤珠左右移
                beads.forEach((b, i) => {
                    b.position.x = b.userData.basex + Math.sin(Date.now() * 0.002 + i * 0.3) * 0.2;
                });
            }
        };
    }

    function makeScienceIsland() {
        const g = new THREE.Group();
        // 山 (大 cone 灰)
        const mountain = new THREE.Mesh(
            new THREE.ConeGeometry(3, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true })
        );
        mountain.position.set(-1.5, 2, 0); mountain.castShadow = true; g.add(mountain);
        // 山頂雪
        const snowCap = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 1.5, 8),
            new THREE.MeshStandardMaterial({ color: 0xecf0f1, flatShading: true })
        );
        snowCap.position.set(-1.5, 4.5, 0); g.add(snowCap);
        // 望遠鏡三腳架
        const tripodMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
        [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]].forEach(([x, z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), tripodMat);
            leg.position.set(2 + x * 0.3, 0.9, z * 0.3);
            leg.rotation.x = z > 0 ? 0.2 : -0.2;
            leg.rotation.z = x > 0 ? -0.2 : 0.2;
            g.add(leg);
        });
        // 望遠鏡本體 (cylinder)
        const tele = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 2.5, 12),
            new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.5, roughness: 0.3 })
        );
        tele.position.set(2, 2, 0);
        tele.rotation.z = Math.PI / 3;
        g.add(tele);
        // 望遠鏡頭部 (球)
        const teleHead = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
            new THREE.MeshStandardMaterial({ color: 0xecf0f1 }));
        teleHead.position.set(3, 3, 0); g.add(teleHead);
        return {
            group: g,
            update: dt => {
                // 望遠鏡左右掃描
                const a = Math.sin(Date.now() * 0.001) * 0.5;
                tele.rotation.y = a;
                teleHead.position.x = 3 + Math.cos(a) * 0.3;
                teleHead.position.z = Math.sin(a) * 0.3;
            }
        };
    }

    function makeSocialIsland() {
        const g = new THREE.Group();
        // 地球儀: Sphere 加 simple noise texture (canvas 畫陸地/海洋)
        const globeCanvas = document.createElement("canvas");
        globeCanvas.width = 256; globeCanvas.height = 128;
        const gctx = globeCanvas.getContext("2d");
        gctx.fillStyle = "#3498db";  // 海
        gctx.fillRect(0, 0, 256, 128);
        gctx.fillStyle = "#27ae60";  // 陸地
        // 隨機 blob 陸地
        [[40, 30, 40, 25], [120, 50, 50, 30], [200, 35, 35, 25], [80, 90, 30, 20], [180, 95, 45, 22]].forEach(([x, y, w, h]) => {
            gctx.beginPath();
            gctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
            gctx.fill();
        });
        const globeTex = new THREE.CanvasTexture(globeCanvas);
        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(2.2, 32, 24),
            new THREE.MeshStandardMaterial({ map: globeTex })
        );
        globe.position.y = 3; globe.castShadow = true; g.add(globe);
        // 金色 torus 環 (赤道 + 子午線)
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.6, roughness: 0.3 });
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 8, 32), ringMat);
        ring1.position.y = 3; g.add(ring1);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 8, 32), ringMat);
        ring2.position.y = 3; ring2.rotation.x = Math.PI / 2; g.add(ring2);
        // 底座
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6, 1, 0.8, 16),
            new THREE.MeshStandardMaterial({ color: 0x8b4513 })
        );
        base.position.y = 0.4; base.castShadow = true; g.add(base);
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.15, 1, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b4513 })
        );
        stem.position.y = 1.3; g.add(stem);
        return {
            group: g,
            update: dt => {
                // 地球儀旋轉
                globe.rotation.y += 0.012;
            }
        };
    }

    // ─── 建築模型工廠：每個建築用 primitives 組合出特色外觀
    function makeBuilding(key, h) {
        const g = new THREE.Group();
        const baseColor = POPUPS[key].color;

        switch (key) {
            case "boss":  // 魔王塔：紫色高塔 + 紅色尖頂 + 發光水晶
                addPart(g, new THREE.CylinderGeometry(2, 2.5, h, 8),
                        new THREE.MeshStandardMaterial({ color: 0x4a235a }), 0, h/2, 0);
                addPart(g, new THREE.ConeGeometry(2, 2, 8),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, h + 1, 0);
                addPart(g, new THREE.OctahedronGeometry(0.7),
                        new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xc0392b, emissiveIntensity: 0.5 }), 0, h + 2.5, 0);
                break;
            case "exam":  // 考試中心：希臘神殿 — 多根白柱 + 三角頂
                addPart(g, new THREE.BoxGeometry(7, 0.5, 7),
                        new THREE.MeshStandardMaterial({ color: 0xbdc3c7 }), 0, 0.25, 0);
                [-2.5, 0, 2.5].forEach(x => [-2.5, 2.5].forEach(z => {
                    addPart(g, new THREE.CylinderGeometry(0.4, 0.4, h - 1.5),
                            new THREE.MeshStandardMaterial({ color: 0xecf0f1 }), x, (h-1.5)/2 + 0.5, z);
                }));
                addPart(g, new THREE.BoxGeometry(7, 0.6, 7),
                        new THREE.MeshStandardMaterial({ color: 0xbdc3c7 }), 0, h - 0.5, 0);
                addPart(g, makeRoofPrism(7, 1.5, 7),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, h + 0.5, 0);
                break;
            case "shop":  // 商店：紅白條紋篷頂 + 木屋
                addPart(g, new THREE.BoxGeometry(5, h, 5),
                        new THREE.MeshStandardMaterial({ color: 0x8b4513 }), 0, h/2, 0);
                addPart(g, new THREE.BoxGeometry(6, 0.8, 6),
                        new THREE.MeshStandardMaterial({ color: 0xe74c3c }), 0, h + 0.4, 0);
                addPart(g, new THREE.BoxGeometry(1.5, 2.5, 0.2),
                        new THREE.MeshStandardMaterial({ color: 0x4e342e }), 0, 1.25, 2.6);
                break;
            case "farm":  // 農田：圍欄 + 麥田（多 box）
                addPart(g, new THREE.BoxGeometry(7, 0.3, 7),
                        new THREE.MeshStandardMaterial({ color: 0x6d4c41 }), 0, 0.15, 0);
                for (let i = -2.5; i <= 2.5; i += 1.5) {
                    for (let j = -2.5; j <= 2.5; j += 1.5) {
                        addPart(g, new THREE.BoxGeometry(0.6, h, 0.6),
                                new THREE.MeshStandardMaterial({ color: 0xf1c40f }), i, h/2, j);
                    }
                }
                // 四角圍欄柱
                [-3.5, 3.5].forEach(x => [-3.5, 3.5].forEach(z => {
                    addPart(g, new THREE.CylinderGeometry(0.2, 0.2, 2),
                            new THREE.MeshStandardMaterial({ color: 0x4e342e }), x, 1, z);
                }));
                break;
            case "pvp":  // PK 競技場：圓形 + 旗幟
                addPart(g, new THREE.CylinderGeometry(3.5, 3.5, h, 16),
                        new THREE.MeshStandardMaterial({ color: 0x95a5a6 }), 0, h/2, 0);
                addPart(g, new THREE.CylinderGeometry(3.5, 3.5, 0.3, 16),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, h, 0);
                // 中間插旗
                addPart(g, new THREE.CylinderGeometry(0.1, 0.1, 4),
                        new THREE.MeshStandardMaterial({ color: 0x4e342e }), 0, h + 2, 0);
                addPart(g, new THREE.BoxGeometry(1.2, 0.8, 0.1),
                        new THREE.MeshStandardMaterial({ color: 0xff5252 }), 0.6, h + 3.5, 0);
                break;
            case "museum":  // 偉人館：白色神殿 + 兩雕像
                addPart(g, new THREE.BoxGeometry(5, h, 5),
                        new THREE.MeshStandardMaterial({ color: 0xecf0f1 }), 0, h/2, 0);
                addPart(g, makeRoofPrism(5.5, 1, 5.5),
                        new THREE.MeshStandardMaterial({ color: 0xd5dbdb }), 0, h + 0.5, 0);
                // 兩尊雕像
                [-1.5, 1.5].forEach(x => {
                    addPart(g, new THREE.CylinderGeometry(0.4, 0.4, 0.3),
                            new THREE.MeshStandardMaterial({ color: 0xa1a1a1 }), x, 0.15, 2.8);
                    addPart(g, new THREE.SphereGeometry(0.5),
                            new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }), x, 1.2, 2.8);
                });
                break;
            case "quest":  // 任務告示板：木牌 + 旗
                addPart(g, new THREE.BoxGeometry(0.3, h, 0.3),
                        new THREE.MeshStandardMaterial({ color: 0x4e342e }), -1.5, h/2, 0);
                addPart(g, new THREE.BoxGeometry(0.3, h, 0.3),
                        new THREE.MeshStandardMaterial({ color: 0x4e342e }), 1.5, h/2, 0);
                addPart(g, new THREE.BoxGeometry(4, 2.5, 0.3),
                        new THREE.MeshStandardMaterial({ color: 0xa0522d }), 0, h - 1.5, 0);
                addPart(g, new THREE.BoxGeometry(1.2, 0.8, 0.1),
                        new THREE.MeshStandardMaterial({ color: 0xff5252 }), 0.6, h + 0.5, 0);
                break;
            case "chinese":  // 國語島：中式塔 多層斜頂
                addPart(g, new THREE.CylinderGeometry(2.5, 3, 2, 8),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, 1, 0);
                addPart(g, new THREE.ConeGeometry(3.5, 1, 8),
                        new THREE.MeshStandardMaterial({ color: 0x8b0000 }), 0, 2.5, 0);
                addPart(g, new THREE.CylinderGeometry(2, 2.5, 2, 8),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, 4, 0);
                addPart(g, new THREE.ConeGeometry(3, 1, 8),
                        new THREE.MeshStandardMaterial({ color: 0x8b0000 }), 0, 5.5, 0);
                addPart(g, new THREE.CylinderGeometry(1.5, 2, h-6, 8),
                        new THREE.MeshStandardMaterial({ color: 0xc0392b }), 0, (h-6)/2 + 6, 0);
                addPart(g, new THREE.ConeGeometry(2.5, 1.5, 8),
                        new THREE.MeshStandardMaterial({ color: 0x8b0000 }), 0, h + 0.5, 0);
                break;
            case "english":  // 英文島：城堡 多塔尖頂
                addPart(g, new THREE.BoxGeometry(6, h - 1, 6),
                        new THREE.MeshStandardMaterial({ color: 0xbdc3c7 }), 0, (h-1)/2, 0);
                [-2, 2].forEach(x => [-2, 2].forEach(z => {
                    addPart(g, new THREE.CylinderGeometry(0.8, 0.8, h + 1, 8),
                            new THREE.MeshStandardMaterial({ color: 0xbdc3c7 }), x, (h+1)/2, z);
                    addPart(g, new THREE.ConeGeometry(1, 1.5, 8),
                            new THREE.MeshStandardMaterial({ color: 0x2980b9 }), x, h + 1.75, z);
                }));
                break;
            case "math":  // 數學島：金字塔 + 算盤塔
                addPart(g, new THREE.ConeGeometry(4, h, 4),
                        new THREE.MeshStandardMaterial({ color: 0xe67e22 }), 0, h/2, 0);
                break;
            case "social":  // 社會島：地球儀 + 拱形背景
                addPart(g, new THREE.SphereGeometry(2.5, 24, 16),
                        new THREE.MeshStandardMaterial({ color: 0x3498db }), 0, 3, 0);
                addPart(g, new THREE.TorusGeometry(2.5, 0.15, 8, 32),
                        new THREE.MeshStandardMaterial({ color: 0xf39c12 }), 0, 3, 0);
                addPart(g, new THREE.CylinderGeometry(0.3, 0.3, 0.5),
                        new THREE.MeshStandardMaterial({ color: 0xa0522d }), 0, 0.25, 0);
                break;
            case "science":  // 自然島：山 + 望遠鏡
                addPart(g, new THREE.ConeGeometry(3, h, 6),
                        new THREE.MeshStandardMaterial({ color: 0x6e6e6e }), 0, h/2, 0);
                addPart(g, new THREE.CylinderGeometry(0.4, 0.4, 3),
                        new THREE.MeshStandardMaterial({ color: 0xf39c12 }), 2.5, h + 1.5, 0);
                addPart(g, new THREE.SphereGeometry(0.5, 16, 8),
                        new THREE.MeshStandardMaterial({ color: 0xecf0f1 }), 2.5, h + 3, 0);
                break;
            default:
                addPart(g, new THREE.BoxGeometry(5, h, 5),
                        new THREE.MeshStandardMaterial({ color: baseColor }), 0, h/2, 0);
        }
        return g;
    }
    function addPart(group, geo, mat, x, y, z) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    }
    function makeRoofPrism(w, h, d) {
        // 三角柱屋頂（用 BufferGeometry 手刻）
        const verts = new Float32Array([
            // 前三角
            -w/2, 0, d/2,  w/2, 0, d/2,  0, h, d/2,
            // 後三角
            -w/2, 0, -d/2,  0, h, -d/2,  w/2, 0, -d/2,
            // 左斜面
            -w/2, 0, d/2,  0, h, d/2,  -w/2, 0, -d/2,
            0, h, d/2,  0, h, -d/2,  -w/2, 0, -d/2,
            // 右斜面
            w/2, 0, d/2,  w/2, 0, -d/2,  0, h, d/2,
            w/2, 0, -d/2,  0, h, -d/2,  0, h, d/2,
            // 底
            -w/2, 0, d/2,  -w/2, 0, -d/2,  w/2, 0, d/2,
            -w/2, 0, -d/2,  w/2, 0, -d/2,  w/2, 0, d/2,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
        geo.computeVertexNormals();
        return geo;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    // ─── Phase 3h: Claude 寫 Three.js primitives 拼 chibi 學生（取代 RobotExpressive GLTF）
    // 仿 Alphastack Claudina 風：Sphere 頭 + Box 身體 + Cylinder 手腳 + 走路擺動
    const player = new THREE.Group();
    player.position.set(0, 2, 0);
    scene.add(player);

    // 色票（chibi 國小學生）
    const COLORS = {
        skin:  0xfdd9b0,  // 膚色
        hair:  0x2b1a0a,  // 深棕髮
        shirt: 0x3498db,  // 藍 polo
        pants: 0x34495e,  // 深藍褲
        shoes: 0x2c3e50,  // 黑鞋
        eye:   0x1a1a1a,
        mouth: 0xc0392b,
        cheek: 0xff7e90,  // 紅腮
    };

    const chibi = makeChibiStudent();
    player.add(chibi.group);

    function makeChibiStudent() {
        const root = new THREE.Group();

        // 頭 (大頭 chibi 比例)
        const headGeo = new THREE.SphereGeometry(0.95, 24, 18);
        const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: COLORS.skin }));
        head.position.y = 2.55;
        head.castShadow = true;
        root.add(head);

        // 頭髮 (半球蓋上方 + 瀏海)
        const hairGeo = new THREE.SphereGeometry(0.98, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.8);
        const hair = new THREE.Mesh(hairGeo, new THREE.MeshStandardMaterial({ color: COLORS.hair }));
        hair.position.y = 2.55;
        hair.rotation.x = -0.12;
        root.add(hair);

        // 學生帽 (棒球帽風: 半球 + 帽簷)
        const hatTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.92, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.3),
            new THREE.MeshStandardMaterial({ color: 0xc0392b })  // 紅
        );
        hatTop.position.y = 2.85;
        hatTop.castShadow = true;
        root.add(hatTop);
        const hatBrim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16, 1, false, -Math.PI / 2.5, Math.PI / 1.25),
            new THREE.MeshStandardMaterial({ color: 0x8b0000 })  // 深紅帽簷
        );
        hatBrim.position.set(0, 2.75, 0.45);
        hatBrim.castShadow = true;
        root.add(hatBrim);

        // 眼鏡 (兩個 torus 圓框 + 中間 box 鼻樑)
        [-0.32, 0.32].forEach(x => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.04, 8, 20),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.5, roughness: 0.3 })
            );
            ring.position.set(x, 2.55, 0.92);
            ring.rotation.x = 0;
            root.add(ring);
        });
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.04, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
        );
        bridge.position.set(0, 2.55, 0.92);
        root.add(bridge);

        // 眼睛 (兩顆大 chibi 黑點)
        [-0.32, 0.32].forEach(x => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 12, 10),
                new THREE.MeshStandardMaterial({ color: COLORS.eye })
            );
            eye.position.set(x, 2.55, 0.83);
            root.add(eye);
            // 眼睛白色高光點
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })
            );
            shine.position.set(x + 0.05, 2.62, 0.97);
            root.add(shine);
        });

        // 嘴 (小笑容)
        const mouth = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.05, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.mouth })
        );
        mouth.position.set(0, 2.2, 0.92);
        root.add(mouth);

        // 紅腮
        [-0.55, 0.55].forEach(x => {
            const cheek = new THREE.Mesh(
                new THREE.SphereGeometry(0.13, 10, 8),
                new THREE.MeshStandardMaterial({ color: COLORS.cheek, transparent: true, opacity: 0.55 })
            );
            cheek.position.set(x, 2.32, 0.78);
            cheek.scale.set(1, 0.6, 0.3);
            root.add(cheek);
        });

        // 身體 (box 上窄下寬模擬 polo)
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.15, 1.3, 0.65),
            new THREE.MeshStandardMaterial({ color: COLORS.shirt })
        );
        body.position.y = 1.15;
        body.castShadow = true;
        root.add(body);

        // 左手 group (pivot 在肩膀，旋轉時手從肩擺)
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.7, 1.75, 0);
        root.add(leftArmGroup);
        const leftArmMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.16, 1.3, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.skin })
        );
        leftArmMesh.position.y = -0.65;
        leftArmMesh.castShadow = true;
        leftArmGroup.add(leftArmMesh);

        // 右手 group
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.7, 1.75, 0);
        root.add(rightArmGroup);
        const rightArmMesh = leftArmMesh.clone();
        rightArmGroup.add(rightArmMesh);

        // 左腿 group (pivot 在髖部)
        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.28, 0.5, 0);
        root.add(leftLegGroup);
        const leftLegMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.2, 1.0, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.pants })
        );
        leftLegMesh.position.y = -0.5;
        leftLegMesh.castShadow = true;
        leftLegGroup.add(leftLegMesh);
        // 左鞋 (附在腿底端)
        const leftShoe = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.2, 0.5),
            new THREE.MeshStandardMaterial({ color: COLORS.shoes })
        );
        leftShoe.position.set(0, -1.0, 0.07);
        leftShoe.castShadow = true;
        leftLegGroup.add(leftShoe);

        // 右腿 group
        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.28, 0.5, 0);
        root.add(rightLegGroup);
        rightLegGroup.add(leftLegMesh.clone());
        rightLegGroup.add(leftShoe.clone());

        // 書包 (背後 box 偏圓)
        const backpack = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 1.0, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xf39c12 })  // 橘色
        );
        backpack.position.set(0, 1.25, -0.5);
        backpack.castShadow = true;
        root.add(backpack);
        // 書包帶子 (兩條黑色)
        [-0.25, 0.25].forEach(x => {
            const strap = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 1.2, 0.1),
                new THREE.MeshStandardMaterial({ color: 0x2c3e50 })
            );
            strap.position.set(x, 1.3, -0.35);
            root.add(strap);
        });

        // 整體下移 -2 (對齊 player group 內腳底)
        root.position.y = -2;

        return {
            group: root,
            leftArm: leftArmGroup,
            rightArm: rightArmGroup,
            leftLeg: leftLegGroup,
            rightLeg: rightLegGroup,
            head: head,  // 給 idle 用，頭微擺
        };
    }

    // ─── Phase 3i: 寵物（小白球 chibi，跟著玩家走）
    const pet = makeChibiPet();
    scene.add(pet.group);

    function makeChibiPet() {
        const g = new THREE.Group();
        // 身體 白球
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 12),
            new THREE.MeshStandardMaterial({ color: 0xfafafa })
        );
        body.castShadow = true;
        g.add(body);
        // 耳朵 兩個小三角 (cone 倒)
        [-0.25, 0.25].forEach(x => {
            const ear = new THREE.Mesh(
                new THREE.ConeGeometry(0.15, 0.3, 6),
                new THREE.MeshStandardMaterial({ color: 0xfafafa })
            );
            ear.position.set(x, 0.45, 0);
            ear.rotation.z = x > 0 ? -0.3 : 0.3;
            ear.castShadow = true;
            g.add(ear);
        });
        // 眼睛
        [-0.15, 0.15].forEach(x => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x000000 })
            );
            eye.position.set(x, 0.05, 0.45);
            g.add(eye);
        });
        // 嘴 (粉鼻)
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xff7e90 })
        );
        nose.position.set(0, -0.05, 0.5);
        g.add(nose);
        // 尾巴 (小球)
        const tail = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xfafafa })
        );
        tail.position.set(0, 0.2, -0.55);
        g.add(tail);

        g.position.set(3, 0.5, 0);
        return { group: g, tail };
    }

    // 動畫狀態（取代原 mixer/actions/switchAction）
    let mixer = null;
    let actions = {};
    function switchAction() {}  // no-op (chibi 用 walkPhase 控制)
    document.getElementById('loading-screen')?.classList.add('hide');

    // ─── 控制狀態（4 方向位移，相機不旋轉，世界不暈）
    const keys = { up: false, down: false, left: false, right: false };
    const joystick = { active: false, dx: 0, dy: 0 };
    let playerRot = 0;  // 玩家面對方向（依移動方向算）
    const PLAYER_SPEED = 0.35;

    // 鍵盤（方向鍵 + WASD 都通，document 確保焦點）
    document.addEventListener("keydown", e => {
        const k = e.key;
        if (k === "ArrowUp"    || k === "w" || k === "W") { keys.up = true; e.preventDefault(); }
        if (k === "ArrowDown"  || k === "s" || k === "S") { keys.down = true; e.preventDefault(); }
        if (k === "ArrowLeft"  || k === "a" || k === "A") { keys.left = true; e.preventDefault(); }
        if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; e.preventDefault(); }
    });
    document.addEventListener("keyup", e => {
        const k = e.key;
        if (k === "ArrowUp"    || k === "w" || k === "W") keys.up = false;
        if (k === "ArrowDown"  || k === "s" || k === "S") keys.down = false;
        if (k === "ArrowLeft"  || k === "a" || k === "A") keys.left = false;
        if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
    });

    // 手機虛擬搖桿
    const joyEl = document.getElementById("joystick");
    const knob = document.getElementById("joystick-knob");
    const JOY_MAX = 40;
    joyEl.addEventListener("pointerdown", e => {
        e.preventDefault();
        joystick.active = true;
        joyEl.classList.add("active");
        joyEl.setPointerCapture(e.pointerId);
    });
    joyEl.addEventListener("pointermove", e => {
        if (!joystick.active) return;
        const rect = joyEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > JOY_MAX) { dx = dx / len * JOY_MAX; dy = dy / len * JOY_MAX; }
        joystick.dx = dx / JOY_MAX;
        joystick.dy = dy / JOY_MAX;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    function endJoystick(e) {
        joystick.active = false;
        joystick.dx = joystick.dy = 0;
        joyEl.classList.remove("active");
        knob.style.transform = "translate(-50%, -50%)";
    }
    joyEl.addEventListener("pointerup", endJoystick);
    joyEl.addEventListener("pointercancel", endJoystick);

    // ─── Raycaster 點建築 + hover outline
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pickBuilding(clientX, clientY) {
        const joyRect = joyEl.getBoundingClientRect();
        if (clientX >= joyRect.left && clientX <= joyRect.right &&
            clientY >= joyRect.top && clientY <= joyRect.bottom) return null;
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(buildingMeshes);
        return intersects.length > 0 ? intersects[0].object : null;
    }
    canvas.addEventListener("pointerdown", e => {
        const hit = pickBuilding(e.clientX, e.clientY);
        if (hit) {
            outlinePass.selectedObjects = [hit];
            setTimeout(() => openModal(hit.userData.key), 350); // 先 outline 0.35s 再開 modal
        }
    });
    // hover (僅 desktop, 加 outline 預覽)
    canvas.addEventListener("pointermove", e => {
        if (e.pointerType === 'touch') return;
        const hit = pickBuilding(e.clientX, e.clientY);
        outlinePass.selectedObjects = hit ? [hit] : [];
    });

    function openModal(key) {
        const opts = POPUPS[key];
        if (!opts) return;
        document.getElementById("demo-modal-icon").textContent = opts.icon;
        document.getElementById("demo-modal-title").textContent = opts.title;
        document.getElementById("demo-modal-body").innerHTML = opts.body;
        document.getElementById("demo-modal").classList.add("show");
    }
    function clearOutline() { outlinePass.selectedObjects = []; }
    document.getElementById("demo-modal-close").addEventListener("click", () => {
        document.getElementById("demo-modal").classList.remove("show");
        clearOutline();
    });
    document.getElementById("demo-modal").addEventListener("click", e => {
        if (e.target.id === "demo-modal") {
            e.target.classList.remove("show");
            clearOutline();
        }
    });

    // ─── 玩家移動（4 方向位移，玩家轉向只看 model rotation 不影響相機）
    let walkPhase = 0;
    function updatePlayer() {
        let dx = 0, dz = 0;
        if (keys.up)    dz -= 1;  // 北
        if (keys.down)  dz += 1;  // 南
        if (keys.left)  dx -= 1;  // 西
        if (keys.right) dx += 1;  // 東

        if (joystick.active) {
            dx += joystick.dx;
            dz += joystick.dy;
        }

        const moving = dx !== 0 || dz !== 0;
        if (moving) {
            const len = Math.hypot(dx, dz);
            const stepX = dx / len * PLAYER_SPEED;
            const stepZ = dz / len * PLAYER_SPEED;
            const nx = player.position.x + stepX;
            const nz = player.position.z + stepZ;
            const BOUND = 55;
            if (nx > -BOUND && nx < BOUND) player.position.x = nx;
            if (nz > -BOUND && nz < BOUND) player.position.z = nz;
            playerRot = Math.atan2(stepX, stepZ);
            player.rotation.y = playerRot;
            // chibi 走路：手腳前後擺動 + 全身上下小跳
            walkPhase += 0.28;
            const armSwing = Math.sin(walkPhase) * 0.7;
            const legSwing = Math.sin(walkPhase) * 0.55;
            chibi.leftArm.rotation.x  = armSwing;
            chibi.rightArm.rotation.x = -armSwing;
            chibi.leftLeg.rotation.x  = -legSwing;
            chibi.rightLeg.rotation.x = legSwing;
            player.position.y = 2 + Math.abs(Math.sin(walkPhase)) * 0.15;
        } else {
            // idle: 手腳回 0 + 頭微擺呼吸
            chibi.leftArm.rotation.x  *= 0.85;
            chibi.rightArm.rotation.x *= 0.85;
            chibi.leftLeg.rotation.x  *= 0.85;
            chibi.rightLeg.rotation.x *= 0.85;
            player.position.y += (2 - player.position.y) * 0.2;
            // 頭微擺
            chibi.head.position.y = 2.55 + Math.sin(Date.now() * 0.003) * 0.04;
        }
    }

    function updateCamera() {
        // 固定相機俯角，只 follow 玩家 position（不跟玩家旋轉 = 世界不轉 = 不暈）
        const CAM_OFFSET_X = 0;
        const CAM_OFFSET_Y = 22;
        const CAM_OFFSET_Z = 22;
        const targetCamPos = new THREE.Vector3(
            player.position.x + CAM_OFFSET_X,
            CAM_OFFSET_Y,
            player.position.z + CAM_OFFSET_Z
        );
        camera.position.lerp(targetCamPos, 0.12);
        camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
    }

    // ─── Phase 3d: EffectComposer + UnrealBloomPass (光暈/電影感)
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Phase 3g: Outline pass (點建築亮邊框)
    const outlinePass = new OutlinePass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        scene, camera
    );
    outlinePass.edgeStrength = 4.0;
    outlinePass.edgeGlow = 1.2;
    outlinePass.edgeThickness = 2.5;
    outlinePass.pulsePeriod = 1.8;
    outlinePass.visibleEdgeColor.set('#ffeb3b');  // 黃色
    outlinePass.hiddenEdgeColor.set('#ff6f00');   // 橘色（被遮擋部分）
    composer.addPass(outlinePass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.55,  // strength
        0.45,  // radius
        0.82   // threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // ─── 渲染循環
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        if (mixer) mixer.update(dt);
        updatePlayer();
        updateCamera();
        // 雲飄
        clouds.forEach(c => {
            c.mesh.position.x += c.speed;
            if (c.mesh.position.x > 110) c.mesh.position.x = -110;
        });
        // 飛鳥圓形軌道
        birds.forEach(b => {
            b.phase += 0.004 * b.speed;
            b.mesh.position.x = Math.cos(b.phase) * b.radius;
            b.mesh.position.z = Math.sin(b.phase) * b.radius;
            b.mesh.position.y = b.height + Math.sin(b.phase * 2) * 2;
            b.mesh.rotation.y = -b.phase + Math.PI / 2;
            b.mixer.update(dt);
        });
        // 5 個科目島自己的小動畫
        islandAnimUpdaters.forEach(fn => fn(dt));
        // 寵物跟隨玩家 (lerp 在玩家後方右側 + 自身擺尾)
        const petTargetX = player.position.x + Math.sin(playerRot + Math.PI) * 2.5 + Math.cos(playerRot) * 1.5;
        const petTargetZ = player.position.z + Math.cos(playerRot + Math.PI) * 2.5 - Math.sin(playerRot) * 1.5;
        pet.group.position.x += (petTargetX - pet.group.position.x) * 0.08;
        pet.group.position.z += (petTargetZ - pet.group.position.z) * 0.08;
        pet.group.position.y = 0.5 + Math.abs(Math.sin(Date.now() * 0.006)) * 0.1;  // 上下小跳
        // 寵物面向玩家
        const dxp = player.position.x - pet.group.position.x;
        const dzp = player.position.z - pet.group.position.z;
        pet.group.rotation.y = Math.atan2(dxp, dzp);
        // 尾巴搖
        pet.tail.rotation.z = Math.sin(Date.now() * 0.012) * 0.5;
        composer.render();
    }
    animate();

    // ─── 視窗 resize
    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
})();
