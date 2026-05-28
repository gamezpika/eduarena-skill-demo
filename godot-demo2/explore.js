// godot-demo2 Phaser 版 — 2.5D 大富翁風村莊
// Layout: village_ground.png 1920x1080 底圖 + 7 sprite (5 房子 + 噴泉 + 樹)
//          chibi 小男孩 4 方向 walk + Y-sort + 房子/噴泉碰撞擋住

const MAP_W = 1920;
const MAP_H = 1080;
const PLAYER_SPEED = 220;
const VIEW_BASE_WIDTH = 1200;

// v1 地板 5 個圓圈中心（cv2 偵測 + 視覺微調）+ plaza 中心
const VILLAGE_SPRITES = [
  // 上排 3 棟（zone cy 較高，sprite 延伸到 y<0，靠 camera SKY_PAD 顯示完整屋頂）
  { key: "house_red",    x: 290,  y: 100, scale: 0.37 },
  { key: "house_brown",  x: 960,  y: 70,  scale: 0.37 },
  { key: "house_blue",   x: 1620, y: 100, scale: 0.37 },
  // 中排 2 棟
  { key: "house_green",  x: 300,  y: 557, scale: 0.37 },
  { key: "house_yellow", x: 1630, y: 564, scale: 0.37 },
  // 中央 plaza 噴泉
  { key: "fountain",     x: 960,  y: 360, scale: 0.27 },
  // 4 棵樹分散在 zone 之間草地空白
  { key: "tree_cherry",  x: 600,  y: 230, scale: 0.18 },
  { key: "tree_cherry",  x: 1300, y: 230, scale: 0.18 },
  { key: "tree_cherry",  x: 700,  y: 750, scale: 0.18 },
  { key: "tree_cherry",  x: 1230, y: 760, scale: 0.18 },
];

// 碰撞 hitbox：物件 footprint（房子底部、噴泉底盤、樹幹）
const OBSTACLES = [
  // 5 房子：在腳底中心畫 invisible static rectangle
  { cx: 290,  cy: 80,  w: 280, h: 60 },
  { cx: 960,  cy: 50,  w: 280, h: 60 },
  { cx: 1620, cy: 80,  w: 280, h: 60 },
  { cx: 300,  cy: 537, w: 280, h: 60 },
  { cx: 1630, cy: 544, w: 280, h: 60 },
  // 噴泉
  { cx: 960,  cy: 348, w: 180, h: 50 },
  // 4 棵樹幹底（小範圍）
  { cx: 600,  cy: 225, w: 32,  h: 24 },
  { cx: 1300, cy: 225, w: 32,  h: 24 },
  { cx: 700,  cy: 745, w: 32,  h: 24 },
  { cx: 1230, cy: 755, w: 32,  h: 24 },
];

class ExploreScene extends Phaser.Scene {
  constructor() { super("explore"); }

  preload() {
    // chibi 小男孩 sprite sheets
    this.load.spritesheet("hero",      "hero_walk2.png?v=1", { frameWidth: 758, frameHeight: 1032 });
    this.load.spritesheet("hero_down", "hero_walk.png?v=1",  { frameWidth: 694, frameHeight: 1154 });
    this.load.spritesheet("hero_up",   "hero_walk3.png?v=1", { frameWidth: 480, frameHeight: 864 });
    // 村莊 ground + 障礙物 sprite
    this.load.image("village_ground", "village_ground.png?v=1");
    this.load.image("house_red",      "house_red.png?v=1");
    this.load.image("house_brown",    "house_brown.png?v=1");
    this.load.image("house_blue",     "house_blue.png?v=1");
    this.load.image("house_green",    "house_green.png?v=1");
    this.load.image("house_yellow",   "house_yellow.png?v=1");
    this.load.image("fountain",       "fountain.png?v=1");
    this.load.image("tree_cherry",    "tree_cherry.png?v=1");
  }

