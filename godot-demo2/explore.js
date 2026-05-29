// godot-demo2 Phaser 版 — 2.5D 大富翁風村莊
// 全部 driven by /assets/village_config.json
// 派派用 map-editor.html?map=village 編輯 → 推 GitHub → 自動上線

const CONFIG_URL = "../assets/village_config.json";

class ExploreScene extends Phaser.Scene {
  constructor() { super("explore"); }

  preload() {
    this.load.json("village", CONFIG_URL + "?v=" + Date.now());
  }

  create() {
    const config = this.cache.json.get("village").map_config;
    this.config = config;
    const dim = config.dimensions;
    this.IMG_W = dim.image_width;
    this.IMG_H = dim.image_height;
    this.WORLD_W = dim.world_width;
    this.WORLD_H = dim.world_height;
    this.WORLD_OFFSET_Y = dim.world_offset_y;  // ground 放在 (0, -400)
    this.SKY_PAD = (config.camera && config.camera.sky_pad) || 400;
    this.VIEW_BASE_WIDTH = (config.camera && config.camera.view_base_width) || 1200;

    // asset_base 是相對 repo 根的路徑 (e.g. "godot-demo2/")
    // 從 godot-demo2/index.html 出發要 "../" 跳到 repo 根
    this.assetBase = "../" + (config.asset_base || "");

    // Stage 1: 預載所有 asset 後進入第二階段
    this.load.image("village_ground", "../" + config.background + "?v=1");
    config.buildings.forEach(b => {
      if (b.sprite && b.sprite.image) {
        if (!this.textures.exists(b.sprite.image)) {
          this.load.image(b.sprite.image, this.assetBase + b.sprite.image + "?v=5");
        }
      }
    });
    // Player sprites（3 方向）
    const ps = config.player.sprites;
    this.load.spritesheet("hero",      this.assetBase + ps.side.image + "?v=2", { frameWidth: ps.side.frame_width, frameHeight: ps.side.frame_height });
    this.load.spritesheet("hero_down", this.assetBase + ps.down.image + "?v=2", { frameWidth: ps.down.frame_width, frameHeight: ps.down.frame_height });
    this.load.spritesheet("hero_up",   this.assetBase + ps.up.image   + "?v=2", { frameWidth: ps.up.frame_width,   frameHeight: ps.up.frame_height });

    // NPC sprites（每隻 NPC 可帶自己的 side/down/up；沒給就 fallback 用 hero）
    if (Array.isArray(config.npcs)) {
      config.npcs.forEach(npcCfg => {
        const sCfg = npcCfg.sprite && npcCfg.sprite.sprites;
        if (!sCfg) return;
        ["side", "down", "up"].forEach(dir => {
          const def = sCfg[dir];
          if (!def || !def.image) return;
          const key = `npc_${npcCfg.id}_${dir}`;
          if (!this.textures.exists(key)) {
            this.load.spritesheet(key, this.assetBase + def.image + "?v=1",
              { frameWidth: def.frame_width, frameHeight: def.frame_height });
          }
        });
      });
    }

    this.load.once("complete", () => this._buildScene());
    this.load.start();
  }

  // 把 normalized image coord (0-1) 轉成 world coord
  _nx(nx) { return nx * this.IMG_W; }
  _ny(ny) { return ny * this.IMG_H + this.WORLD_OFFSET_Y; }
  _nbbox(bb) {
    const x = this._nx(bb.x_min);
    const y = this._ny(bb.y_min);
    const w = this._nx(bb.x_max - bb.x_min);
    const h = (bb.y_max - bb.y_min) * this.IMG_H;
    return { cx: x + w/2, cy: y + h/2, w, h };
  }

