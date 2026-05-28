import { Score, ScoreStats, SynthParams, HistoryItem, Warning } from '../types/synth';

export function calculateRichness(stats: ScoreStats): number {
  const waveformScore = (stats.waveformsUsed.length / 4) * 8;
  const filterScore = (stats.filterTypesUsed.length / 4) * 8;
  const lfoScore = (stats.lfoTargetsUsed.length / 3) * 9;
  return Math.round(waveformScore + filterScore + lfoScore);
}

export function calculateReasonableness(stats: ScoreStats): number {
  const extremePenalty = stats.extremeValueUses * 2;
  const warningPenalty = stats.warningsCount * 1.5;
  return Math.max(0, Math.round(25 - extremePenalty - warningPenalty));
}

export function calculateFluency(stats: ScoreStats): number {
  const totalTime = (Date.now() - stats.startTime) / 1000 / 60;
  if (totalTime < 0.1) return 20;

  const operationsPerMinute = stats.totalOperations / totalTime;
  const baseScore = Math.min(20, operationsPerMinute * 3);
  const redundancyPenalty = stats.redundantAdjustments * 0.5;
  return Math.max(0, Math.round(baseScore - redundancyPenalty));
}

export function calculateExploration(stats: ScoreStats, totalParams = 13): number {
  return Math.round((stats.paramsTouched.length / totalParams) * 20);
}

export function calculateRiskControl(stats: ScoreStats): number {
  if (stats.warningsCount === 0) return 10;
  return Math.max(0, Math.round(10 - stats.warningsCount * 2));
}

export function updateScore(
  currentScore: Score,
  params: SynthParams,
  history: HistoryItem[],
  lastWarning: Warning | null
): Score {
  const stats = { ...currentScore.stats };
  const lastItem = history[history.length - 1];

  if (lastItem) {
    const paramKey = `${lastItem.module}.${lastItem.param}`;
    if (!stats.paramsTouched.includes(paramKey)) {
      stats.paramsTouched.push(paramKey);
    }

    if (lastItem.module === 'oscillator' && lastItem.param === 'waveform') {
      const value = lastItem.newValue as string;
      if (!stats.waveformsUsed.includes(value)) {
        stats.waveformsUsed.push(value);
      }
    }

    if (lastItem.module === 'filter' && lastItem.param === 'type') {
      const value = lastItem.newValue as string;
      if (!stats.filterTypesUsed.includes(value)) {
        stats.filterTypesUsed.push(value);
      }
    }

    if (lastItem.module === 'lfo' && lastItem.param === 'target') {
      const value = lastItem.newValue as string;
      if (!stats.lfoTargetsUsed.includes(value)) {
        stats.lfoTargetsUsed.push(value);
      }
    }

    if (
      lastItem.param === 'frequency' &&
      typeof lastItem.newValue === 'number' &&
      lastItem.newValue > 15000
    ) {
      stats.extremeValueUses++;
    }
    if (
      lastItem.param === 'resonance' &&
      typeof lastItem.newValue === 'number' &&
      lastItem.newValue > 15
    ) {
      stats.extremeValueUses++;
    }

    const recentSameParam = history.filter(
      (h, i) =>
        i > history.length - 5 &&
        h.module === lastItem.module &&
        h.param === lastItem.param &&
        Date.now() - h.timestamp < 3000
    );
    if (recentSameParam.length > 2) {
      stats.redundantAdjustments++;
    }
  }

  if (lastWarning) {
    stats.warningsCount++;
  }

  const dimensions = {
    richness: calculateRichness(stats),
    reasonableness: calculateReasonableness(stats),
    fluency: calculateFluency(stats),
    exploration: calculateExploration(stats),
    riskControl: calculateRiskControl(stats),
  };

  const total =
    dimensions.richness +
    dimensions.reasonableness +
    dimensions.fluency +
    dimensions.exploration +
    dimensions.riskControl;

  return {
    total,
    dimensions,
    stats,
  };
}

