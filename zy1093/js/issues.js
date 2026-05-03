function detectAllIssues() {
    const issues = [];
    
    issues.push(...detectClickbait());
    issues.push(...detectNegativeComments());
    issues.push(...detectTopicDensity());
    issues.push(...detectPublishTimeIssues());
    issues.push(...detectFlopPosts());
    issues.push(...detectViralOpportunities());
    
    AppState.issues = issues;
    
    updateIssueCounts();
}

function detectClickbait() {
    const issues = [];
    const clickbaitConfig = AppState.thresholds?.clickbait_detection || DEFAULT_THRESHOLDS.clickbait_detection;
    
    if (!clickbaitConfig.enabled) return issues;
    
    const clickbaitPosts = [];
    
    AppState.posts.forEach(post => {
        let clickbaitScore = 0;
        const foundWords = [];
        const title = post.title || '';
        const lowerTitle = title.toLowerCase();
        
        clickbaitConfig.exaggerated_words.forEach(word => {
            if (lowerTitle.includes(word.toLowerCase())) {
                clickbaitScore++;
                foundWords.push(word);
            }
        });
        
        clickbaitConfig.exaggerated_patterns.forEach(pattern => {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(title)) {
                clickbaitScore += 0.5;
            }
        });
        
        const postComments = AppState.comments.filter(c => c.post_id === post.post_id);
        const negativeComments = postComments.filter(c => c.sentiment === 'negative');
        
        const completionRate = post.completion_rate || 0;
        const playRate = post.play_rate || 0;
        
        const isClickbait = (
            clickbaitScore >= clickbaitConfig.thresholds.max_exaggerated_words &&
            completionRate < clickbaitConfig.thresholds.completion_drop_rate * playRate &&
            (postComments.length === 0 || negativeComments.length / postComments.length >= clickbaitConfig.thresholds.negative_comment_ratio)
        );
        
        if (isClickbait || (clickbaitScore >= 3 && completionRate < 0.4)) {
            clickbaitPosts.push({
                post,
                score: clickbaitScore,
                foundWords,
                completionRate,
                playRate,
                negativeCount: negativeComments.length,
                totalComments: postComments.length
            });
        }
    });
    
    if (clickbaitPosts.length > 0) {
        issues.push({
            id: 'clickbait',
            type: 'critical',
            severity: 'critical',
            title: '⚠️ 检测到标题党风险',
            summary: `发现 ${clickbaitPosts.length} 条作品存在标题党特征`,
            description: '标题使用夸张词汇，但完播率明显低于播放率，可能存在标题与内容不符的情况。',
            affectedPosts: clickbaitPosts,
            suggestion: '建议：1) 标题应真实反映内容；2) 避免使用"震惊""必看"等夸张词汇；3) 关注完播率指标。'
        });
    }
    
    return issues;
}

function detectNegativeComments() {
    const issues = [];
    const negativeConfig = AppState.thresholds?.negative_comments || DEFAULT_THRESHOLDS.negative_comments;
    
    if (!negativeConfig.enabled || AppState.comments.length === 0) return issues;
    
    const postNegativeStats = {};
    
    AppState.comments.forEach(comment => {
        const postId = comment.post_id;
        if (!postNegativeStats[postId]) {
            postNegativeStats[postId] = { positive: 0, neutral: 0, negative: 0, negativeLikes: 0, totalLikes: 0, comments: [] };
        }
        
        const sentiment = comment.sentiment || 'neutral';
        postNegativeStats[postId][sentiment]++;
        postNegativeStats[postId].totalLikes += comment.likes || 0;
        
        if (sentiment === 'negative') {
            postNegativeStats[postId].negativeLikes += comment.likes || 0;
            postNegativeStats[postId].comments.push(comment);
        }
    });
    
    const highNegativePosts = [];
    
    Object.entries(postNegativeStats).forEach(([postId, stats]) => {
        const total = stats.positive + stats.neutral + stats.negative;
        if (total === 0) return;
        
        const negativeRatio = stats.negative / total;
        const negativeLikesRatio = stats.totalLikes > 0 ? stats.negativeLikes / stats.totalLikes : 0;
        
        const post = AppState.posts.find(p => p.post_id == postId);
        
        if (negativeRatio >= negativeConfig.thresholds.negative_ratio_critical) {
            highNegativePosts.push({
                post,
                postId,
                negativeRatio,
                negativeLikesRatio,
                stats,
                severity: 'critical'
            });
        } else if (negativeRatio >= negativeConfig.thresholds.negative_ratio_warning) {
            highNegativePosts.push({
                post,
                postId,
                negativeRatio,
                negativeLikesRatio,
                stats,
                severity: 'warning'
            });
        }
    });
    
    if (highNegativePosts.length > 0) {
        const criticalCount = highNegativePosts.filter(p => p.severity === 'critical').length;
        const warningCount = highNegativePosts.filter(p => p.severity === 'warning').length;
        
        issues.push({
            id: 'negative_comments',
            type: criticalCount > 0 ? 'critical' : 'warning',
            severity: criticalCount > 0 ? 'critical' : 'warning',
            title: '💬 检测到负面评论集中',
            summary: `${criticalCount > 0 ? criticalCount + ' 条严重' : ''}${warningCount > 0 ? (criticalCount > 0 ? '、' : '') + warningCount + ' 条警告' : ''}`,
            description: '部分作品的负面评论占比较高，可能存在内容质量问题或用户不满。',
            affectedPosts: highNegativePosts,
            suggestion: '建议：1) 查看具体负面评论内容；2) 分析是否存在内容问题；3) 考虑回应用户反馈。'
        });
    }
    
    return issues;
}

