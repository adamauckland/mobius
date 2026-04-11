import { GraphicsGroup, Vector } from "excalibur";

export interface ICritterGraphics {
	open: GraphicsGroup;
	halfOpen: GraphicsGroup;
	closed: GraphicsGroup;
	leftEyeOffset: Vector;
	rightEyeOffset: Vector;
	leftEyeHalfOffset: Vector;
	rightEyeHalfOffset: Vector;
}
