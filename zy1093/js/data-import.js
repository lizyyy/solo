function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;
        
        const row = {};
        headers.forEach((header, idx) => {
            let value = values[idx].trim();
            
            const numValue = parseFloat(value);
            if (!isNaN(numValue) && value === numValue.toString()) {
                value = numValue;
            }
            
            row[header] = value;
        });
        data.push(row);
    }
    
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function validatePostsData(posts) {
    const errors = [];
    const warnings = [];
    
    if (!posts || posts.length === 0) {
        errors.push({ field: 'posts', message: '作品数据为空', type: 'error' });
        return { valid: false, errors, warnings };
    }
    
    const requiredFields = ['post_id', 'platform', 'publish_date', 'title', 'exposure', 'plays', 'completions'];
    
    posts.forEach((post, index) => {
        const rowNum = index + 2;
        
        requiredFields.forEach(field => {
            if (post[field] === undefined || post[field] === '') {
                errors.push({ 
                    field, 
                    message: `第 ${rowNum} 行: 缺少必填字段 "${field}"`,
                    type: 'error',
                    row: rowNum
                });
            }
        });
        
        const numericFields = ['exposure', 'plays', 'completions', 'likes', 'comments', 'shares', 'favorites', 'clicks', 'conversions'];
        numericFields.forEach(field => {
            if (post[field] !== undefined && isNaN(parseFloat(post[field]))) {
                errors.push({
                    field,
                    message: `第 ${rowNum} 行: 字段 "${field}" 应为数值类型`,
                    type: 'error',
                    row: rowNum
                });
            }
        });
        
        if (post.platform && !['xiaohongshu', 'douyin', 'shipinhao'].includes(post.platform)) {
            warnings.push({
                field: 'platform',
                message: `第 ${rowNum} 行: 未知的平台类型 "${post.platform}"`,
                type: 'warning',
                row: rowNum
            });
        }
        
        if (post.exposure && post.plays && parseFloat(post.plays) > parseFloat(post.exposure)) {
            warnings.push({
                field: 'plays',
                message: `第 ${rowNum} 行: 播放量大于曝光量，数据可能异常`,
                type: 'warning',
                row: rowNum
            });
        }
        
        if (post.plays && post.completions && parseFloat(post.completions) > parseFloat(post.plays)) {
            warnings.push({
                field: 'completions',
                message: `第 ${rowNum} 行: 完播量大于播放量，数据可能异常`,
                type: 'warning',
                row: rowNum
            });
        }
    });
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        total: posts.length
    };
}

function validateCommentsData(comments) {
    const errors = [];
    const warnings = [];
    
    if (!comments || comments.length === 0) {
        warnings.push({ field: 'comments', message: '评论数据为空（可选）', type: 'warning' });
        return { valid: true, errors, warnings, total: 0 };
    }
    
    const requiredFields = ['comment_id', 'post_id', 'content'];
    
    comments.forEach((comment, index) => {
        const rowNum = index + 2;
        
        requiredFields.forEach(field => {
            if (comment[field] === undefined || comment[field] === '') {
                warnings.push({ 
                    field, 
                    message: `第 ${rowNum} 行: 缺少字段 "${field}"`,
                    type: 'warning',
                    row: rowNum
                });
            }
        });
        
        if (comment.sentiment && !['positive', 'neutral', 'negative'].includes(comment.sentiment)) {
            warnings.push({
                field: 'sentiment',
                message: `第 ${rowNum} 行: 情感值 "${comment.sentiment}" 不规范，应为 positive/neutral/negative`,
                type: 'warning',
                row: rowNum
            });
        }
    });
    
    return {
        valid: true,
        errors,
        warnings,
        total: comments.length
    };
}

function validateTopicsData(topics) {
    const errors = [];
    const warnings = [];
    
    if (!topics) {
        warnings.push({ field: 'topics', message: '选题数据为空（可选）', type: 'warning' });
        return { valid: true, errors, warnings, total: 0 };
    }
    
    if (!topics.topics && !topics.next_week_plans) {
        warnings.push({ 
            field: 'topics', 
            message: '选题数据格式不规范，应包含 topics 或 next_week_plans 字段',
            type: 'warning'
        });
    }
    
    return {
        valid: true,
        errors,
        warnings,
        total: (topics.topics?.length || 0) + (topics.next_week_plans?.length || 0)
    };
}

