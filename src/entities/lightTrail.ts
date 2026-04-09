import {
	Actor,
	ScreenElement,
	Vector,
	Color,
	Circle,
	Rectangle,
	EasingFunctions,
} from "excalibur";
import { game } from "../game";
import { Z_RIPPLE, Z_HUD } from "../zIndex";

const REWIND_COLORS = ["#66bbff", "#4488ff", "#aa88ff", "#ffffff", "#ffaa44"];
const DEATH_COLORS = ["#ff4444", "#ff6600", "#ffaa00", "#ffffff", "#ff2222"];

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
				.easeTo(
					new Vector(targetX, targetY),
					600,
					EasingFunctions.EaseInOutCubic,
				)
				.callMethod(() => light.kill());
		}, delay);
	}
}

/**
 * Spawn a cloud of pixels that explode from `from`, travel through space,
 * and converge at `to` — a time-rewind visual effect.
 * Returns the total duration in ms so callers can schedule follow-up actions.
 */
export const REWIND_EFFECT_DURATION = 3000;

/**
 * Spawn pixels that explode outward from a position and fade out — a death/game-over effect.
 */
export function spawnDeathExplosion(pos: Vector) {
	const PARTICLE_COUNT = 360;
	const EXPLODE_MS = 800;
	const FADE_MS = 600;

	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const pixel = new Actor({
			pos: pos.clone(),
			z: Z_RIPPLE + 1,
		});

		const size = 1.5 + Math.random() * 2;
		const color = DEATH_COLORS[Math.floor(Math.random() * DEATH_COLORS.length)];
		pixel.graphics.use(
			new Rectangle({ width: size, height: size, color: Color.fromHex(color) }),
		);

		const phase = Math.random() * Math.PI * 2;
		pixel.graphics.onPreDraw = () => {
			const pulse = 0.7 + Math.sin(game.clock.now() * 0.012 + phase) * 0.5;
			pixel.scale.x = pulse;
			pixel.scale.y = pulse;
		};

		game.add(pixel);

		const angle =
			(Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
		const radius = 30 + Math.random() * 40;
		const target = new Vector(
			pos.x + Math.cos(angle) * radius,
			pos.y + Math.sin(angle) * radius,
		);

		pixel.actions
			.easeTo(target, EXPLODE_MS, EasingFunctions.EaseOutCubic)
			.fade(0, FADE_MS)
			.callMethod(() => pixel.kill());
	}
}

export function spawnRewindPixels(from: Vector, to: Vector) {
	const PARTICLE_COUNT = 280;
	const EXPLODE_MS = 500;
	const TRAVEL_MS = 500;
	const CONVERGE_MS = 1000;

	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const pixel = new Actor({
			pos: from.clone(),
			z: Z_RIPPLE + 1,
		});

		const size = 1 + Math.random() * 1.5;
		const color =
			REWIND_COLORS[Math.floor(Math.random() * REWIND_COLORS.length)];
		pixel.graphics.use(
			new Rectangle({ width: size, height: size, color: Color.fromHex(color) }),
		);

		// Gentle pulse while travelling
		const phase = Math.random() * Math.PI * 2;
		pixel.graphics.onPreDraw = () => {
			const pulse = 0.7 + Math.sin(game.clock.now() * 0.012 + phase) * 0.5;
			pixel.scale.x = pulse;
			pixel.scale.y = pulse;
		};

		game.add(pixel);

		// Phase 1: explode outward in a ring
		const angle =
			(Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
		const radius = 10 + Math.random() * 120;
		const explodeTarget = new Vector(
			from.x + Math.cos(angle) * radius,
			from.y + Math.sin(angle) * radius,
		);

		// Phase 2: fly toward destination with some scatter
		const spread = 6;
		const midTarget = new Vector(
			to.x + (Math.random() - 0.5) * spread,
			to.y + (Math.random() - 0.5) * spread,
		);

		pixel.actions
			.easeTo(explodeTarget, EXPLODE_MS, EasingFunctions.EaseOutCubic)
			.easeTo(midTarget, TRAVEL_MS, EasingFunctions.EaseInOutCubic)
			.easeTo(to.clone(), CONVERGE_MS, EasingFunctions.EaseInCubic)
			.fade(0, 100)
			.callMethod(() => pixel.kill());
	}
}
