const AppState = {
    posts: [],
    comments: [],
    topics: [],
    thresholds: null,
    filteredPosts: [],
    analysisResults: null,
    issues: [],
    priorityScores: [],
    isDataLoaded: false
};

const DEFAULT_THRESHOLDS = {
    version: "1.0",
    funnel_thresholds: {
        play_rate: { excellent: 0.85, good: 0.70, warning: 0.50, critical: 0.30 },
        completion_rate: { excellent: 0.75, good: 0.60, warning: 0.40, critical: 0.25 },
        engagement_rate: { excellent: 0.10, good: 0.06, warning: 0.03, critical: 0.015 },
        favorite_rate: { excellent: 0.05, good: 0.03, warning: 0.015, critical: 0.008 },
        conversion_rate: { excellent: 0.02, good: 0.012, warning: 0.006, critical: 0.002 }
    },
    clickbait_detection: {
        enabled: true,
        exaggerated_words: ["震惊", "惊呆", "太可怕", "紧急", "不看后悔", "赶紧收藏", "必看", "99%的人", "100%", "绝对", "保证", "月入", "年入", "暴利", "秘籍", "绝密", "内幕", "爆料", "删前", "速看"],
        exaggerated_patterns: ["居然能.*万", "学会.*赚.*钱", ".*后悔", ".*删.*", ".*秘密.*", ".*不知道.*"],
        thresholds: { max_exaggerated_words: 2, completion_drop_rate: 0.5, negative_comment_ratio: 0.3 }
    },
    negative_comments: {
        enabled: true,
        negative_keywords: ["骗人", "被骗", "假的", "太假", "垃圾", "坑", "浪费时间", "取关", "举报", "标题党", "博眼球", "没意思", "恶心", "割韭菜", "没用", "不好", "差评", "后悔", "上当"],
        thresholds: { negative_ratio_warning: 0.20, negative_ratio_critical: 0.40, negative_likes_ratio: 0.5 }
    },
    topic_density: {
        enabled: true,
        thresholds: { same_topic_max_daily: 2, same_topic_consecutive_days: 3, min_gap_hours: 4 }
    },
    publish_time: {
        peak_hours: [
            { start: 7, end: 9, name: "早高峰" },
            { start: 12, end: 14, name: "午高峰" },
            { start: 18, end: 22, name: "晚高峰" }
        ],
        low_hours: [0, 1, 2, 3, 4, 5, 6, 23]
    },
    viral_detection: { exposure_threshold: 100000, play_rate_threshold: 0.8, engagement_rate_threshold: 0.08 },
    flop_detection: { exposure_threshold: 10000, play_rate_threshold: 0.3, engagement_rate_threshold: 0.01 },
    priority_rules: {
        high_priority_tags: ["入门", "教程", "实战", "副业", "接单"],
        low_priority_tags: ["吐槽", "避雷", "踩坑"],
        tag_weight: 2,
        historical_performance_weight: 3,
        engagement_weight: 2,
        platform_fit_weight: 1
    },
    platform_defaults: {
        xiaohongshu: { name: "小红书", avg_play_rate: 0.65, avg_completion_rate: 0.45, avg_engagement_rate: 0.05, best_publish_hours: [19, 20, 21] },
        douyin: { name: "抖音", avg_play_rate: 0.70, avg_completion_rate: 0.50, avg_engagement_rate: 0.06, best_publish_hours: [20, 21, 22] },
        shipinhao: { name: "视频号", avg_play_rate: 0.60, avg_completion_rate: 0.40, avg_engagement_rate: 0.04, best_publish_hours: [19, 20, 21] }
    }
};

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatRate(rate) {
    return (rate * 100).toFixed(1) + '%';
}

function getRateClass(rate, thresholdType) {
    const thresholds = AppState.thresholds?.funnel_thresholds?.[thresholdType] || DEFAULT_THRESHOLDS.funnel_thresholds[thresholdType];
    if (rate >= thresholds.excellent) return 'rate-good';
    if (rate >= thresholds.good) return 'rate-good';
    if (rate >= thresholds.warning) return 'rate-warning';
    return 'rate-poor';
}

function getPlatformName(platform) {
    const defaults = AppState.thresholds?.platform_defaults || DEFAULT_THRESHOLDS.platform_defaults;
    return defaults[platform]?.name || platform;
}

function getPlatformBadgeClass(platform) {
    return `platform-${platform}`;
}

