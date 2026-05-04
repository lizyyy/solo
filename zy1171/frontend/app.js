const API_BASE = 'http://localhost:5000/api';

let currentExperimentId = null;
let selectedExperimentIds = new Set();
let charts = {};
let experimentsCache = {};

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeCharts();
    initializeEventListeners();
    updateExperimentList();
});

function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function initializeCharts() {
    const chartConfigs = {
        lossChart: {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Loss',
                    data: [],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Loss'
                        }
                    }
                }
            }
        },
        parameterChart: {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Parameter Value'
                        }
                    }
                }
            }
        },
        gradientChart: {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Gradient Value'
                        }
                    }
                }
            }
        },
        surfaceChart: {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Loss Surface',
                        data: [],
                        backgroundColor: 'rgba(100, 100, 100, 0.3)',
                        pointRadius: 2,
                        showLine: false
                    },
                    {
                        label: 'Optimizer Path',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        pointRadius: 4,
                        showLine: true,
                        lineTension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Parameter 1'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Parameter 2'
                        }
                    }
                }
            }
        },
        comparisonChart: {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Loss'
                        }
                    }
                }
            }
        }
    };

    Object.keys(chartConfigs).forEach(chartId => {
        const ctx = document.getElementById(chartId);
        if (ctx) {
            charts[chartId] = new Chart(ctx, chartConfigs[chartId]);
        }
    });
}

function initializeEventListeners() {
    document.getElementById('optimizer').addEventListener('change', updateOptimizerParams);
    
    document.getElementById('createExperiment').addEventListener('click', createExperiment);
    document.getElementById('startExperiment').addEventListener('click', startExperiment);
    document.getElementById('stepExperiment').addEventListener('click', stepExperiment);
    
    document.getElementById('compareExperiments').addEventListener('click', compareExperiments);
    document.getElementById('saveAll').addEventListener('click', saveAllExperiments);
    document.getElementById('loadAll').addEventListener('click', loadAllExperiments);
    
    document.getElementById('exportReport').addEventListener('click', exportReport);
    document.getElementById('exportComparisonReport').addEventListener('click', exportComparisonReport);
    
    updateOptimizerParams();
}

function updateOptimizerParams() {
    const optimizer = document.getElementById('optimizer').value;
    const paramsDiv = document.getElementById('optimizerParams');
    
    let html = `
        <div class="form-group">
            <label for="learningRate">学习率 (learning_rate)</label>
            <input type="number" id="learningRate" value="${getDefaultLearningRate(optimizer)}" step="0.0001" min="0.000001">
            <small class="param-hint">推荐: ${getLearningRateHint(optimizer)}</small>
        </div>
    `;
    
    if (optimizer === 'Momentum') {
        html += `
            <div class="form-group">
                <label for="momentum">动量 (momentum)</label>
                <input type="number" id="momentum" value="0.9" step="0.01" min="0" max="0.999">
                <small class="param-hint">推荐: 0.9 (范围: 0 ~ 0.999)</small>
            </div>
        `;
    } else if (optimizer === 'RMSProp') {
        html += `
            <div class="form-group">
                <label for="beta">Beta</label>
                <input type="number" id="beta" value="0.9" step="0.01" min="0" max="0.999">
                <small class="param-hint">推荐: 0.9 (范围: 0 ~ 0.999)</small>
            </div>
            <div class="form-group">
                <label for="epsilon">Epsilon</label>
                <input type="number" id="epsilon" value="1e-8" step="1e-10" min="1e-15">
                <small class="param-hint">推荐: 1e-8</small>
            </div>
        `;
    } else if (optimizer === 'Adagrad') {
        html += `
            <div class="form-group">
                <label for="epsilon">Epsilon</label>
                <input type="number" id="epsilon" value="1e-8" step="1e-10" min="1e-15">
                <small class="param-hint">推荐: 1e-8</small>
            </div>
        `;
    } else if (optimizer === 'Adam') {
        html += `
            <div class="form-group">
                <label for="beta1">Beta1</label>
                <input type="number" id="beta1" value="0.9" step="0.01" min="0" max="0.999">
                <small class="param-hint">推荐: 0.9 (范围: 0 ~ 0.999)</small>
            </div>
            <div class="form-group">
                <label for="beta2">Beta2</label>
                <input type="number" id="beta2" value="0.999" step="0.001" min="0" max="0.9999">
                <small class="param-hint">推荐: 0.999 (范围: 0 ~ 0.9999)</small>
            </div>
            <div class="form-group">
                <label for="epsilon">Epsilon</label>
                <input type="number" id="epsilon" value="1e-8" step="1e-10" min="1e-15">
                <small class="param-hint">推荐: 1e-8</small>
            </div>
        `;
    }
    
    paramsDiv.innerHTML = html;
}

