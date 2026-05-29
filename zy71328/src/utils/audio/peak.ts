import type { PeakMark } from '../../types';

export function detectPeaks(audioData: Float32Array, threshold: number, sampleRate: number): PeakMark[] {
  const peaks: PeakMark[] = [];
  const thresholdLinear = Math.pow(10, threshold / 20);
  const minPeakDistance = Math.floor(sampleRate * 0.01);
  
  let lastPeakIndex = -minPeakDistance;
  
  for (let i = 0; i < audioData.length; i++) {
    const absValue = Math.abs(audioData[i]);
    if (absValue > thresholdLinear && i - lastPeakIndex >= minPeakDistance) {
      const type: 'clip' | 'overshoot' = absValue >= 1.0 ? 'clip' : 'overshoot';
      peaks.push({
        id: `peak-${Date.now()}-${i}`,
        audioId: '',
        time: i / sampleRate,
        value: 20 * Math.log10(absValue + 1e-10),
        fixed: false,
        type
      });
      lastPeakIndex = i;
    }
  }
  
  return peaks;
}

export function applyPeakLimiter(audioData: Float32Array, limit: number, lookAheadMs: number): Float32Array {
  const sampleRate = 44100;
  const lookAheadSamples = Math.floor(sampleRate * lookAheadMs / 1000);
  const limitLinear = Math.pow(10, limit / 20);
  const result = new Float32Array(audioData.length);
  
  let envelope = 0;
  const attackCoef = Math.exp(-1 / (sampleRate * 0.001));
  const releaseCoef = Math.exp(-1 / (sampleRate * 0.1));
  
  for (let i = 0; i < audioData.length; i++) {
    const lookAheadIndex = Math.min(i + lookAheadSamples, audioData.length - 1);
    const input = Math.abs(audioData[lookAheadIndex]);
    
    if (input > envelope) {
      envelope = attackCoef * envelope + (1 - attackCoef) * input;
    } else {
      envelope = releaseCoef * envelope + (1 - releaseCoef) * input;
    }
    
    const gain = envelope > limitLinear ? limitLinear / envelope : 1.0;
    result[i] = audioData[i] * gain;
  }
  
  return result;
}

export function fixClipping(audioData: Float32Array, peakMarks: PeakMark[]): Float32Array {
  const result = new Float32Array(audioData);
  const sampleRate = 44100;
  
  for (const peak of peakMarks) {
    if (!peak.fixed && peak.type === 'clip') {
      const centerSample = Math.floor(peak.time * sampleRate);
      const windowSize = Math.floor(sampleRate * 0.005);
      const start = Math.max(0, centerSample - windowSize);
      const end = Math.min(audioData.length, centerSample + windowSize);
      
      for (let i = start; i < end; i++) {
        const distance = Math.abs(i - centerSample) / windowSize;
        const smoothFactor = 1 - Math.pow(distance, 2);
        const originalValue = result[i];
        
        if (Math.abs(originalValue) > 0.95) {
          const sign = Math.sign(originalValue);
          const reducedValue = sign * (0.9 + 0.05 * (1 - smoothFactor));
          result[i] = reducedValue;
        }
      }
    }
  }
  
  return result;
}
