let chart;
let tsData = null;

const THRESHOLD_ALERT = 30;

const FLAG_LABELS = {
  outlier_suspected: '疑似离群',
  revised_multiple_times: '多次修订',
  outlier_corrected: '离群已修正',
  raw_outlier_kept: '原始离群值保留'
};

async function loadTimeseries() {
  const res = await fetch('/api/timeseries');
  if (!res.ok) throw new Error('加载时序数据失败');
  return res.json();
}

async function loadAnomalyDetail(date) {
  const res = await fetch(`/api/anomaly/${date}`);
  if (!res.ok) throw new Error('加载异常明细失败');
  return res.json();
}

function buildChartData(data) {
  const labels = data.series.map(p => p.date);
  const normalPoints = [];
  const anomalyPoints = [];
  data.series.forEach((p, i) => {
    const val = p.bleaching_rate;
    if (p.anomaly) {
      anomalyPoints.push({ x: i, y: val, date: p.date });
      normalPoints.push({ x: i, y: null });
    } else {
      normalPoints.push({ x: i, y: val, date: p.date });
      anomalyPoints.push({ x: i, y: null });
    }
  });
  const thresholdLine = data.series.map(() => THRESHOLD_ALERT);
  return { labels, normalPoints, anomalyPoints, thresholdLine };
}

function initChart(data) {
  const ctx = document.getElementById('timeseriesChart').getContext('2d');
  const { labels, normalPoints, anomalyPoints, thresholdLine } = buildChartData(data);

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '白化率(%)',
          data: data.series.map(p => ({ x: p.date, y: p.bleaching_rate })),
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          order: 2
        },
        {
          label: '警戒阈值',
          data: thresholdLine,
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 3
        },
        {
          label: '异常点(可点击)',
          data: data.series.map(p => p.anomaly ? { x: p.date, y: p.bleaching_rate } : null),
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          pointRadius: 9,
          pointHoverRadius: 12,
          showLine: false,
          pointStyle: 'circle',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      onClick: (evt, elements) => {
        if (!elements || elements.length === 0) return;
        const el = elements[0];
        if (el.datasetIndex !== 2) return;
        const date = data.series[el.index].date;
        showDetail(date);
      },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const p = data.series[idx];
              if (ctx.datasetIndex === 0) {
                return `白化率: ${p.bleaching_rate}%  水温: ${p.water_temp_c}℃`;
              }
              if (ctx.datasetIndex === 2) {
                return `异常：${p.anomaly_reason || '点击查看明细'}`;
              }
              return ctx.dataset.label + ': ' + ctx.parsed.y + '%';
            }
          }
        }
      },
      scales: {
        y: {
          min: 0, max: 100,
          title: { display: true, text: '白化率 (%)' },
          grid: { color: '#f1f5f9' }
        },
        x: {
          title: { display: true, text: '日期' },
          grid: { display: false }
        }
      }
    }
  });
}

function flagChip(flag) {
  const isRisk = flag.includes('outlier');
  const cls = isRisk ? 'flag-chip risk' : 'flag-chip';
  return `<span class="${cls}">${FLAG_LABELS[flag] || flag}</span>`;
}

function renderDriver(driver) {
  if (!driver) return '';
  const sp = driver.ship_contribution_pct || 60;
  const rp = driver.rs_contribution_pct || 40;
  return `
    <div class="section">
      <h4>结果拉动来源 <span class="sub-meta">谁拉动了最终白化率</span></h4>
      <div class="kv">
        <div class="k">船测贡献占比</div><div class="v">${sp}%</div>
        <div class="k">遥感贡献占比</div><div class="v">${rp}%</div>
        ${driver.note ? `<div class="k">备注</div><div class="v">${driver.note}</div>` : ''}
      </div>
      <div class="driver-bar">
        <div class="ship" style="width:${sp}%">船测 ${sp}%</div>
        <div class="rs" style="width:${rp}%">遥感 ${rp}%</div>
      </div>
    </div>
  `;
}

function renderLog(log) {
  if (!log) return '<div class="section"><h4>船上记录本 <span class="sub-meta">无</span></h4></div>';
  const versions = log.versions || [];
  const finalVal = log.final_values || {};
  const versionsHtml = versions.map((v, idx) => {
    const isCurrent = v.version === versions.length;
    return `
      <div class="version-item ${isCurrent ? 'v-current' : ''}">
        <div class="vh">
          <span>v${v.version} · ${v.author} · ${v.timestamp}</span>
          ${isCurrent ? '<span class="current-tag">当前生效</span>' : ''}
        </div>
        <div class="kv">
          <div class="k">白化率</div><div class="v">${v.values.bleaching_pct}%</div>
          <div class="k">活珊瑚覆盖</div><div class="v">${v.values.coral_cover_pct}%</div>
          <div class="k">水温</div><div class="v">${v.values.water_temp_c}℃</div>
        </div>
        ${v.note ? `<div class="note">📝 ${v.note}</div>` : ''}
        ${v.screenshot_ref ? `<div class="screenshot">📎 扫描截图/附件: ${v.screenshot_ref}</div>` : ''}
      </div>
    `;
  }).join('');

  const flagsHtml = (log.flags || []).map(flagChip).join(' ');

  return `
    <div class="section">
      <h4>船上记录本 <span class="sub-meta">${log.id} · ${log.station_code}</span></h4>
      ${flagsHtml ? `<div style="margin-bottom:8px">${flagsHtml}</div>` : ''}
      <div class="kv">
        <div class="k">深度</div><div class="v">${log.depth_m} m</div>
        <div class="k">原始记录白化率</div><div class="v">${log.bleaching_pct_raw}%</div>
        <div class="k">最终生效白化率</div><div class="v" style="font-weight:600;color:#059669">${finalVal.bleaching_pct}%</div>
      </div>
      <div class="version-list">
        <div style="font-size:12px;color:#64748b;margin-top:8px">历史版本（含备注与截图）：</div>
        ${versionsHtml}
      </div>
    </div>
  `;
}

