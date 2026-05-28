class_name EnemyBase
extends CharacterBody2D

# 子類別 override 這些常數
const SPEED := 100.0
const HP_MAX := 1
const ATTACK_DAMAGE := 1
const ATTACK_RANGE := 70.0
const ATTACK_COOLDOWN := 1.2
const ATTACK_ANIM_TIME := 0.35
const KNOCKBACK_TO_PLAYER := 180.0

@onready var visual: Node2D = $Visual
@onready var sprite: AnimatedSprite2D = $Visual/Body if has_node("Visual/Body") else null
@onready var attack_hitbox: Area2D = $Visual/AttackHitbox if has_node("Visual/AttackHitbox") else null

var hp := 1
var attack_cd := 0.0
var attack_timer := 0.0
var stun_timer := 0.0
var dead := false
var player: Node2D = null

signal died(enemy)

func _ready() -> void:
	add_to_group("enemy")
	hp = _hp_max()
	if attack_hitbox != null:
		attack_hitbox.body_entered.connect(_on_attack_hit)
	# 玩家延遲 spawn 也撈得到（在 _physics_process 內補撈）

func _physics_process(delta: float) -> void:
	if dead:
		return
	if attack_cd > 0.0:
		attack_cd = max(0.0, attack_cd - delta)
	if attack_timer > 0.0:
		attack_timer = max(0.0, attack_timer - delta)
		if attack_timer == 0.0 and attack_hitbox != null:
			attack_hitbox.monitoring = false
	if stun_timer > 0.0:
		stun_timer = max(0.0, stun_timer - delta)

	if player == null or not is_instance_valid(player):
		player = get_tree().get_first_node_in_group("player")

	if stun_timer > 0.0:
		velocity *= 0.85
		move_and_slide()
		return

	if player == null or not is_instance_valid(player) or _player_is_dead():
		velocity = Vector2.ZERO
		move_and_slide()
		return

	_ai(delta)
	move_and_slide()
	_update_anim()

func _update_anim() -> void:
	if sprite == null:
		return
	var target: StringName = &"walk" if velocity.length() > 5.0 else &"idle"
	if sprite.animation != target:
		sprite.play(target)

func _ai(_delta: float) -> void:
	pass  # override

func _player_is_dead() -> bool:
	return "dead" in player and player.dead

func _face_player() -> int:
	if player == null:
		return 1
	var f := 1 if player.global_position.x >= global_position.x else -1
	visual.scale.x = f
	return f

func _do_attack() -> void:
	if attack_cd > 0.0 or attack_timer > 0.0:
		return
	attack_timer = _attack_anim_time()
	attack_cd = _attack_cooldown()
	if attack_hitbox != null:
		attack_hitbox.monitoring = true

func _on_attack_hit(body: Node) -> void:
	if body == self:
		return
	if not body.has_method("take_damage"):
		return
	if not body.is_in_group("player"):
		return
	var dir := 1.0 if body.global_position.x >= global_position.x else -1.0
	body.take_damage(_attack_damage(), Vector2(dir, 0) * KNOCKBACK_TO_PLAYER)

func take_damage(amount: int, kb: Vector2 = Vector2.ZERO) -> void:
	if dead:
		return
	hp = max(0, hp - amount)
	stun_timer = 0.2
	velocity = kb
	modulate = Color(1, 0.6, 0.6, 1)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, 0.18)
	if hp <= 0:
		_die()

func _die() -> void:
	dead = true
	died.emit(self)
	queue_free()

# ── 子類別 override hook ──
func _hp_max() -> int: return HP_MAX
func _attack_damage() -> int: return ATTACK_DAMAGE
func _attack_range() -> float: return ATTACK_RANGE
func _attack_cooldown() -> float: return ATTACK_COOLDOWN
func _attack_anim_time() -> float: return ATTACK_ANIM_TIME
func _speed() -> float: return SPEED
