extends CharacterBody2D

const SPEED := 220.0

func _physics_process(_delta: float) -> void:
	var dir := Vector2.ZERO
	dir.x = Input.get_axis("move_left", "move_right")
	dir.y = Input.get_axis("move_up", "move_down")
	if dir.length() > 0.0:
		dir = dir.normalized()
	velocity = dir * SPEED
	move_and_slide()
