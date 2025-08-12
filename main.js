export default class MainApp {
	constructor({ endpoint, contentBoxId }) {
		this.endpoint = endpoint;
		this.contentBox = document.getElementById(contentBoxId);
	}

	// ===== UI helpers =====
	setStatus(el, text, type) {
		if (!el) return;
		el.textContent = text || '';
		el.classList.remove('pending', 'success', 'error');
		if (type) el.classList.add(type);
	}

	labelTextFor(id) {
		const lab = document.querySelector(`label[for="${id}"]`);
		return (lab?.innerText || '').trim();
	}

	collectCheckedLabels(ids) {
		const picked = [];
		ids.forEach(id => {
			const el = document.getElementById(id);
			if (el && el.checked) picked.push(this.labelTextFor(id) || id);
		});
		return picked;
	}

	mergeToSingleField(fd, ids, outKey, separator = ',') {
		fd.delete(outKey);
		ids.forEach(id => fd.delete(id));
		const val = this.collectCheckedLabels(ids).join(separator);
		fd.append(outKey, val);
	}

	async loadTabContent(htmlFile, jsFile, initFn) {
		const html = await fetch(`pages/${htmlFile}`).then(r => r.text());
		this.contentBox.innerHTML = html;

		if (jsFile) {
			const module = await import(`./scripts/${jsFile}`);

			if (initFn && typeof module[initFn] === 'function') {
				module[initFn](this.contentBox);
			}

			if (module?.default) {
				const PageClass = module.default;
				const page = new PageClass({ container: this.contentBox, endpoint: this.endpoint });
				await page.init?.();
				return;
			}
		}
	}

	initTabSwitching() {
		document.querySelectorAll("label[data-src]").forEach(label => {
			label.addEventListener("click", () => {
				this.loadTabContent(
					label.dataset.src,
					label.dataset.script,
					label.dataset.init
				);
			});
		});
	}

	initNumberButtons() {
		document.addEventListener('click', (e) => {
			const minus = e.target.closest('.btn-minus');
			const plus = e.target.closest('.btn-plus');
			if (!minus && !plus) return;

			let input = null;
			const btn = minus || plus;
			const targetId = btn.dataset.target;
			if (targetId) input = document.getElementById(targetId);
			if (!input) {
				const control = btn.closest('.number-control');
				input = control?.querySelector('input[type="number"]');
			}
			if (!input) return;

			const step = Number(input.step || 1);
			const min = input.min !== '' ? Number(input.min) : 0;
			const max = input.max !== '' ? Number(input.max) : +Infinity;

			let val = Number(input.value || 0) || 0;
			val += (plus ? step : -step);
			val = Math.max(min, Math.min(max, val));
			input.value = String(val);
		});
	}

	start() {
		this.initTabSwitching();
		this.initNumberButtons();

		this.loadTabContent("team.html", "team.js", "initTeamTab");
	}
}
