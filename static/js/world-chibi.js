/**
 * world.html chibi 小學生 Three.js 渲染 + JSON config 驅動互動
 *
 * Config: assets/world_map_config.json (12 buildings + bbox + interaction_type)
 *
 * 功能：
 * - Three.js primitives chibi 小學生（藍 polo + 橘書包 + 紅帽 + 眼鏡）
 * - 鍵盤/搖桿自由走 OR 點 hotspot 自動走過去（直線 lerp）
 * - bbox 當建築擋區，chibi 不能穿牆
 * - 到達 building 時依 interaction_type 開 demo modal
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

(function () {
    "use strict";

    const canvas = document.getElementById('wd-chibi-canvas');
    if (!canvas) return;
    const world = document.getElementById('wd-world');
    if (!world) return;

    // ─── 場景座標系：0..1 (normalized) × dim ratio
    // iso 地圖 1:1 正方形 → SCENE_W = SCENE_H = 100（同比例避免縱向壓縮錯位）
    const SCENE_W = 100;
    const SCENE_H = 100;

    const renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: true, premultipliedAlpha: false
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();

    // 斜俯瞰 55°
    const camera = new THREE.OrthographicCamera(
        -SCENE_W / 2, SCENE_W / 2,
        SCENE_H / 2, -SCENE_H / 2,
        -500, 500
    );
    camera.position.set(0, 80, 60);
    camera.lookAt(0, 0, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(20, 50, 30);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const fillLight = new THREE.DirectionalLight(0xffe5b0, 0.3);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    // ─── chibi 小學生（5/25 派派 B 方案：對齊 hero_iso_sword.png 樣式）
    // 白 T + 卡其短褲 + 白鞋 + 棕髮 + 拿銀色劍（拿掉紅帽/眼鏡/書包）
    const COLORS = {
        skin: 0xfdd9b0, hair: 0x6b4226, shirt: 0xf5f5f5, pants: 0xc4a373,
        shoes: 0xffffff, eye: 0x1a3a5a, mouth: 0xc0392b, cheek: 0xff7e90,
        bladeMetal: 0xd8dde6, swordGuard: 0xb8923a, swordHandle: 0x5a3a1a,
    };

    const player = new THREE.Group();
    player.scale.set(4.0, 4.0, 4.0);
    scene.add(player);

    function makeChibiStudent() {
        const root = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18),
            new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.6 }));
        head.position.y = 2.55; root.add(head);

        // 棕色蓬鬆頭髮 — 主半球 + 小撮髮絲讓更蓬
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(1.02, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.7),
            new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.85 }));
        hair.position.y = 2.55; hair.rotation.x = -0.18; root.add(hair);
        // 額前一撮髮
        [-0.4, 0.1, 0.45].forEach((x, i) => {
            const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
                new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.85 }));
            tuft.position.set(x, 2.95 + (i === 1 ? 0.05 : 0), 0.7 + (i % 2) * 0.1);
            tuft.scale.set(1, 0.7, 0.7);
            root.add(tuft);
        });

        // 大眼睛（藍色虹膜，比之前黑眼大一圈）
        [-0.32, 0.32].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12),
                new THREE.MeshStandardMaterial({ color: COLORS.eye }));
            eye.position.set(x, 2.55, 0.82); root.add(eye);
            const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8),
                new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7 }));
            shine.position.set(x + 0.06, 2.62, 0.96); root.add(shine);
        });

        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.mouth }));
        mouth.position.set(0, 2.22, 0.92); root.add(mouth);

        // 淡腮紅
        [-0.55, 0.55].forEach(x => {
            const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8),
                new THREE.MeshStandardMaterial({ color: COLORS.cheek, transparent: true, opacity: 0.45 }));
            cheek.position.set(x, 2.32, 0.78); cheek.scale.set(1, 0.6, 0.3); root.add(cheek);
        });

        // 白 T 恤
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 0.65),
            new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.6 }));
        body.position.y = 1.15; root.add(body);

        // 左手（沒拿東西，下垂）
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.7, 1.75, 0); root.add(leftArm);
        const armMaterial = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.65 });
        const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 1.3, 10), armMaterial);
        leftArmMesh.position.y = -0.65; leftArm.add(leftArmMesh);

        // 右手（拿劍，所以位置稍微往前 + 略抬起）
        const rightArm = new THREE.Group();
        rightArm.position.set(0.7, 1.75, 0); root.add(rightArm);
        rightArm.add(leftArmMesh.clone());

        // 右手拿的劍 — 棕色握把 + 金色護手 + 銀色劍刃，從手掌位置向上指
        const sword = new THREE.Group();
        sword.position.set(0, -1.25, 0.35);    // 右手末端外側
        sword.rotation.x = -0.4;                // 略往前傾顯擺式
        // 握把
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16),
            new THREE.MeshStandardMaterial({ color: COLORS.swordHandle, roughness: 0.75 }));
        handle.position.y = 0; sword.add(handle);
        // 護手（十字格）
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.18),
            new THREE.MeshStandardMaterial({ color: COLORS.swordGuard, metalness: 0.7, roughness: 0.25 }));
        guard.position.y = 0.26; sword.add(guard);
        // 劍刃（銀色，光滑反光）
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 0.05),
            new THREE.MeshStandardMaterial({
                color: COLORS.bladeMetal, metalness: 0.85, roughness: 0.15,
                emissive: 0x3a4555, emissiveIntensity: 0.15
            }));
        blade.position.y = 1.15; sword.add(blade);
        // 劍尖（三角）
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.25, 4),
            new THREE.MeshStandardMaterial({ color: COLORS.bladeMetal, metalness: 0.85, roughness: 0.15 }));
        tip.position.y = 2.10; sword.add(tip);
        rightArm.add(sword);

        // 腳 — 上半段卡其短褲 + 下半段膚色小腿 + 白鞋
        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.28, 0.5, 0); root.add(leftLeg);
        const pantsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.45, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.75 }));
        pantsMesh.position.y = -0.225; leftLeg.add(pantsMesh);
        const calfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.55, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.65 }));
        calfMesh.position.y = -0.725; leftLeg.add(calfMesh);
        const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.5),
            new THREE.MeshStandardMaterial({ color: COLORS.shoes, roughness: 0.55 }));
        leftShoe.position.set(0, -1.0, 0.07); leftLeg.add(leftShoe);

        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.28, 0.5, 0); root.add(rightLeg);
        rightLeg.add(pantsMesh.clone());
        rightLeg.add(calfMesh.clone());
        rightLeg.add(leftShoe.clone());

        root.position.y = -0.05;
        return { group: root, leftArm, rightArm, leftLeg, rightLeg, head };
    }

    // 5/27 派派：hero_walk.png sprite billboard 取代 mei.glb
    // sprite sheet 5×5 grid，25 幀 walk cycle，每幀 694×1154
    const HERO_FRAMES = 25;
    const HERO_COLS = 5;
    const HERO_ROWS = 5;
    const HERO_FPS = 12;             // walk 動畫每秒 12 幀
    const FRAME_W = 1 / HERO_COLS;   // 0.2
    const FRAME_H = 1 / HERO_ROWS;   // 0.2

    const heroTexture = new THREE.TextureLoader().load('assets/images/arena/hero_walk.png');
    heroTexture.colorSpace = THREE.SRGBColorSpace;
    heroTexture.magFilter = THREE.LinearFilter;
    heroTexture.minFilter = THREE.LinearFilter;
    heroTexture.repeat.set(FRAME_W, FRAME_H);
    heroTexture.offset.set(0, 1 - FRAME_H);  // 從左上角第 1 幀開始（UV y 倒轉）

    const heroMaterial = new THREE.SpriteMaterial({
        map: heroTexture,
        transparent: true,
        depthTest: true,
        alphaTest: 0.05,
    });
    const heroSprite = new THREE.Sprite(heroMaterial);
    // 比例 694:1154 ≈ 0.6:1；player 還會 scale ×4，所以這裡用 sprite 高 4
    heroSprite.scale.set(2.4, 4.0, 1);
    heroSprite.position.y = 2.0;  // 中心對齊 chibi 視覺中心位置
    player.add(heroSprite);

    // 動畫狀態（update loop 用）
    let heroFrame = 0;
    let heroFrameAcc = 0;

    // 保留 primitives 物件（解構需要，但不加入 player）
    const chibi = makeChibiStudent();
    // 不 player.add(chibi.group) — sprite 取代

    // mei.glb 取代為 sprite，以下 GLB loader 變數保留為 null 避免 update loop 報錯
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
    gltfLoader.setDRACOLoader(dracoLoader);
    (async () => {
        try {
            const mod = await import('three/addons/libs/meshopt_decoder.module.js');
            gltfLoader.setMeshoptDecoder(mod.MeshoptDecoder);
        } catch (e) {
            console.warn('[chibi] MeshoptDecoder load fail');
        }
    })();
    const gltfModel = null;
    const gltfMixer = null;
    const gltfAction = null;
    const gltfClock = new THREE.Clock();

    // 5/25 派派：載 tree.glb 在 mapImg 各空地放分散樹（避開 polygon 建築）
    const _unprojVec = new THREE.Vector3();
    const _camDir = new THREE.Vector3();
    function mapNormToSceneCoord(nx, ny) {
        const ndcX = nx * 2 - 1;
        const ndcY = 1 - ny * 2;
        _unprojVec.set(ndcX, ndcY, 0);
        _unprojVec.unproject(camera);
        camera.getWorldDirection(_camDir);
        if (Math.abs(_camDir.y) > 1e-6) {
            const t = -_unprojVec.y / _camDir.y;
            _unprojVec.add(_camDir.clone().multiplyScalar(t));
        }
        return { x: _unprojVec.x, z: _unprojVec.z };
    }
    // 5/25 派派：tree 寫死 12 棵已搬到 mapConfig.objects[]（map-editor 編輯）
    // GLB cache（避免同一 GLB 重複下載）
    const _glbCache = new Map();
    function loadGLBOnce(filename) {
        if (_glbCache.has(filename)) return Promise.resolve(_glbCache.get(filename));
        return new Promise((res, rej) => {
            gltfLoader.load(
                'assets/3d/character/' + filename,
                (gltf) => { _glbCache.set(filename, gltf); res(gltf); },
                undefined,
                (err) => rej(err)
            );
        });
    }
    // 5/26 派派：follow:true 物件跟著玩家走（假 walk 動畫）
    const followers = [];  // [{model, baseY, phase, facing}]
    async function loadConfigObjects() {
        if (!mapConfig || !Array.isArray(mapConfig.objects) || mapConfig.objects.length === 0) {
            console.log('[chibi] no config objects');
            return;
        }
        let placed = 0;
        for (const obj of mapConfig.objects) {
            try {
                const gltf = await loadGLBOnce(obj.glb);
                const model = gltf.scene.clone();
                const bbox = new THREE.Box3().setFromObject(model);
                const h = bbox.max.y - bbox.min.y;
                const baseScale = 8 / Math.max(h, 0.001);
                model.scale.setScalar(baseScale * (obj.scale || 1));
                const { x, z } = mapNormToSceneCoord(obj.x, obj.y);
                const bbox2 = new THREE.Box3().setFromObject(model);
                const baseY = -bbox2.min.y;
                model.position.set(x, baseY, z);
                model.rotation.y = obj.rotation || 0;
                scene.add(model);
                if (obj.follow) {
                    followers.push({ model, baseY, phase: 0, facing: obj.rotation || 0 });
                }
                placed++;
            } catch (e) {
                console.warn('[chibi] obj load failed:', obj, e);
            }
        }
        console.log('[chibi] loaded', placed, '/', mapConfig.objects.length, 'config objects (', followers.length, 'follower(s))');
    }

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.04;
    shadow.scale.set(1.2, 0.55, 1);
    player.add(shadow);

    // ─── 場景座標 ↔ normalized (0..1) 換算
    // scene: -SCENE_W/2 .. +SCENE_W/2  X 軸；-SCENE_H/2 .. +SCENE_H/2  Z 軸
    function sceneToNorm(sceneX, sceneZ) {
        return {
            nx: (sceneX + SCENE_W / 2) / SCENE_W,
            ny: (sceneZ + SCENE_H / 2) / SCENE_H,
        };
    }
    function normToScene(nx, ny) {
        return {
            x: nx * SCENE_W - SCENE_W / 2,
            z: ny * SCENE_H - SCENE_H / 2,
        };
    }

    // ─── 玩家位置（場景座標）
    let px = 0;
    let py = -SCENE_H * 0.20;  // 偏上一點，避開頂部建築初始位置
    player.position.set(px, 0, py);

    // ─── Polygon SVG overlay (DOM 層，跟 mapImg 100% 對齊)
    const polygonSvg = document.getElementById('wd-polygon-svg');
    function renderPolygonDebug() {
        if (!polygonSvg) return;
        polygonSvg.innerHTML = '';
        if (!mapConfig || !DEBUG_POLYGON) return;
        mapConfig.buildings.forEach(b => {
            if (!b.polygon || b.polygon.length < 3) return;
            const pts = b.polygon.map(p => `${p.x},${p.y}`).join(' ');
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', pts);
            poly.setAttribute('fill', 'rgba(255,32,80,0.40)');
            poly.setAttribute('stroke', '#ff0040');
            poly.setAttribute('stroke-width', '0.004');
            polygonSvg.appendChild(poly);
        });
    }
    let DEBUG_POLYGON = false;  // 預設關，console eduChibi.toggleDebug() 可開

    // ─── 載入 world_map_config.json
    let mapConfig = null;
    let buildingsByKey = {};  // key (e.g. 'chinese') → building obj
    fetch('assets/world_map_config.json?v=' + Date.now())
        .then(r => r.json())
        .then(json => {
            mapConfig = json.map_config;
            mapConfig.buildings.forEach(b => {
                // 索引：id 全名 + 短 key (data-tap 用)
                buildingsByKey[b.id] = b;
                const shortKey = b.id.replace(/_island$|_tower$|_castle$|_center$|_arena$|_board$/, '');
                buildingsByKey[shortKey] = b;
            });
            renderPolygonDebug();
            console.log('[chibi] map config loaded:', mapConfig.buildings.length, 'buildings (polygon 紅框已顯示)');
            // 5/25 派派：載 mapConfig.objects[] 上的 3D 物件
            loadConfigObjects();

            // 接 hotspot click → chibi 自動走過去
            document.querySelectorAll('.wd-sprite[data-tap]').forEach(btn => {
                btn.addEventListener('click', e => {
                    const key = btn.dataset.tap;
                    const b = buildingsByKey[key];
                    if (b) {
                        e.preventDefault();
                        e.stopPropagation();
                        startAutoMove(b);
                    }
                });
            });

            // 若初始位置在 bbox 內，搜尋外移
            if (!isWalkable(px, py)) {
                console.warn('[chibi] initial inside bbox, searching escape…');
                for (let r = 2; r < 50; r += 1) {
                    for (let a = 0; a < 16; a++) {
                        const ang = (a / 16) * Math.PI * 2;
                        const tx = px + Math.cos(ang) * r;
                        const ty = py + Math.sin(ang) * r;
                        if (isWalkable(tx, ty)) {
                            px = tx; py = ty;
                            player.position.set(px, 0, py);
                            console.log(`[chibi] escaped to (${tx.toFixed(1)}, ${ty.toFixed(1)})`);
                            return;
                        }
                    }
                }
            }
        })
        .catch(e => console.warn('[chibi] config load failed:', e));

    // ─── Polygon 點包含判斷（ray casting 演算法）
    function pointInPolygon(px, py, polygon) {
        let inside = false;
        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // ─── 把 scene 座標投影到「畫面 normalized」(跟 mapImg / polygon SVG 同座標系)
    // 用 Three.js camera.project() 把 3D 點轉成 NDC，再換算 [0..1]
    const _projVec = new THREE.Vector3();
    function sceneToScreenNorm(sceneX, sceneZ) {
        _projVec.set(sceneX, 0, sceneZ);
        _projVec.project(camera);  // → NDC [-1, 1]
        return {
            nx: (_projVec.x + 1) / 2,
            ny: (-_projVec.y + 1) / 2,  // NDC Y 翻轉（top = +1 NDC = 0 screen）
        };
    }

    // ─── 擋區判斷：用 chibi 在「畫面 normalized」對 polygon 判斷
    function isWalkable(sceneX, sceneZ) {
        if (!mapConfig) return true;
        const { nx, ny } = sceneToScreenNorm(sceneX, sceneZ);
        // 畫面邊界
        if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) return false;
        for (const b of mapConfig.buildings) {
            const poly = b.polygon;
            if (!poly || poly.length < 3) continue;
            if (pointInPolygon(nx, ny, poly)) return false;
        }
        return true;
    }

    // ─── 點建築 → chibi 自動走過去（依 path waypoints 走，沒 path 就直線到 center）
    let autoTarget = null;  // { building, waypoints: [{x,z},...], idx }
    function startAutoMove(building) {
        let waypoints;
        if (building.path && building.path.length > 0) {
            waypoints = building.path.map(p => normToScene(p.x, p.y));
            console.log(`[chibi] auto-move → ${building.name} via ${waypoints.length} waypoints`);
        } else {
            waypoints = [normToScene(building.center.x, building.center.y)];
            console.log(`[chibi] auto-move → ${building.name} (direct center)`);
        }
        autoTarget = { building, waypoints, idx: 0 };
    }

    // ─── 到達 building 後依 interaction_type 開 demo modal
    function onArrive(building) {
        const modal = document.getElementById('demo-modal');
        const icon = document.getElementById('demo-modal-icon');
        const title = document.getElementById('demo-modal-title');
        const body = document.getElementById('demo-modal-body');
        if (!modal || !icon || !title || !body) return;

        const ICON_MAP = {
            education_chinese: '📖', education_english: '🔤', education_math: '🔢',
            education_science: '🔬', education_social: '🌏', combat_pve: '🏰',
            combat_pvp: '⚔️', commerce: '🏪', examination: '🎓', culture: '🏛',
            agriculture: '🐄', quest_board: '📋',
        };
        const TYPE_LABEL = {
            navigation: '進入',
            open_modal: '查看',
            trigger_event: '挑戰',
        };
        icon.textContent = ICON_MAP[building.category] || '✨';
        title.textContent = building.name;
        body.innerHTML = `
            <div style="font-size: 14px; color: #6a5a4a; line-height: 1.6;">
                <div>類別：<b>${building.category}</b></div>
                <div>互動：<b>${TYPE_LABEL[building.interaction_type]}（${building.interaction_type}）</b></div>
                <div style="margin-top:10px;font-size:12px;color:#999;">JSON config 驅動：id=${building.id}</div>
            </div>
        `;
        modal.classList.add('show');
    }

    // ─── Resize
    function resize() {
        const w = world.clientWidth, h = world.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener('resize', resize);
    setTimeout(resize, 200);
    setTimeout(resize, 1000);

    // ─── 鍵盤
    const keys = {};
    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if (['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    // ─── 搖桿
    const joystick = document.getElementById('wd-joystick');
    const joystickKnob = document.getElementById('wd-joystick-knob');
    let stickVec = { x: 0, y: 0 }, stickActive = false, stickTouchId = null;
    function setKnob(dx, dy) {
        const max = 32, len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        stickVec.x = dx / max; stickVec.y = dy / max;
    }
    if (joystick) {
        joystick.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            stickTouchId = t.identifier; stickActive = true;
            joystick.classList.add('active');
            const rect = joystick.getBoundingClientRect();
            setKnob(t.clientX - rect.left - rect.width/2, t.clientY - rect.top - rect.height/2);
        }, { passive: false });
        joystick.addEventListener('touchmove', e => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (t.identifier !== stickTouchId) continue;
                const rect = joystick.getBoundingClientRect();
                setKnob(t.clientX - rect.left - rect.width/2, t.clientY - rect.top - rect.height/2);
            }
        }, { passive: false });
        joystick.addEventListener('touchend', e => {
            for (const t of e.changedTouches) {
                if (t.identifier !== stickTouchId) continue;
                stickActive = false; stickTouchId = null;
                joystick.classList.remove('active');
                setKnob(0, 0); stickVec.x = stickVec.y = 0;
            }
        });
    }

    // ─── Game loop
    const SPEED = 0.5;
    const HALF_W = SCENE_W / 2, HALF_H = SCENE_H / 2;
    const ARRIVE_DIST = 4.0;  // 距離 building.center < 4 = 到達
    let walkPhase = 0;
    let _isMoving = false;  // 5/25 派派：給 world.js 鏡頭跟隨用

    function loop() {
        requestAnimationFrame(loop);
        let dx = 0, dy = 0;

        // 1. 玩家手動輸入優先
        if (keys['arrowup'] || keys['w']) dy -= 1;
        if (keys['arrowdown'] || keys['s']) dy += 1;
        if (keys['arrowleft'] || keys['a']) dx -= 1;
        if (keys['arrowright'] || keys['d']) dx += 1;
        if (stickActive) { dx = stickVec.x; dy = stickVec.y; }
        const manualInput = Math.hypot(dx, dy) > 0.05;
        if (manualInput) autoTarget = null;  // 手動輸入取消 auto-move

        // 2. Auto-move 朝目前 waypoint lerp，到達一個 waypoint 自動切下一個
        if (!manualInput && autoTarget) {
            const wp = autoTarget.waypoints[autoTarget.idx];
            const ddx = wp.x - px;
            const ddy = wp.z - py;
            const dist = Math.hypot(ddx, ddy);
            if (dist < ARRIVE_DIST) {
                autoTarget.idx++;
                if (autoTarget.idx >= autoTarget.waypoints.length) {
                    // 全部 waypoints 走完
                    const arrived = autoTarget.building;
                    autoTarget = null;
                    onArrive(arrived);
                }
                // 還有下一個 waypoint → 下一 frame 繼續朝它走
            } else {
                dx = ddx / dist;
                dy = ddy / dist;
            }
        }

        const moveLen = Math.hypot(dx, dy);
        const isMoving = moveLen > 0.05;
        _isMoving = isMoving;

        if (isMoving) {
            const norm = Math.max(moveLen, 1);
            dx /= norm; dy /= norm;
            const stepX = dx * SPEED, stepY = dy * SPEED;
            const tryX = px + stepX, tryY = py + stepY;
            if (isWalkable(tryX, tryY)) {
                px = tryX; py = tryY;
            } else if (isWalkable(tryX, py)) {
                px = tryX;
            } else if (isWalkable(px, tryY)) {
                py = tryY;
            } else if (autoTarget) {
                // auto-move 撞牆停 → 跳下一個 waypoint（避免卡死）
                autoTarget.idx++;
                if (autoTarget.idx >= autoTarget.waypoints.length) {
                    const arrived = autoTarget.building;
                    autoTarget = null;
                    onArrive(arrived);
                }
            }
            px = Math.max(-HALF_W + 3, Math.min(HALF_W - 3, px));
            py = Math.max(-HALF_H + 5, Math.min(HALF_H - 5, py));
            // sprite billboard 永遠面對相機，不需要 player.rotation.y（但保留給 chibi/glb fallback）
            player.rotation.y = Math.atan2(dx, dy);

            walkPhase += 0.22;
            // 5/27 派派：hero sprite walk cycle 25 幀 — 按 wall clock 推進，跟移動速度脫鉤
            heroFrameAcc += 1 / 60;  // 估算每禎 ~16ms（用 requestAnimationFrame 平均）
            const FRAME_DUR = 1 / HERO_FPS;
            while (heroFrameAcc >= FRAME_DUR) {
                heroFrameAcc -= FRAME_DUR;
                heroFrame = (heroFrame + 1) % HERO_FRAMES;
            }
            const col = heroFrame % HERO_COLS;
            const row = Math.floor(heroFrame / HERO_COLS);
            heroTexture.offset.x = col * FRAME_W;
            heroTexture.offset.y = 1 - (row + 1) * FRAME_H;  // UV y 倒轉
        } else {
            // 5/27 派派：靜止 → idle 幀（frame 0）
            heroFrame = 0;
            heroFrameAcc = 0;
            heroTexture.offset.x = 0;
            heroTexture.offset.y = 1 - FRAME_H;
        }
        // 5/25 派派：跑 GLB 自帶骨骼動畫
        if (gltfMixer) gltfMixer.update(gltfClock.getDelta());
        // 5/25 派派：靜止時整個身體後仰 ~20°，給俯瞰鏡頭看到正面/臉
        if (gltfModel) {
            const targetTiltX = isMoving ? 0 : -0.95;
            gltfModel.rotation.x += (targetTiltX - gltfModel.rotation.x) * 0.06;
        }

        player.position.x = px;
        player.position.z = py;

        // 5/26 派派：followers 跟玩家走 + 假 walk 動畫
        if (followers.length > 0) updateFollowers();

        renderer.render(scene, camera);
    }

    // 5/26 派派：follower 跟玩家邏輯
    const FOLLOW_DIST = 5.5;        // 距離 < 這個值停下（不要太黏）
    const FOLLOW_SPEED = SPEED * 0.92;  // 比玩家稍慢一點，自然拖在後
    function updateFollowers() {
        for (const f of followers) {
            const fx = f.model.position.x, fz = f.model.position.z;
            const ddx = px - fx, ddz = py - fz;
            const dist = Math.hypot(ddx, ddz);
            const moving = dist > FOLLOW_DIST;
            if (moving) {
                const dirX = ddx / dist, dirZ = ddz / dist;
                let nx = fx + dirX * FOLLOW_SPEED;
                let nz = fz + dirZ * FOLLOW_SPEED;
                // 撞牆滑行
                if (isWalkable(nx, nz)) { f.model.position.x = nx; f.model.position.z = nz; }
                else if (isWalkable(nx, fz)) { f.model.position.x = nx; }
                else if (isWalkable(fx, nz)) { f.model.position.z = nz; }
                // 朝向（lerp 平滑）
                const targetFacing = Math.atan2(dirX, dirZ);
                let diff = targetFacing - f.facing;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                f.facing += diff * 0.18;
                f.model.rotation.y = f.facing;
                // 假 walk：上下彈跳 + 左右晃身體
                f.phase += 0.32;
                f.model.position.y = f.baseY + Math.abs(Math.sin(f.phase)) * 0.55;
                f.model.rotation.z = Math.sin(f.phase) * 0.08;
            } else {
                // 停下：彈跳衰減、身體擺正、呼吸感
                f.model.rotation.z *= 0.85;
                f.model.position.y = f.baseY + Math.sin(Date.now() * 0.003) * 0.08;
            }
        }
    }

    loop();

    // ─── Debug
    window.eduChibi = {
        player, chibi, scene, camera,
        get pos() { return { x: px, y: py }; },
        // 5/25 派派：給 world.js 鏡頭跟隨用 — chibi 在 mapImg 上的 normalized 0..1
        getMapNorm() { return sceneToScreenNorm(px, py); },
        // 玩家是否正在移動（鍵盤 / 搖桿 / auto-move）
        get isMoving() { return _isMoving; },
        get config() { return mapConfig; },
        check(x, y) { return isWalkable(x ?? px, y ?? py); },
        goto(key) {
            const b = buildingsByKey[key];
            if (b) startAutoMove(b);
            else console.warn('unknown building:', key);
        },
        toggleDebug() {
            DEBUG_POLYGON = !DEBUG_POLYGON;
            renderPolygonDebug();
            console.log('[chibi] polygon debug:', DEBUG_POLYGON);
        },
    };
    console.log('[chibi] init. debug: eduChibi.pos / .config / .goto("shop") / .toggleDebug()');
})();
