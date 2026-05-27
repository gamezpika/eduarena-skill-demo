extends StaticBody2D

var hp := 1
var dead := false

signal died(obj)

func _ready() -> void:
	add_to_group("breakable")

func take_damage(amount: int, _kb: Vector2 = Vector2.ZERO) -> void:
	if dead:
		return
	hp -= amount
	modulate = Color(1, 0.6, 0.6, 1)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, 0.15)
	if hp <= 0:
		dead = true
		died.emit(self)
		queue_free()
