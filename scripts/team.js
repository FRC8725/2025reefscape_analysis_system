import { readCache, writeCache, isFresh } from "../utils/cacheHelper.js";
import { setStatus, fillSelect } from "../utils/uiTools.js";
export default class TeamPage {
    constructor({ container, endpoint }) {
        this.container = container;
        this.endpoint = endpoint;

        this.memberInput = null;

        this.teamDataForm = null;
        this.submitBtn = null;
        this.statusEl = null;
        this.userdata = null;

        this.USERDATA_CACHE_KEY = 'userdata_cache';
    }

    async init() {
        this.teamDataForm = this.container.querySelector('#team_form');
        this.submitBtn = this.teamDataForm?.querySelector('button[type="submit"]');
        this.statusEl = this.container.querySelector('#team_submit_status');

        this.memberInput = this.container.querySelector('#recorder');
        this.userdata = readCache(this.USERDATA_CACHE_KEY);
        this.memberInput.value = this.userdata.name;
        this.memberInput.disabled = true;
        
        if (!this.teamDataForm) return;

        this.teamDataForm.addEventListener('submit', (e) => this.onSubmit(e));
    }

    setStatus(text = '', type = '') {
        if (!this.statusEl) return;
        this.statusEl.textContent = text;
        this.statusEl.classList.remove('pending', 'success', 'error');
        if (type) this.statusEl.classList.add(type);
    }

    mergeToSingleField(fd, ids, outKey, sep = ',') {
        fd.delete(outKey);
        ids.forEach(id => fd.delete(id));
        const picked = [];

        ids.forEach(id => {
            const el = this.container.querySelector(`#${id}`);
            if (el?.checked) {
                const lab = this.container.querySelector(`label[for="${id}"]`);
                picked.push(lab?.innerText.trim() || id);
            }
        });

        fd.append(outKey, picked.join(sep));
    }

    async onSubmit(event) {
        event.preventDefault();

        if (!this.teamDataForm.checkValidity()) {
            this.teamDataForm.reportValidity();
            return;
        }

        const teamDF = new FormData(this.teamDataForm);
        const outputDF = new FormData();
        const teamReasultDF = new FormData();

        this.mergeToSingleField(teamDF, ['auto_l4_coral', 'auto_l3_coral', 'auto_l2_coral', 'auto_l1_coral'], 'auto_coral_place');
        this.mergeToSingleField(teamDF, ['algae_net', 'algae_processor'], 'auto_algae_place');
        this.mergeToSingleField(teamDF, ['teleop_l4_coral', 'teleop_l3_coral', 'teleop_l2_coral', 'teleop_l1_coral'], 'teleop_coral_place');
        this.mergeToSingleField(teamDF, ['teleop_net_algae', 'teleop_processor_algae'], 'teleop_algae_place');
        this.mergeToSingleField(teamDF, ['coral_station', 'coral_floor'], 'coral_collect');
        this.mergeToSingleField(teamDF, ['algae_remove', 'algae_collect'], 'algae_collect_remove');

        const nowISO = new Date().toISOString()

        teamDF.set('sheet_name', 'team_data');
        teamDF.set('timestamp', nowISO);
        teamDF.set('recorder', this.userdata.name);
        teamDF.set('recorder_email', this.userdata.email);

        teamReasultDF.set('team_number', teamDF.get('team_number'));

        teamReasultDF.set('qualified_rounds', 'fx:=COUNTIF(\'match_data\'!B:B, {team_number_cell})');
        teamReasultDF.set('ranking_points', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!X:X), 0)');
        teamReasultDF.set('algae_points_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!S:S) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('algae_removed_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!R:R) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('coral_points_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!T:T) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('endgame_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!U:U) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('auto_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!V:V) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('teleop_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!W:W) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('team_total_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!Z:Z) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('qualification_total_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!Y:Y) / {qualified_rounds_cell}, 0) ');
        teamReasultDF.set('alliance_against_avg', 'fx:=IFERROR(SUMIF(\'match_data\'!B:B, {team_number_cell}, \'match_data\'!AA:AA) / {qualified_rounds_cell}, 0)');
        teamReasultDF.set('pythagorean_wins_3', 'fx:=IFERROR(({team_total_avg_cell}^3)/({team_total_avg_cell}^3+({alliance_against_avg_cell}/3)^3), 0)');

        teamReasultDF.set('sheet_name', 'team_match_reasult');
        teamReasultDF.set('timestamp', nowISO);

        try {
            if (this.submitBtn) {
                this.submitBtn.disabled = true;
                this.submitBtn.dataset.originalText = this.submitBtn.textContent;
                this.submitBtn.textContent = '送出中…';
                this.submitBtn.setAttribute('aria-busy', 'true');
            }
            this.setStatus('送出中…', 'pending');

            outputDF.set('action', 'batch_append');
            outputDF.set('ops', JSON.stringify([
                { sheet: 'team_data', data: Object.fromEntries(teamDF) },
                { sheet: 'team_match_reasult', data: Object.fromEntries(teamReasultDF) }
            ]));

            outputDF.set('id_token', localStorage.getItem('id_token') || '');

            const res = await fetch(this.endpoint, { method: 'POST', body: outputDF });
            const text = await res.text();
            let data = {}; try { data = JSON.parse(text); } catch { }

            if (res.ok && data.ok) {
                this.setStatus('已新增隊伍 ✅', 'success');
                this.teamDataForm.reset();
                setTimeout(() => this.setStatus('', ''), 2000);

            } else {
                this.setStatus('新增失敗：' + (data.error || text), 'error');
            }
        } catch (err) {
            this.setStatus('網路錯誤：' + err, 'error');

        } finally {
            if (this.submitBtn) {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = this.submitBtn.dataset.originalText || '新增隊伍';
                this.submitBtn.removeAttribute('aria-busy');
            }
        }
    }
}

