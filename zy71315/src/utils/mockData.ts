import type { Experiment, RegressionTestData, SpectrumPoint, Peak } from '../types';
import { FFTAnalyzer } from './fft';
import { PeakDetector } from './peakDetection';

const fftAnalyzer = new FFTAnalyzer(44100, 2048);
const peakDetector = new PeakDetector();

const generateId = () => Math.random().toString(36).substring(2, 11);

export const createMockExperiment = (
  name: string,
  frequency: number,
  resonanceBoost: number = 1.5,
  noiseLevel: number = 0.05
): Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'> => {
  const spectrumData = fftAnalyzer.generateSpectrumFromFrequency(
    frequency,
    resonanceBoost,
    noiseLevel,
    3
  );
  
  const peaks = peakDetector.detectPeaks(spectrumData);

  return {
    name,
    status: 'tentative',
    tuningFork: {
      frequency,
      material: 'steel',
      status: 'confirmed',
    },
    resonanceBox: {
      length: 30,
      width: 10,
      height: 8,
      material: 'wood',
      status: 'confirmed',
    },
    microphone: {
      x: 0,
      y: 1,
      z: 2,
      status: 'tentative',
    },
    sampling: {
      sampleRate: 44100,
      bitDepth: 16,
      fftSize: 2048,
      status: 'confirmed',
    },
    spectrumData,
    peaks,
    noiseMarkers: [],
    notes: '',
    version: '1.0',
  };
};

export const mockExperiments: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>[] = [
  createMockExperiment('标准音叉 A4 (440Hz)', 440, 1.8, 0.03),
  createMockExperiment('中音 C (256Hz)', 256, 1.5, 0.04),
  createMockExperiment('高音 C (512Hz)', 512, 1.6, 0.03),
];

export const regressionTestData: RegressionTestData[] = [
  {
    id: 'test-noise-001',
    name: '噪声峰误判测试',
    description: '测试算法是否能正确区分真实峰值和噪声峰值',
    type: 'noise_misidentification',
    inputData: {
      name: '噪声测试实验',
      tuningFork: { frequency: 440, material: 'steel', status: 'confirmed' },
    },
    expectedPeaks: [
      { id: 'p1', frequency: 440, amplitude: -3, isNoise: false, status: 'tentative' },
      { id: 'p2', frequency: 880, amplitude: -10, isNoise: false, status: 'tentative' },
    ],
    expectedNoiseCount: 2,
  },
  {
    id: 'test-samplerate-001',
    name: '采样率不一致测试',
    description: '测试不同采样率下峰值检测的一致性',
    type: 'sample_rate_mismatch',
    inputData: {
      name: '采样率测试实验',
      sampling: { sampleRate: 48000, bitDepth: 16, fftSize: 2048, status: 'confirmed' },
    },
    expectedPeaks: [
      { id: 'p1', frequency: 440, amplitude: -5, isNoise: false, status: 'tentative' },
    ],
    expectedNoiseCount: 1,
  },
  {
    id: 'test-overlap-001',
    name: '峰值重叠测试',
    description: '测试相近频率峰值的分离能力',
    type: 'peak_overlap',
    inputData: {
      name: '峰值重叠测试',
      tuningFork: { frequency: 440, material: 'steel', status: 'confirmed' },
    },
    expectedPeaks: [
      { id: 'p1', frequency: 440, amplitude: -3, isNoise: false, status: 'tentative' },
      { id: 'p2', frequency: 455, amplitude: -8, isNoise: false, status: 'tentative' },
    ],
    expectedNoiseCount: 0,
  },
];

export const generateNoiseMisidentificationData = (): SpectrumPoint[] => {
  const baseSpectrum = fftAnalyzer.generateSpectrumFromFrequency(440, 1.5, 0.08);
  return fftAnalyzer.generateNoisePeaks(baseSpectrum, 4);
};

export const generateSampleRateMismatchData = (sampleRates: number[]): { sampleRate: number; spectrum: SpectrumPoint[] }[] => {
  return sampleRates.map((sr) => {
    const analyzer = new FFTAnalyzer(sr, 2048);
    return {
      sampleRate: sr,
      spectrum: analyzer.generateSpectrumFromFrequency(440, 1.5, 0.05),
    };
  });
};

export const generateOverlappingPeaksData = (frequencies: number[]): SpectrumPoint[] => {
  return fftAnalyzer.generateSpectrumWithOverlap(frequencies, 0.04);
};

export const createExperimentVersionPair = (
  baseFrequency: number,
  modifiedFrequency: number
) => {
  const baseData = createMockExperiment('原始实验', baseFrequency);
  const modifiedData = createMockExperiment('修改后实验', modifiedFrequency);

  return {
    base: {
      ...baseData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Experiment,
    modified: {
      ...modifiedData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: 'base',
    } as Experiment,
  };
};

export const comparisonColors = [
  '#00F5D4',
  '#9D4EDD',
  '#FF9F1C',
  '#EF4444',
  '#10B981',
];

export const frequencyPresets = [
  { label: 'C4', frequency: 261.63 },
  { label: 'D4', frequency: 293.66 },
  { label: 'E4', frequency: 329.63 },
  { label: 'F4', frequency: 349.23 },
  { label: 'G4', frequency: 392.00 },
  { label: 'A4', frequency: 440.00 },
  { label: 'B4', frequency: 493.88 },
  { label: 'C5', frequency: 523.25 },
];

export const boxSizePresets = [
  { label: '小型', length: 20, width: 8, height: 6 },
  { label: '中型', length: 30, width: 10, height: 8 },
  { label: '大型', length: 45, width: 12, height: 10 },
];

export const sampleRatePresets = [
  { label: '22050 Hz', value: 22050 },
  { label: '44100 Hz (标准)', value: 44100 },
  { label: '48000 Hz', value: 48000 },
  { label: '96000 Hz (高清', value: 96000 },
];