function getDefaultLearningRate(optimizer) {
    const defaults = {
        'SGD': '0.01',
        'Momentum': '0.01',
        'Adagrad': '0.01',
        'RMSProp': '0.001',
        'Adam': '0.001'
    };
    return defaults[optimizer] || '0.01';
}

function getLearningRateHint(optimizer) {
    const hints = {
        'SGD': '0.01 ~ 0.1',
        'Momentum': '0.01 ~ 0.1',
        'Adagrad': '0.01 ~ 0.1',
        'RMSProp': '0.001 ~ 0.01',
        'Adam': '0.001 ~ 0.01'
    };
    return hints[optimizer] || '0.001 ~ 0.1';
}

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        return { error: 'API请求失败', message: error.message };
    }
}

async function createExperiment() {
    const name = document.getElementById('experimentName').value || '实验';
    const seed = document.getElementById('seed').value;
    const datasetType = document.getElementById('datasetType').value;
    const datasetSize = parseInt(document.getElementById('datasetSize').value);
    const optimizer = document.getElementById('optimizer').value;
    const batchSize = parseInt(document.getElementById('batchSize').value);
    const epochs = parseInt(document.getElementById('epochs').value);
    
    const optimizerConfig = {
        type: optimizer,
        params: {
            learning_rate: parseFloat(document.getElementById('learningRate').value),
            seed: seed ? parseInt(seed) : null
        }
    };
    
    if (optimizer === 'Momentum') {
        optimizerConfig.params.momentum = parseFloat(document.getElementById('momentum').value);
    } else if (optimizer === 'RMSProp') {
        optimizerConfig.params.beta = parseFloat(document.getElementById('beta').value);
        optimizerConfig.params.epsilon = parseFloat(document.getElementById('epsilon').value);
    } else if (optimizer === 'Adagrad') {
        optimizerConfig.params.epsilon = parseFloat(document.getElementById('epsilon').value);
    } else if (optimizer === 'Adam') {
        optimizerConfig.params.beta1 = parseFloat(document.getElementById('beta1').value);
        optimizerConfig.params.beta2 = parseFloat(document.getElementById('beta2').value);
        optimizerConfig.params.epsilon = parseFloat(document.getElementById('epsilon').value);
    }
    
    const datasetConfig = {
        type: datasetType,
        params: {
            size: datasetSize,
            feature_dim: datasetType === 'loss_surface_2d' ? 2 : 2
        }
    };
    
    const result = await apiRequest('/experiments', 'POST', {
        name,
        optimizer_config: optimizerConfig,
        dataset_config: datasetConfig,
        batch_size: batchSize,
        epochs,
        seed: seed ? parseInt(seed) : null
    });
    
    if (result.error) {
        alert('创建实验失败: ' + result.message);
        return;
    }
    
    if (result.warnings && result.warnings.length > 0) {
        showWarnings(result.warnings);
    } else {
        hideWarnings();
    }
    
    currentExperimentId = result.id;
    experimentsCache[result.id] = result;
    
    updateExperimentList();
    updateButtons();
    
    if (datasetType === 'loss_surface_2d') {
        await loadLossSurface();
    }
}

async function loadLossSurface() {
    const result = await apiRequest(`/experiments/${currentExperimentId}/loss_surface`);
    if (result && !result.error) {
        updateSurfaceChart(result);
    }
}

function updateSurfaceChart(surfaceData) {
    if (!charts.surfaceChart) return;
    
    const points = [];
    if (surfaceData.X1 && surfaceData.X2 && surfaceData.loss) {
        const X1 = surfaceData.X1;
        const X2 = surfaceData.X2;
        const loss = surfaceData.loss;
        
        const step = Math.max(1, Math.floor(X1.length * X1[0].length / 1000));
        let count = 0;
        
        for (let i = 0; i < X1.length; i++) {
            for (let j = 0; j < X1[i].length; j++) {
                if (count % step === 0) {
                    points.push({
                        x: X1[i][j],
                        y: X2[i][j],
                        r: Math.max(1, Math.min(10, loss[i][j]))
                    });
                }
                count++;
            }
        }
    }
    
    charts.surfaceChart.data.datasets[0].data = points;
    charts.surfaceChart.update();
}

