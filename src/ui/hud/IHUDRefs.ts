import { Text, ScreenElement } from "excalibur";

export interface IHUDRefs {
	timerText: Text;
	scoreText: Text;
	livesText: Text;
	gameOverLabel: ScreenElement;
	timesUpLabel: ScreenElement;
	levelCompleteLabel: ScreenElement;
	dimOverlay: ScreenElement;
	rewindButton: ScreenElement;
	setRewindUrgent: (urgent: boolean) => void;
	setTimerMeter: (fraction: number) => void;
	setTimerMeterVisible: (visible: boolean) => void;
	displayedScore: { value: number };
}
