import type { StudentWork, PortfolioScore, FilterCriteria, Anomaly } from '../types';

export function calculatePortfolioScore(
  works: StudentWork[],
  criteria: FilterCriteria
): PortfolioScore {
  if (works.length === 0) {
    return {
      overall: 0,
      dimensions: {
        themeDiversity: 0,
        mediumRichness: 0,
        completionBalance: 0,
        copyrightCompliance: 0,
        directionMatch: 0,
        qualityLevel: 0
      }
    };
  }

  const uniqueTags = new Set(works.flatMap(w => w.tags));
  const themeDiversity = Math.min(100, (uniqueTags.size / works.length) * 50);

  const uniqueMediums = new Set(works.flatMap(w => w.mediums));
  const mediumRichness = Math.min(100, (uniqueMediums.size / works.length) * 40);

  const completionLevels = works.map(w => w.completion);
  const avgCompletion = completionLevels.reduce((a, b) => a + b, 0) / completionLevels.length;
  const completionVariance = Math.sqrt(
    completionLevels.reduce((sum, l) => sum + Math.pow(l - avgCompletion, 2), 0) / completionLevels.length
  );
  const completionBalance = Math.max(0, 100 - completionVariance * 25) * (avgCompletion / 5);

  const worksWithClearance = works.filter(w => w.copyright.hasClearance).length;
  const copyrightCompliance = (worksWithClearance / works.length) * 100;

  let directionMatch = 50;
  if (criteria.applicationDirection) {
    const matchingWorks = works.filter(w =>
      w.applicationDirection.includes(criteria.applicationDirection!)
    ).length;
    directionMatch = (matchingWorks / works.length) * 100;
  } else {
    const dirCounts: Record<string, number> = {};
    works.forEach(w => {
      w.applicationDirection.forEach(d => {
        dirCounts[d] = (dirCounts[d] || 0) + 1;
      });
    });
    const maxDirCount = Math.max(...Object.values(dirCounts), 1);
    directionMatch = (maxDirCount / works.length) * 100;
  }

  const qualityLevel = (avgCompletion / 5) * 100;

  const overall = Math.round(
    themeDiversity * 0.2 +
    mediumRichness * 0.2 +
    completionBalance * 0.2 +
    copyrightCompliance * 0.2 +
    directionMatch * 0.15 +
    qualityLevel * 0.05
  );

  return {
    overall,
    dimensions: {
      themeDiversity: Math.round(themeDiversity),
      mediumRichness: Math.round(mediumRichness),
      completionBalance: Math.round(completionBalance),
      copyrightCompliance: Math.round(copyrightCompliance),
      directionMatch: Math.round(directionMatch),
      qualityLevel: Math.round(qualityLevel)
    }
  };
}

export function detectAnomalies(works: StudentWork[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const tagCounts: Record<string, string[]> = {};
  works.forEach(work => {
    work.tags.forEach(tag => {
      if (!tagCounts[tag]) tagCounts[tag] = [];
      tagCounts[tag].push(work.id);
    });
  });

  Object.entries(tagCounts).forEach(([tag, workIds]) => {
    if (workIds.length >= 3) {
      anomalies.push({
        id: `anomaly-dup-${tag}`,
        type: 'duplicate_theme',
        severity: workIds.length >= 5 ? 'critical' : 'warning',
        description: `主题「${tag}」出现 ${workIds.length} 次，题材过于集中，建议增加多样性`,
        relatedWorkIds: workIds,
        createdAt: new Date().toISOString()
      });
    }
  });

  const lowCompletionWorks = works.filter(w => w.completion <= 2);
  if (lowCompletionWorks.length > 0) {
    anomalies.push({
      id: 'anomaly-low-completion',
      type: 'low_completion',
      severity: lowCompletionWorks.length >= 3 ? 'critical' : 'warning',
      description: `检测到 ${lowCompletionWorks.length} 件完成度较低（≤2星）的作品混入`,
      relatedWorkIds: lowCompletionWorks.map(w => w.id),
      createdAt: new Date().toISOString()
    });
  }

  const noCopyrightWorks = works.filter(w => !w.copyright.hasClearance);
  if (noCopyrightWorks.length > 0) {
    anomalies.push({
      id: 'anomaly-copyright',
      type: 'missing_copyright',
      severity: 'critical',
      description: `${noCopyrightWorks.length} 件作品缺少版权证明，需补充材料`,
      relatedWorkIds: noCopyrightWorks.map(w => w.id),
      createdAt: new Date().toISOString()
    });
  }

  return anomalies;
}

export function generateRecommendation(score: PortfolioScore, anomalyCount: number, workCount: number): string {
  if (workCount === 0) return '请先选择作品以生成评估建议';

  const recommendations: string[] = [];

  if (score.overall >= 85) {
    recommendations.push('当前组合整体表现优秀，可作为最终投递方案。');
  } else if (score.overall >= 70) {
    recommendations.push('当前组合整体表现良好，建议微调后使用。');
  } else if (score.overall >= 55) {
    recommendations.push('当前组合表现一般，建议进行较大调整。');
  } else {
    recommendations.push('当前组合存在较多问题，建议重新筛选。');
  }

  if (score.dimensions.themeDiversity < 60) {
    recommendations.push('主题多样性不足，建议补充不同题材的作品。');
  }
  if (score.dimensions.mediumRichness < 60) {
    recommendations.push('媒介丰富度有待提升，可考虑增加不同创作形式。');
  }
  if (score.dimensions.completionBalance < 60) {
    recommendations.push('完成度参差不齐，建议移除或补充低完成度作品。');
  }
  if (score.dimensions.copyrightCompliance < 100) {
    recommendations.push('存在版权风险，需尽快补充缺失的版权证明。');
  }
  if (score.dimensions.directionMatch < 70) {
    recommendations.push('与申请方向的匹配度有待加强。');
  }

  if (anomalyCount > 0) {
    recommendations.push(`检测到 ${anomalyCount} 项异常，建议优先处理。`);
  }

  return recommendations.join(' ');
}
