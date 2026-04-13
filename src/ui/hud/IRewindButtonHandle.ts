import { ScreenElement } from "excalibur";

export interface IRewindButtonHandle {
	element: ScreenElement;
	setUrgent: (urgent: boolean) => void;
}
