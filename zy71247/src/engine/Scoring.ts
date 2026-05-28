import { GameParams, SceneConfig, ScoreDetail, CalculationStep, ErrorAnalysis } from '../types';

function calculateGrade(value: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (value >= 90) return 'A';
  if (value >= 80) return 'B';
  if (value >= 70) return 'C';
  if (value >= 60) return 'D';
  return 'F';
}

export function calculateTrackAccuracy(params: GameParams, scene: SceneConfig): ScoreDetail {
  const actualOffsetX = params.flightPath.offsetX;
  const actualOffsetY = params.flightPath.offsetY;
  const idealOffset = scene.idealParams.trackOffset;
  
  const offsetDistance = Math.sqrt(
    (actualOffsetX - idealOffset.x) ** 2 + 
    (actualOffsetY - idealOffset.y) ** 2
  );
  
  const k = 0.02;
  const value = Math.min(100, Math.max(0, 100 * Math.exp(-k * offsetDistance)));
  
  const calculation: CalculationStep[] = [
    {
      formula: '偏移距离 = √((实际X - 理想X)² + (实际Y - 理想Y)²)',
      inputs: {
        actualX: actualOffsetX,
        actualY: actualOffsetY,
        idealX: idealOffset.x,
        idealY: idealOffset.y
      },
      intermediate: {
        dx: actualOffsetX - idealOffset.x,
        dy: actualOffsetY - idealOffset.y,
        dxSquared: (actualOffsetX - idealOffset.x) ** 2,
        dySquared: (actualOffsetY - idealOffset.y) ** 2
      },
      result: offsetDistance
    },
    {
      formula: '航迹准确度 = 100 × exp(-k × 偏移距离)',
      inputs: { k, offsetDistance },
      intermediate: {
        exponent: -k * offsetDistance,
        expValue: Math.exp(-k * offsetDistance)
      },
      result: value
    }
  ];

  return {
    value: Math.round(value * 100) / 100,
    weight: 0.3,
    calculation,
    grade: calculateGrade(value)
  };
}

export function calculateSamplingAdequacy(params: GameParams, scene: SceneConfig): ScoreDetail {
  const actualInterval = params.sampling.interval;
  const idealInterval = scene.idealParams.samplingInterval;
  
  let value: number;
  let intermediate: Record<string, number>;
  
  if (actualInterval <= idealInterval) {
    value = 100;
    intermediate = { ratio: actualInterval / idealInterval };
  } else if (actualInterval <= 2 * idealInterval) {
    const ratio = actualInterval / idealInterval;
    value = 100 - 50 * (ratio - 1);
    intermediate = { ratio, excessRatio: ratio - 1, deduction: 50 * (ratio - 1) };
  } else {
    value = 0;
    intermediate = { ratio: actualInterval / idealInterval };
  }
  
  const calculation: CalculationStep[] = [
    {
      formula: '采样间隔比 = 实际间隔 / 理想间隔',
      inputs: { actualInterval, idealInterval },
      intermediate: { ratio: actualInterval / idealInterval },
      result: actualInterval / idealInterval
    },
    {
      formula: actualInterval <= idealInterval 
        ? '采样充足度 = 100 (间隔 ≤ 理想间隔)'
        : actualInterval <= 2 * idealInterval
          ? '采样充足度 = 100 - 50 × (间隔比 - 1)'
          : '采样充足度 = 0 (间隔 > 2×理想间隔)',
      inputs: { actualInterval, idealInterval, ratio: actualInterval / idealInterval },
      intermediate,
      result: value
    }
  ];

  return {
    value: Math.round(value * 100) / 100,
    weight: 0.3,
    calculation,
    grade: calculateGrade(value)
  };
}

export function calculateNoiseControl(params: GameParams, scene: SceneConfig): ScoreDetail {
  const noiseLevel = params.noise.level;
  
  const value = 100 * Math.pow(1 - noiseLevel / 100, 2);
  
  const calculation: CalculationStep[] = [
    {
      formula: '噪声控制 = 100 × (1 - 噪声水平/100)²',
      inputs: { noiseLevel },
      intermediate: {
        normalizedNoise: noiseLevel / 100,
        oneMinusNoise: 1 - noiseLevel / 100,
        squared: Math.pow(1 - noiseLevel / 100, 2)
      },
      result: value
    }
  ];

  return {
    value: Math.round(value * 100) / 100,
    weight: 0.2,
    calculation,
    grade: calculateGrade(value)
  };
}