async function startExperiment() {
    if (!currentExperimentId) return;
    
    const epochs = parseInt(document.getElementById('epochs').value);
    const result = await apiRequest(`/experiments/${currentExperimentId}/run`, 'POST', { epochs });
    
    if (result.error) {
        alert('运行实验失败: ' + result.message);
        return;
    }
    
    await updateExperimentVisualization(currentExperimentId);
    updateExperimentList();
}

async function stepExperiment() {
    if (!currentExperimentId) return;
    
    const result = await apiRequest(`/experiments/${currentExperimentId}/step`, 'POST');
    
    if (result.error) {
        alert('单步执行失败: ' + result.message);
        return;
    }
    
    await updateExperimentVisualization(currentExperimentId);
    updateExperimentList();
}

async function updateExperimentVisualization(experimentId) {
    const experiment = await apiRequest(`/experiments/${experimentId}`);
    if (experiment.error) return;
    
    experimentsCache[experimentId] = experiment;
    
    const history = experiment.history || {};
    const losses = history.loss || [];
    const parameters = history.parameters || [];
    const gradients = history.gradients || [];
    
    updateLossChart(losses);
    updateParameterChart(parameters);
    updateGradientChart(gradients);
    updateBehaviorAnalysis(experimentId);
    updateTrainingLog(experimentId);
    
    if (parameters.length > 0 && parameters[0].length === 2) {
        updateOptimizerPath(parameters);
    }
    
    updateExperimentList();
}

function updateLossChart(losses) {
    if (!charts.lossChart) return;
    
    charts.lossChart.data.labels = losses.map((_, i) => i + 1);
    charts.lossChart.data.datasets[0].data = losses;
    charts.lossChart.update();
}

function updateParameterChart(parameters) {
    if (!charts.parameterChart || parameters.length === 0) return;
    
    const paramCount = parameters[0].length;
    const colors = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    
    const datasets = [];
    for (let i = 0; i < paramCount; i++) {
        datasets.push({
            label: `Parameter ${i + 1}`,
            data: parameters.map(p => p[i]),
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '20',
            tension: 0.4,
            fill: false
        });
    }
    
    charts.parameterChart.data.labels = parameters.map((_, i) => i + 1);
    charts.parameterChart.data.datasets = datasets;
    charts.parameterChart.update();
}

function updateGradientChart(gradients) {
    if (!charts.gradientChart || gradients.length === 0) return;
    
    const validGradients = gradients.filter(g => g !== null);
    if (validGradients.length === 0) return;
    
    const gradCount = validGradients[0].length;
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#4f46e5', '#8b5cf6'];
    
    const datasets = [];
    for (let i = 0; i < gradCount; i++) {
        datasets.push({
            label: `Gradient ${i + 1}`,
            data: validGradients.map(g => g[i]),
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '20',
            tension: 0.4,
            fill: false
        });
    }
    
    charts.gradientChart.data.labels = validGradients.map((_, i) => i + 1);
    charts.gradientChart.data.datasets = datasets;
    charts.gradientChart.update();
}

function updateOptimizerPath(parameters) {
    if (!charts.surfaceChart) return;
    
    const path = parameters.map(p => ({
        x: p[0],
        y: p[1]
    }));
    
    charts.surfaceChart.data.datasets[1].data = path;
    charts.surfaceChart.update();
}

async function updateBehaviorAnalysis(experimentId) {
    const result = await apiRequest(`/experiments/${experimentId}/analyze`);
    const analysisDiv = document.getElementById('behaviorAnalysis');
    
    if (result.error || result.status === 'insufficient_data') {
        analysisDiv.innerHTML = '<p class="empty-text">数据不足，无法进行完整分析</p>';
        return;
    }
    
    let html = '<div class="behavior-card">';
    html += '<div class="behavior-title">行为检测</div>';
    
    html += '<div class="behavior-item">';
    html += `<span class="behavior-indicator ${result.oscillating ? 'indicator-warning' : 'indicator-positive'}"></span>`;
    html += `震荡: ${result.oscillating ? '是 (可能需要调整学习率)' : '否'}`;
    html += '</div>';
    
    html += '<div class="behavior-item">';
    html += `<span class="behavior-indicator ${result.converging ? 'indicator-positive' : 'indicator-neutral'}"></span>`;
    html += `收敛: ${result.converging ? '是 (正在收敛)' : '否 (继续观察)'}`;
    html += '</div>';
    
    html += '<div class="behavior-item">';
    html += `<span class="behavior-indicator ${result.stagnant ? 'indicator-negative' : 'indicator-positive'}"></span>`;
    html += `停滞: ${result.stagnant ? '是 (可能需要调整参数)' : '否'}`;
    html += '</div>';
    
    html += `<div class="behavior-item">`;
    html += `<span class="behavior-indicator indicator-neutral"></span>`;
    html += `Loss 趋势: ${result.loss_trend}`;
    html += '</div>';
    
    html += `<div class="behavior-item">`;
    html += `<span class="behavior-indicator indicator-neutral"></span>`;
    html += `最终 Loss: ${result.final_loss?.toFixed(6) || 'N/A'}`;
    html += '</div>';
    
    html += '</div>';
    
    if (result.analysis && result.analysis.length > 0) {
        html += '<div class="behavior-card">';
        html += '<div class="behavior-title">详细分析</div>';
        result.analysis.forEach(a => {
            html += `<p>${a}</p>`;
        });
        html += '</div>';
    }
    
    analysisDiv.innerHTML = html;
}

