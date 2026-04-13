import { Color } from "excalibur";
import { IHUDRefs } from "./IHUDRefs";
import { createDimOverlay } from "./dimOverlay";
import { createTimerDisplay } from "./timer";
import { createScoreDisplay } from "./score";
import { createLivesDisplay } from "./lives";
import { createRewindButton } from "./rewind";
import { createTimerMeter } from "./meter";
import { overlay } from "./overlay.1";

export function createHUD(): IHUDRefs {
	const dimOverlay = createDimOverlay();
	const timerText = createTimerDisplay();
	const scoreText = createScoreDisplay();
	const livesText = createLivesDisplay();

	const gameOverLabel = overlay("TIME UP", Color.Red, 100);
	const timesUpLabel = overlay("TIME'S UP", Color.fromHex("#ff6600"), 200);
	const levelCompleteLabel = overlay(
		"LEVEL\nCOMPLETE",
		Color.fromHex("#00e676"),
		100,
		120,
		16,
	);

	const rewind = createRewindButton();
	const timerMeter = createTimerMeter();

	return {
		timerText,
		scoreText,
		livesText,
		gameOverLabel,
		timesUpLabel,
		levelCompleteLabel,
		dimOverlay,
		rewindButton: rewind.element,
		setRewindUrgent: rewind.setUrgent,
		setTimerMeter: timerMeter.setFraction,
		setTimerMeterVisible: timerMeter.setVisible,
		displayedScore: { value: 0 },
	};
}