function detectTopicDensity() {
    const issues = [];
    const densityConfig = AppState.thresholds?.topic_density || DEFAULT_THRESHOLDS.topic_density;
    
    if (!densityConfig.enabled) return issues;
    
    const postsByDate = {};
    const tagGroups = {};
    
    AppState.posts.forEach(post => {
        const date = post.publish_date;
        const hour = parseInt(post.publish_hour) || 0;
        
        if (!postsByDate[date]) {
            postsByDate[date] = [];
        }
        postsByDate[date].push({ ...post, hour });
        
        (post.tagsArray || []).forEach(tag => {
            if (!tagGroups[tag]) {
                tagGroups[tag] = [];
            }
            tagGroups[tag].push({ date, hour, post });
        });
    });
    
    const denseTags = [];
    
    Object.entries(tagGroups).forEach(([tag, tagPosts]) => {
        if (tagPosts.length < 2) return;
        
        const sortedPosts = tagPosts.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.hour - b.hour;
        });
        
        const dateCounts = {};
        sortedPosts.forEach(p => {
            dateCounts[p.date] = (dateCounts[p.date] || 0) + 1;
        });
        
        Object.entries(dateCounts).forEach(([date, count]) => {
            if (count >= densityConfig.thresholds.same_topic_max_daily) {
                denseTags.push({
                    tag,
                    date,
                    count,
                    type: 'daily',
                    posts: sortedPosts.filter(p => p.date === date)
                });
            }
        });
        
        let consecutiveDays = 0;
        let lastDate = null;
        const dates = Object.keys(dateCounts).sort();
        
        dates.forEach((date, idx) => {
            if (lastDate) {
                const diff = (new Date(date) - new Date(lastDate)) / (1000 * 60 * 60 * 24);
                if (diff === 1) {
                    consecutiveDays++;
                } else {
                    if (consecutiveDays >= densityConfig.thresholds.same_topic_consecutive_days) {
                        denseTags.push({
                            tag,
                            startDate: dates[idx - consecutiveDays],
                            endDate: lastDate,
                            count: consecutiveDays + 1,
                            type: 'consecutive'
                        });
                    }
                    consecutiveDays = 0;
                }
            }
            lastDate = date;
        });
        
        if (consecutiveDays >= densityConfig.thresholds.same_topic_consecutive_days - 1) {
            denseTags.push({
                tag,
                startDate: dates[dates.length - consecutiveDays - 1],
                endDate: lastDate,
                count: consecutiveDays + 1,
                type: 'consecutive'
            });
        }
        
        for (let i = 1; i < sortedPosts.length; i++) {
            const current = sortedPosts[i];
            const prev = sortedPosts[i - 1];
            
            if (current.date === prev.date) {
                const gapHours = current.hour - prev.hour;
                if (gapHours < densityConfig.thresholds.min_gap_hours) {
                    denseTags.push({
                        tag,
                        date: current.date,
                        type: 'gap',
                        gapHours,
                        posts: [prev, current]
                    });
                }
            }
        }
    });
    
    if (denseTags.length > 0) {
        const uniqueTags = [...new Set(denseTags.map(d => d.tag))];
        
        issues.push({
            id: 'topic_density',
            type: 'warning',
            severity: 'warning',
            title: '📊 检测到同题材发布过密',
            summary: `涉及 ${uniqueTags.length} 个标签，${denseTags.length} 处密集发布`,
            description: '同一题材在短时间内发布过于频繁，可能导致用户审美疲劳，降低推荐量。',
            affectedPosts: denseTags,
            suggestion: `建议：1) 同一题材每天最多发布 ${densityConfig.thresholds.same_topic_max_daily} 条；2) 连续发布不超过 ${densityConfig.thresholds.same_topic_consecutive_days} 天；3) 间隔至少 ${densityConfig.thresholds.min_gap_hours} 小时。`
        });
    }
    
    return issues;
}

