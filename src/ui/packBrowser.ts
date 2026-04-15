import type { ILevelPack } from "@/interfaces/ILevelPack";
import type { AuthUser } from "@/auth/auth";

function escapeHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}

function buildEditBtn(onClick: () => void): HTMLButtonElement {
	const editBtn = document.createElement("button");
	editBtn.title = "Edit this pack";
	editBtn.setAttribute("aria-label", "Edit this pack");
	editBtn.textContent = "\u2699";
	editBtn.style.cssText = `
    flex-shrink: 0; width: 36px; height: 36px;
    font-family: "Sixtyfour", monospace; font-size: 20px; line-height: 1;
    background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
    cursor: pointer; padding: 0;
  `;
	editBtn.addEventListener("mouseenter", () => {
		editBtn.style.background = "#5e676b";
	});
	editBtn.addEventListener("mouseleave", () => {
		editBtn.style.background = "#34393c";
	});
	editBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		onClick();
	});
	return editBtn;
}

function buildClaimBtn(
	pack: ILevelPack,
	onClaimed: () => void,
): HTMLButtonElement {
	const claimBtn = document.createElement("button");
	claimBtn.title = "Claim this unowned pack";
	claimBtn.textContent = "Claim";
	claimBtn.style.cssText = `
    flex-shrink: 0; height: 36px; padding: 0 12px;
    font-family: "Sixtyfour", monospace; font-size: 12px; line-height: 1;
    background: #1565c0; color: #fff; border: 1px solid #5e676b;
    cursor: pointer;
  `;
	claimBtn.addEventListener("click", async (e) => {
		e.stopPropagation();
		if (
			!confirm(
				`Claim pack "${pack.name}"? You will become the owner and the only one who can edit it.`,
			)
		)
			return;
		claimBtn.disabled = true;
		claimBtn.textContent = "Claiming...";
		try {
			const { claimPack } = await import("@/levelPacks/levelPacks");
			await claimPack(pack.id);
			onClaimed();
		} catch (err) {
			alert("Failed to claim: " + (err as Error).message);
			claimBtn.disabled = false;
			claimBtn.textContent = "Claim";
		}
	});
	return claimBtn;
}

