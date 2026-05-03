function calculatePriorities() {
    if (!AppState.topics || !AppState.topics.next_week_plans || AppState.topics.next_week_plans.length === 0) {
        AppState.priorityScores = [];
        return;
    }
    
    const priorityRules = AppState.thresholds?.priority_rules || DEFAULT_THRESHOLDS.priority_rules;
    const platformDefaults = AppState.thresholds?.platform_defaults || DEFAULT_THRESHOLDS.platform_defaults;
    
    const historicalTagPerformance = calculateHistoricalTagPerformance();
    
    AppState.priorityScores = AppState.topics.next_week_plans.map((plan, index) => {
        let totalScore = 0;
        let breakdown = [];
        
        const topic = AppState.topics.topics?.find(t => t.id === plan.topic_id);
        const planTags = topic?.tags || [];
        
        let tagScore = 0;
        planTags.forEach(tag => {
            if (priorityRules.high_priority_tags.includes(tag)) {
                tagScore += 1;
            }
            if (priorityRules.low_priority_tags.includes(tag)) {
                tagScore -= 1;
            }
        });
        const weightedTagScore = tagScore * priorityRules.tag_weight;
        totalScore += weightedTagScore;
        breakdown.push({ category: '标签匹配', score: weightedTagScore, weight: priorityRules.tag_weight });
        
        let historicalScore = 0;
        planTags.forEach(tag => {
            const perf = historicalTagPerformance[tag];
            if (perf) {
                if (perf.avgPlayRate > 0.7) historicalScore += 1;
                if (perf.avgEngagementRate > 0.05) historicalScore += 1;
                if (perf.conversionCount > 0) historicalScore += 1;
            }
        });
        const weightedHistoricalScore = historicalScore * priorityRules.historical_performance_weight;
        totalScore += weightedHistoricalScore;
        breakdown.push({ category: '历史表现', score: weightedHistoricalScore, weight: priorityRules.historical_performance_weight });
        
        let engagementScore = 0;
        const relatedPosts = AppState.posts.filter(post => {
            if (!post.tagsArray) return false;
            return planTags.some(tag => post.tagsArray.includes(tag));
        });
        
        if (relatedPosts.length > 0) {
            const avgEngagement = relatedPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / relatedPosts.length;
            const avgCompletion = relatedPosts.reduce((sum, p) => sum + (p.completion_rate || 0), 0) / relatedPosts.length;
            
            if (avgEngagement > 0.06) engagementScore += 1;
            if (avgCompletion > 0.6) engagementScore += 1;
        }
        const weightedEngagementScore = engagementScore * priorityRules.engagement_weight;
        totalScore += weightedEngagementScore;
        breakdown.push({ category: '互动质量', score: weightedEngagementScore, weight: priorityRules.engagement_weight });
        
        let platformScore = 0;
        if (AppState.posts.length > 0) {
            const platformCounts = {};
            AppState.posts.forEach(p => {
                platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
            });
            
            const topPlatform = Object.entries(platformCounts)
                .sort((a, b) => b[1] - a[1])[0];
            
            if (topPlatform) {
                const platformBestHours = platformDefaults[topPlatform[0]]?.best_publish_hours || [];
                const planHour = parseInt(plan.planned_hour) || 19;
                
                if (platformBestHours.includes(planHour)) {
                    platformScore += 1;
                }
            }
        }
        const weightedPlatformScore = platformScore * priorityRules.platform_fit_weight;
        totalScore += weightedPlatformScore;
        breakdown.push({ category: '平台适配', score: weightedPlatformScore, weight: priorityRules.platform_fit_weight });
        
        if (topic) {
            if (topic.priority === 'high') totalScore += 2;
            else if (topic.priority === 'low') totalScore -= 2;
        }
        
        const existingIssues = AppState.issues || [];
        existingIssues.forEach(issue => {
            if (issue.affectedPosts) {
                const hasRelatedPost = issue.affectedPosts.some(item => {
                    const postTags = (item.post?.tagsArray || item.tagsArray || []);
                    return planTags.some(tag => postTags.includes(tag));
                });
                
                if (hasRelatedPost) {
                    if (issue.severity === 'critical') {
                        totalScore -= 3;
                    } else if (issue.severity === 'warning') {
                        totalScore -= 1;
                    }
                }
            }
        });
        
        return {
            ...plan,
            index,
            topic,
            score: totalScore,
            normalizedScore: Math.max(0, totalScore),
            breakdown,
            relatedPosts,
            planTags
        };
    });
    
    AppState.priorityScores.sort((a, b) => b.score - a.score);
}

