// 本地存储模块
// 负责数据的持久化存储和读取

const Storage = (function() {
    const STORAGE_KEYS = {
        REHEARSAL_DATA: 'rehearsal_data',
        TARGET_DATA: 'target_data',
        ISSUES: 'issues',
        REVIEWS: 'reviews',
        LAST_ANALYSIS: 'last_analysis'
    };

    // 保存数据到localStorage
    function save(key, data) {
        try {
            const jsonData = JSON.stringify(data);
            localStorage.setItem(key, jsonData);
            return true;
        } catch (error) {
            console.error('保存数据失败:', error);
            return false;
        }
    }

    // 从localStorage读取数据
    function load(key) {
        try {
            const jsonData = localStorage.getItem(key);
            if (jsonData) {
                return JSON.parse(jsonData);
            }
            return null;
        } catch (error) {
            console.error('读取数据失败:', error);
            return null;
        }
    }

    // 保存排练数据
    function saveRehearsalData(data) {
        return save(STORAGE_KEYS.REHEARSAL_DATA, data);
    }

    // 读取排练数据
    function loadRehearsalData() {
        return load(STORAGE_KEYS.REHEARSAL_DATA);
    }

    // 保存目标音高表数据
    function saveTargetData(data) {
        return save(STORAGE_KEYS.TARGET_DATA, data);
    }

    // 读取目标音高表数据
    function loadTargetData() {
        return load(STORAGE_KEYS.TARGET_DATA);
    }

    // 保存分析出的问题
    function saveIssues(issues) {
        return save(STORAGE_KEYS.ISSUES, issues);
    }

    // 读取分析出的问题
    function loadIssues() {
        return load(STORAGE_KEYS.ISSUES);
    }

    // 保存复核记录
    function saveReviews(reviews) {
        return save(STORAGE_KEYS.REVIEWS, reviews);
    }

    // 读取复核记录
    function loadReviews() {
        return load(STORAGE_KEYS.REVIEWS) || {};
    }

    // 保存单个问题的复核记录
    function saveIssueReview(issueId, review) {
        const reviews = loadReviews();
        reviews[issueId] = {
            ...review,
            updatedAt: new Date().toISOString()
        };
        return saveReviews(reviews);
    }

    // 读取单个问题的复核记录
    function getIssueReview(issueId) {
        const reviews = loadReviews();
        return reviews[issueId] || null;
    }

    // 保存上次分析时间
    function saveLastAnalysisTime(timestamp) {
        return save(STORAGE_KEYS.LAST_ANALYSIS, timestamp);
    }

    // 读取上次分析时间
    function loadLastAnalysisTime() {
        return load(STORAGE_KEYS.LAST_ANALYSIS);
    }

    // 清除所有数据
    function clearAllData() {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    // 检查是否有已保存的数据
    function hasSavedData() {
        return loadRehearsalData() !== null || 
               loadTargetData() !== null || 
               loadIssues() !== null;
    }

    // 生成唯一ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    return {
        // 基础存储方法
        save,
        load,
        
        // 排练数据
        saveRehearsalData,
        loadRehearsalData,
        
        // 目标音高数据
        saveTargetData,
        loadTargetData,
        
        // 问题数据
        saveIssues,
        loadIssues,
        
        // 复核记录
        saveReviews,
        loadReviews,
        saveIssueReview,
        getIssueReview,
        
        // 分析时间
        saveLastAnalysisTime,
        loadLastAnalysisTime,
        
        // 工具方法
        clearAllData,
        hasSavedData,
        generateId
    };
})();

// 导出Storage对象（在浏览器环境中直接可用）
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}
