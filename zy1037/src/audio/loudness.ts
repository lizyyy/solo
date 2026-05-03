import { LoudnessResult } from '../types';

export const LOUDNESS_DOCUMENTATION = `
【响度说明】

本工具使用 **RMS（均方根）** 近似计算响度，而非专业的 LUFS（Loudness Units Full Scale）。

### 差异说明

| 指标 | RMS（本工具） | LUFS（专业标准） |
|------|--------------|-----------------|
| 计算方式 | 简单的能量平均 | 基于听觉感知的加权（ITU-R BS.1770） |
| 时间窗口 | 全文件平均 | 分窗口分析（通常 400ms） |
| 门控 | 无 | 静音自动排除 |

### 近似关系

对于典型的语音/播客内容：
- RMS dB ≈ 感知响度 - 3~5 dB
- 例如：RMS -20 dB ≈ 感知响度 -16 LUFS

### 播客常用标准

- Apple Podcasts / Spotify: -16 LUFS 集成响度
- 峰值限制: -1 dBTP（True Peak）
- 本工具以 RMS -20 dB 近似对应 -16 LUFS

### 限制

1. 无法计算 True Peak（仅计算样本峰值）
2. 没有感知加权（高频/低频对人耳的影响不同）
3. 没有分窗口分析（无法检测短时响度变化）
4. 没有门控（静音部分会拉低平均值）

### 建议

如果需要专业级响度分析，请使用：
- Audacity（内置响度分析）
- ffmpeg + ebur128 滤镜
- 专业 DAW（Logic、Pro Tools、Reaper 等）
`;

export function calculateRms(samples: Float64Array): number {
  if (samples.length === 0) return 0;
  
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  
  return Math.sqrt(sum / samples.length);
}

export function rmsToDb(rms: number): number {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export function dbToRms(db: number): number {
  return Math.pow(10, db / 20);
}

export function calculatePeak(samples: Float64Array): number {
  if (samples.length === 0) return 0;
  
  let max = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    if (abs > max) max = abs;
  }
  
  return max;
}

export function analyzeLoudnessFromSamples(
  channels: Float64Array[],
  options: {
    normalizeToReference?: boolean;
    referenceRms?: number;
  } = {}
): LoudnessResult {
  const { normalizeToReference = false, referenceRms = -20 } = options;

  const allSamples: number[] = [];
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      allSamples.push(channel[i]);
    }
  }

  const combinedSamples = new Float64Array(allSamples);
  
  const rms = calculateRms(combinedSamples);
  const rmsDb = rmsToDb(rms);
  
  const peak = calculatePeak(combinedSamples);
  const peakDb = rmsToDb(peak);

  let normalizedRmsDb = rmsDb;
  if (normalizeToReference && isFinite(rmsDb)) {
    const correction = referenceRms - rmsDb;
    normalizedRmsDb = rmsDb + correction;
  }

  return {
    rmsDb: Number.isFinite(rmsDb) ? Math.round(rmsDb * 100) / 100 : -Infinity,
    peakDb: Number.isFinite(peakDb) ? Math.round(peakDb * 100) / 100 : -Infinity,
    normalizedRmsDb: Number.isFinite(normalizedRmsDb) ? Math.round(normalizedRmsDb * 100) / 100 : -Infinity,
  };
}

export interface LoudnessAnalysisOptions {
  windowSize?: number;
  hopSize?: number;
  silenceThreshold?: number;
}

export function analyzeLoudnessWithWindows(
  channels: Float64Array[],
  sampleRate: number,
  options: LoudnessAnalysisOptions = {}
): {
  overall: LoudnessResult;
  windows: Array<{
    startTime: number;
    endTime: number;
    rmsDb: number;
    peakDb: number;
  }>;
  moments: {
    maxShortTermRms: number;
    minShortTermRms: number;
    dynamicRange: number;
  };
} {
  const {
    windowSize = 0.4,
    hopSize = 0.1,
    silenceThreshold = -60,
  } = options;

  const windowSamples = Math.floor(windowSize * sampleRate);
  const hopSamples = Math.floor(hopSize * sampleRate);

  const minLength = Math.min(...channels.map(ch => ch.length));
  
  const windows: Array<{
    startTime: number;
    endTime: number;
    rmsDb: number;
    peakDb: number;
  }> = [];

  const allSamples: number[] = [];
  for (const channel of channels) {
    for (let i = 0; i < minLength; i++) {
      allSamples.push(channel[i]);
    }
  }
  const combined = new Float64Array(allSamples);

  for (let startSample = 0; startSample < minLength - windowSamples; startSample += hopSamples) {
    const endSample = startSample + windowSamples;
    
    const windowSamplesArray = new Float64Array(windowSamples * channels.length);
    let idx = 0;
    
    for (let ch = 0; ch < channels.length; ch++) {
      for (let i = startSample; i < endSample; i++) {
        windowSamplesArray[idx++] = channels[ch][i];
      }
    }

    const rms = calculateRms(windowSamplesArray);
    const rmsDb = rmsToDb(rms);
    const peak = calculatePeak(windowSamplesArray);
    const peakDb = rmsToDb(peak);

    if (rmsDb > silenceThreshold) {
      windows.push({
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate,
        rmsDb,
        peakDb,
      });
    }
  }

  const overall = analyzeLoudnessFromSamples(channels);

  const validRmsValues = windows
    .map(w => w.rmsDb)
    .filter(db => isFinite(db));

  const maxShortTermRms = validRmsValues.length > 0 ? Math.max(...validRmsValues) : -Infinity;
  const minShortTermRms = validRmsValues.length > 0 ? Math.min(...validRmsValues) : -Infinity;
  const dynamicRange = isFinite(maxShortTermRms) && isFinite(minShortTermRms)
    ? maxShortTermRms - minShortTermRms
    : 0;

  return {
    overall,
    windows,
    moments: {
      maxShortTermRms,
      minShortTermRms,
      dynamicRange,
    },
  };
}
