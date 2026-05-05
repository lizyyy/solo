const API_BASE = '/api';

let currentBatch = null;
let currentBookId = null;
let notesTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFileUploads();
    initFilters();
    loadBatches();
    loadCategories();
});

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-section`).classList.add('active');
            
            if (targetTab === 'list' && currentBatch) {
                loadBooks();
            } else if (targetTab === 'review' && currentBatch) {
                loadPendingBooks();
            } else if (targetTab === 'export' && currentBatch) {
                loadExportStats();
            }
        });
    });
}

function initFileUploads() {
    const csvFile = document.getElementById('csvFile');
    const imageFiles = document.getElementById('imageFiles');
    const damageFile = document.getElementById('damageFile');
    const appointmentFile = document.getElementById('appointmentFile');

    if (csvFile) {
        csvFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentBatch) {
                await uploadCSV(file, 'csv');
            } else if (!currentBatch) {
                showToast('请先选择或创建批次', 'error');
            }
        });
    }

    if (imageFiles) {
        imageFiles.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length > 0 && currentBatch) {
                await uploadImages(files);
            } else if (!currentBatch) {
                showToast('请先选择或创建批次', 'error');
            }
        });
    }

    if (damageFile) {
        damageFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentBatch) {
                await uploadCSV(file, 'damage');
            } else if (!currentBatch) {
                showToast('请先选择或创建批次', 'error');
            }
        });
    }

    if (appointmentFile) {
        appointmentFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentBatch) {
                await uploadCSV(file, 'appointment');
            } else if (!currentBatch) {
                showToast('请先选择或创建批次', 'error');
            }
        });
    }
}

function initFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const reviewFilter = document.getElementById('reviewFilter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', loadBooks);
    }
    if (reviewFilter) {
        reviewFilter.addEventListener('change', loadBooks);
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        
        if (data.success) {
            console.log('Categories loaded:', data.data);
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE}/batches`);
        const data = await response.json();
        
        if (data.success) {
            renderBatchList(data.data);
        }
    } catch (error) {
        console.error('Failed to load batches:', error);
        showToast('加载批次列表失败', 'error');
    }
}

function renderBatchList(batches) {
    const batchList = document.getElementById('batchList');
    
    if (!batchList) return;
    
    if (batches.length === 0) {
        batchList.innerHTML = '<p class="empty-text">暂无批次，请创建新批次</p>';
        return;
    }
    
    batchList.innerHTML = batches.map(batch => `
        <div class="batch-item ${currentBatch && currentBatch.id === batch.id ? 'active' : ''}" 
             onclick="selectBatch(${JSON.stringify(batch).replace(/"/g, '&quot;')})">
            <div class="batch-item-info">
                <h5>${batch.batch_number}</h5>
                <p>${batch.description || '无描述'}</p>
            </div>
            <div class="batch-item-meta">
                ${batch.total_books || 0} 本书 · ${batch.total_appointments || 0} 预约
            </div>
        </div>
    `).join('');
}

function showBatchModal() {
    const modal = document.getElementById('batchModal');
    if (modal) {
        modal.classList.add('active');
        loadBatches();
    }
}

