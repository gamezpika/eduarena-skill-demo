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

    // ─── 設背景圖比例（720:1280 = 9:16）── world 高度 = viewport 寬 × (1280/720)
    function fitWorldSize() {
        const w = vp.clientWidth;
        const ratio = 1280 / 720;   // 跟背景圖比例對齊
        world.style.width = w + "px";
        world.style.height = (w * ratio) + "px";
    }
    fitWorldSize();
    window.addEventListener("resize", () => { fitWorldSize(); bounds(); pos = clamp(pos); render(); });

    // ─── 物理引擎參數 ─────────────────────────────
    const STIFF = 50, DAMP = 20, MASS = 1;
    let target = 0, pos = 0, vel = 0;
    let posMin = 0, posMax = 0;
    let raf = 0, last = 0;

    function bounds() {
        const vpH = vp.clientHeight;
        const worldH = world.offsetHeight;
        posMin = vpH - worldH;   // 拖到底（world 底部對齊 viewport 底部）
        posMax = 0;               // 拖到頂（world 頂部對齊 viewport 頂部）
        if (posMin > posMax) posMin = posMax;
    }
    function clamp(v) { return v < posMin ? posMin : (v > posMax ? posMax : v); }

    function render() {
        world.style.transform = "translate3d(0," + pos.toFixed(2) + "px,0)";
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
            const a = (-STIFF * (pos - target) - DAMP * vel) / MASS;
            vel += a * h;
            pos += vel * h;
        }
        render();
        if (Math.abs(pos - target) > 0.12 || Math.abs(vel) > 0.12) {
            raf = requestAnimationFrame(step);
        } else {
            pos = target; vel = 0; render();
        }
    }
    function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(step); } }

    // ─── Wheel（桌面試玩用） ────────────────────
    vp.addEventListener("wheel", e => {
        e.preventDefault();
        bounds();
        target = clamp(target - e.deltaY);
        kick();
    }, { passive: false });

    // ─── Pointer 拖曳 + flick 慣性 ──────────────
    let down = false, dragOn = false, sY = 0, sT = 0, lY = 0, lT = 0, fv = 0;
    let suppressClick = false;

    vp.addEventListener("click", e => {
        if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
    }, true);

    vp.addEventListener("pointerdown", e => {
        bounds();
        down = true; dragOn = false; suppressClick = false;
        try { vp.setPointerCapture(e.pointerId); } catch (_) {}
        sY = e.clientY; sT = target;
        lY = e.clientY; lT = e.timeStamp || performance.now(); fv = 0;
    });

    vp.addEventListener("pointermove", e => {
        if (!down) return;
        if (e.cancelable) e.preventDefault();
        const dy = e.clientY - sY;
        if (!dragOn && Math.abs(dy) < 6) return;
        dragOn = true;
        target = clamp(sT + dy);
        const now = e.timeStamp || performance.now();
        const dtm = now - lT;
        if (dtm > 0) fv = (e.clientY - lY) / dtm;
        lY = e.clientY; lT = now;
        kick();
    }, { passive: false });

    function endDrag(e) {
        if (!down) return;
        down = false;
        try { if (e) vp.releasePointerCapture(e.pointerId); } catch (_) {}
        if (dragOn) {
            suppressClick = true;
            target = clamp(target + fv * 220);   // flick 慣性
            kick();
        }
    }
    vp.addEventListener("pointerup", endDrag);
    vp.addEventListener("pointercancel", endDrag);

    // touchmove preventDefault（iOS 阻祖先原生捲動）
    vp.addEventListener("touchmove", e => {
        if (down && e.cancelable) e.preventDefault();
    }, { passive: false });

    // ─── 初始化：起點在最上方（顯示叢林） ─────
    function init() {
        bounds();
        target = posMax; pos = posMax;
        render();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
