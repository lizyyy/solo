import { SilenceDetection } from '../types';
import { rmsToDb, calculateRms } from './loudness';

export interface SilenceDetectionOptions {
  silenceThresholdDb?: number;
  analysisWindowSeconds?: number;
  maxLeadingSilence?: number;
  maxTrailingSilence?: number;
}

const DEFAULT_OPTIONS: Required<SilenceDetectionOptions> = {
  silenceThresholdDb: -50,
  analysisWindowSeconds: 0.01,
  maxLeadingSilence: 0.5,
  maxTrailingSilence: 1.0,
};

export function detectSilence(
  channels: Float64Array[],
  sampleRate: number,
  options: SilenceDetectionOptions = {}
): SilenceDetection {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const minLength = Math.min(...channels.map(ch => ch.length));
  const totalDuration = minLength / sampleRate;
  
  const windowSamples = Math.floor(opts.analysisWindowSeconds * sampleRate);
  const thresholdRms = Math.pow(10, opts.silenceThresholdDb / 20);

  const isSilentWindow = (startIdx: number): boolean => {
    const endIdx = Math.min(startIdx + windowSamples, minLength);
    
    let sumSquares = 0;
    let sampleCount = 0;
    
    for (let ch = 0; ch < channels.length; ch++) {
      for (let i = startIdx; i < endIdx; i++) {
        const sample = channels[ch][i];
        sumSquares += sample * sample;
        sampleCount++;
      }
    }
    
    if (sampleCount === 0) return true;
    
    const rms = Math.sqrt(sumSquares / sampleCount);
    return rms < thresholdRms;
  };

  let startSilenceSamples = 0;
  for (let i = 0; i < minLength - windowSamples; i += windowSamples) {
    if (isSilentWindow(i)) {
      startSilenceSamples = i + windowSamples;
    } else {
      break;
    }
  }

  let endSilenceSamples = 0;
  for (let i = minLength - windowSamples; i >= 0; i -= windowSamples) {
    if (isSilentWindow(i)) {
      endSilenceSamples = minLength - i;
    } else {
      break;
    }
  }

  const startSilenceDuration = startSilenceSamples / sampleRate;
  const endSilenceDuration = endSilenceSamples / sampleRate;

  return {
    startSilenceDuration: Math.round(startSilenceDuration * 1000) / 1000,
    endSilenceDuration: Math.round(endSilenceDuration * 1000) / 1000,
    hasLongSilenceAtStart: startSilenceDuration > opts.maxLeadingSilence,
    hasLongSilenceAtEnd: endSilenceDuration > opts.maxTrailingSilence,
  };
}

export interface SilenceInterval {
  startTime: number;
  endTime: number;
  duration: number;
  isSignificant: boolean;
}

export function findAllSilences(
  channels: Float64Array[],
  sampleRate: number,
  options: SilenceDetectionOptions & {
    minSilenceDuration?: number;
  } = {}
): SilenceInterval[] {
  const {
    silenceThresholdDb = -50,
    analysisWindowSeconds = 0.01,
    minSilenceDuration = 0.5,
  } = options;

  const minLength = Math.min(...channels.map(ch => ch.length));
  const windowSamples = Math.floor(analysisWindowSeconds * sampleRate);
  const thresholdRms = Math.pow(10, silenceThresholdDb / 20);
  const minSilenceWindows = Math.ceil(minSilenceDuration / analysisWindowSeconds);

  const silenceWindows: boolean[] = [];
  
  for (let i = 0; i < minLength - windowSamples; i += windowSamples) {
    let sumSquares = 0;
    let sampleCount = 0;
    
    for (let ch = 0; ch < channels.length; ch++) {
      for (let j = i; j < Math.min(i + windowSamples, minLength); j++) {
        const sample = channels[ch][j];
        sumSquares += sample * sample;
        sampleCount++;
      }
    }
    
    const rms = Math.sqrt(sumSquares / sampleCount);
    silenceWindows.push(rms < thresholdRms);
  }

  const intervals: SilenceInterval[] = [];
  let inSilence = false;
  let silenceStartWindow = 0;

  for (let i = 0; i < silenceWindows.length; i++) {
    if (silenceWindows[i] && !inSilence) {
      inSilence = true;
      silenceStartWindow = i;
    } else if (!silenceWindows[i] && inSilence) {
      inSilence = false;
      const duration = (i - silenceStartWindow) * analysisWindowSeconds;
      
      if (duration >= minSilenceDuration) {
        intervals.push({
          startTime: silenceStartWindow * analysisWindowSeconds,
          endTime: i * analysisWindowSeconds,
          duration: Math.round(duration * 1000) / 1000,
          isSignificant: true,
        });
      }
    }
  }

  if (inSilence) {
    const duration = (silenceWindows.length - silenceStartWindow) * analysisWindowSeconds;
    if (duration >= minSilenceDuration) {
      intervals.push({
        startTime: silenceStartWindow * analysisWindowSeconds,
        endTime: silenceWindows.length * analysisWindowSeconds,
        duration: Math.round(duration * 1000) / 1000,
        isSignificant: true,
      });
    }
  }

  return intervals;
}