function closeBatchModal() {
    const modal = document.getElementById('batchModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function createBatch() {
    const batchNumber = document.getElementById('newBatchNumber');
    const batchDesc = document.getElementById('newBatchDesc');
    
    if (!batchNumber.value.trim()) {
        showToast('请输入批次号', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/batches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                batch_number: batchNumber.value.trim(),
                description: batchDesc.value.trim()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('批次创建成功');
            batchNumber.value = '';
            batchDesc.value = '';
            loadBatches();
        } else {
            showToast(data.error || '创建失败', 'error');
        }
    } catch (error) {
        console.error('Failed to create batch:', error);
        showToast('创建批次失败', 'error');
    }
}

function selectBatch(batch) {
    currentBatch = batch;
    
    const display = document.getElementById('currentBatchDisplay');
    if (display) {
        display.textContent = `批次: ${batch.batch_number}`;
        display.classList.add('active');
    }
    
    closeBatchModal();
    loadBatches();
    
    showToast(`已选择批次: ${batch.batch_number}`);
}

async function uploadCSV(file, type) {
    const statusId = type === 'csv' ? 'csvStatus' : 
                     type === 'damage' ? 'damageStatus' : 'appointmentStatus';
    const endpoint = type === 'csv' ? '/import/isbn-csv' :
                     type === 'damage' ? '/import/damage-notes' : '/import/appointments';
    
    const statusEl = document.getElementById(statusId);
    if (statusEl) {
        statusEl.className = 'import-status processing';
        statusEl.textContent = '正在上传...';
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_id', currentBatch.id);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (statusEl) {
                statusEl.className = 'import-status success';
                statusEl.textContent = `成功导入 ${data.data.imported} 条记录`;
            }
            showToast(`导入成功: ${data.data.imported} 条`);
        } else {
            if (statusEl) {
                statusEl.className = 'import-status error';
                statusEl.textContent = data.error || '导入失败';
            }
            showToast(data.error || '导入失败', 'error');
        }
    } catch (error) {
        console.error('Upload failed:', error);
        if (statusEl) {
            statusEl.className = 'import-status error';
            statusEl.textContent = '上传失败，请重试';
        }
        showToast('上传失败', 'error');
    }
}

async function uploadImages(files) {
    const statusEl = document.getElementById('imagesStatus');
    if (statusEl) {
        statusEl.className = 'import-status processing';
        statusEl.textContent = '正在上传...';
    }
    
    const formData = new FormData();
    formData.append('batch_id', currentBatch.id);
    
    for (const file of files) {
        formData.append('images', file);
    }
    
    try {
        const response = await fetch(`${API_BASE}/import/images`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (statusEl) {
                statusEl.className = 'import-status success';
                statusEl.textContent = `成功导入 ${data.data.imported} 张图片`;
            }
            showToast(`导入成功: ${data.data.imported} 张图片`);
        } else {
            if (statusEl) {
                statusEl.className = 'import-status error';
                statusEl.textContent = data.error || '导入失败';
            }
            showToast(data.error || '导入失败', 'error');
        }
    } catch (error) {
        console.error('Image upload failed:', error);
        if (statusEl) {
            statusEl.className = 'import-status error';
            statusEl.textContent = '上传失败，请重试';
        }
        showToast('上传失败', 'error');
    }
}

async function runScreening() {
    if (!currentBatch) {
        showToast('请先选择批次', 'error');
        return;
    }
    
    showToast('正在运行AI初筛...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/screening/batch/${currentBatch.id}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            const stats = data.data.stats;
            showToast(`初筛完成: 可上架${stats.available}, 需消毒${stats.need_disinfect}, 破损${stats.damaged}, 疑似${stats.suspicious}`);
        } else {
            showToast(data.error || '初筛失败', 'error');
        }
    } catch (error) {
        console.error('Screening failed:', error);
        showToast('初筛失败，请重试', 'error');
    }
}

async function loadBooks() {
    if (!currentBatch) {
        document.getElementById('booksList').innerHTML = `
            <div class="empty-state">
                <p>请先选择批次并导入数据</p>
            </div>
        `;
        return;
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    const reviewFilter = document.getElementById('reviewFilter');
    
    let url = `${API_BASE}/batches/${currentBatch.id}/books`;
    const params = new URLSearchParams();
    
    if (categoryFilter && categoryFilter.value) {
        params.append('category', categoryFilter.value);
    }
    if (reviewFilter && reviewFilter.value) {
        params.append('reviewed', reviewFilter.value);
    }
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            renderBooksList(data.data);
        } else {
            showToast(data.error || '加载失败', 'error');
        }
    } catch (error) {
        console.error('Failed to load books:', error);
        showToast('加载书籍列表失败', 'error');
    }
}

