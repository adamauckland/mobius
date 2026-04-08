import { resetDijkstraGraph } from "./pathfinding";

export const model = {
	hudWidth: 800,
	hudHeight: 600,
	currentTileIndex: 0,
	targetTileIndex: 0,
	movesRemaining: 0,
	showHUD: false,

	showWarning: false,
	warningColor: "white",
	warningText: "CLICKING A TREE WILL BE IGNORED",
	inputDiagonal: true,
	inputAlgo: undefined as HTMLInputElement | undefined,
	algoDuration: "0.0",
	lives: 3,
	gameOver: false,
	isRecording: false,
	isReplaying: false,
	timeLimit: 60000, // ms before time rewind triggers (60 seconds)
	currentLevel: 0,
	totalLevels: 1,
	projectJson: null as string | null, // serialized project for level transitions
	diagClicked: () => {
		resetDijkstraGraph();
	},
};
