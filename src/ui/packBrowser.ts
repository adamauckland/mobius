function escapeHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}

export function initPackBrowser(
	startProjectLevel: (json: string, level: number) => void,
) {
	const btnBrowsePacks = document.getElementById("btn-browse-packs");
	if (!btnBrowsePacks) return;

	btnBrowsePacks.addEventListener("click", async () => {
		// Build modal overlay
		const overlay = document.createElement("div");
		overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.85); z-index: 5000;
      display: flex; flex-direction: column; align-items: center; padding-top: 60px;
      font-family: monospace; color: #d0e3e9;
    `;

		const title = document.createElement("h2");
		title.textContent = "LEVEL PACKS";
		title.style.cssText = "margin-bottom: 16px; font-size: 32px;";
		overlay.appendChild(title);

		const closeBtn = document.createElement("button");
		closeBtn.textContent = "CLOSE";
		closeBtn.style.cssText = `
      position: absolute; top: 16px; right: 24px;
      font-family: monospace; font-size: 16px; padding: 8px 20px;
      background: #5e676b; color: #d0e3e9; border: none; cursor: pointer;
    `;
		closeBtn.addEventListener("click", () => overlay.remove());
		overlay.appendChild(closeBtn);

		const listContainer = document.createElement("div");
		listContainer.style.cssText = `
      width: 500px; max-height: 60vh; overflow-y: auto;
      display: flex; flex-direction: column; gap: 8px;
    `;
		listContainer.innerHTML =
			'<div style="text-align:center;color:#929fa4;">Loading...</div>';
		overlay.appendChild(listContainer);

		document.body.appendChild(overlay);

		try {
			const { browsePacks, getPackProject } =
				await import("../levels/levelPacks");
			const packs = await browsePacks();

			listContainer.innerHTML = "";
			if (packs.length === 0) {
				listContainer.innerHTML =
					'<div style="text-align:center;color:#929fa4;">No packs published yet. Create one in the editor!</div>';
				return;
			}

			for (const pack of packs) {
				const card = document.createElement("div");
				card.style.cssText = `
          background: #1e2225; border: 1px solid #34393c; padding: 12px 16px;
          cursor: pointer; display: flex; flex-direction: column; gap: 4px;
        `;
				card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:16px;">${escapeHtml(pack.name)}</strong>
            <span style="font-size:12px;color:#929fa4;">${pack.levelCount} level${pack.levelCount !== 1 ? "s" : ""}</span>
          </div>
          <div style="font-size:12px;color:#929fa4;">by ${escapeHtml(pack.author)}${pack.description ? " \u2014 " + escapeHtml(pack.description) : ""}</div>
          <div style="font-size:11px;color:#5e676b;">ID: ${pack.id}</div>
        `;
				card.addEventListener("mouseenter", () => {
					card.style.borderColor = "#5e676b";
				});
				card.addEventListener("mouseleave", () => {
					card.style.borderColor = "#34393c";
				});
				card.addEventListener("click", () => {
					overlay.remove();
					const proj = getPackProject(pack);
					const json = JSON.stringify(proj);
					startProjectLevel(json, 0);
				});
				listContainer.appendChild(card);
			}
		} catch (err) {
			listContainer.innerHTML = `<div style="text-align:center;color:#e74c3c;">Failed to load packs: ${(err as Error).message}</div>`;
		}
	});
}
