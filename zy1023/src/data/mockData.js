import { MARKER_TYPES } from '../constants/markerTypes'

export const generateMockWaveform = (points = 1000) => {
  const waveform = []
  let value = 0.5
  
  for (let i = 0; i < points; i++) {
    const randomChange = (Math.random() - 0.5) * 0.3
    value = Math.max(0, Math.min(1, value + randomChange))
    
    const sineWave = Math.sin(i * 0.02) * 0.3 + 0.5
    const combined = (value + sineWave) / 2
    
    waveform.push(combined)
  }
  
  return waveform
}

export const mockAudioInfo = {
  id: 'mock-audio-1',
  name: '示例播客录音_30分钟.mp3',
  duration: 30 * 60,
  format: 'audio/mpeg',
  size: 45 * 1024 * 1024,
  sampleRate: 44100,
  isMock: true
}

export const mockMarkers = [
  {
    id: 'marker-1',
    time: 125.5,
    type: MARKER_TYPES.DELETE.id,
    note: '口误，重新说了一遍，这里可以直接删掉',
    createdAt: Date.now() - 3600000
  },
  {
    id: 'marker-2',
    time: 342.0,
    type: MARKER_TYPES.TITLE.id,
    note: '这一段讲得很好，可以作为标题或者引言',
    createdAt: Date.now() - 3000000
  },
  {
    id: 'marker-3',
    time: 520.25,
    type: MARKER_TYPES.BGM.id,
    note: '这里可以插入一段轻快的背景音乐',
    createdAt: Date.now() - 2400000
  },
  {
    id: 'marker-4',
    time: 785.75,
    type: MARKER_TYPES.PICKUP.id,
    note: '这里声音太小，需要重新补录一遍',
    createdAt: Date.now() - 1800000
  },
  {
    id: 'marker-5',
    time: 1024.5,
    type: MARKER_TYPES.DELETE.id,
    note: '咳嗽声，需要删除',
    createdAt: Date.now() - 1200000
  },
  {
    id: 'marker-6',
    time: 1350.0,
    type: MARKER_TYPES.TITLE.id,
    note: '核心观点，适合做章节标题',
    createdAt: Date.now() - 600000
  }
]

export const mockProject = {
  version: '1.0.0',
  createdAt: Date.now() - 7200000,
  updatedAt: Date.now(),
  audioInfo: mockAudioInfo,
  markers: mockMarkers,
  settings: {
    zoomLevel: 1,
    playbackRate: 1.0,
    volume: 0.8
  }
}