  create() {
    // 1. 背景：村莊 ground（depth=0）
    this.add.image(0, 0, "village_ground").setOrigin(0, 0).setDepth(0);

    // 2. Village sprite (5 房子 + 噴泉 + 樹) — bottom-anchor + Y-sort
    VILLAGE_SPRITES.forEach(s => {
      const spr = this.add.image(s.x, s.y, s.key);
      spr.setOrigin(0.5, 1);
      spr.setScale(s.scale);
      spr.setDepth(s.y);
    });

    // 3. Player：起始位置在中央 plaza 南邊（不撞噴泉）
    const PX = 960, PY = 600;
    this.playerShadow = this.add.ellipse(PX, PY + 12, 56, 16, 0x000000, 0.4);
    this.player = this.add.rectangle(PX, PY, 22, 22, 0xffffff, 0).setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setSize(22, 22);
    this.player.body.setCollideWorldBounds(true);

    this.playerSprite = this.add.sprite(PX, PY + 22, "hero", 0);
    this.playerSprite.setOrigin(0.5, 1);
    this.playerSprite.setScale(0.32);

    // 4. 動畫
    this.anims.create({ key: "hero_walk",      frames: this.anims.generateFrameNumbers("hero",      { start: 0, end: 8  }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: "hero_walk_down", frames: this.anims.generateFrameNumbers("hero_down", { start: 0, end: 24 }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: "hero_walk_up",   frames: this.anims.generateFrameNumbers("hero_up",   { start: 0, end: 15 }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: "hero_idle",      frames: [{ key: "hero_down", frame: 0 }],                                    frameRate: 1                });
    this.playerSprite.play("hero_idle");

    // 5. 障礙物碰撞（invisible static physics rectangles）
    this.obstacles = this.physics.add.staticGroup();
    OBSTACLES.forEach(o => {
      const body = this.add.rectangle(o.cx, o.cy, o.w, o.h, 0xff0000, 0).setVisible(false);
      this.physics.add.existing(body, true);
      this.obstacles.add(body);
    });
    this.physics.add.collider(this.player, this.obstacles);

    // 6. World bounds + camera
    // 上排房子 cy=70-100、sprite_h≈379，top edge 到 y≈-280
    // physics 仍鎖在 0~1080（玩家走不出去），但 camera 額外多 400 px sky pad
    // 讓 camera 上滾能看到房子屋頂全貌（不裁頂）
    const SKY_PAD = 400;
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, -SKY_PAD, MAP_W, MAP_H + SKY_PAD);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this._adjustZoom();

    // 7. 鍵盤輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    // 8. 虛擬搖桿（左下）
    const baseR = 70, stickR = 30;
    const jx = baseR + 30, jy = this.scale.height - baseR - 30;
    this.joyBase  = this.add.circle(jx, jy, baseR,  0x000000, 0.28).setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(10000);
    this.joyThumb = this.add.circle(jx, jy, stickR, 0xffffff, 0.7 ).setStrokeStyle(2, 0x101010, 0.7 ).setScrollFactor(0).setDepth(10001);
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: jx, y: jy, radius: baseR,
      base: this.joyBase, thumb: this.joyThumb,
      dir: "8dir", forceMin: 16,
    });

    // 9. 右下 A 鈕
    const aR = 44;
    const ax = this.scale.width - aR - 30, ay = this.scale.height - aR - 30;
    this.aBtn     = this.add.circle(ax, ay, aR, 0xfad440, 0.85).setStrokeStyle(3, 0x101010, 0.85).setScrollFactor(0).setDepth(10000).setInteractive();
    this.aBtnText = this.add.text(ax, ay, "A", { fontFamily: "sans-serif", fontSize: 26, color: "#1a0d00", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    this.aBtn.on("pointerdown", () => this.aBtn.setFillStyle(0xc4a020, 0.85));
    this.aBtn.on("pointerup",   () => this.aBtn.setFillStyle(0xfad440, 0.85));
    this.aBtn.on("pointerout",  () => this.aBtn.setFillStyle(0xfad440, 0.85));

    this.scale.on("resize", () => this._onResize());
  }

  _adjustZoom() {
    // Aspect-aware zoom：
    // - 寬螢幕（landscape PC）：用 width-base（VIEW_BASE_WIDTH=1200 鎖視野寬度）
    // - 高螢幕（portrait 手機）：用 height-base（view.h = world.h 消除上下綠色 padding）
    // 閾值用 VIEW_BASE_WIDTH/MAP_H = 1.111 保證兩公式在切換點 zoom 連續無跳變
    const sw = this.scale.width;
    const sh = this.scale.height;
    const screenAspect = sw / sh;
    const aspectThreshold = VIEW_BASE_WIDTH / MAP_H;  // 1200/1080 = 1.111
    let z;
    if (screenAspect >= aspectThreshold) {
      z = sw / VIEW_BASE_WIDTH;
    } else {
      z = sh / MAP_H;
    }
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
  }

  update() {
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown    || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown  || this.wasd.S.isDown) dy += 1;

    if (this.joystick.force > 0.05) {
      const rad = Phaser.Math.DegToRad(this.joystick.angle);
      dx = Math.cos(rad);
      dy = Math.sin(rad);
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }

    this.player.body.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);

    this.playerSprite.x  = this.player.x;
    this.playerSprite.y  = this.player.y + 22;
    this.playerShadow.x  = this.player.x;
    this.playerShadow.y  = this.player.y + 18;

    // Y-sort：玩家 sprite depth = sprite y 座標
    this.playerSprite.setDepth(this.playerSprite.y);
    this.playerShadow.setDepth(this.playerSprite.y - 1);

    // 動畫切換
    const moving    = Math.hypot(dx, dy) > 0.1;
    const horizMore = Math.abs(dx) > Math.abs(dy);
    let wantAnim = "hero_idle";
    if (moving) {
      if (horizMore)      wantAnim = "hero_walk";
      else if (dy > 0)    wantAnim = "hero_walk_down";
      else                wantAnim = "hero_walk_up";
    }
    const cur = this.playerSprite.anims.currentAnim;
    if (!cur || cur.key !== wantAnim) {
      this.playerSprite.play(wantAnim);
    }
    if (wantAnim === "hero_walk") {
      if (dx >  0.1) this.playerSprite.setFlipX(true);
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
  backgroundColor: "#8cb45a",  // 配合 ground 草地色，sprite y<0 / world 外區域看起來像更多草地，不再像「綠色天空」
  scene: ExploreScene,
  render: { pixelArt: false, antialias: true },
});
