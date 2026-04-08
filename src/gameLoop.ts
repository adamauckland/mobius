import { Color, Font, vec } from "excalibur";
import { game } from "./game";
import { model } from "./model";
import { updateMovingBlocks } from "./entities/movingBlocks";
import { updateMonsters } from "./entities/monsters";
import { getScore } from "./entities/worldObjects";
import { stopAndSpawnNext, lockInput } from "./entities/playerManager";
import { sfxHeartbeat } from "./sounds";
import type { HUDRefs } from "./ui/hud";

let gameStarted = false;
let elapsedGameTime = 0;
let lastHeartbeatSec = -1;

export function resetGameTimer() {
	elapsedGameTime = 0;
	gameStarted = true;
	lastHeartbeatSec = -1;
}

export function setupGameLoop(hud: HUDRefs) {
	game.on("postupdate", (evt) => {
		if (!gameStarted) return;
		if (model.gameOver) return;
		updateMovingBlocks(evt.elapsed);
		updateMonsters(evt.elapsed);
		elapsedGameTime += evt.elapsed;

		if (model.timeLimit > 0) {
			// Display remaining time (countdown)
			const remaining = Math.max(0, model.timeLimit - elapsedGameTime);
			const MS_PER_MINUTE = 60000;
			const mins = Math.floor(remaining / MS_PER_MINUTE);
			const secs = Math.floor((remaining % MS_PER_MINUTE) / 1000);
			const tenths = Math.floor((remaining % 1000) / 100);
			hud.timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;

			// Flash red and play heartbeat when under 10 seconds
			if (remaining < 10000) {
				const flash = Math.sin(game.clock.now() * 0.01) > 0;
				(hud.timerText.font as Font).color = flash ? Color.Red : Color.White;
				if (secs !== lastHeartbeatSec) {
					lastHeartbeatSec = secs;
					sfxHeartbeat();
				}
			} else {
				(hud.timerText.font as Font).color = Color.White;
				lastHeartbeatSec = -1;
			}

			// Time's up — rewind like a portal (keep ghosts) but lock input as penalty
			if (elapsedGameTime >= model.timeLimit) {
				stopAndSpawnNext();
				lockInput(3000);
				hud.timesUpLabel.graphics.visible = true;
				hud.timesUpLabel.scale.x = 0.3;
				hud.timesUpLabel.scale.y = 0.3;
				hud.timesUpLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
				game.clock.schedule(() => {
					hud.timesUpLabel.actions.fade(0, 500).callMethod(() => {
						hud.timesUpLabel.graphics.visible = false;
						hud.timesUpLabel.graphics.opacity = 1;
					});
				}, 2500);
			}
		} else {
			// No time limit — show elapsed time counting up
			const elapsed = elapsedGameTime;
			const mins = Math.floor(elapsed / 60000);
			const secs = Math.floor((elapsed % 60000) / 1000);
			const tenths = Math.floor((elapsed % 1000) / 100);
			hud.timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
		}

		const targetScore = getScore();
		if (hud.displayedScore.value < targetScore) {
			const gap = targetScore - hud.displayedScore.value;
			hud.displayedScore.value += Math.max(1, Math.ceil(gap * 0.1));
			if (hud.displayedScore.value > targetScore)
				hud.displayedScore.value = targetScore;
		}
		hud.scoreText.text = `${hud.displayedScore.value}`;
	});
}
