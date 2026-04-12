import { describe, it, expect } from "vitest";
import { canPickUpItem, canDropItemAtTile } from "@/rules/carryRules";

describe("canPickUpItem", () => {
	it("allows pickup when hands are empty", () => {
		expect(canPickUpItem({ carryingRock: false, carryingParcel: false })).toBe(
			true,
		);
	});

	it("blocks pickup when already carrying a rock", () => {
		expect(canPickUpItem({ carryingRock: true, carryingParcel: false })).toBe(
			false,
		);
	});

	it("blocks pickup when already carrying a parcel", () => {
		expect(canPickUpItem({ carryingRock: false, carryingParcel: true })).toBe(
			false,
		);
	});

	it("blocks pickup when impossibly carrying both", () => {
		expect(canPickUpItem({ carryingRock: true, carryingParcel: true })).toBe(
			false,
		);
	});
});

describe("canDropItemAtTile", () => {
	it("blocks drop when target tile is not the player's tile", () => {
		expect(
			canDropItemAtTile({
				targetTileIndex: 10,
				playerTileIndex: 11,
				carryingRock: true,
				carryingParcel: false,
			}),
		).toBe(false);
	});

	it("blocks drop when player is not carrying anything", () => {
		expect(
			canDropItemAtTile({
				targetTileIndex: 10,
				playerTileIndex: 10,
				carryingRock: false,
				carryingParcel: false,
			}),
		).toBe(false);
	});

	it("allows drop of a rock on the player's own tile", () => {
		expect(
			canDropItemAtTile({
				targetTileIndex: 10,
				playerTileIndex: 10,
				carryingRock: true,
				carryingParcel: false,
			}),
		).toBe(true);
	});

	it("allows drop of a parcel on the player's own tile", () => {
		expect(
			canDropItemAtTile({
				targetTileIndex: 10,
				playerTileIndex: 10,
				carryingRock: false,
				carryingParcel: true,
			}),
		).toBe(true);
	});
});
