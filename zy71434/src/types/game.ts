export type GestureType = 'fist' | 'index' | 'peace' | 'three' | 'four' | 'open' | 'thumb'

export type NoteType = 'Do' | 'Re' | 'Mi' | 'Fa' | 'Sol' | 'La' | 'Si'

export type Difficulty = 'easy' | 'normal' | 'hard'

export type GameStatus = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'

export type FeedbackType = 'correct' | 'wrong' | 'timeout'

export interface GestureResult {
  gesture: GestureType
  confidence: number
  landmarks: number[][]
}

export interface GestureData {
  landmarks: number[][]
  recognizedGesture: GestureType
  confidence: number
}

export interface ScaleData {
  expected: NoteType
  actual: NoteType | null
  isCorrect: boolean
  confidence: number
}

export interface BeatData {
  expectedTime: number
  actualTime: number
  offsetMs: number
  isOnBeat: boolean
}

export interface FeedbackData {
  type: FeedbackType
  message: string
  correctionHint?: string
}

export interface GameEvent {
  id: string
  sessionId: string
  roundIndex: number
  beatIndex: number
  timestamp: number
  gesture: GestureData
  scale: ScaleData
  beat: BeatData
  feedback: FeedbackData
}

export interface NoteInfo {
  note: NoteType
  gesture: GestureType
  label: string
  emoji: string
  color: string
  description: string
  frequency: number
}

export const NOTES: Record<NoteType, NoteInfo> = {
  Do:  { note: 'Do',  gesture: 'fist',   label: 'Do (1)',  emoji: '✊', color: '#FF5252', description: '握拳',   frequency: 261.63 },
  Re:  { note: 'Re',  gesture: 'index',  label: 'Re (2)',  emoji: '☝️', color: '#FF8C42', description: '竖食指', frequency: 293.66 },
  Mi:  { note: 'Mi',  gesture: 'peace',  label: 'Mi (3)',  emoji: '✌️', color: '#FFD93D', description: '剪刀手', frequency: 329.63 },
  Fa:  { note: 'Fa',  gesture: 'three',  label: 'Fa (4)',  emoji: '🤟', color: '#4CAF50', description: '三指',   frequency: 349.23 },
  Sol: { note: 'Sol', gesture: 'four',   label: 'Sol (5)', emoji: '🖖', color: '#42A5F5', description: '四指',   frequency: 392.00 },
  La:  { note: 'La',  gesture: 'open',   label: 'La (6)',  emoji: '🖐️', color: '#AB47BC', description: '五指张开', frequency: 440.00 },
  Si:  { note: 'Si',  gesture: 'thumb',  label: 'Si (7)',  emoji: '👍', color: '#F06292', description: '竖大拇指', frequency: 493.88 },
}

export const GESTURE_TO_NOTE: Record<GestureType, NoteType> = {
  fist: 'Do',
  index: 'Re',
  peace: 'Mi',
  three: 'Fa',
  four: 'Sol',
  open: 'La',
  thumb: 'Si',
}

export const NOTE_ORDER: NoteType[] = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

export const DIFFICULTY_CONFIG = {
  easy:   { beatsPerRound: 4,  sequenceLength: 1, bpm: 60, label: '简单 🌟',  description: '单音练习' },
  normal: { beatsPerRound: 8,  sequenceLength: 2, bpm: 80, label: '普通 ⭐⭐', description: '连续2音' },
  hard:   { beatsPerRound: 12, sequenceLength: 4, bpm: 100, label: '困难 ⭐⭐⭐', description: '连续4音' },
}
