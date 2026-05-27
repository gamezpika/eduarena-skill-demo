extends "res://scripts/enemy_base.gd"

func _hp_max() -> int: return 3
func _attack_damage() -> int: return 2
func _attack_range() -> float: return 95.0
func _attack_cooldown() -> float: return 2.0
func _attack_anim_time() -> float: return 0.5
func _speed() -> float: return 80.0

func _ai(_delta: float) -> void:
	_face_player()
	var to_player := player.global_position - global_position
	var dist := to_player.length()
	if dist <= _attack_range():
		velocity = Vector2.ZERO
		_do_attack()
	else:
		velocity = to_player.normalized() * _speed()
