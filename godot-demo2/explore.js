// godot-demo2 Phaser 版 — 2.5D 大富翁風村莊
// Layout: village_ground.jpg 1920x1480 底圖（含上方 400 px 草地）+ 5 房子 + 噴泉 + 8 綠樹
//          chibi 小男孩 4 方向 walk + Y-sort + 房子/噴泉/樹/河流碰撞 + A 鈕互動 + NPC

const MAP_W = 1920;
const MAP_H = 1080;
const PLAYER_SPEED = 220;
const NPC_SPEED = 60;
const VIEW_BASE_WIDTH = 1200;
const INTERACT_RADIUS = 110;

// 派派 5/29 手動指定座標
const VILLAGE_SPRITES = [
  { key: "house_red",    x: 300,  y: 300, scale: 0.74 },
  { key: "house_brown",  x: 960,  y: 250, scale: 0.74 },
  { key: "house_blue",   x: 1500, y: 300, scale: 0.74 },
  { key: "house_green",  x: 300,  y: 670, scale: 0.74 },
  { key: "house_yellow", x: 1660, y: 680, scale: 0.74 },
  { key: "fountain",     x: 960,  y: 600, scale: 0.54 },
  { key: "tree_green",   x: 60,   y: 200, scale: 0.36 },
  { key: "tree_green",   x: 630,  y: 250, scale: 0.36 },
  { key: "tree_green",   x: 1230, y: 250, scale: 0.36 },
  { key: "tree_green",   x: 1900, y: 250, scale: 0.36 },
  { key: "tree_green",   x: 630,  y: 530, scale: 0.36 },
  { key: "tree_green",   x: 1230, y: 530, scale: 0.36 },
  { key: "tree_green",   x: 630,  y: 900, scale: 0.36 },
  { key: "tree_green",   x: 1230, y: 900, scale: 0.36 },
];

// 物件 footprint hitbox
const OBSTACLES = [
  { cx: 300,  cy: 280, w: 280, h: 60 },   // red
  { cx: 960,  cy: 230, w: 280, h: 60 },   // brown
  { cx: 1500, cy: 280, w: 280, h: 60 },   // blue
  { cx: 300,  cy: 650, w: 280, h: 60 },   // green
  { cx: 1660, cy: 660, w: 280, h: 60 },   // yellow
  { cx: 960,  cy: 588, w: 180, h: 50 },   // fountain
  { cx: 60,   cy: 195, w: 32,  h: 24 },
  { cx: 630,  cy: 245, w: 32,  h: 24 },
  { cx: 1230, cy: 245, w: 32,  h: 24 },
  { cx: 1900, cy: 245, w: 32,  h: 24 },
  { cx: 630,  cy: 525, w: 32,  h: 24 },
  { cx: 1230, cy: 525, w: 32,  h: 24 },
  { cx: 630,  cy: 895, w: 32,  h: 24 },
  { cx: 1230, cy: 895, w: 32,  h: 24 },
];

// 河流碰撞（PIL scan-line 自動產生，橋區域 x=30-330, y=700-820 已排除，4 向 split 補橋下水塊）
const RIVER_OBSTACLES = [
  { cx: 67,  cy: 350, w: 134, h: 60 },
  { cx: 75,  cy: 410, w: 150, h: 60 },
  { cx: 89,  cy: 470, w: 179, h: 60 },
  { cx: 45,  cy: 530, w: 90,  h: 60 },
  { cx: 43,  cy: 590, w: 87,  h: 60 },
  { cx: 68,  cy: 650, w: 137, h: 60 },
  { cx: 196, cy: 690, w: 336, h: 20 },
  { cx: 347, cy: 720, w: 34,  h: 40 },
  { cx: 364, cy: 770, w: 69,  h: 60 },
  { cx: 274, cy: 840, w: 79,  h: 40 },
  { cx: 490, cy: 830, w: 139, h: 60 },
  { cx: 573, cy: 890, w: 333, h: 60 },
  { cx: 631, cy: 950, w: 394, h: 60 },
  { cx: 726, cy: 1010,w: 207, h: 60 },
  { cx: 739, cy: 1060,w: 174, h: 40 },
];

// 互動點（A 鈕觸發）
// type: "modal" → 跳 modal；"fountain" → 動畫水花
const INTERACTABLES = [
  { cx: 300,  cy: 300, label: "紅屋",   type: "modal", body: "歡迎來到紅屋" },
  { cx: 960,  cy: 250, label: "棕屋",   type: "modal", body: "歡迎來到棕屋" },
  { cx: 1500, cy: 300, label: "藍屋",   type: "modal", body: "歡迎來到藍屋" },
  { cx: 300,  cy: 670, label: "綠屋",   type: "modal", body: "歡迎來到綠屋" },
  { cx: 1660, cy: 680, label: "黃屋",   type: "modal", body: "歡迎來到黃屋" },
  { cx: 960,  cy: 540, label: "噴泉",   type: "fountain" },
];

