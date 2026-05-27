extends "res://scripts/enemy_base.gd"

const THROW_COOLDOWN := 2.5
const PROJECTILE_SCENE := preload("res://scenes/actors/projectile.tscn")

var throw_cd := 0.0

func _hp_max() -> int: return 2
func _attack_damage() -> int: return 1   # 拋射物自帶傷害
func _speed() -> float: return 0.0
func _attack_range() -> float: return 99999.0  # 不用接觸
func _attack_cooldown() -> float: return THROW_COOLDOWN

func _ai(delta: float) -> void:
	if throw_cd > 0.0:
		throw_cd = max(0.0, throw_cd - delta)
	_face_player()
	velocity = Vector2.ZERO
	if throw_cd <= 0.0:
		_throw()
		throw_cd = THROW_COOLDOWN

func _throw() -> void:
	var proj := PROJECTILE_SCENE.instantiate()
	proj.global_position = global_position + Vector2(0, -70)
	var target: Vector2 = player.global_position + Vector2(0, -60)
	var dir: Vector2 = target - proj.global_position
	proj.velocity = dir.normalized() * 480.0
	get_tree().current_scene.add_child(proj)

# 不寫 _on_attack_hit override — thrower 不近戰，由 projectile 自己處理傷害
