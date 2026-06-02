(function() {
  const API = '';
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');

  function showModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.remove('hidden');
  }

  function hideModal() {
    modal.classList.add('hidden');
  }

  modalClose.addEventListener('click', hideModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) hideModal();
  });

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

  let statusChart = null;
  let deviationChart = null;

  function renderCharts() {
    const normal = COMPONENTS.filter(c => c.status === 'normal').length;
    const pinyin = COMPONENTS.filter(c => c.approver_is_pinyin).length;
    const missing = COMPONENTS.filter(c => c.status === 'missing_note').length;
    const flagged = COMPONENTS.length - normal - pinyin - missing;

    const ctx1 = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: ['正常', '拼音审批人', '缺顺延说明', '其他标记'],
        datasets: [{
          data: [normal, pinyin, missing, Math.max(0, flagged)],
          backgroundColor: ['#2f9e44', '#e03131', '#f59f00', '#3b5bdb'],
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } }
        },
        onClick: function(evt, elements) {
          if (elements.length > 0) {
            const idx = elements[0].index;
            if (idx === 1) {
              const pinyinComps = COMPONENTS.filter(c => c.approver_is_pinyin);
              showModal('拼音审批人成分', pinyinComps.map(c =>
                `<div class="drill-item">
                  <strong>${c.component_code} ${c.component_name}</strong><br>
                  审批人: <span style="color:#e03131;font-weight:600;">${c.approver_name}</span>（仅拼音）<br>
                  批次号: ${BATCH_ID}<br>
                  <a href="#" class="drill-nav" data-field="batch">→ 回到清算批次号</a>
                  <a href="#" class="drill-nav" data-field="note">→ 查看节假日顺延说明</a>
                </div>`
              ).join('<hr style="margin:8px 0;border-color:#e2e4ea">'));
            }
          }
        }
      }
    });

    const deviations = COMPONENTS
      .filter(c => Math.abs(c.deviation) > 0)
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    const ctx2 = document.getElementById('deviationChart').getContext('2d');
    if (deviationChart) deviationChart.destroy();
    deviationChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: deviations.map(c => c.component_code),
        datasets: [{
          label: '权重偏差',
          data: deviations.map(c => c.deviation),
          backgroundColor: deviations.map(c =>
            c.approver_is_pinyin ? '#e03131' : (c.status === 'missing_note' ? '#f59f00' : '#3b5bdb')
          ),
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { title: { display: true, text: '偏差量' } } },
        onClick: function(evt, elements) {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const comp = deviations[idx];
            if (comp) {
              showModal(`${comp.component_code} ${comp.component_name}`, `
                <div>
                  <p><strong>清算批次号:</strong> ${BATCH_ID}</p>
                  <p><strong>预期权重:</strong> ${comp.expected_weight}</p>
                  <p><strong>实际权重:</strong> ${comp.actual_weight}</p>
                  <p><strong>偏差:</strong> ${comp.deviation}</p>
                  <p><strong>审批人:</strong> ${comp.approver_is_pinyin ?
                    '<span style="color:#e03131;font-weight:600;">' + comp.approver_name + '（仅拼音）</span>' :
                    comp.approver_name}</p>
                  <p><strong>节假日顺延说明:</strong> ${comp.holiday_extension_note || '<span style="color:#f59f00;">缺失</span>'}</p>
                  <hr style="margin:12px 0;border-color:#e2e4ea">
                  <a href="#" class="drill-nav" data-field="batch">→ 回到清算批次号</a>
                  ${comp.approver_is_pinyin ? '<a href="#" class="drill-nav" data-field="approver">→ 确认审批人身份</a>' : ''}
                  ${!comp.holiday_extension_note ? '<a href="#" class="drill-nav" data-field="note">→ 补录节假日顺延说明</a>' : ''}
                </div>
              `);
            }
          }
        }
      }
    });
  }

  renderCharts();

  document.querySelectorAll('.pinyin-badge').forEach(badge => {
    badge.addEventListener('click', function() {
      const cid = this.dataset.componentId;
      const comp = COMPONENTS.find(c => c.id == cid);
      if (!comp) return;
      showModal(`拼音审批人: ${comp.approver_name}`, `
        <p>成分: ${comp.component_code} ${comp.component_name}</p>
        <p>审批人: <span style="color:#e03131;font-weight:600;">${comp.approver_name}</span>（仅拼音，无法确认身份）</p>
        <p>清算批次号: ${BATCH_ID}</p>
        <p>节假日顺延说明: ${comp.holiday_extension_note || '<span style="color:#f59f00;">缺失</span>'}</p>
        <hr style="margin:12px 0;border-color:#e2e4ea">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="#" class="drill-nav" data-field="batch">→ 回到清算批次号</a>
          <a href="#" class="drill-nav" data-field="approver" data-cid="${cid}">→ 确认审批人</a>
          <a href="#" class="drill-nav" data-field="note" data-cid="${cid}">→ 补录顺延说明</a>
        </div>
      `);
    });
  });

  document.querySelectorAll('.missing-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const cid = this.dataset.componentId;
      const comp = COMPONENTS.find(c => c.id == cid);
      if (!comp) return;
      showModal(`缺节假日顺延说明`, `
        <p>成分: ${comp.component_code} ${comp.component_name}</p>
        <p>偏差: ${comp.deviation}</p>
        <p>清算批次号: ${BATCH_ID}</p>
        <hr style="margin:12px 0;border-color:#e2e4ea">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="#" class="drill-nav" data-field="batch">→ 回到清算批次号</a>
          <a href="#" class="drill-nav" data-field="note" data-cid="${cid}">→ 补录顺延说明</a>
        </div>
      `);
    });
  });

  document.addEventListener('click', async function(e) {
    const link = e.target.closest('.drill-nav');
    if (!link) return;
    e.preventDefault();
    const field = link.dataset.field;
    const cid = link.dataset.cid;

    if (field === 'batch') {
      hideModal();
      document.querySelector('.batch-header')?.scrollIntoView({ behavior: 'smooth' });
    } else if (field === 'approver' && cid) {
      hideModal();
      const btn = document.querySelector(`.btn-confirm[data-component-id="${cid}"]`);
      if (btn) btn.click();
    } else if (field === 'note' && cid) {
      hideModal();
      const btn = document.querySelector(`.btn-note[data-component-id="${cid}"]`);
      if (btn) btn.click();
    }
  });

  document.querySelectorAll('.btn-confirm').forEach(btn => {
    btn.addEventListener('click', async function() {
      const cid = this.dataset.componentId;
      const approver = this.dataset.approver;
      showModal('确认审批人中文全名', `
        <label>当前拼音: <span style="color:#e03131;font-weight:600;">${approver}</span></label>
        <input type="text" id="confirmName" placeholder="请输入审批人中文全名" autofocus>
        <button class="btn btn-primary" id="submitConfirm" data-cid="${cid}">确认</button>
      `);
      document.getElementById('submitConfirm').addEventListener('click', async function() {
        const name = document.getElementById('confirmName').value.trim();
        if (!name) { alert('请输入中文全名'); return; }
        const result = await fetchJSON(API + '/api/component/' + cid + '/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name }),
        });
        if (result.error) {
          showToast('错误: ' + result.error);
        } else {
          showToast('审批人已确认! 状态: ' + result.status);
          hideModal();
          setTimeout(() => location.reload(), 800);
        }
      });
    });
  });

  document.querySelectorAll('.btn-note').forEach(btn => {
    btn.addEventListener('click', async function() {
      const cid = this.dataset.componentId;
      showModal('补录节假日顺延说明', `
        <label>节假日顺延说明:</label>
        <textarea id="noteText" placeholder="例如：端午节顺延至6月2日清算"></textarea>
        <button class="btn btn-primary" id="submitNote" data-cid="${cid}">提交</button>
      `);
      document.getElementById('submitNote').addEventListener('click', async function() {
        const note = document.getElementById('noteText').value.trim();
        if (!note) { alert('请输入说明内容'); return; }
        const result = await fetchJSON(API + '/api/component/' + cid + '/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note }),
        });
        if (result.error) {
          showToast('错误: ' + result.error);
        } else {
          showToast('顺延说明已补录! 余额变化表已联动更新，状态: ' + result.status);
          if (result.status === 'normal') {
            showToast('✅ 该成分已归正常');
          }
          hideModal();
          setTimeout(() => location.reload(), 800);
        }
      });
    });
  });

  document.querySelectorAll('.drill-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const field = this.dataset.field;
      const batch = this.dataset.batch;
      if (field === 'batch') {
        document.querySelector('.batch-header')?.scrollIntoView({ behavior: 'smooth' });
      } else if (field === 'approver') {
        const row = this.closest('tr');
        const btn = row?.querySelector('.btn-confirm');
        if (btn) btn.click();
      } else if (field === 'note') {
        const row = this.closest('tr');
        const btn = row?.querySelector('.btn-note');
        if (btn) btn.click();
      }
    });
  });
})();
