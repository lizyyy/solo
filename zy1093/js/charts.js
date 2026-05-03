window.chartInstances = {};

function renderAllCharts() {
    if (!AppState.analysisResults) return;
    
    renderFunnelChart();
    renderBreakdownChart('platform');
    renderViralFlopChart();
    renderPublishHourChart();
    renderTagPerformanceChart();
    renderPlatformCompareChart();
    renderSentimentChart();
    renderCoverTypeChart();
}

function renderFunnelChart() {
    const canvas = document.getElementById('funnelChart');
    if (!canvas) return;
    
    if (window.chartInstances.funnel) {
        window.chartInstances.funnel.destroy();
    }
    
    const summary = AppState.analysisResults.summary;
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.funnel = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['曝光', '播放', '完播', '互动', '收藏', '转化'],
            datasets: [{
                label: '数量',
                data: [
                    summary.totalExposure,
                    summary.totalPlays,
                    summary.totalCompletions,
                    summary.totalEngagement,
                    summary.totalFavorites,
                    summary.totalConversions
                ],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(99, 102, 241, 0.6)',
                    'rgba(99, 102, 241, 0.5)',
                    'rgba(99, 102, 241, 0.4)',
                    'rgba(99, 102, 241, 0.3)'
                ],
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatNumber(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

function renderBreakdownChart(breakdownType) {
    const canvas = document.getElementById('breakdownChart');
    if (!canvas || !AppState.analysisResults) return;
    
    if (window.chartInstances.breakdown) {
        window.chartInstances.breakdown.destroy();
    }
    
    const breakdowns = AppState.analysisResults.breakdowns;
    let data = breakdowns[breakdownType] || [];
    
    if (data.length === 0) return;
    
    data = data.sort((a, b) => b.totalPlays - a.totalPlays);
    
    let labels = data.map(d => {
        if (breakdownType === 'platform') return getPlatformName(d.key);
        if (breakdownType === 'hour') return `${d.key}点`;
        return d.key;
    });
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.breakdown = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '完播率',
                    data: data.map(d => d.completionRate * 100),
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '互动率',
                    data: data.map(d => d.engagementRate * 100),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function renderViralFlopChart() {
    const canvas = document.getElementById('viralFlopChart');
    if (!canvas) return;
    
    if (window.chartInstances.viralFlop) {
        window.chartInstances.viralFlop.destroy();
    }
    
    const viralPosts = AppState.analysisResults.viralPosts || [];
    const flopPosts = AppState.analysisResults.flopPosts || [];
    const normalPosts = AppState.posts.filter(p => !p.isViral && !p.isFlop);
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.viralFlop = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['爆款', '扑街', '正常'],
            datasets: [{
                data: [viralPosts.length, flopPosts.length, normalPosts.length],
                backgroundColor: [
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(99, 102, 241, 0.8)'
                ],
                borderColor: [
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(99, 102, 241, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} 条`;
                        }
                    }
                }
            }
        }
    });
}

function renderPublishHourChart() {
    const canvas = document.getElementById('publishHourChart');
    if (!canvas) return;
    
    if (window.chartInstances.publishHour) {
        window.chartInstances.publishHour.destroy();
    }
    
    const hourData = {};
    for (let i = 0; i < 24; i++) {
        hourData[i] = { count: 0, totalPlayRate: 0, totalEngagementRate: 0 };
    }
    
    AppState.posts.forEach(post => {
        const hour = parseInt(post.publish_hour) || 0;
        if (hourData[hour]) {
            hourData[hour].count++;
            hourData[hour].totalPlayRate += post.play_rate || 0;
            hourData[hour].totalEngagementRate += post.engagement_rate || 0;
        }
    });
    
    const labels = Object.keys(hourData).map(h => `${h}点`);
    const counts = Object.values(hourData).map(d => d.count);
    const avgPlayRates = Object.values(hourData).map(d => d.count > 0 ? (d.totalPlayRate / d.count) * 100 : 0);
    const avgEngagementRates = Object.values(hourData).map(d => d.count > 0 ? (d.totalEngagementRate / d.count) * 100 : 0);
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.publishHour = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '发布数量',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: '平均播放率',
                    data: avgPlayRates,
                    type: 'line',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '发布数量'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '播放率 (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    max: 100
                }
            }
        }
    });
}

function renderTagPerformanceChart() {
    const canvas = document.getElementById('tagPerformanceChart');
    if (!canvas) return;
    
    if (window.chartInstances.tagPerformance) {
        window.chartInstances.tagPerformance.destroy();
    }
    
    const tagBreakdown = AppState.analysisResults.breakdowns?.tag || [];
    if (tagBreakdown.length === 0) return;
    
    const sortedTags = tagBreakdown
        .filter(t => t.count >= 2)
        .sort((a, b) => b.totalPlays - a.totalPlays)
        .slice(0, 10);
    
    if (sortedTags.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.tagPerformance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedTags.map(t => t.key),
            datasets: [{
                label: '总播放量',
                data: sortedTags.map(t => t.totalPlays),
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `播放量: ${formatNumber(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

function renderPlatformCompareChart() {
    const canvas = document.getElementById('platformCompareChart');
    if (!canvas) return;
    
    if (window.chartInstances.platformCompare) {
        window.chartInstances.platformCompare.destroy();
    }
    
    const platformBreakdown = AppState.analysisResults.breakdowns?.platform || [];
    if (platformBreakdown.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.platformCompare = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['播放率', '完播率', '互动率', '收藏率', '转化效率'],
            datasets: platformBreakdown.map((platform, idx) => {
                const colors = [
                    { bg: 'rgba(255, 45, 85, 0.2)', border: 'rgba(255, 45, 85, 1)' },
                    { bg: 'rgba(0, 0, 0, 0.2)', border: 'rgba(0, 0, 0, 1)' },
                    { bg: 'rgba(7, 193, 96, 0.2)', border: 'rgba(7, 193, 96, 1)' }
                ];
                const color = colors[idx % colors.length];
                
                return {
                    label: getPlatformName(platform.key),
                    data: [
                        platform.playRate * 100,
                        platform.completionRate * 100,
                        platform.engagementRate * 100,
                        platform.favoriteRate * 100,
                        platform.conversionRate * 100
                    ],
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 2,
                    pointBackgroundColor: color.border
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function renderSentimentChart() {
    const canvas = document.getElementById('sentimentChart');
    if (!canvas) return;
    
    if (window.chartInstances.sentiment) {
        window.chartInstances.sentiment.destroy();
    }
    
    if (AppState.comments.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('暂无评论数据', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    let positive = 0, neutral = 0, negative = 0;
    AppState.comments.forEach(comment => {
        const sentiment = comment.sentiment || 'neutral';
        if (sentiment === 'positive') positive++;
        else if (sentiment === 'negative') negative++;
        else neutral++;
    });
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.sentiment = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['正面', '中性', '负面'],
            datasets: [{
                data: [positive, neutral, negative],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(99, 102, 241, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} 条 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderCoverTypeChart() {
    const canvas = document.getElementById('coverTypeChart');
    if (!canvas) return;
    
    if (window.chartInstances.coverType) {
        window.chartInstances.coverType.destroy();
    }
    
    const coverBreakdown = AppState.analysisResults.breakdowns?.cover || [];
    if (coverBreakdown.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    window.chartInstances.coverType = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: coverBreakdown.map(c => c.key || '未知'),
            datasets: [
                {
                    label: '完播率',
                    data: coverBreakdown.map(c => c.completionRate * 100),
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1
                },
                {
                    label: '互动率',
                    data: coverBreakdown.map(c => c.engagementRate * 100),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}
