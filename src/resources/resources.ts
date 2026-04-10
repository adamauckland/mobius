import { ImageSource, Loader } from "excalibur";
import { Animation, AnimationStrategy, SpriteSheet } from "excalibur";

import dude from "../assets/dude.png";
import tiles from "../assets/tiles.png";
import roguelikess from "../assets/roguelike.png";

const dudeSpritesheet = new ImageSource(dude);
const PlayerSheet = SpriteSheet.fromImageSource({
	image: dudeSpritesheet,
	grid: { columns: 3, rows: 1, spriteHeight: 16, spriteWidth: 16 },
});
export const playerImage = PlayerSheet.sprites[0];

export const playerWalkAnimation = new Animation({
	// put your desired frame numbers here
	frames: [0, 1, 0, 2].map((i) => ({
		graphic: PlayerSheet.sprites[i],
		duration: 100,
	})),
	strategy: AnimationStrategy.Loop,
});

const kennyRougeLikePack = new ImageSource(roguelikess);
export const rlSS = SpriteSheet.fromImageSource({
	image: kennyRougeLikePack,
	grid: { columns: 57, rows: 31, spriteHeight: 16, spriteWidth: 16 },
	spacing: { margin: { x: 1, y: 1 } },
});

const tilesSource = new ImageSource(tiles);
export const TileSheet = SpriteSheet.fromImageSource({
	image: tilesSource,
	grid: { columns: 4, rows: 1, spriteHeight: 16, spriteWidth: 16 },
});

// It is convenient to put your resources in one place
export const Resources = {
	Sword: new ImageSource("./images/sword.png"), // Vite public/ directory serves the root images
	dudeSpritesheet,
	kennyRougeLikePack,
	tilesSource,
} as const; // the 'as const' is a neat typescript trick to get strong typing on your resources.
// So when you type Resources.Sword -> ImageSource

// We build a loader and add all of our resources to the boot loader
// You can build your own loader by extending DefaultLoader
export const loader = new Loader();
for (const res of Object.values(Resources)) {
	loader.addResource(res);
}
