// godot-demo2 Phaser 版 — 只剩人物，乾淨畫面
// 背景 / 5 建築 / 5 科目島 全砍，只保留 Ludo chibi 小男孩走動

const MAP_W = 2160;
const MAP_H = 3840;
const PLAYER_SPEED = 220;
const VIEW_BASE_WIDTH = 900;

class ExploreScene extends Phaser.Scene {
  constructor() { super("explore"); }

  preload() {
    // Ludo.ai 出品 chibi 小男孩
    // hero (側面 walk): 3x3 grid 9 幀（每幀 758x1032）
    this.load.spritesheet("hero", "hero_walk2.png?v=1", { frameWidth: 758, frameHeight: 1032 });
    // hero_down (正面/朝下 walk): 5x5 grid 25 幀（每幀 694x1154）
    this.load.spritesheet("hero_down", "hero_walk.png?v=1", { frameWidth: 694, frameHeight: 1154 });
    // hero_up (背面/朝上 walk): 4x4 grid 16 幀（每幀 480x864）
    this.load.spritesheet("hero_up", "hero_walk3.png?v=1", { frameWidth: 480, frameHeight: 864 });
  }

  create() {
    // Player — Ludo chibi 小男孩 sprite + 影子
    this.playerShadow = this.add.ellipse(1080, 1932, 56, 16, 0x000000, 0.4);
    this.player = this.add.rectangle(1080, 1920, 22, 22, 0xffffff, 0).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setSize(22, 22);
    this.player.body.setCollideWorldBounds(true);

    this.playerSprite = this.add.sprite(1080, 1942, "hero", 0);
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(0.32);

    // 動畫
    this.anims.create({
      key: "hero_walk",         // 側面（朝左/右）
      frames: this.anims.generateFrameNumbers("hero", { start: 0, end: 8 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "hero_walk_down",    // 正面（朝下）
      frames: this.anims.generateFrameNumbers("hero_down", { start: 0, end: 24 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: "hero_walk_up",      // 背面（朝上）
      frames: this.anims.generateFrameNumbers("hero_up", { start: 0, end: 15 }),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: "hero_idle",         // 停止：正面靜止
      frames: [{ key: "hero_down", frame: 0 }],
      frameRate: 1,
    });
    this.playerSprite.play("hero_idle");

    // World bounds（不能走出地圖）
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // Camera
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this._adjustZoom();

    // 鍵盤輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    // 虛擬搖桿
    const baseR = 70;
    const stickR = 30;
    const jx = baseR + 30;
    const jy = this.scale.height - baseR - 30;
    this.joyBase = this.add.circle(jx, jy, baseR, 0x000000, 0.28).setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(10000);
    this.joyThumb = this.add.circle(jx, jy, stickR, 0xffffff, 0.7).setStrokeStyle(2, 0x101010, 0.7).setScrollFactor(0).setDepth(10001);
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: jx, y: jy, radius: baseR,
      base: this.joyBase, thumb: this.joyThumb,
      dir: "8dir", forceMin: 16,
    });

    // 右下 A 鈕（stub）
    const aR = 44;
    const ax = this.scale.width - aR - 30;
    const ay = this.scale.height - aR - 30;
    this.aBtn = this.add.circle(ax, ay, aR, 0xfad440, 0.85).setStrokeStyle(3, 0x101010, 0.85).setScrollFactor(0).setDepth(10000).setInteractive();
    this.aBtnText = this.add.text(ax, ay, "A", { fontFamily: "sans-serif", fontSize: 26, color: "#1a0d00", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    this.aBtn.on("pointerdown", () => this.aBtn.setFillStyle(0xc4a020, 0.85));
    this.aBtn.on("pointerup", () => this.aBtn.setFillStyle(0xfad440, 0.85));
    this.aBtn.on("pointerout", () => this.aBtn.setFillStyle(0xfad440, 0.85));

    // Resize 重排
    this.scale.on("resize", () => this._onResize());
  }

  _adjustZoom() {
    const z = this.scale.width / VIEW_BASE_WIDTH;
    this.cameras.main.setZoom(z);
  }

  _onResize() {
    this._adjustZoom();
    const baseR = 70;
    const aR = 44;
    const jx = baseR + 30;
    const jy = this.scale.height - baseR - 30;
    this.joyBase.setPosition(jx, jy);
    this.joyThumb.setPosition(jx, jy);
    this.joystick.setPosition(jx, jy);
    const ax = this.scale.width - aR - 30;
    const ay = this.scale.height - aR - 30;
    this.aBtn.setPosition(ax, ay);
    this.aBtnText.setPosition(ax, ay);
  }

  update() {
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;

    if (this.joystick.force > 0.05) {
      const rad = Phaser.Math.DegToRad(this.joystick.angle);
      dx = Math.cos(rad);
      dy = Math.sin(rad);
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }

    this.player.body.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);

    this.playerSprite.x = this.player.x;
    this.playerSprite.y = this.player.y + 22;
    this.playerShadow.x = this.player.x;
    this.playerShadow.y = this.player.y + 18;

    const moving = Math.hypot(dx, dy) > 0.1;
    const horizMore = Math.abs(dx) > Math.abs(dy);
    let wantAnim = "hero_idle";
    if (moving) {
      if (horizMore) wantAnim = "hero_walk";
      else if (dy > 0) wantAnim = "hero_walk_down";
      else wantAnim = "hero_walk_up";
    }
    const cur = this.playerSprite.anims.currentAnim;
    if (!cur || cur.key !== wantAnim) {
      this.playerSprite.play(wantAnim);
    }
    if (wantAnim === "hero_walk") {
      if (dx > 0.1) this.playerSprite.setFlipX(true);
      else if (dx < -0.1) this.playerSprite.setFlipX(false);
    } else {
      this.playerSprite.setFlipX(false);
    }
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
  backgroundColor: "#3a5d2c",
  scene: ExploreScene,
  render: { pixelArt: false, antialias: true },
});