export function calculateScoreImpact(
  oldScore: Score,
  newScore: Score
): { dimension: string; delta: number } | null {
  let maxDelta = 0;
  let maxDimension = '';

  (Object.keys(oldScore.dimensions) as Array<keyof typeof oldScore.dimensions>).forEach((key) => {
    const delta = newScore.dimensions[key] - oldScore.dimensions[key];
    if (Math.abs(delta) > Math.abs(maxDelta)) {
      maxDelta = delta;
      maxDimension = key;
    }
  });

  if (maxDelta === 0) return null;

  const dimensionNames: Record<string, string> = {
    richness: '音色丰富度',
    reasonableness: '参数合理性',
    fluency: '操作流畅度',
    exploration: '探索广度',
    riskControl: '风险控制',
  };

  return {
    dimension: dimensionNames[maxDimension] || maxDimension,
    delta: maxDelta,
  };
}

export function generateSoundDescription(params: SynthParams): string {
  const descriptions: string[] = [];

  const waveformDesc: Record<string, string> = {
    sine: '纯净圆润的正弦波',
    square: '明亮锐利的方波',
    sawtooth: '丰满厚实的锯齿波',
    triangle: '温暖柔和的三角波',
  };
  descriptions.push(
    `使用${waveformDesc[params.oscillator.waveform]}作为振荡器基础波形，基频 ${params.oscillator.frequency.toFixed(0)}Hz。`
  );

  const filterDesc: Record<string, string> = {
    lowpass: '低通滤波，柔化高频',
    highpass: '高通滤波，去除低频',
    bandpass: '带通滤波，突出中频',
    notch: '陷波滤波，削除特定频段',
  };
  descriptions.push(
    `${filterDesc[params.filter.type]}，截止频率 ${params.filter.cutoff.toFixed(0)}Hz，谐振值 ${params.filter.resonance.toFixed(1)}。`
  );

  if (params.envelope.attack > 1) {
    descriptions.push('较慢的起音时间，音色渐入感明显。');
  } else if (params.envelope.attack < 0.01) {
    descriptions.push('极快的起音，音色具有冲击感。');
  }

  if (params.envelope.release > 2) {
    descriptions.push('较长的释音时间，尾音悠远绵长。');
  } else if (params.envelope.release < 0.1) {
    descriptions.push('短促的释音，音色干净利落。');
  }

  if (params.lfo.depth > 0.5) {
    const targetDesc: Record<string, string> = {
      volume: '音量颤音效果明显',
      pitch: '音高弯音效果强烈',
      filter: '滤波哇音效果突出',
    };
    descriptions.push(`${targetDesc[params.lfo.target]}，调制速率 ${params.lfo.rate.toFixed(1)}Hz。`);
  }

  return descriptions.join(' ');
}

export function generateRecommendations(score: Score): string[] {
  const recommendations: string[] = [];

  if (score.dimensions.richness < 15) {
    recommendations.push('尝试切换不同的振荡器波形和滤波器类型，探索更丰富的音色组合。');
    recommendations.push('可以试试让LFO调制不同的目标参数（音量/音高/滤波）。');
  }

  if (score.dimensions.reasonableness < 15) {
    recommendations.push('注意避免使用极端参数值，大多数经典音色使用中间范围的参数。');
    recommendations.push('过高的谐振值可能导致刺耳的自激振荡，建议保持在10以下。');
  }

  if (score.dimensions.exploration < 10) {
    recommendations.push('多尝试调节不同的参数，每个旋钮都会给音色带来独特的变化。');
    recommendations.push('试试调节包络的ADSR四个阶段，理解它们如何影响音色的动态。');
  }

  if (score.dimensions.riskControl < 5) {
    recommendations.push('注意控制主音量在0.8以下，避免爆峰失真损伤听力。');
    recommendations.push('参数调节时注意观察警告提示，它们能帮助你获得更好的音色。');
  }

  if (score.dimensions.fluency < 10) {
    recommendations.push('调节参数时可以更果断一些，避免在一个旋钮上来回反复微调。');
  }

  if (recommendations.length === 0) {
    recommendations.push('太棒了！你的操作非常专业，继续探索更多可能性吧。');
    recommendations.push('试试保存你的优秀音色作为预设，方便以后调用。');
  }

  return recommendations;
}
