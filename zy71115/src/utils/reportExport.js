import { weatherConfig } from '../data/sampleData.js';

export function generateReport(trailData, weather, progress, filters) {
  if (!trailData) return null;
  
  const points = trailData.trailPoints;
  const elevations = points.map(p => p.elevation);
  
  let totalClimb = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elevation - points[i - 1].elevation;
    if (diff > 0) totalClimb += diff;
  }
  
  const weatherInfo = weatherConfig[weather] || weatherConfig.sunny;
  
  const riskLevels = { low: '低风险', medium: '中风险', high: '高风险' };
  const supplyTypes = { water: '饮水站', full: '综合服务', snack: '补给点', view: '观景点' };
  
  const isRainy = weather === 'rainy' || weather === 'stormy';
  const visibleRisks = trailData.riskSegments?.filter(r => {
    const levelMatch = filters.riskLevel === 'all' || r.level === filters.riskLevel;
    const notClosed = !(isRainy && r.closedInRain);
    return levelMatch && notClosed;
  }) || [];
  
  const advice = getWeatherAdvice(weather, visibleRisks);
  
  return {
    trailName: trailData.name,
    totalLength: points[points.length - 1].distance.toFixed(1) + ' km',
    maxElevation: Math.max(...elevations).toFixed(0) + ' m',
    totalClimb: totalClimb.toFixed(0) + ' m',
    weather: weatherInfo.icon + ' ' + weatherInfo.title,
    advice: advice,
    riskCount: visibleRisks.length + ' 处',
    supplyCount: (trailData.supplyStations?.length || 0) + ' 个',
    progress: Math.round(progress * 100),
    date: new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  };
}

function getWeatherAdvice(weather, risks) {
  const advices = {
    sunny: '天气晴好，适合徒步。建议携带防晒用品和充足饮水。',
    cloudy: '天气多云，适宜出行。注意防晒并做好防雨准备。',
    rainy: '有降雨，路面湿滑。建议穿着防滑鞋具，部分危险路段可能关闭。',
    stormy: '暴雨天气，不建议徒步。如已在途中，请尽快寻找安全地点躲避。'
  };
  
  let advice = advices[weather] || advices.sunny;
  
  if (risks.length > 0) {
    const highRisks = risks.filter(r => r.level === 'high').length;
    if (highRisks > 0) {
      advice += ` 途经 ${highRisks} 处高风险路段，请特别注意安全。`;
    }
  }
  
  return advice;
}

export function downloadReportImage(reportCardElement, filename) {
  return new Promise((resolve, reject) => {
    import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
      .then(() => {
        window.html2canvas(reportCardElement, {
          backgroundColor: '#1a1a2e',
          scale: 2,
          useCORS: true
        }).then(canvas => {
          const link = document.createElement('a');
          link.download = filename || 'trail-report.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
          resolve();
        }).catch(reject);
      })
      .catch(reject);
  });
}

export function copyReportText(report) {
  const text = `
🏔️ 山地步道导览报告
━━━━━━━━━━━━━━━━━━━━
📅 生成时间: ${report.date}

【基本信息】
步道名称: ${report.trailName}
总长度: ${report.totalLength}
最高海拔: ${report.maxElevation}
累计爬升: ${report.totalClimb}

【天气与安全】
当前天气: ${report.weather}
徒步建议: ${report.advice}
风险路段: ${report.riskCount}
补给站点: ${report.supplyCount}

【行程进度】
进度: ${report.progress}%

━━━━━━━━━━━━━━━━━━━━
🏔️ 山地步道海拔导览系统
  `.trim();
  
  return navigator.clipboard.writeText(text);
}