function buildPackCard(
	pack: ILevelPack,
	currentUser: AuthUser | null,
	onPlay: () => void,
	onEdit: () => void,
): HTMLDivElement {
	const card = document.createElement("div");
	card.style.cssText = `
    background: #1e2225; border: 1px solid #34393c;
    padding: clamp(10px, 3vw, 14px) clamp(12px, 4vw, 18px);
    cursor: pointer; display: flex; flex-direction: row;
    align-items: center; gap: clamp(8px, 2.5vw, 14px);
  `;

	const info = document.createElement("div");
	info.style.cssText =
		"flex:1 1 auto; display:flex; flex-direction:column; gap:4px; min-width:0;";
	info.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <strong style="font-size:clamp(14px,4vw,16px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${escapeHtml(pack.description)}</strong>
      <span style="flex-shrink:0;font-size:clamp(10px,3vw,12px);color:#929fa4;">${pack.levelCount} level${pack.levelCount !== 1 ? "s" : ""}</span>
    </div>
    <div style="font-size:clamp(10px,3vw,12px);color:#929fa4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">by ${escapeHtml(pack.author)}</div>
    <div style="display: none; font-size:11px;color:#5e676b;">ID: ${pack.id}</div>
  `;
	info.addEventListener("click", onPlay);
	card.appendChild(info);

	const isOwner =
		!!currentUser && !!pack.ownerUid && pack.ownerUid === currentUser.uid;
	const isOrphan = !pack.ownerUid;

	if (isOwner) {
		card.appendChild(buildEditBtn(onEdit));
	} else if (isOrphan && currentUser) {
		const claimBtn = buildClaimBtn(pack, () => {
			pack.ownerUid = currentUser.uid;
			pack.ownerEmail = currentUser.email;
			claimBtn.remove();
			card.appendChild(buildEditBtn(onEdit));
		});
		card.appendChild(claimBtn);
	}

	card.addEventListener("mouseenter", () => {
		card.style.borderColor = "#5e676b";
	});
	card.addEventListener("mouseleave", () => {
		card.style.borderColor = "#34393c";
	});

	return card;
}

export function initPackBrowser(
	startProjectLevel: (json: string, level: number) => void,
) {
	const btnBrowsePacks = document.getElementById("btn-browse-packs");
	if (!btnBrowsePacks) return;

	btnBrowsePacks.addEventListener("click", async () => {
		const overlay = document.createElement("div");
		overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85); z-index: 5000;
      display: flex; flex-direction: column; align-items: center;
      padding: clamp(16px, 5vw, 48px) clamp(12px, 4vw, 32px);
      box-sizing: border-box;
      font-family: "Sixtyfour", monospace; color: #d0e3e9;
      overflow-y: auto;
    `;

		const header = document.createElement("div");
		header.style.cssText = `
      width: 100%; max-width: 500px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-bottom: 16px;
    `;
		overlay.appendChild(header);

		const title = document.createElement("h2");
		title.textContent = "Select world";
		title.style.cssText =
			"margin: 0; font-size: clamp(20px, 6vw, 32px); line-height: 1;";
		header.appendChild(title);

		const closeBtn = document.createElement("button");
		closeBtn.textContent = "CLOSE";
		closeBtn.style.cssText = `
      flex-shrink: 0;
      font-family: "Sixtyfour", monospace; font-size: clamp(12px, 3.5vw, 16px);
      padding: 8px 16px; background: #5e676b; color: #d0e3e9;
      border: none; cursor: pointer;
    `;
		closeBtn.addEventListener("click", () => overlay.remove());
		header.appendChild(closeBtn);

		const listContainer = document.createElement("div");
		listContainer.style.cssText = `
      width: 100%; max-width: 500px; flex: 1 1 auto; min-height: 0;
      overflow-y: auto;
      display: flex; flex-direction: column; gap: 8px;
    `;
		listContainer.innerHTML =
			'<div style="text-align:center;color:#929fa4;">Loading...</div>';
		overlay.appendChild(listContainer);

		document.body.appendChild(overlay);

		try {
			const { browsePacks, getPackProject } =
				await import("@/levelPacks/levelPacks");
			const { showEditor } = await import("@/editor/editor");
			const { getCurrentUser } = await import("@/auth/auth");

			const packs = await browsePacks();
			const currentUser = getCurrentUser();

			listContainer.innerHTML = "";

			if (currentUser) {
				const newBtn = document.createElement("button");
				newBtn.textContent = "+ New pack";
				newBtn.style.cssText = `
          font-family: "Sixtyfour", monospace; font-size: clamp(12px, 3.5vw, 14px);
          padding: 12px 16px; background: #2e7d32; color: #fff;
          border: none; cursor: pointer; margin-bottom: 4px; width: 100%;
        `;
				newBtn.addEventListener("mouseenter", () => {
					newBtn.style.background = "#3aa13f";
				});
				newBtn.addEventListener("mouseleave", () => {
					newBtn.style.background = "#2e7d32";
				});
				newBtn.addEventListener("click", () => {
					overlay.remove();
					document.getElementById("start-screen")!.style.display = "none";
					// Clear any stale pack context so this starts as a brand-new pack.
					localStorage.removeItem("editorProject");
					localStorage.removeItem("editorLevel");
					localStorage.removeItem("editorPackId");
					localStorage.removeItem("editorPackDescription");
					localStorage.removeItem("editorPackOwnerUid");
					showEditor();
				});
				listContainer.appendChild(newBtn);
			}

			if (packs.length === 0) {
				const empty = document.createElement("div");
				empty.style.cssText = "text-align:center;color:#929fa4;";
				empty.textContent = currentUser
					? "No packs published yet. Create one above!"
					: "No packs published yet. Sign in to create one!";
				listContainer.appendChild(empty);
				return;
			}

			for (const pack of packs) {
				const card = buildPackCard(
					pack,
					currentUser,
					() => {
						overlay.remove();
						const proj = getPackProject(pack);
						const json = JSON.stringify(proj);
						// Persist as editor state so the in-game EDITOR button
						// resumes on this pack with full metadata.
						localStorage.setItem("editorProject", json);
						localStorage.setItem("editorLevel", "0");
						localStorage.setItem("editorPackId", pack.id);
						localStorage.setItem(
							"editorPackDescription",
							pack.description ?? "",
						);
						localStorage.setItem("editorPackOwnerUid", pack.ownerUid ?? "");
						startProjectLevel(json, 0);
					},
					() => {
						overlay.remove();
						const proj = getPackProject(pack);
						document.getElementById("start-screen")!.style.display = "none";
						showEditor({
							id: pack.id,
							project: proj,
							author: pack.author,
							description: pack.description,
							ownerUid: pack.ownerUid,
						});
					},
				);
				listContainer.appendChild(card);
			}
		} catch (err) {
			listContainer.innerHTML = `<div style="text-align:center;color:#e74c3c;">Failed to load packs: ${(err as Error).message}</div>`;
		}
	});
}
