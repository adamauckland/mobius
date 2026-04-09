import {
	Actor,
	ScreenElement,
	Vector,
	Color,
	Circle,
	EasingFunctions,
	ParticleEmitter,
	GpuParticleEmitter,
	EmitterType,
} from "excalibur";
import { game } from "../game";
import { Z_RIPPLE, Z_HUD } from "../ui/zIndex";

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

// Palettes are sampled per particle so each burst is multi-coloured
// rather than a single begin→end gradient.
const DEATH_BEGIN_PALETTE = [
	"#ff6600",
	"#ff8822",
	"#ffaa44",
	"#ff4400",
	"#ffcc66",
];
const DEATH_END_PALETTE = [
	"#ff2222",
	"#cc1111",
	"#ff4400",
	"#aa0000",
	"#ff6622",
];

const REWIND_BEGIN_PALETTE = [
	"#66bbff",
	"#4488ff",
	"#88aaff",
	"#aaccff",
	"#5599ee",
];
const REWIND_END_PALETTE = [
	"#aa88ff",
	"#8866dd",
	"#bb99ff",
	"#9977ee",
	"#cc99ff",
];

/**
 * Emit `count` particles, picking a random colour pair from the supplied palettes
 * for each particle so the burst is multi-coloured. The emitter's `particle`
 * config is mutated between single-particle emits — this works because
 * `ParticleEmitter._createParticle` reads `beginColor`/`endColor` at emit time.
 */
function emitColouredBurst(
	emitter: ParticleEmitter,
	count: number,
	beginPalette: readonly string[],
	endPalette: readonly string[],
) {
	for (let i = 0; i < count; i++) {
		const idx = Math.floor(Math.random() * beginPalette.length);
		emitter.particle.beginColor = Color.fromHex(beginPalette[idx]);
		emitter.particle.endColor = Color.fromHex(
			endPalette[Math.floor(Math.random() * endPalette.length)],
		);
		emitter.emitParticles(1);
	}
}

/**
 * Spawn pixels that explode outward from a position and fade out — a death/game-over effect.
 */
export function spawnDeathExplosion(pos: Vector) {
	const PARTICLE_COUNT = 360;
	const LIFE_MS = 1400;

	const emitter = new ParticleEmitter({
		pos: pos.clone(),
		z: Z_RIPPLE + 1,
		emitterType: EmitterType.Circle,
		radius: 1,
		isEmitting: false,
		particle: {
			life: LIFE_MS,
			fade: true,
			beginColor: Color.fromHex(DEATH_BEGIN_PALETTE[0]),
			endColor: Color.fromHex(DEATH_END_PALETTE[0]),
			minSize: 4,
			maxSize: 9,
			minSpeed: 40,
			maxSpeed: 90,
			minAngle: 0,
			maxAngle: Math.PI * 2,
		},
	});

	game.add(emitter);
	emitColouredBurst(
		emitter,
		PARTICLE_COUNT,
		DEATH_BEGIN_PALETTE,
		DEATH_END_PALETTE,
	);

	// Self-cleanup once all particles have died
	game.clock.schedule(() => emitter.kill(), LIFE_MS + 100);
}

export function spawnRewindPixels(from: Vector, to: Vector) {
	const PARTICLE_COUNT = 280;
	const LIFE_MS = 2000;
	const SPAWN_RADIUS = 80;

	// We use GpuParticleEmitter rather than the CPU ParticleEmitter for two reasons:
	//
	//   1. The CPU Particle.update has a bug where focus acceleration is multiplied
	//      by `elapsed/1000` *before* being passed to EulerIntegrator (which then
	//      multiplies by elapsed again). The result is that focusAccel is effectively
	//      scaled by dt², so at 60fps an accel of 800 becomes ~0.22 px/s² — visually
	//      static. The GPU shader does the integration correctly.
	//   2. GPU emitters are a single draw call regardless of particle count.
	//
	// Spawn semantics on the GPU emitter (see GpuParticleRenderer.emitParticles):
	//   - position is offset by `radius * (cos θ, sin θ)` for the same θ used as
	//     velocity direction, so non-zero speed gives a radially outward kick.
	//     We set speed to 0 so particles start stationary, distributed across the
	//     spawn disc, and only the focus pull moves them.
	//   - focus is a world-space point on the GPU path (uniform), so we pass `to`
	//     directly — no offset translation needed unlike the CPU emitter.

	const focus = to.clone();
	const sharedConfig = {
		life: LIFE_MS,
		fade: true,
		startSize: 8,
		endSize: 2,
		minSpeed: 0,
		maxSpeed: 0,
		minAngle: 0,
		maxAngle: Math.PI * 2,
		focus,
		focusAccel: 1200,
	};

	// One emitter per palette entry — gives us colour variety while keeping
	// the total draw calls low (palette length, currently 5).
	const emitters: GpuParticleEmitter[] = [];
	const perEmitter = Math.ceil(PARTICLE_COUNT / REWIND_BEGIN_PALETTE.length);

	for (let i = 0; i < REWIND_BEGIN_PALETTE.length; i++) {
		const emitter = new GpuParticleEmitter({
			pos: from.clone(),
			z: Z_RIPPLE + 1,
			emitterType: EmitterType.Circle,
			radius: SPAWN_RADIUS,
			isEmitting: false,
			maxParticles: perEmitter,
			particle: {
				...sharedConfig,
				beginColor: Color.fromHex(REWIND_BEGIN_PALETTE[i]),
				endColor: Color.fromHex(REWIND_END_PALETTE[i]),
			},
		});
		game.add(emitter);
		emitter.emitParticles(perEmitter);
		emitters.push(emitter);
	}

	game.clock.schedule(() => {
		for (const e of emitters) e.kill();
	}, LIFE_MS + 100);
}
