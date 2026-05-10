let inventory = [];
let currentPlan = null;
let savedPlans = [];
let selectedPlanIndices = new Set();

document.addEventListener('DOMContentLoaded', function() {
    loadInventory();
    setupEventListeners();
});

function showTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab-btn[onclick="showTab('${tabId}')"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'saved') {
        loadSavedPlans();
    }
}

async function loadInventory() {
    try {
        const response = await fetch('/api/inventory');
        const data = await response.json();
        inventory = data.materials;
        renderInventory();
        updateMaterialSelects();
    } catch (error) {
        showNotification('加载库存失败', 'error');
        console.error(error);
    }
}

function renderInventory() {
    const tbody = document.getElementById('inventoryBody');
    const summary = document.getElementById('inventorySummary');
    
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">暂无库存数据</td></tr>';
        summary.innerHTML = '';
        return;
    }
    
    const totalStock = inventory.reduce((sum, m) => sum + m.stock_kg, 0);
    const avgScore = inventory.reduce((sum, m) => sum + m.aroma_score, 0) / inventory.length;
    const avgCost = inventory.reduce((sum, m) => sum + m.cost_per_kg, 0) / inventory.length;
    
    summary.innerHTML = `
        <div class="summary-item">
            <div class="value">${inventory.length}</div>
            <div class="label">原料种类</div>
        </div>
        <div class="summary-item">
            <div class="value">${totalStock.toFixed(1)}kg</div>
            <div class="label">总库存量</div>
        </div>
        <div class="summary-item">
            <div class="value">${avgScore.toFixed(1)}</div>
            <div class="label">平均香气评分</div>
        </div>
        <div class="summary-item">
            <div class="value">¥${avgCost.toFixed(0)}</div>
            <div class="label">平均单价</div>
        </div>
    `;
    
    tbody.innerHTML = inventory.map(m => `
        <tr>
            <td><strong>${m.id}</strong></td>
            <td>${m.name}</td>
            <td><span class="grade-${getGradeClass(m.grade)}">${m.grade}</span></td>
            <td>${m.aroma_score}</td>
            <td>¥${m.cost_per_kg}</td>
            <td>${m.stock_kg}</td>
            <td>${m.description || '-'}</td>
        </tr>
    `).join('');
}

function getGradeClass(grade) {
    const gradeMap = {
        '特级': 'super',
        '一级': '1',
        '二级': '2',
        '三级': '3'
    };
    return gradeMap[grade] || '3';
}

function updateMaterialSelects() {
    const container = document.getElementById('componentsContainer');
    const selects = container.querySelectorAll('.material-select');
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">选择原料</option>' + 
            inventory.map(m => `
                <option value="${m.id}" ${currentValue === m.id ? 'selected' : ''}>
                    ${m.name} (${m.grade} | 评分:${m.aroma_score} | ¥${m.cost_per_kg}/kg)
                </option>
            `).join('');
    });
}

function addComponent() {
    const container = document.getElementById('componentsContainer');
    const index = container.children.length;
    
    const row = document.createElement('div');
    row.className = 'component-row';
    row.dataset.index = index;
    row.innerHTML = `
        <select class="material-select">
            <option value="">选择原料</option>
            ${inventory.map(m => `
                <option value="${m.id}">
                    ${m.name} (${m.grade} | 评分:${m.aroma_score} | ¥${m.cost_per_kg}/kg)
                </option>
            `).join('')}
        </select>
        <input type="number" class="proportion-input" min="0" max="100" step="1" placeholder="比例%" oninput="updateTotalProportion()">
        <button class="btn btn-danger btn-sm" onclick="removeComponent(this)">删除</button>
    `;
    
    container.appendChild(row);
}

function removeComponent(btn) {
    const row = btn.closest('.component-row');
    if (document.querySelectorAll('.component-row').length > 1) {
        row.remove();
        updateTotalProportion();
    } else {
        showNotification('至少需要保留一个原料', 'error');
    }
}

function updateTotalProportion() {
    const inputs = document.querySelectorAll('.proportion-input');
    let total = 0;
    inputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        total += value;
    });
    
    const totalElement = document.getElementById('totalProportion');
    totalElement.textContent = `总比例: ${total}%`;
    totalElement.classList.toggle('warning', Math.abs(total - 100) > 0.001);
}