function normalizeData() {
    AppState.posts = AppState.posts.map(post => {
        const normalized = { ...post };
        
        normalized.exposure = parseFloat(post.exposure) || 0;
        normalized.plays = parseFloat(post.plays) || 0;
        normalized.completions = parseFloat(post.completions) || 0;
        normalized.likes = parseFloat(post.likes) || 0;
        normalized.comments = parseFloat(post.comments) || 0;
        normalized.shares = parseFloat(post.shares) || 0;
        normalized.favorites = parseFloat(post.favorites) || 0;
        normalized.clicks = parseFloat(post.clicks) || 0;
        normalized.conversions = parseFloat(post.conversions) || 0;
        
        if (typeof post.tags === 'string') {
            normalized.tagsArray = post.tags.split('|').map(t => t.trim()).filter(t => t);
        } else if (Array.isArray(post.tags)) {
            normalized.tagsArray = post.tags;
        } else {
            normalized.tagsArray = [];
        }
        
        normalized.play_rate = normalized.exposure > 0 ? normalized.plays / normalized.exposure : 0;
        normalized.completion_rate = normalized.plays > 0 ? normalized.completions / normalized.plays : 0;
        
        const totalEngagement = normalized.likes + normalized.comments + normalized.shares;
        normalized.engagement_rate = normalized.plays > 0 ? totalEngagement / normalized.plays : 0;
        
        normalized.favorite_rate = normalized.plays > 0 ? normalized.favorites / normalized.plays : 0;
        normalized.conversion_rate = normalized.favorites > 0 ? normalized.conversions / normalized.favorites : 0;
        
        normalized.isViral = checkIfViral(normalized);
        normalized.isFlop = checkIfFlop(normalized);
        
        return normalized;
    });
    
    AppState.comments = AppState.comments.map(comment => {
        const normalized = { ...comment };
        normalized.likes = parseFloat(comment.likes) || 0;
        
        if (!comment.sentiment) {
            normalized.sentiment = analyzeSentiment(comment.content || '');
        }
        
        return normalized;
    });
}

function checkIfViral(post) {
    const thresholds = AppState.thresholds?.viral_detection || DEFAULT_THRESHOLDS.viral_detection;
    return post.exposure >= thresholds.exposure_threshold &&
           post.play_rate >= thresholds.play_rate_threshold &&
           post.engagement_rate >= thresholds.engagement_rate_threshold;
}

function checkIfFlop(post) {
    const thresholds = AppState.thresholds?.flop_detection || DEFAULT_THRESHOLDS.flop_detection;
    return post.exposure <= thresholds.exposure_threshold &&
           post.play_rate <= thresholds.play_rate_threshold &&
           post.engagement_rate <= thresholds.engagement_rate_threshold;
}

function analyzeSentiment(text) {
    if (!text) return 'neutral';
    
    const negativeKeywords = [
        '骗人', '被骗', '假的', '太假', '垃圾', '坑', '浪费时间',
        '取关', '举报', '标题党', '博眼球', '没意思', '恶心',
        '割韭菜', '没用', '不好', '差评', '后悔', '上当',
        '失望', '不好', '垃圾', '太差', '烂', '讨厌', '垃圾',
        '太坑', '被骗', '假', '骗子', '恶心'
    ];
    
    const positiveKeywords = [
        '好', '棒', '优秀', '赞', '喜欢', '感谢', '太棒', '有用',
        '实用', '详细', '清楚', '简单', '容易', '学会', '学到',
        '感谢', '谢谢', '支持', '加油', '期待', '不错', '可以'
    ];
    
    const lowerText = text.toLowerCase();
    let negativeScore = 0;
    let positiveScore = 0;
    
    negativeKeywords.forEach(word => {
        if (lowerText.includes(word)) negativeScore++;
    });
    
    positiveKeywords.forEach(word => {
        if (lowerText.includes(word)) positiveScore++;
    });
    
    if (negativeScore > positiveScore) return 'negative';
    if (positiveScore > negativeScore) return 'positive';
    return 'neutral';
}