function calculateHistoricalTagPerformance() {
    const tagPerformance = {};
    
    AppState.posts.forEach(post => {
        const tags = post.tagsArray || [];
        tags.forEach(tag => {
            if (!tagPerformance[tag]) {
                tagPerformance[tag] = {
                    count: 0,
                    totalPlayRate: 0,
                    totalEngagementRate: 0,
                    totalCompletionRate: 0,
                    conversionCount: 0
                };
            }
            tagPerformance[tag].count++;
            tagPerformance[tag].totalPlayRate += post.play_rate || 0;
            tagPerformance[tag].totalEngagementRate += post.engagement_rate || 0;
            tagPerformance[tag].totalCompletionRate += post.completion_rate || 0;
            if (post.conversions > 0) {
                tagPerformance[tag].conversionCount++;
            }
        });
    });
    
    Object.keys(tagPerformance).forEach(tag => {
        const perf = tagPerformance[tag];
        perf.avgPlayRate = perf.count > 0 ? perf.totalPlayRate / perf.count : 0;
        perf.avgEngagementRate = perf.count > 0 ? perf.totalEngagementRate / perf.count : 0;
        perf.avgCompletionRate = perf.count > 0 ? perf.totalCompletionRate / perf.count : 0;
    });
    
    return tagPerformance;
}

function recalculatePriorities() {
    if (!AppState.isDataLoaded) {
        showToast('请先导入数据', 'warning');
        return;
    }
    
    const customWeights = {
        tag_weight: parseInt(document.getElementById('weightTag')?.value) || 2,
        historical_performance_weight: parseInt(document.getElementById('weightHistory')?.value) || 3,
        engagement_weight: parseInt(document.getElementById('weightEngagement')?.value) || 2,
        platform_fit_weight: parseInt(document.getElementById('weightPlatform')?.value) || 1
    };
    
    const originalRules = AppState.thresholds?.priority_rules || DEFAULT_THRESHOLDS.priority_rules;
    AppState.thresholds.priority_rules = {
        ...originalRules,
        ...customWeights
    };
    
    calculatePriorities();
    renderPriorityList();
    showToast('优先级已重新计算', 'success');
}

function renderPriorityList() {
    const container = document.getElementById('priorityList');
    if (!container) return;
    
    if (!AppState.priorityScores || AppState.priorityScores.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无选题计划，请导入 topics.json</p>';
        return;
    }
    
    container.innerHTML = AppState.priorityScores.map((item, idx) => {
        const rank = idx + 1;
        let rankClass = 'rank-normal';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        const topic = item.topic;
        const tags = item.planTags || [];
        
        let scoreColor = 'var(--text-primary)';
        if (item.score >= 5) scoreColor = 'var(--success-color)';
        else if (item.score < 0) scoreColor = 'var(--danger-color)';
        
        return `
            <div class="priority-item">
                <div class="priority-rank ${rankClass}">${rank}</div>
                <div class="priority-info">
                    <div class="priority-title">${item.title || '未命名选题'}</div>
                    <div class="priority-meta">
                        <span>📅 ${item.planned_date || '待定'}</span>
                        <span>📋 ${item.status || 'draft'}</span>
                        ${topic ? `<span>🏷️ ${topic.name || ''}</span>` : ''}
                    </div>
                    <div class="priority-tags">
                        ${tags.map(tag => `<span class="priority-tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="priority-score">
                    <div class="score-value" style="color: ${scoreColor};">${item.score}</div>
                    <div class="score-label">综合评分</div>
                </div>
            </div>
        `;
    }).join('');
}
