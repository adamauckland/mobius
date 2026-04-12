import { Color, Font, vec } from "excalibur";
import { game } from "@/game";
import { model } from "@/model";
import { updateMovingBlocks } from "@/entities/MovingPlatform/movingPlatform";
import { updateMonsters } from "@/entities/Monster/monsters";
import { updateCritters } from "@/entities/Critter/critters";
import { tryCollectCritters } from "@/entities/Critter/collection";
import { getScore, addScore } from "./entities/Collectable/state";
import { sfxHeartbeat } from "@/audio/sounds";
import { spawnDeathExplosion } from "@/entities/Light/lightTrail";
import { activeEntry } from "@/entities/Player/playerManager";
import { isLowTime } from "@/rules/timerUrgency";
import type { HUDRefs } from "@/ui/hud";

let gameStarted = false;
let elapsedGameTime = 0;
let lastHeartbeatSec = -1;
let bonusCountdown = false;
let bonusRemaining = 0;
let bonusAccumulator = 0;
const BONUS_TICK_MS = 10;
const BONUS_DRAIN_PER_TICK = 100;
const BONUS_POINTS_PER_TICK = 1;
const MS_PER_MINUTE = 60000;

export function resetGameTimer() {
	elapsedGameTime = 0;
	gameStarted = true;
	lastHeartbeatSec = -1;
}

export function startBonusCountdown(hud?: HUDRefs) {
	if (model.timeLimit <= 0) return;
	bonusRemaining = Math.max(0, model.timeLimit - elapsedGameTime);
	bonusAccumulator = 0;
	bonusCountdown = true;
	hud?.setRewindUrgent(false);
}

function formatTime(ms: number): string {
	const mins = Math.floor(ms / MS_PER_MINUTE);
	const secs = Math.floor((ms % MS_PER_MINUTE) / 1000);
	const tenths = Math.floor((ms % 1000) / 100);
	return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}

function updateScoreDisplay(hud: HUDRefs) {
	const targetScore = getScore();
	if (hud.displayedScore.value < targetScore) {
		const gap = targetScore - hud.displayedScore.value;
		hud.displayedScore.value += Math.max(1, Math.ceil(gap * 0.1));
		if (hud.displayedScore.value > targetScore)
			hud.displayedScore.value = targetScore;
	}
	hud.scoreText.text = `${hud.displayedScore.value}`;
}

function drainBonusTime(hud: HUDRefs, elapsed: number) {
	bonusAccumulator += elapsed;
	while (bonusAccumulator >= BONUS_TICK_MS && bonusRemaining > 0) {
		bonusAccumulator -= BONUS_TICK_MS;
		const drain = Math.min(BONUS_DRAIN_PER_TICK, bonusRemaining);
		bonusRemaining -= drain;
		addScore(BONUS_POINTS_PER_TICK);
	}
	hud.timerText.text = formatTime(bonusRemaining);
	if (model.timeLimit > 0) {
		hud.setTimerMeter(bonusRemaining / model.timeLimit);
	}
	if (bonusRemaining <= 0) {
		bonusCountdown = false;
		hud.timerText.text = "0:00.0";
	}
}

function updateCountdownTimer(hud: HUDRefs) {
	const remaining = Math.max(0, model.timeLimit - elapsedGameTime);
	hud.timerText.text = formatTime(remaining);
	hud.setTimerMeter(remaining / model.timeLimit);
	flashTimerIfLow(hud, remaining);
}

function flashTimerIfLow(hud: HUDRefs, remaining: number) {
	const urgent = isLowTime(remaining);
	hud.setRewindUrgent(urgent);
	if (urgent) {
		const flash = Math.sin(game.clock.now() * 0.01) > 0;
		(hud.timerText.font as Font).color = flash ? Color.Red : Color.White;
		const secs = Math.floor((remaining % MS_PER_MINUTE) / 1000);
		if (secs !== lastHeartbeatSec) {
			lastHeartbeatSec = secs;
			sfxHeartbeat();
		}
	} else {
		(hud.timerText.font as Font).color = Color.White;
		lastHeartbeatSec = -1;
	}
}

function handleTimeUp(hud: HUDRefs, onTimeUp?: () => void) {
	model.gameOver = true;
	hud.setRewindUrgent(false);
	const player = activeEntry().player;
	player.graphics.isVisible = false;
	spawnDeathExplosion(player.pos.clone());
	hud.gameOverLabel.graphics.visible = true;
	hud.gameOverLabel.scale.x = 0.3;
	hud.gameOverLabel.scale.y = 0.3;
	hud.gameOverLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
	if (onTimeUp) onTimeUp();
}

function updateElapsedTimer(hud: HUDRefs) {
	hud.timerText.text = formatTime(elapsedGameTime);
}

export function setupGameLoop(hud: HUDRefs, onTimeUp?: () => void) {
	game.on("postupdate", (evt) => {
		if (!gameStarted) return;

		if (bonusCountdown) {
			drainBonusTime(hud, evt.elapsed);
			updateScoreDisplay(hud);
			return;
		}

		if (model.gameOver) return;
		updateMovingBlocks(evt.elapsed);
		updateMonsters(evt.elapsed);
		updateCritters(evt.elapsed);
		tryCollectCritters();
		elapsedGameTime += evt.elapsed;

		if (model.timeLimit > 0) {
			updateCountdownTimer(hud);
			if (elapsedGameTime >= model.timeLimit) {
				handleTimeUp(hud, onTimeUp);
			}
		} else {
			updateElapsedTimer(hud);
		}

		updateScoreDisplay(hud);
	});
}
