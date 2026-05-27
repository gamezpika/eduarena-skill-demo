extends CharacterBody2D

# ── 鍵位 ──
# ↑↓←→ 移動 / 空白 攻擊 / Z 跳 / C 衝刺 / X 絕招

const SPEED := 240.0
const DASH_SPEED := 900.0
const DASH_TIME := 0.3
const ATTACK_TIME := 0.28
const ATTACK_DAMAGE := 1
const LANDING_DAMAGE := 2
const JUMP_TIME := 0.7  # sprite 動畫 41 frames @ 60fps = 0.683s
const JUMP_HEIGHT := 150.0  # 視覺上抬 px

# 地面深度範圍（Y 軸 = beat'em up 深度）：腳底只能在黃線下到視窗底之間
const GROUND_MIN_Y := 560.0
const GROUND_MAX_Y := 700.0
const HIT_INVULN := 0.5
const KNOCKBACK := 220.0

@onready var visual: Node2D = $Visual
@onready var sprite: AnimatedSprite2D = $Visual/Sprite
@onready var attack_hitbox: Area2D = $Visual/AttackHitbox
@onready var landing_hitbox: Area2D = $LandingHitbox
@onready var shadow: ColorRect = $Shadow

var max_hp := 10
var hp := 10
var facing := 1     # +1 右 / -1 左
var attack_timer := 0.0
var dash_timer := 0.0
var jump_timer := 0.0
var invuln_timer := 0.0
var dead := false

signal hp_changed(value: int, max_value: int)
signal died

func _ready() -> void:
	add_to_group("player")
	attack_hitbox.body_entered.connect(_on_attack_hit)
	landing_hitbox.body_entered.connect(_on_landing_hit)
	sprite.animation_finished.connect(_on_sprite_anim_finished)
	hp_changed.emit(hp, max_hp)

func _on_sprite_anim_finished() -> void:
	if sprite.animation == &"attack" or sprite.animation == &"jump":
		sprite.play(&"idle")

func _physics_process(delta: float) -> void:
	if dead:
		return
	_tick_timers(delta)

	var input_vec := _read_move()
	var moving := input_vec != Vector2.ZERO

	# 動作 lock：攻擊期間鎖、衝刺恆定速度、跳躍中空中可控、其餘地面 SPEED
	if attack_timer > 0.0:
		velocity = Vector2.ZERO
	elif dash_timer > 0.0:
		velocity = Vector2(DASH_SPEED * facing, 0)
	elif jump_timer > 0.0:
		# 空中：X 軸可控（80% 地面速度），Y 不動（垂直拋物線靠 visual.position.y）
		velocity = Vector2(input_vec.x * SPEED * 0.8, 0)
		if input_vec.x != 0:
			facing = sign(input_vec.x)
			visual.scale.x = facing
	else:
		velocity = input_vec * SPEED
		if moving:
			facing = 1 if input_vec.x >= 0 else (-1 if input_vec.x < 0 else facing)
			if input_vec.x != 0:
				facing = sign(input_vec.x)
				visual.scale.x = facing

	move_and_slide()
	# clamp Y：玩家只能在地面帶內走（黃線下方到視窗底），不能走到牆/塗鴉
	position.y = clamp(position.y, GROUND_MIN_Y, GROUND_MAX_Y)

	# 跳躍視覺：visual.position.y 拋物線（sprite 內動作小，加 lift 才看得出離地）
	if jump_timer > 0.0:
		var t: float = 1.0 - (jump_timer / JUMP_TIME)
		visual.position.y = -JUMP_HEIGHT * 4.0 * t * (1.0 - t)
		shadow.scale = Vector2(1.0 - 0.4 * (-visual.position.y / JUMP_HEIGHT), 1.0)
	else:
		visual.position.y = 0
		shadow.scale = Vector2.ONE

	_handle_actions()
	_update_locomotion_anim(moving)

func _update_locomotion_anim(moving: bool) -> void:
	# 動作期間（攻擊/跳躍/衝刺）sprite 由各自動作管，這裡不覆寫
	if attack_timer > 0.0 or jump_timer > 0.0 or dash_timer > 0.0:
		return
	var target := &"walk" if moving else &"idle"
	if sprite.animation != target:
		sprite.play(target)

