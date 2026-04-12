import { describe, it, expect } from "vitest";
import { shouldHandlePlayerDeath, canRevive } from "@/rules/deathRules";

describe("shouldHandlePlayerDeath", () => {
	it("handles death of the active player when game is not over", () => {
		expect(
			shouldHandlePlayerDeath({
				killedPlayerIsActive: true,
				gameOver: false,
			}),
		).toBe(true);
	});

	it("ignores ghost replays dying", () => {
		expect(
			shouldHandlePlayerDeath({
				killedPlayerIsActive: false,
				gameOver: false,
			}),
		).toBe(false);
	});

	it("ignores deaths after game over", () => {
		expect(
			shouldHandlePlayerDeath({
				killedPlayerIsActive: true,
				gameOver: true,
			}),
		).toBe(false);
	});

	it("ignores ghost deaths after game over", () => {
		expect(
			shouldHandlePlayerDeath({
				killedPlayerIsActive: false,
				gameOver: true,
			}),
		).toBe(false);
	});
});

describe("canRevive", () => {
	it("allows revive when lives remain", () => {
		expect(canRevive({ livesRemaining: 1 })).toBe(true);
	});

	it("blocks revive when lives are exhausted", () => {
		expect(canRevive({ livesRemaining: 0 })).toBe(false);
	});

	it("blocks revive when lives went negative (defensive)", () => {
		expect(canRevive({ livesRemaining: -1 })).toBe(false);
	});
});
