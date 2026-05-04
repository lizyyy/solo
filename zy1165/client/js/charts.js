const CHART_COLORS = {
  tokenBucket: '#3b82f6',
  leakyBucket: '#8b5cf6',
  allowed: '#10b981',
  queued: '#f59e0b',
  rejected: '#ef4444',
  timeout: '#6366f1'
};

function createChartConfig(type, data, options = {}) {
  return {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...options
    }
  };
}

function renderAllowRateChart(tbStats, lbStats) {
  const ctx = document.getElementById('allowRateChart').getContext('2d');
  
  if (allowRateChart) {
    allowRateChart.destroy();
  }
  
  const tbAllowRate = (tbStats.allowed / tbStats.total * 100).toFixed(1);
  const lbAllowRate = (lbStats.allowed / lbStats.total * 100).toFixed(1);
  
  const config = createChartConfig('bar', {
    labels: ['令牌桶', '漏桶'],
    datasets: [
      {
        label: '放行率 (%)',
        data: [parseFloat(tbAllowRate), parseFloat(lbAllowRate)],
        backgroundColor: [CHART_COLORS.tokenBucket, CHART_COLORS.leakyBucket],
        borderRadius: 8
      }
    ]
  }, {
    indexAxis: 'y',
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value) => value + '%'
        }
      }
    }
  });
  
  allowRateChart = new Chart(ctx, config);
}

function renderTimelineChart(result) {
  const ctx = document.getElementById('timelineChart').getContext('2d');
  
  if (timelineChart) {
    timelineChart.destroy();
  }
  
  const { tokenBucket, leakyBucket, requests } = result;
  
  const sampleInterval = Math.max(1, Math.floor(requests.length / 100));
  const sampledTimes = [];
  const tbAllowedCounts = [];
  const tbRejectedCounts = [];
  const lbAllowedCounts = [];
  const lbQueuedCounts = [];
  const lbRejectedCounts = [];
  const lbTimeoutCounts = [];
  
  let tbAllowed = 0, tbRejected = 0;
  let lbAllowed = 0, lbQueued = 0, lbRejected = 0, lbTimeout = 0;
  
  tokenBucket.timeline.forEach((item, i) => {
    if (item.status === 'allowed') tbAllowed++;
    else if (item.status === 'rejected') tbRejected++;
    
    const lbItem = leakyBucket.timeline[i];
    if (lbItem.status === 'allowed') lbAllowed++;
    else if (lbItem.status === 'queued') lbQueued++;
    else if (lbItem.status === 'rejected') lbRejected++;
    else if (lbItem.status === 'timeout') lbTimeout++;
    
    if (i % sampleInterval === 0 || i === tokenBucket.timeline.length - 1) {
      sampledTimes.push((item.time / 1000).toFixed(1));
      tbAllowedCounts.push(tbAllowed);
      tbRejectedCounts.push(tbRejected);
      lbAllowedCounts.push(lbAllowed);
      lbQueuedCounts.push(lbQueued);
      lbRejectedCounts.push(lbRejected);
      lbTimeoutCounts.push(lbTimeout);
    }
  });
  
  const config = createChartConfig('line', {
    labels: sampledTimes,
    datasets: [
      {
        label: '令牌桶-放行',
        data: tbAllowedCounts,
        borderColor: CHART_COLORS.tokenBucket,
        backgroundColor: CHART_COLORS.tokenBucket + '20',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      },
      {
        label: '令牌桶-拒绝',
        data: tbRejectedCounts,
        borderColor: CHART_COLORS.rejected,
        backgroundColor: CHART_COLORS.rejected + '20',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      },
      {
        label: '漏桶-放行',
        data: lbAllowedCounts,
        borderColor: CHART_COLORS.leakyBucket,
        backgroundColor: CHART_COLORS.leakyBucket + '20',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      },
      {
        label: '漏桶-排队',
        data: lbQueuedCounts,
        borderColor: CHART_COLORS.queued,
        backgroundColor: CHART_COLORS.queued + '20',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      }
    ]
  }, {
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '时间 (秒)'
        }
      },
      y: {
        title: {
          display: true,
          text: '请求数'
        },
        beginAtZero: true
      }
    }
  });
  
  timelineChart = new Chart(ctx, config);
}

function renderLevelChart(result) {
  const ctx = document.getElementById('levelChart').getContext('2d');
  
  if (levelChart) {
    levelChart.destroy();
  }
  
  const { tokenBucket, leakyBucket } = result;
  
  const sampleInterval = Math.max(1, Math.floor(tokenBucket.tokenLevels.length / 100));
  const sampledTimes = [];
  const tokenLevels = [];
  const waterLevels = [];
  
  tokenBucket.tokenLevels.forEach((item, i) => {
    if (i % sampleInterval === 0 || i === tokenBucket.tokenLevels.length - 1) {
      sampledTimes.push((item.time / 1000).toFixed(1));
      tokenLevels.push(item.tokens);
      waterLevels.push(leakyBucket.waterLevels[i]?.water || 0);
    }
  });
  
  const config = createChartConfig('line', {
    labels: sampledTimes,
    datasets: [
      {
        label: '令牌桶-令牌数',
        data: tokenLevels,
        borderColor: CHART_COLORS.tokenBucket,
        backgroundColor: CHART_COLORS.tokenBucket + '30',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      },
      {
        label: '漏桶-水位',
        data: waterLevels,
        borderColor: CHART_COLORS.leakyBucket,
        backgroundColor: CHART_COLORS.leakyBucket + '30',
        fill: true,
        tension: 0.1,
        pointRadius: 2
      }
    ]
  }, {
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '时间 (秒)'
        }
      },
      y: {
        title: {
          display: true,
          text: '数量'
        },
        beginAtZero: true
      }
    }
  });
  
  levelChart = new Chart(ctx, config);
}

function renderLatencyCharts(tbDistribution, lbDistribution) {
  renderSingleLatencyChart('tbLatencyChart', tbDistribution, '令牌桶', CHART_COLORS.tokenBucket);
  renderSingleLatencyChart('lbLatencyChart', lbDistribution, '漏桶', CHART_COLORS.leakyBucket);
}

function renderSingleLatencyChart(canvasId, distribution, label, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  if (canvasId === 'tbLatencyChart' && tbLatencyChart) {
    tbLatencyChart.destroy();
  }
  if (canvasId === 'lbLatencyChart' && lbLatencyChart) {
    lbLatencyChart.destroy();
  }
  
  const labels = distribution.map(d => d.range);
  const data = distribution.map(d => d.count);
  
  const config = createChartConfig('bar', {
    labels,
    datasets: [
      {
        label: `${label} 请求数`,
        data,
        backgroundColor: color,
        borderRadius: 4
      }
    ]
  }, {
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '延迟范围 (ms)'
        }
      },
      y: {
        title: {
          display: true,
          text: '请求数'
        },
        beginAtZero: true
      }
    }
  });
  
  if (canvasId === 'tbLatencyChart') {
    tbLatencyChart = new Chart(ctx, config);
  } else {
    lbLatencyChart = new Chart(ctx, config);
  }
}