function initApp() {
    AppState.thresholds = { ...DEFAULT_THRESHOLDS };
    initTabNavigation();
    initFormatTabs();
    initEventListeners();
    loadSavedDraft();
}

function initTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const tabId = item.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
}

function initFormatTabs() {
    const formatTabs = document.querySelectorAll('.format-tab');
    formatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            formatTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const formatId = tab.dataset.format;
            document.querySelectorAll('.format-detail').forEach(detail => {
                detail.classList.remove('active');
            });
            const targetDetail = document.getElementById(`format-${formatId}`);
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
}

function initEventListeners() {
    document.getElementById('loadSampleBtn')?.addEventListener('click', loadSampleData);
    document.getElementById('saveDraftBtn')?.addEventListener('click', saveDraft);
    document.getElementById('loadDraftBtn')?.addEventListener('click', loadSavedDraft);
    document.getElementById('clearBtn')?.addEventListener('click', clearData);
    
    document.getElementById('importBtn')?.addEventListener('click', processImport);
    document.getElementById('resetThresholdsBtn')?.addEventListener('click', resetThresholds);
    
    document.getElementById('applyFilterBtn')?.addEventListener('click', applyFilters);
    document.getElementById('recalculatePriorityBtn')?.addEventListener('click', recalculatePriorities);
    
    document.getElementById('exportMarkdownBtn')?.addEventListener('click', () => exportReport('markdown'));
    document.getElementById('exportHtmlBtn')?.addEventListener('click', () => exportReport('html'));
    document.getElementById('exportJsonBtn')?.addEventListener('click', () => exportReport('json'));
    
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeIssueModal);
    document.getElementById('issueDetailModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'issueDetailModal') {
            closeIssueModal();
        }
    });
    
    const weightSliders = ['weightTag', 'weightHistory', 'weightEngagement', 'weightPlatform'];
    weightSliders.forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(id + 'Value');
        if (slider && valueSpan) {
            slider.addEventListener('input', () => {
                valueSpan.textContent = slider.value;
            });
        }
    });
    
    initPreviewTabs();
    initBreakdownTabs();
}

function initPreviewTabs() {
    const previewTabs = document.querySelectorAll('.preview-tab');
    previewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            previewTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateReportPreview(tab.dataset.preview);
        });
    });
}

function initBreakdownTabs() {
    const breakdownTabs = document.querySelectorAll('.breakdown-tab');
    breakdownTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            breakdownTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (AppState.isDataLoaded && window.renderBreakdownChart) {
                renderBreakdownChart(tab.dataset.breakdown);
            }
        });
    });
}

function updateStatusIndicator(status) {
    const indicator = document.getElementById('statusIndicator');
    const postCount = document.getElementById('postCount');
    const commentCount = document.getElementById('commentCount');
    const topicCount = document.getElementById('topicCount');
    
    if (status === 'loaded') {
        indicator.textContent = '数据已加载';
        indicator.className = 'status-badge status-loaded';
        postCount.textContent = AppState.posts.length;
        commentCount.textContent = AppState.comments.length;
        topicCount.textContent = AppState.topics.length;
    } else {
        indicator.textContent = '未加载数据';
        indicator.className = 'status-badge status-empty';
        postCount.textContent = '-';
        commentCount.textContent = '-';
        topicCount.textContent = '-';
    }
}

