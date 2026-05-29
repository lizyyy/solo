import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProcessConfig, PresetName } from '../types'

const defaultConfig: ProcessConfig = {
  targetLufs: -16,
  lufsTolerance: 1,
  truePeakLimit: -1,
  compressorThreshold: -18,
  compressorRatio: 4,
  attackTime: 5,
  releaseTime: 50,
  enableAutoGain: true,
  enablePeakLimiter: true,
  protectIntro: true,
  protectOutro: true,
  introDuration: 3,
  outroDuration: 3,
  fadeInDuration: 0.5,
  fadeOutDuration: 0.5,
}

const presets: Record<PresetName, Partial<ProcessConfig>> = {
  podcast: {
    targetLufs: -16,
    lufsTolerance: 1,
    truePeakLimit: -1,
    compressorThreshold: -18,
    compressorRatio: 4,
    attackTime: 5,
    releaseTime: 50,
    enableAutoGain: true,
    enablePeakLimiter: true,
    protectIntro: true,
    protectOutro: true,
  },
  music: {
    targetLufs: -14,
    lufsTolerance: 0.5,
    truePeakLimit: -1,
    compressorThreshold: -20,
    compressorRatio: 2,
    attackTime: 10,
    releaseTime: 100,
    enableAutoGain: true,
    enablePeakLimiter: true,
    protectIntro: false,
    protectOutro: false,
  },
  audiobook: {
    targetLufs: -18,
    lufsTolerance: 1,
    truePeakLimit: -2,
    compressorThreshold: -24,
    compressorRatio: 3,
    attackTime: 5,
    releaseTime: 150,
    enableAutoGain: true,
    enablePeakLimiter: true,
    protectIntro: true,
    protectOutro: true,
  },
  voiceover: {
    targetLufs: -16,
    lufsTolerance: 1,
    truePeakLimit: -1,
    compressorThreshold: -22,
    compressorRatio: 4,
    attackTime: 2,
    releaseTime: 80,
    enableAutoGain: true,
    enablePeakLimiter: true,
    protectIntro: true,
    protectOutro: true,
  },
}

interface ConfigState {
  processConfig: ProcessConfig
  updateConfig: (updates: Partial<ProcessConfig>) => void
  resetConfig: () => void
  applyPreset: (presetName: PresetName) => void
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      processConfig: defaultConfig,
      updateConfig: (updates) =>
        set((state) => ({
          processConfig: { ...state.processConfig, ...updates },
        })),
      resetConfig: () => set({ processConfig: defaultConfig }),
      applyPreset: (presetName) =>
        set((state) => ({
          processConfig: { ...state.processConfig, ...presets[presetName] },
        })),
    }),
    {
      name: 'podcast-config-v1',
    }
  )
)
