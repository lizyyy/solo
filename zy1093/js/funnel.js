function calculateFunnelMetrics() {
    if (!AppState.posts || AppState.posts.length === 0) {
        AppState.analysisResults = null;
        return;
    }
    
    const posts = AppState.filteredPosts.length > 0 ? AppState.filteredPosts : AppState.posts;
    
    const totalExposure = posts.reduce((sum, p) => sum + p.exposure, 0);
    const totalPlays = posts.reduce((sum, p) => sum + p.plays, 0);
    const totalCompletions = posts.reduce((sum, p) => sum + p.completions, 0);
    const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
    const totalShares = posts.reduce((sum, p) => sum + p.shares, 0);
    const totalFavorites = posts.reduce((sum, p) => sum + p.favorites, 0);
    const totalConversions = posts.reduce((sum, p) => sum + p.conversions, 0);
    
    const totalEngagement = totalLikes + totalComments + totalShares;
    
    const playRate = totalExposure > 0 ? totalPlays / totalExposure : 0;
    const completionRate = totalPlays > 0 ? totalCompletions / totalPlays : 0;
    const engagementRate = totalPlays > 0 ? totalEngagement / totalPlays : 0;
    const favoriteRate = totalPlays > 0 ? totalFavorites / totalPlays : 0;
    const conversionRate = totalFavorites > 0 ? totalConversions / totalFavorites : 0;
    
    const platformBreakdown = calculateBreakdownByField('platform');
    const hourBreakdown = calculateBreakdownByField('publish_hour');
    const tagBreakdown = calculateBreakdownByTags();
    const promiseBreakdown = calculateBreakdownByField('title_promise_type');
    const coverBreakdown = calculateBreakdownByField('cover_type');
    
    AppState.analysisResults = {
        summary: {
            totalExposure,
            totalPlays,
            totalCompletions,
            totalEngagement,
            totalLikes,
            totalComments,
            totalShares,
            totalFavorites,
            totalConversions,
            playRate,
            completionRate,
            engagementRate,
            favoriteRate,
            conversionRate
        },
        breakdowns: {
            platform: platformBreakdown,
            hour: hourBreakdown,
            tag: tagBreakdown,
            promise: promiseBreakdown,
            cover: coverBreakdown
        },
        viralPosts: posts.filter(p => p.isViral),
        flopPosts: posts.filter(p => p.isFlop)
    };
    
    updateFunnelMetricsDisplay();
    generateFunnelInsights();
}

function calculateBreakdownByField(field) {
    const posts = AppState.filteredPosts.length > 0 ? AppState.filteredPosts : AppState.posts;
    const groups = {};
    
    posts.forEach(post => {
        const key = post[field] || 'unknown';
        if (!groups[key]) {
            groups[key] = {
                count: 0,
                totalExposure: 0,
                totalPlays: 0,
                totalCompletions: 0,
                totalEngagement: 0,
                totalFavorites: 0,
                totalConversions: 0
            };
        }
        groups[key].count++;
        groups[key].totalExposure += post.exposure;
        groups[key].totalPlays += post.plays;
        groups[key].totalCompletions += post.completions;
        groups[key].totalEngagement += post.likes + post.comments + post.shares;
        groups[key].totalFavorites += post.favorites;
        groups[key].totalConversions += post.conversions;
    });
    
    return Object.entries(groups).map(([key, data]) => ({
        key,
        ...data,
        playRate: data.totalExposure > 0 ? data.totalPlays / data.totalExposure : 0,
        completionRate: data.totalPlays > 0 ? data.totalCompletions / data.totalPlays : 0,
        engagementRate: data.totalPlays > 0 ? data.totalEngagement / data.totalPlays : 0,
        favoriteRate: data.totalPlays > 0 ? data.totalFavorites / data.totalPlays : 0,
        conversionRate: data.totalFavorites > 0 ? data.totalConversions / data.totalFavorites : 0
    }));
}

function calculateBreakdownByTags() {
    const posts = AppState.filteredPosts.length > 0 ? AppState.filteredPosts : AppState.posts;
    const groups = {};
    
    posts.forEach(post => {
        const tags = post.tagsArray || [];
        tags.forEach(tag => {
            if (!groups[tag]) {
                groups[tag] = {
                    count: 0,
                    totalExposure: 0,
                    totalPlays: 0,
                    totalCompletions: 0,
                    totalEngagement: 0,
                    totalFavorites: 0,
                    totalConversions: 0
                };
            }
            groups[tag].count++;
            groups[tag].totalExposure += post.exposure;
            groups[tag].totalPlays += post.plays;
            groups[tag].totalCompletions += post.completions;
            groups[tag].totalEngagement += post.likes + post.comments + post.shares;
            groups[tag].totalFavorites += post.favorites;
            groups[tag].totalConversions += post.conversions;
        });
    });
    
    return Object.entries(groups).map(([key, data]) => ({
        key,
        ...data,
        playRate: data.totalExposure > 0 ? data.totalPlays / data.totalExposure : 0,
        completionRate: data.totalPlays > 0 ? data.totalCompletions / data.totalPlays : 0,
        engagementRate: data.totalPlays > 0 ? data.totalEngagement / data.totalPlays : 0,
        favoriteRate: data.totalPlays > 0 ? data.totalFavorites / data.totalPlays : 0,
        conversionRate: data.totalFavorites > 0 ? data.totalConversions / data.totalFavorites : 0
    }));
}

