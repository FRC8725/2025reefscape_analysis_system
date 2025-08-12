import { readCache, writeCache, isFresh } from "../utils/cacheHelper.js";
import { setStatus, fillSelect } from "../utils/uiTools.js";

export default class MatchPage {
    constructor({ container, endpoint }) {
        this.container = container;
        this.endpoint = endpoint;
        this.refreshTeamBtn = null;
        this.teamSelect = null;

        this.scoreTable = null;
        this.matchDataForm = null;
        this.submitBtn = null;
        this.statusEl = null;

        this.CACHE_KEY = 'teams_cache';
        this.TTL = 10 * 60 * 1000;
    }

    async init() {
        this.scoreTable = await this.readScoreTable();

        this.refreshTeamBtn = this.container.querySelector('#refresh_teams_btn');
        this.teamSelect = this.container.querySelector('#team');

        this.matchDataForm = this.container.querySelector('#match_form');
        this.submitBtn = this.matchDataForm?.querySelector('button[type="submit"]');
        this.statusEl = this.container.querySelector('#match_submit_status')

        const cache = readCache(this.CACHE_KEY);
        if (isFresh(cache, this.TTL)) fillSelect(this.teamSelect, cache.teams);
        else await this.fetchAndUpdateTeams();

        this.refreshTeamBtn?.addEventListener('click', () => this.fetchAndUpdateTeams());
        this.matchDataForm?.addEventListener('submit', (e) => this.onSubmit(e));
    }

