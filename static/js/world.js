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
        updateMiniMapYou();
    }

    // 更新 mini map 玩家位置（玩家固定 viewport 中央 = world 內 -pos + vp 中心）
    function updateMiniMapYou() {
        const you = document.getElementById("wd-mm-you");
        if (!you) return;
        const wW = world.offsetWidth, wH = world.offsetHeight;
        if (wW < 1 || wH < 1) return;
        const playerWorldX = -posX + vp.clientWidth / 2;
        const playerWorldY = -posY + vp.clientHeight / 2;
        const px = Math.max(0, Math.min(100, (playerWorldX / wW) * 100));
        const py = Math.max(0, Math.min(100, (playerWorldY / wH) * 100));
        you.style.left = px + "%";
        you.style.top = py + "%";
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

    // ─── 初始化：起點在 world 中央上方 + sprite Z 排序 + 點擊彈窗
    // 派派 5/21：不要自動往下滑動
    function init() {
        bounds();
        targetX = (posXMin + posXMax) / 2;   // 水平居中
        targetY = posYMax;                    // 頂部對齊
        posX = targetX; posY = targetY;
        render();
        setupSprites();
    }

    // ─── Sprite Z 排序：按 top% 排（越下面 z 越高 = 遮擋前面的） ──
    // ─── + 進場 stagger + ! 提示 + 點擊聚焦 + 彈窗
    function setupSprites() {
        const sprites = world.querySelectorAll(".wd-sprite");
        sprites.forEach((s, i) => {
            // 1) Z 排序：top% 越大越前面
            const top = parseFloat(s.style.top) || 0;
            s.style.zIndex = String(10 + Math.round(top * 0.9));
            // 2) 進場 stagger delay
            s.style.animationDelay = (0.08 * i) + "s";
            // 3) ! 提示（沒點過才顯示）
            const tap = s.dataset.tap;
            const seenKey = "wd_seen_" + tap;
            if (!localStorage.getItem(seenKey)) {
                const bang = document.createElement("span");
                bang.className = "wd-bang";
                bang.textContent = "!";
                bang.setAttribute("aria-hidden", "true");
                s.appendChild(bang);
                s.classList.add("has-bang");
            }
            // 4) 點擊：squash 反饋 + 聚焦 + 彈窗
            s.addEventListener("click", e => {
                if (suppressClick) return;
                e.stopPropagation();
                localStorage.setItem(seenKey, "1");
                s.classList.remove("has-bang");
                // 點擊 squash 反饋（once）
                s.classList.add("clicked");
                setTimeout(() => s.classList.remove("clicked"), 450);
                focusOnSprite(s);
            });
        });

        // Modal 關閉
        const modal = document.getElementById("demo-modal");
        const closeBtn = document.getElementById("demo-modal-close");
        if (closeBtn && modal) {
            closeBtn.addEventListener("click", () => modal.classList.remove("show"));
            modal.addEventListener("click", e => {
                if (e.target === modal) modal.classList.remove("show");
            });
        }
    }

    // 鏡頭聚焦到 sprite + 玩家面向（純視覺）+ 0.85s 後彈窗
    function focusOnSprite(s) {
        const sLeft = parseFloat(s.style.left) || 0;
        const sTop = parseFloat(s.style.top) || 0;
        const sW = parseFloat(s.style.width) || 0;
        const wW = world.offsetWidth, wH = world.offsetHeight;
        const cx = (sLeft / 100 * wW) + (sW / 100 * wW / 2);
        const cy = (sTop / 100 * wH) + (sW / 100 * wW / 2);
        bounds();
        // 玩家面向 sprite 方向（cx 在玩家右邊 → 朝右；左邊 → 朝左）
        const player = document.getElementById("wd-player");
        if (player) {
            const playerWorldX = -posX + vp.clientWidth / 2;
            const right = cx > playerWorldX;
            player.classList.toggle("face-right", right);
            player.classList.toggle("face-left", !right);
        }
        targetX = clampX(vp.clientWidth / 2 - cx);
        targetY = clampY(vp.clientHeight / 2 - cy);
        kick();
        setTimeout(() => showDemoModal(s.dataset.tap), 850);
    }

    const POPUPS = {
        shop: { icon: "🏪", title: "商店", body: "服裝/職業道具/節日造型<br>多主題輪換上架" },
        exam: { icon: "🎓", title: "考試中心", body: "5 科檢定考與模擬考<br>通過獲得認證證書" },
        farm: { icon: "🐄", title: "農田", body: "養動物、收穫資源<br>每日任務獎勵金幣" },
        cottage: { icon: "🏡", title: "個人小屋", body: "換造型、看圖鑑、整理你的成就" },
        pvp: { icon: "⚔️", title: "PK 競技場", body: "三種模式：同年級對戰<br>大亂鬥 / 朋友房間" },
        boss: { icon: "🏰", title: "魔王塔", body: "5 科魔王戰 T1 / T2 / T3<br>累積學習換取榮譽勳章" },
        museum: { icon: "🏛", title: "偉人館", body: "25 chibi 偉人圖鑑<br>+ 名人九宮格遊戲" },
        ranking: { icon: "🏆", title: "排行榜紀念碑", body: "週答題冠軍榜<br>+ PK 王榜" },
        quest: { icon: "📋", title: "任務告示板", body: "每日任務 / 成就 / 限時挑戰<br>共 10 種類型" },
        career: { icon: "👔", title: "職業學院", body: "25 個職業系統<br>+ Tier 4 偉人變身" },
        whack: { icon: "🔨", title: "打地鼠遊戲場", body: "限時打地鼠抓答案<br>5 科都能玩" },
        spell: { icon: "🔤", title: "拼字塔", body: "接字母拼單字<br>+ 英文 puzzle 字配圖" },
        treasure: { icon: "🎁", title: "每日寶箱", body: "連續登入獎勵<br>累積天數開更好的寶物" },
        bulletin: { icon: "📢", title: "公告板", body: "活動公告 / 版本更新<br>+ 客服訊息" },
        chinese: { icon: "📖", title: "國語島", body: "讀寫、注音、閱讀、成語<br>6 個年級 36 章節" },
        english: { icon: "🔤", title: "英文島", body: "單字、文法、聽力、口說<br>含 ABC 字母與聽力重組" },
        math: { icon: "🔢", title: "數學島", body: "加減乘除、分數、幾何<br>6 個年級 36 章節" },
        science: { icon: "🔬", title: "自然島", body: "生物、物質、能量、地球<br>含實驗題與圖示題" },
        social: { icon: "🌏", title: "社會島", body: "歷史、地理、公民<br>含台灣社會與世界文化" },
    };

    function showDemoModal(key) {
        const opts = POPUPS[key];
        if (!opts) return;
        const modal = document.getElementById("demo-modal");
        if (!modal) return;
        document.getElementById("demo-modal-icon").textContent = opts.icon;
        document.getElementById("demo-modal-title").textContent = opts.title;
        document.getElementById("demo-modal-body").innerHTML = opts.body;
        modal.classList.add("show");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
