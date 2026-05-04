const API_BASE = '/api';

let currentCorpusPage = 1;
let currentHistoryPage = 1;
let similarityChart = null;
let currentQueryRecordId = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUpload();
    initEvents();
    loadCorpusStats();
    loadCorpus(1);
    loadVectorVersions();
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const analysisName = btn.dataset.analysis;
            
            document.querySelectorAll('.analysis-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.analysis-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${analysisName}-analysis`).classList.add('active');
        });
    });
}

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
}

function initEvents() {
    document.getElementById('addDocBtn').addEventListener('click', addDocument);
    
    document.getElementById('vectorizationSelect').addEventListener('change', (e) => {
        const embeddingGroup = document.getElementById('embeddingDimGroup');
        embeddingGroup.style.display = e.target.value === 'embedding' ? 'block' : 'none';
    });
    
    document.getElementById('vectorizeBtn').addEventListener('click', vectorizeCorpus);
    
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    
    document.getElementById('loadMatrixBtn').addEventListener('click', loadSimilarityMatrix);
    
    document.getElementById('analyzeDimensionBtn').addEventListener('click', analyzeDimensions);
    
    document.getElementById('evaluateBtn').addEventListener('click', evaluateQueries);
    
    document.getElementById('exportReportBtn').addEventListener('click', exportReport);
    
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });
}

