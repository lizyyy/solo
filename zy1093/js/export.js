function exportReport(format) {
    if (!AppState.isDataLoaded) {
        showToast('请先导入数据', 'warning');
        return;
    }
    
    const reportData = generateReportData();
    
    switch (format) {
        case 'markdown':
            downloadFile(generateMarkdownReport(reportData), 'video-analysis-report.md', 'text/markdown');
            break;
        case 'html':
            downloadFile(generateHtmlReport(reportData), 'video-analysis-report.html', 'text/html');
            break;
        case 'json':
            downloadFile(JSON.stringify(reportData, null, 2), 'video-analysis-report.json', 'application/json');
            break;
    }
    
    showToast(`报告已导出为 ${format.toUpperCase()} 格式`, 'success');
}

function generateReportData() {
    const summary = AppState.analysisResults?.summary || {};
    const issues = AppState.issues || [];
    const priorities = AppState.priorityScores || [];
    const viralPosts = AppState.analysisResults?.viralPosts || [];
    const flopPosts = AppState.analysisResults?.flopPosts || [];
    
    return {
        generatedAt: new Date().toISOString(),
        period: getDateRange(),
        summary: {
            totalPosts: AppState.posts.length,
            totalComments: AppState.comments.length,
            totalExposure: summary.totalExposure || 0,
            totalPlays: summary.totalPlays || 0,
            totalCompletions: summary.totalCompletions || 0,
            totalEngagement: summary.totalEngagement || 0,
            totalFavorites: summary.totalFavorites || 0,
            totalConversions: summary.totalConversions || 0,
            playRate: summary.playRate || 0,
            completionRate: summary.completionRate || 0,
            engagementRate: summary.engagementRate || 0,
            favoriteRate: summary.favoriteRate || 0,
            conversionRate: summary.conversionRate || 0
        },
        funnel: {
            exposure: summary.totalExposure || 0,
            plays: summary.totalPlays || 0,
            completions: summary.totalCompletions || 0,
            engagement: summary.totalEngagement || 0,
            favorites: summary.totalFavorites || 0,
            conversions: summary.totalConversions || 0
        },
        issues: issues.map(issue => ({
            id: issue.id,
            title: issue.title,
            severity: issue.severity,
            summary: issue.summary,
            description: issue.description,
            suggestion: issue.suggestion,
            affectedCount: issue.affectedPosts?.length || 0
        })),
        priorities: priorities.map((p, idx) => ({
            rank: idx + 1,
            title: p.title,
            plannedDate: p.planned_date,
            status: p.status,
            score: p.score,
            tags: p.planTags || []
        })),
        highlights: {
            viralCount: viralPosts.length,
            flopCount: flopPosts.length,
            criticalIssues: issues.filter(i => i.severity === 'critical').length,
            warningIssues: issues.filter(i => i.severity === 'warning').length,
            infoIssues: issues.filter(i => i.severity === 'info').length
        },
        platforms: getPlatformBreakdown(),
        topTags: getTopTags(10)
    };
}

function getDateRange() {
    if (AppState.posts.length === 0) return null;
    
    const dates = AppState.posts
        .map(p => p.publish_date)
        .filter(d => d)
        .sort();
    
    if (dates.length === 0) return null;
    
    return {
        start: dates[0],
        end: dates[dates.length - 1]
    };
}

function getPlatformBreakdown() {
    const breakdown = {};
    AppState.posts.forEach(post => {
        const platform = post.platform || 'unknown';
        if (!breakdown[platform]) {
            breakdown[platform] = { count: 0, totalPlays: 0, totalExposure: 0 };
        }
        breakdown[platform].count++;
        breakdown[platform].totalPlays += post.plays || 0;
        breakdown[platform].totalExposure += post.exposure || 0;
    });
    
    return Object.entries(breakdown).map(([key, data]) => ({
        platform: key,
        platformName: getPlatformName(key),
        ...data
    }));
}

