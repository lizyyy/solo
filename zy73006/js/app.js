const App = (function () {
  let state = {
    alerts: [],
    calcRules: [],
    calcVersion: '',
    thresholds: {},
    filter: {
      status: 'all',
      level: 'all',
      keyword: '',
    },
    currentAlert: null,
    chartInstance: null,
  };

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function levelLabel(l) {
    return { high: '🔴 高风险', mid: '🟡 中风险', low: '🔵 低风险' }[l];
  }
  function statusLabel(s) {
    return { pending: '待补件', confirmed: '已确认', returned: '退回' }[s] || s;
  }

  /* ============ 初始化 ============ */
  function init() {
    const firstRun = DataGenerator.initIfNeeded();
    bindEvents();
    runDetect(firstRun);
  }

  function bindEvents() {
    document.getElementById('btnRunDetect').onclick = () => runDetect(false);
    document.getElementById('btnGuide').onclick = () => {
      document.getElementById('guideModal').style.display = 'flex';
    };
    document.getElementById('btnExport').onclick = exportJSON;

    /* 状态筛选 */
    document.querySelectorAll('#statusFilter .chip').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#statusFilter .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter.status = btn.dataset.status;
        renderAlertList();
      };
    });
    /* 级别筛选 */
    document.querySelectorAll('.chip-level').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.chip-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter.level = btn.dataset.level;
        renderAlertList();
      };
    });
    /* 关键词 */
    document.getElementById('keyword').addEventListener('input', e => {
      state.filter.keyword = e.target.value.trim().toLowerCase();
      renderAlertList();
    });

    /* Tabs in trace modal */
    document.querySelectorAll('.tabs .tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        ['chart', 'calc', 'source', 'boarding'].forEach(t => {
          document.getElementById('tab-' + t).style.display = (t === target) ? 'block' : 'none';
        });
        if (target === 'chart' && state.chartInstance) {
          setTimeout(() => state.chartInstance.resize(), 50);
        }
      };
    });

    /* 点击遮罩关闭弹窗 */
    ['traceModal', 'noteModal', 'guideModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m) m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    });
  }

  function runDetect(firstRun) {
    const result = Detector.run();
    state.alerts = result.alerts;
    state.calcRules = result.calcRules;
    state.calcVersion = result.calcVersion;
    state.thresholds = result.thresholds;

    renderSummary();
    renderRules();
    renderHolidayImpact();
    renderAlertList();
    if (!firstRun) toast(`检测完成：共发现 ${state.alerts.length} 条异常`);
  }

  /* ============ 摘要卡片 ============ */
  function renderSummary() {
    const map = Storage.getAlertStatusMap();
    let pending = 0, confirmed = 0, returned = 0;
    for (const a of state.alerts) {
      const s = (map[a.id] && map[a.id].status) || 'pending';
      if (s === 'pending') pending++;
      else if (s === 'confirmed') confirmed++;
      else if (s === 'returned') returned++;
    }
    const html = `
      <div class="sum-card s-all"><div class="num">${state.alerts.length}</div><div class="lbl">全部异常</div></div>
      <div class="sum-card s-pending"><div class="num">${pending}</div><div class="lbl">待补件</div></div>
      <div class="sum-card s-confirmed"><div class="num">${confirmed}</div><div class="lbl">已确认</div></div>
      <div class="sum-card s-returned"><div class="num">${returned}</div><div class="lbl">退回</div></div>
    `;
    document.getElementById('summaryCards').innerHTML = html;
    document.getElementById('cnt-all').textContent = state.alerts.length;
    document.getElementById('cnt-pending').textContent = pending;
    document.getElementById('cnt-confirmed').textContent = confirmed;
    document.getElementById('cnt-returned').textContent = returned;
  }

  /* ============ 计算口径列表 ============ */
  function renderRules() {
    const list = document.getElementById('ruleList');
    const items = [
      `<li><strong>版本：</strong>${state.calcVersion || '未定义'}</li>`,
      ...state.calcRules.map(r => `<li><strong>${r.key}：</strong>${r.text}</li>`),
      state.thresholds ? `<li><strong>阈值：</strong>跌幅${state.thresholds.weightLossAfterVaccinePercent}% / 涨幅${state.thresholds.weightGainAfterVaccinePercent}% / 记录≥${state.thresholds.minWeightPoints}条 / 免疫${state.thresholds.vaccineOverdueDays}天 / 到期预警${state.thresholds.vaccineDueSoonDays}天 / 寄养降幅${state.thresholds.boardingWeightDropPercent}%</li>` : '',
    ];
    list.innerHTML = items.join('');
  }

  /* ============ 节假日影响 ============ */
  function renderHolidayImpact() {
    const box = document.getElementById('holidayImpact');
    const list = Calendar.getAllHolidayBoardings();
    if (list.length === 0) {
      box.innerHTML = `<p style="color:var(--text-muted);font-size:12px">暂无跨节假日寄养记录</p>`;
      return;
    }
    box.innerHTML = list.map(x => {
      const impStr = x.impacts.map(i =>
        `<b>${i.holidayName}</b> ${i.overlapStart}~${i.overlapEnd}（${i.overlapDays}天）`
      ).join('<br>');
      return `<div class="holiday-item">
        <b>${x.dog.name}</b> · 寄养 ${x.boarding.startDate}~${x.boarding.endDate}<br>
        <small>跨节假日：${impStr}<br>来源：${x.boarding.sourceLine || '寄养登记单'}</small>
      </div>`;
    }).join('');
  }

  /* ============ 异常列表 ============ */
  function renderAlertList() {
    const container = document.getElementById('alertList');
    const map = Storage.getAlertStatusMap();

    let list = [...state.alerts];
    /* 筛选 */
    if (state.filter.status !== 'all') {
      list = list.filter(a => {
        const s = (map[a.id] && map[a.id].status) || 'pending';
        return s === state.filter.status;
      });
    }
    if (state.filter.level !== 'all') {
      list = list.filter(a => a.level === state.filter.level);
    }
    if (state.filter.keyword) {
      const kw = state.filter.keyword;
      list = list.filter(a => {
        const dog = a.dog;
        const statusInfo = map[a.id] || {};
        return (dog.name && dog.name.toLowerCase().includes(kw))
          || (a.title && a.title.toLowerCase().includes(kw))
          || (statusInfo.note && statusInfo.note.toLowerCase().includes(kw))
          || (a.highlights && JSON.stringify(a.highlights).toLowerCase().includes(kw));
      });
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">✨</div><div>没有匹配的异常记录</div><div style="font-size:12px;margin-top:6px">请调整筛选条件或点击重新运行检测</div></div>`;
      return;
    }

    container.innerHTML = list.map(a => {
      const statusInfo = map[a.id] || { status: 'pending', note: '' };
      const status = statusInfo.status || 'pending';
      const dog = a.dog;
      const withdrawnCls = a.hasWithdrawnSource ? 'withdrawn' : '';
      const holidayTag = buildHolidayTag(a);

      return `<div class="alert-card ${a.level} ${withdrawnCls}">
        <div class="ac-header">
          <span class="ac-level">${levelLabel(a.level)}</span>
          <span class="ac-dog">🐶 ${dog.name}</span>
          <span class="ac-tag">${dog.breed} · ${dog.age}岁</span>
          <span class="ac-tag">${a.ruleKey}</span>
          <span class="ac-status status-${status}">${statusLabel(status)}</span>
        </div>
        <div class="ac-body">
          <div class="ac-reason"><b>${a.title}</b><br>${a.reason}</div>
          ${holidayTag}
          <div class="ac-meta">
            <div>主人<b>${dog.owner}</b></div>
            <div>联系电话<b>${dog.phone}</b></div>
            <div>检测时间<b>${new Date(a.createdAt).toLocaleString('zh-CN')}</b></div>
            <div>计算版本<b>${a.calcVersion}</b></div>
          </div>
          <div class="ac-footer">
            <div class="ac-note">📝 ${statusInfo.note ? statusInfo.note : '（暂无备注）'}</div>
            <div class="ac-actions">
              <button class="btn btn-sm btn-primary" onclick="App.openTrace('${a.id}')">🔍 追溯</button>
              <button class="btn btn-sm" onclick="App.openNote('${a.id}')">✏️ 处理</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function buildHolidayTag(alert) {
    const impacts = [];
    for (const b of Storage.getBoardingsByDog(alert.dogId)) {
      for (const i of Calendar.getBoardingHolidayImpact(b)) {
        impacts.push({ b, i });
      }
    }
    if (impacts.length === 0) return '';
    const str = impacts.map(x =>
      `<b>${x.i.holidayName}</b> 寄养 ${x.b.startDate}~${x.b.endDate}（重叠 ${x.i.overlapDays}/${x.i.totalBoardingDays} 天）· 来源：${x.b.sourceLine || '未标注'}`
    ).join('；');
    return `<div class="ac-holiday">🏖️ 跨节假日寄养影响：${str}</div>`;
  }

  /* ============ 追溯弹窗 ============ */
  function openTrace(alertId) {
    const alert = state.alerts.find(a => a.id === alertId);
    if (!alert) return;
    state.currentAlert = alert;
    document.getElementById('traceTitle').textContent = `🔍 追溯：${alert.dog.name} - ${alert.title}`;
    document.getElementById('traceModal').style.display = 'flex';

    /* 默认切回 tab chart */
    switchTab('chart');
    setTimeout(() => {
      renderWeightChart(alert);
      renderCalcDetail(alert);
      renderSourceDetail(alert);
      renderBoardingDetail(alert);
    }, 30);
  }

  function closeTrace() {
    document.getElementById('traceModal').style.display = 'none';
    if (state.chartInstance) { state.chartInstance.destroy(); state.chartInstance = null; }
    state.currentAlert = null;
  }

  function switchTab(tab) {
    document.querySelectorAll('.tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    ['chart', 'calc', 'source', 'boarding'].forEach(t => {
      document.getElementById('tab-' + t).style.display = (t === tab) ? 'block' : 'none';
    });
  }

  /* ===== 体重曲线 ===== */
  function renderWeightChart(alert) {
    const canvas = document.getElementById('weightChart');
    const ctx = canvas.getContext('2d');
    const weights = Storage.getWeightsByDog(alert.dogId);
    const vaccines = Storage.getVaccinesByDog(alert.dogId);
    const boardings = Storage.getBoardingsByDog(alert.dogId);

    const labels = weights.map(w => w.date);
    const data = weights.map(w => w.weight);
    const pointColors = weights.map(w => w.withdrawn ? '#9CA3AF' : '#4F46E5');
    const pointStyles = weights.map(w => w.withdrawn ? 'rectRot' : 'circle');

    if (state.chartInstance) state.chartInstance.destroy();

    const plugins = [];

    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '体重(kg)',
            data,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79,70,229,0.08)',
            fill: true,
            tension: 0.25,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: 6,
            pointStyle: pointStyles,
            borderWidth: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const w = weights[idx];
                return `${w.weight}kg${w.withdrawn ? ` 【已撤回：${w.withdrawnReason || '原因未标注'}】` : ''} · ${w.source}`;
              }
            }
          },
          annotation: undefined,
        },
        scales: {
          y: {
            title: { display: true, text: '体重 (kg)' },
            beginAtZero: false,
          },
          x: {
            title: { display: true, text: '日期' },
            ticks: { maxRotation: 45, minRotation: 0 },
          }
        }
      },
      plugins: [{
        id: 'eventLines',
        afterDatasetsDraw(chart) {
          const { ctx, chartArea, scales } = chart;
          ctx.save();

          /* 疫苗事件竖线 */
          for (const v of vaccines) {
            const x = scales.x.getPixelForValue(v.date);
            if (!x || x < chartArea.left || x > chartArea.right) continue;
            ctx.strokeStyle = '#10B981';
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#10B981';
            ctx.font = '11px sans-serif';
            ctx.fillText('💉' + v.name.slice(0, 4), x + 4, chartArea.top + 12);
          }

          /* 寄养区间阴影 */
          for (const b of boardings) {
            const x1 = scales.x.getPixelForValue(b.startDate);
            const x2 = scales.x.getPixelForValue(b.endDate);
            if (x2 < chartArea.left || x1 > chartArea.right) continue;
            ctx.fillStyle = 'rgba(245,158,11,0.15)';
            ctx.fillRect(Math.max(x1, chartArea.left), chartArea.top,
              Math.min(x2, chartArea.right) - Math.max(x1, chartArea.left),
              chartArea.bottom - chartArea.top);
            const mid = (Math.max(x1, chartArea.left) + Math.min(x2, chartArea.right)) / 2;
            ctx.fillStyle = '#B45309';
            ctx.font = '11px sans-serif';
            ctx.fillText('🏠寄养', mid - 20, chartArea.bottom - 8);
          }

          /* 标记高亮的关键点 */
          const hl = alert.highlights || {};
          ['beforeWeightId', 'afterWeightId'].forEach(k => {
            if (!hl[k]) return;
            const idx = weights.findIndex(w => w.id === hl[k]);
            if (idx < 0) return;
            const x = scales.x.getPixelForValue(labels[idx]);
            const y = scales.y.getPixelForValue(data[idx]);
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = k === 'beforeWeightId' ? '#10B981' : '#EF4444';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          });

          ctx.restore();
        }
      }]
    });

    /* 图表下方说明 */
    const hl = alert.highlights || {};
    const extra = [];
    if (hl.dropPct) extra.push(`🔴 红色圆圈标记跌幅点，跌幅 ${hl.dropPct}%（>阈值 ${hl.threshold}%）`);
    if (hl.gainPct) extra.push(`🟡 红色圆圈标记涨幅点，涨幅 ${hl.gainPct}%（>阈值 ${hl.threshold}%）`);
    extra.push('💚 绿色虚线：疫苗接种日');
    extra.push('🏠 黄色阴影：寄养期间');
    extra.push('◇ 菱形+灰色：已撤回原始记录');
    document.getElementById('chartFootnote').innerHTML = extra.join(' · ');

    /* 修复 canvas 尺寸 */
    setTimeout(() => state.chartInstance && state.chartInstance.resize(), 80);
  }

  /* ===== 计算口径详情 ===== */
  function renderCalcDetail(alert) {
    const box = document.getElementById('calcDetail');
    const settings = Storage.getSettings();
    const rules = settings.calcRules.filter(r => r.key === alert.ruleKey);
    const html = `
      <div style="background:var(--primary-light);padding:12px;border-radius:8px;margin-bottom:12px;border-left:4px solid var(--primary)">
        <b>命中规则：</b>${rules.map(r => r.key + ' ' + r.text).join('、')}
      </div>
      <div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:12px">
        <b>全局版本：</b>${settings.calcRuleVersion}<br>
        <b>计算时间：</b>${new Date(alert.createdAt).toLocaleString('zh-CN')}<br>
        <b>今日基准：</b>${Detector.TODAY}
      </div>
      <h4 style="margin-bottom:8px">涉及阈值</h4>
      <table class="src-table">
        <tr><th>阈值项</th><th>规则值</th><th>实际值</th><th>判定</th></tr>
        ${buildThresholdRows(alert, settings.thresholds)}
      </table>
      <h4 style="margin:16px 0 8px">判定过程</h4>
      <div style="padding:12px;background:var(--bg);border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap">${buildProcessText(alert, settings)}</div>
    `;
    box.innerHTML = html;
  }

  function buildThresholdRows(alert, th) {
    const hl = alert.highlights || {};
    const pairs = [];
    if (alert.ruleKey === 'R1') pairs.push(['疫苗后30天体重跌幅', th.weightLossAfterVaccinePercent + '%', hl.dropPct + '%', Number(hl.dropPct) >= th.weightLossAfterVaccinePercent ? '🔴 触发' : '—']);
    else if (alert.ruleKey === 'R2') pairs.push(['疫苗后7天体重涨幅', th.weightGainAfterVaccinePercent + '%', hl.gainPct + '%', Number(hl.gainPct) >= th.weightGainAfterVaccinePercent ? '🟡 触发' : '—']);
    else if (alert.ruleKey === 'R3') pairs.push(['年度免疫间隔', th.vaccineOverdueDays + '天', (th.vaccineOverdueDays + Number(hl.overdueDays)) + '天', `🔴 超期 ${hl.overdueDays} 天`]);
    else if (alert.ruleKey === 'R4') pairs.push(['到期预警提前量', th.vaccineDueSoonDays + '天内', hl.daysLeft + '天', `🟡 剩余 ${hl.daysLeft} 天`]);
    else if (alert.ruleKey === 'R5') pairs.push(['最小体重点数', '≥' + th.minWeightPoints + ' 条', hl.activeCount + ' 条', hl.activeCount < th.minWeightPoints ? '🔵 触发' : '—']);
    else if (alert.ruleKey === 'R6') pairs.push(['疫苗记录存在性', '≥1 条', '0 条', '🔴 触发']);
    else if (alert.ruleKey === 'R7') pairs.push(['跨寄养体重降幅', th.boardingWeightDropPercent + '%', hl.dropPct + '%', Number(hl.dropPct) >= th.boardingWeightDropPercent ? '🟡 触发' : '—']);

    if (pairs.length === 0) return `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">（无量化阈值）</td></tr>`;
    return pairs.map(p => `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td>${p[3]}</td></tr>`).join('');
  }

  function buildProcessText(alert, settings) {
    const hl = alert.highlights || {};
    let text = `[输入] 犬只：${alert.dog.name}\n`;
    const w = Storage.getActiveWeightsByDog(alert.dogId);
    const v = Storage.getVaccinesByDog(alert.dogId);
    text += `       有效体重记录 ${w.length} 条：${w.map(x => x.date + ' ' + x.weight + 'kg').join('，')}\n`;
    text += `       疫苗记录 ${v.length} 条：${v.map(x => x.date + ' ' + x.name).join('，') || '（无）'}\n\n`;
    text += `[规则 ${alert.ruleKey}] ${settings.calcRules.find(r => r.key === alert.ruleKey)?.text || ''}\n`;
    text += `[过程]\n`;

    if (alert.ruleKey === 'R1') {
      const before = w.find(x => x.id === hl.beforeWeightId);
      const after = w.find(x => x.id === hl.afterWeightId);
      const vaccine = v.find(x => x.id === hl.vaccineId);
      text += `  1. 最近一次疫苗 ${vaccine?.name || ''}（${vaccine?.date || ''}）\n`;
      text += `  2. 疫苗前最近体重 = ${before?.weight}kg（${before?.date}）\n`;
      text += `  3. 疫苗后30天内最低体重 = ${after?.weight}kg（${after?.date}）\n`;
      text += `  4. 跌幅 = (${before?.weight} - ${after?.weight}) / ${before?.weight} = ${hl.dropPct}% > ${hl.threshold}%\n`;
      text += `  5. 判定：异常\n`;
    } else if (alert.ruleKey === 'R2') {
      const before = w.find(x => x.id === hl.beforeWeightId);
      const after = w.find(x => x.id === hl.afterWeightId);
      const vaccine = v.find(x => x.id === hl.vaccineId);
      text += `  1. 疫苗 ${vaccine?.name || ''}（${vaccine?.date || ''}）\n`;
      text += `  2. 疫苗前最近体重 = ${before?.weight}kg\n`;
      text += `  3. 疫苗后7天内最高 = ${after?.weight}kg\n`;
      text += `  4. 涨幅 = ${hl.gainPct}% > ${hl.threshold}% → 水肿可疑\n`;
    } else if (alert.ruleKey === 'R3') {
      text += `  1. 最新疫苗下次接种日 ${hl.nextDate}\n`;
      text += `  2. 今日 ${Detector.TODAY}\n`;
      text += `  3. 差值 = 已超期 ${hl.overdueDays} 天\n`;
    } else if (alert.ruleKey === 'R4') {
      text += `  1. 到期日 ${hl.nextDate}\n`;
      text += `  2. 还剩 ${hl.daysLeft} 天 ≤ 30 天 → 预警\n`;
    } else if (alert.ruleKey === 'R5') {
      text += `  1. 有效体重点数 = ${hl.activeCount} < ${hl.threshold}\n`;
    } else if (alert.ruleKey === 'R6') {
      text += `  1. 疫苗记录数 = 0 → 无法判定免疫状态\n`;
    } else if (alert.ruleKey === 'R7') {
      const imp = (hl.holidayImpact || []).map(i => i.holidayName).join('、');
      text += `  1. 寄养跨节假日：${imp}\n`;
      text += `  2. 寄养前后体重降幅 ${hl.dropPct}% → 触发\n`;
    }
    return text;
  }

  /* ===== 来源材料 ===== */
  function renderSourceDetail(alert) {
    const box = document.getElementById('sourceDetail');
    const sources = alert.sources || Detector.collectSources(alert.dogId);
    const hl = alert.highlights || {};
    const highlighted = new Set([
      hl.beforeWeightId, hl.afterWeightId, hl.vaccineId, hl.boardingId,
    ].filter(Boolean));

    const typeBadge = t => ({
      weight: ['badge-weight', '体重'],
      vaccine: ['badge-success', '疫苗'],
      boarding: ['badge-warning', '寄养'],
    }[t] || ['', t]);

    const rows = sources.map(s => {
      const [cls, label] = typeBadge(s.type);
      const wCls = s.withdrawn ? 'row-withdrawn' : '';
      const star = highlighted.has(s.id) ? ' ⭐' : '';
      const withdrawBadge = s.withdrawn
        ? ` <span class="src-badge badge-withdrawn">已撤回：${s.withdrawnReason || '原因未标注'}</span>` : '';
      const sourceLine = s.sourceLine ? `<br><small style="color:#6B7280">来源行：${s.sourceLine}</small>` : '';
      return `<tr class="${wCls}">
        <td><span class="src-badge ${cls}">${label}</span></td>
        <td>${s.date}</td>
        <td>${s.label}${star}${withdrawBadge}${sourceLine}</td>
        <td>${s.id}</td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <p style="margin-bottom:8px;font-size:12px;color:var(--text-muted)">
        ⭐ 为本次判定直接使用的材料行；划线为已撤回记录（仍然显示以保证可追溯）
      </p>
      <table class="src-table">
        <tr><th>类型</th><th>日期</th><th>内容</th><th>编号</th></tr>
        ${rows}
      </table>
    `;
  }

  /* ===== 寄养 + 节假日 ===== */
  function renderBoardingDetail(alert) {
    const box = document.getElementById('boardingDetail');
    const boardings = Storage.getBoardingsByDog(alert.dogId);
    if (boardings.length === 0) {
      box.innerHTML = `<p style="color:var(--text-muted)">该犬只无寄养记录</p>`;
      return;
    }
    const html = boardings.map(b => {
      const impacts = Calendar.getBoardingHolidayImpact(b);
      const totalDays = Calendar.diffDays(b.startDate, b.endDate) + 1;
      const impStr = impacts.length
        ? impacts.map(i => `<li><b style="color:var(--warning)">${i.holidayName}</b>：重叠 ${i.overlapStart}~${i.overlapEnd} 共 ${i.overlapDays}/${i.totalBoardingDays} 天（占比 ${(i.overlapRatio * 100).toFixed(0)}%）</li>`).join('')
        : '<li style="color:var(--text-muted)">本次寄养未跨法定节假日</li>';
      return `<div style="padding:12px;background:var(--bg);border-radius:8px;margin-bottom:12px">
        <b>寄养登记</b>：${b.startDate} ~ ${b.endDate}（共 ${totalDays} 天）<br>
        <b>来源：</b>${b.source || ''}<br>
        <b>登记单行号：</b>${b.sourceLine || '未标注'}
        <h5 style="margin:10px 0 6px">节假日影响范围</h5>
        <ul style="padding-left:18px;font-size:12px">${impStr}</ul>
      </div>`;
    }).join('');

    const holidays = Storage.getHolidays();
    const holidayList = holidays.map(h =>
      `<tr><td>${h.name}</td><td>${h.start}</td><td>${h.end}</td></tr>`
    ).join('');
    box.innerHTML = html + `
      <h4 style="margin:16px 0 8px">📅 2026年度法定节假日参考</h4>
      <table class="src-table"><tr><th>节假日</th><th>开始</th><th>结束</th></tr>${holidayList}</table>
    `;
  }

  /* ============ 备注/状态 ============ */
  function openNote(alertId) {
    const alert = state.alerts.find(a => a.id === alertId);
    if (!alert) return;
    state.currentAlert = alert;
    const info = Storage.getAlertStatus(alertId);
    document.getElementById('noteStatus').value = info.status || 'pending';
    document.getElementById('noteText').value = info.note || '';
    const history = info.history || [];
    const hHtml = history.length
      ? history.map(h => `
          <div class="history-item">
            <div class="history-meta">${new Date(h.time).toLocaleString('zh-CN')} · ${statusLabel(h.status)}</div>
            <div class="history-text">${h.note || '（无备注）'}</div>
          </div>
        `).join('')
      : `<div style="color:var(--text-muted);text-align:center;padding:8px">暂无历史备注</div>`;
    document.getElementById('noteHistory').innerHTML = hHtml;
    document.getElementById('noteModal').style.display = 'flex';
  }

  function closeNote() {
    document.getElementById('noteModal').style.display = 'none';
    state.currentAlert = null;
  }

  function saveNote() {
    if (!state.currentAlert) return;
    const status = document.getElementById('noteStatus').value;
    const note = document.getElementById('noteText').value.trim();
    Storage.setAlertStatus(state.currentAlert.id, { status, note });
    closeNote();
    renderSummary();
    renderAlertList();
    toast('✅ 已保存，数据已写入本地存储');
  }

  /* ============ 导出 ============ */
  function exportJSON() {
    const map = Storage.getAlertStatusMap();
    const payload = {
      exportAt: new Date().toISOString(),
      calcVersion: state.calcVersion,
      today: Detector.TODAY,
      summary: (() => {
        let pending = 0, confirmed = 0, returned = 0;
        state.alerts.forEach(a => {
          const s = (map[a.id] && map[a.id].status) || 'pending';
          if (s === 'pending') pending++;
          else if (s === 'confirmed') confirmed++;
          else returned++;
        });
        return { total: state.alerts.length, pending, confirmed, returned };
      })(),
      alerts: state.alerts.map(a => {
        const s = map[a.id] || { status: 'pending', note: '', history: [] };
        return {
          id: a.id,
          ruleKey: a.ruleKey,
          level: a.level,
          title: a.title,
          dog: { id: a.dogId, name: a.dog.name, breed: a.dog.breed, owner: a.dog.owner, phone: a.dog.phone },
          reason: a.reason.replace(/<[^>]+>/g, ''),
          highlights: a.highlights,
          status: s.status,
          note: s.note,
          history: s.history || [],
          createdAt: a.createdAt,
          hasWithdrawnSource: a.hasWithdrawnSource,
          sourceCount: a.sources ? a.sources.length : 0,
        };
      }),
      rawDogs: Storage.getDogs(),
      rawWeights: Storage.getWeights(),
      rawVaccines: Storage.getVaccines(),
      rawBoardings: Storage.getBoardings(),
      settings: Storage.getSettings(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `犬只疫苗异常复核_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ 复核表已导出为 JSON');
  }

  return {
    init,
    openTrace, closeTrace,
    openNote, closeNote, saveNote,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
