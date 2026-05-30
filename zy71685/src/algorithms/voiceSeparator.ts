import { SeparationResult, Instrument } from '@/types';

export class VoiceSeparator {
  private sampleRate: number = 44100;
  private frameSize: number = 2048;
  private hopSize: number = 1024;

  setSampleRate(rate: number): void {
    this.sampleRate = rate;
  }

  async separate(audioBuffer: AudioBuffer): Promise<SeparationResult[]> {
    const channelData = audioBuffer.getChannelData(0);
    const results: SeparationResult[] = [];

    for (let i = 0; i < channelData.length - this.frameSize; i += this.hopSize) {
      const frame = channelData.slice(i, i + this.frameSize);
      const features = this.extractSpectralFeatures(frame);

      const violinEnergy = this.calculateViolinEnergy(features);
      const fluteEnergy = this.calculateFluteEnergy(features);

      let dominantInstrument: Instrument | 'both' | 'none' = 'none';
      const totalEnergy = violinEnergy + fluteEnergy;
      const violinRatio = totalEnergy > 0 ? violinEnergy / totalEnergy : 0;
      const fluteRatio = totalEnergy > 0 ? fluteEnergy / totalEnergy : 0;

      if (totalEnergy < 0.01) {
        dominantInstrument = 'none';
      } else if (violinRatio > 0.6) {
        dominantInstrument = 'violin';
      } else if (fluteRatio > 0.6) {
        dominantInstrument = 'flute';
      } else if (violinRatio > 0.3 && fluteRatio > 0.3) {
        dominantInstrument = 'both';
      } else if (violinRatio > fluteRatio) {
        dominantInstrument = 'violin';
      } else if (fluteRatio > violinRatio) {
        dominantInstrument = 'flute';
      }

      results.push({
        time: i / this.sampleRate,
        dominantInstrument,
        violinEnergy,
        fluteEnergy,
      });
    }

    return results;
  }

  private extractSpectralFeatures(frame: Float32Array): {
    spectrum: Float32Array;
    centroid: number;
    rolloff: number;
    flatness: number;
    mfcc: number[];
  } {
    const n = frame.length;
    const spectrum = new Float32Array(n / 2);

    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
      real[i] = frame[i] * window;
      imag[i] = 0;
    }

    this.fft(real, imag);

    let totalEnergy = 0;
    let weightedSum = 0;
    let cumulativeEnergy = 0;
    let rolloff = 0;
    let geometricMean = 0;
    let arithmeticMean = 0;

    for (let i = 0; i < n / 2; i++) {
      spectrum[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      const freq = i * this.sampleRate / n;
      totalEnergy += spectrum[i];
      weightedSum += freq * spectrum[i];
      geometricMean += Math.log(spectrum[i] + 1e-10);
      arithmeticMean += spectrum[i];
    }

    if (totalEnergy > 0) {
      const threshold = totalEnergy * 0.85;
      for (let i = 0; i < n / 2; i++) {
        cumulativeEnergy += spectrum[i];
        if (cumulativeEnergy >= threshold) {
          rolloff = i * this.sampleRate / n;
          break;
        }
      }
    }

    geometricMean = Math.exp(geometricMean / (n / 2));
    arithmeticMean = arithmeticMean / (n / 2);
    const flatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

    const centroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;

    return {
      spectrum,
      centroid,
      rolloff,
      flatness,
      mfcc: this.calculateMFCC(spectrum),
    };
  }

  private fft(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    if (n <= 1) return;

    const half = n / 2;
    const evenReal = new Float32Array(half);
    const evenImag = new Float32Array(half);
    const oddReal = new Float32Array(half);
    const oddImag = new Float32Array(half);

    for (let i = 0; i < half; i++) {
      evenReal[i] = real[2 * i];
      evenImag[i] = imag[2 * i];
      oddReal[i] = real[2 * i + 1];
      oddImag[i] = imag[2 * i + 1];
    }

    this.fft(evenReal, evenImag);
    this.fft(oddReal, oddImag);

    for (let k = 0; k < half; k++) {
      const angle = -2 * Math.PI * k / n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tReal = cos * oddReal[k] - sin * oddImag[k];
      const tImag = sin * oddReal[k] + cos * oddImag[k];
      real[k] = evenReal[k] + tReal;
      imag[k] = evenImag[k] + tImag;
      real[k + half] = evenReal[k] - tReal;
      imag[k + half] = evenImag[k] - tImag;
    }
  }

