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
const PLATFORM_STAND_JUMP_TIME := 0.01
const PLATFORM_SNAP_COOLDOWN := 0.08
const PLAYER_PLATFORM_HALF_WIDTH := 28.0

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
var ground_collision_layer := 1
var ground_collision_mask := 4
var was_jump_pressed := false
var jump_queued := false
var standing_on_breakable := false
var standing_platform_visual_y := 0.0
var jump_base_visual_y := 0.0
var platform_snap_cooldown := 0.0

signal hp_changed(value: int, max_value: int)
signal died

func _ready() -> void:
	add_to_group("player")
	ground_collision_layer = collision_layer
	ground_collision_mask = collision_mask
	attack_hitbox.body_entered.connect(_on_attack_hit)
	landing_hitbox.body_entered.connect(_on_landing_hit)
	sprite.animation_finished.connect(_on_sprite_anim_finished)
	hp_changed.emit(hp, max_hp)

func _on_sprite_anim_finished() -> void:
	if sprite.animation == &"attack" or sprite.animation == &"jump":
		sprite.play(&"idle")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_Z or event.keycode == KEY_Z:
			jump_queued = true

func _physics_process(delta: float) -> void:
	if dead:
		return
	_tick_timers(delta)
	_handle_actions()

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

	_update_jump_visual(delta)

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
			collision_mask = ground_collision_mask
	if jump_timer > 0.0:
		if standing_on_breakable:
			jump_timer = PLATFORM_STAND_JUMP_TIME
		else:
			jump_timer = max(0.0, jump_timer - delta)
		if jump_timer == 0.0:
			# 落地復原碰撞 + 觸發震波（用 deferred 而非 await 避免 yield _physics_process）
			collision_layer = ground_collision_layer
			collision_mask = ground_collision_mask
			jump_base_visual_y = 0.0
			landing_hitbox.monitoring = true
			landing_hitbox.set_deferred("monitoring", false)
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
	var jump_pressed := Input.is_physical_key_pressed(KEY_Z) or Input.is_key_pressed(KEY_Z)
	var jump_just_pressed := jump_queued or (jump_pressed and not was_jump_pressed)
	jump_queued = false

	# 攻擊（空白）
	if (Input.is_physical_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_SPACE)) and attack_timer <= 0.0 and dash_timer <= 0.0:
		_do_attack()
	# 跳（Z）
	if jump_just_pressed and (jump_timer <= 0.0 or standing_on_breakable) and attack_timer <= 0.0:
		_do_jump()
	was_jump_pressed = jump_pressed
	# 衝刺（C）
	if (Input.is_physical_key_pressed(KEY_C) or Input.is_key_pressed(KEY_C)) and dash_timer <= 0.0 and attack_timer <= 0.0:
		_do_dash()

func _do_attack() -> void:
	attack_timer = ATTACK_TIME
	attack_hitbox.monitoring = true
	sprite.play(&"attack")

func _do_jump() -> void:
	jump_base_visual_y = visual.position.y
	jump_timer = JUMP_TIME
	platform_snap_cooldown = PLATFORM_SNAP_COOLDOWN if standing_on_breakable else 0.0
	standing_on_breakable = false
	sprite.play(&"jump")
	# 跳躍中完全 passthrough：穿過桶/箱/敵人（layer+mask 都歸 0）
	collision_layer = 0
	collision_mask = 0

func _update_jump_visual(delta: float) -> void:
	if platform_snap_cooldown > 0.0:
		platform_snap_cooldown = max(0.0, platform_snap_cooldown - delta)

	if standing_on_breakable:
		var current_platform_y: Variant = _find_breakable_platform_visual_y()
		if current_platform_y != null:
			standing_platform_visual_y = float(current_platform_y)
			jump_base_visual_y = standing_platform_visual_y
			jump_timer = PLATFORM_STAND_JUMP_TIME
			visual.position.y = standing_platform_visual_y
			_update_shadow()
			return

		standing_on_breakable = false
		jump_base_visual_y = 0.0
		jump_timer = _fall_timer_for_visual_y(visual.position.y)

	if jump_timer > 0.0:
		var t: float = 1.0 - (jump_timer / JUMP_TIME)
		visual.position.y = jump_base_visual_y - JUMP_HEIGHT * 4.0 * t * (1.0 - t)

		var platform_y: Variant = _find_breakable_platform_visual_y()
		if platform_y != null and platform_snap_cooldown <= 0.0 and visual.position.y >= platform_y:
			standing_on_breakable = true
			standing_platform_visual_y = float(platform_y)
			jump_base_visual_y = standing_platform_visual_y
			jump_timer = PLATFORM_STAND_JUMP_TIME
			visual.position.y = standing_platform_visual_y
	else:
		standing_on_breakable = false
		jump_base_visual_y = 0.0
		visual.position.y = 0.0

	_update_shadow()

func _find_breakable_platform_visual_y():
	var player_left := global_position.x - PLAYER_PLATFORM_HALF_WIDTH
	var player_right := global_position.x + PLAYER_PLATFORM_HALF_WIDTH
	var best_platform_y = null

	for prop in get_tree().get_nodes_in_group("breakable"):
		if not is_instance_valid(prop) or not (prop is Node2D):
			continue

		var prop_half_width := 24.0
		var prop_height := 56.0
		var collider := prop.get_node_or_null("Collider")
		if collider is CollisionShape2D and collider.shape is RectangleShape2D:
			prop_half_width = collider.shape.size.x * 0.5
			prop_height = collider.shape.size.y

		var prop_left: float = prop.global_position.x - prop_half_width
		var prop_right: float = prop.global_position.x + prop_half_width
		if player_right < prop_left or player_left > prop_right:
			continue

		var platform_y: float = prop.global_position.y - prop_height - global_position.y
		if best_platform_y == null or platform_y < best_platform_y:
			best_platform_y = platform_y

	return best_platform_y

func _fall_timer_for_visual_y(visual_y: float) -> float:
	var lift_ratio: float = clamp(-visual_y / JUMP_HEIGHT, 0.0, 1.0)
	var t: float = (1.0 + sqrt(max(0.0, 1.0 - lift_ratio))) * 0.5
	return max(PLATFORM_STAND_JUMP_TIME, JUMP_TIME * (1.0 - t))

func _update_shadow() -> void:
	if visual.position.y < 0.0:
		shadow.scale = Vector2(1.0 - 0.4 * (-visual.position.y / JUMP_HEIGHT), 1.0)
	else:
		shadow.scale = Vector2.ONE

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
