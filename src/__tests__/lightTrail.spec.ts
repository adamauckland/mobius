import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	class MockVector {
		x: number;
		y: number;
		constructor(x = 0, y = 0) {
			this.x = x;
			this.y = y;
		}
		clone() {
			return new MockVector(this.x, this.y);
		}
		sub(other: { x: number; y: number }) {
			return new MockVector(this.x - other.x, this.y - other.y);
		}
	}
	class MockActor {
		pos: MockVector;
		z = 0;
		scale = { x: 1, y: 1 };
		graphics = {
			use: vi.fn(),
			visible: true,
			onPreDraw: null as null | (() => void),
			offset: { x: 0, y: 0 },
		};
		actions = {
			easeTo: vi.fn().mockReturnThis(),
			callMethod: vi.fn().mockReturnThis(),
			fade: vi.fn().mockReturnThis(),
		};
		kill = vi.fn();
		constructor(options?: any) {
			this.pos = options?.pos
				? new MockVector(options.pos.x, options.pos.y)
				: new MockVector();
			if (options?.z !== undefined) this.z = options.z;
		}
	}
	class MockParticleEmitter extends MockActor {
		emitterType: string;
		radius: number;
		isEmitting: boolean;
		focus: MockVector | undefined;
		focusAccel: number | undefined;
		particle: any;
		emitParticles = vi.fn();
		constructor(options: any) {
			super(options);
			this.emitterType = options.emitterType;
			this.radius = options.radius;
			this.isEmitting = options.isEmitting;
			this.focus = options.focus;
			this.focusAccel = options.focusAccel;
			this.particle = options.particle;
		}
	}
	class MockCircle {
		constructor(public options?: any) {}
	}
	class MockColor {
		constructor(public hex?: string) {}
		static fromHex(hex: string) {
			return new MockColor(hex);
		}
	}
	class MockGpuParticleEmitter extends MockParticleEmitter {
		maxParticles: number;
		constructor(options: any) {
			super(options);
			this.maxParticles = options.maxParticles ?? 0;
		}
	}
	return {
		Actor: MockActor,
		ScreenElement: MockActor,
		Vector: MockVector,
		Color: MockColor,
		Circle: MockCircle,
		EasingFunctions: { EaseInOutCubic: "easeInOutCubic" },
		ParticleEmitter: MockParticleEmitter,
		GpuParticleEmitter: MockGpuParticleEmitter,
		EmitterType: { Circle: "circle", Rectangle: "rectangle" },
	};
});

vi.mock("../game", () => {
	const scheduledCallbacks: Array<{ cb: () => void; delay: number }> = [];
	return {
		game: {
			add: vi.fn(),
			screen: {
				worldToScreenCoordinates: (v: any) => ({ x: v.x, y: v.y }),
				resolution: { width: 800, height: 600 },
			},
			clock: {
				now: () => 0,
				schedule: vi.fn((cb: () => void, delay: number) => {
					scheduledCallbacks.push({ cb, delay });
					return 0;
				}),
			},
			__scheduledCallbacks: scheduledCallbacks,
		},
	};
});

vi.mock("../zIndex", () => ({
	Z_RIPPLE: 100,
	Z_HUD: 1000,
}));

import {
	spawnDeathExplosion,
	spawnRewindPixels,
} from "@/entities/Light/lightTrail";
import {
	Vector,
	ParticleEmitter,
	GpuParticleEmitter,
	EmitterType,
} from "excalibur";
import { game } from "@/game";
import { Z_RIPPLE } from "@/ui/zIndex";