func _tick_timers(delta: float) -> void:
	if attack_timer > 0.0:
		attack_timer = max(0.0, attack_timer - delta)
		if attack_timer == 0.0:
			attack_hitbox.monitoring = false
	if dash_timer > 0.0:
		dash_timer = max(0.0, dash_timer - delta)
		if dash_timer == 0.0:
			# 衝刺結束復原碰撞 mask
			collision_mask = 4
	if jump_timer > 0.0:
		jump_timer = max(0.0, jump_timer - delta)
		if jump_timer == 0.0:
			# 落地復原碰撞 + 觸發震波
			collision_layer = 1
			collision_mask = 4
			sprite.modulate = Color.WHITE
			print("[JUMP] end pos=", position, " layer=", collision_layer, " mask=", collision_mask)
			landing_hitbox.monitoring = true
			# 下一禎關掉
			await get_tree().process_frame
			landing_hitbox.monitoring = false
	if invuln_timer > 0.0:
		invuln_timer = max(0.0, invuln_timer - delta)
		if invuln_timer == 0.0:
			modulate = Color.WHITE

func _read_move() -> Vector2:
	var v := Vector2.ZERO
	if Input.is_key_pressed(KEY_LEFT):
		v.x -= 1
	if Input.is_key_pressed(KEY_RIGHT):
		v.x += 1
	if Input.is_key_pressed(KEY_UP):
		v.y -= 1
	if Input.is_key_pressed(KEY_DOWN):
		v.y += 1
	return v.normalized() if v.length() > 0 else Vector2.ZERO

func _handle_actions() -> void:
	# 攻擊（空白）
	if Input.is_key_pressed(KEY_SPACE) and attack_timer <= 0.0 and dash_timer <= 0.0:
		_do_attack()
	# 跳（Z）
	if Input.is_key_pressed(KEY_Z) and jump_timer <= 0.0 and attack_timer <= 0.0:
		_do_jump()
	# 衝刺（C）
	if Input.is_key_pressed(KEY_C) and dash_timer <= 0.0 and attack_timer <= 0.0:
		_do_dash()

func _do_attack() -> void:
	attack_timer = ATTACK_TIME
	attack_hitbox.monitoring = true
	sprite.play(&"attack")

func _do_jump() -> void:
	jump_timer = JUMP_TIME
	sprite.play(&"jump")
	# 跳躍中完全 passthrough：穿過桶/箱/敵人（layer+mask 都歸 0）
	collision_layer = 0
	collision_mask = 0
	sprite.modulate = Color(1.6, 1.6, 0.4, 1)  # 跳躍中亮黃，視覺確認 logic 跑
	print("[JUMP] start pos=", position, " layer=", collision_layer, " mask=", collision_mask)

func _do_dash() -> void:
	dash_timer = DASH_TIME
	# 衝刺無敵：清碰撞 mask
	collision_mask = 0

func _on_attack_hit(body: Node) -> void:
	_apply_damage(body, ATTACK_DAMAGE, KNOCKBACK)

func _on_landing_hit(body: Node) -> void:
	_apply_damage(body, LANDING_DAMAGE, KNOCKBACK * 1.5)

func _apply_damage(body: Node, dmg: int, kb: float) -> void:
	if body == self:
		return
	if not body.has_method("take_damage"):
		return
	var dir := 1.0 if body.global_position.x >= global_position.x else -1.0
	body.take_damage(dmg, Vector2(dir, 0) * kb)

func take_damage(amount: int, knockback: Vector2 = Vector2.ZERO) -> void:
	if dead or invuln_timer > 0.0 or dash_timer > 0.0:
		return
	hp = max(0, hp - amount)
	invuln_timer = HIT_INVULN
	modulate = Color(1, 0.5, 0.5, 1)
	if knockback.length() > 0:
		velocity = knockback
		move_and_slide()
	hp_changed.emit(hp, max_hp)
	if hp <= 0:
		_die()

func _die() -> void:
	dead = true
	modulate = Color(0.3, 0.3, 0.3, 1)
	died.emit()
