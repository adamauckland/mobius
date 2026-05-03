import menuTrackUrl from "@/assets/music/This Trip Might Be Our Last v1.0.mp3";
import levelTrackUrl from "@/assets/music/The Speed Consumes Me v1.0.mp3";
import endTrackUrl from "@/assets/music/Hello There v1.0.mp3";

let audio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function createAudio(url: string, volume: number): HTMLAudioElement {
	const el = new Audio(url);
	el.loop = true;
	el.volume = volume;
	return el;
}

function playTrack(url: string, volume = 0.1): void {
	if (audio && currentUrl === url) return;
	stopMusic();
	audio = createAudio(url, volume);
	currentUrl = url;
	audio.volume = 0.1;
	audio.play().catch(() => {
		document.addEventListener(
			"pointerdown",
			() => {
				audio?.play();
			},
			{ once: true },
		);
	});
}

export function playMenuMusic(volume = 0.3): void {
	playTrack(menuTrackUrl, volume);
}

export function playLevelMusic(volume = 0.3): void {
	playTrack(levelTrackUrl, volume);
}

export function playEndMusic(volume = 0.3): void {
	playTrack(endTrackUrl, volume);
}

export function stopMusic(): void {
	if (!audio) return;

	audio.pause();
	audio.currentTime = 0;
	audio = null;
	currentUrl = null;
}
