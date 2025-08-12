export function setStatus(statusEl, text = '', type = '') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove('pending', 'success', 'error');
    if (type) statusEl.classList.add(type);
}

export function fillSelect(selectDropdown, options) {
    const placeholder = selectDropdown.querySelector('option[disabled]')?.outerHTML
        || '<option value="" disabled selected>選擇隊伍</option>';

    selectDropdown.innerHTML = placeholder + options.map(t => `<option value="${t}">${t}</option>`).join('');
    selectDropdown.selectedIndex = 0;
}