describe("lightTrail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(game as any).__scheduledCallbacks.length = 0;
	});

	describe("spawnDeathExplosion", () => {
		it("adds a single ParticleEmitter to the game (not one actor per particle)", () => {
			spawnDeathExplosion(new Vector(50, 80));

			expect(game.add).toHaveBeenCalledTimes(1);
			const emitter = (game.add as any).mock.calls[0][0];
			expect(emitter).toBeInstanceOf(ParticleEmitter);
		});

		it("positions the emitter at the supplied location", () => {
			spawnDeathExplosion(new Vector(50, 80));

			const emitter = (game.add as any).mock.calls[0][0];
			expect(emitter.pos.x).toBe(50);
			expect(emitter.pos.y).toBe(80);
			expect(emitter.z).toBe(Z_RIPPLE + 1);
		});

		it("emits a burst of particles in a circle pattern", () => {
			spawnDeathExplosion(new Vector(0, 0));

			const emitter = (game.add as any).mock.calls[0][0];
			expect(emitter.emitterType).toBe(EmitterType.Circle);
			expect(emitter.isEmitting).toBe(false);
			// Particles are emitted one at a time so each gets a randomised colour
			expect(emitter.emitParticles).toHaveBeenCalledTimes(360);
			for (const call of (emitter.emitParticles as any).mock.calls) {
				expect(call[0]).toBe(1);
			}
		});

		it("randomises particle colours across the burst", () => {
			spawnDeathExplosion(new Vector(0, 0));

			const emitter = (game.add as any).mock.calls[0][0];
			// emitColouredBurst mutates beginColor/endColor before each emit;
			// after the burst the emitter's particle config holds the *last* pair,
			// which must still be a valid Color instance from the death palette.
			expect(emitter.particle.beginColor).toBeDefined();
			expect(emitter.particle.endColor).toBeDefined();
		});

		it("schedules the emitter to be killed after the particle lifetime", () => {
			spawnDeathExplosion(new Vector(0, 0));

			const scheduled = (game as any).__scheduledCallbacks;
			expect(scheduled).toHaveLength(1);
			expect(scheduled[0].delay).toBeGreaterThan(0);

			const emitter = (game.add as any).mock.calls[0][0];
			scheduled[0].cb();
			expect(emitter.kill).toHaveBeenCalled();
		});
	});

	describe("spawnRewindPixels", () => {
		it("adds one GpuParticleEmitter per palette colour", () => {
			spawnRewindPixels(new Vector(0, 0), new Vector(100, 100));

			// > 1 because we want colour variety, but small (≤ palette length)
			// because each emitter is one draw call
			expect((game.add as any).mock.calls.length).toBeGreaterThan(1);
			expect((game.add as any).mock.calls.length).toBeLessThanOrEqual(8);
			for (const call of (game.add as any).mock.calls) {
				expect(call[0]).toBeInstanceOf(GpuParticleEmitter);
			}
		});

		it("positions every emitter at `from` and uses `to` as the world-space focus", () => {
			spawnRewindPixels(new Vector(10, 20), new Vector(300, 400));

			for (const call of (game.add as any).mock.calls) {
				const emitter = call[0];
				expect(emitter.pos.x).toBe(10);
				expect(emitter.pos.y).toBe(20);
				// GpuParticleEmitter takes focus as a world-space point (uniform),
				// not an offset from emitter pos like the CPU ParticleEmitter does.
				expect(emitter.particle.focus.x).toBe(300);
				expect(emitter.particle.focus.y).toBe(400);
				expect(emitter.particle.focusAccel).toBeGreaterThan(0);
			}
		});

		it("spawns particles stationary so the focus pull (not initial velocity) drives motion", () => {
			spawnRewindPixels(new Vector(0, 0), new Vector(100, 100));

			for (const call of (game.add as any).mock.calls) {
				const emitter = call[0];
				expect(emitter.particle.minSpeed).toBe(0);
				expect(emitter.particle.maxSpeed).toBe(0);
				expect(emitter.radius).toBeGreaterThan(0);
			}
		});

		it("emits roughly the requested total number of particles across all emitters", () => {
			spawnRewindPixels(new Vector(0, 0), new Vector(0, 0));

			let total = 0;
			for (const call of (game.add as any).mock.calls) {
				const emitter = call[0];
				expect(emitter.emitParticles).toHaveBeenCalledTimes(1);
				total += (emitter.emitParticles as any).mock.calls[0][0];
			}
			// 280 split across 5 emitters → ceil(280/5)=56 each → 280 total
			expect(total).toBeGreaterThanOrEqual(280);
			expect(total).toBeLessThan(290);
		});

		it("schedules every emitter to be killed after the particle lifetime", () => {
			spawnRewindPixels(new Vector(0, 0), new Vector(0, 0));

			const scheduled = (game as any).__scheduledCallbacks;
			expect(scheduled).toHaveLength(1);

			scheduled[0].cb();
			for (const call of (game.add as any).mock.calls) {
				expect(call[0].kill).toHaveBeenCalled();
			}
		});
	});
});
