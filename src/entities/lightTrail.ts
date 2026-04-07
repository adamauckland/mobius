import { Actor, ScreenElement, Vector, Color, Circle, EasingFunctions } from "excalibur";
import { game } from "./game";
import { Z_RIPPLE, Z_HUD } from "./zIndex";

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

/**
 * Spawn lights that fly from a world position towards the score HUD (top-right).
 * Multiple particles spread slightly for a shower effect.
 */
export function spawnScoreLight(worldPos: Vector, count = 3) {
  const screenPos = game.screen.worldToScreenCoordinates(worldPos);
  const targetX = game.screen.resolution.width - 10;
  const targetY = 10;

  for (let i = 0; i < count; i++) {
    const light = new ScreenElement({
      pos: new Vector(screenPos.x, screenPos.y),
      z: Z_HUD + 1,
    });
    const circle = new Circle({ radius: 2, color: Color.fromHex("#ffee44") });
    light.graphics.use(circle);

    // Pulsing glow
    light.graphics.onPreDraw = () => {
      const pulse = 0.8 + Math.sin(game.clock.now() * 0.02 + i) * 0.4;
      light.scale.x = pulse;
      light.scale.y = pulse;
    };

    game.add(light);

    // Stagger each particle slightly
    const delay = i * 80;
    game.clock.schedule(() => {
      light.actions
        .easeTo(new Vector(targetX, targetY), 600, EasingFunctions.EaseInOutCubic)
        .callMethod(() => light.kill());
    }, delay);
  }
}