function detectPublishTimeIssues() {
    const issues = [];
    const timeConfig = AppState.thresholds?.publish_time || DEFAULT_THRESHOLDS.publish_time;
    const platformDefaults = AppState.thresholds?.platform_defaults || DEFAULT_THRESHOLDS.platform_defaults;
    
    const lowTimePosts = [];
    const nonPeakPosts = [];
    
    AppState.posts.forEach(post => {
        const hour = parseInt(post.publish_hour) || 0;
        const platform = post.platform;
        
        const isLowTime = timeConfig.low_hours.includes(hour);
        if (isLowTime) {
            lowTimePosts.push({
                post,
                hour,
                reason: '低峰时段发布'
            });
        }
        
        const platformBestHours = platformDefaults[platform]?.best_publish_hours || [];
        const isBestTime = platformBestHours.includes(hour);
        
        if (!isBestTime && !isLowTime) {
            nonPeakPosts.push({
                post,
                hour,
                bestHours: platformBestHours,
                reason: '非平台黄金时段'
            });
        }
    });
    
    if (lowTimePosts.length > 0) {
        issues.push({
            id: 'low_time_publish',
            type: 'info',
            severity: 'info',
            title: '🕐 发现低峰时段发布',
            summary: `${lowTimePosts.length} 条作品在用户活跃度低的时段发布`,
            description: `凌晨 (0-6点) 和深夜 (23点) 是用户活跃度最低的时段，建议调整发布时间。`,
            affectedPosts: lowTimePosts,
            suggestion: '建议：1) 避免在 0-6 点和 23 点发布；2) 优先选择早高峰(7-9)、午高峰(12-14)、晚高峰(18-22)。'
        });
    }
    
    if (nonPeakPosts.length > 0 && AppState.posts.length > 0) {
        const ratio = nonPeakPosts.length / AppState.posts.length;
        if (ratio > 0.5) {
            issues.push({
                id: 'non_peak_publish',
                type: 'info',
                severity: 'info',
                title: '⏰ 非黄金时段发布较多',
                summary: `${nonPeakPosts.length} 条作品未在各平台黄金时段发布`,
                description: '各平台有不同的黄金发布时段，在这些时段发布通常能获得更高的初始曝光。',
                affectedPosts: nonPeakPosts,
                suggestion: '建议参考各平台黄金时段：小红书(19-21点)、抖音(20-22点)、视频号(19-21点)。'
            });
        }
    }
    
    return issues;
}

