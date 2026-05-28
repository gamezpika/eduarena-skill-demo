extends Node2D

const MAP_W := 120
const MAP_H := 90
const TILE := 32

const BUILDING_SCALE := 0.32
const ISLAND_SCALE := 0.26

const BUILDINGS := [
	{"name": "shop",   "tex": "res://assets/village/village_shop.png",   "pos": Vector2(1600, 1100), "label": "🛍 商店"},
	{"name": "farm",   "tex": "res://assets/village/village_farm.png",   "pos": Vector2(2400, 1300), "label": "🐮 牧場"},
	{"name": "closet", "tex": "res://assets/village/village_closet.png", "pos": Vector2(1100, 1800), "label": "👗 衣櫥"},
	{"name": "pvp",    "tex": "res://assets/village/village_pvp.png",    "pos": Vector2(2700, 1900), "label": "⚔ PK 場"},
	{"name": "boss",   "tex": "res://assets/village/village_boss.png",   "pos": Vector2(1900, 700),  "label": "👹 魔王塔"},
]

const ISLANDS := [
	{"name": "chinese", "tex": "res://assets/village/island_chinese.png", "pos": Vector2(500, 700),   "label": "📖 國語島"},
	{"name": "english", "tex": "res://assets/village/island_english.png", "pos": Vector2(3400, 700),  "label": "🔤 英文島"},
	{"name": "math",    "tex": "res://assets/village/island_math.png",    "pos": Vector2(500, 2200),  "label": "🔢 數學島"},
	{"name": "science", "tex": "res://assets/village/island_science.png", "pos": Vector2(3400, 2200), "label": "🔬 自然島"},
	{"name": "social",  "tex": "res://assets/village/island_social.png",  "pos": Vector2(1900, 2500), "label": "🌏 社會島"},
]

@onready var layer: TileMapLayer = $Ground
@onready var entities: Node2D = $Entities

func _ready() -> void:
	_build_tilemap()
	for b in BUILDINGS:
		_spawn_object(b, BUILDING_SCALE)
	for s in ISLANDS:
		_spawn_object(s, ISLAND_SCALE)

func _build_tilemap() -> void:
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE, TILE)

	var grass_src := TileSetAtlasSource.new()
	grass_src.texture = load("res://assets/grass.png")
	grass_src.texture_region_size = Vector2i(TILE, TILE)
	grass_src.create_tile(Vector2i(0, 0))
	ts.add_source(grass_src, 0)

	var path_src := TileSetAtlasSource.new()
	path_src.texture = load("res://assets/path.png")
	path_src.texture_region_size = Vector2i(TILE, TILE)
	path_src.create_tile(Vector2i(0, 0))
	ts.add_source(path_src, 1)

	layer.tile_set = ts

	for y in range(MAP_H):
		for x in range(MAP_W):
			layer.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))

	# 十字 path（路寬 3 格）
	var cy: int = MAP_H / 2
	var cx: int = MAP_W / 2
	for x in range(MAP_W):
		for dy in [-1, 0, 1]:
			layer.set_cell(Vector2i(x, cy + dy), 1, Vector2i(0, 0))
	for y in range(MAP_H):
		for dx in [-1, 0, 1]:
			layer.set_cell(Vector2i(cx + dx, y), 1, Vector2i(0, 0))

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
	# 底部對齊 pos：sprite 中心往上偏移 half height
	spr.position = Vector2(0, -tex.get_height() * scale_factor * 0.5)
	sb.add_child(spr)

	# Footprint collision — 底部 60% 寬，30px 高
	var cs := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	var w := tex.get_width() * scale_factor * 0.55
	rs.size = Vector2(w, 32.0)
	cs.shape = rs
	cs.position = Vector2(0, -16.0)
	sb.add_child(cs)

	# 名字 Label 浮在頂上
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