function getTopTags(limit = 10) {
    const tagCounts = {};
    AppState.posts.forEach(post => {
        (post.tagsArray || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    
    return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));
}

function generateMarkdownReport(data) {
    let md = `# 短视频选题复盘分析报告

生成时间: ${new Date(data.generatedAt).toLocaleString()}

`;

    if (data.period) {
        md += `分析周期: ${data.period.start} 至 ${data.period.end}

`;
    }

    md += `## 📊 核心数据概览

| 指标 | 数值 |
|------|------|
| 作品总数 | ${data.summary.totalPosts} 条 |
| 评论总数 | ${data.summary.totalComments} 条 |
| 总曝光量 | ${formatNumber(data.summary.totalExposure)} |
| 总播放量 | ${formatNumber(data.summary.totalPlays)} |
| 总完播量 | ${formatNumber(data.summary.totalCompletions)} |
| 总互动量 | ${formatNumber(data.summary.totalEngagement)} |
| 总收藏量 | ${formatNumber(data.summary.totalFavorites)} |
| 总转化量 | ${formatNumber(data.summary.totalConversions)} |

### 关键比率

| 指标 | 数值 | 评价 |
|------|------|------|
| 播放率 | ${formatRate(data.summary.playRate)} | ${getRateComment(data.summary.playRate, 'play_rate')} |
| 完播率 | ${formatRate(data.summary.completionRate)} | ${getRateComment(data.summary.completionRate, 'completion_rate')} |
| 互动率 | ${formatRate(data.summary.engagementRate)} | ${getRateComment(data.summary.engagementRate, 'engagement_rate')} |
| 收藏率 | ${formatRate(data.summary.favoriteRate)} | ${getRateComment(data.summary.favoriteRate, 'favorite_rate')} |
| 转化效率 | ${formatRate(data.summary.conversionRate)} | ${getRateComment(data.summary.conversionRate, 'conversion_rate')} |

## 🔄 漏斗分析

\`\`\`
曝光: ${formatNumber(data.funnel.exposure)}
  ↓
播放: ${formatNumber(data.funnel.plays)} (转化率: ${formatRate(data.summary.playRate)})
  ↓
完播: ${formatNumber(data.funnel.completions)} (转化率: ${formatRate(data.summary.completionRate)})
  ↓
互动: ${formatNumber(data.funnel.engagement)} (转化率: ${formatRate(data.summary.engagementRate)})
  ↓
收藏: ${formatNumber(data.funnel.favorites)} (转化率: ${formatRate(data.summary.favoriteRate)})
  ↓
转化: ${formatNumber(data.funnel.conversions)} (转化率: ${formatRate(data.summary.conversionRate)})
\`\`\`

## ⚠️ 问题检测

### 问题统计

- 🔥 爆款作品: ${data.highlights.viralCount} 条
- 📉 扑街作品: ${data.highlights.flopCount} 条
- 🔴 严重问题: ${data.highlights.criticalIssues} 个
- 🟡 警告问题: ${data.highlights.warningIssues} 个
- ℹ️ 优化建议: ${data.highlights.infoIssues} 个

`;

    if (data.issues.length > 0) {
        md += `### 问题详情

`;
        data.issues.forEach(issue => {
            const severityEmoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
            md += `#### ${severityEmoji} ${issue.title}

- **严重程度**: ${issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '建议'}
- **影响作品**: ${issue.affectedCount} 条
- **描述**: ${issue.description}
- **建议**: ${issue.suggestion}

`;
        });
    }

    if (data.priorities.length > 0) {
        md += `## 📋 下周选题优先级

| 排名 | 选题标题 | 计划日期 | 状态 | 综合评分 |
|------|----------|----------|------|----------|
`;
        data.priorities.forEach(p => {
            md += `| ${p.rank} | ${p.title} | ${p.plannedDate || '待定'} | ${p.status || 'draft'} | ${p.score} |
`;
        });
        md += '\n';
    }

    if (data.platforms.length > 0) {
        md += `## 📈 平台分布

| 平台 | 作品数 | 总播放量 | 总曝光量 |
|------|--------|----------|----------|
`;
        data.platforms.forEach(p => {
            md += `| ${p.platformName} | ${p.count} | ${formatNumber(p.totalPlays)} | ${formatNumber(p.totalExposure)} |
`;
        });
        md += '\n';
    }

    if (data.topTags.length > 0) {
        md += `## 🏷️ 热门选题标签

| 标签 | 使用次数 |
|------|----------|
`;
        data.topTags.forEach(t => {
            md += `| ${t.tag} | ${t.count} 次 |
`;
        });
        md += '\n';
    }

    md += `---

*此报告由短视频选题复盘分析台自动生成*
`;

    return md;
}

function getRateComment(rate, type) {
    const thresholds = DEFAULT_THRESHOLDS.funnel_thresholds[type];
    if (rate >= thresholds.excellent) return '优秀';
    if (rate >= thresholds.good) return '良好';
    if (rate >= thresholds.warning) return '一般';
    return '偏低';
}

function generateHtmlReport(data) {
    const issueSeverityClass = (severity) => {
        if (severity === 'critical') return 'background: #fee2e2; color: #991b1b;';
        if (severity === 'warning') return 'background: #fef3c7; color: #92400e;';
        return 'background: #dbeafe; color: #1e40af;';
    };

    const scoreColor = (score) => {
        if (score >= 5) return 'color: #22c55e;';
        if (score < 0) return 'color: #ef4444;';
        return 'color: #1e293b;';
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>短视频选题复盘分析报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 { font-size: 28px; margin-bottom: 8px; color: #1e293b; }
        h2 { font-size: 22px; margin-top: 32px; margin-bottom: 16px; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
        h3 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #64748b; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; color: #475569; }
        tr:hover td { background: #f8fafc; }
        .funnel-box {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 24px;
            border-radius: 8px;
            margin: 16px 0;
        }
        .funnel-step {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
        }
        .funnel-arrow { text-align: center; font-size: 20px; opacity: 0.7; }
        .issue-card {
            padding: 16px;
            border-radius: 8px;
            margin: 12px 0;
            border-left: 4px solid;
        }
        .issue-critical { background: #fef2f2; border-left-color: #ef4444; }
        .issue-warning { background: #fffbeb; border-left-color: #f59e0b; }
        .issue-info { background: #eff6ff; border-left-color: #3b82f6; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin: 16px 0;
        }
        .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value { font-size: 24px; font-weight: 700; color: #6366f1; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 短视频选题复盘分析报告</h1>
        <div class="meta">
            生成时间: ${new Date(data.generatedAt).toLocaleString()}
            ${data.period ? ` | 分析周期: ${data.period.start} 至 ${data.period.end}` : ''}
        </div>

        <h2>📈 核心数据概览</h2>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${data.summary.totalPosts}</div>
                <div class="stat-label">作品总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatNumber(data.summary.totalPlays)}</div>
                <div class="stat-label">总播放量</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatNumber(data.summary.totalExposure)}</div>
                <div class="stat-label">总曝光量</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatRate(data.summary.completionRate)}</div>
                <div class="stat-label">完播率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatRate(data.summary.engagementRate)}</div>
                <div class="stat-label">互动率</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatNumber(data.summary.totalConversions)}</div>
                <div class="stat-label">总转化数</div>
            </div>
        </div>

        <h3>关键比率</h3>
        <table>
            <tr><th>指标</th><th>数值</th><th>评价</th></tr>
            <tr><td>播放率</td><td>${formatRate(data.summary.playRate)}</td><td>${getRateComment(data.summary.playRate, 'play_rate')}</td></tr>
            <tr><td>完播率</td><td>${formatRate(data.summary.completionRate)}</td><td>${getRateComment(data.summary.completionRate, 'completion_rate')}</td></tr>
            <tr><td>互动率</td><td>${formatRate(data.summary.engagementRate)}</td><td>${getRateComment(data.summary.engagementRate, 'engagement_rate')}</td></tr>
            <tr><td>收藏率</td><td>${formatRate(data.summary.favoriteRate)}</td><td>${getRateComment(data.summary.favoriteRate, 'favorite_rate')}</td></tr>
            <tr><td>转化效率</td><td>${formatRate(data.summary.conversionRate)}</td><td>${getRateComment(data.summary.conversionRate, 'conversion_rate')}</td></tr>
        </table>

        <h2>🔄 漏斗分析</h2>
        <div class="funnel-box">
            <div class="funnel-step">
                <span>👁️ 曝光</span>
                <span>${formatNumber(data.funnel.exposure)}</span>
            </div>
            <div class="funnel-arrow">↓ ${formatRate(data.summary.playRate)}</div>
            <div class="funnel-step">
                <span>▶️ 播放</span>
                <span>${formatNumber(data.funnel.plays)}</span>
            </div>
            <div class="funnel-arrow">↓ ${formatRate(data.summary.completionRate)}</div>
            <div class="funnel-step">
                <span>✅ 完播</span>
                <span>${formatNumber(data.funnel.completions)}</span>
            </div>
            <div class="funnel-arrow">↓ ${formatRate(data.summary.engagementRate)}</div>
            <div class="funnel-step">
                <span>💬 互动</span>
                <span>${formatNumber(data.funnel.engagement)}</span>
            </div>
            <div class="funnel-arrow">↓ ${formatRate(data.summary.favoriteRate)}</div>
            <div class="funnel-step">
                <span>⭐ 收藏</span>
                <span>${formatNumber(data.funnel.favorites)}</span>
            </div>
            <div class="funnel-arrow">↓ ${formatRate(data.summary.conversionRate)}</div>
            <div class="funnel-step">
                <span>🎯 转化</span>
                <span>${formatNumber(data.funnel.conversions)}</span>
            </div>
        </div>

        <h2>⚠️ 问题检测</h2>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" style="color: #f59e0b;">${data.highlights.viralCount}</div>
                <div class="stat-label">🔥 爆款作品</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #ef4444;">${data.highlights.flopCount}</div>
                <div class="stat-label">📉 扑街作品</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #ef4444;">${data.highlights.criticalIssues}</div>
                <div class="stat-label">🔴 严重问题</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #f59e0b;">${data.highlights.warningIssues}</div>
                <div class="stat-label">🟡 警告问题</div>
            </div>
        </div>

        ${data.issues.length > 0 ? data.issues.map(issue => `
        <div class="issue-card issue-${issue.severity}">
            <h3 style="margin-top: 0; margin-bottom: 8px;">${issue.title}</h3>
            <p><span class="badge" style="${issueSeverityClass(issue.severity)}">${issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '建议'}</span> 影响 ${issue.affectedCount} 条作品</p>
            <p style="margin: 8px 0;"><strong>描述:</strong> ${issue.description}</p>
            <p style="margin: 8px 0;"><strong>建议:</strong> ${issue.suggestion}</p>
        </div>
        `).join('') : '<p style="color: #64748b;">未检测到明显问题，数据表现良好。</p>'}

        ${data.priorities.length > 0 ? `
        <h2>📋 下周选题优先级</h2>
        <table>
            <tr><th>排名</th><th>选题标题</th><th>计划日期</th><th>状态</th><th>综合评分</th></tr>
            ${data.priorities.map(p => `
            <tr>
                <td>${p.rank}</td>
                <td>${p.title}</td>
                <td>${p.plannedDate || '待定'}</td>
                <td><span class="badge" style="background: #e0e7ff; color: #4338ca;">${p.status || 'draft'}</span></td>
                <td style="font-weight: 600; ${scoreColor(p.score)}">${p.score}</td>
            </tr>
            `).join('')}
        </table>
        ` : ''}

        <div class="footer">
            此报告由短视频选题复盘分析台自动生成 | ${new Date().toLocaleDateString()}
        </div>
    </div>
</body>
</html>
`;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function updateReportPreview(previewType) {
    const container = document.getElementById('reportPreview');
    if (!container) return;
    
    if (!AppState.isDataLoaded) {
        container.innerHTML = '<p class="empty-text">暂无数据，先导入数据进行分析</p>';
        return;
    }
    
    const reportData = generateReportData();
    
    switch (previewType) {
        case 'summary':
            renderSummaryPreview(container, reportData);
            break;
        case 'funnel':
            renderFunnelPreview(container, reportData);
            break;
        case 'issues':
            renderIssuesPreview(container, reportData);
            break;
        case 'priority':
            renderPriorityPreview(container, reportData);
            break;
    }
}

function renderSummaryPreview(container, data) {
    container.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #6366f1;">${data.summary.totalPosts}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">作品总数</div>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${formatNumber(data.summary.totalPlays)}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">总播放量</div>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${formatRate(data.summary.completionRate)}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">完播率</div>
            </div>
        </div>
        
        <h4 style="margin-bottom: 12px; color: #475569;">关键比率</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">指标</th>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">数值</th>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">评价</th></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">播放率</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${formatRate(data.summary.playRate)}</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${getRateComment(data.summary.playRate, 'play_rate')}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">完播率</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${formatRate(data.summary.completionRate)}</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${getRateComment(data.summary.completionRate, 'completion_rate')}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">互动率</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${formatRate(data.summary.engagementRate)}</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${getRateComment(data.summary.engagementRate, 'engagement_rate')}</td></tr>
        </table>
    `;
}

function renderFunnelPreview(container, data) {
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 24px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span>👁️ 曝光</span>
                <span style="font-weight: 600;">${formatNumber(data.funnel.exposure)}</span>
            </div>
            <div style="text-align: center; padding: 4px; opacity: 0.8;">↓ ${formatRate(data.summary.playRate)}</div>
            
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span>▶️ 播放</span>
                <span style="font-weight: 600;">${formatNumber(data.funnel.plays)}</span>
            </div>
            <div style="text-align: center; padding: 4px; opacity: 0.8;">↓ ${formatRate(data.summary.completionRate)}</div>
            
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span>✅ 完播</span>
                <span style="font-weight: 600;">${formatNumber(data.funnel.completions)}</span>
            </div>
            <div style="text-align: center; padding: 4px; opacity: 0.8;">↓ ${formatRate(data.summary.engagementRate)}</div>
            
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <span>💬 互动</span>
                <span style="font-weight: 600;">${formatNumber(data.funnel.engagement)}</span>
            </div>
            <div style="text-align: center; padding: 4px; opacity: 0.8;">↓ ${formatRate(data.summary.favoriteRate)}</div>
            
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span>⭐ 收藏</span>
                <span style="font-weight: 600;">${formatNumber(data.funnel.favorites)}</span>
            </div>
        </div>
    `;
}

function renderIssuesPreview(container, data) {
    if (data.issues.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">✅ 未检测到明显问题，数据表现良好</div>';
        return;
    }
    
    container.innerHTML = data.issues.map(issue => {
        const bgColor = issue.severity === 'critical' ? '#fef2f2' : issue.severity === 'warning' ? '#fffbeb' : '#eff6ff';
        const borderColor = issue.severity === 'critical' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6';
        
        return `
            <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px; border-radius: 4px; margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 8px;">${issue.title}</div>
                <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">影响 ${issue.affectedCount} 条作品</div>
                <div style="font-size: 13px;">${issue.description}</div>
            </div>
        `;
    }).join('');
}

function renderPriorityPreview(container, data) {
    if (data.priorities.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">暂无选题计划，请导入 topics.json</div>';
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">排名</th>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">选题标题</th>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">计划日期</th>
                <th style="background: #f8fafc; padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">评分</th>
            </tr>
            ${data.priorities.slice(0, 5).map(p => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${p.rank}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${p.title}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${p.plannedDate || '待定'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; ${p.score >= 5 ? 'color: #22c55e;' : p.score < 0 ? 'color: #ef4444;' : ''}">${p.score}</td>
            </tr>
            `).join('')}
        </table>
        ${data.priorities.length > 5 ? `<div style="text-align: center; color: #64748b; font-size: 12px; margin-top: 12px;">... 还有 ${data.priorities.length - 5} 条选题</div>` : ''}
    `;
}