async function processImport() {
    const postsFile = document.getElementById('postsFile')?.files[0];
    const commentsFile = document.getElementById('commentsFile')?.files[0];
    const topicsFile = document.getElementById('topicsFile')?.files[0];
    const thresholdsFile = document.getElementById('thresholdsFile')?.files[0];
    
    if (!postsFile) {
        showToast('请选择 posts.csv 文件', 'warning');
        return;
    }
    
    try {
        showToast('正在处理数据...', 'success');
        
        const postsText = await readFileAsText(postsFile);
        AppState.posts = parseCSV(postsText);
        
        if (commentsFile) {
            const commentsText = await readFileAsText(commentsFile);
            AppState.comments = parseCSV(commentsText);
        } else {
            AppState.comments = [];
        }
        
        if (topicsFile) {
            const topicsText = await readFileAsText(topicsFile);
            AppState.topics = JSON.parse(topicsText);
        } else {
            AppState.topics = { topics: [], next_week_plans: [] };
        }
        
        if (thresholdsFile) {
            const thresholdsText = await readFileAsText(thresholdsFile);
            AppState.thresholds = JSON.parse(thresholdsText);
            document.getElementById('thresholdsStatus').textContent = '已加载自定义配置';
            document.getElementById('thresholdsStatus').classList.add('has-file');
        }
        
        const postsValidation = validatePostsData(AppState.posts);
        const commentsValidation = validateCommentsData(AppState.comments);
        const topicsValidation = validateTopicsData(AppState.topics);
        
        showValidationResults(postsValidation, commentsValidation, topicsValidation);
        
        if (!postsValidation.valid) {
            showToast('数据校验失败，请检查错误', 'error');
            return;
        }
        
        AppState.filteredPosts = [...AppState.posts];
        AppState.isDataLoaded = true;
        
        runFullAnalysis();
        showToast('数据导入成功', 'success');
        
    } catch (e) {
        console.error('导入失败:', e);
        showToast('导入失败: ' + e.message, 'error');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
    });
}

function showValidationResults(postsVal, commentsVal, topicsVal) {
    const container = document.getElementById('validationResults');
    const content = document.getElementById('validationContent');
    
    if (!container || !content) return;
    
    let html = '';
    
    html += '<div class="validation-section">';
    html += `<h4>📋 posts.csv (${postsVal.total} 条记录)</h4>`;
    
    if (postsVal.errors.length > 0) {
        postsVal.errors.forEach(err => {
            html += `<div class="validation-item validation-error">
                <span class="validation-icon">❌</span>
                <span>${err.message}</span>
            </div>`;
        });
    }
    
    if (postsVal.warnings.length > 0) {
        postsVal.warnings.forEach(warn => {
            html += `<div class="validation-item validation-warning">
                <span class="validation-icon">⚠️</span>
                <span>${warn.message}</span>
            </div>`;
        });
    }
    
    if (postsVal.errors.length === 0 && postsVal.warnings.length === 0) {
        html += `<div class="validation-item validation-success">
            <span class="validation-icon">✅</span>
            <span>数据格式正确，无错误</span>
        </div>`;
    }
    html += '</div>';
    
    html += '<div class="validation-section">';
    html += `<h4>💬 comments.csv (${commentsVal.total} 条记录)</h4>`;
    
    if (commentsVal.warnings.length > 0) {
        commentsVal.warnings.forEach(warn => {
            html += `<div class="validation-item validation-warning">
                <span class="validation-icon">⚠️</span>
                <span>${warn.message}</span>
            </div>`;
        });
    }
    
    if (commentsVal.warnings.length === 0) {
        html += `<div class="validation-item validation-success">
            <span class="validation-icon">✅</span>
            <span>评论数据正常</span>
        </div>`;
    }
    html += '</div>';
    
    html += '<div class="validation-section">';
    html += `<h4>🏷️ topics.json (${topicsVal.total} 项)</h4>`;
    
    if (topicsVal.warnings.length > 0) {
        topicsVal.warnings.forEach(warn => {
            html += `<div class="validation-item validation-warning">
                <span class="validation-icon">⚠️</span>
                <span>${warn.message}</span>
            </div>`;
        });
    }
    
    if (topicsVal.warnings.length === 0 && topicsVal.total > 0) {
        html += `<div class="validation-item validation-success">
            <span class="validation-icon">✅</span>
            <span>选题数据正常</span>
        </div>`;
    }
    html += '</div>';
    
    content.innerHTML = html;
    container.style.display = 'block';
}

function resetThresholds() {
    AppState.thresholds = { ...DEFAULT_THRESHOLDS };
    document.getElementById('thresholdsStatus').textContent = '使用默认配置';
    document.getElementById('thresholdsStatus').classList.remove('has-file');
    showToast('已重置为默认阈值配置', 'success');
    
    if (AppState.isDataLoaded) {
        runFullAnalysis();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInputs = ['postsFile', 'commentsFile', 'topicsFile', 'thresholdsFile'];
    fileInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                const statusId = id.replace('File', 'Status');
                const status = document.getElementById(statusId);
                if (status) {
                    if (file) {
                        status.textContent = `已选择: ${file.name}`;
                        status.classList.add('has-file');
                    } else {
                        status.textContent = '未选择文件';
                        status.classList.remove('has-file');
                    }
                }
            });
        }
    });
});
