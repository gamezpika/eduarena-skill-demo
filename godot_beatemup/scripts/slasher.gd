extends "res://scripts/enemy_base.gd"

const DASH_SPEED := 700.0
const DASH_TIME := 0.4
const DASH_COOLDOWN := 2.5
const SIGHT_RANGE := 320.0

var dash_timer := 0.0
var dash_cd := 0.0
var dash_dir := Vector2.RIGHT

func _hp_max() -> int: return 1
func _attack_damage() -> int: return 1
func _attack_range() -> float: return 60.0
func _attack_cooldown() -> float: return 1.5
func _speed() -> float: return 90.0

func _ai(delta: float) -> void:
	if dash_cd > 0.0:
		dash_cd = max(0.0, dash_cd - delta)
	if dash_timer > 0.0:
		dash_timer = max(0.0, dash_timer - delta)
		velocity = dash_dir * DASH_SPEED
		# 衝刺接觸到玩家 = 攻擊
		var to_p := player.global_position - global_position
		if to_p.length() <= _attack_range():
			_do_attack()
		return
	_face_player()
	var to_player := player.global_position - global_position
	var dist := to_player.length()
	if dist <= _attack_range():
		velocity = Vector2.ZERO
		_do_attack()
	elif dist <= SIGHT_RANGE and dash_cd <= 0.0:
		dash_dir = to_player.normalized()
		dash_timer = DASH_TIME
		dash_cd = DASH_COOLDOWN
	else:
		velocity = to_player.normalized() * _speed()
