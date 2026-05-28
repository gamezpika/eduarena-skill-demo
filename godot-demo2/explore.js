// godot-demo2 Phaser 版 — top-down 探索 demo
// 背景：world_bg.jpg scale 3x → 2160 x 3840
// 5 建築 + 5 科目島 擺到背景圖上指定位置

const MAP_W = 2160;
const MAP_H = 3840;
const BG_SCALE = 3;
const PLAYER_SPEED = 220;
const VIEW_BASE_WIDTH = 720;  // camera 看到的 world 寬（zoom = canvas / 720）

const BUILDINGS = [
  { key: "shop",   pos: [540, 720],   scale: 0.32, label: "🛍 商店",   tex: "../assets/images/village/village_shop.png" },
  { key: "farm",   pos: [1470, 690],  scale: 0.32, label: "🐮 牧場",   tex: "../assets/images/village/village_farm.png" },
  { key: "closet", pos: [990, 1260],  scale: 0.32, label: "👗 衣櫥",   tex: "../assets/images/village/village_closet.png" },
  { key: "pvp",    pos: [1560, 1620], scale: 0.32, label: "⚔ PK 場",   tex: "../assets/images/village/village_pvp.png" },
  { key: "boss",   pos: [660, 2280],  scale: 0.32, label: "👹 魔王塔", tex: "../assets/images/village/village_boss.png" },
];

const ISLANDS = [
  { key: "chinese", pos: [420, 3000],  scale: 0.24, label: "📖 國語島", tex: "../assets/images/island_chinese.png" },
  { key: "english", pos: [1750, 2820], scale: 0.24, label: "🔤 英文島", tex: "../assets/images/island_english.png" },
  { key: "math",    pos: [1080, 2980], scale: 0.24, label: "🔢 數學島", tex: "../assets/images/island_math.png" },
  { key: "science", pos: [420, 3450],  scale: 0.24, label: "🔬 自然島", tex: "../assets/images/island_science.png" },
  { key: "social",  pos: [1700, 3500], scale: 0.24, label: "🌏 社會島", tex: "../assets/images/island_social.png" },
];

class ExploreScene extends Phaser.Scene {
  constructor() { super("explore"); }

  preload() {
    this.load.image("world_bg", "../assets/images/world_bg.jpg");
    [...BUILDINGS, ...ISLANDS].forEach(d => this.load.image(d.key, d.tex));
  }

  create() {
    // 背景
    this.add.image(0, 0, "world_bg")
      .setOrigin(0, 0)
      .setScale(BG_SCALE)
      .setDepth(-1000);

    // 5 建築 + 5 科目島
    this.statics = this.physics.add.staticGroup();
    [...BUILDINGS, ...ISLANDS].forEach(d => this._spawnObject(d));

    // Player — 黃色方塊 + 黑邊 + 影子
    this.playerShadow = this.add.ellipse(1080, 1920 + 18, 24, 9, 0x000000, 0.35);
    this.player = this.add.rectangle(1080, 1920, 24, 32, 0xfad440).setStrokeStyle(2, 0x150c05);
    this.physics.add.existing(this.player);
    this.player.body.setSize(22, 22);
    this.player.body.setCollideWorldBounds(true);

    // 跟建築 + 島都不能穿過
    this.physics.add.collider(this.player, this.statics);

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

    // 右下 A 鈕（先 stub）
    const aR = 44;
    const ax = this.scale.width - aR - 30;
    const ay = this.scale.height - aR - 30;
    this.aBtn = this.add.circle(ax, ay, aR, 0xfad440, 0.85).setStrokeStyle(3, 0x101010, 0.85).setScrollFactor(0).setDepth(10000).setInteractive();
    this.aBtnText = this.add.text(ax, ay, "A", { fontFamily: "sans-serif", fontSize: 26, color: "#1a0d00", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    this.aBtn.on("pointerdown", () => this.aBtn.setFillStyle(0xc4a020, 0.85));
    this.aBtn.on("pointerup", () => this.aBtn.setFillStyle(0xfad440, 0.85));
    this.aBtn.on("pointerout", () => this.aBtn.setFillStyle(0xfad440, 0.85));

    // Resize 時重排
    this.scale.on("resize", () => this._onResize());
  }

  _spawnObject(data) {
    const [x, y] = data.pos;

    // 視覺 image：origin 底部中央 → pos 對齊建築腳
    const spr = this.add.image(x, y, data.key)
      .setOrigin(0.5, 1)
      .setScale(data.scale);
    spr.setDepth(y);  // y-sort 用 y 當 depth

    // collision footprint：純 zone（無視覺），擺在建築腳下 16px 偏移
    const fpW = spr.displayWidth * 0.55;
    const fpH = 32;
    const zone = this.add.zone(x, y - fpH / 2, fpW, fpH);
    this.physics.add.existing(zone, true);
    this.statics.add(zone);

    // 浮動 label
    const lbl = this.add.text(x, y - spr.displayHeight - 6, data.label, {
      fontFamily: "-apple-system, 'PingFang TC', sans-serif",
      fontSize: 18, color: "#ffffff",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5, 1);
    lbl.setDepth(y + 1);
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

    // 鍵盤
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;

    // 搖桿覆蓋鍵盤
    if (this.joystick.force > 0.05) {
      const rad = Phaser.Math.DegToRad(this.joystick.angle);
      dx = Math.cos(rad);
      dy = Math.sin(rad);
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }

    this.player.body.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);

    // 同步影子 + y-sort
    this.playerShadow.x = this.player.x;
    this.playerShadow.y = this.player.y + 18;
    this.player.setDepth(this.player.y);
    this.playerShadow.setDepth(this.player.y - 0.5);
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
  backgroundColor: "#1a2412",
  scene: ExploreScene,
  render: { pixelArt: false, antialias: true },
});
