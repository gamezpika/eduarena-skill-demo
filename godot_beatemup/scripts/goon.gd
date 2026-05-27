extends "res://scripts/enemy_base.gd"

func _hp_max() -> int: return 1
func _attack_damage() -> int: return 1
func _attack_range() -> float: return 70.0
func _attack_cooldown() -> float: return 1.2
func _speed() -> float: return 130.0

func _ai(_delta: float) -> void:
	_face_player()
	var to_player := player.global_position - global_position
	var dist := to_player.length()
	if dist <= _attack_range():
		velocity = Vector2.ZERO
		_do_attack()
	else:
		velocity = to_player.normalized() * _speed()