  private calculateMFCC(spectrum: Float32Array): number[] {
    const numFilters = 26;
    const numCoeffs = 13;
    const mfcc: number[] = [];

    const melFilters = this.createMelFilterbank(numFilters, spectrum.length);
    const filterEnergies: number[] = [];

    for (let f = 0; f < numFilters; f++) {
      let energy = 0;
      for (let i = 0; i < spectrum.length; i++) {
        energy += spectrum[i] * melFilters[f][i];
      }
      filterEnergies.push(Math.log(energy + 1e-10));
    }

    for (let c = 0; c < numCoeffs; c++) {
      let coeff = 0;
      for (let f = 0; f < numFilters; f++) {
        coeff += filterEnergies[f] * Math.cos(Math.PI * c * (f + 0.5) / numFilters);
      }
      mfcc.push(coeff);
    }

    return mfcc;
  }

  private createMelFilterbank(numFilters: number, spectrumSize: number): number[][] {
    const filters: number[][] = [];
    const minFreq = 300;
    const maxFreq = this.sampleRate / 2;
    const minMel = this.freqToMel(minFreq);
    const maxMel = this.freqToMel(maxFreq);
    const melStep = (maxMel - minMel) / (numFilters + 1);

    for (let f = 0; f < numFilters; f++) {
      const filter = new Array(spectrumSize).fill(0);
      const leftMel = minMel + f * melStep;
      const centerMel = minMel + (f + 1) * melStep;
      const rightMel = minMel + (f + 2) * melStep;

      const leftFreq = this.melToFreq(leftMel);
      const centerFreq = this.melToFreq(centerMel);
      const rightFreq = this.melToFreq(rightMel);

      const leftBin = Math.floor(leftFreq * spectrumSize * 2 / this.sampleRate);
      const centerBin = Math.floor(centerFreq * spectrumSize * 2 / this.sampleRate);
      const rightBin = Math.floor(rightFreq * spectrumSize * 2 / this.sampleRate);

      for (let i = leftBin; i < centerBin; i++) {
        filter[i] = (i - leftBin) / (centerBin - leftBin);
      }
      for (let i = centerBin; i < rightBin; i++) {
        filter[i] = (rightBin - i) / (rightBin - centerBin);
      }

      filters.push(filter);
    }

    return filters;
  }

  private freqToMel(freq: number): number {
    return 2595 * Math.log10(1 + freq / 700);
  }

  private melToFreq(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  private calculateViolinEnergy(features: {
    centroid: number;
    rolloff: number;
    flatness: number;
    mfcc: number[];
  }): number {
    let energy = 0;

    if (features.centroid > 1500 && features.centroid < 8000) {
      energy += 0.3;
    }

    if (features.rolloff > 3000 && features.rolloff < 12000) {
      energy += 0.2;
    }

    if (features.flatness < 0.3) {
      energy += 0.2;
    }

    if (features.mfcc.length >= 5) {
      const highFreqEnergy = features.mfcc.slice(2, 8).reduce((a, b) => a + b, 0);
      energy += Math.min(0.3, Math.abs(highFreqEnergy) / 100);
    }

    return Math.min(1, energy);
  }

  private calculateFluteEnergy(features: {
    centroid: number;
    rolloff: number;
    flatness: number;
    mfcc: number[];
  }): number {
    let energy = 0;

    if (features.centroid > 800 && features.centroid < 4000) {
      energy += 0.3;
    }

    if (features.rolloff > 2000 && features.rolloff < 8000) {
      energy += 0.2;
    }

    if (features.flatness > 0.15 && features.flatness < 0.5) {
      energy += 0.3;
    }

    if (features.mfcc.length >= 3) {
      const lowFreqStability = Math.abs(features.mfcc[0] - features.mfcc[1]);
      energy += Math.min(0.2, 1 - lowFreqStability / 50);
    }

    return Math.min(1, energy);
  }
}

export const voiceSeparator = new VoiceSeparator();
