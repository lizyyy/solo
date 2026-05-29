import type { Peak, SpectrumPoint } from '../types';

export interface PeakDetectionOptions {
  threshold?: number;
  minDistance?: number;
  minProminence?: number;
  maxPeaks?: number;
  excludeNoiseFrequencies?: boolean;
  noiseThreshold?: number;
}

export class PeakDetector {
  private options: Required<PeakDetectionOptions>;

  constructor(options: PeakDetectionOptions = {}) {
    this.options = {
      threshold: -40,
      minDistance: 5,
      minProminence: 6,
      maxPeaks: 10,
      excludeNoiseFrequencies: true,
      noiseThreshold: 0.3,
      ...options,
    };
  }

  detectPeaks(spectrum: SpectrumPoint[]): Peak[] {
    const peaks: Peak[] = [];
    const n = spectrum.length;

    const amplitudes = spectrum.map((p) => p.amplitude);
    const noiseFloor = this.calculateNoiseFloor(amplitudes);
    const adjustedThreshold = Math.max(this.options.threshold, noiseFloor + this.options.minProminence);

    for (let i = 1; i < n - 1; i++) {
      if (amplitudes[i] <= adjustedThreshold) continue;

      if (this.isLocalMaximum(amplitudes, i)) {
        if (!this.isNearExistingPeak(peaks, spectrum[i].frequency)) {
          const prominence = this.calculateProminence(amplitudes, i);
          
          if (prominence >= this.options.minProminence) {
            const interpolated = this.interpolatePeak(spectrum, i);
            const isNoise = this.classifyNoise(spectrum, i, prominence);
            const width = this.calculatePeakWidth(amplitudes, i, amplitudes[i] / 2);
            const qFactor = interpolated.frequency / width;

            peaks.push({
              id: this.generateId(),
              frequency: interpolated.frequency,
              amplitude: interpolated.amplitude,
              isNoise,
              status: 'tentative',
              width,
              qFactor,
            });
          }
        }
      }
    }

    peaks.sort((a, b) => b.amplitude - a.amplitude);
    return peaks.slice(0, this.options.maxPeaks);
  }

  private isLocalMaximum(amplitudes: number[], index: number): boolean {
    const left = amplitudes[index - 1];
    const current = amplitudes[index];
    const right = amplitudes[index + 1];

    if (current <= left || current <= right) return false;

    const distance = this.options.minDistance;
    for (let i = 1; i <= distance; i++) {
      const leftIdx = index - i;
      const rightIdx = index + i;
      if (leftIdx >= 0 && amplitudes[leftIdx] > current) return false;
      if (rightIdx < amplitudes.length && amplitudes[rightIdx] > current) return false;
    }

    return true;
  }

  private calculateProminence(amplitudes: number[], peakIndex: number): number {
    const peakAmplitude = amplitudes[peakIndex];
    let leftMin = Infinity;
    let rightMin = Infinity;

    for (let i = peakIndex - 1; i >= 0; i--) {
      if (amplitudes[i] > amplitudes[i + 1]) break;
      leftMin = Math.min(leftMin, amplitudes[i]);
    }

    for (let i = peakIndex + 1; i < amplitudes.length; i++) {
      if (amplitudes[i] > amplitudes[i - 1]) break;
      rightMin = Math.min(rightMin, amplitudes[i]);
    }

    const lowestValley = Math.max(leftMin, rightMin);
    return peakAmplitude - lowestValley;
  }

  private calculatePeakWidth(
    amplitudes: number[],
    peakIndex: number,
    targetAmplitude: number
  ): number {
    let leftIndex = peakIndex;
    let rightIndex = peakIndex;

    while (leftIndex > 0 && amplitudes[leftIndex] > targetAmplitude) {
      leftIndex--;
    }

    while (rightIndex < amplitudes.length - 1 && amplitudes[rightIndex] > targetAmplitude) {
      rightIndex++;
    }

    return rightIndex - leftIndex;
  }

