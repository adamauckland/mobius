import { describe, it, expect } from "vitest";
import { areAllCrittersCollected } from "@/rules/areAllCrittersCollected";

describe("areAllCrittersCollected", () => {
	it("returns false when the level has no critters", () => {
		expect(areAllCrittersCollected({ total: 0, collected: 0 })).toBe(false);
	});

	it("returns false when no critters have been collected", () => {
		expect(areAllCrittersCollected({ total: 4, collected: 0 })).toBe(false);
	});

	it("returns false when some but not all critters are collected", () => {
		expect(areAllCrittersCollected({ total: 4, collected: 3 })).toBe(false);
	});

	it("returns true the moment the last critter is collected", () => {
		expect(areAllCrittersCollected({ total: 4, collected: 4 })).toBe(true);
	});

	it("returns true when collected exceeds total (defensive)", () => {
		expect(areAllCrittersCollected({ total: 4, collected: 5 })).toBe(true);
	});
});