// NPC patrol：在 plaza 周圍走 4 個點循環
const NPC_PATROL = [
  { x: 1100, y: 800 },
  { x: 1100, y: 480 },
  { x: 820,  y: 480 },
  { x: 820,  y: 800 },
];

class ExploreScene extends Phaser.Scene {
  constructor() { super("explore"); }

  preload() {
    this.load.spritesheet("hero",      "hero_walk2.png?v=2", { frameWidth: 252, frameHeight: 344 });
    this.load.spritesheet("hero_down", "hero_walk.png?v=2",  { frameWidth: 231, frameHeight: 384 });
    this.load.spritesheet("hero_up",   "hero_walk3.png?v=2", { frameWidth: 160, frameHeight: 288 });
    this.load.image("village_ground", "village_ground.jpg?v=1");
    this.load.image("house_red",      "house_red.png?v=5");
    this.load.image("house_brown",    "house_brown.png?v=5");
    this.load.image("house_blue",     "house_blue.png?v=5");
    this.load.image("house_green",    "house_green.png?v=5");
    this.load.image("house_yellow",   "house_yellow.png?v=5");
    this.load.image("fountain",       "fountain.png?v=5");
    this.load.image("tree_green",     "tree_green.png?v=4");
  }

  create() {
    // 1. 背景：ground 1920x1480 放在 (0, -400)
    this.add.image(0, -400, "village_ground").setOrigin(0, 0).setDepth(0);

    // 2. Village sprite（房子/噴泉/樹）— bottom-anchor + Y-sort
    VILLAGE_SPRITES.forEach(s => {
      const spr = this.add.image(s.x, s.y, s.key);
      spr.setOrigin(0.5, 1);
      spr.setScale(s.scale);
      spr.setDepth(s.y);
    });

    // 3. Player
    const PX = 960, PY = 730;
    this.playerShadow = this.add.ellipse(PX, PY + 12, 56, 16, 0x000000, 0.4);
    this.player = this.add.rectangle(PX, PY, 22, 22, 0xffffff, 0).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setSize(22, 22);
    this.player.body.setCollideWorldBounds(true);
    this.playerSprite = this.add.sprite(PX, PY + 22, "hero", 0);
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(0.66);

    // 4. 動畫
    this.anims.create({ key: "hero_walk",      frames: this.anims.generateFrameNumbers("hero",      { start: 0, end: 8  }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: "hero_walk_down", frames: this.anims.generateFrameNumbers("hero_down", { start: 0, end: 24 }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: "hero_walk_up",   frames: this.anims.generateFrameNumbers("hero_up",   { start: 0, end: 15 }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: "hero_idle",      frames: [{ key: "hero_down", frame: 0 }],                                    frameRate: 1                });
    this.playerSprite.play("hero_idle");

    // 5. NPC（重用 hero sprite + 紫色 tint）
    const npcStart = NPC_PATROL[0];
    this.npc = this.add.rectangle(npcStart.x, npcStart.y, 22, 22, 0xffffff, 0).setVisible(false);
    this.npcShadow = this.add.ellipse(npcStart.x, npcStart.y + 12, 56, 16, 0x000000, 0.35);
    this.npcSprite = this.add.sprite(npcStart.x, npcStart.y + 22, "hero", 0);
    this.npcSprite.setOrigin(0.5, 1);
    this.npcSprite.setScale(0.66);
    this.npcSprite.setTint(0x9a4eff);  // 紫色標識 NPC
    this.npcSprite.play("hero_walk");
    this.npcPatrolIndex = 0;

    // 6. 障礙物碰撞（房子+噴泉+樹+河流 全部）
    this.obstacles = this.physics.add.staticGroup();
    [...OBSTACLES, ...RIVER_OBSTACLES].forEach(o => {
      const body = this.add.rectangle(o.cx, o.cy, o.w, o.h, 0xff0000, 0).setVisible(false);
      this.physics.add.existing(body, true);
      this.obstacles.add(body);
    });
    this.physics.add.collider(this.player, this.obstacles);

    // 7. World bounds + camera
    const SKY_PAD = 400;
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, -SKY_PAD, MAP_W, MAP_H + SKY_PAD);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this._adjustZoom();

    // 8. 鍵盤輸入（含 SPACE / ENTER 觸發互動）
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.actKeys = this.input.keyboard.addKeys({ space: "SPACE", enter: "ENTER" });
    this.input.keyboard.on("keydown-SPACE", () => this._tryInteract());
    this.input.keyboard.on("keydown-ENTER", () => this._tryInteract());

    // 9. 虛擬搖桿
    const baseR = 70, stickR = 30;
    const jx = baseR + 30, jy = this.scale.height - baseR - 30;
    this.joyBase  = this.add.circle(jx, jy, baseR,  0x000000, 0.28).setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(10000);
    this.joyThumb = this.add.circle(jx, jy, stickR, 0xffffff, 0.7 ).setStrokeStyle(2, 0x101010, 0.7 ).setScrollFactor(0).setDepth(10001);
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: jx, y: jy, radius: baseR,
      base: this.joyBase, thumb: this.joyThumb,
      dir: "8dir", forceMin: 16,
    });

    // 10. 右下 A 鈕 + 上方 hint label
    const aR = 44;
    const ax = this.scale.width - aR - 30, ay = this.scale.height - aR - 30;
    this.aBtn     = this.add.circle(ax, ay, aR, 0xfad440, 0.4).setStrokeStyle(3, 0x101010, 0.85).setScrollFactor(0).setDepth(10000).setInteractive();
    this.aBtnText = this.add.text(ax, ay, "A", { fontFamily: "sans-serif", fontSize: 26, color: "#1a0d00", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    this.aBtnHint = this.add.text(ax, ay - aR - 18, "", {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif", fontSize: 14, color: "#fff",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10002).setVisible(false);
    this.aBtn.on("pointerdown", () => {
      if (this.currentInteractable) this.aBtn.setFillStyle(0xc4a020, 1.0);
    });
    this.aBtn.on("pointerup", () => {
      this._tryInteract();
      this._refreshAButtonStyle();
    });
    this.aBtn.on("pointerout", () => this._refreshAButtonStyle());

    this.scale.on("resize", () => this._onResize());

    // 11. State
    this.currentInteractable = null;
    this.modalOpen = false;
  }

  _adjustZoom() {
    const sw = this.scale.width;
    const sh = this.scale.height;
    const screenAspect = sw / sh;
    const aspectThreshold = VIEW_BASE_WIDTH / MAP_H;  // 1.111
    const z = screenAspect >= aspectThreshold ? sw / VIEW_BASE_WIDTH : sh / MAP_H;
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
    if (this.currentInteractable) {
      this.aBtn.setFillStyle(0xfad440, 1.0);
    } else {
      this.aBtn.setFillStyle(0xfad440, 0.4);
    }
  }

  _tryInteract() {
    if (this.modalOpen) return;
    const item = this.currentInteractable;
    if (!item) return;
    if (item.type === "modal") {
      this._showModal(item);
    } else if (item.type === "fountain") {
      this._fountainSplash();
    }
  }

  _showModal(item) {
    this.modalOpen = true;
    const sw = this.scale.width, sh = this.scale.height;
    this.modalContainer = this.add.container(sw / 2, sh / 2)
      .setScrollFactor(0).setDepth(20000);
    const backdrop = this.add.rectangle(0, 0, sw * 3, sh * 3, 0x000000, 0.55).setInteractive();
    const box = this.add.rectangle(0, 0, 360, 200, 0xfff8e0).setStrokeStyle(5, 0x4a3520);
    const title = this.add.text(0, -55, item.label, {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 30, color: "#4a3520", fontStyle: "bold",
    }).setOrigin(0.5);
    const body = this.add.text(0, 0, item.body || "", {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 18, color: "#4a3520",
    }).setOrigin(0.5);
    const closeBtn = this.add.text(0, 60, "[ 關閉 ]", {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 20, color: "#a04020", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive();
    const closeFn = () => {
      if (this.modalContainer) {
        this.modalContainer.destroy();
        this.modalContainer = null;
      }
      this.modalOpen = false;
    };
    closeBtn.on("pointerdown", closeFn);
    backdrop.on("pointerdown", closeFn);
    this.modalContainer.add([backdrop, box, title, body, closeBtn]);
  }

  _fountainSplash() {
    // 噴泉頂端水花動畫：12 顆水珠扇形噴出再落下
    // depth=9999 強制在所有 sprite 上面（噴泉 sprite depth=600 會擋住，必須蓋過）
    const fx = 960, fy = 460;  // 噴泉上方水柱頂（fountain 視覺上盆口）
    for (let i = 0; i < 12; i++) {
      const drop = this.add.circle(
        fx + Phaser.Math.Between(-10, 10),
        fy + Phaser.Math.Between(-6, 6),
        Phaser.Math.Between(5, 8),
        0x86d4ff, 0.9
      ).setStrokeStyle(1.5, 0x4080a0, 0.8).setDepth(9999);
      const angle = Phaser.Math.DegToRad(-90 + (i - 6) * 14);
      const dist = Phaser.Math.Between(70, 120);
      const targetX = fx + Math.cos(angle) * dist;
      const targetY = fy + Math.abs(Math.sin(angle)) * 50 + 90;  // 拋物線往下
      this.tweens.add({
        targets: drop,
        x: targetX, y: targetY,
        alpha: 0, scale: 0.3,
        duration: 800 + Math.random() * 300,
        ease: "Quad.easeOut",
        onComplete: () => drop.destroy(),
      });
    }
  }

  _updateNPC(delta) {
    const target = NPC_PATROL[this.npcPatrolIndex];
    const dx = target.x - this.npc.x;
    const dy = target.y - this.npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      this.npcPatrolIndex = (this.npcPatrolIndex + 1) % NPC_PATROL.length;
    } else {
      const step = (NPC_SPEED * delta) / 1000;
      this.npc.x += (dx / dist) * step;
      this.npc.y += (dy / dist) * step;
    }
    // sprite 跟 body
    this.npcSprite.x = this.npc.x;
    this.npcSprite.y = this.npc.y + 22;
    this.npcShadow.x = this.npc.x;
    this.npcShadow.y = this.npc.y + 18;
    // Y-sort
    this.npcSprite.setDepth(this.npcSprite.y);
    this.npcShadow.setDepth(this.npcSprite.y - 1);
    // sprite 方向：依移動向量切換 walk anim
    const horizMore = Math.abs(dx) > Math.abs(dy);
    let want = "hero_walk";
    if (!horizMore) want = dy > 0 ? "hero_walk_down" : "hero_walk_up";
    const cur = this.npcSprite.anims.currentAnim;
    if (!cur || cur.key !== want) this.npcSprite.play(want);
    if (want === "hero_walk") this.npcSprite.setFlipX(dx > 0);
    else this.npcSprite.setFlipX(false);
  }

  _updateInteractable() {
    // 找最近 interactable（包含靜態的 INTERACTABLES + 動態 NPC）
    let nearest = null;
    let bestDist = Infinity;
    const px = this.player.x, py = this.player.y;
    for (const it of INTERACTABLES) {
      const d = Math.hypot(px - it.cx, py - it.cy);
      if (d < INTERACT_RADIUS && d < bestDist) { nearest = it; bestDist = d; }
    }
    // NPC 動態判定
    const dNpc = Math.hypot(px - this.npc.x, py - this.npc.y);
    if (dNpc < INTERACT_RADIUS && dNpc < bestDist) {
      nearest = { type: "modal", label: "村民", body: "你好！我是村民" };
    }

    if (nearest !== this.currentInteractable) {
      this.currentInteractable = nearest;
      this._refreshAButtonStyle();
      if (nearest) {
        this.aBtnHint.setText(`A: ${nearest.label}`).setVisible(true);
      } else {
        this.aBtnHint.setVisible(false);
      }
    } else if (nearest) {
      // 同個 interactable，更新 hint 文字（NPC 移動時 label 不變但保險）
      this.aBtnHint.setText(`A: ${nearest.label}`);
    }
  }

  update(time, delta) {
    // 玩家移動（modal 開時凍結）
    let dx = 0, dy = 0;
    if (!this.modalOpen) {
      if (this.cursors.left.isDown  || this.wasd.A.isDown) dx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
      if (this.cursors.up.isDown    || this.wasd.W.isDown) dy -= 1;
      if (this.cursors.down.isDown  || this.wasd.S.isDown) dy += 1;
      if (this.joystick.force > 0.05) {
        const rad = Phaser.Math.DegToRad(this.joystick.angle);
        dx = Math.cos(rad);
        dy = Math.sin(rad);
      }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.player.body.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);

    this.playerSprite.x = this.player.x;
    this.playerSprite.y = this.player.y + 22;
    this.playerShadow.x = this.player.x;
    this.playerShadow.y = this.player.y + 18;
    this.playerSprite.setDepth(this.playerSprite.y);
    this.playerShadow.setDepth(this.playerSprite.y - 1);

    const moving    = Math.hypot(dx, dy) > 0.1;
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

    // NPC + interactable
    if (!this.modalOpen) this._updateNPC(delta);
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
