const API_BASE = '';

let currentKilnId = null;
let currentKilnData = null;
let materials = [];
let bodies = [];
let currentSampleRisks = [];
let currentSampleId = null;

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(API_BASE + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return response.json();
  } catch (error) {
    console.error('API 请求失败:', error);
    alert('网络错误，请检查连接');
  }
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  if (viewName === 'kilns') {
    loadKilns();
  } else if (viewName === 'materials') {
    loadMaterials();
  } else if (viewName === 'bodies') {
    loadBodies();
  }
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

async function loadKilns() {
  const kilns = await apiRequest('/api/kiln-runs');
  const container = document.getElementById('kilns-list');
  
  if (!kilns || kilns.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无窑次记录</p>
        <button class="primary" onclick="showCreateKilnModal()">创建第一个窑次</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = kilns.map(kiln => `
    <div class="list-item">
      <div class="list-item-info">
        <h3>${kiln.name}</h3>
        <p>日期: ${kiln.date}${kiln.notes ? ' | ' + kiln.notes.substring(0, 50) : ''}</p>
      </div>
      <div class="list-item-actions">
        <button onclick="loadKilnDetail(${kiln.id})">查看详情</button>
      </div>
    </div>
  `).join('');
}

function showCreateKilnModal() {
  document.getElementById('kiln-name').value = '';
  document.getElementById('kiln-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('kiln-notes').value = '';
  showModal('modal-create-kiln');
}

async function createKiln(event) {
  event.preventDefault();
  const name = document.getElementById('kiln-name').value;
  const date = document.getElementById('kiln-date').value;
  const notes = document.getElementById('kiln-notes').value;
  
  await apiRequest('/api/kiln-runs', {
    method: 'POST',
    body: JSON.stringify({ name, date, notes })
  });
  
  closeModal('modal-create-kiln');
  loadKilns();
}

async function loadKilnDetail(kilnId) {
  currentKilnId = kilnId;
  const data = await apiRequest(`/api/kiln-runs/${kilnId}`);
  currentKilnData = data;
  
  document.getElementById('kiln-detail-title').textContent = data.kilnRun.name;
  
  const content = document.getElementById('kiln-detail-content');
  const samples = data.samples;
  
  if (samples.length === 0) {
    content.innerHTML = `
      <div class="kiln-detail">
        <p><strong>日期:</strong> ${data.kilnRun.date}</p>
        ${data.kilnRun.notes ? `<p><strong>备注:</strong> ${data.kilnRun.notes}</p>` : ''}
        <div class="empty-state" style="margin-top: 2rem;">
          <p>该窑次暂无试片记录</p>
          <button class="primary" onclick="showAddSampleModal()">添加第一个试片</button>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="kiln-detail">
        <p><strong>日期:</strong> ${data.kilnRun.date}</p>
        ${data.kilnRun.notes ? `<p><strong>备注:</strong> ${data.kilnRun.notes}</p>` : ''}
      </div>
      <h3 style="margin: 1.5rem 0 1rem;">试片对比</h3>
      ${renderSamplesComparison(samples)}
    `;
  }
  
  showView('kiln-detail');
}

function renderSamplesComparison(samples) {
  const overrideMap = {};
  for (const sample of samples) {
    overrideMap[sample.id] = {};
    for (const override of sample.risk_override || []) {
      overrideMap[sample.id][override.type] = override;
    }
  }

  return samples.map(sample => {
    const appliedRisks = (sample.risks || []).map(risk => {
      const override = overrideMap[sample.id]?.[risk.type];
      if (override) {
        if (override.action === 'dismiss') {
          return null;
        }
        return { ...risk, severity: override.newSeverity, overridden: true };
      }
      return risk;
    }).filter(Boolean);

    return `
      <div class="sample-card">
        <div class="sample-header">
          <div>
            <h4>试片 ${sample.sample_code || 'N/A'}</h4>
            <div class="sample-meta">
              ${sample.position ? `<span>窑位: ${sample.position}${sample.position_temp ? ` (${sample.position_temp}°C)` : ''}</span>` : ''}
            </div>
          </div>
          <button class="small" onclick="showRiskOverrideModal(${sample.id})">风险改判</button>
        </div>
        
        ${appliedRisks.length > 0 ? `
          <div class="sample-section">
            <h5>风险检测</h5>
            <div>
              ${appliedRisks.map(risk => `
                <span class="risk-badge ${risk.severity}${risk.overridden ? ' overridden' : ''}">
                  ${risk.overridden ? '✓ ' : ''}${risk.message}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="sample-section">
          <h5>配方</h5>
          <table class="table">
            <thead>
              <tr><th>原料</th><th>用量</th></tr>
            </thead>
            <tbody>
              ${(sample.glaze_recipe || []).map(item => `
                <tr><td>${item.material}</td><td>${item.weight}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        ${Object.keys(sample.oxide_molars || {}).length > 0 ? `
          <div class="sample-section">
            <h5>氧化物摩尔比例 (已归一化)</h5>
            <table class="table">
              <thead>
                <tr><th>氧化物</th><th>摩尔比</th></tr>
              </thead>
              <tbody>
                ${Object.entries(sample.oxide_molars).map(([oxide, ratio]) => `
                  <tr><td>${oxide}</td><td>${ratio.toFixed(4)}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        ${sample.notes ? `
          <div class="sample-section">
            <h5>备注</h5>
            <p>${sample.notes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function showAddSampleModal() {
  materials = await apiRequest('/api/materials');
  bodies = await apiRequest('/api/bodies');
  
  const bodySelect = document.getElementById('sample-body');
  const materialSelects = document.querySelectorAll('.recipe-material');
  
  bodySelect.innerHTML = '<option value="">-- 选择坯体 --</option>' +
    (bodies || []).map(b => `<option value="${b.id}">${b.code}${b.name ? ` - ${b.name}` : ''}</option>`).join('');
  
  for (const select of materialSelects) {
    updateMaterialSelect(select);
  }
  
  document.getElementById('sample-code').value = '';
  document.getElementById('sample-position').value = '';
  document.getElementById('sample-position-temp').value = '';
  document.getElementById('sample-notes').value = '';
  
  document.getElementById('recipe-items').innerHTML = `
    <div class="recipe-item">
      <select class="recipe-material">
        <option value="">-- 选择原料 --</option>
      </select>
      <input type="number" class="recipe-weight" step="0.01" placeholder="用量">
      <button type="button" onclick="removeRecipeItem(this)">×</button>
    </div>
  `;
  
  const newMaterialSelect = document.querySelector('#recipe-items .recipe-material');
  updateMaterialSelect(newMaterialSelect);
  
  showModal('modal-add-sample');
}

function updateMaterialSelect(select) {
  select.innerHTML = '<option value="">-- 选择原料 --</option>' +
    (materials || []).map(m => `<option value="${m.name}">${m.name}</option>`).join('');
}

function addRecipeItem() {
  const container = document.getElementById('recipe-items');
  const div = document.createElement('div');
  div.className = 'recipe-item';
  div.innerHTML = `
    <select class="recipe-material">
      <option value="">-- 选择原料 --</option>
    </select>
    <input type="number" class="recipe-weight" step="0.01" placeholder="用量">
    <button type="button" onclick="removeRecipeItem(this)">×</button>
  `;
  updateMaterialSelect(div.querySelector('.recipe-material'));
  container.appendChild(div);
}

function removeRecipeItem(btn) {
  const items = document.querySelectorAll('.recipe-item');
  if (items.length > 1) {
    btn.closest('.recipe-item').remove();
  }
}

async function addSample(event) {
  event.preventDefault();
  
  const recipeItems = document.querySelectorAll('.recipe-item');
  const glaze_recipe = [];
  
  for (const item of recipeItems) {
    const material = item.querySelector('.recipe-material').value;
    const weight = parseFloat(item.querySelector('.recipe-weight').value);
    if (material && !isNaN(weight)) {
      glaze_recipe.push({ material, weight });
    }
  }
  
  if (glaze_recipe.length === 0) {
    alert('请至少添加一个原料');
    return;
  }
  
  const bodyId = document.getElementById('sample-body').value;
  const positionTemp = document.getElementById('sample-position-temp').value;
  
  await apiRequest('/api/samples', {
    method: 'POST',
    body: JSON.stringify({
      kiln_run_id: currentKilnId,
      body_id: bodyId ? parseInt(bodyId) : null,
      sample_code: document.getElementById('sample-code').value || null,
      position: document.getElementById('sample-position').value || null,
      position_temp: positionTemp ? parseFloat(positionTemp) : null,
      glaze_recipe,
      notes: document.getElementById('sample-notes').value || null
    })
  });
  
  closeModal('modal-add-sample');
  loadKilnDetail(currentKilnId);
}

async function loadMaterials() {
  materials = await apiRequest('/api/materials');
  const container = document.getElementById('materials-list');
  
  if (!materials || materials.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无原料数据</p>
        <button class="primary" onclick="showCreateMaterialModal()">创建第一个原料</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = materials.map(m => `
    <div class="list-item">
      <div class="list-item-info">
        <h3>${m.name}${m.formula ? ` (${m.formula})` : ''}</h3>
        <p>
          ${Object.entries(m.oxides || {}).map(([oxide, pct]) => 
            `<span class="oxide-badge">${oxide}: ${pct}%</span>`
          ).join('')}
        </p>
      </div>
    </div>
  `).join('');
}

function showCreateMaterialModal() {
  document.getElementById('material-name').value = '';
  document.getElementById('material-formula').value = '';
  document.getElementById('material-notes').value = '';
  
  document.getElementById('oxide-items').innerHTML = `
    <div class="oxide-item">
      <select class="oxide-type">
        <option value="">-- 选择氧化物 --</option>
        <option value="SiO2">SiO2</option>
        <option value="Al2O3">Al2O3</option>
        <option value="K2O">K2O</option>
        <option value="Na2O">Na2O</option>
        <option value="CaO">CaO</option>
        <option value="MgO">MgO</option>
        <option value="B2O3">B2O3</option>
        <option value="ZnO">ZnO</option>
        <option value="TiO2">TiO2</option>
        <option value="ZrO2">ZrO2</option>
        <option value="Fe2O3">Fe2O3</option>
        <option value="P2O5">P2O5</option>
        <option value="Li2O">Li2O</option>
        <option value="SrO">SrO</option>
        <option value="BaO">BaO</option>
        <option value="PbO">PbO</option>
      </select>
      <input type="number" class="oxide-percentage" step="0.01" placeholder="百分比">
      <button type="button" onclick="removeOxideItem(this)">×</button>
    </div>
  `;
  
  showModal('modal-create-material');
}

function addOxideItem() {
  const container = document.getElementById('oxide-items');
  const div = document.createElement('div');
  div.className = 'oxide-item';
  div.innerHTML = `
    <select class="oxide-type">
      <option value="">-- 选择氧化物 --</option>
      <option value="SiO2">SiO2</option>
      <option value="Al2O3">Al2O3</option>
      <option value="K2O">K2O</option>
      <option value="Na2O">Na2O</option>
      <option value="CaO">CaO</option>
      <option value="MgO">MgO</option>
      <option value="B2O3">B2O3</option>
      <option value="ZnO">ZnO</option>
      <option value="TiO2">TiO2</option>
      <option value="ZrO2">ZrO2</option>
      <option value="Fe2O3">Fe2O3</option>
      <option value="P2O5">P2O5</option>
      <option value="Li2O">Li2O</option>
      <option value="SrO">SrO</option>
      <option value="BaO">BaO</option>
      <option value="PbO">PbO</option>
    </select>
    <input type="number" class="oxide-percentage" step="0.01" placeholder="百分比">
    <button type="button" onclick="removeOxideItem(this)">×</button>
  `;
  container.appendChild(div);
}

function removeOxideItem(btn) {
  const items = document.querySelectorAll('.oxide-item');
  if (items.length > 1) {
    btn.closest('.oxide-item').remove();
  }
}

async function createMaterial(event) {
  event.preventDefault();
  
  const oxideItems = document.querySelectorAll('.oxide-item');
  const oxides = {};
  
  for (const item of oxideItems) {
    const type = item.querySelector('.oxide-type').value;
    const percentage = parseFloat(item.querySelector('.oxide-percentage').value);
    if (type && !isNaN(percentage)) {
      oxides[type] = percentage;
    }
  }
  
  await apiRequest('/api/materials', {
    method: 'POST',
    body: JSON.stringify({
      name: document.getElementById('material-name').value,
      formula: document.getElementById('material-formula').value || null,
      oxides,
      notes: document.getElementById('material-notes').value || null
    })
  });
  
  closeModal('modal-create-material');
  loadMaterials();
}

async function loadBodies() {
  bodies = await apiRequest('/api/bodies');
  const container = document.getElementById('bodies-list');
  
  if (!bodies || bodies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无坯体数据</p>
        <button class="primary" onclick="showCreateBodyModal()">创建第一个坯体</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = bodies.map(b => `
    <div class="list-item">
      <div class="list-item-info">
        <h3>${b.code}${b.name ? ` - ${b.name}` : ''}</h3>
        ${b.description ? `<p>${b.description}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function showCreateBodyModal() {
  document.getElementById('body-code').value = '';
  document.getElementById('body-name').value = '';
  document.getElementById('body-description').value = '';
  showModal('modal-create-body');
}

async function createBody(event) {
  event.preventDefault();
  
  await apiRequest('/api/bodies', {
    method: 'POST',
    body: JSON.stringify({
      code: document.getElementById('body-code').value,
      name: document.getElementById('body-name').value || null,
      description: document.getElementById('body-description').value || null
    })
  });
  
  closeModal('modal-create-body');
  loadBodies();
}

async function analyzePositions() {
  if (!currentKilnId) return;
  
  const result = await apiRequest(`/api/kiln-runs/${currentKilnId}/analyze-positions`, {
    method: 'POST'
  });
  
  if (result && result.updated > 0) {
    alert(`已分析窑位温差，更新了 ${result.updated} 个试片`);
    loadKilnDetail(currentKilnId);
  } else {
    alert('未检测到足够的窑位温度数据进行温差分析');
  }
}

function showRiskOverrideModal(sampleId) {
  currentSampleId = sampleId;
  const sample = currentKilnData.samples.find(s => s.id === sampleId);
  if (!sample) return;
  
  currentSampleRisks = [...(sample.risk_override || [])];
  
  const container = document.getElementById('override-risk-list');
  const overrideMap = {};
  for (const override of currentSampleRisks) {
    overrideMap[override.type] = override;
  }
  
  container.innerHTML = (sample.risks || []).map(risk => {
    const override = overrideMap[risk.type];
    const isDismissed = override?.action === 'dismiss';
    const newSeverity = override?.newSeverity || risk.severity;
    
    return `
      <div class="risk-item">
        <div class="risk-item-info">
          <span class="risk-badge ${risk.severity}">${risk.severity.toUpperCase()}</span>
          <strong>${risk.message}</strong>
          ${override ? `<span style="color: #666; font-size: 0.85rem;">(已改判)</span>` : ''}
        </div>
        <div class="risk-item-actions">
          <select onchange="updateRiskOverride('${risk.type}', this.value)">
            <option value="" ${!override ? 'selected' : ''}>保持原状态</option>
            <option value="dismiss" ${isDismissed ? 'selected' : ''}>忽略此风险</option>
            <option value="high" ${!isDismissed && newSeverity === 'high' ? 'selected' : ''}>改判为高风险</option>
            <option value="medium" ${!isDismissed && newSeverity === 'medium' ? 'selected' : ''}>改判为中风险</option>
            <option value="low" ${!isDismissed && newSeverity === 'low' ? 'selected' : ''}>改判为低风险</option>
          </select>
        </div>
      </div>
    `;
  }).join('');
  
  showModal('modal-risk-override');
}

async function updateRiskOverride(riskType, action) {
  currentSampleRisks = currentSampleRisks.filter(r => r.type !== riskType);
  
  if (action === 'dismiss') {
    currentSampleRisks.push({ type: riskType, action: 'dismiss' });
  } else if (action) {
    currentSampleRisks.push({ type: riskType, action: 'modify', newSeverity: action });
  }
  
  await apiRequest(`/api/samples/${currentSampleId}/risk-override`, {
    method: 'PUT',
    body: JSON.stringify({ risk_override: currentSampleRisks })
  });
  
  loadKilnDetail(currentKilnId);
}

function exportMarkdown() {
  if (!currentKilnId) return;
  window.open(`${API_BASE}/api/export/markdown/${currentKilnId}`, '_blank');
}

function exportIssues() {
  if (!currentKilnId) return;
  window.open(`${API_BASE}/api/export/issues/${currentKilnId}`, '_blank');
}

async function deleteKiln() {
  if (!currentKilnId) return;
  if (!confirm('确定要删除这个窑次及其所有试片记录吗？此操作不可恢复。')) return;
  
  await apiRequest(`/api/kiln-runs/${currentKilnId}`, {
    method: 'DELETE'
  });
  
  currentKilnId = null;
  currentKilnData = null;
  showView('kilns');
}

async function importCSV() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE}/api/import/csv`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    
    if (result.data && result.data.length > 0) {
      const preview = document.getElementById('csv-preview');
      const headers = Object.keys(result.data[0]);
      preview.innerHTML = `
        <p>已导入 ${result.data.length} 行数据，预览前 5 行:</p>
        <table class="preview-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${result.data.slice(0, 5).map(row => `
              <tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error('导入失败:', error);
    alert('导入失败');
  }
}

async function importJSON() {
  const fileInput = document.getElementById('json-file');
  const file = fileInput.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE}/api/import/json`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    
    if (result.data) {
      const preview = document.getElementById('json-preview');
      preview.innerHTML = `
        <p>已导入 JSON 数据:</p>
        <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; max-height: 300px; overflow-y: auto;">
${JSON.stringify(result.data, null, 2).substring(0, 2000)}
        </pre>
      `;
    }
  } catch (error) {
    console.error('导入失败:', error);
    alert('导入失败');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadKilns();
});