function renderRemote(scene) {
  if (!scene) return '<div class="section"><h4>遥感云遮挡 <span class="sub-meta">无</span></h4></div>';
  const rows = (scene.cloud_mask_rows || []).join(', ');
  const bands = (scene.source_band_lines || []).join(', ');
  return `
    <div class="section">
      <h4>遥感云遮挡 <span class="sub-meta">${scene.id}</span></h4>
      <div class="kv">
        <div class="k">云覆盖率</div><div class="v">${scene.cloud_coverage_pct}%</div>
        <div class="k">受影响像素</div><div class="v">${scene.affected_pixels_affected} / ${scene.total_pixels}</div>
        <div class="k">来源波段</div><div class="v">${bands}</div>
        <div class="k">云掩膜行号</div><div class="v"><span class="cloud-rows">[${rows || '无'}]</span></div>
        <div class="k">质量说明</div><div class="v">${scene.quality_note || '-'}</div>
      </div>
    </div>
  `;
}

function renderFormula(formula) {
  if (!formula) return '';
  const def = formula.formula_definition || {};
  const bl = def.bleaching_rate || {};
  return `
    <div class="section">
      <h4>计算口径 <span class="sub-meta">${formula.version}</span></h4>
      <div class="formula-item"><span class="k">公式：</span>${bl.name || '-'}</div>
      <div class="formula-item"><span class="k">使用字段：</span>${(bl.fields_used || []).join(', ')}</div>
      <div class="formula-item"><span class="k">加权方式：</span>${bl.weighting || '-'}</div>
      <div class="formula-item"><span class="k">离群处理：</span>${bl.outlier_detection || '-'}</div>
      <div class="formula-item"><span class="k">云区插值：</span>${bl.interpolation_for_cloud || '-'}</div>
      <div class="formula-item"><span class="k">历史保留：</span>${bl.history_preservation || '-'}</div>
    </div>
  `;
}

async function showDetail(date) {
  const emptyEl = document.getElementById('detailEmpty');
  const bodyEl = document.getElementById('detailBody');
  emptyEl.hidden = true;
  bodyEl.hidden = false;
  bodyEl.innerHTML = '<p style="color:#64748b">加载中…</p>';

  try {
    const d = await loadAnomalyDetail(date);
    const anomalyBadge = d.anomaly ? `<div class="anomaly-alert">⚠️ ${d.anomaly_reason || '异常'}</div>` : '';
    const flagsHtml = (d.anomaly_flags || []).map(flagChip).join(' ');
    bodyEl.innerHTML = `
      <h3>异常明细溯源</h3>
      <span class="date-badge">📅 ${date}</span>
      ${anomalyBadge}
      ${flagsHtml ? `<div style="margin-bottom:12px">${flagsHtml}</div>` : ''}
      <div class="section">
        <h4>汇总结果</h4>
        <div class="kv">
          <div class="k">最终白化率</div><div class="v" style="font-size:15px;font-weight:600;color:#dc2626">${d.summary.bleaching_rate}%</div>
          <div class="k">水温</div><div class="v">${d.summary.water_temp_c} ℃</div>
          <div class="k">活珊瑚覆盖</div><div class="v">${d.summary.coral_cover_pct}%</div>
        </div>
      </div>
      ${renderDriver(d.summary.driver)}
      ${renderLog(d.ship_log)}
      ${renderRemote(d.remote_scene)}
      ${renderFormula(d.calc_formula)}
    `;
  } catch (e) {
    bodyEl.innerHTML = `<p style="color:#dc2626">加载失败：${e.message}</p>`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  try {
    tsData = await loadTimeseries();
    chart.data.datasets[0].data = tsData.series.map(p => ({ x: p.date, y: p.bleaching_rate }));
    chart.data.datasets[2].data = tsData.series.map(p => p.anomaly ? { x: p.date, y: p.bleaching_rate } : null);
    chart.update();
    document.getElementById('detailEmpty').hidden = false;
    document.getElementById('detailBody').hidden = true;
  } catch (e) {
    alert('重新加载失败: ' + e.message);
  }
});

(async function bootstrap() {
  try {
    tsData = await loadTimeseries();
    initChart(tsData);
  } catch (e) {
    document.querySelector('.chart-section').innerHTML =
      `<p style="color:#dc2626">加载时序数据失败：${e.message}<br/>请确认服务已启动：<code>npm start</code></p>`;
  }
})();
