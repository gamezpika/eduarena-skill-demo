/**
 * CombatEngine — 模組化戰鬥引擎
 *
 * 派派 5/23：把 demo 散落的 attackBoss/getHitByBoss 抽成可擴展系統。
 *
 * 設計：
 *   - Phase machine: Idle → Dash → Impact → Reset
 *   - Data-driven: registerUnit / registerSkill / registerVfx → 加新技能不改 engine code
 *   - 事件鉤子：on('hit_landed') / on('unit_defeated') / on('action_end')
 *
 * 用法：
 *   const engine = new CombatEngine(stageEl);
 *   engine.registerUnit('hero', heroEl, { hp: 100, atk: 50, def: 5 });
 *   engine.registerSkill('slash', { dashAnim: 'attacking-sword', impactVfx: 'arc_yellow', dashMs: 300, impactMs: 500 });
 *   engine.registerVfx('arc_yellow', { class: 'hit-flash weapon-sword', duration: 700, particles: 6, particleClass: 'hit-particle' });
 *   await engine.executeAction({ sourceId: 'hero', targetId: 'boss', skillKey: 'slash' });
 *
 *   // 新技能不改 engine code，1 行加完
 *   engine.registerSkill('triple_slash', { dashAnim: 'attacking-sword', impactVfx: 'arc_yellow', repeats: 3, repeatInterval: 200, damageMul: 0.45 });
 */
class CombatEngine {
    constructor(stageEl) {
        this.stage = stageEl;
        this.units = new Map();
        this.skills = new Map();
        this.vfxLib = new Map();
        this.listeners = new Map();
    }

    // ============ 註冊 API ============

    registerUnit(id, spriteEl, stats = {}) {
        this.units.set(id, {
            id, el: spriteEl,
            hp: stats.hp ?? 100,
            maxHp: stats.maxHp ?? stats.hp ?? 100,
            mp: stats.mp ?? 50,
            maxMp: stats.maxMp ?? stats.mp ?? 50,
            atk: stats.atk ?? 50,
            def: stats.def ?? 5,
            buffs: [],
            ...stats,
        });
        return this;
    }

    unregisterUnit(id) { this.units.delete(id); return this; }

    updateUnit(id, stats) {
        const u = this.units.get(id);
        if (u) Object.assign(u, stats);
        return this;
    }

    getUnit(id) { return this.units.get(id); }

    registerSkill(key, def) {
        this.skills.set(key, {
            dashAnim: null,           // CSS class added to source.el during dash
            impactVfx: null,          // VFX key (from vfxLib)
            impactAnim: 'hit',        // CSS class added to target.el during impact
            dashMs: 300,
            impactMs: 500,
            resetMs: 100,
            damageMul: 1.0,
            repeats: 1,
            repeatInterval: 0,
            costMp: 0,
            targetSelf: false,        // 目標是自己（治癒等）
            heal: false,              // 治療型（dmg 變正向加血）
            screenShake: false,       // 衝擊鏡頭震動
            ...def,
        });
        return this;
    }

    registerVfx(key, def) {
        this.vfxLib.set(key, {
            class: '',
            duration: 500,
            particles: 0,
            particleClass: 'hit-particle',
            ...def,
        });
        return this;
    }

    // ============ 事件 ============

