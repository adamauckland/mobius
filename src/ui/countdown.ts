import {
	ScreenElement,
	Text,
	Font,
	FontUnit,
	Color,
	vec,
	TextAlign,
	BaseAlign,
} from "excalibur";
import { game } from "../game";
import { Z_COUNTDOWN } from "../zIndex";
import { sfxCountdownTick, sfxCountdownGo } from "../sounds";

export function runCountdown(onGo: () => void) {
	const countdownFont = new Font({
		size: 200,
		unit: FontUnit.Px,
		family: "monospace",
		color: Color.White,
		textAlign: TextAlign.Center,
		baseAlign: BaseAlign.Middle,
		shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
	});
	const countdownText = new Text({ text: "3", font: countdownFont });
	const countdownLabel = new ScreenElement({
		pos: vec(0, 0),
		z: Z_COUNTDOWN,
	});
	countdownLabel.graphics.use(countdownText);
	countdownLabel.on("preupdate", () => {
		countdownLabel.pos.x = game.screen.resolution.width / 2;
		countdownLabel.pos.y = game.screen.resolution.height / 2;
	});
	game.add(countdownLabel);

	function popIn() {
		countdownLabel.scale.x = 0.3;
		countdownLabel.scale.y = 0.3;
		countdownLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
	}
	popIn();
	sfxCountdownTick();

	let countdown = 3;
	for (let i = 1; i <= 3; i++) {
		game.clock.schedule(() => {
			countdown--;
			if (countdown > 0) {
				countdownText.text = String(countdown);
				popIn();
				sfxCountdownTick();
			} else {
				countdownText.text = "GO!";
				popIn();
				sfxCountdownGo();

				onGo();

				// Remove the "GO!" text after a short delay
				game.clock.schedule(() => countdownLabel.kill(), 250);
			}
		}, i * 500);
	}
}
