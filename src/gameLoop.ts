import { Color, Font, vec } from "excalibur";
import { game } from "./game";
import { model } from "./model";
import { updateMovingBlocks } from "./entities/movingBlocks";
import { updateMonsters } from "./entities/monsters";
import { updateCritters } from "./entities/Critter/critters";
import { tryCollectCritters } from "./entities/Critter/collection";
import { getScore, addScore } from "./entities/worldObjects";
import { sfxHeartbeat } from "./audio/sounds";
import { spawnDeathExplosion } from "./entities/lightTrail";
import { activeEntry } from "./entities/Player/playerManager";
import type { HUDRefs } from "./ui/hud";

let gameStarted = false;
let elapsedGameTime = 0;
let lastHeartbeatSec = -1;
let bonusCountdown = false;
let bonusRemaining = 0;
let bonusAccumulator = 0;
const BONUS_TICK_MS = 10; // real-time interval between each drain tick
const BONUS_DRAIN_PER_TICK = 100; // drain 1 second of clock per tick
const BONUS_POINTS_PER_TICK = 1;

export function resetGameTimer() {
	elapsedGameTime = 0;
	gameStarted = true;
	lastHeartbeatSec = -1;
}

export function startBonusCountdown() {
	if (model.timeLimit <= 0) return;
	bonusRemaining = Math.max(0, model.timeLimit - elapsedGameTime);
	bonusAccumulator = 0;
	bonusCountdown = true;
}

export function setupGameLoop(hud: HUDRefs, onTimeUp?: () => void) {
	game.on("postupdate", (evt) => {
		if (!gameStarted) return;

		// Bonus countdown: drain remaining time into score after level complete
		if (bonusCountdown) {
			bonusAccumulator += evt.elapsed;
			while (bonusAccumulator >= BONUS_TICK_MS && bonusRemaining > 0) {
				bonusAccumulator -= BONUS_TICK_MS;
				const drain = Math.min(BONUS_DRAIN_PER_TICK, bonusRemaining);
				bonusRemaining -= drain;
				addScore(BONUS_POINTS_PER_TICK);

				// Update timer display
				const MS_PER_MINUTE = 60000;
				const mins = Math.floor(bonusRemaining / MS_PER_MINUTE);
				const secs = Math.floor((bonusRemaining % MS_PER_MINUTE) / 1000);
				const tenths = Math.floor((bonusRemaining % 1000) / 100);
				hud.timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
			}
			if (bonusRemaining <= 0) {
				bonusCountdown = false;
				hud.timerText.text = "0:00.0";
			}
			// Update score display during bonus
			const targetScore = getScore();
			if (hud.displayedScore.value < targetScore) {
				const gap = targetScore - hud.displayedScore.value;
				hud.displayedScore.value += Math.max(1, Math.ceil(gap * 0.1));
				if (hud.displayedScore.value > targetScore)
					hud.displayedScore.value = targetScore;
			}
			hud.scoreText.text = `${hud.displayedScore.value}`;
			return;
		}

		if (model.gameOver) return;
		updateMovingBlocks(evt.elapsed);
		updateMonsters(evt.elapsed);
		updateCritters(evt.elapsed);
		tryCollectCritters();
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

			// Time's up — game over
			if (elapsedGameTime >= model.timeLimit) {
				model.gameOver = true;
				const player = activeEntry().player;
				player.graphics.isVisible = false;
				spawnDeathExplosion(player.pos.clone());
				hud.gameOverLabel.graphics.visible = true;
				hud.gameOverLabel.scale.x = 0.3;
				hud.gameOverLabel.scale.y = 0.3;
				hud.gameOverLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
				if (onTimeUp) onTimeUp();
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
