// 全局状态
let currentSessionId = null;
let currentData = null;
let currentQuadratId = null;

// DOM 元素
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initFileInputs();
    initEventListeners();
    loadSessions();
});

// 标签切换
function initTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新面板显示
            panels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `${tabId}-panel`) {
                    panel.classList.add('active');
                }
            });
        });
    });
}

// 文件输入处理
function initFileInputs() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const label = this.nextElementSibling;
            if (this.files.length > 0) {
                if (this.multiple) {
                    label.textContent = `已选择 ${this.files.length} 个文件`;
                } else {
                    label.textContent = this.files[0].name;
                }
                label.classList.add('has-file');
            } else {
                label.textContent = label.dataset.default || '选择文件';
                label.classList.remove('has-file');
            }
        });
    });
}

// 事件监听器
function initEventListeners() {
    // 上传按钮
    document.getElementById('upload-btn').addEventListener('click', uploadAndAnalyze);
    
    // 加载示例数据
    document.getElementById('load-sample-btn').addEventListener('click', loadSampleData);
    
    // 样方筛选
    document.getElementById('quadrat-filter').addEventListener('change', filterQuadrats);
    
    // 模态框关闭按钮
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
    });
    
    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // 保存复核
    document.getElementById('save-review-btn').addEventListener('click', saveReview);
    
    // 导出按钮
    document.getElementById('export-md-btn').addEventListener('click', exportMarkdown);
    document.getElementById('export-json-btn').addEventListener('click', exportJson);
    
    // 上传更多照片
    document.getElementById('upload-more-photos-btn').addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = function() {
            if (this.files.length > 0) {
                uploadMorePhotos(this.files);
            }
        };
        input.click();
    });
}

// 显示 Toast 通知
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 显示/隐藏加载状态
function showProgress(show = true) {
    const progress = document.getElementById('upload-progress');
    progress.style.display = show ? 'block' : 'none';
    
    const uploadBtn = document.getElementById('upload-btn');
    const sampleBtn = document.getElementById('load-sample-btn');
    
    if (show) {
        uploadBtn.disabled = true;
        sampleBtn.disabled = true;
        uploadBtn.classList.add('loading');
    } else {
        uploadBtn.disabled = false;
        sampleBtn.disabled = false;
        uploadBtn.classList.remove('loading');
    }
}

// 上传并分析数据
async function uploadAndAnalyze() {
    const speciesFile = document.getElementById('species-file').files[0];
    const envFile = document.getElementById('env-file').files[0];
    const photoFiles = document.getElementById('photo-files').files;
    const notes = document.getElementById('manual-notes').value;
    
    if (!speciesFile || !envFile) {
        showToast('请选择物种CSV和环境参数CSV文件', 'error');
        return;
    }
    
    showProgress(true);
    
    const formData = new FormData();
    formData.append('species_file', speciesFile);
    formData.append('env_file', envFile);
    formData.append('notes', notes);
    
    // 添加照片文件
    for (let i = 0; i < photoFiles.length; i++) {
        formData.append('photo_files', photoFiles[i]);
    }
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentSessionId = result.session_id;
            currentData = result.data;
            
            showToast('数据上传和分析成功！', 'success');
            updateAnalysisUI();
            switchToTab('analysis');
            
            // 刷新会话列表
            loadSessions();
        } else {
            showToast(result.error || '上传失败', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('上传过程中发生错误', 'error');
    } finally {
        showProgress(false);
    }
}

// 加载示例数据
async function loadSampleData() {
    showProgress(true);
    
    try {
        const response = await fetch('/api/sample-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentSessionId = result.session_id;
            currentData = result.data;
            
            showToast('示例数据加载成功！', 'success');
            updateAnalysisUI();
            switchToTab('analysis');
            
            // 刷新会话列表
            loadSessions();
        } else {
            showToast(result.error || '加载示例数据失败', 'error');
        }
    } catch (error) {
        console.error('Sample data error:', error);
        showToast('加载示例数据时发生错误', 'error');
    } finally {
        showProgress(false);
    }
}

