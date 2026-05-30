import { PitchDetectionResult } from '@/types';

export class PitchDetector {
  private sampleRate: number = 44100;
  private threshold: number = 0.1;

  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }

  async detect(audioBuffer: AudioBuffer): Promise<PitchDetectionResult[]> {
    const channelData = audioBuffer.getChannelData(0);
    const results: PitchDetectionResult[] = [];
    const frameSize = 2048;
    const hopSize = 1024;

    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      const frame = channelData.slice(i, i + frameSize);
      const { frequency, probability } = this.detectPitchYIN(frame);

      if (probability > this.threshold && frequency > 60 && frequency < 4000) {
        results.push({
          time: i / audioBuffer.sampleRate,
          frequency,
          probability,
        });
      }
    }

    return this.postProcess(results);
  }

  private detectPitchYIN(buffer: Float32Array): { frequency: number; probability: number } {
    const bufferSize = buffer.length;
    const halfSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(halfSize);

    for (let tau = 0; tau < halfSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfSize; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
    }

    let tauEstimate = -1;
    for (let tau = 2; tau < halfSize; tau++) {
      if (yinBuffer[tau] < 0.15) {
        while (tau + 1 < halfSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) {
      return { frequency: 0, probability: 0 };
    }

    const betterTau = this.parabolicInterpolation(yinBuffer, tauEstimate);
    const frequency = this.sampleRate / betterTau;
    const probability = Math.max(0, 1 - yinBuffer[Math.floor(betterTau)]);

    return { frequency, probability };
  }

  private parabolicInterpolation(yinBuffer: Float32Array, tauEstimate: number): number {
    const x0 = tauEstimate > 0 ? tauEstimate - 1 : tauEstimate;
    const x2 = tauEstimate + 1 < yinBuffer.length ? tauEstimate + 1 : tauEstimate;

    if (x0 === tauEstimate) {
      return yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
    }

    if (x2 === tauEstimate) {
      return tauEstimate;
    }

    const s0 = yinBuffer[x0];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[x2];

    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator === 0) {
      return tauEstimate;
    }

    return tauEstimate + (s2 - s0) / denominator;
  }

  private postProcess(results: PitchDetectionResult[]): PitchDetectionResult[] {
    if (results.length < 3) return results;

    const processed: PitchDetectionResult[] = [];
    const windowSize = 5;

    for (let i = 0; i < results.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(results.length, i + Math.ceil(windowSize / 2));
      const window = results.slice(start, end);

      const frequencies = window.map(r => r.frequency).sort((a, b) => a - b);
      const median = frequencies[Math.floor(frequencies.length / 2)];

      const ratio = Math.max(results[i].frequency / median, median / results[i].frequency);
      if (ratio < 2) {
        processed.push({
          ...results[i],
          frequency: median,
        });
      }
    }

    return processed;
  }
}

export const pitchDetector = new PitchDetector();
