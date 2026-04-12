import { describe, it, expect } from "vitest";
import { canCompleteLevel } from "@/rules/canCompleteLevel";

describe("canCompleteLevel", () => {
	it("allows completion when the level has no critters", () => {
		expect(canCompleteLevel({ critterTotal: 0, critterCollected: 0 })).toBe(
			true,
		);
	});

	it("blocks completion when no critters have been collected yet", () => {
		expect(canCompleteLevel({ critterTotal: 3, critterCollected: 0 })).toBe(
			false,
		);
	});

	it("blocks completion when some but not all critters are collected", () => {
		expect(canCompleteLevel({ critterTotal: 3, critterCollected: 2 })).toBe(
			false,
		);
	});

	it("allows completion when all critters are collected", () => {
		expect(canCompleteLevel({ critterTotal: 3, critterCollected: 3 })).toBe(
			true,
		);
	});

	it("allows completion when collected exceeds total (defensive)", () => {
		expect(canCompleteLevel({ critterTotal: 3, critterCollected: 5 })).toBe(
			true,
		);
	});

	it("allows completion on a single-critter level once collected", () => {
		expect(canCompleteLevel({ critterTotal: 1, critterCollected: 1 })).toBe(
			true,
		);
	});

	it("blocks completion on a single-critter level when not collected", () => {
		expect(canCompleteLevel({ critterTotal: 1, critterCollected: 0 })).toBe(
			false,
		);
	});
});