    async fetchAndUpdateTeams(showBusy = true) {
        const original = this.refreshTeamBtn?.textContent;
        if (showBusy && this.refreshTeamBtn) {
            this.refreshTeamBtn.disabled = true;
            this.refreshTeamBtn.textContent = '正在獲取隊伍資料…';
            this.refreshTeamBtn.setAttribute('aria-busy', 'true');
        }
        try {
            const res = await fetch(`${this.endpoint}?action=list_teams`);
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || '無法取得隊伍清單');

            writeCache(data.teams, this.CACHE_KEY);
            fillSelect(this.teamSelect, data.teams);

        } catch (err) {
            console.error(err);
            if (!this.teamSelect.options.length) {
                this.teamSelect.innerHTML = '<option value="" disabled selected>選擇隊伍</option>';
            }
            if (showBusy && this.refreshTeamBtn) {
                this.refreshTeamBtn.textContent = '刷新失敗';
                setTimeout(() => this.refreshTeamBtn.textContent = original || '刷新隊伍', 1200);
            }
        } finally {
            if (showBusy && this.refreshTeamBtn) {
                this.refreshTeamBtn.disabled = false;
                this.refreshTeamBtn.removeAttribute('aria-busy');
                this.refreshTeamBtn.textContent = original || '刷新隊伍';
            }
        }
    }

    async readScoreTable(url = './assets/score_table.json') {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch score table');
        return await response.json();
    }

    async onSubmit(event) {
        event.preventDefault();

        if (!this.matchDataForm.checkValidity()) {
            this.matchDataForm.reportValidity();
            return;
        }

        const getNum = (sel) => {
            const v = Number(this.container.querySelector(sel)?.value ?? 0);
            return Number.isFinite(v) ? v : 0;
        };

        const auto = {
            leave: this.container.querySelector('#auto_leave')?.value === 'YES',
            l4: getNum('#auto_l4_coral_spin'),
            l3: getNum('#auto_l3_coral_spin'),
            l2: getNum('#auto_l2_coral_spin'),
            l1: getNum('#auto_l1_coral_spin'),
            netAlgae: getNum('#auto_net_algae_spin'),
            procAlgae: getNum('#auto_processor_algae_spin')
        };

        const teleop = {
            algaeRemoved: getNum('#algae_removed_spin'),
            l4: getNum('#teleop_l4_coral_spin'),
            l3: getNum('#teleop_l3_coral_spin'),
            l2: getNum('#teleop_l2_coral_spin'),
            l1: getNum('#teleop_l1_coral_spin'),
            netAlgae: getNum('#teleop_net_algae_spin'),
            procAlgae: getNum('#teleop_processor_algae_spin'),
            endgameStatus: this.container.querySelector('#match_endgame_status')?.value
        };

        const endgame_dict = {
            'DEEP CAGE': this.scoreTable.teleop.barge.deep_cage,
            'SHALLOW CAGE': this.scoreTable.teleop.barge.shallow_cage,
            'PARK': this.scoreTable.teleop.barge.park
        };

        const calc = {
            autoLeave: auto.leave ? this.scoreTable.auto.leave : 0,
            autoCoral: auto.l4 * this.scoreTable.auto.coral.l4 + auto.l3 * this.scoreTable.auto.coral.l3 + auto.l2 * this.scoreTable.auto.coral.l2 + auto.l1 * this.scoreTable.auto.coral.l1,
            autoAlgae: auto.netAlgae * this.scoreTable.auto.algae.net + auto.procAlgae * this.scoreTable.auto.algae.processor,

            algaeRemoved: teleop.algaeRemoved,
            teleopCoral: teleop.l4 * this.scoreTable.teleop.coral.l4 + teleop.l3 * this.scoreTable.teleop.coral.l3 + teleop.l2 * this.scoreTable.teleop.coral.l2 + teleop.l1 * this.scoreTable.teleop.coral.l1,
            teleopAlgae: teleop.netAlgae * this.scoreTable.teleop.algae.net + teleop.procAlgae * this.scoreTable.teleop.algae.processor,
            endgame: endgame_dict[teleop.endgameStatus] ? endgame_dict[teleop.endgameStatus] : 0
        };

        calc.autoPoints = calc.autoLeave + calc.autoCoral + calc.autoAlgae;
        calc.teleopPoints = calc.teleopCoral + calc.teleopAlgae + calc.endgame;

        const fd = new FormData(this.matchDataForm);

        fd.set('algae_removed', String(calc.algaeRemoved));
        fd.set('algae_points', String(calc.autoAlgae + calc.teleopAlgae));
        fd.set('coral_points', String(calc.autoCoral + calc.teleopCoral));
        fd.set('endgame_points', String(calc.endgame));
        fd.set('auto_points', String(calc.autoPoints));
        fd.set('teleop_points', String(calc.teleopPoints));
        fd.set('team_score', String(calc.autoPoints + calc.teleopPoints));
        fd.set('opponent_alliance_score', 'fx:=IFERROR(MODE(FILTER({total_points}, {match_number}={match_number_cell}, {alliance}<>{alliance_cell})), INDEX(FILTER({total_points}, {match_number}={match_number_cell}, {alliance}<>{alliance_cell}), 1))');

        fd.set('sheet_name', 'match_data');
        fd.set('timestamp', new Date().toISOString());

        try {
            if (this.submitBtn) {
                this.submitBtn.disabled = true;
                this.submitBtn.dataset.originalText = this.submitBtn.textContent;
                this.submitBtn.textContent = '送出中…';
                this.submitBtn.setAttribute('aria-busy', 'true');
            }

            setStatus(this.statusEl, '送出中…', 'pending');

            const outputDF = new FormData();

            outputDF.set('action', 'batch_append');
            outputDF.set('ops', JSON.stringify([
                { sheet: 'match_data', data: Object.fromEntries(fd) }
            ]));
            
            const res = await fetch(this.endpoint, { method: 'POST', body: outputDF });
            const text = await res.text();
            let data = {}; try { data = JSON.parse(text); } catch { }

            if (res.ok && data.ok) {
                setStatus(this.statusEl, '已上傳賽事資料 ✅', 'success');
                this.matchDataForm.reset();
                setTimeout(() => setStatus(this.statusEl, '', ''), 2000);
            } else {
                setStatus(this.statusEl, '上傳失敗：' + (data.error || text), 'error');
            }

        } catch (err) {
            setStatus(this.statusEl, '網路錯誤：' + err, 'error');

        } finally {
            if (this.submitBtn) {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = this.submitBtn.dataset.originalText || '新增隊伍';
                this.submitBtn.removeAttribute('aria-busy');
            }
        }
    }
}
