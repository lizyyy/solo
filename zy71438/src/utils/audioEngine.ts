import { OscillatorConfig, WaveformType, WaveformData, SimilarityBreakdown } from '../types';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 2048;

export const generateWaveformSample = (
  waveform: WaveformType,
  t: number,
  frequency: number,
  phase: number = 0
): number => {
  const angle = 2 * Math.PI * frequency * t + phase * 2 * Math.PI;
  
  switch (waveform) {
    case 'sine':
      return Math.sin(angle);
    case 'square':
      return Math.sin(angle) >= 0 ? 1 : -1;
    case 'sawtooth':
      return 2 * (t * frequency - Math.floor(t * frequency + 0.5));
    case 'triangle':
      return 2 * Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) - 1;
    default:
      return Math.sin(angle);
  }
};

export const generateWaveformData = (
  oscillators: OscillatorConfig[],
  duration: number = 0.05
): WaveformData => {
  const sampleCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(sampleCount);
  
  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    
    for (const osc of oscillators) {
      if (osc.enabled && osc.volume > 0) {
        sample += generateWaveformSample(osc.waveform, t, osc.frequency, osc.phase) * osc.volume;
      }
    }
    
    samples[i] = sample;
  }
  
  return { samples, sampleRate: SAMPLE_RATE };
};

export const getWaveformPeak = (waveformData: WaveformData): number => {
  let peak = 0;
  for (let i = 0; i < waveformData.samples.length; i++) {
    const abs = Math.abs(waveformData.samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
};

export const detectVolumePeak = (waveformData: WaveformData, threshold: number = 0.95): boolean => {
  return getWaveformPeak(waveformData) > threshold;
};

export const detectPhaseCancellation = (
  oscillators: OscillatorConfig[],
  threshold: number = 0.1
): { detected: boolean; details: Record<string, any> } => {
  const enabledOscs = oscillators.filter(o => o.enabled && o.volume > 0);
  
  if (enabledOscs.length < 2) {
    return { detected: false, details: {} };
  }
  
  const waveformData = generateWaveformData(oscillators);
  const peak = getWaveformPeak(waveformData);
  
  const totalVolume = enabledOscs.reduce((sum, o) => sum + o.volume, 0);
  const expectedPeak = totalVolume * 0.8;
  
  const cancellationRatio = peak / expectedPeak;
  
  const details: Record<string, any> = {
    peak,
    expectedPeak,
    cancellationRatio,
    enabledOscillators: enabledOscs.length,
  };
  
  const frequencyGroups: Record<number, OscillatorConfig[]> = {};
  enabledOscs.forEach(osc => {
    const freqKey = Math.round(osc.frequency);
    if (!frequencyGroups[freqKey]) frequencyGroups[freqKey] = [];
    frequencyGroups[freqKey].push(osc);
  });
  
  Object.entries(frequencyGroups).forEach(([freq, oscs]) => {
    if (oscs.length >= 2) {
      details[`freq_${freq}_oscs`] = oscs.map(o => ({
        id: o.id,
        phase: o.phase,
        volume: o.volume,
      }));
    }
  });
  
  return {
    detected: cancellationRatio < threshold,
    details,
  };
};

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;

  private initContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;
    }
    return this.audioContext;
  }

  play(oscillators: OscillatorConfig[]): void {
    this.stop();
    const ctx = this.initContext();
    this.isPlaying = true;

    oscillators.forEach((osc, index) => {
      if (osc.enabled && osc.volume > 0) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = osc.waveform;
        oscillator.frequency.value = osc.frequency;

        const phaseOffset = ctx.createPeriodicWave(
          new Float32Array([0, Math.cos(osc.phase * 2 * Math.PI)]),
          new Float32Array([0, Math.sin(osc.phase * 2 * Math.PI)])
        );
        oscillator.setPeriodicWave(phaseOffset);

        gainNode.gain.value = osc.volume;

        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain!);

        oscillator.start();
        this.oscillators.push(oscillator);
        this.gains.push(gainNode);
      }
    });
  }

  stop(): void {
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    this.oscillators = [];
    this.gains = [];
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  close(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioEngine = new AudioEngine();

export const calculateFFT = (samples: Float32Array): Float32Array => {
  const n = samples.length;
  const magnitudes = new Float32Array(n / 2);
  
  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      real += samples[t] * Math.cos(angle);
      imag -= samples[t] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag) / n;
  }
  
  return magnitudes;
};

export const calculateSimilarity = (
  userOscillators: OscillatorConfig[],
  targetOscillators: OscillatorConfig[]
): SimilarityBreakdown => {
  const userWaveform = generateWaveformData(userOscillators);
  const targetWaveform = generateWaveformData(targetOscillators);
  
  const waveformMatch = calculateWaveformSimilarity(userWaveform.samples, targetWaveform.samples);
  
  const userFFT = calculateFFT(userWaveform.samples);
  const targetFFT = calculateFFT(targetWaveform.samples);
  const frequencyMatch = calculateFFTSimilarity(userFFT, targetFFT);
  
  const harmonicMatch = calculateHarmonicSimilarity(userOscillators, targetOscillators);
  
  const total = waveformMatch * 0.4 + frequencyMatch * 0.4 + harmonicMatch * 0.2;
  
  return {
    waveformMatch: Math.round(waveformMatch * 100),
    frequencyMatch: Math.round(frequencyMatch * 100),
    harmonicMatch: Math.round(harmonicMatch * 100),
    total: Math.round(total * 100),
  };
};

const calculateWaveformSimilarity = (a: Float32Array, b: Float32Array): number => {
  const minLen = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < minLen; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  const correlation = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.abs(correlation);
};

const calculateFFTSimilarity = (a: Float32Array, b: Float32Array): number => {
  const minLen = Math.min(a.length, b.length);
  let intersection = 0;
  let union = 0;
  
  const maxA = Math.max(...a);
  const maxB = Math.max(...b);
  
  for (let i = 0; i < minLen; i++) {
    const normA = maxA > 0 ? a[i] / maxA : 0;
    const normB = maxB > 0 ? b[i] / maxB : 0;
    intersection += Math.min(normA, normB);
    union += Math.max(normA, normB);
  }
  
  return union > 0 ? intersection / union : 0;
};

const calculateHarmonicSimilarity = (
  userOscs: OscillatorConfig[],
  targetOscs: OscillatorConfig[]
): number => {
  const userEnabled = userOscs.filter(o => o.enabled && o.volume > 0.01);
  const targetEnabled = targetOscs.filter(o => o.enabled && o.volume > 0.01);
  
  if (userEnabled.length === 0 && targetEnabled.length === 0) return 1;
  if (userEnabled.length === 0 || targetEnabled.length === 0) return 0;
  
  let matchScore = 0;
  const maxOscs = Math.max(userEnabled.length, targetEnabled.length);
  
  targetEnabled.forEach(target => {
    let bestMatch = 0;
    userEnabled.forEach(user => {
      const freqRatio = Math.min(user.frequency, target.frequency) / Math.max(user.frequency, target.frequency);
      const waveformMatch = user.waveform === target.waveform ? 1 : 0.5;
      const volumeRatio = Math.min(user.volume, target.volume) / Math.max(user.volume, target.volume);
      
      const oscMatch = freqRatio * 0.5 + waveformMatch * 0.3 + volumeRatio * 0.2;
      if (oscMatch > bestMatch) bestMatch = oscMatch;
    });
    matchScore += bestMatch;
  });
  
  return matchScore / maxOscs;
};