  private calculateNoiseFloor(amplitudes: number[]): number {
    const sorted = [...amplitudes].sort((a, b) => a - b);
    const lowerQuartile = sorted[Math.floor(sorted.length * 0.25)];
    return lowerQuartile;
  }

  private classifyNoise(
    spectrum: SpectrumPoint[],
    peakIndex: number,
    prominence: number
  ): boolean {
    if (!this.options.excludeNoiseFrequencies) return false;

    const frequency = spectrum[peakIndex].frequency;
    const amplitude = spectrum[peakIndex].amplitude;

    if (frequency < 20 || frequency > 20000) return true;

    if (prominence < this.options.noiseThreshold * 20) return true;

    if (frequency > 10000 && amplitude < this.options.threshold + 15) return true;

    return false;
  }

  private isNearExistingPeak(peaks: Peak[], frequency: number): boolean {
    const minFreqDistance = 10;
    return peaks.some(
      (peak) => Math.abs(peak.frequency - frequency) < minFreqDistance
    );
  }

  private interpolatePeak(
    spectrum: SpectrumPoint[],
    peakIndex: number
  ): { frequency: number; amplitude: number } {
    if (peakIndex <= 0 || peakIndex >= spectrum.length - 1) {
      return spectrum[peakIndex];
    }

    const y0 = spectrum[peakIndex - 1].amplitude;
    const y1 = spectrum[peakIndex].amplitude;
    const y2 = spectrum[peakIndex + 1].amplitude;

    const denominator = 2 * (y0 - 2 * y1 + y2);
    if (Math.abs(denominator) < 0.001) {
      return spectrum[peakIndex];
    }

    const offset = (y0 - y2) / denominator;
    const freqStep = spectrum[1].frequency - spectrum[0].frequency;

    return {
      frequency: spectrum[peakIndex].frequency + offset * freqStep,
      amplitude: y1 - 0.25 * (y0 - y2) * offset,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  findHarmonicRelationship(peaks: Peak[]): Peak[][] {
    const harmonicGroups: Peak[][] = [];
    const used = new Set<string>();

    peaks.forEach((peak) => {
      if (used.has(peak.id) || peak.isNoise) return;

      const group: Peak[] = [peak];
      used.add(peak.id);

      peaks.forEach((other) => {
        if (used.has(other.id) || other.isNoise) return;

        const ratio = other.frequency / peak.frequency;
        const harmonicNumber = Math.round(ratio);

        if (harmonicNumber > 1 && harmonicNumber <= 8) {
          const deviation = Math.abs(ratio - harmonicNumber) / harmonicNumber;
          if (deviation < 0.02) {
            group.push(other);
            used.add(other.id);
          }
        }
      });

      if (group.length > 1) {
        harmonicGroups.push(group);
      }
    });

    return harmonicGroups;
  }

  detectOverlappingPeaks(peaks: Peak[], threshold: number = 50): Peak[] {
    return peaks.filter((peak, i) =>
      peaks.some(
        (other, j) => i !== j && Math.abs(peak.frequency - other.frequency) < threshold
      )
    );
  }

  calculateQFactor(peak: Peak, spectrum: SpectrumPoint[]): number {
    const freqStep = spectrum[1]?.frequency - spectrum[0]?.frequency || 1;
    const halfPower = peak.amplitude - 3;

    let leftIdx = 0;
    let rightIdx = spectrum.length - 1;

    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i].frequency >= peak.frequency) {
        leftIdx = i;
        rightIdx = i;
        break;
      }
    }

    while (leftIdx > 0 && spectrum[leftIdx].amplitude > halfPower) {
      leftIdx--;
    }
    while (rightIdx < spectrum.length - 1 && spectrum[rightIdx].amplitude > halfPower) {
      rightIdx++;
    }

    const bandwidth = (rightIdx - leftIdx) * freqStep;
    return bandwidth > 0 ? peak.frequency / bandwidth : 0;
  }
}

export const peakDetector = new PeakDetector();
