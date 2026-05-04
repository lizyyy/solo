// 主应用模块
// 负责页面交互、数据展示和模块协调

const App = (function() {
    // 当前状态
    let state = {
        currentIssueIndex: 0,
        filteredIssues: [],
        allIssues: []
    };

    // DOM元素
    const elements = {
        // 导入区域
        rehearsalFile: document.getElementById('rehearsal-file'),
        targetFile: document.getElementById('target-file'),
        rehearsalStatus: document.getElementById('rehearsal-status'),
        targetStatus: document.getElementById('target-status'),
        analyzeBtn: document.getElementById('analyze-btn'),
        
        // 导入section
        importSection: document.getElementById('import-section'),
        
        // 结果区域
        resultsSection: document.getElementById('results-section'),
        totalIssues: document.getElementById('total-issues'),
        pitchIssues: document.getElementById('pitch-issues'),
        rhythmIssues: document.getElementById('rhythm-issues'),
        balanceIssues: document.getElementById('balance-issues'),
        repeatIssues: document.getElementById('repeat-issues'),
        issuesList: document.getElementById('issues-list'),
        filterType: document.getElementById('filter-type'),
        filterVoice: document.getElementById('filter-voice'),
        
        // 复核区域
        reviewSection: document.getElementById('review-section'),
        reviewTitle: document.getElementById('review-title'),
        reviewDetail: document.getElementById('review-detail'),
        reviewStatus: document.getElementById('review-status'),
        reviewComments: document.getElementById('review-comments'),
        saveReview: document.getElementById('save-review'),
        prevIssue: document.getElementById('prev-issue'),
        nextIssue: document.getElementById('next-issue'),
        backToList: document.getElementById('back-to-list'),
        
        // 导出区域
        exportSection: document.getElementById('export-section'),
        exportMarkdown: document.getElementById('export-markdown'),
        exportCSV: document.getElementById('export-csv'),
        exportJSON: document.getElementById('export-json')
    };

    // 初始化应用
    function init() {
        bindEvents();
        checkSavedData();
    }

    // 绑定事件
    function bindEvents() {
        // 文件选择事件
        elements.rehearsalFile.addEventListener('change', handleRehearsalFileSelect);
        elements.targetFile.addEventListener('change', handleTargetFileSelect);
        
        // 分析按钮
        elements.analyzeBtn.addEventListener('click', handleAnalyze);
        
        // 筛选器
        elements.filterType.addEventListener('change', filterIssues);
        elements.filterVoice.addEventListener('change', filterIssues);
        
        // 问题列表点击
        elements.issuesList.addEventListener('click', handleIssueClick);
        
        // 复核功能
        elements.backToList.addEventListener('click', showResultsSection);
        elements.saveReview.addEventListener('click', saveCurrentReview);
        elements.prevIssue.addEventListener('click', () => navigateIssue(-1));
        elements.nextIssue.addEventListener('click', () => navigateIssue(1));
        
        // 导出功能
        elements.exportMarkdown.addEventListener('click', () => {
            const result = Export.exportMarkdown();
            if (result.success) {
                alert(`已导出: ${result.filename}`);
            } else {
                alert(result.error);
            }
        });
        
        elements.exportCSV.addEventListener('click', () => {
            const result = Export.exportCSV();
            if (result.success) {
                alert(`已导出: ${result.filename}`);
            } else {
                alert(result.error);
            }
        });
        
        elements.exportJSON.addEventListener('click', () => {
            const result = Export.exportJSON();
            if (result.success) {
                alert(`已导出: ${result.filename}`);
            } else {
                alert(result.error);
            }
        });
    }

    // 检查是否有已保存的数据
    function checkSavedData() {
        if (Storage.hasSavedData()) {
            const issues = Storage.loadIssues();
            if (issues && issues.length > 0) {
                state.allIssues = issues;
                state.filteredIssues = issues;
                displayResults(issues);
                showResultsSection();
                updateVoiceFilter();
            }
        }
    }

    // 处理排练文件选择
    async function handleRehearsalFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        elements.rehearsalStatus.textContent = '正在读取...';
        elements.rehearsalStatus.className = 'file-status';

        const result = await Import.importRehearsalFile(file);
        
        if (result.success) {
            elements.rehearsalStatus.textContent = `已加载 ${result.count} 条数据`;
            elements.rehearsalStatus.className = 'file-status success';
        } else {
            elements.rehearsalStatus.textContent = result.error;
            elements.rehearsalStatus.className = 'file-status error';
        }

        updateAnalyzeButton();
    }

    // 处理目标音高表文件选择
    async function handleTargetFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        elements.targetStatus.textContent = '正在读取...';
        elements.targetStatus.className = 'file-status';

        const result = await Import.importTargetFile(file);
        
        if (result.success) {
            elements.targetStatus.textContent = `已加载 ${result.count} 条数据`;
            elements.targetStatus.className = 'file-status success';
        } else {
            elements.targetStatus.textContent = result.error;
            elements.targetStatus.className = 'file-status error';
        }

        updateAnalyzeButton();
    }

    // 更新分析按钮状态
    function updateAnalyzeButton() {
        const rehearsalData = Storage.loadRehearsalData();
        const targetData = Storage.loadTargetData();
        
        elements.analyzeBtn.disabled = !rehearsalData || !targetData;
    }

    // 处理分析
    function handleAnalyze() {
        elements.analyzeBtn.textContent = '正在分析...';
        elements.analyzeBtn.disabled = true;

        // 使用setTimeout让UI有时间更新
        setTimeout(() => {
            const result = Analysis.analyze();
            
            elements.analyzeBtn.textContent = '开始分析';
            
            if (result.success) {
                state.allIssues = result.issues;
                state.filteredIssues = result.issues;
                
                displayResults(result.issues);
                showResultsSection();
                updateVoiceFilter();
                
                alert(`分析完成！共发现 ${result.stats.total} 个问题。`);
            } else {
                alert(result.error);
                elements.analyzeBtn.disabled = false;
            }
        }, 100);
    }

    // 显示结果区域
    function showResultsSection() {
        elements.importSection.classList.add('hidden');
        elements.reviewSection.classList.add('hidden');
        elements.resultsSection.classList.remove('hidden');
        elements.exportSection.classList.remove('hidden');
    }

    // 显示复核区域
    function showReviewSection() {
        elements.importSection.classList.add('hidden');
        elements.resultsSection.classList.add('hidden');
        elements.reviewSection.classList.remove('hidden');
        elements.exportSection.classList.add('hidden');
    }

    // 显示结果
    function displayResults(issues) {
        // 更新统计数据
        const stats = {
            total: issues.length,
            pitch: issues.filter(i => i.type === 'pitch').length,
            rhythm: issues.filter(i => i.type === 'rhythm').length,
            balance: issues.filter(i => i.type === 'balance').length,
            repeat: issues.filter(i => i.type === 'repeat').length
        };

        elements.totalIssues.textContent = stats.total;
        elements.pitchIssues.textContent = stats.pitch;
        elements.rhythmIssues.textContent = stats.rhythm;
        elements.balanceIssues.textContent = stats.balance;
        elements.repeatIssues.textContent = stats.repeat;

        // 更新问题列表
        renderIssueList(issues);
    }

    // 渲染问题列表
    function renderIssueList(issues) {
        if (issues.length === 0) {
            elements.issuesList.innerHTML = '<p class="empty-message">暂无问题数据</p>';
            return;
        }

        const reviews = Storage.loadReviews();
        
        let html = '';
        issues.forEach((issue, index) => {
            const review = reviews[issue.id];
            const statusClass = review?.status || 'pending';
            const statusText = {
                'pending': '待复核',
                'confirmed': '已确认',
                'dismissed': '已忽略'
            }[statusClass];

            html += `
                <div class="issue-item ${issue.type}" data-index="${index}" data-id="${issue.id}">
                    <div class="issue-header">
                        <span class="issue-type ${issue.type}">${issue.typeName}</span>
                        <span class="issue-voice">${issue.voice}</span>
                    </div>
                    <div class="issue-measure">
                        <strong>小节:</strong> ${issue.measure}
                        <span style="margin-left: 20px;"><strong>时间:</strong> ${issue.time.toFixed(2)}秒</span>
                        <span style="margin-left: 20px;"><strong>严重程度:</strong> ${issue.severity}</span>
                    </div>
                    <div class="issue-detail">${issue.description}</div>
                    <span class="issue-status ${statusClass}">${statusText}</span>
                </div>
            `;
        });

        elements.issuesList.innerHTML = html;
    }

    // 更新声部筛选器
    function updateVoiceFilter() {
        const voices = [...new Set(state.allIssues.map(i => i.voice))];
        
        let html = '<option value="all">全部声部</option>';
        voices.forEach(voice => {
            html += `<option value="${voice}">${voice}</option>`;
        });
        
        elements.filterVoice.innerHTML = html;
    }

    // 筛选问题
    function filterIssues() {
        const typeFilter = elements.filterType.value;
        const voiceFilter = elements.filterVoice.value;

        state.filteredIssues = state.allIssues.filter(issue => {
            const typeMatch = typeFilter === 'all' || issue.type === typeFilter;
            const voiceMatch = voiceFilter === 'all' || issue.voice === voiceFilter;
            return typeMatch && voiceMatch;
        });

        renderIssueList(state.filteredIssues);
    }

    // 处理问题点击
    function handleIssueClick(event) {
        const issueItem = event.target.closest('.issue-item');
        if (!issueItem) return;

        const index = parseInt(issueItem.dataset.index);
        state.currentIssueIndex = index;
        
        showReviewSection();
        displayCurrentIssue();
    }

    // 显示当前问题
    function displayCurrentIssue() {
        if (state.filteredIssues.length === 0) return;

        const issue = state.filteredIssues[state.currentIssueIndex];
        const review = Storage.getIssueReview(issue.id);

        // 更新标题
        elements.reviewTitle.textContent = `问题复核 (${state.currentIssueIndex + 1}/${state.filteredIssues.length})`;

        // 更新详情
        let detailsHtml = `
            <div class="detail-section">
                <h4>基本信息</h4>
                <p><strong>问题类型:</strong> ${issue.typeName}</p>
                <p><strong>声部:</strong> ${issue.voice}</p>
                <p><strong>小节:</strong> ${issue.measure}</p>
                <p><strong>时间:</strong> ${issue.time.toFixed(2)}秒</p>
                <p><strong>严重程度:</strong> <span class="highlight">${issue.severity}</span></p>
            </div>
            
            <div class="detail-section">
                <h4>问题描述</h4>
                <p>${issue.description}</p>
            </div>
            
            <div class="detail-section">
                <h4>详细数据</h4>
        `;

        // 根据问题类型显示不同的详细信息
        if (issue.type === 'pitch') {
            detailsHtml += `
                <p><strong>实际频率:</strong> ${issue.details.actualFrequency} Hz</p>
                <p><strong>目标频率:</strong> ${issue.details.targetFrequency} Hz</p>
                <p><strong>目标音符:</strong> ${issue.details.targetPitch}</p>
                <p><strong>偏差:</strong> <span class="highlight">${issue.details.centsDeviation} 音分 (${issue.details.direction})</span></p>
                <p><strong>采样数:</strong> ${issue.details.sampleCount}</p>
            `;
        } else if (issue.type === 'rhythm') {
            detailsHtml += `
                <p><strong>实际间隔:</strong> ${issue.details.actualInterval} 秒</p>
                <p><strong>预期间隔:</strong> ${issue.details.expectedInterval} 秒</p>
                <p><strong>偏差:</strong> <span class="highlight">${issue.details.timeDeviation} 秒 (${issue.details.direction})</span></p>
            `;
        } else if (issue.type === 'balance') {
            detailsHtml += `
                <p><strong>最响声部:</strong> ${issue.details.loudestVoice} (${issue.details.loudestLoudness} dB)</p>
                <p><strong>最轻声部:</strong> ${issue.details.quietestVoice} (${issue.details.quietestLoudness} dB)</p>
                <p><strong>响度差异:</strong> <span class="highlight">${issue.details.loudnessDiff} dB</span></p>
                <p><strong>涉及声部:</strong> ${issue.details.voices.join(', ')}</p>
            `;
        } else if (issue.type === 'repeat') {
            detailsHtml += `
                <p><strong>问题次数:</strong> <span class="highlight">${issue.details.issueCount}</span></p>
                <p><strong>问题类型:</strong> ${issue.details.issueTypes.join(', ')}</p>
            `;
        }

        detailsHtml += `</div>`;

        elements.reviewDetail.innerHTML = detailsHtml;

        // 更新复核状态
        elements.reviewStatus.value = review?.status || 'pending';
        
        // 更新批注
        elements.reviewComments.value = review?.comments || '';

        // 更新导航按钮状态
        elements.prevIssue.disabled = state.currentIssueIndex === 0;
        elements.nextIssue.disabled = state.currentIssueIndex === state.filteredIssues.length - 1;
    }

    // 保存当前复核
    function saveCurrentReview() {
        if (state.filteredIssues.length === 0) return;

        const issue = state.filteredIssues[state.currentIssueIndex];
        const review = {
            status: elements.reviewStatus.value,
            comments: elements.reviewComments.value
        };

        Storage.saveIssueReview(issue.id, review);
        
        alert('批注已保存！');
        
        // 刷新列表显示
        filterIssues();
    }

    // 导航问题
    function navigateIssue(direction) {
        const newIndex = state.currentIssueIndex + direction;
        
        if (newIndex >= 0 && newIndex < state.filteredIssues.length) {
            state.currentIssueIndex = newIndex;
            displayCurrentIssue();
        }
    }

    return {
        init,
        state
    };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});

// 导出App对象（在浏览器环境中直接可用）
if (typeof window !== 'undefined') {
    window.App = App;
}
