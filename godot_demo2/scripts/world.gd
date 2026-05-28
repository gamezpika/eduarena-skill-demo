extends Node2D

const MAP_W := 80
const MAP_H := 60
const TILE := 32

@onready var layer: TileMapLayer = $Ground

func _ready() -> void:
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

	# 鋪滿 grass
	for y in range(MAP_H):
		for x in range(MAP_W):
			layer.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))

	# 十字 path（橫穿 + 縱穿，路寬 3 格）
	var cy := MAP_H / 2
	var cx := MAP_W / 2
	for x in range(MAP_W):
		for dy in [-1, 0, 1]:
			layer.set_cell(Vector2i(x, cy + dy), 1, Vector2i(0, 0))
	for y in range(MAP_H):
		for dx in [-1, 0, 1]:
			layer.set_cell(Vector2i(cx + dx, y), 1, Vector2i(0, 0))
