extends CanvasLayer

@onready var hp_fill: ColorRect = $HpFill
@onready var hp_label: Label = $HpLabel
@onready var enemy_count_label: Label = $EnemyCount
@onready var center_msg: Label = $CenterMsg

const HP_FILL_MAX_WIDTH := 296.0

var _initial_enemy_count := 0
var _player_ref: Node = null

func _ready() -> void:
	# 延一 frame 讓 actors 都 ready
	await get_tree().process_frame
	_player_ref = get_tree().get_first_node_in_group("player")
	if _player_ref != null:
		if _player_ref.has_signal("hp_changed"):
			_player_ref.hp_changed.connect(_on_player_hp)
		if _player_ref.has_signal("died"):
			_player_ref.died.connect(_on_player_died)
		# 初值
		if "hp" in _player_ref and "max_hp" in _player_ref:
			_on_player_hp(_player_ref.hp, _player_ref.max_hp)

	# 連所有敵人 died 信號
	var enemies: Array = get_tree().get_nodes_in_group("enemy")
	_initial_enemy_count = enemies.size()
	for e in enemies:
		if e.has_signal("died"):
			e.died.connect(_on_enemy_died)
	_update_enemy_count()

func _on_player_hp(value: int, max_value: int) -> void:
	hp_label.text = "HP %d/%d" % [value, max_value]
	var ratio := 0.0 if max_value <= 0 else float(value) / float(max_value)
	var w: float = clamp(HP_FILL_MAX_WIDTH * ratio, 0.0, HP_FILL_MAX_WIDTH)
	hp_fill.offset_right = hp_fill.offset_left + w

func _on_player_died() -> void:
	_show_center("YOU DIED", Color(1, 0.3, 0.3, 1))

func _on_enemy_died(_e) -> void:
	_update_enemy_count()
	var remaining := get_tree().get_nodes_in_group("enemy").size()
	# 扣掉剛死的（died emit 在 queue_free 前，這禎 group 還在）
	if remaining <= 1 and not _is_player_dead():
		# 用 call_deferred 等下一禎再判一次更穩
		call_deferred("_check_clear")

func _check_clear() -> void:
	var remaining := get_tree().get_nodes_in_group("enemy").size()
	if remaining == 0 and not _is_player_dead():
		_show_center("STAGE CLEAR", Color(0.4, 1, 0.5, 1))

func _update_enemy_count() -> void:
	var remaining := get_tree().get_nodes_in_group("enemy").size()
	enemy_count_label.text = "敵人剩餘 %d" % remaining

func _is_player_dead() -> bool:
	return _player_ref != null and "dead" in _player_ref and _player_ref.dead

func _show_center(text: String, color: Color) -> void:
	center_msg.text = text
	center_msg.modulate = color
	center_msg.visible = true