function updateFunnelMetricsDisplay() {
    if (!AppState.analysisResults) return;
    
    const summary = AppState.analysisResults.summary;
    const thresholds = AppState.thresholds?.funnel_thresholds || DEFAULT_THRESHOLDS.funnel_thresholds;
    
    const metricElements = [
        { id: 'metricPlayRate', value: summary.playRate, trendId: 'trendPlayRate', threshold: thresholds.play_rate },
        { id: 'metricCompletionRate', value: summary.completionRate, trendId: 'trendCompletionRate', threshold: thresholds.completion_rate },
        { id: 'metricEngagementRate', value: summary.engagementRate, trendId: 'trendEngagementRate', threshold: thresholds.engagement_rate },
        { id: 'metricFavoriteRate', value: summary.favoriteRate, trendId: 'trendFavoriteRate', threshold: thresholds.favorite_rate },
        { id: 'metricConversionRate', value: summary.conversionRate, trendId: 'trendConversionRate', threshold: thresholds.conversion_rate }
    ];
    
    metricElements.forEach(metric => {
        const el = document.getElementById(metric.id);
        const trendEl = document.getElementById(metric.trendId);
        
        if (el) {
            el.textContent = formatRate(metric.value);
        }
        
        if (trendEl) {
            if (metric.value >= metric.threshold.good) {
                trendEl.textContent = '↑ 优秀';
                trendEl.className = 'metric-trend trend-up';
            } else if (metric.value >= metric.threshold.warning) {
                trendEl.textContent = '→ 正常';
                trendEl.className = 'metric-trend trend-neutral';
            } else {
                trendEl.textContent = '↓ 偏低';
                trendEl.className = 'metric-trend trend-down';
            }
        }
    });
}

function generateFunnelInsights() {
    if (!AppState.analysisResults) return;
    
    const summary = AppState.analysisResults.summary;
    const insights = [];
    const thresholds = AppState.thresholds?.funnel_thresholds || DEFAULT_THRESHOLDS.funnel_thresholds;
    
    if (summary.playRate < thresholds.play_rate.warning) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: '播放转化率偏低',
            desc: `当前播放率为 ${formatRate(summary.playRate)}，低于警戒值 ${formatRate(thresholds.play_rate.warning)}。建议优化标题和封面，提高点击率。`
        });
    } else if (summary.playRate >= thresholds.play_rate.excellent) {
        insights.push({
            type: 'success',
            icon: '✅',
            title: '播放转化率优秀',
            desc: `当前播放率为 ${formatRate(summary.playRate)}，表现优秀。标题和封面吸引力强。`
        });
    }
    
    if (summary.completionRate < thresholds.completion_rate.warning) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: '完播率偏低',
            desc: `当前完播率为 ${formatRate(summary.completionRate)}，低于警戒值。建议优化视频开头3秒，精简内容节奏。`
        });
    } else if (summary.completionRate >= thresholds.completion_rate.excellent) {
        insights.push({
            type: 'success',
            icon: '✅',
            title: '完播率优秀',
            desc: `当前完播率为 ${formatRate(summary.completionRate)}，用户留存很好。内容节奏把控得当。`
        });
    }
    
    if (summary.engagementRate < thresholds.engagement_rate.warning) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: '互动率偏低',
            desc: `当前互动率为 ${formatRate(summary.engagementRate)}。建议在视频结尾增加引导互动的话术。`
        });
    }
    
    if (summary.conversionRate < thresholds.conversion_rate.warning) {
        insights.push({
            type: 'info',
            icon: '💡',
            title: '转化空间大',
            desc: `当前收藏到转化的比率为 ${formatRate(summary.conversionRate)}。可优化转化路径和引导话术。`
        });
    }
    
    const viralPosts = AppState.analysisResults.viralPosts;
    const flopPosts = AppState.analysisResults.flopPosts;
    
    if (viralPosts.length > 0) {
        insights.push({
            type: 'success',
            icon: '🔥',
            title: `发现 ${viralPosts.length} 条爆款`,
            desc: `有 ${viralPosts.length} 条作品表现突出，曝光超过10万且播放率优秀。建议分析其成功因素并复制。`
        });
    }
    
    if (flopPosts.length > 0) {
        insights.push({
            type: 'warning',
            icon: '📉',
            title: `发现 ${flopPosts.length} 条扑街`,
            desc: `有 ${flopPosts.length} 条作品数据不佳。建议分析原因，避免重复踩坑。`
        });
    }
    
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: 'ℹ️',
            title: '数据表现平稳',
            desc: '各项指标均在正常范围内。建议持续优化，寻找突破口。'
        });
    }
    
    const insightsContainer = document.getElementById('funnelInsightsList');
    if (insightsContainer) {
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-desc">${insight.desc}</div>
                </div>
            </div>
        `).join('');
    }
}

function updateOverviewStats() {
    if (!AppState.analysisResults) return;
    
    const summary = AppState.analysisResults.summary;
    
    document.getElementById('totalExposure').textContent = formatNumber(summary.totalExposure);
    document.getElementById('totalPlays').textContent = formatNumber(summary.totalPlays);
    document.getElementById('avgCompletionRate').textContent = formatRate(summary.completionRate);
    document.getElementById('avgEngagementRate').textContent = formatRate(summary.engagementRate);
    document.getElementById('totalFavorites').textContent = formatNumber(summary.totalFavorites);
    document.getElementById('totalConversions').textContent = formatNumber(summary.totalConversions);
}
