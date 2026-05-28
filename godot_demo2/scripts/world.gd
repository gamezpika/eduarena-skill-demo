extends Node2D

const BG_SCALE := 3.0
const MAP_W := 2160  # 720 * 3
const MAP_H := 3840  # 1280 * 3

const BUILDING_SCALE := 0.32
const ISLAND_SCALE := 0.24

# 5 建築擺到 world_bg.jpg 上的 5 個草地圓盤位置（座標 = 原圖 720x1280 * 3）
const BUILDINGS := [
	{"name": "shop",   "tex": "res://assets/village/village_shop.png",   "pos": Vector2(540, 720),  "label": "🛍 商店"},
	{"name": "farm",   "tex": "res://assets/village/village_farm.png",   "pos": Vector2(1470, 690), "label": "🐮 牧場"},
	{"name": "closet", "tex": "res://assets/village/village_closet.png", "pos": Vector2(990, 1260), "label": "👗 衣櫥"},
	{"name": "pvp",    "tex": "res://assets/village/village_pvp.png",    "pos": Vector2(1560, 1620),"label": "⚔ PK 場"},
	{"name": "boss",   "tex": "res://assets/village/village_boss.png",   "pos": Vector2(660, 2280), "label": "👹 魔王塔"},
]

# 5 科目島擺到沙灘區（背景下半部）
const ISLANDS := [
	{"name": "chinese", "tex": "res://assets/village/island_chinese.png", "pos": Vector2(420, 3000),  "label": "📖 國語島"},
	{"name": "english", "tex": "res://assets/village/island_english.png", "pos": Vector2(1750, 2820), "label": "🔤 英文島"},
	{"name": "math",    "tex": "res://assets/village/island_math.png",    "pos": Vector2(1080, 2980), "label": "🔢 數學島"},
	{"name": "science", "tex": "res://assets/village/island_science.png", "pos": Vector2(420, 3450),  "label": "🔬 自然島"},
	{"name": "social",  "tex": "res://assets/village/island_social.png",  "pos": Vector2(1700, 3500), "label": "🌏 社會島"},
]

@onready var background: Sprite2D = $Background
@onready var entities: Node2D = $Entities

func _ready() -> void:
	var bg_tex: Texture2D = load("res://assets/village/world_bg.jpg")
	background.texture = bg_tex
	background.scale = Vector2(BG_SCALE, BG_SCALE)
	# Sprite2D 預設 centered=true，所以 position 是中心；我們要左上對齊原點
	background.centered = false
	background.position = Vector2.ZERO

	for b in BUILDINGS:
		_spawn_object(b, BUILDING_SCALE)
	for s in ISLANDS:
		_spawn_object(s, ISLAND_SCALE)

func _spawn_object(data: Dictionary, scale_factor: float) -> void:
	var sb := StaticBody2D.new()
	sb.name = data["name"]
	sb.position = data["pos"]
	sb.collision_layer = 1
	sb.collision_mask = 0
	sb.y_sort_enabled = true
	entities.add_child(sb)

	var tex: Texture2D = load(data["tex"])
	var spr := Sprite2D.new()
	spr.texture = tex
	spr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	spr.scale = Vector2(scale_factor, scale_factor)
	spr.position = Vector2(0, -tex.get_height() * scale_factor * 0.5)
	sb.add_child(spr)

	var cs := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	var w := tex.get_width() * scale_factor * 0.55
	rs.size = Vector2(w, 32.0)
	cs.shape = rs
	cs.position = Vector2(0, -16.0)
	sb.add_child(cs)

	var lbl := Label.new()
	lbl.text = data["label"]
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.position = Vector2(-80, -tex.get_height() * scale_factor - 28)
	lbl.size = Vector2(160, 24)
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	lbl.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	lbl.add_theme_constant_override("shadow_offset_x", 1)
	lbl.add_theme_constant_override("shadow_offset_y", 1)
	sb.add_child(lbl)