// 加载会话列表
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const result = await response.json();
        
        if (result.success) {
            renderSessionsList(result.sessions);
        }
    } catch (error) {
        console.error('Load sessions error:', error);
    }
}

// 渲染会话列表
function renderSessionsList(sessions) {
    const container = document.getElementById('sessions-list');
    
    if (sessions.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无历史会话</p>';
        return;
    }
    
    container.innerHTML = sessions.map(session => `
        <div class="session-card">
            <div class="session-info">
                <div class="session-time">${formatDateTime(session.analysis_time)}</div>
                <div class="session-stats">
                    <div class="session-stat">
                        <span class="session-stat-value">${session.total_quadrats}</span>
                        <span class="session-stat-label">样方数</span>
                    </div>
                    <div class="session-stat">
                        <span class="session-stat-value">${session.total_species}</span>
                        <span class="session-stat-label">物种数</span>
                    </div>
                    <div class="session-stat">
                        <span class="session-stat-value ${session.flagged_count > 0 ? 'warning' : ''}">${session.flagged_count}</span>
                        <span class="session-stat-label">需关注</span>
                    </div>
                </div>
            </div>
            <div class="session-actions">
                <button class="btn btn-primary" onclick="loadSession('${session.session_id}')">
                    查看
                </button>
                <button class="btn btn-danger" onclick="deleteSession('${session.session_id}')">
                    删除
                </button>
            </div>
        </div>
    `).join('');
}

// 加载指定会话
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const result = await response.json();
        
        if (result.success) {
            currentSessionId = sessionId;
            currentData = result.data;
            
            updateAnalysisUI();
            switchToTab('analysis');
            showToast('会话加载成功', 'success');
        } else {
            showToast(result.error || '加载会话失败', 'error');
        }
    } catch (error) {
        console.error('Load session error:', error);
        showToast('加载会话时发生错误', 'error');
    }
}

