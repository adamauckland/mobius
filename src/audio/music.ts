import menuTrackUrl from "@/assets/music/This Trip Might Be Our Last v1.0.mp3";
import levelTrackUrl from "@/assets/music/The Speed Consumes Me v1.0.mp3";
import endTrackUrl from "@/assets/music/Hello There v1.0.mp3";

export class Music {
	private audio: HTMLAudioElement | null = null;
	private currentUrl: string | null = null;
	private muted = true;

	private createAudio(url: string, volume: number): HTMLAudioElement {
		const el = new Audio(url);
		el.loop = true;
		el.volume = volume;
		el.muted = this.muted;
		return el;
	}

	private resumeOnPointerDown(el: HTMLAudioElement): void {
		document.addEventListener(
			"pointerdown",
			() => {
				el.play();
			},
			{ once: true },
		);
	}

	private attemptPlay(el: HTMLAudioElement): void {
		el.play().catch(() => this.resumeOnPointerDown(el));
	}

	private playTrack(url: string, volume: number): void {
		if (this.audio && this.currentUrl === url) return;

		this.stop();

		this.audio = this.createAudio(url, volume);
		this.currentUrl = url;
		this.attemptPlay(this.audio);
	}

	public playMenu(volume = 0.3): void {
		this.playTrack(menuTrackUrl, volume);
	}

	public playLevel(volume = 0.3): void {
		this.playTrack(levelTrackUrl, volume);
	}

	public playEnd(volume = 0.3): void {
		this.playTrack(endTrackUrl, volume);
	}

	public stop(): void {
		if (!this.audio) return;

		this.audio.pause();
		this.audio.currentTime = 0;
		this.audio = null;
		this.currentUrl = null;
	}

	public setMuted(muted: boolean): void {
		this.muted = muted;
		if (this.audio) this.audio.muted = muted;
	}

	public isMuted(): boolean {
		return this.muted;
	}
}

export const music = new Music();
