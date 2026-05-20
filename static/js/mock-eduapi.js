/**
 * Mock EduArena API + namespace
 * 假裝有 eduApi/eduApp 後端，讓 starmap.js 跑得起來 standalone。
 * 真實 EduArena 程式碼一行不改，回收只要把 starmap.js/css 複製貼回去即可。
 */
(function () {
    "use strict";

    // ── 假星圖資料（5 科 × 6 年級 × 章節） ──────────────────────
    const FAKE_TOPICS = {
        chinese: ["注音符號", "字音字形", "詞語造句", "閱讀理解", "成語典故", "新詩賞析"],
        english: ["字母 ABC", "簡單問候", "日常單字", "短句聽力", "閱讀小品", "對話練習"],
        math: ["加減運算", "乘除運算", "分數小數", "幾何圖形", "比例應用", "代數初步"],
        science: ["生物觀察", "物質變化", "力與運動", "天氣季節", "生態系統", "能源科學"],
        social: ["家庭社區", "台灣地理", "歷史故事", "公民教育", "世界文化", "經濟生活"],
    };

    function makeGrades(subject) {
        const grades = {};
        ["1", "2", "3", "4", "5", "6"].forEach((g, idx) => {
            const unlocked = idx < 4;
            if (!unlocked) {
                grades[g] = { unlocked: false, total_stars: 0, max_stars: 0, topics: [] };
                return;
            }
            const topics = FAKE_TOPICS[subject].slice(0, 4 + (idx % 2)).map((name, i) => ({
                name,
                stars: Math.max(0, 3 - ((i + idx) % 4)),
            }));
            const total = topics.reduce((a, t) => a + t.stars, 0);
            const max = topics.length * 3;
            grades[g] = { unlocked: true, total_stars: total, max_stars: max, topics };
        });
        return grades;
    }

    const FAKE_STARMAP = {
        total_stars: 87,
        max_stars: 150,
        map: [
            { subject: "chinese", name: "國語島", grades: makeGrades("chinese") },
            { subject: "english", name: "英文島", grades: makeGrades("english") },
            { subject: "math",    name: "數學島", grades: makeGrades("math") },
            { subject: "science", name: "自然島", grades: makeGrades("science") },
            { subject: "social",  name: "社會島", grades: makeGrades("social") },
        ],
    };

    // ── 假 eduApi：回 Response-like 物件 ─────────────────────
    window.eduApi = async function (path) {
        if (path === "/api/starmap") {
            return { json: async () => FAKE_STARMAP };
        }
        // 排行榜在 demo 站不開啟，但保險回空避免噴錯
        return { json: async () => ({ leaderboard: [], week: "demo" }) };
    };

    // ── 假 eduApp：showScreen 切 .active class ─────────────────
    window.eduApp = {
        showScreen: function (id) {
            document.querySelectorAll(".screen").forEach(function (s) {
                s.classList.remove("active");
            });
            const el = document.getElementById("screen-" + id);
            if (el) el.classList.add("active");
        },
    };

    // ── Demo Modal：點島彈窗 ──────────────────────────────
    const SUBJ_LABEL = {
        math: "數學島", chinese: "國語島", english: "英文島",
        science: "自然島", social: "社會島",
    };
    const SUBJ_ICON = {
        math: "🔢", chinese: "📖", english: "🔤",
        science: "🔬", social: "🌏",
    };

    function showDemoModal(opts) {
        const modal = document.getElementById("demo-modal");
        if (!modal) return;
        document.getElementById("demo-modal-icon").textContent = opts.icon || "✨";
        document.getElementById("demo-modal-title").textContent = opts.title || "技術 Demo";
        document.getElementById("demo-modal-body").innerHTML = opts.body || "";
        modal.classList.add("show");
    }
    window.showDemoModal = showDemoModal;

    // ── 5 個科目島：點下去顯示 demo 彈窗 ─────────────────
    ["math", "chinese", "english", "science", "social"].forEach(function (subj) {
        window[subj + "Island"] = {
            open: function () {
                showDemoModal({
                    icon: SUBJ_ICON[subj],
                    title: SUBJ_LABEL[subj],
                    body: "這是<b>地圖技術展示</b>頁。<br>正式版本可在此進入完整<b>" +
                          SUBJ_LABEL[subj] + "</b>題庫，<br>提供章節練習、聽力測驗、PK 對戰等功能。",
                });
            },
        };
    });

    window.bossIsland = {
        start: function (subject) {
            showDemoModal({
                icon: "👹",
                title: "魔王戰（" + (SUBJ_LABEL[subject] || subject) + "）",
                body: "正式版可挑戰<b>三階魔王</b>，<br>累積學習成果換取榮譽勳章。",
            });
        },
    };

    window.examSystem = {
        openCenter: function (tab) {
            const TAB_LABEL = { cert: "檢定考", mock: "模擬考", history: "考試回顧" };
            showDemoModal({
                icon: "🎓",
                title: TAB_LABEL[tab] || "考試中心",
                body: "正式版提供 <b>5 科檢定考與模擬考</b>，<br>通過即可獲得認證證書。",
            });
        },
        startComprehensive: function () {
            showDemoModal({
                icon: "🌟",
                title: "綜合檢定考",
                body: "正式版可進行<b>跨 5 科同年級 20 題</b>綜合檢定，<br>挑戰全方位學科實力。",
            });
        },
    };

    // ── 修正：starmap.js 內 SUBJ_ICONS 用的是 emoji-style img，
    //     原 EduArena 各科 icon 已隨資產複製過來，路徑相同直接可用。
    //     star_filled/lock/chart icon 同。
})();