// 删除会话
async function deleteSession(sessionId) {
    if (!confirm('确定要删除这个会话吗？此操作不可恢复。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('会话已删除', 'success');
            loadSessions();
            
            // 如果删除的是当前会话，清空显示
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                currentData = null;
                clearAnalysisUI();
            }
        } else {
            showToast(result.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('Delete session error:', error);
        showToast('删除会话时发生错误', 'error');
    }
}

// 更新分析UI
function updateAnalysisUI() {
    if (!currentData) return;
    
    // 显示分析内容
    document.getElementById('no-data-message').style.display = 'none';
    document.getElementById('analysis-content').style.display = 'block';
    document.getElementById('no-photos-message').style.display = 'none';
    document.getElementById('photos-content').style.display = 'block';
    document.getElementById('no-export-message').style.display = 'none';
    document.getElementById('export-content').style.display = 'block';
    
    // 更新概览卡片
    const summary = currentData.summary || {};
    const diversity = currentData.species_diversity || {};
    const overallStats = diversity.overall_stats || {};
    
    document.getElementById('total-quadrats').textContent = summary.total_quadrats || 0;
    document.getElementById('total-species').textContent = summary.total_species || 0;
    document.getElementById('flagged-count').textContent = currentData.flagged_count || 0;
    document.getElementById('avg-richness').textContent = overallStats.avg_richness || 0;
    
    // 更新异常检测摘要
    document.getElementById('invasive-count').textContent = summary.invasive_quadrats || 0;
    document.getElementById('missing-count').textContent = summary.missing_quadrats || 0;
    document.getElementById('mortality-count').textContent = summary.abnormal_mortality_quadrats || 0;
    document.getElementById('env-anomaly-count').textContent = summary.env_anomaly_quadrats || 0;
    
    // 渲染样方列表
    renderQuadratsList();
    
    // 渲染照片
    renderPhotos();
    
    // 更新报告预览
    updateReportPreview();
}

// 清空分析UI
function clearAnalysisUI() {
    document.getElementById('no-data-message').style.display = 'block';
    document.getElementById('analysis-content').style.display = 'none';
    document.getElementById('no-photos-message').style.display = 'block';
    document.getElementById('photos-content').style.display = 'none';
    document.getElementById('no-export-message').style.display = 'block';
    document.getElementById('export-content').style.display = 'none';
}

// 渲染样方列表
function renderQuadratsList() {
    const container = document.getElementById('quadrats-list');
    const speciesData = currentData.species_data || {};
    const quadrats = speciesData.quadrats || {};
    const reviewStatus = currentData.review_status || {};
    
    const filter = document.getElementById('quadrat-filter').value;
    
    let quadratIds = Object.keys(quadrats);
    
    // 筛选
    if (filter !== 'all') {
        const flagged = currentData.flagged_quadrats || [];
        const invasive = Object.keys(currentData.invasive_species?.invasive_quadrats || {});
        const missing = Object.keys(currentData.missing_data?.missing_quadrats || {});
        const mortality = Object.keys(currentData.abnormal_mortality?.abnormal_quadrats || {});
        const env = Object.keys(currentData.env_anomalies?.env_anomalies || {});
        
        switch (filter) {
            case 'flagged':
                quadratIds = flagged;
                break;
            case 'invasive':
                quadratIds = invasive;
                break;
            case 'missing':
                quadratIds = missing;
                break;
            case 'mortality':
                quadratIds = mortality;
                break;
            case 'env':
                quadratIds = env;
                break;
        }
    }
    
    if (quadratIds.length === 0) {
        container.innerHTML = '<p class="empty-message">没有符合条件的样方</p>';
        return;
    }
    
    container.innerHTML = quadratIds.map(quadratId => {
        const quadratData = quadrats[quadratId] || {};
        const status = reviewStatus[quadratId] || {};
        const flags = getQuadratFlags(quadratId);
        
        return `
            <div class="quadrat-card ${flags.length > 0 ? 'flagged' : ''}" onclick="openQuadratModal('${quadratId}')">
                <div class="quadrat-header">
                    <span class="quadrat-id">样方 ${quadratId}</span>
                    <span class="quadrat-status ${status.status || '未复核'}">${status.status || '未复核'}</span>
                </div>
                <div class="quadrat-body">
                    <div class="quadrat-stats">
                        <div class="quadrat-stat">
                            <span class="quadrat-stat-value">${quadratData.species_count || 0}</span>
                            <span class="quadrat-stat-label">物种数</span>
                        </div>
                        <div class="quadrat-stat">
                            <span class="quadrat-stat-value">${quadratData.total_individuals || 0}</span>
                            <span class="quadrat-stat-label">个体数</span>
                        </div>
                        <div class="quadrat-stat">
                            <span class="quadrat-stat-value">${getDiversityValue(quadratId, 'richness')}</span>
                            <span class="quadrat-stat-label">丰富度</span>
                        </div>
                    </div>
                    ${flags.length > 0 ? `
                        <div class="quadrat-flags">
                            ${flags.map(flag => `<span class="flag-tag ${flag.class}">${flag.label}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 获取样方标记
function getQuadratFlags(quadratId) {
    const flags = [];
    
    const invasive = currentData.invasive_species?.invasive_quadrats || {};
    const missing = currentData.missing_data?.missing_quadrats || {};
    const mortality = currentData.abnormal_mortality?.abnormal_quadrats || {};
    const env = currentData.env_anomalies?.env_anomalies || {};
    
    if (invasive[quadratId]) {
        flags.push({ class: 'invasive', label: '入侵种' });
    }
    if (missing[quadratId]) {
        flags.push({ class: 'missing', label: '缺测' });
    }
    if (mortality[quadratId]) {
        flags.push({ class: 'mortality', label: '异常死亡' });
    }
    if (env[quadratId]) {
        flags.push({ class: 'env', label: '环境异常' });
    }
    
    return flags;
}

// 获取多样性值
function getDiversityValue(quadratId, key) {
    const diversity = currentData.species_diversity?.quadrat_diversity || {};
    return diversity[quadratId]?.[key] || 0;
}

// 筛选样方
function filterQuadrats() {
    renderQuadratsList();
}

// 打开样方详情模态框
function openQuadratModal(quadratId) {
    currentQuadratId = quadratId;
    
    const modal = document.getElementById('quadrat-modal');
    modal.classList.add('active');
    
    // 填充模态框内容
    populateQuadratModal(quadratId);
}

// 填充样方模态框
function populateQuadratModal(quadratId) {
    document.getElementById('modal-quadrat-id').textContent = `样方 ${quadratId}`;
    
    // 基本信息
    const speciesData = currentData.species_data?.quadrats?.[quadratId] || {};
    const envData = currentData.env_data?.quadrat_env?.[quadratId] || {};
    const diversity = currentData.species_diversity?.quadrat_diversity?.[quadratId] || {};
    const reviewStatus = currentData.review_status?.[quadratId] || {};
    
    // 基本信息
    document.getElementById('modal-basic-info').innerHTML = `
        <div class="info-item">
            <div class="info-label">物种数</div>
            <div class="info-value">${speciesData.species_count || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">个体总数</div>
            <div class="info-value">${speciesData.total_individuals || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">丰富度</div>
            <div class="info-value">${diversity.richness || 0}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Simpson指数</div>
            <div class="info-value">${diversity.simpson_index || 0}</div>
        </div>
    `;
    
    // 异常检测
    const anomalies = [];
    const invasive = currentData.invasive_species?.invasive_quadrats?.[quadratId];
    const missing = currentData.missing_data?.missing_quadrats?.[quadratId];
    const mortality = currentData.abnormal_mortality?.abnormal_quadrats?.[quadratId];
    const env = currentData.env_anomalies?.env_anomalies?.[quadratId];
    
    if (invasive) {
        anomalies.push({
            type: 'invasive',
            icon: '🔴',
            title: '检测到入侵种',
            desc: invasive.invasive_species?.map(s => s.species_name).join(', ') || '未知'
        });
    }
    if (missing) {
        anomalies.push({
            type: 'missing',
            icon: '❓',
            title: '数据缺测',
            desc: missing.issues?.map(i => i.description).join('; ') || '未知'
        });
    }
    if (mortality) {
        anomalies.push({
            type: 'mortality',
            icon: '💀',
            title: '异常死亡',
            desc: mortality.abnormal_species?.map(s => s.species_name).join(', ') || '未知'
        });
    }
    if (env) {
        anomalies.push({
            type: 'env',
            icon: '🌡️',
            title: '环境异常',
            desc: env.anomalies?.map(a => a.description).join('; ') || '未知'
        });
    }
    
    const anomaliesContainer = document.getElementById('modal-anomalies');
    if (anomalies.length > 0) {
        anomaliesContainer.innerHTML = anomalies.map(a => `
            <div class="anomaly-item ${a.type}">
                <span class="anomaly-icon">${a.icon}</span>
                <div class="anomaly-text">
                    <div class="anomaly-title">${a.title}</div>
                    <div class="anomaly-desc">${a.desc}</div>
                </div>
            </div>
        `).join('');
    } else {
        anomaliesContainer.innerHTML = '<p style="color: var(--text-secondary);">无异常检测</p>';
    }
    
    // 物种列表
    const speciesList = speciesData.species || [];
    const invasiveSpeciesList = currentData.invasive_species?.invasive_quadrats?.[quadratId]?.invasive_species || [];
    const invasiveNames = invasiveSpeciesList.map(s => s.species_name);
    
    document.getElementById('modal-species').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>物种名称</th>
                    <th>数量</th>
                    <th>盖度</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>
                ${speciesList.map(s => `
                    <tr>
                        <td class="species-name ${invasiveNames.includes(s.species_name) ? 'invasive' : ''}">
                            ${s.species_name}
                            ${invasiveNames.includes(s.species_name) ? ' (入侵种)' : ''}
                        </td>
                        <td>${s.count || 0}</td>
                        <td>${s.coverage || '-'}</td>
                        <td>${s.notes || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // 环境参数
    const envAnomalies = currentData.env_anomalies?.env_anomalies?.[quadratId]?.anomalies || [];
    const anomalousParams = envAnomalies.map(a => a.type);
    
    document.getElementById('modal-env').innerHTML = `
        <div class="env-item">
            <div class="env-label">水温</div>
            <div class="env-value ${anomalousParams.includes('temperature') ? 'anomaly' : ''}">
                ${envData.water_temp !== undefined ? envData.water_temp + '°C' : '-'}
            </div>
        </div>
        <div class="env-item">
            <div class="env-label">盐度</div>
            <div class="env-value ${anomalousParams.includes('salinity') ? 'anomaly' : ''}">
                ${envData.salinity !== undefined ? envData.salinity + ' ppt' : '-'}
            </div>
        </div>
        <div class="env-item">
            <div class="env-label">pH值</div>
            <div class="env-value ${anomalousParams.includes('ph') ? 'anomaly' : ''}">
                ${envData.ph !== undefined ? envData.ph : '-'}
            </div>
        </div>
        <div class="env-item">
            <div class="env-label">溶解氧</div>
            <div class="env-value ${anomalousParams.includes('dissolved_oxygen') ? 'anomaly' : ''}">
                ${envData.dissolved_oxygen !== undefined ? envData.dissolved_oxygen + ' mg/L' : '-'}
            </div>
        </div>
    `;
    
    // 多样性分析
    const dominantSpecies = diversity.dominant_species || [];
    document.getElementById('modal-diversity').innerHTML = `
        <div class="diversity-item">
            <div class="diversity-value">${diversity.richness || 0}</div>
            <div class="diversity-label">物种丰富度</div>
        </div>
        <div class="diversity-item">
            <div class="diversity-value">${diversity.simpson_index || 0}</div>
            <div class="diversity-label">Simpson指数</div>
        </div>
        <div class="diversity-item">
            <div class="diversity-value">${diversity.shannon_index || 0}</div>
            <div class="diversity-label">Shannon指数</div>
        </div>
        <div class="diversity-item">
            <div class="diversity-value">${diversity.total_individuals || 0}</div>
            <div class="diversity-label">总个体数</div>
        </div>
    `;
    
    if (dominantSpecies.length > 0) {
        document.getElementById('modal-diversity').innerHTML += `
            <div style="grid-column: 1 / -1; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <strong>优势种：</strong>
                ${dominantSpecies.map(s => `${s.species_name} (${s.count}个)`).join('、')}
            </div>
        `;
    }
    
    // 复核状态
    document.getElementById('review-status').value = reviewStatus.status || '未复核';
    document.getElementById('review-notes').value = reviewStatus.notes || '';
}

// 保存复核
async function saveReview() {
    if (!currentSessionId || !currentQuadratId) {
        showToast('无法保存复核状态', 'error');
        return;
    }
    
    const status = document.getElementById('review-status').value;
    const notes = document.getElementById('review-notes').value;
    
    try {
        const response = await fetch(`/api/review/${currentSessionId}/${currentQuadratId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, notes })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 更新本地数据
            if (!currentData.review_status) {
                currentData.review_status = {};
            }
            currentData.review_status[currentQuadratId] = {
                status,
                notes,
                updated_at: new Date().toISOString()
            };
            
            showToast('复核状态已保存', 'success');
            renderQuadratsList();
            updateReportPreview();
            
            // 关闭模态框
            document.getElementById('quadrat-modal').classList.remove('active');
        } else {
            showToast(result.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('Save review error:', error);
        showToast('保存复核时发生错误', 'error');
    }
}

// 渲染照片
function renderPhotos() {
    const photos = currentData.photos || [];
    const container = document.getElementById('photos-grid');
    
    if (photos.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无照片</p>';
        return;
    }
    
    container.innerHTML = photos.map(photo => `
        <div class="photo-item" onclick="openPhotoModal('${photo.path}', '${photo.filename}')">
            <img src="${photo.path}" alt="${photo.filename}">
            <div class="photo-overlay">${photo.filename}</div>
        </div>
    `).join('');
}

// 打开照片模态框
function openPhotoModal(path, filename) {
    document.getElementById('photo-modal-image').src = path;
    document.getElementById('photo-modal-title').textContent = filename;
    document.getElementById('photo-modal').classList.add('active');
}

// 上传更多照片
async function uploadMorePhotos(files) {
    if (!currentSessionId) {
        showToast('请先选择或创建会话', 'error');
        return;
    }
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('photo_files', files[i]);
    }
    
    try {
        const response = await fetch(`/api/photos/${currentSessionId}`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 更新本地数据
            if (!currentData.photos) {
                currentData.photos = [];
            }
            currentData.photos.push(...result.photos);
            
            showToast(result.message, 'success');
            renderPhotos();
        } else {
            showToast(result.error || '上传失败', 'error');
        }
    } catch (error) {
        console.error('Upload photos error:', error);
        showToast('上传照片时发生错误', 'error');
    }
}

// 更新报告预览
function updateReportPreview() {
    if (!currentData) return;
    
    const summary = currentData.summary || {};
    const flagged = currentData.flagged_quadrats || [];
    
    let preview = `# 潮间带样方巡护复盘报告预览

## 基本信息
- 分析时间: ${currentData.analysis_time || '未知'}
- 总样方数: ${summary.total_quadrats || 0}
- 总物种数: ${summary.total_species || 0}

## 异常检测摘要
- 入侵种检测: ${summary.invasive_quadrats || 0} 个样方
- 数据缺测: ${summary.missing_quadrats || 0} 个样方
- 异常死亡: ${summary.abnormal_mortality_quadrats || 0} 个样方
- 环境异常: ${summary.env_anomaly_quadrats || 0} 个样方

## 需要关注的样方 (${flagged.length} 个)
`;
    
    if (flagged.length > 0) {
        const reviewStatus = currentData.review_status || {};
        flagged.forEach(qid => {
            const status = reviewStatus[qid]?.status || '未复核';
            preview += `- 样方 ${qid}: ${status}\n`;
        });
    } else {
        preview += '无需要关注的样方\n';
    }
    
    document.getElementById('report-preview-content').textContent = preview;
}

// 导出 Markdown
function exportMarkdown() {
    if (!currentSessionId) {
        showToast('请先选择会话', 'error');
        return;
    }
    
    // 创建隐藏的链接下载
    const link = document.createElement('a');
    link.href = `/api/export/markdown/${currentSessionId}`;
    link.download = `intertidal_report_${currentSessionId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Markdown 报告导出中...', 'info');
}

// 导出 JSON
function exportJson() {
    if (!currentSessionId) {
        showToast('请先选择会话', 'error');
        return;
    }
    
    // 创建隐藏的链接下载
    const link = document.createElement('a');
    link.href = `/api/export/json/${currentSessionId}`;
    link.download = `intertidal_detail_${currentSessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('JSON 明细导出中...', 'info');
}

// 切换到指定标签
function switchToTab(tabId) {
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    if (btn) {
        btn.click();
    }
}

// 格式化日期时间
function formatDateTime(isoString) {
    if (!isoString) return '未知';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return isoString;
    }
}
