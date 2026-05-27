extends Area2D

const DAMAGE := 1
const LIFETIME := 4.0
const KNOCKBACK := 180.0

var velocity := Vector2.ZERO
var life := LIFETIME

func _ready() -> void:
	body_entered.connect(_on_hit)

func _physics_process(delta: float) -> void:
	position += velocity * delta
	life -= delta
	if life <= 0.0:
		queue_free()

func _on_hit(body: Node) -> void:
	if body.is_in_group("player") and body.has_method("take_damage"):
		var dir := 1.0 if body.global_position.x >= global_position.x else -1.0
		body.take_damage(DAMAGE, Vector2(dir, 0) * KNOCKBACK)
		queue_free()
