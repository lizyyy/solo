import { ZONE_TARGETS } from './models.js';

const ZONE_COLORS = {
  A: '#58a6ff',
  B: '#a5d6ff',
  C: '#79c0ff'
};

export class UI {
  constructor(state, simulator) {
    this.state = state;
    this.simulator = simulator;
    this.activeTab = 'tasks';
    this.ganttStartHour = 0;
    this.ganttHours = 24;
    this.tempChartData = { A: [], B: [], C: [] };
    this._bindEvents();
    this._initEvaporatorSelect();
  }

  _bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._switchTab(btn.dataset.tab);
      });
    });

    document.getElementById('btn-add-defrost').addEventListener('click', () => {
      this._openDefrostModal();
    });

    document.getElementById('btn-defrost-cancel').addEventListener('click', () => {
      this._closeDefrostModal();
    });

    document.getElementById('btn-defrost-confirm').addEventListener('click', () => {
      this._confirmDefrost();
    });

    document.getElementById('btn-export-report').addEventListener('click', () => {
      this._exportReport();
    });

    document.getElementById('btn-replay-play').addEventListener('click', () => {
      this._toggleReplay();
    });

    document.getElementById('btn-replay-reset').addEventListener('click', () => {
      this._resetReplay();
    });

    document.getElementById('replay-slider').addEventListener('input', (e) => {
      this._seekReplay(e.target.value);
    });
  }

  _switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `tab-${tabName}`);
    });
    if (tabName === 'chart') this._drawTempChart();
    if (tabName === 'report') this._updateReport();
    if (tabName === 'replay') this._updateReplay();
  }

  _initEvaporatorSelect() {
    const select = document.getElementById('defrost-evaporator');
    select.innerHTML = '';
    for (const evapId of Object.keys(this.state.evaporators)) {
      const evap = this.state.evaporators[evapId];
      const option = document.createElement('option');
      option.value = evapId;
      option.textContent = `蒸发器${evap.id} (${ZONE_TARGETS[evap.zone].label})`;
      select.appendChild(option);
    }
  }

  update() {
    this._updateClock();
    this._updateScore();
    this._updateTempOverlay();
    this._updateTaskList();
    this._updateGantt();
    this._updateTempLegend();
    if (this.activeTab === 'chart') this._drawTempChart();
  }

  _updateClock() {
    const mins = Math.floor(this.state.gameTime);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    document.getElementById('game-clock').textContent =
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  _updateScore() {
    document.getElementById('score-display').textContent = `得分: ${Math.round(this.state.score)}`;
  }

  _updateTempOverlay() {
    const overlay = document.getElementById('temp-overlay');
    const rows = [];
    for (const zoneId of Object.keys(this.state.zones)) {
      const zone = this.state.zones[zoneId];
      const status = this.state.getZoneTempStatus(zoneId);
      const cls = status === 'over' || status === 'under' ? 'over-temp'
        : status.startsWith('near') ? 'near-limit' : 'ok';
      rows.push(`
        <div class="temp-row ${cls}">
          <span class="zone-label">${ZONE_TARGETS[zoneId].label}</span>
          <span class="zone-temp">${zone.temp.toFixed(1)}°C</span>
        </div>
      `);
    }
    overlay.innerHTML = rows.join('');
  }

  _updateTaskList() {
    if (this.activeTab !== 'tasks') return;

    const list = document.getElementById('task-list');
    const tasks = [...this.state.tasks].sort((a, b) => {
      const order = { active: 0, delayed: 1, pending: 2, completed: 3 };
      return order[a.status] - order[b.status];
    });

    list.innerHTML = tasks.map(task => {
      const typeLabel = task.type === 'inbound' ? '入库' : '出库';
      const statusText = {
        pending: '等待中',
        active: '进行中',
        completed: '已完成',
        delayed: '延误中'
      }[task.status];

      const wsH = Math.floor(task.windowStart / 60);
      const wsM = task.windowStart % 60;
      const weH = Math.floor(task.windowEnd / 60);
      const weM = task.windowEnd % 60;
      const windowStr = `${wsH.toString().padStart(2, '0')}:${wsM.toString().padStart(2, '0')} - ${weH.toString().padStart(2, '0')}:${weM.toString().padStart(2, '0')}`;

      return `
        <div class="task-item type-${task.type} status-${task.status}">
          <div class="task-header">
            <span class="task-name">${task.name}</span>
            <span class="task-type">${typeLabel}</span>
          </div>
          <div class="task-meta">
            <span>区域: ${ZONE_TARGETS[task.zone].label}</span>
            <span>时间窗: ${windowStr}</span>
            <span>时长: ${task.duration}分钟</span>
          </div>
          <div class="task-status">${statusText}</div>
        </div>
      `;
    }).join('');
  }

  _updateGantt() {
    if (this.activeTab !== 'schedule') return;

    const timeline = document.getElementById('gantt-timeline');
    const bars = document.getElementById('gantt-bars');

    const totalMinutes = 1440;
    const now = this.state.gameTime;

    const ticks = [];
    for (let h = 0; h <= 24; h += 3) {
      ticks.push(`<div class="tick">${h.toString().padStart(2, '0')}:00</div>`);
    }
    timeline.innerHTML = ticks.join('');

    const rows = [];

    for (const evapId of Object.keys(this.state.evaporators)) {
      const evap = this.state.evaporators[evapId];
      const defrosts = this.state.defrostSchedules.filter(d => d.evaporatorId == evapId);

      const barHtml = defrosts.map(d => {
        const left = (d.start / totalMinutes) * 100;
        const width = (d.duration / totalMinutes) * 100;
        const inProgress = now >= d.start && now < d.end;
        const isPast = now >= d.end;
        return `<div class="gantt-bar defrost ${d.conflict ? 'conflict' : ''}" 
          style="left:${left}%;width:${width}%;opacity:${isPast ? 0.4 : inProgress ? 1 : 0.7}" 
          data-schedule-id="${d.id}"
          title="蒸发器${evapId}除霜 ${Math.floor(d.start / 60)}:${(d.start % 60).toString().padStart(2, '0')} - ${Math.floor(d.end / 60)}:${(d.end % 60).toString().padStart(2, '0')}">
          除霜
        </div>`;
      }).join('');

      rows.push(`
        <div class="gantt-row">
          <div class="gantt-label">蒸发器${evap.id}</div>
          <div class="gantt-track">${barHtml}</div>
        </div>
      `);
    }

    for (const zoneId of Object.keys(ZONE_TARGETS)) {
      const zoneTasks = this.state.tasks.filter(t => t.zone === zoneId);
      const barHtml = zoneTasks.map(task => {
        const left = (task.windowStart / totalMinutes) * 100;
        const width = ((task.windowEnd - task.windowStart) / totalMinutes) * 100;
        const cls = task.type === 'inbound' ? 'task-inbound' : 'task-outbound';
        const isActive = task.status === 'active' || task.status === 'delayed';
        return `<div class="gantt-bar ${cls}" 
          style="left:${left}%;width:${width}%;opacity:${task.status === 'completed' ? 0.4 : isActive ? 1 : 0.6}"
          title="${task.name} ${task.type === 'inbound' ? '入库' : '出库'}">
          ${task.type === 'inbound' ? '入' : '出'}
        </div>`;
      }).join('');

      rows.push(`
        <div class="gantt-row">
          <div class="gantt-label">${ZONE_TARGETS[zoneId].label}</div>
          <div class="gantt-track">${barHtml}</div>
        </div>
      `);
    }

    bars.innerHTML = rows.join('');

    bars.querySelectorAll('.gantt-bar.defrost').forEach(bar => {
      bar.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.scheduleId);
        if (confirm('是否取消除霜计划？')) {
          this.simulator.removeDefrostSchedule(id);
        }
      });
    });
  }

  _updateTempLegend() {
    if (this.activeTab !== 'chart') return;
    const legend = document.getElementById('temp-legend');
    legend.innerHTML = Object.entries(ZONE_TARGETS).map(([id, t]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${ZONE_COLORS[id]}"></div>
        <span>${t.label} (${t.min}°C ~ ${t.max}°C)</span>
      </div>
    `).join('');
  }

  _drawTempChart() {
    const canvas = document.getElementById('temp-chart');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const padding = { top: 20, right: 20, bottom: 30, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, chartW, chartH);

    const allTemps = [];
    for (const zoneId of Object.keys(this.state.tempHistory)) {
      for (const pt of this.state.tempHistory[zoneId]) {
        allTemps.push(pt.temp);
      }
    }
    const minTemp = Math.min(-30, ...allTemps);
    const maxTemp = Math.max(10, ...allTemps);

    ctx.fillStyle = '#8b949e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let t = Math.ceil(minTemp / 5) * 5; t <= maxTemp; t += 5) {
      const y = padding.top + chartH - ((t - minTemp) / (maxTemp - minTemp)) * chartH;
      ctx.fillText(`${t}°C`, padding.left - 5, y + 3);
      ctx.strokeStyle = 'rgba(48, 54, 61, 0.3)';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    for (let h2 = 0; h2 <= 24; h2 += 6) {
      const x = padding.left + (h2 / 24) * chartW;
      ctx.fillText(`${h2}:00`, x, h - padding.bottom + 15);
    }

    for (const [zoneId, zone] of Object.entries(this.state.zones)) {
      ctx.strokeStyle = 'rgba(248, 81, 73, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const yMax = padding.top + chartH - ((zone.target.max - minTemp) / (maxTemp - minTemp)) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, yMax);
      ctx.lineTo(w - padding.right, yMax);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    const now = this.state.gameTime;
    const nowX = padding.left + (now / 1440) * chartW;
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(nowX, padding.top);
    ctx.lineTo(nowX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const [zoneId, history] of Object.entries(this.state.tempHistory)) {
      if (history.length < 2) continue;

      ctx.strokeStyle = ZONE_COLORS[zoneId];
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const x = padding.left + (pt.t / 1440) * chartW;
        const y = padding.top + chartH - ((pt.temp - minTemp) / (maxTemp - minTemp)) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _openDefrostModal() {
    document.getElementById('defrost-modal').classList.remove('hidden');
  }

  _closeDefrostModal() {
    document.getElementById('defrost-modal').classList.add('hidden');
  }

  _confirmDefrost() {
    const evapId = document.getElementById('defrost-evaporator').value;
    const start = parseInt(document.getElementById('defrost-start').value);
    const duration = parseInt(document.getElementById('defrost-duration').value);

    const result = this.simulator.addDefrostSchedule(evapId, start, duration);
    if (result.success) {
      this._closeDefrostModal();
      this._showToast('success', '除霜计划已添加');
    } else {
      this._showToast('error', result.error);
    }
  }

  _showToast(level, msg) {
    const toast = document.createElement('div');
    toast.className = `toast ${level}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  _updateReport() {
    const breakdown = this.simulator.getScoreBreakdown();
    const sbEl = document.getElementById('score-breakdown');
    sbEl.innerHTML = breakdown.map(row => `
      <div class="score-row ${row.positive ? 'positive' : 'negative'}">
        <span>${row.label}</span>
        <span class="score-value">${row.value >= 0 ? '+' : ''}${row.value}</span>
      </div>
    `).join('') + `
      <div class="score-row total">
        <span>总分</span>
        <span class="score-value">${Math.round(this.state.score)}</span>
      </div>
    `;

    const logEl = document.getElementById('event-log');
    logEl.innerHTML = this.state.events.slice(-50).reverse().map(e => {
      const h = Math.floor(e.time / 60);
      const m = Math.floor(e.time % 60);
      return `
        <div class="event-item level-${e.level}">
          <span class="event-time">${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}</span>
          <span class="event-msg">${e.msg}</span>
        </div>
      `;
    }).join('');
  }

  _exportReport() {
    const report = {
      level: this.state.levelConfig.name,
      finalScore: Math.round(this.state.score),
      scoreBreakdown: this.simulator.getScoreBreakdown(),
      events: this.state.events.map(e => ({
        time: `${Math.floor(e.time / 60)}:${(e.time % 60).toString().padStart(2, '0')}`,
        level: e.level,
        msg: e.msg
      })),
      tasks: this.state.tasks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        zone: t.zone,
        status: t.status,
        windowStart: `${Math.floor(t.windowStart / 60)}:${(t.windowStart % 60).toString().padStart(2, '0')}`,
        windowEnd: `${Math.floor(t.windowEnd / 60)}:${(t.windowEnd % 60).toString().padStart(2, '0')}`,
        completedAt: t.completedAt ? `${Math.floor(t.completedAt / 60)}:${(t.completedAt % 60).toString().padStart(2, '0')}` : null
      })),
      defrosts: this.state.defrostSchedules.map(d => ({
        evaporatorId: d.evaporatorId,
        start: `${Math.floor(d.start / 60)}:${(d.start % 60).toString().padStart(2, '0')}`,
        duration: d.duration
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `冷库调度报告_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this._showToast('success', '报告已导出');
  }

  _updateReplay() {
    const canvas = document.getElementById('replay-chart');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const padding = { top: 20, right: 20, bottom: 25, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.strokeStyle = '#30363d';
    ctx.strokeRect(padding.left, padding.top, chartW, chartH);

    ctx.fillStyle = '#8b949e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let t = -25; t <= 10; t += 5) {
      const y = padding.top + chartH - ((t + 30) / 40) * chartH;
      ctx.fillText(`${t}°C`, padding.left - 5, y + 3);
    }

    ctx.textAlign = 'center';
    for (let h2 = 0; h2 <= 24; h2 += 6) {
      const x = padding.left + (h2 / 24) * chartW;
      ctx.fillText(`${h2}:00`, x, h - padding.bottom + 12);
    }

    for (const [zoneId, history] of Object.entries(this.state.tempHistory)) {
      if (history.length < 2) continue;

      ctx.strokeStyle = ZONE_COLORS[zoneId];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();

      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const x = padding.left + (pt.t / 1440) * chartW;
        const y = padding.top + chartH - ((pt.temp + 30) / 40) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _toggleReplay() {
    const btn = document.getElementById('btn-replay-play');
    if (btn.textContent.includes('播放')) {
      btn.textContent = '⏸ 暂停';
      this._replayPlaying = true;
      this._startReplayAnimation();
    } else {
      btn.textContent = '▶ 播放';
      this._replayPlaying = false;
    }
  }

  _resetReplay() {
    document.getElementById('replay-slider').value = 0;
    document.getElementById('replay-time').textContent = '00:00';
    this._replayPlaying = false;
    document.getElementById('btn-replay-play').textContent = '▶ 播放';
  }

  _seekReplay(value) {
    const time = (value / 100) * 1440;
    const h = Math.floor(time / 60);
    const m = Math.floor(time % 60);
    document.getElementById('replay-time').textContent =
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  _startReplayAnimation() {
    const slider = document.getElementById('replay-slider');
    const animate = () => {
      if (!this._replayPlaying) return;
      let val = parseInt(slider.value);
      val += 0.5;
      if (val > 100) {
        val = 100;
        this._replayPlaying = false;
        document.getElementById('btn-replay-play').textContent = '▶ 播放';
      }
      slider.value = val;
      this._seekReplay(val);
      requestAnimationFrame(animate);
    };
    animate();
  }
}