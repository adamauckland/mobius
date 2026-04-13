import { TextAlign, Color, Font, FontUnit, vec, BaseAlign } from "excalibur";

export function createHUDFont(
	size: number,
	textAlign: TextAlign,
	color: Color = Color.White,
): Font {
	return new Font({
		size,
		unit: FontUnit.Px,
		family: '"Sixtyfour", monospace',
		color,
		textAlign,
		shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
	});
}
export function createOverlayFont(
	size: number,
	color: Color,
	lineHeight?: number,
	shadowBlur = 4,
): Font {
	return new Font({
		size,
		unit: FontUnit.Px,
		lineHeight: lineHeight,
		family: '"Sixtyfour", monospace',
		color,
		textAlign: TextAlign.Center,
		baseAlign: BaseAlign.Middle,
		shadow: { blur: shadowBlur, offset: vec(2, 2), color: Color.Black },
	});
}