function renderBooksList(books) {
    const container = document.getElementById('booksList');
    
    if (!container) return;
    
    if (books.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>暂无书籍数据</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = books.map(book => `
        <div class="book-card" onclick="loadBookDetail(${book.id})">
            <div class="book-header">
                <div class="book-title">${book.title || '未知书名'}</div>
                <span class="book-category-badge category-${book.display_category}">
                    ${book.display_category_name}
                </span>
            </div>
            <div class="book-info">
                ${book.isbn ? `<div class="book-info-row"><span class="book-info-label">ISBN:</span><span class="book-info-value">${book.isbn}</span></div>` : ''}
                ${book.author ? `<div class="book-info-row"><span class="book-info-label">作者:</span><span class="book-info-value">${book.author}</span></div>` : ''}
                ${book.damage_note ? `<div class="book-info-row"><span class="book-info-label">备注:</span><span class="book-info-value">${book.damage_note}</span></div>` : ''}
            </div>
            <div class="book-footer">
                <span class="review-status ${book.is_reviewed ? 'reviewed' : 'pending'}">
                    ${book.is_reviewed ? '已复核' : '待复核'}
                </span>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${(book.ai_confidence || 0) * 100}%"></div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${Math.round((book.ai_confidence || 0) * 100)}%
                </span>
            </div>
        </div>
    `).join('');
}

async function loadPendingBooks() {
    if (!currentBatch) {
        document.getElementById('pendingList').innerHTML = '<p class="empty-text">请先选择批次</p>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/batches/${currentBatch.id}/books?reviewed=false`);
        const data = await response.json();
        
        if (data.success) {
            renderPendingList(data.data);
        }
    } catch (error) {
        console.error('Failed to load pending books:', error);
    }
}

function renderPendingList(books) {
    const container = document.getElementById('pendingList');
    
    if (!container) return;
    
    if (books.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无待复核书籍</p>';
        return;
    }
    
    container.innerHTML = books.map(book => `
        <div class="pending-item ${currentBookId === book.id ? 'active' : ''}" 
             onclick="loadBookDetail(${book.id})">
            <div class="pending-item-title">${book.title || '未知书名'}</div>
            <div class="pending-item-meta">
                <span class="book-category-badge category-${book.display_category}">
                    ${book.display_category_name}
                </span>
                ${book.isbn ? `<span>${book.isbn}</span>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadBookDetail(bookId) {
    currentBookId = bookId;
    
    try {
        const response = await fetch(`${API_BASE}/books/${bookId}`);
        const data = await response.json();
        
        if (data.success) {
            renderBookDetail(data.data);
            loadPendingBooks();
        } else {
            showToast(data.error || '加载失败', 'error');
        }
    } catch (error) {
        console.error('Failed to load book detail:', error);
        showToast('加载书籍详情失败', 'error');
    }
}

function renderBookDetail(book) {
    const container = document.getElementById('reviewDetail');
    
    if (!container) return;
    
    const categoryOptions = [
        { value: 'available', label: '可上架' },
        { value: 'need_disinfect', label: '需消毒' },
        { value: 'damaged', label: '破损待处理' },
        { value: 'suspicious', label: '疑似盗版/缺页' }
    ];
    
    container.innerHTML = `
        <div class="detail-header">
            <h3 class="detail-title">${book.title || '未知书名'}</h3>
            <span class="book-category-badge category-${book.display_category}">
                ${book.display_category_name}
            </span>
        </div>
        
        <div class="detail-meta">
            ${book.isbn ? `<div class="meta-item"><span class="meta-label">ISBN</span><span class="meta-value">${book.isbn}</span></div>` : ''}
            ${book.author ? `<div class="meta-item"><span class="meta-label">作者</span><span class="meta-value">${book.author}</span></div>` : ''}
            ${book.publisher ? `<div class="meta-item"><span class="meta-label">出版社</span><span class="meta-value">${book.publisher}</span></div>` : ''}
            ${book.publish_year ? `<div class="meta-item"><span class="meta-label">出版年份</span><span class="meta-value">${book.publish_year}</span></div>` : ''}
            ${book.requester_name ? `<div class="meta-item"><span class="meta-label">预约人</span><span class="meta-value">${book.requester_name}</span></div>` : ''}
            ${book.contact_info ? `<div class="meta-item"><span class="meta-label">联系方式</span><span class="meta-value">${book.contact_info}</span></div>` : ''}
        </div>
        
        ${book.damage_note ? `
        <div class="detail-section">
            <h4>破损备注</h4>
            <p style="color: var(--text-secondary);">${book.damage_note}</p>
        </div>
        ` : ''}
        
        <div class="detail-section">
            <h4>AI 分类结果</h4>
            <div class="ai-result">
                <div class="ai-result-item">
                    <div class="ai-result-label">AI分类</div>
                    <div class="ai-result-value">${book.ai_category_name}</div>
                </div>
                <div class="ai-result-item">
                    <div class="ai-result-label">置信度</div>
                    <div class="ai-result-value">${Math.round((book.ai_confidence || 0) * 100)}%</div>
                </div>
                <div class="ai-result-item">
                    <div class="ai-result-label">复核状态</div>
                    <div class="ai-result-value">${book.is_reviewed ? '已复核' : '待复核'}</div>
                </div>
            </div>
            <p style="margin-top: 12px; color: var(--text-secondary);">
                <strong>分类理由:</strong> ${book.ai_reason || '无'}
            </p>
        </div>
        
        ${book.risk_reasons && book.risk_reasons.length > 0 ? `
        <div class="detail-section">
            <h4>风险原因明细</h4>
            ${book.risk_reasons.map(reason => `
                <div class="risk-item">
                    <div class="risk-type">${reason.reason_type}</div>
                    <div class="risk-detail">${reason.reason_detail}</div>
                    <div class="risk-confidence">置信度: ${Math.round(reason.confidence * 100)}%</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${book.audit_logs && book.audit_logs.length > 0 ? `
        <div class="detail-section">
            <h4>操作日志</h4>
            ${book.audit_logs.map(log => `
                <div class="audit-log-item">
                    <div class="audit-action">${log.action === 'manual_review' ? '人工复核' : 'AI初筛'}</div>
                    <div class="audit-time">${new Date(log.created_at).toLocaleString('zh-CN')}</div>
                    <div class="audit-detail">
                        ${log.old_category ? `从「${log.old_category}」改为「${log.new_category}」` : `分类为「${log.new_category}」`}
                        ${log.new_reason ? ` - ${log.new_reason}` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="review-form">
            <h4 style="margin-bottom: 16px;">复核改判</h4>
            <div class="form-group">
                <label for="reviewCategory">最终分类</label>
                <select id="reviewCategory" class="form-select" style="width: 100%;">
                    ${categoryOptions.map(opt => `
                        <option value="${opt.value}" ${(book.final_category || book.ai_category) === opt.value ? 'selected' : ''}>
                            ${opt.label}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="reviewReason">复核理由（可选）</label>
                <textarea id="reviewReason" class="form-textarea" placeholder="请输入复核理由...">${book.manual_reason || ''}</textarea>
            </div>
            <div class="form-row">
                <button onclick="submitReview()" class="btn btn-primary">确认复核</button>
                <button onclick="resetToAI()" class="btn btn-secondary">恢复AI分类</button>
            </div>
        </div>
        
        <div class="notes-section">
            <div class="notes-header">
                <label for="bookNotes">工作备注（刷新不丢失）</label>
                <span id="notesStatus" class="notes-status"></span>
            </div>
            <textarea id="bookNotes" class="form-textarea" placeholder="在此输入工作备注，会自动保存..." oninput="autoSaveNotes()">${book.notes || ''}</textarea>
        </div>
    `;
}

async function submitReview() {
    const category = document.getElementById('reviewCategory').value;
    const reason = document.getElementById('reviewReason').value;
    
    if (!currentBookId) {
        showToast('请先选择书籍', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/books/${currentBookId}/category`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: category,
                reason: reason,
                operator: 'volunteer'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('复核成功');
            loadBookDetail(currentBookId);
        } else {
            showToast(data.error || '复核失败', 'error');
        }
    } catch (error) {
        console.error('Review failed:', error);
        showToast('复核失败，请重试', 'error');
    }
}

async function resetToAI() {
    if (!currentBookId) {
        showToast('请先选择书籍', 'error');
        return;
    }
    
    try {
        const bookResponse = await fetch(`${API_BASE}/books/${currentBookId}`);
        const bookData = await bookResponse.json();
        
        if (!bookData.success) {
            throw new Error(bookData.error);
        }
        
        const book = bookData.data;
        
        const response = await fetch(`${API_BASE}/books/${currentBookId}/category`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: book.ai_category,
                reason: '恢复AI分类',
                operator: 'volunteer'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('已恢复AI分类');
            loadBookDetail(currentBookId);
        } else {
            showToast(data.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('Reset failed:', error);
        showToast('操作失败，请重试', 'error');
    }
}

function autoSaveNotes() {
    const notesStatus = document.getElementById('notesStatus');
    
    if (notesStatus) {
        notesStatus.textContent = '正在保存...';
        notesStatus.classList.remove('notes-saved');
    }
    
    if (notesTimer) {
        clearTimeout(notesTimer);
    }
    
    notesTimer = setTimeout(async () => {
        if (!currentBookId) return;
        
        const notes = document.getElementById('bookNotes').value;
        
        try {
            const response = await fetch(`${API_BASE}/books/${currentBookId}/notes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notes: notes })
            });
            
            const data = await response.json();
            
            if (data.success && notesStatus) {
                notesStatus.textContent = '已保存';
                notesStatus.classList.add('notes-saved');
                
                setTimeout(() => {
                    if (notesStatus) {
                        notesStatus.textContent = '';
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to save notes:', error);
            if (notesStatus) {
                notesStatus.textContent = '保存失败';
                notesStatus.classList.remove('notes-saved');
            }
        }
    }, 1000);
}

async function loadExportStats() {
    if (!currentBatch) {
        document.getElementById('exportStats').innerHTML = `
            <div class="empty-state">
                <p>请先选择批次</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/batches/${currentBatch.id}/books`);
        const data = await response.json();
        
        if (data.success) {
            const books = data.data;
            const stats = {
                total: books.length,
                available: books.filter(b => (b.final_category || b.ai_category) === 'available').length,
                need_disinfect: books.filter(b => (b.final_category || b.ai_category) === 'need_disinfect').length,
                damaged: books.filter(b => (b.final_category || b.ai_category) === 'damaged').length,
                suspicious: books.filter(b => (b.final_category || b.ai_category) === 'suspicious').length,
                reviewed: books.filter(b => b.is_reviewed).length,
                pending: books.filter(b => !b.is_reviewed).length
            };
            
            renderExportStats(stats);
        }
    } catch (error) {
        console.error('Failed to load export stats:', error);
    }
}

function renderExportStats(stats) {
    const container = document.getElementById('exportStats');
    
    if (!container) return;
    
    container.innerHTML = `
        <h4 style="margin-bottom: 16px;">当前批次统计</h4>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">总书籍数</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--success-color);">${stats.available}</div>
                <div class="stat-label">可上架</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--warning-color);">${stats.need_disinfect}</div>
                <div class="stat-label">需消毒</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: var(--danger-color);">${stats.damaged}</div>
                <div class="stat-label">破损待处理</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: #6b21a8;">${stats.suspicious}</div>
                <div class="stat-label">疑似盗版/缺页</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.reviewed}/${stats.total}</div>
                <div class="stat-label">已复核/总数</div>
            </div>
        </div>
    `;
}

function exportMarkdown() {
    if (!currentBatch) {
        showToast('请先选择批次', 'error');
        return;
    }
    
    window.open(`${API_BASE}/export/markdown/${currentBatch.id}`, '_blank');
}

function exportJSON() {
    if (!currentBatch) {
        showToast('请先选择批次', 'error');
        return;
    }
    
    window.open(`${API_BASE}/export/json/${currentBatch.id}`, '_blank');
}