    on(event, cb) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(cb);
        return this;
    }

    _emit(event, payload) {
        (this.listeners.get(event) || []).forEach(cb => {
            try { cb(payload); } catch (e) { console.error('[CombatEngine] listener error:', e); }
        });
    }

    // ============ 核心戰鬥動作 ============

    async executeAction({ sourceId, targetId, skillKey, customDamage }) {
        const source = this.units.get(sourceId);
        const target = skillKey && this.skills.get(skillKey)?.targetSelf ? source : this.units.get(targetId);
        const skill = this.skills.get(skillKey);

        if (!source || !target || !skill) {
            console.warn('[CombatEngine] missing entity', { sourceId, targetId, skillKey });
            return { ok: false, reason: 'missing_entity' };
        }
        if (source.mp < skill.costMp) {
            this._emit('skill_blocked', { reason: 'not_enough_mp', source, skill });
            return { ok: false, reason: 'not_enough_mp' };
        }
        source.mp -= skill.costMp;

        this._emit('action_start', { source, target, skill });

        const totalDmg = customDamage ?? this._calcDamage(source, target, skill);
        const hits = Math.max(1, skill.repeats);
        const dmgPerHit = Math.floor(totalDmg / hits);

        // Phase 1: dash
        await this._dashPhase(source, target, skill);

        // Phase 2: impact (可重複)
        for (let i = 0; i < hits; i++) {
            await this._impactPhase(source, target, dmgPerHit, skill);
            if (i < hits - 1) await this._sleep(skill.repeatInterval);
            if (!skill.heal && target.hp <= 0) break;
        }

        // Phase 3: reset
        await this._resetPhase(source, skill);

        this._emit('action_end', { source, target, skill });
        return { ok: true, totalDmg, targetHp: target.hp };
    }

    // ============ 階段實作 ============

    async _dashPhase(source, target, skill) {
        if (skill.dashAnim) source.el.classList.add(skill.dashAnim);
        if (skill.screenShake) this.stage.classList.add('impact');
        await this._sleep(skill.dashMs);
    }

    async _impactPhase(source, target, dmg, skill) {
        const vfx = this.vfxLib.get(skill.impactVfx);
        if (vfx) this._spawnVfx(vfx, target);
        if (skill.impactAnim && !skill.heal) target.el.classList.add(skill.impactAnim);

        // 數值回饋
        if (skill.heal) {
            target.hp = Math.min(target.maxHp, target.hp + dmg);
            this._emit('heal_landed', { source, target, amount: dmg, skill });
        } else {
            this._applyDamage(target, dmg);
            this._emit('hit_landed', { source, target, dmg, skill });
        }

        if (navigator.vibrate) navigator.vibrate(skill.screenShake ? 50 : 30);
        await this._sleep(skill.impactMs);

        if (skill.impactAnim && !skill.heal) target.el.classList.remove(skill.impactAnim);
        if (skill.screenShake) this.stage.classList.remove('impact');
    }

    async _resetPhase(source, skill) {
        if (skill.dashAnim) source.el.classList.remove(skill.dashAnim);
        await this._sleep(skill.resetMs);
    }

    // ============ Helper ============

    _spawnVfx(vfxDef, target) {
        const rect = target.el.getBoundingClientRect();
        const stageRect = this.stage.getBoundingClientRect();
        const cx = rect.left - stageRect.left + rect.width / 2;
        const cy = rect.top  - stageRect.top  + rect.height / 2;

        // 主特效圖層
        const div = document.createElement('div');
        div.className = vfxDef.class;
        div.style.left = cx + 'px';
        div.style.top  = cy + 'px';
        this.stage.appendChild(div);
        setTimeout(() => div.remove(), vfxDef.duration);

        // 粒子
        for (let i = 0; i < vfxDef.particles; i++) {
            this._spawnParticle(vfxDef.particleClass, cx, cy, i, vfxDef.particles);
        }
    }

    _spawnParticle(cls, cx, cy, idx, total) {
        const angle = (idx / total) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 50 + Math.random() * 30;
        const p = document.createElement('div');
        p.className = cls;
        p.style.left = cx + 'px';
        p.style.top  = cy + 'px';
        p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
        p.style.setProperty('--px-mid', Math.cos(angle) * dist * 0.5 + 'px');
        p.style.setProperty('--py-mid', Math.sin(angle) * dist * 0.5 + 'px');
        this.stage.appendChild(p);
        setTimeout(() => p.remove(), 850);
    }

    _applyDamage(unit, dmg) {
        unit.hp = Math.max(0, unit.hp - dmg);
        if (unit.hp <= 0) this._emit('unit_defeated', { unit });
    }

    _calcDamage(source, target, skill) {
        const base = source.atk * (skill.damageMul || 1);
        const def = target.def || 0;
        return Math.max(1, Math.floor(base - def * 0.5));
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

if (typeof window !== 'undefined') window.CombatEngine = CombatEngine;
