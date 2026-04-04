import { Actor, Vector, Color, Circle, EasingFunctions } from "excalibur";
import { game } from "./game";
import { Z_RIPPLE } from "./zIndex";

/**
 * Spawn a glowing light that moves from `from` to `to` over `durationMs`,
 * then disappears.
 */
export function spawnLight(from: Vector, to: Vector, durationMs: number) {
  const light = new Actor({
    pos: from.clone(),
    z: Z_RIPPLE,
  });
  const circle = new Circle({ radius: 3, color: Color.fromHex("#ffee88") });
  light.graphics.use(circle);

  // Pulsing glow
  light.graphics.onPreDraw = () => {
    const pulse = 0.8 + Math.sin(game.clock.now() * 0.015) * 0.4;
    light.scale.x = pulse;
    light.scale.y = pulse;
  };

  game.add(light);

  light.actions
    .easeTo(to.clone(), durationMs, EasingFunctions.EaseInOutCubic)
    .callMethod(() => {
      light.kill();
    });
}