async function apiRequest(url, options = {}) {
    const response = await fetch(API_BASE + url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    return response.json();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(API_BASE + '/corpus/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showToast(data.data.message, 'success');
            loadCorpusStats();
            loadCorpus(1);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('上传失败: ' + error.message, 'error');
    }
}

async function addDocument() {
    const docId = document.getElementById('newDocId').value.trim();
    const content = document.getElementById('newDocContent').value.trim();

    if (!content) {
        showToast('请输入文档内容', 'warning');
        return;
    }

    const payload = { content };
    if (docId) payload.doc_id = docId;

    try {
        const data = await apiRequest('/corpus', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (data.success) {
            showToast('文档添加成功', 'success');
            document.getElementById('newDocId').value = '';
            document.getElementById('newDocContent').value = '';
            loadCorpusStats();
            loadCorpus(1);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

async function loadCorpusStats() {
    try {
        const data = await apiRequest('/corpus/stats');
        if (data.success) {
            const stats = data.data;
            document.getElementById('totalDocs').textContent = stats.total_docs;
            document.getElementById('totalTokens').textContent = stats.total_tokens;
            document.getElementById('avgLength').textContent = stats.avg_doc_length.toFixed(1);
            document.getElementById('vocabSize').textContent = stats.vocab_size;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadCorpus(page) {
    currentCorpusPage = page;
    try {
        const data = await apiRequest(`/corpus?page=${page}&per_page=10`);
        if (data.success) {
            renderCorpusTable(data.data);
            renderCorpusPagination(data.data);
        }
    } catch (error) {
        showToast('加载语料库失败', 'error');
    }
}

function renderCorpusTable(data) {
    const tbody = document.getElementById('corpusTableBody');
    
    if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">暂无文档，请上传或添加文档</td></tr>';
        return;
    }

    tbody.innerHTML = data.items.map(doc => `
        <tr>
            <td>${escapeHtml(doc.doc_id)}</td>
            <td>${escapeHtml(doc.content.substring(0, 100))}${doc.content.length > 100 ? '...' : ''}</td>
            <td>
                <button class="btn btn-secondary" onclick="viewDocument(${doc.id})">查看</button>
                <button class="btn btn-danger" onclick="deleteDocument(${doc.id})">删除</button>
            </td>
        </tr>
    `).join('');
}

function renderCorpusPagination(data) {
    const pagination = document.getElementById('corpusPagination');
    
    if (data.pages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = `<button onclick="loadCorpus(${data.page - 1})" ${data.page <= 1 ? 'disabled' : ''}>上一页</button>`;
    
    for (let i = 1; i <= data.pages; i++) {
        if (i === 1 || i === data.pages || (i >= data.page - 2 && i <= data.page + 2)) {
            html += `<button onclick="loadCorpus(${i})" class="${i === data.page ? 'active' : ''}">${i}</button>`;
        } else if (i === data.page - 3 || i === data.page + 3) {
            html += '<span>...</span>';
        }
    }
    
    html += `<button onclick="loadCorpus(${data.page + 1})" ${data.page >= data.pages ? 'disabled' : ''}>下一页</button>`;
    
    pagination.innerHTML = html;
}

async function viewDocument(id) {
    try {
        const data = await apiRequest(`/corpus/${id}`);
        if (data.success) {
            const doc = data.data;
            showModal('文档详情', `
                <div class="form-group">
                    <label>文档ID</label>
                    <p>${escapeHtml(doc.doc_id)}</p>
                </div>
                <div class="form-group">
                    <label>内容</label>
                    <p style="white-space: pre-wrap;">${escapeHtml(doc.content)}</p>
                </div>
                <div class="form-group">
                    <label>创建时间</label>
                    <p>${doc.created_at || '-'}</p>
                </div>
            `);
        }
    } catch (error) {
        showToast('加载文档失败', 'error');
    }
}

async function deleteDocument(id) {
    if (!confirm('确定要删除这个文档吗？')) return;

    try {
        const response = await fetch(API_BASE + `/corpus/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            showToast('文档已删除', 'success');
            loadCorpusStats();
            loadCorpus(currentCorpusPage);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('删除失败', 'error');
    }
}

async function loadVectorVersions() {
    try {
        const data = await apiRequest('/vector-versions');
        if (data.success && data.data.length > 0) {
            renderVectorVersions(data.data);
        } else {
            document.getElementById('versionList').innerHTML = '<p class="empty-state">暂无历史版本</p>';
        }
    } catch (error) {
        console.error('Failed to load versions:', error);
    }
}

function renderVectorVersions(versions) {
    const list = document.getElementById('versionList');
    list.innerHTML = versions.map(v => `
        <div class="version-item">
            <div class="version-info">
                <h4>${escapeHtml(v.version_name)}</h4>
                <p>
                    ${v.vectorization.toUpperCase()} | 
                    分词: ${v.tokenizer} | 
                    维度: ${v.dimensions} | 
                    词汇: ${v.vocabulary_size}
                </p>
                <p class="text-sm">${v.created_at || '-'}</p>
            </div>
        </div>
    `).join('');
}

async function vectorizeCorpus() {
    const btn = document.getElementById('vectorizeBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 向量化中...';

    const payload = {
        tokenizer: document.getElementById('tokenizerSelect').value,
        stopword_lang: document.getElementById('stopwordLangSelect').value,
        vectorization: document.getElementById('vectorizationSelect').value,
        normalize: document.getElementById('normalizeCheck').checked,
        version_name: document.getElementById('versionName').value || undefined
    };

    if (payload.vectorization === 'embedding') {
        payload.embedding_dim = parseInt(document.getElementById('embeddingDim').value);
    }

    const customStopwords = document.getElementById('customStopwords').value.trim();
    if (customStopwords) {
        payload.custom_stopwords = customStopwords.split('\n').map(w => w.trim()).filter(w => w);
    }

    try {
        const data = await apiRequest('/vectorize', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (data.success) {
            showToast('向量化完成', 'success');
            
            const result = data.data;
            document.getElementById('vectorizationResult').style.display = 'block';
            document.getElementById('vectorDimensions').textContent = result.dimensions;
            document.getElementById('vocabularySize').textContent = result.vocabulary_size;
            document.getElementById('versionResult').textContent = result.vector_version.version_name;
            
            loadVectorVersions();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('向量化失败: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 开始向量化';
    }
}

async function performSearch() {
    const query = document.getElementById('searchQuery').value.trim();
    const topK = parseInt(document.getElementById('topK').value);

    if (!query) {
        showToast('请输入查询文本', 'warning');
        return;
    }

    try {
        const data = await apiRequest('/search', {
            method: 'POST',
            body: JSON.stringify({ query, top_k: topK })
        });

        if (data.success) {
            renderSearchResults(data.data);
            currentQueryRecordId = data.data.query_record_id;
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('检索失败: ' + error.message, 'error');
    }
}

function renderSearchResults(data) {
    const container = document.getElementById('searchResults');
    container.style.display = 'block';

    document.getElementById('queryInfo').innerHTML = `
        <p><strong>查询:</strong> ${escapeHtml(data.query)}</p>
        <p><strong>Top-K:</strong> ${data.top_k} | <strong>结果数:</strong> ${data.results.length}</p>
    `;

    const resultList = document.getElementById('resultList');
    
    if (data.results.length === 0) {
        resultList.innerHTML = '<p class="empty-state">未找到相关文档</p>';
        return;
    }

    resultList.innerHTML = data.results.map((result, index) => `
        <div class="result-item-card">
            <div class="result-rank">${result.rank}</div>
            <div class="result-content">
                <div class="result-score">
                    相似度: <strong>${(result.similarity_score * 100).toFixed(2)}%</strong>
                    (${result.similarity_score.toFixed(4)})
                </div>
                <div class="result-text">${escapeHtml(result.content)}</div>
                <div class="annotation-buttons">
                    <span style="margin-right: 10px;">相关性标注:</span>
                    <button class="anno-btn anno-3" onclick="annotate(${data.query_record_id}, ${result.id}, 3, this)">3 - 高度相关</button>
                    <button class="anno-btn anno-2" onclick="annotate(${data.query_record_id}, ${result.id}, 2, this)">2 - 相关</button>
                    <button class="anno-btn anno-1" onclick="annotate(${data.query_record_id}, ${result.id}, 1, this)">1 - 部分相关</button>
                    <button class="anno-btn anno-0" onclick="annotate(${data.query_record_id}, ${result.id}, 0, this)">0 - 不相关</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function annotate(queryRecordId, corpusId, relevance, btn) {
    try {
        const data = await apiRequest('/annotations', {
            method: 'POST',
            body: JSON.stringify({
                query_record_id: queryRecordId,
                corpus_id: corpusId,
                relevance: relevance
            })
        });

        if (data.success) {
            const parent = btn.parentElement;
            parent.querySelectorAll('.anno-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            showToast('标注已保存', 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('标注失败: ' + error.message, 'error');
    }
}

async function loadSimilarityMatrix() {
    const limit = parseInt(document.getElementById('matrixLimit').value);

    try {
        const data = await apiRequest(`/similarity-matrix?limit=${limit}`);
        
        if (data.success) {
            renderSimilarityMatrix(data.data.matrix);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('加载相似度矩阵失败: ' + error.message, 'error');
    }
}

function renderSimilarityMatrix(matrix) {
    const ctx = document.getElementById('similarityChart').getContext('2d');
    
    if (similarityChart) {
        similarityChart.destroy();
    }

    const n = matrix.length;
    const labels = Array.from({ length: n }, (_, i) => `D${i + 1}`);

    const datasets = matrix.map((row, i) => ({
        label: `Doc ${i + 1}`,
        data: row,
        backgroundColor: row.map(val => {
            const alpha = val * 0.8 + 0.2;
            return `rgba(79, 70, 229, ${alpha})`;
        }),
        borderColor: 'rgba(79, 70, 229, 1)',
        borderWidth: 1
    }));

    similarityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    title: {
                        display: true,
                        text: '余弦相似度'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '文档'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `文档相似度矩阵 (${n}x${n})`
                },
                legend: {
                    display: n <= 10
                }
            }
        }
    });
}

async function analyzeDimensions() {
    const query = document.getElementById('dimensionQuery').value.trim();
    const topK = parseInt(document.getElementById('topFeatures').value);

    const payload = { top_k: topK };
    if (query) {
        payload.query = query;
    }
    payload.include_corpus = true;

    try {
        const data = await apiRequest('/dimension-analysis', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (data.success) {
            renderDimensionAnalysis(data.data);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('分析失败: ' + error.message, 'error');
    }
}

function renderDimensionAnalysis(data) {
    const container = document.getElementById('dimensionResults');
    let html = '';

    if (data.query_impact) {
        const qi = data.query_impact;
        html += `<h3>查询维度贡献分析</h3>`;
        
        if (qi.type === 'tfidf') {
            html += `
                <p><strong>总维度数:</strong> ${qi.total_dimensions} | 
                <strong>非零维度:</strong> ${qi.non_zero_dimensions}</p>
                <div class="feature-list">
            `;
            
            const maxWeight = qi.top_features[0]?.weight || 1;
            qi.top_features.forEach((feat, index) => {
                const width = (feat.weight / maxWeight * 100).toFixed(1);
                html += `
                    <div class="feature-item">
                        <span class="feature-rank">${index + 1}</span>
                        <span class="feature-name">${escapeHtml(feat.feature)}</span>
                        <span class="feature-weight">${feat.weight.toFixed(4)}</span>
                    </div>
                    <div class="feature-bar">
                        <div class="feature-bar-fill" style="width: ${width}%"></div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += `
                <p><strong>总维度数:</strong> ${qi.total_dimensions}</p>
                <div class="feature-list">
            `;
            
            const maxSim = qi.top_tokens[0]?.similarity || 1;
            qi.top_tokens.forEach((token, index) => {
                const width = ((token.similarity + 1) / 2 * 100).toFixed(1);
                html += `
                    <div class="feature-item">
                        <span class="feature-rank">${index + 1}</span>
                        <span class="feature-name">${escapeHtml(token.token)}</span>
                        <span class="feature-weight">${token.similarity.toFixed(4)}</span>
                    </div>
                    <div class="feature-bar">
                        <div class="feature-bar-fill" style="width: ${width}%"></div>
                    </div>
                `;
            });
            html += '</div>';
        }
    }

    if (data.corpus_analysis) {
        const ca = data.corpus_analysis;
        html += `<h3 style="margin-top: 30px;">语料库维度统计</h3>`;
        html += `
            <p><strong>总维度数:</strong> ${ca.total_dimensions} | 
            <strong>文档数:</strong> ${ca.num_documents} |
            <strong>平均向量模长:</strong> ${ca.mean_vector_magnitude.toFixed(4)}</p>
        `;
        
        if (ca.sparsity !== null) {
            html += `<p><strong>稀疏度:</strong> ${(ca.sparsity * 100).toFixed(2)}%</p>`;
        }

        html += '<h4>方差最大的维度</h4>';
        html += '<div class="feature-list">';
        
        const maxVar = ca.top_variance_dimensions[0]?.variance || 1;
        ca.top_variance_dimensions.forEach((dim, index) => {
            const width = (dim.variance / maxVar * 100).toFixed(1);
            const name = dim.feature || `维度 ${dim.dimension}`;
            html += `
                <div class="feature-item">
                    <span class="feature-rank">${index + 1}</span>
                    <span class="feature-name">${escapeHtml(name)}</span>
                    <span class="feature-weight">${dim.variance.toFixed(4)}</span>
                </div>
                <div class="feature-bar">
                    <div class="feature-bar-fill" style="width: ${width}%"></div>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

async function evaluateQueries() {
    const topK = parseInt(document.getElementById('evalTopK').value);

    try {
        const data = await apiRequest('/evaluate', {
            method: 'POST',
            body: JSON.stringify({ top_k: topK })
        });

        if (data.success) {
            renderEvaluationResults(data.data);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('评估失败: ' + error.message, 'error');
    }
}

function renderEvaluationResults(metrics) {
    const container = document.getElementById('evalResults');
    container.style.display = 'block';

    document.getElementById('metricPrecision').textContent = (metrics.avg_precision * 100).toFixed(2) + '%';
    document.getElementById('metricRecall').textContent = (metrics.avg_recall * 100).toFixed(2) + '%';
    document.getElementById('metricF1').textContent = (metrics.avg_f1 * 100).toFixed(2) + '%';
    document.getElementById('metricMAP').textContent = (metrics.map * 100).toFixed(2) + '%';
    document.getElementById('metricMRR').textContent = (metrics.mrr * 100).toFixed(2) + '%';
    document.getElementById('metricNDCG').textContent = (metrics.avg_ndcg * 100).toFixed(2) + '%';
}

async function exportReport() {
    const format = confirm('点击确定导出 Markdown 格式，取消导出 JSON 格式') ? 'markdown' : 'json';
    
    try {
        const response = await fetch(API_BASE + '/export/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                format: format,
                include_evaluation: true,
                include_similarity_matrix: false,
                include_dimension_analysis: false
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${new Date().toISOString().slice(0, 10)}.${format === 'markdown' ? 'md' : 'json'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('报告导出成功', 'success');
        } else {
            const data = await response.json();
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('导出失败: ' + error.message, 'error');
    }
}

async function loadQueryHistory(page) {
    currentHistoryPage = page || 1;
    try {
        const data = await apiRequest(`/query-history?page=${currentHistoryPage}&per_page=20`);
        if (data.success) {
            renderQueryHistory(data.data);
        }
    } catch (error) {
        console.error('Failed to load history:', error);
    }
}

function renderQueryHistory(data) {
    const container = document.getElementById('historyList');
    
    if (data.items.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无查询历史</p>';
        return;
    }

    container.innerHTML = data.items.map(item => `
        <div class="history-item" onclick="loadQueryResults(${item.id})">
            <div class="history-query">${escapeHtml(item.query_text)}</div>
            <div class="history-meta">
                <span>Top-K: ${item.top_k}</span>
                <span>标注数: ${item.annotation_count}</span>
                <span>${item.created_at || '-'}</span>
            </div>
        </div>
    `).join('');
}

async function loadQueryResults(queryRecordId) {
    try {
        const annotations = await apiRequest(`/annotations/${queryRecordId}`);
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="search"]').classList.add('active');
        document.getElementById('search-tab').classList.add('active');
        
        showToast('请在检索页面查看详情', 'info');
    } catch (error) {
        console.error('Failed to load query:', error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