async function calculatePlan() {
    const batchName = document.getElementById('batchName').value;
    const targetWeight = parseFloat(document.getElementById('targetWeight').value);
    const targetAroma = parseFloat(document.getElementById('targetAroma').value);
    const maxCost = parseFloat(document.getElementById('maxCost').value);
    
    const rows = document.querySelectorAll('.component-row');
    const components = [];
    
    for (const row of rows) {
        const select = row.querySelector('.material-select');
        const input = row.querySelector('.proportion-input');
        
        if (select.value && input.value) {
            components.push({
                material_id: select.value,
                proportion: parseFloat(input.value)
            });
        }
    }
    
    if (components.length === 0) {
        showNotification('请至少选择一个原料并设置比例', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_name: batchName,
                target_weight_kg: targetWeight,
                target_aroma_score: targetAroma,
                max_cost_per_kg: maxCost,
                components: components
            })
        });
        
        const data = await response.json();
        currentPlan = data;
        renderResult(data);
    } catch (error) {
        showNotification('计算失败', 'error');
        console.error(error);
    }
}

function renderResult(plan) {
    const container = document.getElementById('resultContainer');
    const content = document.getElementById('resultContent');
    const card = document.getElementById('resultCard');
    
    container.classList.remove('hidden');
    
    const feasibilityBadge = plan.is_feasible 
        ? '<span class="feasible-badge">✅ 方案可行</span>'
        : '<span class="infeasible-badge">❌ 方案不可行</span>';
    
    content.innerHTML = `
        <div class="result-header">
            <h3>${plan.batch_name}</h3>
            ${feasibilityBadge}
        </div>
        
        <div class="result-metrics">
            <div class="metric-card">
                <div class="metric-label">平均香气评分</div>
                <div class="metric-value">${plan.avg_aroma_score.toFixed(2)}</div>
                <small>目标: ${plan.target_aroma_score}</small>
            </div>
            <div class="metric-card">
                <div class="metric-label">总成本</div>
                <div class="metric-value">¥${plan.total_cost.toFixed(2)}</div>
                <small>目标重量: ${plan.target_weight_kg}kg</small>
            </div>
            <div class="metric-card">
                <div class="metric-label">平均单价</div>
                <div class="metric-value">¥${plan.avg_cost_per_kg.toFixed(2)}</div>
                <small>上限: ¥${plan.max_cost_per_kg}</small>
            </div>
        </div>
        
        <div class="components-list">
            <h4>拼配组成</h4>
            ${plan.components.map(c => `
                <div class="component-item">
                    <span>
                        <strong>${c.material_name}</strong> (${c.grade})
                        <span class="grade-${getGradeClass(c.grade)}"></span>
                    </span>
                    <span>
                        比例: ${c.proportion}% | 
                        用量: ${c.quantity_kg.toFixed(2)}kg | 
                        成本: ¥${c.cost.toFixed(2)}
                    </span>
                </div>
            `).join('')}
        </div>
        
        ${plan.feasibility_reasons.length > 0 ? `
            <div class="feasibility-list">
                <h4>✅ 满足条件</h4>
                <ul>
                    ${plan.feasibility_reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${plan.violations.length > 0 ? `
            <div class="violations-list">
                <h4>❌ 违反约束</h4>
                <ul>
                    ${plan.violations.map(v => `<li>${v}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        <div class="key-assumptions">
            <h4>📋 关键假设</h4>
            <ul>
                ${plan.key_assumptions.map(a => `<li>${a}</li>`).join('')}
            </ul>
        </div>
    `;
}

async function saveCurrentPlan() {
    if (!currentPlan) {
        showNotification('没有可保存的方案', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/plans/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentPlan)
        });
        
        const data = await response.json();
        showNotification(data.message, 'success');
    } catch (error) {
        showNotification('保存失败', 'error');
        console.error(error);
    }
}

async function exportCurrentPlan() {
    if (!currentPlan) {
        showNotification('没有可导出的方案', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: currentPlan })
        });
        
        const data = await response.json();
        
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.report.report_id}_${currentPlan.batch_name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('报告已导出', 'success');
    } catch (error) {
        showNotification('导出失败', 'error');
        console.error(error);
    }
}

async function optimizePlans() {
    const targetWeight = parseFloat(document.getElementById('optTargetWeight').value);
    const targetAroma = parseFloat(document.getElementById('optTargetAroma').value);
    const maxCost = parseFloat(document.getElementById('optMaxCost').value);
    
    try {
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_weight_kg: targetWeight,
                target_aroma_score: targetAroma,
                max_cost_per_kg: maxCost
            })
        });
        
        const data = await response.json();
        renderOptimizeResults(data);
    } catch (error) {
        showNotification('优化失败', 'error');
        console.error(error);
    }
}

function renderOptimizeResults(data) {
    const container = document.getElementById('optimizeResults');
    const feasibleDiv = document.getElementById('feasiblePlans');
    const infeasibleDiv = document.getElementById('infeasiblePlans');
    
    container.classList.remove('hidden');
    
    if (data.feasible_plans.length === 0) {
        feasibleDiv.innerHTML = '<p class="empty-message">没有找到可行方案，请尝试放宽约束条件</p>';
    } else {
        feasibleDiv.innerHTML = data.feasible_plans.map(plan => `
            <div class="plan-card">
                <div class="plan-card-header">
                    <h4>${plan.batch_name}</h4>
                    <span class="feasible-badge">可行</span>
                </div>
                <div class="result-metrics">
                    <div class="metric-card">
                        <div class="metric-label">平均香气评分</div>
                        <div class="metric-value">${plan.avg_aroma_score.toFixed(2)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">总成本</div>
                        <div class="metric-value">¥${plan.total_cost.toFixed(2)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">平均单价</div>
                        <div class="metric-value">¥${plan.avg_cost_per_kg.toFixed(2)}</div>
                    </div>
                </div>
                <div class="components-list">
                    ${plan.components.map(c => `
                        <div class="component-item">
                            <span><strong>${c.material_name}</strong> (${c.grade})</span>
                            <span>比例: ${c.proportion}% | 用量: ${c.quantity_kg.toFixed(2)}kg</span>
                        </div>
                    `).join('')}
                </div>
                <div class="result-actions">
                    <button class="btn btn-success btn-sm" onclick='saveOptimizedPlan(${JSON.stringify(plan).replace(/'/g, "\\'")})'>保存此方案</button>
                    <button class="btn btn-info btn-sm" onclick='exportOptimizedPlan(${JSON.stringify(plan).replace(/'/g, "\\'")})'>导出</button>
                </div>
            </div>
        `).join('');
    }
    
    if (data.infeasible_plans.length === 0) {
        infeasibleDiv.innerHTML = '<p class="empty-message">没有不可行方案</p>';
    } else {
        infeasibleDiv.innerHTML = data.infeasible_plans.map(plan => `
            <div class="plan-card">
                <div class="plan-card-header">
                    <h4>${plan.batch_name}</h4>
                    <span class="infeasible-badge">不可行</span>
                </div>
                <div class="violations-list">
                    <h4>问题说明</h4>
                    <ul>
                        ${plan.violations.map(v => `<li>${v}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    }
}

async function saveOptimizedPlan(plan) {
    try {
        const response = await fetch('/api/plans/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plan)
        });
        
        const data = await response.json();
        showNotification(data.message, 'success');
    } catch (error) {
        showNotification('保存失败', 'error');
        console.error(error);
    }
}

async function exportOptimizedPlan(plan) {
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: plan })
        });
        
        const data = await response.json();
        
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.report.report_id}_${plan.batch_name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('报告已导出', 'success');
    } catch (error) {
        showNotification('导出失败', 'error');
        console.error(error);
    }
}

async function loadSavedPlans() {
    try {
        const response = await fetch('/api/plans');
        const data = await response.json();
        savedPlans = data.plans;
        renderSavedPlans();
    } catch (error) {
        showNotification('加载已保存方案失败', 'error');
        console.error(error);
    }
}

function renderSavedPlans() {
    const container = document.getElementById('savedPlansList');
    const compareSection = document.getElementById('compareSection');
    
    selectedPlanIndices.clear();
    
    if (savedPlans.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无保存的方案</p>';
        compareSection.classList.add('hidden');
        return;
    }
    
    compareSection.classList.remove('hidden');
    
    container.innerHTML = savedPlans.map((plan, index) => `
        <div class="plan-card" data-index="${index}" onclick="togglePlanSelection(${index})">
            <div class="plan-card-header">
                <div>
                    <input type="checkbox" ${selectedPlanIndices.has(index) ? 'checked' : ''}>
                    <span>${index + 1}. ${plan.batch_name}</span>
                </div>
                <span class="${plan.is_feasible ? 'feasible-badge' : 'infeasible-badge'}">
                    ${plan.is_feasible ? '可行' : '不可行'}
                </span>
            </div>
            <div class="result-metrics">
                <div class="metric-card">
                    <div class="metric-label">平均香气评分</div>
                    <div class="metric-value">${plan.avg_aroma_score.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">总成本</div>
                    <div class="metric-value">¥${plan.total_cost.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">平均单价</div>
                    <div class="metric-value">¥${plan.avg_cost_per_kg.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function togglePlanSelection(index) {
    const card = document.querySelector(`.plan-card[data-index="${index}"]`);
    const checkbox = card.querySelector('input[type="checkbox"]');
    
    if (selectedPlanIndices.has(index)) {
        selectedPlanIndices.delete(index);
        card.classList.remove('selected');
        checkbox.checked = false;
    } else {
        selectedPlanIndices.add(index);
        card.classList.add('selected');
        checkbox.checked = true;
    }
}

async function comparePlans() {
    if (selectedPlanIndices.size < 2) {
        showNotification('请至少选择两个方案进行比较', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/plans/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan_indices: Array.from(selectedPlanIndices)
            })
        });
        
        const data = await response.json();
        renderComparison(data);
    } catch (error) {
        showNotification('比较失败', 'error');
        console.error(error);
    }
}

function renderComparison(data) {
    const container = document.getElementById('compareResults');
    container.classList.remove('hidden');
    
    const plans = data.plans;
    const metrics = data.comparison_metrics;
    
    const metricLabels = {
        'total_cost': '总成本(元)',
        'avg_cost_per_kg': '平均单价(元/kg)',
        'avg_aroma_score': '平均香气评分',
        'target_weight_kg': '目标重量(kg)'
    };
    
    let tableHtml = '<table class="comparison-table"><thead><tr><th>指标</th>';
    plans.forEach(plan => {
        tableHtml += `<th>${plan.batch_name}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    metrics.forEach(metric => {
        tableHtml += `<tr><td><strong>${metricLabels[metric.metric] || metric.metric}</strong></td>`;
        metric.values.forEach((value, idx) => {
            const isBest = (metric.metric === 'avg_aroma_score' && value === metric.max) ||
                          ((metric.metric === 'total_cost' || metric.metric === 'avg_cost_per_kg') && value === metric.min);
            tableHtml += `<td class="${isBest ? 'highlight' : ''}">${value.toFixed(2)}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table>';
    
    let recommendationHtml = '';
    if (data.recommendation) {
        recommendationHtml = `
            <div class="recommendation-card">
                <h4>💡 推荐建议</h4>
                <ul>
                    ${data.recommendation.reasoning.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    container.innerHTML = tableHtml + recommendationHtml;
}

async function addMaterial(e) {
    e.preventDefault();
    
    const material = {
        id: document.getElementById('newMaterialId').value,
        name: document.getElementById('newMaterialName').value,
        grade: document.getElementById('newMaterialGrade').value,
        aroma_score: parseFloat(document.getElementById('newMaterialScore').value),
        cost_per_kg: parseFloat(document.getElementById('newMaterialCost').value),
        stock_kg: parseFloat(document.getElementById('newMaterialStock').value),
        description: document.getElementById('newMaterialDesc').value
    };
    
    try {
        const response = await fetch('/api/materials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(material)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            document.getElementById('addMaterialForm').reset();
            loadInventory();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('添加失败', 'error');
        console.error(error);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function setupEventListeners() {
    document.getElementById('addMaterialForm').addEventListener('submit', addMaterial);
    
    document.querySelectorAll('.proportion-input').forEach(input => {
        input.addEventListener('input', updateTotalProportion);
    });
}
