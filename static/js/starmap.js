/**
 * Star Map + Weekly Leaderboard
 */
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);

    // ── Star Map（Phase 1.2：drill-down 5 科 → 年級 → 章節）─────
    async function loadStarMap() {
        try {
            const resp = await window.eduApi("/api/starmap");
            const data = await resp.json();
            $("starmap-total-stars").textContent = `${data.total_stars ?? 0} / ${data.max_stars ?? 84}`;
            renderStarmapDrilldown(data);
        } catch (e) { console.error("[StarMap]", e); }
    }

    const SUBJ_ICONS = {
        math: '<img class="emo" src="assets/images/subjects/math.png?s=6" alt="">',
        chinese: '<img class="emo" src="assets/images/subjects/chinese.png?s=6" alt="">',
        english: '<img class="emo" src="assets/images/subjects/english.png?s=6" alt="">',
        science: '<img class="emo" src="assets/images/subjects/science.png?s=6" alt="">',
        social: '<img class="emo" src="assets/images/subjects/social.png?s=6" alt="">'
    };
    const SUBJ_FALLBACK_ICON = '<img class="emo" src="assets/images/subjects/chinese.png?s=6" alt="">';
    const SUBJ_NAMES = { math: "數學島", chinese: "國語島", english: "英文島", science: "自然島", social: "社會島" };
    const GRADE_LABELS = { "1": "一年級", "2": "二年級", "3": "三年級", "4": "四年級", "5": "五年級", "6": "六年級" };

    function renderStarmapDrilldown(data) {
        const container = $("starmap-islands");
        container.innerHTML = "";

        // Step 1：5 個科目卡（預設收合）
        data.map.forEach(island => {
            const grades = island.grades || {};
            const sumStars = Object.keys(grades).reduce((a, k) => a + (grades[k]?.unlocked ? grades[k].total_stars : 0), 0);
            const sumMax = Object.keys(grades).reduce((a, k) => a + (grades[k]?.max_stars || 0), 0);

            // v7：同一份資料順手填進海洋地圖每座島下方的星數膠囊
            const subjSel = (window.CSS && CSS.escape)
                ? CSS.escape(island.subject) : String(island.subject);
            const oiStars = document.querySelector(
                '.ocean-island[data-subject="' + subjSel + '"] .oi-stars');
            if (oiStars) oiStars.innerHTML =
                '<img class="emo" src="assets/images/icons/star_filled.png?s=6" alt=""> '
                + sumStars + '/' + sumMax;

            const card = document.createElement("div");
            card.className = "island-card collapsed";
            card.innerHTML = `
                <div class="island-header" data-subject="${island.subject}">
                    <span class="island-name">${SUBJ_ICONS[island.subject] || SUBJ_FALLBACK_ICON} ${SUBJ_NAMES[island.subject] || island.name}</span>
                    <span class="island-star-count"><img class="emo" src="assets/images/icons/star_filled.png?s=6" alt=""> ${sumStars}/${sumMax}</span>
                    <span class="island-toggle">▼</span>
                </div>
                <div class="island-grades-host" hidden></div>
            `;
            // 點科目 toggle 年級
            card.querySelector(".island-header").addEventListener("click", () => {
                const host = card.querySelector(".island-grades-host");
                const isOpen = !host.hidden;
                host.hidden = isOpen;
                card.classList.toggle("expanded", !isOpen);
                card.querySelector(".island-toggle").textContent = isOpen ? "▼" : "▲";
                if (!isOpen && !host.dataset.rendered) {
                    renderGrades(host, grades);
                    host.dataset.rendered = "1";
                }
            });
            container.appendChild(card);
        });
        // v7：星數已填入海洋地圖島膠囊→島變高，重量測一次校正深度/邊界
        const ov = $("ocean-viewport");
        if (ov && ov._oceanRemeasure) ov._oceanRemeasure();
    }

    // Step 2：6 個年級子選單
    function renderGrades(host, grades) {
        host.innerHTML = "";
        ["1", "2", "3", "4", "5", "6"].forEach(gk => {
            const g = grades[gk];
            const row = document.createElement("div");
            row.className = "grade-row";
            if (!g || !g.unlocked) {
                // 未解鎖
                row.classList.add("locked");
                row.innerHTML = `
                    <span class="grade-label"><img class="emo" src="assets/images/icons/lock.png?s=6" alt=""> ${GRADE_LABELS[gk]}</span>
                    <span class="grade-stars locked-text">未解鎖</span>
                `;
                host.appendChild(row);
                return;
            }
            row.dataset.grade = gk;
            row.innerHTML = `
                <div class="grade-row-head">
                    <span class="grade-label">${GRADE_LABELS[gk]}</span>
                    <span class="grade-stars"><img class="emo" src="assets/images/icons/star_filled.png?s=6" alt=""> ${g.total_stars}/${g.max_stars}</span>
                    <span class="grade-toggle">▼</span>
                </div>
                <div class="grade-topics-host" hidden></div>
            `;
            row.querySelector(".grade-row-head").addEventListener("click", () => {
                const tHost = row.querySelector(".grade-topics-host");
                const isOpen = !tHost.hidden;
                tHost.hidden = isOpen;
                row.classList.toggle("expanded", !isOpen);
                row.querySelector(".grade-toggle").textContent = isOpen ? "▼" : "▲";
                if (!isOpen && !tHost.dataset.rendered) {
                    renderTopics(tHost, g);
                    tHost.dataset.rendered = "1";
                }
            });
            host.appendChild(row);
        });
    }

    // Step 3：章節星星
    function renderTopics(host, gradeData) {
        host.innerHTML = "";
        const topics = gradeData.topics || [];
        if (!topics.length) {
            host.innerHTML = `<div class="topic-empty">這個年級還沒有章節</div>`;
            return;
        }
        topics.forEach(t => {
            const stars = `<img class="emo" src="assets/images/icons/star_filled.png?s=6" alt="">`.repeat(t.stars) + `<img class="emo" src="assets/images/icons/star_empty.png?s=6" alt="">`.repeat(3 - t.stars);
            host.innerHTML += `
                <div class="star-topic-row">
                    <span class="star-topic-name">${t.name}</span>
                    <span class="star-topic-stars">${stars}</span>
                </div>
            `;
        });
    }

    // ── Leaderboard ─────────────────────────────────
    let lbActiveTab = "answer";

    async function loadLeaderboard() {
        if (lbActiveTab === "pvp") return loadPvpLeaderboard();
        return loadAnswerLeaderboard();
    }

    function bindLbTabs() {
        document.querySelectorAll(".lb-tab").forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", () => {
                lbActiveTab = btn.dataset.lbtab;
                document.querySelectorAll(".lb-tab").forEach(b => b.classList.toggle("active", b === btn));
                loadLeaderboard();
            });
        });
    }

    async function loadPvpLeaderboard() {
        try {
            const r = await window.eduApi("/api/pvp/leaderboard");
            const data = await r.json();
            if (data.grade) {
                $("lb-week").innerHTML = `<img class="emo" src="assets/images/icons/sword.png?s=6" alt=""> G${data.grade} PK 王`;
            } else {
                $("lb-week").textContent = "PK 排行";
            }
            $("lb-me-rank").textContent = data.my_rank ? `#${data.my_rank}` : "未上榜";
            $("lb-me-stats").textContent = data.my_rank
                ? `當前你的 G${data.grade} PK 名次`
                : "玩 PK 對戰才會上榜";
            const list = $("lb-list");
            list.innerHTML = "";
            (data.leaderboard || []).forEach(entry => {
                const row = document.createElement("div");
                const rankClass = entry.rank === 1 ? "gold" : (entry.rank === 2 ? "silver" : (entry.rank === 3 ? "bronze" : ""));
                row.className = "lb-row " + rankClass + (entry.is_me ? " me" : "");
                const genderEmoji = entry.gender === "female" ? '<img class="emo" src="assets/images/icons/girl.png?s=6" alt="">' : '<img class="emo" src="assets/images/icons/boy.png?s=6" alt="">';
                row.innerHTML = `
                    <span class="lb-rank">${entry.rank}</span>
                    <span class="lb-name">${genderEmoji} ${entry.name}</span>
                    <span class="lb-stats"><img class="emo" src="assets/images/icons/sword.png?s=6" alt=""> ${entry.total_score} / ${entry.games} 場</span>
                `;
                list.appendChild(row);
            });
            if (!(data.leaderboard || []).length) {
                list.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">還沒有人玩 PK，去 PK 大廳開賽！</div>';
            }
        } catch (e) { console.error("[PvpLB]", e); }
    }

    async function loadAnswerLeaderboard() {
        try {
        const [lbResp, meResp] = await Promise.all([
            window.eduApi("/api/leaderboard"),
            window.eduApi("/api/leaderboard/me"),
        ]);
        const lb = await lbResp.json();
        const me = await meResp.json();

        $("lb-week").innerHTML = `<img class="emo" src="assets/images/icons/calendar.png?s=6" alt=""> ${lb.week}`;

        // My stats
        $("lb-me-rank").textContent = me.rank ? `#${me.rank}` : "—";
        $("lb-me-stats").innerHTML = `答 ${me.total ?? 0} 題 · 對 ${me.correct ?? 0} 題 · <img class="emo" src="assets/images/icons/coin.png?s=6" alt=""> ${me.coins ?? 0}`;

        // List
        const list = $("lb-list");
        list.innerHTML = "";

        (lb.leaderboard || []).forEach(entry => {
            const row = document.createElement("div");
            const rankClass = entry.rank === 1 ? "gold" : (entry.rank === 2 ? "silver" : (entry.rank === 3 ? "bronze" : ""));
            const medalEmoji = entry.rank === 1 ? '<img class="emo lg" src="assets/images/icons/medal_gold.png?s=6" alt="1">'
                            : entry.rank === 2 ? '<img class="emo lg" src="assets/images/icons/medal_silver.png?s=6" alt="2">'
                            : entry.rank === 3 ? '<img class="emo lg" src="assets/images/icons/medal_bronze.png?s=6" alt="3">'
                            : entry.rank;

            row.className = "lb-row";
            row.innerHTML = `
                <span class="lb-rank ${rankClass}">${medalEmoji}</span>
                <span class="lb-name">${entry.name}</span>
                <span class="lb-coins"><img class="emo" src="assets/images/icons/coin.png?s=6" alt=""> ${entry.coins}</span>
            `;
            list.appendChild(row);
        });

        if (!lb.leaderboard || lb.leaderboard.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;">本週還沒有人上榜，快來當第一名！</div>';
        }
        } catch (e) { console.error("[Leaderboard]", e); }
    }

    // ── 地圖島：科島→進該科 hub；魔王島→該科魔王戰 ──
    // 5/16 需求方：DOGTOR 風海洋地圖。.ocean-island[data-subject]=科島，
    // .ocean-island[data-boss]=魔王島。舊 .world-hotspot/.map-island 留著相容。
    function wireMapIslands() {
        const islandsMap = {
            math: "mathIsland", chinese: "chineseIsland",
            english: "englishIsland", science: "scienceIsland",
            social: "socialIsland",
        };
        document.querySelectorAll(".ocean-island[data-subject], .world-hotspot, .map-island").forEach(btn => {
            btn.addEventListener("click", () => {
                const mod = window[islandsMap[btn.dataset.subject]];
                if (mod?.open) mod.open();
            });
        });
        // 魔王島 → 該科魔王戰。bossIsland.start 必須在 click 同步路徑直接呼叫
        // （boss-phaser 內 unlockSfx 需 user gesture，勿包 await/setTimeout）。
        document.querySelectorAll(".ocean-island[data-boss]").forEach(btn => {
            btn.addEventListener("click", () => {
                const subject = btn.dataset.boss;
                if (window.bossIsland?.start) window.bossIsland.start(subject);
            });
        });
    }

    // 5/17 需求方：天空熱氣球＝考試入口(檢定/模擬/回顧)。點 → 開考試中心對應分頁。
    function wireSkyPortals() {
        document.querySelectorAll(".sky-balloon[data-exam]").forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.dataset.exam;   // cert / mock / history
                if (window.examSystem?.openCenter) window.examSystem.openCenter(tab);
            });
        });
        // 5/17 需求方：綜合天空島 → 直接開綜合檢定考(跨5科同年級20題)
        const sky = $("sky-island");
        if (sky) sky.addEventListener("click", () => {
            if (window.examSystem?.startComprehensive) window.examSystem.startComprehensive();
        });
    }

    // ── 5/16 需求方 v11：手寫物理引擎 + 3D 透視「消失點釘背景天際線」───
    // 廢原生滾動。wheel/拖曳(手往下→target增)/flick 驅 target；彈簧
    // (stiffness50/damping20/mass1)逐幀積分出 pos(＝smoothY)。島由上而下
    // 國→英→數→自→社，起點 pos=posMax(國語在 FOCUS_F 焦點)，往下拖依序把
    // 英→數→自→社 帶到焦點。每島 scale/opacity/z 綁「離背景天際線距離」：
    // 下方海面最大最清→往上越近天際線越小越淡→頂緣碰天際線(視窗30%)完全
    // 消失，天空不出現島(與海天背景圖貼合)。每座島都能滑到焦點放大可點。
    function setupOceanParallax() {
        const vp = $("ocean-viewport");
        if (!vp || vp.dataset.pxBound) return;
        vp.dataset.pxBound = "1";
        const bg = $("layer-bg"), stage = $("layer-stage"), fg = $("layer-fg");
        const islands = Array.prototype.slice.call(
            vp.querySelectorAll(".ocean-island"));
        // 5/17：海面裝飾(小舟/無人島)＝非互動，吃同樣深度縮放融入，不參與 best/centered
        const decos = Array.prototype.slice.call(
            vp.querySelectorAll(".ocean-deco"));
        const reduce = window.matchMedia
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // v10：容器高度防呆。舊 webview 對 aspect-ratio 有時回 clientHeight=0
        // → vpH 不能信。clientHeight>1 才用，否則用 getBoundingClientRect，
        // 再不行用 window.innerHeight*0.72。保證 vpH 永遠是合理實數。
        function getVpH() {
            let h = vp.clientHeight;
            if (h > 1) return h;
            h = Math.round(vp.getBoundingClientRect().height);
            if (h > 1) return h;
            return Math.round((window.innerHeight || 720) * 0.72);
        }

        // v9 需求方規格：framer-motion useSpring 預設模型(本專案無 React，
        // 用現有純 JS 彈簧等價)。stiffness:50 damping:20 mass:1。
        const STIFF = 50, DAMP = 20, MASS = 1;
        let target = 0, pos = 0, vel = 0, posMin = 0, posMax = 0, posOpen = 0, raf = 0, last = 0;
        let interacted = false;
        // v11 3D 透視「消失點釘背景天際線」：背景換成畫好的海天圖，海天交界
        // (天際線)固定在視窗 HORIZON_F 高度。島在下方海面最大最清(近)，往上
        // 滑越接近天際線越小越淡，**到天際線那條線 scale 最小+opacity 0 完全
        // 消失**，天際線以上(天空區)不顯示島＝與背景圖完美貼合不穿幫。拖曳
        // 彈簧手感不變；每座島(含國語)都能滑到 FOCUS_F 焦點放大可點。
        // 旋鈕：HORIZON_F 要對齊背景圖那條海天線比例。
        const HORIZON_F = 0.30;   // 背景圖天際線在視窗的高度比(對齊生成的海天圖)
        const FOCUS_F   = 0.72;   // 「目前這座島」停的高度(夠大可點，上有天空下有海)
        const NEAR_F    = 0.82;   // scale 到最大的高度(此處及更下方=最近最大)
        // 5/17 需求方：開場別把國語單獨放焦點(英文掉出畫面)，改放畫面中段，
        // 讓英文島從下緣露一截→玩家一看就知道可往下拖。只動開場起始位置。
        const OPEN_F    = 0.55;   // 開場：最上島(國語)在視窗 55% 高(英文露在下方)
        const SC_MIN = 0.34, SC_MAX = 1.12, FADE_F = 0.10;
        function bounds() {
            const vpH = getVpH();
            let minC = Infinity, maxC = -Infinity;
            islands.forEach(el => {
                const c = el.offsetTop + el.offsetHeight / 2;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            });
            if (!isFinite(minC)) { minC = 0; maxC = 0; }
            // posMax＝最上島(國語)滑到 FOCUS 的捲動上限；posMin＝最下島(社會)在焦點(末端)
            posMax = FOCUS_F * vpH - minC;
            posMin = FOCUS_F * vpH - maxC;
            if (posMin > posMax) posMin = posMax;   // 島太密退化保護
            // 開場起始位置：國語在 OPEN_F(比 FOCUS 高一點)→英文從下緣露出來
            posOpen = OPEN_F * vpH - minC;
            if (posOpen > posMax) posOpen = posMax;
            if (posOpen < posMin) posOpen = posMin;
        }
        function clamp(v) { return v < posMin ? posMin : (v > posMax ? posMax : v); }
        function tf(v, at1000) { return v * (at1000 / -1000); }  // 背景緩飄視差

        function render() {
            if (stage) stage.style.transform =
                "translate3d(0," + pos.toFixed(2) + "px,0)";
            if (!reduce) {
                if (bg) bg.style.transform =
                    "translate3d(0," + tf(pos, 200).toFixed(2) + "px,0)";
                if (fg) fg.style.transform =
                    "translate3d(0," + tf(pos, 1500).toFixed(2) + "px,0)";
            }
            const vpH = getVpH();
            const horizonY = HORIZON_F * vpH;          // 背景圖海天交界線
            const focusY = FOCUS_F * vpH;              // 「目前島」焦點高度
            const seaSpan = NEAR_F * vpH - horizonY;   // 天際線→最近 的深度區間(>0)
            const fadeBand = vpH * FADE_F;             // 天際線下方多少內淡入完成
            let best = null, bestD = 1e9;
            islands.forEach(el => {
                const c = el.offsetTop + el.offsetHeight / 2 + pos;  // 島中心螢幕Y
                // 距天際線：0=在天際線(最遠/消失)，1=到最近區(最大)；可>1(更下方仍最大)
                let t = (c - horizonY) / seaSpan;
                const tc = t < 0 ? 0 : t > 1 ? 1 : t;
                const sc = SC_MIN + (SC_MAX - SC_MIN) * tc;          // 0.34→1.12
                // opacity 用「渲染後島**頂緣**」算(非中心)：頂緣一碰天際線就
                // op=0 完全消失→保證島不會有任何部分戳進天空(Codex P1)。
                // topEdge = 中心 - 島高*scale/2 (transform-origin center)
                const topEdge = c - (el.offsetHeight * sc) / 2;
                let op = (topEdge - horizonY) / fadeBand;
                op = op < 0 ? 0 : op > 1 ? 1 : op;
                el.style.transform = "scale(" + sc.toFixed(3) + ")";
                el.style.opacity = op.toFixed(3);
                el.style.filter = "";
                // z 連動：越近(大)越上層，遠島不擋近島
                el.style.zIndex = String(10 + Math.round(tc * 20));
                const ad = Math.abs(c - focusY);   // 離焦點最近者做漂浮(bob)
                if (ad < bestD) { bestD = ad; best = el; }
            });
            islands.forEach(el => el.classList.toggle(
                "centered", el === best && bestD < vpH * 0.20));
            // 5/17：海面裝飾吃同一套深度(scale/opacity/z)，但不參與 best/centered
            decos.forEach(el => {
                const c = el.offsetTop + el.offsetHeight / 2 + pos;
                const t = (c - horizonY) / seaSpan;
                const tc = t < 0 ? 0 : t > 1 ? 1 : t;
                const sc = SC_MIN + (SC_MAX - SC_MIN) * tc;
                const topEdge = c - (el.offsetHeight * sc) / 2;
                let op = (topEdge - horizonY) / fadeBand;
                op = op < 0 ? 0 : op > 1 ? 1 : op;
                el.style.transform = "scale(" + sc.toFixed(3) + ")";
                el.style.opacity = op.toFixed(3);
                el.style.zIndex = String(8 + Math.round(tc * 20));
            });
        }

        function step(ts) {
            raf = 0;
            if (!last) last = ts;
            let dt = (ts - last) / 1000; last = ts;
            if (dt > 0.05) dt = 0.05;
            let rem = dt;
            while (rem > 0) {                       // 子步進積分保證穩定
                const h = rem > 1 / 120 ? 1 / 120 : rem; rem -= h;
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

        // ── 手勢 → target ─────────────────────────────────
        // v7：根治「往下拖彈出畫面」。可捲祖先 .starmap-content(下方章節星星
        // details 才需可捲)在拖曳期間鎖死，放手復原；再加非 passive touchmove
        // preventDefault(iOS/LIFF webview 對 pointer preventDefault 不可靠，
        // touchmove 才確實擋得住原生捲/橡皮筋)。
        const ancestor = vp.closest(".starmap-content");
        let ancestorOvY = null;                 // 鎖之前的 inline overflowY 原值
        function lockAncestor(on) {
            if (!ancestor) return;
            if (on) {
                if (ancestorOvY === null) ancestorOvY = ancestor.style.overflowY;
                ancestor.style.overflowY = "hidden";
            } else if (ancestorOvY !== null) {
                ancestor.style.overflowY = ancestorOvY;   // 精確還原(不硬清成空字串)
                ancestorOvY = null;
            }
        }
        vp.addEventListener("touchmove", e => {
            if (down && e.cancelable) e.preventDefault();
        }, { passive: false });
        vp.addEventListener("wheel", e => {
            e.preventDefault();
            interacted = true;
            bounds();
            target = clamp(target - e.deltaY);     // v5 反向(需求方實機)
            kick();
        }, { passive: false });

        let down = false, dragOn = false, sY = 0, sT = 0, lY = 0, lT = 0, fv = 0;
        let suppressClick = false;
        // 拖曳後合成的 click 在 capture 階段一次性吃掉，避免誤開島(Codex P2)
        vp.addEventListener("click", e => {
            if (suppressClick) {
                suppressClick = false;
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
        vp.addEventListener("pointerdown", e => {
            bounds();
            down = true; dragOn = false; suppressClick = false; interacted = true;
            lockAncestor(true);   // v7：按住期間鎖祖先捲動，杜絕往下拖彈出畫面
            // 指標捕獲：滑鼠拖出 viewport 放手仍收得到 up，drag 狀態不殘留(Codex P3)
            try { vp.setPointerCapture(e.pointerId); } catch (_) {}
            sY = e.clientY; sT = target;
            lY = e.clientY; lT = e.timeStamp || performance.now(); fv = 0;
        });
        vp.addEventListener("pointermove", e => {
            if (!down) return;
            // v6：按住拖曳期間 preventDefault，阻止原生去捲/橡皮筋祖先(跳出畫面 bug)
            if (e.cancelable) e.preventDefault();
            // v8 正向自然捲：內容跟手指。dy=clientY-sY：手往上滑 clientY↓→dy<0
            // →target 減→pos 減→stage 上移→看到下方島(英→數→自→社)；手往下
            // 滑→target 增→夾在 posMax(最上)＝已到頂不再上拉。
            const dy = e.clientY - sY;
            if (!dragOn && Math.abs(dy) < 6) return; // <6px 視為點擊，不攔
            dragOn = true;
            target = clamp(sT + dy);
            const now = e.timeStamp || performance.now();
            const dtm = now - lT;
            if (dtm > 0) fv = (e.clientY - lY) / dtm;  // 向下為正(px/ms)
            lY = e.clientY; lT = now;
            kick();
        }, { passive: false });
        function endDrag(e) {
            if (!down) return;
            down = false;
            lockAncestor(false);  // v7：放手復原祖先可捲(下方章節星星 details 才到得了)
            try { if (e) vp.releasePointerCapture(e.pointerId); } catch (_) {}
            if (dragOn) {                          // 真的拖過→吃掉接著的 click + flick 慣性
                suppressClick = true;
                target = clamp(target + fv * 220);   // v8 正向：上滑flick(fv<0)→target↓→續往下捲
                kick();
            }
        }
        vp.addEventListener("pointerup", endDrag);
        vp.addEventListener("pointercancel", endDrag);
        window.addEventListener("resize", () => { bounds(); target = clamp(target); kick(); });
        vp.querySelectorAll(".oi-img").forEach(img => {
            if (!img.complete)
                img.addEventListener("load", () => { bounds(); kick(); }, { once: true });
        });

        // v7：星數膠囊填入會墊高島→需重量測。提供 hook 給 loadStarMap 收尾呼叫
        // (不發全域 resize，避免波及他處)；沒互動過就重新對準起點。
        vp._oceanRemeasure = function () {
            bounds();
            if (!interacted) { target = posOpen; pos = posOpen; vel = 0; }
            else { target = clamp(target); }
            render(); kick();
        };

        vp._oceanOpen = function () {
            interacted = false;
            bounds();
            target = posOpen; pos = posOpen; vel = 0;   // v13b 起點＝國語在中段、英文露下緣
            render(); kick();
            // 圖載入/reflow 後高度變→重算邊界；使用者沒動就重新對準開場位置
            setTimeout(() => {
                bounds();
                if (!interacted) { target = posOpen; pos = posOpen; }
                else { target = clamp(target); }
                render(); kick();
            }, 320);
        };
    }

    function openOceanMap() {
        const vp = $("ocean-viewport");
        if (vp && vp._oceanOpen) requestAnimationFrame(() => vp._oceanOpen());
    }

    // ── Init ────────────────────────────────────────
    function init() {
        $("starmap-back").addEventListener("click", () => window.eduApp.showScreen("home"));
        $("lb-back").addEventListener("click", () => window.eduApp.showScreen("home"));
        wireMapIslands();
        wireSkyPortals();
        setupOceanParallax();
    }

    window.starMap = {
        open: () => { loadStarMap(); window.eduApp.showScreen("starmap"); openOceanMap(); },
    };
    window.leaderboard = {
        open: () => {
            bindLbTabs();
            loadLeaderboard();
            window.eduApp.showScreen("leaderboard");
        },
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
