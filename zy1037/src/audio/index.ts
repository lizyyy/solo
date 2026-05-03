export * from './wav-parser';
export * from './loudness';
export * from './silence-detector';

import * as fs from 'fs-extra';
import { AudioInfo, LoudnessResult, SilenceDetection } from '../types';
import { getAudioInfo, readWavHeader, readAudioSamples } from './wav-parser';
import { analyzeLoudnessFromSamples } from './loudness';
import { detectSilence, SilenceDetectionOptions } from './silence-detector';

export interface AudioAnalysisResult {
  info: AudioInfo;
  loudness?: LoudnessResult;
  silence?: SilenceDetection;
}

export interface AnalysisOptions {
  analyzeLoudness?: boolean;
  analyzeSilence?: boolean;
  silenceOptions?: SilenceDetectionOptions;
}

export async function analyzeAudioFile(
  filePath: string,
  options: AnalysisOptions = {}
): Promise<AudioAnalysisResult> {
  const {
    analyzeLoudness = true,
    analyzeSilence = true,
    silenceOptions = {},
  } = options;

  const exists = await fs.pathExists(filePath);
  
  if (!exists) {
    return {
      info: {
        path: filePath,
        exists: false,
        duration: 0,
        sampleRate: 0,
        channels: 0,
        bitsPerSample: 0,
        fileSize: 0,
        format: 'unknown',
      },
    };
  }

  const info = await getAudioInfo(filePath);
  
  if (info.format !== 'WAV' || info.bitsPerSample === 0) {
    return { info };
  }

  let samples: Float64Array[] | undefined;
  
  if (analyzeLoudness || analyzeSilence) {
    try {
      const header = await readWavHeader(filePath);
      samples = await readAudioSamples(filePath, header);
    } catch {
      samples = undefined;
    }
  }

  const result: AudioAnalysisResult = { info };

  if (samples && analyzeLoudness) {
    result.loudness = analyzeLoudnessFromSamples(samples);
  }

  if (samples && analyzeSilence) {
    result.silence = detectSilence(samples, info.sampleRate, silenceOptions);
  }

  return result;
}
