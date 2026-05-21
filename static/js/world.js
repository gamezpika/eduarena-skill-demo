/**
 * World 探索地圖 — 直向長大背景 + 上下滑動（彈簧物理引擎）
 *
 * 沿用海洋地圖 starmap.js 的彈簧模型，但只做 Y 軸滑動（不做 3D 透視縮放）。
 * 彈簧參數：stiffness=50 / damping=20 / mass=1（framer-motion useSpring 預設）。
 */
(function () {
    "use strict";

    const vp = document.getElementById("wd-viewport");
    const world = document.getElementById("wd-world");
    if (!vp || !world) return;

    // ─── world 寬高都比 viewport 大，讓 2D 拖曳（X+Y）都有空間
    // 寬 = viewport × 1.5（左右拖 0.5x viewport 寬）
    // 高 = viewport × 2.5（上下拖 1.5x viewport 高）
    function fitWorldSize() {
        const w = vp.clientWidth;
        const vpH = vp.clientHeight;
        if (w < 1 || vpH < 1) return;
        world.style.width = (w * 1.5) + "px";
        world.style.height = (vpH * 2.5) + "px";
    }
    fitWorldSize();
    window.addEventListener("resize", () => {
        fitWorldSize();
        bounds();
        posX = clampX(posX); posY = clampY(posY);
        render();
    });

    // ─── 物理引擎參數（2D：X + Y 雙軸彈簧） ──────
    const STIFF = 50, DAMP = 20, MASS = 1;
    let targetX = 0, posX = 0, velX = 0;
    let targetY = 0, posY = 0, velY = 0;
    let posXMin = 0, posXMax = 0, posYMin = 0, posYMax = 0;
    let raf = 0, last = 0;

    function bounds() {
        const vpW = vp.clientWidth, vpH = vp.clientHeight;
        const worldW = world.offsetWidth, worldH = world.offsetHeight;
        posXMin = vpW - worldW;   // 拖到右（world 右邊對齊 viewport 右邊）
        posXMax = 0;
        posYMin = vpH - worldH;
        posYMax = 0;
        if (posXMin > posXMax) posXMin = posXMax;
        if (posYMin > posYMax) posYMin = posYMax;
    }
    function clampX(v) { return v < posXMin ? posXMin : (v > posXMax ? posXMax : v); }
    function clampY(v) { return v < posYMin ? posYMin : (v > posYMax ? posYMax : v); }

    function render() {
        world.style.transform =
            "translate3d(" + posX.toFixed(2) + "px," + posY.toFixed(2) + "px,0)";
    }

    function step(ts) {
        raf = 0;
        if (!last) last = ts;
        let dt = (ts - last) / 1000; last = ts;
        if (dt > 0.05) dt = 0.05;
        let rem = dt;
        while (rem > 0) {
            const h = rem > 1 / 120 ? 1 / 120 : rem;
            rem -= h;
            // X 軸彈簧
            const aX = (-STIFF * (posX - targetX) - DAMP * velX) / MASS;
            velX += aX * h; posX += velX * h;
            // Y 軸彈簧
            const aY = (-STIFF * (posY - targetY) - DAMP * velY) / MASS;
            velY += aY * h; posY += velY * h;
        }
        render();
        const settled = Math.abs(posX - targetX) < 0.12 && Math.abs(velX) < 0.12
                     && Math.abs(posY - targetY) < 0.12 && Math.abs(velY) < 0.12;
        if (!settled) {
            raf = requestAnimationFrame(step);
        } else {
            posX = targetX; velX = 0;
            posY = targetY; velY = 0;
            render();
        }
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(step); } }

    // ─── Wheel（桌面試玩：垂直 = 上下；shift+wheel = 左右） ──
    vp.addEventListener("wheel", e => {
        e.preventDefault();
        bounds();
        if (e.shiftKey) targetX = clampX(targetX - e.deltaY);
        else targetY = clampY(targetY - e.deltaY);
        kick();
    }, { passive: false });

    // ─── Pointer 2D 拖曳 + flick 慣性 ──────────────
    let down = false, dragOn = false;
    let sX = 0, sY = 0, sTX = 0, sTY = 0;
    let lX = 0, lY = 0, lT = 0, fvX = 0, fvY = 0;
    let suppressClick = false;

    vp.addEventListener("click", e => {
        if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
    }, true);

    vp.addEventListener("pointerdown", e => {
        bounds();
        down = true; dragOn = false; suppressClick = false;
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        sX = e.clientX; sY = e.clientY;
        sTX = targetX; sTY = targetY;
        lX = e.clientX; lY = e.clientY;
        lT = e.timeStamp || performance.now();
        fvX = 0; fvY = 0;
    });

    vp.addEventListener("pointermove", e => {
        if (!down) return;
        if (e.cancelable) e.preventDefault();
        const dx = e.clientX - sX;
        const dy = e.clientY - sY;
        if (!dragOn && (dx * dx + dy * dy) < 36) return;   // < 6px 算點擊不攔
        dragOn = true;
        targetX = clampX(sTX + dx);
        targetY = clampY(sTY + dy);
        const now = e.timeStamp || performance.now();
        const dtm = now - lT;
        if (dtm > 0) {
            fvX = (e.clientX - lX) / dtm;
            fvY = (e.clientY - lY) / dtm;
        }
        lX = e.clientX; lY = e.clientY; lT = now;
        kick();
    }, { passive: false });

    function endDrag(e) {
        if (!down) return;
        down = false;
        try { if (e) vp.releasePointerCapture(e.pointerId); } catch (_) {}
        if (dragOn) {
            suppressClick = true;
            targetX = clampX(targetX + fvX * 220);
            targetY = clampY(targetY + fvY * 220);
            kick();
        }
    }
    vp.addEventListener("pointerup", endDrag);
    vp.addEventListener("pointercancel", endDrag);

    vp.addEventListener("touchmove", e => {
        if (down && e.cancelable) e.preventDefault();
    }, { passive: false });

    // ─── 初始化：起點在 world 中央上方（上半中央，露最多有趣內容） ─
    function init() {
        bounds();
        targetX = (posXMin + posXMax) / 2;   // 水平居中
        targetY = posYMax;                    // 頂部對齊
        posX = targetX; posY = targetY;
        render();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