async function updateTrainingLog(experimentId) {
    const experiment = experimentsCache[experimentId];
    if (!experiment) return;
    
    const history = experiment.history || {};
    const losses = history.loss || [];
    const logDiv = document.getElementById('trainingLog');
    
    if (losses.length === 0) {
        logDiv.innerHTML = '<p class="empty-text">运行实验后查看详细日志</p>';
        return;
    }
    
    let logText = '';
    const step = Math.max(1, Math.floor(losses.length / 50));
    
    for (let i = 0; i < losses.length; i += step) {
        logText += `[Epoch ${i + 1}] Loss: ${losses[i].toFixed(8)}\n`;
    }
    
    if ((losses.length - 1) % step !== 0) {
        logText += `[Epoch ${losses.length}] Loss: ${losses[losses.length - 1].toFixed(8)}\n`;
    }
    
    logDiv.innerHTML = logText;
}

async function updateExperimentList() {
    const result = await apiRequest('/experiments');
    const listDiv = document.getElementById('experimentList');
    
    if (result.error || result.length === 0) {
        listDiv.innerHTML = '<p class="empty-text">暂无实验</p>';
        return;
    }
    
    let html = '';
    result.forEach(exp => {
        experimentsCache[exp.id] = exp;
        
        const isSelected = selectedExperimentIds.has(exp.id);
        const isCurrent = exp.id === currentExperimentId;
        
        let statusClass = 'status-pending';
        let statusText = '未开始';
        
        if (exp.is_completed) {
            statusClass = 'status-completed';
            statusText = '已完成';
        } else if (exp.is_running) {
            statusClass = 'status-running';
            statusText = '运行中';
        }
        
        html += `
            <div class="experiment-item ${isCurrent ? 'selected' : ''}" data-id="${exp.id}">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleExperimentSelection('${exp.id}')">
                <div class="experiment-item-content" onclick="selectExperiment('${exp.id}')">
                    <div class="experiment-item-name">${exp.name}</div>
                    <div class="experiment-item-meta">${exp.optimizer_type} | Epoch: ${exp.current_epoch}</div>
                </div>
                <span class="experiment-item-status ${statusClass}">${statusText}</span>
            </div>
        `;
    });
    
    listDiv.innerHTML = html;
    updateButtons();
}

function toggleExperimentSelection(experimentId) {
    if (selectedExperimentIds.has(experimentId)) {
        selectedExperimentIds.delete(experimentId);
    } else {
        selectedExperimentIds.add(experimentId);
    }
    updateButtons();
}

async function selectExperiment(experimentId) {
    currentExperimentId = experimentId;
    await updateExperimentVisualization(experimentId);
    updateExperimentList();
}

function updateButtons() {
    const hasExperiment = currentExperimentId !== null;
    const hasMultipleSelected = selectedExperimentIds.size >= 2;
    
    document.getElementById('startExperiment').disabled = !hasExperiment;
    document.getElementById('stepExperiment').disabled = !hasExperiment;
    document.getElementById('compareExperiments').disabled = !hasMultipleSelected;
    document.getElementById('exportReport').disabled = !hasExperiment;
    document.getElementById('exportComparisonReport').disabled = !hasMultipleSelected;
}

function showWarnings(warnings) {
    const warningsDiv = document.getElementById('warnings');
    const warningsList = document.getElementById('warningsList');
    
    warningsList.innerHTML = warnings.map(w => `<li>⚠️ ${w[0]}: ${w[1]}</li>`).join('');
    warningsDiv.style.display = 'block';
}