function detectFlopPosts() {
    const issues = [];
    
    const flopPosts = AppState.posts.filter(p => p.isFlop);
    
    if (flopPosts.length >= 2) {
        const commonTags = {};
        flopPosts.forEach(post => {
            (post.tagsArray || []).forEach(tag => {
                commonTags[tag] = (commonTags[tag] || 0) + 1;
            });
        });
        
        const frequentTags = Object.entries(commonTags)
            .filter(([tag, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1]);
        
        issues.push({
            id: 'flop_posts',
            type: 'warning',
            severity: 'warning',
            title: '📉 发现多条扑街作品',
            summary: `${flopPosts.length} 条作品数据表现不佳`,
            description: '多条作品曝光、播放、互动均低于阈值，可能存在选题或内容质量问题。',
            affectedPosts: flopPosts.map(post => ({
                post,
                exposure: post.exposure,
                playRate: post.play_rate,
                engagementRate: post.engagement_rate
            })),
            frequentTags,
            suggestion: '建议：1) 分析扑街作品的共同特征；2) 考虑更换选题方向；3) 参考爆款作品的成功因素。'
        });
    }
    
    return issues;
}

function detectViralOpportunities() {
    const issues = [];
    
    const viralPosts = AppState.posts.filter(p => p.isViral);
    
    if (viralPosts.length > 0) {
        const commonTags = {};
        const commonPromiseTypes = {};
        const commonCoverTypes = {};
        
        viralPosts.forEach(post => {
            (post.tagsArray || []).forEach(tag => {
                commonTags[tag] = (commonTags[tag] || 0) + 1;
            });
            if (post.title_promise_type) {
                commonPromiseTypes[post.title_promise_type] = (commonPromiseTypes[post.title_promise_type] || 0) + 1;
            }
            if (post.cover_type) {
                commonCoverTypes[post.cover_type] = (commonCoverTypes[post.cover_type] || 0) + 1;
            }
        });
        
        issues.push({
            id: 'viral_opportunity',
            type: 'info',
            severity: 'info',
            title: '🔥 发现爆款特征',
            summary: `${viralPosts.length} 条爆款作品，建议复制成功模式`,
            description: '爆款作品具有一些共同特征，分析这些特征可以指导未来的内容创作。',
            affectedPosts: viralPosts.map(post => ({
                post,
                exposure: post.exposure,
                playRate: post.play_rate,
                engagementRate: post.engagement_rate
            })),
            analysis: {
                commonTags,
                commonPromiseTypes,
                commonCoverTypes
            },
            suggestion: '建议：1) 分析爆款作品的标签、标题承诺类型、封面类型；2) 在未来创作中复制这些成功因素；3) 持续测试和优化。'
        });
    }
    
    return issues;
}

function updateIssueCounts() {
    const criticalCount = AppState.issues.filter(i => i.severity === 'critical').length;
    const warningCount = AppState.issues.filter(i => i.severity === 'warning').length;
    const infoCount = AppState.issues.filter(i => i.severity === 'info').length;
    
    document.getElementById('criticalIssues').textContent = criticalCount;
    document.getElementById('warningIssues').textContent = warningCount;
    document.getElementById('infoIssues').textContent = infoCount;
}

function renderIssuesList() {
    const container = document.getElementById('issuesList');
    if (!container) return;
    
    if (AppState.issues.length === 0) {
        container.innerHTML = `
            <div class="insight-item">
                <div class="insight-icon">✅</div>
                <div class="insight-content">
                    <div class="insight-title">数据表现良好</div>
                    <div class="insight-desc">未检测到明显问题，请继续保持。</div>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.issues.map((issue, idx) => `
        <div class="issue-card" data-issue-index="${idx}">
            <div class="issue-header">
                <span class="issue-severity severity-${issue.severity}">
                    ${issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '建议'}
                </span>
                <span class="issue-title">${issue.title}</span>
            </div>
            <div class="issue-affected">${issue.summary}</div>
        </div>
    `).join('');
    
    container.querySelectorAll('.issue-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.issueIndex);
            showIssueDetail(AppState.issues[idx]);
        });
    });
}

function showIssueDetail(issue) {
    const modal = document.getElementById('issueDetailModal');
    const title = document.getElementById('modalIssueTitle');
    const body = document.getElementById('modalIssueBody');
    
    if (!modal || !title || !body) return;
    
    title.textContent = issue.title;
    
    let html = `
        <div class="issue-detail-section">
            <h4>📋 问题描述</h4>
            <p>${issue.description}</p>
        </div>
        <div class="issue-detail-section">
            <h4>💡 改进建议</h4>
            <p>${issue.suggestion}</p>
        </div>
    `;
    
    if (issue.affectedPosts && issue.affectedPosts.length > 0) {
        html += `
            <div class="issue-detail-section affected-posts">
                <h4>📝 涉及作品 (${issue.affectedPosts.length} 条)</h4>
        `;
        
        issue.affectedPosts.slice(0, 10).forEach(item => {
            const post = item.post || item;
            const postTitle = post.title || '未知标题';
            const platform = post.platform || 'unknown';
            
            html += `
                <div class="affected-post-item">
                    <div class="post-title">${postTitle}</div>
                    <div class="post-meta">
                        <span class="platform-badge ${getPlatformBadgeClass(platform)}">${getPlatformName(platform)}</span>
                        ${post.publish_date ? `<span>${post.publish_date}</span>` : ''}
                        ${item.negativeRatio !== undefined ? `<span>负面率: ${formatRate(item.negativeRatio)}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
        if (issue.affectedPosts.length > 10) {
            html += `<p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">... 还有 ${issue.affectedPosts.length - 10} 条</p>`;
        }
        
        html += '</div>';
    }
    
    body.innerHTML = html;
    modal.style.display = 'flex';
}

function closeIssueModal() {
    const modal = document.getElementById('issueDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