  _buildScene() {
    const config = this.config;

    // 1. 背景
    this.add.image(0, this.WORLD_OFFSET_Y, "village_ground").setOrigin(0, 0).setDepth(0);

    // 1b. 水珠紋理（Phaser Graphics 即時畫，給粒子噴泉用）
    if (!this.textures.exists("water_drop")) {
      const g = this.add.graphics();
      g.fillStyle(0xa0d8ff, 1);
      g.fillCircle(7, 7, 7);
      g.fillStyle(0xe0f0ff, 0.6);
      g.fillCircle(5, 5, 3);
      g.generateTexture("water_drop", 14, 14);
      g.destroy();
    }

    // 2. Buildings：sprite + collision + interaction
    this.interactables = [];
    this.obstacles = this.physics.add.staticGroup();
    config.buildings.forEach(b => {
      // Sprite
      if (b.sprite && b.sprite.image && this.textures.exists(b.sprite.image)) {
        const anchor = { x: this._nx(b.anchor.x), y: this._ny(b.anchor.y) };
        const spr = this.add.image(anchor.x, anchor.y, b.sprite.image);
        spr.setOrigin(b.sprite.anchor_x || 0.5, b.sprite.anchor_y || 1.0);
        spr.setScale(b.sprite.scale || 1.0);
        spr.setDepth(anchor.y);
        // 噴泉自動加連續粒子水流（fountain_splash 互動類型）
        if (b.interaction && b.interaction.type === "fountain_splash") {
          this._addFountainParticles(anchor.x, anchor.y);
        }
      }
      // Collision bbox
      if (b.bounding_box) {
        const bb = this._nbbox(b.bounding_box);
        const body = this.add.rectangle(bb.cx, bb.cy, bb.w, bb.h, 0xff0000, 0).setVisible(false);
        this.physics.add.existing(body, true);
        this.obstacles.add(body);
      }
      // Interaction
      if (b.interaction) {
        const a = b.anchor;
        this.interactables.push({
          cx: this._nx(a.x), cy: this._ny(a.y),
          radius: b.interaction.radius || 110,
          type: b.interaction.type,
          label: b.interaction.label || b.name,
          body: b.interaction.body || "",
        });
      }
    });

    // 3. Obstacle areas (polygon) → 切多 rect 加進 collider
    if (Array.isArray(config.obstacle_areas)) {
      config.obstacle_areas.forEach(area => {
        if (!area.polygon || area.polygon.length < 3) return;
        // polygon → world coords
        const pts = area.polygon.map(p => ({ x: this._nx(p.x), y: this._ny(p.y) }));
        const rects = this._polygonToRects(pts, 30);
        rects.forEach(r => {
          const body = this.add.rectangle(r.cx, r.cy, r.w, r.h, 0x0000ff, 0).setVisible(false);
          this.physics.add.existing(body, true);
          this.obstacles.add(body);
        });
      });
    }

    // 4. Player
    const p = config.player;
    const PX = this._nx(p.spawn.x), PY = this._ny(p.spawn.y);
    this.PLAYER_SPEED = p.speed || 220;
    this.playerShadow = this.add.ellipse(PX, PY + 12, 56, 16, 0x000000, 0.4);
    this.player = this.add.rectangle(PX, PY, 22, 22, 0xffffff, 0).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setSize(22, 22);
    this.player.body.setCollideWorldBounds(true);
    this.playerSprite = this.add.sprite(PX, PY + 22, "hero", 0);
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(p.scale || 0.66);

    // 5. 動畫
    this.anims.create({ key: "hero_walk",      frames: this.anims.generateFrameNumbers("hero",      { start: 0, end: (p.sprites.side.frames || 9) - 1  }), frameRate: p.sprites.side.frame_rate || 12, repeat: -1 });
    this.anims.create({ key: "hero_walk_down", frames: this.anims.generateFrameNumbers("hero_down", { start: 0, end: (p.sprites.down.frames || 25) - 1 }), frameRate: p.sprites.down.frame_rate || 14, repeat: -1 });
    this.anims.create({ key: "hero_walk_up",   frames: this.anims.generateFrameNumbers("hero_up",   { start: 0, end: (p.sprites.up.frames   || 16) - 1 }), frameRate: p.sprites.up.frame_rate || 14, repeat: -1 });
    this.anims.create({ key: "hero_idle",      frames: [{ key: "hero_down", frame: 0 }],                                                                  frameRate: 1                                });
    this.playerSprite.play("hero_idle");

    this.physics.add.collider(this.player, this.obstacles);

    // 6. NPCs
    this.npcs = [];
    if (Array.isArray(config.npcs)) {
      config.npcs.forEach(npcCfg => {
        const sp = npcCfg.spawn;
        const id = npcCfg.id;
        const sCfg = npcCfg.sprite && npcCfg.sprite.sprites;

        // 解析每方向 texture + anim key（自帶 spritesheet 用自己的，否則 fallback hero）
        const resolveDir = (dir, fallbackTex, fallbackAnim) => {
          const def = sCfg && sCfg[dir];
          const texKey = `npc_${id}_${dir}`;
          if (def && def.image && this.textures.exists(texKey)) {
            const animKey = `npc_${id}_walk_${dir}`;
            if (!this.anims.exists(animKey)) {
              this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(texKey,
                  { start: 0, end: (def.frames || ((def.grid_cols || 1) * (def.grid_rows || 1))) - 1 }),
                frameRate: def.frame_rate || 8,
                repeat: -1,
              });
            }
            return { tex: texKey, anim: animKey };
          }
          return { tex: fallbackTex, anim: fallbackAnim };
        };
        const dSide = resolveDir("side", "hero", "hero_walk");
        // 若 NPC 自帶 sprites 但只給 side（單張 NPC），down/up 共用 side；
        // 完全沒 sprites（舊 villager_01）才走 hero 三方向 fallback。
        const dDown = resolveDir("down",
          sCfg ? dSide.tex : "hero_down",
          sCfg ? dSide.anim : "hero_walk_down");
        const dUp   = resolveDir("up",
          sCfg ? dSide.tex : "hero_up",
          sCfg ? dSide.anim : "hero_walk_up");

        const npc = {
          cfg: npcCfg,
          body: this.add.rectangle(this._nx(sp.x), this._ny(sp.y), 22, 22, 0xffffff, 0).setVisible(false),
          shadow: this.add.ellipse(this._nx(sp.x), this._ny(sp.y) + 12, 56, 16, 0x000000, 0.35),
          sprite: null,
          patrolIdx: 0,
          animKeys: { side: dSide.anim, down: dDown.anim, up: dUp.anim },
        };
        npc.sprite = this.add.sprite(npc.body.x, npc.body.y + 22, dSide.tex, 0);
        npc.sprite.setOrigin(0.5, 1);
        npc.sprite.setScale((npcCfg.sprite && npcCfg.sprite.scale) || 0.66);
        if (npcCfg.sprite && npcCfg.sprite.tint) {
          const tintNum = parseInt(npcCfg.sprite.tint.replace("#", ""), 16);
          npc.sprite.setTint(tintNum);
        }
        npc.sprite.play(dSide.anim);
        this.npcs.push(npc);
      });
    }

    // 7. World bounds + camera
    this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.cameras.main.setBounds(0, -this.SKY_PAD, this.WORLD_W, this.WORLD_H + this.SKY_PAD);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this._adjustZoom();

    // 8. 鍵盤輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.input.keyboard.on("keydown-SPACE", () => this._tryInteract());
    this.input.keyboard.on("keydown-ENTER", () => this._tryInteract());

    // 9. 虛擬搖桿 + A 鈕
    this._buildTouchUI();
    this.scale.on("resize", () => this._onResize());

    // 10. State
    this.currentInteractable = null;
    this.modalOpen = false;
  }

  _buildTouchUI() {
    const baseR = 70, stickR = 30;
    const jx = baseR + 30, jy = this.scale.height - baseR - 30;
    this.joyBase  = this.add.circle(jx, jy, baseR,  0x000000, 0.28).setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(10000);
    this.joyThumb = this.add.circle(jx, jy, stickR, 0xffffff, 0.7 ).setStrokeStyle(2, 0x101010, 0.7 ).setScrollFactor(0).setDepth(10001);
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: jx, y: jy, radius: baseR, base: this.joyBase, thumb: this.joyThumb,
      dir: "8dir", forceMin: 16,
    });
    const aR = 44;
    const ax = this.scale.width - aR - 30, ay = this.scale.height - aR - 30;
    this.aBtn = this.add.circle(ax, ay, aR, 0xfad440, 0.4).setStrokeStyle(3, 0x101010, 0.85).setScrollFactor(0).setDepth(10000).setInteractive();
    this.aBtnText = this.add.text(ax, ay, "A", { fontFamily: "sans-serif", fontSize: 26, color: "#1a0d00", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    this.aBtnHint = this.add.text(ax, ay - aR - 18, "", {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif", fontSize: 14, color: "#fff",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10002).setVisible(false);
    this.aBtn.on("pointerdown", () => { if (this.currentInteractable) this.aBtn.setFillStyle(0xc4a020, 1.0); });
    this.aBtn.on("pointerup", () => { this._tryInteract(); this._refreshAButtonStyle(); });
    this.aBtn.on("pointerout", () => this._refreshAButtonStyle());
  }

  _adjustZoom() {
    const sw = this.scale.width, sh = this.scale.height;
    const aspectThreshold = this.VIEW_BASE_WIDTH / this.WORLD_H;  // ~1.111
    const z = (sw / sh) >= aspectThreshold ? sw / this.VIEW_BASE_WIDTH : sh / this.WORLD_H;
    this.cameras.main.setZoom(z);
  }

  _onResize() {
    this._adjustZoom();
    const baseR = 70, aR = 44;
    const jx = baseR + 30, jy = this.scale.height - baseR - 30;
    this.joyBase.setPosition(jx, jy);
    this.joyThumb.setPosition(jx, jy);
    this.joystick.setPosition(jx, jy);
    const ax = this.scale.width - aR - 30, ay = this.scale.height - aR - 30;
    this.aBtn.setPosition(ax, ay);
    this.aBtnText.setPosition(ax, ay);
    this.aBtnHint.setPosition(ax, ay - aR - 18);
  }

  _refreshAButtonStyle() {
    this.aBtn.setFillStyle(0xfad440, this.currentInteractable ? 1.0 : 0.4);
  }

  _tryInteract() {
    if (this.modalOpen) return;
    const item = this.currentInteractable;
    if (!item) return;
    if (item.type === "open_modal") this._showModal(item);
    else if (item.type === "fountain_splash") this._fountainSplash(item.cx, item.cy - 100);
  }

  _showModal(item) {
    this.modalOpen = true;
    const sw = this.scale.width, sh = this.scale.height;
    this.modalContainer = this.add.container(sw/2, sh/2).setScrollFactor(0).setDepth(20000);
    const backdrop = this.add.rectangle(0, 0, sw*3, sh*3, 0x000000, 0.55).setInteractive();
    const box = this.add.rectangle(0, 0, 360, 200, 0xfff8e0).setStrokeStyle(5, 0x4a3520);
    const title = this.add.text(0, -55, item.label, {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 30, color: "#4a3520", fontStyle: "bold",
    }).setOrigin(0.5);
    const body = this.add.text(0, 0, item.body, {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 18, color: "#4a3520",
    }).setOrigin(0.5);
    const closeBtn = this.add.text(0, 60, "[ 關閉 ]", {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 20, color: "#a04020", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive();
    const closeFn = () => {
      if (this.modalContainer) { this.modalContainer.destroy(); this.modalContainer = null; }
      this.modalOpen = false;
    };
    closeBtn.on("pointerdown", closeFn);
    backdrop.on("pointerdown", closeFn);
    this.modalContainer.add([backdrop, box, title, body, closeBtn]);
  }

  _addFountainParticles(anchorX, anchorY) {
    // 連續水流粒子（從噴泉頂端噴出，重力往下落）
    // 噴泉視覺頂端在 anchor 上方 ~140 px（fountain sprite 中段）
    const topY = anchorY - 140;
    // 主水柱：往上噴 + 重力下落
    this.add.particles(anchorX, topY, "water_drop", {
      speed: { min: 60, max: 110 },
      angle: { min: 255, max: 285 },   // 往上 ±15 度散
      gravityY: 280,
      lifespan: 900,
      alpha: { start: 0.85, end: 0 },
      scale: { start: 0.7, end: 0.25 },
      frequency: 70,
      quantity: 1,
    }).setDepth(anchorY + 1);  // 比噴泉 sprite 稍前
    // 環流（盆口邊緣輕微飄）
    this.add.particles(anchorX, topY + 30, "water_drop", {
      speed: { min: 20, max: 40 },
      angle: { min: 200, max: 340 },
      gravityY: 100,
      lifespan: 600,
      alpha: { start: 0.5, end: 0 },
      scale: { start: 0.4, end: 0.15 },
      frequency: 150,
      quantity: 1,
    }).setDepth(anchorY + 1);
  }

  _fountainSplash(fx, fy) {
    for (let i = 0; i < 12; i++) {
      const drop = this.add.circle(
        fx + Phaser.Math.Between(-10, 10),
        fy + Phaser.Math.Between(-6, 6),
        Phaser.Math.Between(5, 8),
        0x86d4ff, 0.9
      ).setStrokeStyle(1.5, 0x4080a0, 0.8).setDepth(9999);
      const angle = Phaser.Math.DegToRad(-90 + (i - 6) * 14);
      const dist = Phaser.Math.Between(70, 120);
      this.tweens.add({
        targets: drop,
        x: fx + Math.cos(angle) * dist,
        y: fy + Math.abs(Math.sin(angle)) * 50 + 90,
        alpha: 0, scale: 0.3,
        duration: 800 + Math.random() * 300,
        ease: "Quad.easeOut",
        onComplete: () => drop.destroy(),
      });
    }
  }

  // polygon → multiple rectangle approximation (scan-line)
  _polygonToRects(pts, bandH) {
    if (pts.length < 3) return [];
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const rects = [];
    for (let y = minY; y < maxY; y += bandH) {
      const ymid = y + bandH / 2;
      // 找出 polygon 在 y=ymid 的 horizontal extent
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a.y <= ymid && b.y > ymid) || (b.y <= ymid && a.y > ymid)) {
          const t = (ymid - a.y) / (b.y - a.y);
          xs.push(a.x + t * (b.x - a.x));
        }
      }
      xs.sort((a, b) => a - b);
      // 兩兩 pair = inside polygon
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xL = xs[i], xR = xs[i+1];
        if (xR - xL > 10) {
          rects.push({ cx: (xL + xR) / 2, cy: y + bandH/2, w: xR - xL, h: bandH });
        }
      }
    }
    return rects;
  }

  _updateNPC(npc, delta) {
    if (!npc.cfg.patrol || npc.cfg.patrol.length === 0) return;
    const target = npc.cfg.patrol[npc.patrolIdx];
    const tx = this._nx(target.x), ty = this._ny(target.y);
    const dx = tx - npc.body.x, dy = ty - npc.body.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      npc.patrolIdx = (npc.patrolIdx + 1) % npc.cfg.patrol.length;
    } else {
      const step = ((npc.cfg.speed || 60) * delta) / 1000;
      npc.body.x += (dx / dist) * step;
      npc.body.y += (dy / dist) * step;
    }
    npc.sprite.x = npc.body.x;
    npc.sprite.y = npc.body.y + 22;
    npc.shadow.x = npc.body.x;
    npc.shadow.y = npc.body.y + 18;
    npc.sprite.setDepth(npc.sprite.y);
    npc.shadow.setDepth(npc.sprite.y - 1);
    const horizMore = Math.abs(dx) > Math.abs(dy);
    const keys = npc.animKeys;
    let want = keys.side;
    if (!horizMore) want = dy > 0 ? keys.down : keys.up;
    const cur = npc.sprite.anims.currentAnim;
    if (!cur || cur.key !== want) npc.sprite.play(want);
    if (want === keys.side) npc.sprite.setFlipX(dx > 0);
    else npc.sprite.setFlipX(false);
  }

  _updateInteractable() {
    let nearest = null;
    let bestDist = Infinity;
    const px = this.player.x, py = this.player.y;
    for (const it of this.interactables) {
      const d = Math.hypot(px - it.cx, py - it.cy);
      if (d < it.radius && d < bestDist) { nearest = it; bestDist = d; }
    }
    // NPC 動態
    for (const npc of this.npcs) {
      if (!npc.cfg.interaction) continue;
      const r = npc.cfg.interaction.radius || 110;
      const d = Math.hypot(px - npc.body.x, py - npc.body.y);
      if (d < r && d < bestDist) {
        nearest = {
          cx: npc.body.x, cy: npc.body.y,
          type: npc.cfg.interaction.type || "open_modal",
          label: npc.cfg.interaction.label || npc.cfg.name,
          body: npc.cfg.interaction.body || "",
        };
        bestDist = d;
      }
    }

    if (nearest !== this.currentInteractable) {
      this.currentInteractable = nearest;
      this._refreshAButtonStyle();
      if (nearest) this.aBtnHint.setText(`A: ${nearest.label}`).setVisible(true);
      else this.aBtnHint.setVisible(false);
    } else if (nearest) {
      this.aBtnHint.setText(`A: ${nearest.label}`);
    }
  }

  update(time, delta) {
    if (!this.player) return;  // scene loading
    let dx = 0, dy = 0;
    if (!this.modalOpen) {
      if (this.cursors.left.isDown  || this.wasd.A.isDown) dx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
      if (this.cursors.up.isDown    || this.wasd.W.isDown) dy -= 1;
      if (this.cursors.down.isDown  || this.wasd.S.isDown) dy += 1;
      if (this.joystick.force > 0.05) {
        const rad = Phaser.Math.DegToRad(this.joystick.angle);
        dx = Math.cos(rad); dy = Math.sin(rad);
      }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.player.body.setVelocity(dx * this.PLAYER_SPEED, dy * this.PLAYER_SPEED);

    this.playerSprite.x = this.player.x;
    this.playerSprite.y = this.player.y + 22;
    this.playerShadow.x = this.player.x;
    this.playerShadow.y = this.player.y + 18;
    this.playerSprite.setDepth(this.playerSprite.y);
    this.playerShadow.setDepth(this.playerSprite.y - 1);

    const moving = Math.hypot(dx, dy) > 0.1;
    const horizMore = Math.abs(dx) > Math.abs(dy);
    let wantAnim = "hero_idle";
    if (moving) {
      if (horizMore)      wantAnim = "hero_walk";
      else if (dy > 0)    wantAnim = "hero_walk_down";
      else                wantAnim = "hero_walk_up";
    }
    const cur = this.playerSprite.anims.currentAnim;
    if (!cur || cur.key !== wantAnim) this.playerSprite.play(wantAnim);
    if (wantAnim === "hero_walk") {
      if (dx >  0.1) this.playerSprite.setFlipX(true);
      else if (dx < -0.1) this.playerSprite.setFlipX(false);
    } else {
      this.playerSprite.setFlipX(false);
    }

    if (!this.modalOpen) for (const npc of this.npcs) this._updateNPC(npc, delta);
    this._updateInteractable();
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
  plugins: {
    global: [
      { key: "rexVirtualJoystick", plugin: rexvirtualjoystickplugin, start: true },
    ],
  },
  backgroundColor: "#8cb45a",
  scene: ExploreScene,
  render: { pixelArt: false, antialias: true },
});