function saveDraft() {
    if (!AppState.isDataLoaded) {
        showToast('没有数据可保存', 'warning');
        return;
    }
    
    const draft = {
        posts: AppState.posts,
        comments: AppState.comments,
        topics: AppState.topics,
        thresholds: AppState.thresholds,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('videoAnalyzerDraft', JSON.stringify(draft));
    showToast('草稿已保存到本地存储', 'success');
}

function loadSavedDraft() {
    const saved = localStorage.getItem('videoAnalyzerDraft');
    if (!saved) {
        showToast('没有找到保存的草稿', 'warning');
        return;
    }
    
    try {
        const draft = JSON.parse(saved);
        AppState.posts = draft.posts || [];
        AppState.comments = draft.comments || [];
        AppState.topics = draft.topics || [];
        AppState.thresholds = draft.thresholds || DEFAULT_THRESHOLDS;
        AppState.filteredPosts = [...AppState.posts];
        AppState.isDataLoaded = true;
        
        runFullAnalysis();
        showToast('草稿已加载', 'success');
    } catch (e) {
        showToast('加载草稿失败: ' + e.message, 'error');
    }
}

function clearData() {
    if (!confirm('确定要清空所有数据吗？')) {
        return;
    }
    
    AppState.posts = [];
    AppState.comments = [];
    AppState.topics = [];
    AppState.thresholds = { ...DEFAULT_THRESHOLDS };
    AppState.filteredPosts = [];
    AppState.analysisResults = null;
    AppState.issues = [];
    AppState.priorityScores = [];
    AppState.isDataLoaded = false;
    
    updateStatusIndicator('empty');
    clearAllCharts();
    clearTableData();
    showToast('数据已清空', 'success');
}

function clearAllCharts() {
    if (window.chartInstances) {
        Object.values(window.chartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        window.chartInstances = {};
    }
}

function clearTableData() {
    const tbody = document.getElementById('postsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">暂无数据</td></tr>';
    }
    
    document.getElementById('totalExposure').textContent = '-';
    document.getElementById('totalPlays').textContent = '-';
    document.getElementById('avgCompletionRate').textContent = '-';
    document.getElementById('avgEngagementRate').textContent = '-';
    document.getElementById('totalFavorites').textContent = '-';
    document.getElementById('totalConversions').textContent = '-';
    
    document.getElementById('criticalIssues').textContent = '0';
    document.getElementById('warningIssues').textContent = '0';
    document.getElementById('infoIssues').textContent = '0';
    
    document.getElementById('issuesList').innerHTML = '<p class="empty-text">暂无数据，先导入数据进行分析</p>';
    document.getElementById('priorityList').innerHTML = '<p class="empty-text">暂无选题计划，请导入 topics.json</p>';
    document.getElementById('reportPreview').innerHTML = '<p class="empty-text">暂无数据，先导入数据进行分析</p>';
}

async function loadSampleData() {
    const sampleType = await askUserSampleType();
    if (!sampleType) return;
    
    const basePath = `data/${sampleType}/`;
    
    try {
        showToast('正在加载示例数据...', 'success');
        
        const postsResponse = await fetch(basePath + 'posts.csv');
        const postsText = await postsResponse.text();
        AppState.posts = parseCSV(postsText);
        
        const commentsResponse = await fetch(basePath + 'comments.csv');
        const commentsText = await commentsResponse.text();
        AppState.comments = parseCSV(commentsText);
        
        const topicsResponse = await fetch(basePath + 'topics.json');
        AppState.topics = await topicsResponse.json();
        
        AppState.filteredPosts = [...AppState.posts];
        AppState.isDataLoaded = true;
        
        runFullAnalysis();
        showToast(`${sampleType === 'normal' ? '正常' : '问题'}样例数据加载成功`, 'success');
        
    } catch (e) {
        console.error('加载示例数据失败:', e);
        showToast('加载示例数据失败: ' + e.message, 'error');
    }
}

function askUserSampleType() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content sample-modal">
                <div class="modal-header">
                    <h3>选择示例数据类型</h3>
                </div>
                <div class="modal-body">
                    <div class="sample-options">
                        <button class="sample-option normal" data-type="normal">
                            <div class="sample-icon">✅</div>
                            <div class="sample-title">正常样例</div>
                            <div class="sample-desc">数据表现良好，无明显问题</div>
                        </button>
                        <button class="sample-option problem" data-type="problem">
                            <div class="sample-icon">⚠️</div>
                            <div class="sample-title">问题样例</div>
                            <div class="sample-desc">包含标题党、负面评论、题材密集等问题</div>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        overlay.querySelectorAll('.sample-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(btn.dataset.type);
            });
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
            }
        });
    });
}

function runFullAnalysis() {
    updateStatusIndicator('loaded');
    
    normalizeData();
    updatePlatformFilter();
    calculateFunnelMetrics();
    detectAllIssues();
    calculatePriorities();
    
    if (window.renderAllCharts) {
        renderAllCharts();
    }
    
    renderPostsTable();
    updateOverviewStats();
    renderIssuesList();
    renderPriorityList();
    updateReportPreview('summary');
}

function updatePlatformFilter() {
    const platforms = [...new Set(AppState.posts.map(p => p.platform))];
    const select = document.getElementById('filterPlatform');
    if (select) {
        select.innerHTML = '<option value="all">全部平台</option>';
        platforms.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = getPlatformName(p);
            select.appendChild(option);
        });
    }
}

document.addEventListener('DOMContentLoaded', initApp);
