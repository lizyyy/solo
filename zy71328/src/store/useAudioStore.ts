import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AudioFile, Selection, Track, LoudnessData, PeakMark, ProtectedRegion } from '../types'

interface AudioState {
  audioFiles: AudioFile[]
  tracks: Track[]
  loudnessData: Record<string, LoudnessData>
  peakMarks: PeakMark[]
  protectedRegions: ProtectedRegion[]
  currentAudioId: string | null
  isPlaying: boolean
  currentTime: number
  selection: Selection | null
  previewMode: 'original' | 'processed'
  addAudioFile: (file: Omit<AudioFile, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void
  removeAudioFile: (id: string) => void
  updateAudioFile: (id: string, updates: Partial<AudioFile>) => void
  setCurrentAudio: (id: string | null) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setSelection: (selection: Selection | null) => void
  setAudioFiles: (files: AudioFile[]) => void
  setTracks: (tracks: Track[]) => void
  addTrack: (track: Omit<Track, 'id'>) => void
  updateTrack: (id: string, updates: Partial<Track>) => void
  setLoudnessData: (audioId: string, data: LoudnessData) => void
  setPeakMarks: (marks: PeakMark[]) => void
  addPeakMark: (mark: Omit<PeakMark, 'id'>) => void
  updatePeakMark: (id: string, updates: Partial<PeakMark>) => void
  setProtectedRegions: (regions: ProtectedRegion[]) => void
  addProtectedRegion: (region: Omit<ProtectedRegion, 'id'>) => void
  updateProtectedRegion: (id: string, updates: Partial<ProtectedRegion>) => void
  setPreviewMode: (mode: 'original' | 'processed') => void
  processAudio: (audioId: string, config: any) => Promise<void>
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      audioFiles: [],
      tracks: [],
      loudnessData: {},
      peakMarks: [],
      protectedRegions: [],
      currentAudioId: null,
      isPlaying: false,
      currentTime: 0,
      selection: null,
      previewMode: 'original',
      addAudioFile: (file) =>
        set((state) => ({
          audioFiles: [
            ...state.audioFiles,
            {
              ...file,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              status: 'pending' as const,
            },
          ],
        })),
      removeAudioFile: (id) =>
        set((state) => ({
          audioFiles: state.audioFiles.filter((f) => f.id !== id),
          tracks: state.tracks.filter((t) => t.audioId !== id),
          peakMarks: state.peakMarks.filter((p) => p.audioId !== id),
          protectedRegions: state.protectedRegions.filter((r) => r.audioId !== id),
          currentAudioId: state.currentAudioId === id ? null : state.currentAudioId,
        })),
      updateAudioFile: (id, updates) =>
        set((state) => ({
          audioFiles: state.audioFiles.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
          ),
        })),
      setCurrentAudio: (id) => set({ currentAudioId: id, currentTime: 0 }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setSelection: (selection) => set({ selection }),
      setAudioFiles: (files) => set({ audioFiles: files }),
      setTracks: (tracks) => set({ tracks }),
      addTrack: (track) =>
        set((state) => ({
          tracks: [...state.tracks, { ...track, id: crypto.randomUUID() }],
        })),
      updateTrack: (id, updates) =>
        set((state) => ({
          tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      setLoudnessData: (audioId, data) =>
        set((state) => ({
          loudnessData: { ...state.loudnessData, [audioId]: data },
        })),
      setPeakMarks: (marks) => set({ peakMarks: marks }),
      addPeakMark: (mark) =>
        set((state) => ({
          peakMarks: [...state.peakMarks, { ...mark, id: crypto.randomUUID() }],
        })),
      updatePeakMark: (id, updates) =>
        set((state) => ({
          peakMarks: state.peakMarks.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      setProtectedRegions: (regions) => set({ protectedRegions: regions }),
      addProtectedRegion: (region) =>
        set((state) => ({
          protectedRegions: [...state.protectedRegions, { ...region, id: crypto.randomUUID() }],
        })),
      updateProtectedRegion: (id, updates) =>
        set((state) => ({
          protectedRegions: state.protectedRegions.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      setPreviewMode: (mode) => set({ previewMode: mode }),
      processAudio: async (audioId: string, config: any) => {
        const audioFile = get().audioFiles.find((f) => f.id === audioId)
        if (!audioFile || !audioFile.audioBuffer) return

        set((state) => ({
          audioFiles: state.audioFiles.map((f) =>
            f.id === audioId ? { ...f, status: 'processing' as const } : f
          ),
        }))

        await new Promise((resolve) => setTimeout(resolve, 1500))

        const gainAdjustment = config.targetLufs - (audioFile.integratedLufs || -18)
        const gainFactor = Math.pow(10, gainAdjustment / 20)

        const originalData = audioFile.audioBuffer.getChannelData(0)
        const processedData = new Float32Array(originalData.length)

        for (let i = 0; i < originalData.length; i++) {
          let sample = originalData[i] * gainFactor
          const peakLimit = Math.pow(10, config.truePeakLimit / 20)
          if (sample > peakLimit) sample = peakLimit
          if (sample < -peakLimit) sample = -peakLimit
          processedData[i] = sample
        }

        const processedBuffer = audioFile.audioBuffer
        const copyBuffer = new AudioBuffer({
          length: processedBuffer.length,
          numberOfChannels: processedBuffer.numberOfChannels,
          sampleRate: processedBuffer.sampleRate,
        })
        copyBuffer.copyToChannel(processedData, 0)

        set((state) => ({
          audioFiles: state.audioFiles.map((f) =>
            f.id === audioId
              ? {
                  ...f,
                  processedAudioBuffer: copyBuffer,
                  integratedLufs: config.targetLufs,
                  truePeak: config.truePeakLimit,
                  status: 'completed' as const,
                  updatedAt: Date.now(),
                }
              : f
          ),
        }))
      },
    }),
    {
      name: 'podcast-audio-v1',
      partialize: (state) => ({
        audioFiles: state.audioFiles.map(({ audioBuffer, waveformData, processedAudioBuffer, ...rest }) => rest),
        tracks: state.tracks,
        loudnessData: state.loudnessData,
        peakMarks: state.peakMarks,
        protectedRegions: state.protectedRegions,
        currentAudioId: state.currentAudioId,
        currentTime: state.currentTime,
        selection: state.selection,
        previewMode: state.previewMode,
      }),
    }
  )
)
