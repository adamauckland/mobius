import { describe, it, expect } from "vitest";
import { canEnterPortal } from "@/rules/canEnterPortal";

describe("canEnterPortal", () => {
	it("allows the active recording player to trigger a portal", () => {
		expect(canEnterPortal({ isActivePlayer: true })).toBe(true);
	});

	it("blocks ghost replays from triggering a portal", () => {
		expect(canEnterPortal({ isActivePlayer: false })).toBe(false);
	});
});