export function calculateImageClarity(
  processedImage: number[][], 
  targetImage: number[][]
): ScoreDetail {
  let sumSquaredDiff = 0;
  let sumTarget = 0;
  let sumProcessed = 0;
  let sumCross = 0;
  
  const height = Math.min(processedImage.length, targetImage.length);
  const width = Math.min(processedImage[0].length, targetImage[0].length);
  const n = width * height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = processedImage[y][x];
      const t = targetImage[y][x];
      sumProcessed += p;
      sumTarget += t;
      sumSquaredDiff += (p - t) ** 2;
      sumCross += p * t;
    }
  }
  
  const meanProcessed = sumProcessed / n;
  const meanTarget = sumTarget / n;
  const mse = sumSquaredDiff / n;
  const psnr = mse > 0 ? 10 * Math.log10(1 / mse) : 40;
  const value = Math.min(100, Math.max(0, (psnr / 30) * 100));
  
  const calculation: CalculationStep[] = [
    {
      formula: 'MSE = Σ(处理值 - 目标值)² / N',
      inputs: { n },
      intermediate: { sumSquaredDiff, meanProcessed, meanTarget },
      result: mse
    },
    {
      formula: 'PSNR = 10 × log10(1 / MSE)',
      inputs: { mse },
      intermediate: { psnr },
      result: psnr
    },
    {
      formula: '清晰度评分 = min(100, PSNR / 30 × 100)',
      inputs: { psnr },
      intermediate: { normalizedPSNR: psnr / 30 },
      result: value
    }
  ];

  return {
    value: Math.round(value * 100) / 100,
    weight: 0.2,
    calculation,
    grade: calculateGrade(value)
  };
}

export function calculateTotalScore(scores: {
  trackAccuracy: ScoreDetail;
  samplingAdequacy: ScoreDetail;
  noiseControl: ScoreDetail;
  imageClarity: ScoreDetail;
}): number {
  const total = 
    scores.trackAccuracy.value * scores.trackAccuracy.weight +
    scores.samplingAdequacy.value * scores.samplingAdequacy.weight +
    scores.noiseControl.value * scores.noiseControl.weight +
    scores.imageClarity.value * scores.imageClarity.weight;
  
  return Math.round(total * 100) / 100;
}

export function analyzeErrors(
  params: GameParams,
  scene: SceneConfig,
  scores: {
    trackAccuracy: ScoreDetail;
    samplingAdequacy: ScoreDetail;
    noiseControl: ScoreDetail;
  }
): ErrorAnalysis[] {
  const errors: ErrorAnalysis[] = [];
  
  const samplingRatio = params.sampling.interval / scene.idealParams.samplingInterval;
  if (samplingRatio > 1.5) {
    const severity = samplingRatio > 2 ? 'high' : samplingRatio > 1.75 ? 'medium' : 'low';
    const resolutionLoss = (1 - 1 / samplingRatio) * 100;
    
    errors.push({
      type: 'insufficient_sampling',
      severity,
      impact: `分辨率损失约 ${resolutionLoss.toFixed(1)}%，地物细节模糊`,
      calculation: [
        {
          formula: '采样间隔比 = 实际间隔 / 理想间隔',
          inputs: {
            actualInterval: params.sampling.interval,
            idealInterval: scene.idealParams.samplingInterval
          },
          intermediate: { ratio: samplingRatio },
          result: samplingRatio
        },
        {
          formula: '分辨率损失 = (1 - 1/间隔比) × 100%',
          inputs: { ratio: samplingRatio },
          intermediate: { inverseRatio: 1 / samplingRatio },
          result: resolutionLoss
        }
      ],
      suggestion: `建议将采样间隔降低至 ${scene.idealParams.samplingInterval}ms 以下`
    });
  }
  
  const trackDistance = Math.sqrt(
    params.flightPath.offsetX ** 2 + params.flightPath.offsetY ** 2
  );
  if (trackDistance > scene.thresholds.track.warning) {
    const severity = trackDistance > scene.thresholds.track.critical ? 'high' : 'medium';
    const blurFactor = 1 + trackDistance * 0.01;
    
    errors.push({
      type: 'track_deviation',
      severity,
      impact: `方位向模糊系数 ${blurFactor.toFixed(2)}x，地物边缘虚化`,
      calculation: [
        {
          formula: '偏移距离 = √(X偏移² + Y偏移²)',
          inputs: {
            offsetX: params.flightPath.offsetX,
            offsetY: params.flightPath.offsetY
          },
          intermediate: {
            xSquared: params.flightPath.offsetX ** 2,
            ySquared: params.flightPath.offsetY ** 2
          },
          result: trackDistance
        },
        {
          formula: '模糊系数 = 1 + 偏移距离 × 0.01',
          inputs: { trackDistance },
          intermediate: { blurIncrement: trackDistance * 0.01 },
          result: blurFactor
        }
      ],
      suggestion: `建议将航迹调整至中心区域（X:0, Y:0附近）`
    });
  }
  
  if (params.noise.level > scene.thresholds.noise.warning) {
    const severity = params.noise.level > scene.thresholds.noise.critical ? 'high' : 'medium';
    const snr = 10 * Math.log10(1 / (params.noise.level / 100));
    
    errors.push({
      type: 'excessive_noise',
      severity,
      impact: `信噪比约 ${snr.toFixed(1)}dB，地物对比度下降`,
      calculation: [
        {
          formula: '信噪比 SNR = 10 × log10(1 / (噪声水平/100))',
          inputs: { noiseLevel: params.noise.level },
          intermediate: {
            normalizedNoise: params.noise.level / 100,
            signalRatio: 1 / (params.noise.level / 100)
          },
          result: snr
        }
      ],
      suggestion: `建议将噪声水平控制在 ${scene.thresholds.noise.warning} 以下`
    });
  }
  
  return errors;
}
