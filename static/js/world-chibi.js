/**
 * world.html chibi 小學生 Three.js 渲染
 *
 * Canvas 蓋在 .wd-world 上方、跟著地圖 transform 一起捲動。
 * primitives 拼 chibi 學生（藍 polo + 橘書包 + 紅帽 + 眼鏡），
 * 鍵盤 ↑↓←→ / WASD / 搖桿 自由走，邊界 clamp 在 canvas 內。
 *
 * 設計關鍵：
 * - OrthographicCamera 斜俯瞰 60° → chibi 看起來像站在地圖上
 * - chibi 在 canvas 內部世界座標 (sceneW × sceneH)，跟 .wd-world transform 解耦
 * - canvas alpha:true 透明背景，不擋地圖
 * - pointer-events:none 不擋 hotspot click
 */
import * as THREE from 'three';

(function () {
    "use strict";

    const canvas = document.getElementById('wd-chibi-canvas');
    if (!canvas) return;

    const world = document.getElementById('wd-world');
    if (!world) return;

    // ─── 場景座標系：用 100 × 200 worldUnits（寬 100、高 200，對應 .wd-world 9:18 比例）
    // chibi 在這座標系內走，OrthographicCamera 框住整個 100×200
    const SCENE_W = 100;
    const SCENE_H = 200;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);  // 完全透明

    const scene = new THREE.Scene();

    // OrthographicCamera 斜俯瞰 — 從 SCENE 右下方往左上看 60°
    // 視野固定框住整個場景
    const camera = new THREE.OrthographicCamera(
        -SCENE_W / 2, SCENE_W / 2,
        SCENE_H / 2, -SCENE_H / 2,
        -200, 500
    );
    // 純俯瞰（top-down 90°）— 跟地圖 2D 視角一致最不違和
    camera.position.set(0, 100, 0.01);
    camera.lookAt(0, 0, 0);

    // 燈光（基本三點打光，讓 primitives 有陰影層次）
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(20, 50, 30);
    scene.add(dirLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const fillLight = new THREE.DirectionalLight(0xffe5b0, 0.3);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    // ─── chibi 小學生（reuse EduArena 既有 student 色票）
    const COLORS = {
        skin:  0xfdd9b0,
        hair:  0x2b1a0a,
        shirt: 0x3498db,  // 藍 polo
        pants: 0x34495e,  // 深藍褲
        shoes: 0x2c3e50,
        eye:   0x1a1a1a,
        mouth: 0xc0392b,
        cheek: 0xff7e90,
        hat:   0xc0392b,  // 紅帽
        hatDark: 0x8b0000,
        backpack: 0xf39c12,  // 橘書包
        strap: 0x2c3e50,
        glassFrame: 0x2c3e50,
    };

    const player = new THREE.Group();
    player.scale.set(2.2, 2.2, 2.2);  // 放大適合 100×200 場景
    scene.add(player);

    function makeChibiStudent() {
        const root = new THREE.Group();

        // 頭 (chibi 大頭)
        const headMat = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.6 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18), headMat);
        head.position.y = 2.55;
        root.add(head);

        // 頭髮 (半球蓋頂)
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.98, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.8),
            new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.85 })
        );
        hair.position.y = 2.55;
        hair.rotation.x = -0.12;
        root.add(hair);

        // 紅棒球帽（半球 + 帽簷）
        const hatTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.92, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.3),
            new THREE.MeshStandardMaterial({ color: COLORS.hat, roughness: 0.7 })
        );
        hatTop.position.y = 2.85;
        root.add(hatTop);
        const hatBrim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16, 1, false, -Math.PI / 2.5, Math.PI / 1.25),
            new THREE.MeshStandardMaterial({ color: COLORS.hatDark, roughness: 0.7 })
        );
        hatBrim.position.set(0, 2.75, 0.45);
        root.add(hatBrim);

        // 眼鏡（兩個 Torus + Box bridge）
        [-0.32, 0.32].forEach(x => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.04, 8, 20),
                new THREE.MeshStandardMaterial({ color: COLORS.glassFrame, metalness: 0.5, roughness: 0.3 })
            );
            ring.position.set(x, 2.55, 0.92);
            root.add(ring);
        });
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.04, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.glassFrame })
        );
        bridge.position.set(0, 2.55, 0.92);
        root.add(bridge);

        // 眼睛（兩顆黑 chibi 大眼）+ 白色高光
        [-0.32, 0.32].forEach(x => {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 12, 10),
                new THREE.MeshStandardMaterial({ color: COLORS.eye })
            );
            eye.position.set(x, 2.55, 0.83);
            root.add(eye);
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })
            );
            shine.position.set(x + 0.05, 2.62, 0.97);
            root.add(shine);
        });

        // 嘴（小笑容）
        const mouth = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.05, 0.04),
            new THREE.MeshStandardMaterial({ color: COLORS.mouth })
        );
        mouth.position.set(0, 2.2, 0.92);
        root.add(mouth);

        // 紅腮（兩個半透明粉球）
        [-0.55, 0.55].forEach(x => {
            const cheek = new THREE.Mesh(
                new THREE.SphereGeometry(0.13, 10, 8),
                new THREE.MeshStandardMaterial({ color: COLORS.cheek, transparent: true, opacity: 0.55 })
            );
            cheek.position.set(x, 2.32, 0.78);
            cheek.scale.set(1, 0.6, 0.3);
            root.add(cheek);
        });

        // 身體（藍 polo）
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.15, 1.3, 0.65),
            new THREE.MeshStandardMaterial({ color: COLORS.shirt, roughness: 0.6 })
        );
        body.position.y = 1.15;
        root.add(body);

        // 左手 group（pivot 在肩）
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.7, 1.75, 0);
        root.add(leftArm);
        const leftArmMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.16, 1.3, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.65 })
        );
        leftArmMesh.position.y = -0.65;
        leftArm.add(leftArmMesh);

        // 右手 group
        const rightArm = new THREE.Group();
        rightArm.position.set(0.7, 1.75, 0);
        root.add(rightArm);
        rightArm.add(leftArmMesh.clone());

        // 左腿 group（pivot 在髖）
        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.28, 0.5, 0);
        root.add(leftLeg);
        const leftLegMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.2, 1.0, 10),
            new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.7 })
        );
        leftLegMesh.position.y = -0.5;
        leftLeg.add(leftLegMesh);
        const leftShoe = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.2, 0.5),
            new THREE.MeshStandardMaterial({ color: COLORS.shoes, roughness: 0.7 })
        );
        leftShoe.position.set(0, -1.0, 0.07);
        leftLeg.add(leftShoe);

        // 右腿 group
        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.28, 0.5, 0);
        root.add(rightLeg);
        rightLeg.add(leftLegMesh.clone());
        rightLeg.add(leftShoe.clone());

        // 橘書包（背後 + 兩條黑帶）
        const backpack = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 1.0, 0.4),
            new THREE.MeshStandardMaterial({ color: COLORS.backpack, roughness: 0.65 })
        );
        backpack.position.set(0, 1.25, -0.5);
        root.add(backpack);
        [-0.25, 0.25].forEach(x => {
            const strap = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 1.2, 0.1),
                new THREE.MeshStandardMaterial({ color: COLORS.strap })
            );
            strap.position.set(x, 1.3, -0.35);
            root.add(strap);
        });

        // 整體下移讓腳底 y=0
        root.position.y = -0.05;

        return { group: root, leftArm, rightArm, leftLeg, rightLeg, head };
    }

    const chibi = makeChibiStudent();
    player.add(chibi.group);

    // 假橢圓陰影（貼地）
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.04;
    shadow.scale.set(1.2, 0.55, 1);
    player.add(shadow);

    // ─── 玩家位置（場景座標 SCENE_W × SCENE_H 內）
    // 初始位置：中央偏下（草地走廊）
    let px = 0;
    let py = SCENE_H * 0.18;  // 場景下半部
    player.position.set(px, 0, py);

    // ─── Resize 處理（讓 canvas 解析度跟著 .wd-world 大小變）
    function resize() {
        const w = world.clientWidth;
        const h = world.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);  // false: 不改 CSS size
    }
    resize();
    window.addEventListener('resize', resize);
    // .wd-world 可能在初始化後尺寸才穩定，延遲再 resize 一次
    setTimeout(resize, 200);
    setTimeout(resize, 1000);

    // ─── 鍵盤輸入
    const keys = {};
    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    // ─── 觸控搖桿
    const joystick = document.getElementById('wd-joystick');
    const joystickKnob = document.getElementById('wd-joystick-knob');
    let stickVec = { x: 0, y: 0 };
    let stickActive = false;
    let stickTouchId = null;

    function setKnob(dx, dy) {
        const max = 32;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        stickVec.x = dx / max;
        stickVec.y = dy / max;
    }

    if (joystick) {
        joystick.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            stickTouchId = t.identifier;
            stickActive = true;
            joystick.classList.add('active');
            const rect = joystick.getBoundingClientRect();
            setKnob(t.clientX - rect.left - rect.width / 2, t.clientY - rect.top - rect.height / 2);
        }, { passive: false });

        joystick.addEventListener('touchmove', e => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (t.identifier !== stickTouchId) continue;
                const rect = joystick.getBoundingClientRect();
                setKnob(t.clientX - rect.left - rect.width / 2, t.clientY - rect.top - rect.height / 2);
            }
        }, { passive: false });

        joystick.addEventListener('touchend', e => {
            for (const t of e.changedTouches) {
                if (t.identifier !== stickTouchId) continue;
                stickActive = false;
                stickTouchId = null;
                joystick.classList.remove('active');
                setKnob(0, 0);
                stickVec.x = stickVec.y = 0;
            }
        });
    }

    // ─── Game loop
    const SPEED = 0.5;  // worldUnits per frame
    const HALF_W = SCENE_W / 2;
    const HALF_H = SCENE_H / 2;
    let walkPhase = 0;

    function loop() {
        requestAnimationFrame(loop);

        let dx = 0, dy = 0;
        if (keys['arrowup']    || keys['w']) dy -= 1;
        if (keys['arrowdown']  || keys['s']) dy += 1;
        if (keys['arrowleft']  || keys['a']) dx -= 1;
        if (keys['arrowright'] || keys['d']) dx += 1;

        // 搖桿覆蓋鍵盤
        if (stickActive) {
            dx = stickVec.x;
            dy = stickVec.y;
        }

        const moveLen = Math.hypot(dx, dy);
        const isMoving = moveLen > 0.05;

        if (isMoving) {
            const norm = Math.max(moveLen, 1);
            dx /= norm;
            dy /= norm;
            px += dx * SPEED;
            py += dy * SPEED;

            // 邊界 clamp
            px = Math.max(-HALF_W + 3, Math.min(HALF_W - 3, px));
            py = Math.max(-HALF_H + 5, Math.min(HALF_H - 5, py));

            // 朝向（rotation.y = atan2(dx, dy)，因為相機向下看 +Y）
            player.rotation.y = Math.atan2(dx, dy);

            // walk 動畫（手腳擺動）
            walkPhase += 0.22;
            chibi.leftArm.rotation.x =  Math.sin(walkPhase) * 0.6;
            chibi.rightArm.rotation.x = -Math.sin(walkPhase) * 0.6;
            chibi.leftLeg.rotation.x = -Math.sin(walkPhase) * 0.55;
            chibi.rightLeg.rotation.x = Math.sin(walkPhase) * 0.55;

            // 整體微微 bounce
            chibi.group.position.y = -0.05 + Math.abs(Math.sin(walkPhase)) * 0.08;

            // 頭微擺
            chibi.head.rotation.z = Math.sin(walkPhase * 0.5) * 0.06;
        } else {
            // 站立 idle — 緩慢 reset
            chibi.leftArm.rotation.x *= 0.85;
            chibi.rightArm.rotation.x *= 0.85;
            chibi.leftLeg.rotation.x *= 0.85;
            chibi.rightLeg.rotation.x *= 0.85;
            chibi.group.position.y = -0.05 + Math.sin(Date.now() * 0.003) * 0.03;  // 呼吸
        }

        player.position.x = px;
        player.position.z = py;

        renderer.render(scene, camera);
    }
    loop();

    // 暴露給 debug
    window.eduChibi = { player, chibi, scene, camera };
})();
