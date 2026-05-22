/**
 * 3D 探索地圖 — Three.js Phase 1 POC
 *
 * 內容：
 * - 1 個 plane 草地（綠色）
 * - 12 個 cube 建築（不同顏色 + label）
 * - 1 個 capsule 玩家（藍色）
 * - 第三人稱相機跟拍
 * - WASD 鍵盤 / 手機左下虛擬搖桿走動
 * - Raycaster 點 cube → 開 modal
 *
 * Phase 2 會把 cube 換成 chibi 建築 GLTF model，capsule 換成 chibi 角色含 walk animation。
 */
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);  // 天藍色背景
    scene.fog = new THREE.Fog(0x87ceeb, 60, 200);

    const camera = new THREE.PerspectiveCamera(
        50, window.innerWidth / window.innerHeight, 0.1, 500
    );

    // ─── 光源
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(50, 100, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // ─── 地形 plane（草地）
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x7cb342 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ─── Phase 2: 12 建築用 Three.js primitives 組合出各自獨特外觀
    const buildingMeshes = [];
    BUILDINGS.forEach(b => {
        const group = makeBuilding(b.key, b.h);
        group.position.set(b.x, 0, b.z);
        group.userData.key = b.key;
        scene.add(group);
        // hitbox 用個透明 box 包整體（raycaster 用），實際視覺是 group 內 primitives
        const hitbox = new THREE.Mesh(
            new THREE.BoxGeometry(8, b.h + 2, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitbox.position.set(b.x, (b.h + 2) / 2, b.z);
        hitbox.userData.key = b.key;
        scene.add(hitbox);
        buildingMeshes.push(hitbox);

        // 上方浮 label sprite
        const opts = POPUPS[b.key];
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext("2d");
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        roundRect(ctx, 0, 0, 256, 64, 12);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(opts.icon + " " + opts.title, 128, 32);
        const texture = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const label = new THREE.Sprite(labelMat);
        label.position.set(b.x, b.h + 4, b.z);
        label.scale.set(8, 2, 1);
        scene.add(label);
    });

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

    // ─── 玩家 capsule（藍色，站在地圖中央）
    const playerGeo = new THREE.CapsuleGeometry(1, 2, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x3498db });
    const player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 2, 0);
    player.castShadow = true;
    scene.add(player);

    // 玩家頭部（黃色球，表示朝向）
    const headGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfdc500 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.5, 0);
    head.castShadow = true;
    player.add(head);

    // 朝向指示器（前方紅色小方塊）
    const dirGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const dirMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const dirIndicator = new THREE.Mesh(dirGeo, dirMat);
    dirIndicator.position.set(0, 2, 1.5);
    player.add(dirIndicator);

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

    // ─── Raycaster 點建築
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    canvas.addEventListener("pointerdown", e => {
        // 排除搖桿區域
        const joyRect = joyEl.getBoundingClientRect();
        if (e.clientX >= joyRect.left && e.clientX <= joyRect.right &&
            e.clientY >= joyRect.top && e.clientY <= joyRect.bottom) return;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(buildingMeshes);
        if (intersects.length > 0) {
            const key = intersects[0].object.userData.key;
            openModal(key);
        }
    });

    function openModal(key) {
        const opts = POPUPS[key];
        if (!opts) return;
        document.getElementById("demo-modal-icon").textContent = opts.icon;
        document.getElementById("demo-modal-title").textContent = opts.title;
        document.getElementById("demo-modal-body").innerHTML = opts.body;
        document.getElementById("demo-modal").classList.add("show");
    }
    document.getElementById("demo-modal-close").addEventListener("click", () => {
        document.getElementById("demo-modal").classList.remove("show");
    });
    document.getElementById("demo-modal").addEventListener("click", e => {
        if (e.target.id === "demo-modal") e.target.classList.remove("show");
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
            // 玩家朝移動方向轉（只 model 視覺，相機不轉）
            playerRot = Math.atan2(stepX, stepZ);
            player.rotation.y = playerRot;
            // walk bobbing 上下小跳
            walkPhase += 0.35;
            player.position.y = 2 + Math.abs(Math.sin(walkPhase)) * 0.35;
        } else {
            // 靜止時 y 回 2 平滑
            player.position.y += (2 - player.position.y) * 0.2;
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

    // ─── 渲染循環
    function animate() {
        requestAnimationFrame(animate);
        updatePlayer();
        updateCamera();
        renderer.render(scene, camera);
    }
    animate();

    // ─── 視窗 resize
    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
})();