function hideWarnings() {
    document.getElementById('warnings').style.display = 'none';
}

async function compareExperiments() {
    if (selectedExperimentIds.size < 2) return;
    
    const ids = Array.from(selectedExperimentIds);
    const result = await apiRequest('/experiments/compare', 'POST', { experiment_ids: ids });
    
    if (result.error) {
        alert('对比失败: ' + result.message);
        return;
    }
    
    updateComparisonUI(result);
}

function updateComparisonUI(comparison) {
    const resultDiv = document.getElementById('comparisonResult');
    
    if (comparison.metrics && comparison.metrics.length > 0) {
        let html = '<table class="comparison-table">';
        html += '<tr><th>排名</th><th>实验名称</th><th>优化器</th><th>最终 Loss</th><th>Loss 减少</th><th>减少比例</th><th>震荡率</th></tr>';
        
        comparison.metrics.forEach((metric, index) => {
            const rankClass = index < 3 ? `rank-${index + 1}` : '';
            html += `<tr class="${rankClass}">`;
            html += `<td>${index + 1}</td>`;
            html += `<td>${metric.experiment_name}</td>`;
            html += `<td>${metric.optimizer_type}</td>`;
            html += `<td>${metric.final_loss.toFixed(6)}</td>`;
            html += `<td>${metric.loss_reduction.toFixed(6)}</td>`;
            html += `<td>${(metric.loss_reduction_ratio * 100).toFixed(2)}%</td>`;
            html += `<td>${(metric.oscillation_ratio * 100).toFixed(2)}%</td>`;
            html += '</tr>';
        });
        
        html += '</table>';
        resultDiv.innerHTML = html;
    }
    
    if (comparison.loss_comparison) {
        updateComparisonChart(comparison.loss_comparison);
    }
}

function updateComparisonChart(lossComparison) {
    if (!charts.comparisonChart) return;
    
    const colors = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    const datasets = [];
    let maxEpochs = 0;
    
    Object.keys(lossComparison).forEach((expId, index) => {
        const data = lossComparison[expId];
        datasets.push({
            label: `${data.name} (${data.optimizer})`,
            data: data.losses,
            borderColor: colors[index % colors.length],
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false
        });
        
        if (data.losses.length > maxEpochs) {
            maxEpochs = data.losses.length;
        }
    });
    
    charts.comparisonChart.data.labels = Array.from({ length: maxEpochs }, (_, i) => i + 1);
    charts.comparisonChart.data.datasets = datasets;
    charts.comparisonChart.update();
}

async function saveAllExperiments() {
    const result = await apiRequest('/experiments/save_all', 'POST');
    if (result.error) {
        alert('保存失败: ' + result.message);
    } else {
        alert(`成功保存 ${result.saved} 个实验`);
    }
}

async function loadAllExperiments() {
    const result = await apiRequest('/experiments/load_all', 'POST');
    if (result.error) {
        alert('加载失败: ' + result.message);
    } else {
        alert(`成功加载 ${result.loaded} 个实验`);
        updateExperimentList();
    }
}

async function exportReport() {
    if (!currentExperimentId) return;
    
    const format = document.getElementById('reportFormat').value;
    const includeHistory = document.getElementById('includeHistory').checked;
    const includeAnalysis = document.getElementById('includeAnalysis').checked;
    
    const result = await apiRequest(`/experiments/${currentExperimentId}/report`, 'POST', {
        format,
        include_history: includeHistory,
        include_analysis: includeAnalysis
    });
    
    if (result.error) {
        alert('导出失败: ' + result.message);
        return;
    }
    
    document.getElementById('reportPreview').innerHTML = format === 'json' 
        ? `<pre>${JSON.stringify(result.report, null, 2)}</pre>`
        : `<pre>${result.report}</pre>`;
    
    alert(`报告已保存到: ${result.filepath}`);
}

async function exportComparisonReport() {
    if (selectedExperimentIds.size < 2) return;
    
    const format = document.getElementById('comparisonReportFormat').value;
    const ids = Array.from(selectedExperimentIds);
    
    const result = await apiRequest('/experiments/compare_report', 'POST', {
        experiment_ids: ids,
        format
    });
    
    if (result.error) {
        alert('导出失败: ' + result.message);
        return;
    }
    
    document.getElementById('reportPreview').innerHTML = format === 'json' 
        ? `<pre>${JSON.stringify(result.report, null, 2)}</pre>`
        : `<pre>${result.report}</pre>`;
    
    alert(`对比报告已保存到: ${result.filepath}`);
}
