import { describe, it, expect } from "vitest";
import { isLowTime, LOW_TIME_THRESHOLD_MS } from "@/rules/timerUrgency";

describe("isLowTime", () => {
	it("is false when remaining time is well above the threshold", () => {
		expect(isLowTime(30000)).toBe(false);
	});

	it("is false exactly at the threshold", () => {
		expect(isLowTime(LOW_TIME_THRESHOLD_MS)).toBe(false);
	});

	it("is true just under the threshold", () => {
		expect(isLowTime(LOW_TIME_THRESHOLD_MS - 1)).toBe(true);
	});

	it("is true at one second remaining", () => {
		expect(isLowTime(1000)).toBe(true);
	});

	it("is false at zero (timer expired, no longer urgent)", () => {
		expect(isLowTime(0)).toBe(false);
	});

	it("is false for negative values", () => {
		expect(isLowTime(-500)).toBe(false);
	});
});
