import type { SpectrumPoint } from '../types';

export class FFTAnalyzer {
  private sampleRate: number;
  private fftSize: number;
  private frequencyBinCount: number;

  constructor(sampleRate: number = 44100, fftSize: number = 2048) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.frequencyBinCount = fftSize / 2;
  }

  generateSpectrumFromFrequency(
    targetFrequency: number,
    resonanceBoost: number = 1.5,
    noiseLevel: number = 0.05,
    harmonicCount: number = 3
  ): SpectrumPoint[] {
    const spectrum: SpectrumPoint[] = [];
    const frequencyStep = this.sampleRate / this.fftSize;

    for (let i = 0; i < this.frequencyBinCount; i++) {
      const frequency = i * frequencyStep;
      let amplitude = 0;

      for (let h = 1; h <= harmonicCount; h++) {
        const harmonicFreq = targetFrequency * h;
        const distance = Math.abs(frequency - harmonicFreq);
        const bandwidth = targetFrequency * 0.05;
        
        const harmonicAmplitude = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth)) / h;
        amplitude += harmonicAmplitude;
      }

      const resonanceFreq = this.calculateResonanceFrequency();
      const resonanceDistance = Math.abs(frequency - resonanceFreq);
      const resonanceBandwidth = resonanceFreq * 0.08;
      const resonanceAmplitude = Math.exp(-(resonanceDistance * resonanceDistance) / (2 * resonanceBandwidth * resonanceBandwidth)) * (resonanceBoost - 1);
      amplitude += resonanceAmplitude;

      amplitude += (Math.random() - 0.5) * noiseLevel;
      amplitude += noiseLevel * 0.3;

      amplitude = Math.max(0, Math.min(1, amplitude));

      const db = this.linearToDb(amplitude);
      
      spectrum.push({
        frequency,
        amplitude: db,
      });
    }

    return spectrum;
  }

  generateSpectrumWithOverlap(
    frequencies: number[],
    noiseLevel: number = 0.05
  ): SpectrumPoint[] {
    const spectrum: SpectrumPoint[] = [];
    const frequencyStep = this.sampleRate / this.fftSize;

    for (let i = 0; i < this.frequencyBinCount; i++) {
      const frequency = i * frequencyStep;
      let amplitude = 0;

      frequencies.forEach((targetFrequency, index) => {
        const distance = Math.abs(frequency - targetFrequency);
        const bandwidth = targetFrequency * 0.03;
        const weight = 1 - index * 0.2;
        amplitude += Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth)) * weight;
      });

      amplitude += (Math.random() - 0.5) * noiseLevel;
      amplitude = Math.max(0, Math.min(1, amplitude));

      spectrum.push({
        frequency,
        amplitude: this.linearToDb(amplitude),
      });
    }

    return spectrum;
  }

  generateNoisePeaks(
    baseSpectrum: SpectrumPoint[],
    noisePeakCount: number = 3
  ): SpectrumPoint[] {
    const spectrum = [...baseSpectrum];
    
    for (let i = 0; i < noisePeakCount; i++) {
      const randomIndex = Math.floor(Math.random() * spectrum.length * 0.8) + Math.floor(spectrum.length * 0.1);
      const peakHeight = 0.2 + Math.random() * 0.3;
      const peakWidth = 5 + Math.floor(Math.random() * 10);

      for (let j = -peakWidth; j <= peakWidth; j++) {
        const idx = randomIndex + j;
        if (idx >= 0 && idx < spectrum.length) {
          const gaussian = Math.exp(-(j * j) / (peakWidth * peakWidth * 0.5));
          spectrum[idx] = {
            ...spectrum[idx],
            amplitude: spectrum[idx].amplitude + this.linearToDb(peakHeight * gaussian),
          };
        }
      }
    }

    return spectrum;
  }

  private calculateResonanceFrequency(): number {
    return 440;
  }

  linearToDb(linear: number): number {
    return 20 * Math.log10(Math.max(linear, 0.00001));
  }

  dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  normalizeSpectrum(spectrum: SpectrumPoint[]): SpectrumPoint[] {
    const maxAmplitude = Math.max(...spectrum.map((p) => p.amplitude));
    const minAmplitude = Math.min(...spectrum.map((p) => p.amplitude));
    const range = maxAmplitude - minAmplitude;

    return spectrum.map((point) => ({
      ...point,
      amplitude: ((point.amplitude - minAmplitude) / range) * 100 - 100,
    }));
  }

  applyHannWindow(data: Float32Array): Float32Array {
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
      result[i] = data[i] * window;
    }
    return result;
  }

  getFrequencyResolution(): number {
    return this.sampleRate / this.fftSize;
  }

  getFrequencyForBin(binIndex: number): number {
    return binIndex * this.sampleRate / this.fftSize;
  }

  getBinForFrequency(frequency: number): number {
    return Math.round(frequency * this.fftSize / this.sampleRate);
  }

  interpolatePeak(
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
    const interpolatedAmplitude = y1 - 0.25 * (y0 - y2) * offset;
    const interpolatedFrequency = spectrum[peakIndex].frequency + offset * this.getFrequencyResolution();

    return {
      frequency: interpolatedFrequency,
      amplitude: interpolatedAmplitude,
    };
  }
}

export const fftAnalyzer = new FFTAnalyzer();
