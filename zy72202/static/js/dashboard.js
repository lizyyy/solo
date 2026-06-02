(function() {
  const API = '';

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
  }

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    return res.json();
  }

  async function loadStats() {
    const stats = await fetchJSON(API + '/api/stats');
    document.getElementById('statBatches').textContent = stats.total_batches;
    document.getElementById('statPinyin').textContent = stats.pinyin_approvers;
    document.getElementById('statMissingNote').textContent = stats.missing_notes;
    document.getElementById('statNormal').textContent = stats.normal;
    document.getElementById('statPending').textContent = stats.pending_review;
  }

  async function loadBatches() {
    const batches = await fetchJSON(API + '/api/batches');
    const tbody = document.getElementById('batchBody');
    tbody.innerHTML = '';
    if (!batches.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6b7280;">暂无批次，请点击"导入样例数据"</td></tr>';
      return;
    }
    for (const b of batches) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.batch_id}</td>
        <td>${b.batch_date}</td>
        <td>${b.etf_code}</td>
        <td>${b.etf_name || ''}</td>
        <td><span class="status-badge status-${b.status}">${b.status}</span></td>
        <td><a href="/batch/${b.batch_id}" class="btn btn-sm btn-primary">查看详情</a></td>
      `;
      tbody.appendChild(tr);
    }
  }

  let anomalyChart = null;
  let deviationChart = null;

  async function loadCharts() {
    const stats = await fetchJSON(API + '/api/stats');
    const ctx1 = document.getElementById('anomalyChart').getContext('2d');
    if (anomalyChart) anomalyChart.destroy();
    anomalyChart = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: ['拼音审批人', '缺顺延说明', '已归正常', '待复核'],
        datasets: [{
          data: [stats.pinyin_approvers, stats.missing_notes, stats.normal, stats.pending_review],
          backgroundColor: ['#e03131', '#f59f00', '#2f9e44', '#3b5bdb'],
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } }
        }
      }
    });

    const batches = await fetchJSON(API + '/api/batches');
    let allComponents = [];
    for (const b of batches) {
      const detail = await fetchJSON(API + '/api/batch/' + b.batch_id);
      if (detail.components) allComponents = allComponents.concat(detail.components);
    }

    const topDeviations = allComponents
      .filter(c => Math.abs(c.deviation) > 0)
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
      .slice(0, 8);

    const ctx2 = document.getElementById('deviationChart').getContext('2d');
    if (deviationChart) deviationChart.destroy();
    deviationChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: topDeviations.map(c => c.component_code + ' ' + c.component_name),
        datasets: [{
          label: '权重偏差',
          data: topDeviations.map(c => c.deviation),
          backgroundColor: topDeviations.map(c =>
            c.approver_is_pinyin ? '#e03131' : (c.status === 'missing_note' ? '#f59f00' : '#3b5bdb')
          ),
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: '偏差量' } } }
      }
    });
  }

  document.getElementById('btnImportSample').addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = '导入中...';
    try {
      const result = await fetchJSON(API + '/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: 'sample_data.json' }),
      });
      const pinyinCount = result.components ? result.components.filter(c => c.pinyin_flagged).length : 0;
      showToast(`导入完成! ${result.batches?.length || 0} 个批次, ${pinyinCount} 条拼音审批人`);
      await loadStats();
      await loadBatches();
      await loadCharts();
    } catch (e) {
      showToast('导入失败: ' + e.message);
    }
    this.disabled = false;
    this.textContent = '导入样例数据';
  });

  loadStats();
  loadBatches();
  loadCharts();
})();
