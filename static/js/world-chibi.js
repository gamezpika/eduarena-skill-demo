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

    // ─── chibi 小學生
    const COLORS = {
        skin: 0xfdd9b0, hair: 0x2b1a0a, shirt: 0x3498db, pants: 0x34495e,
        shoes: 0x2c3e50, eye: 0x1a1a1a, mouth: 0xc0392b, cheek: 0xff7e90,
        hat: 0xc0392b, hatDark: 0x8b0000, backpack: 0xf39c12, strap: 0x2c3e50,
        glassFrame: 0x2c3e50,
    };

    const player = new THREE.Group();
    player.scale.set(4.0, 4.0, 4.0);
    scene.add(player);

    function makeChibiStudent() {
        const root = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18),
            new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.6 }));
        head.position.y = 2.55; root.add(head);

        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.98, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.8),
            new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.85 }));
        hair.position.y = 2.55; hair.rotation.x = -0.12; root.add(hair);

        const hatTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.92, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.3),
            new THREE.MeshStandardMaterial({ color: COLORS.hat, roughness: 0.7 }));
        hatTop.position.y = 2.85; root.add(hatTop);
        const hatBrim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16, 1, false, -Math.PI / 2.5, Math.PI / 1.25),
            new THREE.MeshStandardMaterial({ color: COLORS.hatDark, roughness: 0.7 }));
        hatBrim.position.set(0, 2.75, 0.45); root.add(hatBrim);

        [-0.32, 0.32].forEach(x => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20),
                new THREE.MeshStandardMaterial({ color: COLORS.glassFrame, metalness: 0.5, roughness: 0.3 }));
            ring.position.set(x, 2.55, 0.92); root.add(ring);
        });
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.glassFrame }));
        bridge.position.set(0, 2.55, 0.92); root.add(bridge);

        [-0.32, 0.32].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10),
                new THREE.MeshStandardMaterial({ color: COLORS.eye }));
            eye.position.set(x, 2.55, 0.83); root.add(eye);
            const shine = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }));
            shine.position.set(x + 0.05, 2.62, 0.97); root.add(shine);
        });

        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.mouth }));
        mouth.position.set(0, 2.2, 0.92); root.add(mouth);

        [-0.55, 0.55].forEach(x => {
            const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8),
                new THREE.MeshStandardMaterial({ color: COLORS.cheek, transparent: true, opacity: 0.55 }));
            cheek.position.set(x, 2.32, 0.78); cheek.scale.set(1, 0.6, 0.3); root.add(cheek);
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 0.65),
            new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.6 }));
        body.position.y = 1.15; root.add(body);

        const leftArm = new THREE.Group();
        leftArm.position.set(-0.7, 1.75, 0); root.add(leftArm);
        const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 1.3, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.65 }));
        leftArmMesh.position.y = -0.65; leftArm.add(leftArmMesh);
        const rightArm = new THREE.Group();
        rightArm.position.set(0.7, 1.75, 0); root.add(rightArm);
        rightArm.add(leftArmMesh.clone());

        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.28, 0.5, 0); root.add(leftLeg);
        const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 1.0, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.7 }));
        leftLegMesh.position.y = -0.5; leftLeg.add(leftLegMesh);
        const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.5),
            new THREE.MeshStandardMaterial({ color: COLORS.shoes, roughness: 0.7 }));
        leftShoe.position.set(0, -1.0, 0.07); leftLeg.add(leftShoe);
        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.28, 0.5, 0); root.add(rightLeg);
        rightLeg.add(leftLegMesh.clone()); rightLeg.add(leftShoe.clone());

        const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.4),
            new THREE.MeshStandardMaterial({ color: COLORS.backpack, roughness: 0.65 }));
        backpack.position.set(0, 1.25, -0.5); root.add(backpack);
        [-0.25, 0.25].forEach(x => {
            const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1),
                new THREE.MeshStandardMaterial({ color: COLORS.strap }));
            strap.position.set(x, 1.3, -0.35); root.add(strap);
        });

        root.position.y = -0.05;
        return { group: root, leftArm, rightArm, leftLeg, rightLeg, head };
    }

    const chibi = makeChibiStudent();
    player.add(chibi.group);

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
    let DEBUG_POLYGON = true;  // 預設開，派派看完可 console eduChibi.toggleDebug() 關

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
            player.rotation.y = Math.atan2(dx, dy);

            walkPhase += 0.22;
            chibi.leftArm.rotation.x = Math.sin(walkPhase) * 0.6;
            chibi.rightArm.rotation.x = -Math.sin(walkPhase) * 0.6;
            chibi.leftLeg.rotation.x = -Math.sin(walkPhase) * 0.55;
            chibi.rightLeg.rotation.x = Math.sin(walkPhase) * 0.55;
            chibi.group.position.y = -0.05 + Math.abs(Math.sin(walkPhase)) * 0.08;
            chibi.head.rotation.z = Math.sin(walkPhase * 0.5) * 0.06;
        } else {
            chibi.leftArm.rotation.x *= 0.85;
            chibi.rightArm.rotation.x *= 0.85;
            chibi.leftLeg.rotation.x *= 0.85;
            chibi.rightLeg.rotation.x *= 0.85;
            chibi.group.position.y = -0.05 + Math.sin(Date.now() * 0.003) * 0.03;
        }

        player.position.x = px;
        player.position.z = py;
        renderer.render(scene, camera);
    }
    loop();

    // ─── Debug
    window.eduChibi = {
        player, chibi, scene, camera,
        get pos() { return { x: px, y: py }; },
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
