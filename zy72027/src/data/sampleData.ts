import type { LevelParams, GameSession, PlayerChoice, SupplementaryNote } from '@/types'

export const LEVEL_PARAMS: LevelParams[] = [
  {
    id: 'lvl-001',
    name: '量子初探',
    difficulty: 'easy',
    noteTypes: ['do', 're', 'mi'],
    speedMultiplier: 1.0,
    noteCount: 12,
    duration: 30,
  },
  {
    id: 'lvl-002',
    name: '叠加态节奏',
    difficulty: 'medium',
    noteTypes: ['do', 're', 'mi', 'fa', 'sol'],
    speedMultiplier: 1.5,
    noteCount: 20,
    duration: 45,
  },
  {
    id: 'lvl-003',
    name: '纠缠狂想曲',
    difficulty: 'hard',
    noteTypes: ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'],
    speedMultiplier: 2.0,
    noteCount: 30,
    duration: 60,
  },
]

const BASE_TIME = 1748736000000

export const SAMPLE_SESSIONS: GameSession[] = [
  {
    id: 'sess-001',
    levelParams: LEVEL_PARAMS[0],
    status: 'ended',
    currentRound: 12,
    startedAt: BASE_TIME,
    pausedAt: null,
    totalPausedDuration: 5200,
    endedAt: BASE_TIME + 32000,
    endReason: '关卡完成',
    playerChoices: [
      { roundIndex: 1, noteId: 'n-01', action: 'hit', timestamp: BASE_TIME + 1500, score: 100 },
      { roundIndex: 2, noteId: 'n-02', action: 'hit', timestamp: BASE_TIME + 3200, score: 120 },
      { roundIndex: 3, noteId: 'n-03', action: 'miss', timestamp: BASE_TIME + 5100, score: 0 },
      { roundIndex: 4, noteId: 'n-04', action: 'hit', timestamp: BASE_TIME + 6800, score: 130 },
      { roundIndex: 5, noteId: 'n-05', action: 'hit', timestamp: BASE_TIME + 8500, score: 150 },
      { roundIndex: 6, noteId: 'n-06', action: 'wrong', timestamp: BASE_TIME + 10200, score: -20 },
      { roundIndex: 7, noteId: 'n-07', action: 'hit', timestamp: BASE_TIME + 17500, score: 140 },
      { roundIndex: 8, noteId: 'n-08', action: 'hit', timestamp: BASE_TIME + 19200, score: 160 },
      { roundIndex: 9, noteId: 'n-09', action: 'hit', timestamp: BASE_TIME + 21000, score: 170 },
      { roundIndex: 10, noteId: 'n-10', action: 'miss', timestamp: BASE_TIME + 22800, score: 0 },
      { roundIndex: 11, noteId: 'n-11', action: 'hit', timestamp: BASE_TIME + 24600, score: 180 },
      { roundIndex: 12, noteId: 'n-12', action: 'hit', timestamp: BASE_TIME + 26400, score: 200 },
    ],
    notes: [
      {
        id: 'note-001',
        roundIndex: 3,
        content: '暂停回来后节奏没跟上，建议下次暂停后先做一次热身练习再续接',
        author: '王老师',
        createdAt: BASE_TIME + 35000,
        isSupplementary: false,
        originalScoreSnapshot: 0,
      },
      {
        id: 'note-002',
        roundIndex: 6,
        content: '叠加态音符辨识有误，补录：该生对mi和fa的区分还需加强，建议增加单独练习',
        author: '王老师',
        createdAt: BASE_TIME + 86400000,
        isSupplementary: true,
        originalScoreSnapshot: -20,
      },
    ],
    source: '课堂计分表-2024春季第3周',
    createdAt: BASE_TIME,
  },
  {
    id: 'sess-002',
    levelParams: LEVEL_PARAMS[1],
    status: 'ended',
    currentRound: 20,
    startedAt: BASE_TIME + 172800000,
    pausedAt: null,
    totalPausedDuration: 18300,
    endedAt: BASE_TIME + 172800000 + 50000,
    endReason: '手动结束',
    playerChoices: [
      { roundIndex: 1, noteId: 'n-01', action: 'hit', timestamp: BASE_TIME + 172800000 + 1200, score: 110 },
      { roundIndex: 2, noteId: 'n-02', action: 'hit', timestamp: BASE_TIME + 172800000 + 2800, score: 120 },
      { roundIndex: 3, noteId: 'n-03', action: 'hit', timestamp: BASE_TIME + 172800000 + 4500, score: 130 },
      { roundIndex: 4, noteId: 'n-04', action: 'wrong', timestamp: BASE_TIME + 172800000 + 6200, score: -20 },
      { roundIndex: 5, noteId: 'n-05', action: 'hit', timestamp: BASE_TIME + 172800000 + 8000, score: 140 },
      { roundIndex: 6, noteId: 'n-06', action: 'miss', timestamp: BASE_TIME + 172800000 + 9800, score: 0 },
      { roundIndex: 7, noteId: 'n-07', action: 'hit', timestamp: BASE_TIME + 172800000 + 11500, score: 150 },
      { roundIndex: 8, noteId: 'n-08', action: 'hit', timestamp: BASE_TIME + 172800000 + 13200, score: 130 },
      { roundIndex: 9, noteId: 'n-09', action: 'hit', timestamp: BASE_TIME + 172800000 + 15000, score: 160 },
      { roundIndex: 10, noteId: 'n-10', action: 'hit', timestamp: BASE_TIME + 172800000 + 16800, score: 170 },
      { roundIndex: 11, noteId: 'n-11', action: 'wrong', timestamp: BASE_TIME + 172800000 + 36500, score: -30 },
      { roundIndex: 12, noteId: 'n-12', action: 'hit', timestamp: BASE_TIME + 172800000 + 38300, score: 140 },
      { roundIndex: 13, noteId: 'n-13', action: 'hit', timestamp: BASE_TIME + 172800000 + 40100, score: 150 },
      { roundIndex: 14, noteId: 'n-14', action: 'miss', timestamp: BASE_TIME + 172800000 + 41800, score: 0 },
      { roundIndex: 15, noteId: 'n-15', action: 'hit', timestamp: BASE_TIME + 172800000 + 43500, score: 160 },
      { roundIndex: 16, noteId: 'n-16', action: 'hit', timestamp: BASE_TIME + 172800000 + 45300, score: 170 },
      { roundIndex: 17, noteId: 'n-17', action: 'hit', timestamp: BASE_TIME + 172800000 + 47100, score: 180 },
      { roundIndex: 18, noteId: 'n-18', action: 'wrong', timestamp: BASE_TIME + 172800000 + 48800, score: -10 },
      { roundIndex: 19, noteId: 'n-19', action: 'hit', timestamp: BASE_TIME + 172800000 + 50600, score: 150 },
      { roundIndex: 20, noteId: 'n-20', action: 'hit', timestamp: BASE_TIME + 172800000 + 52400, score: 160 },
    ],
    notes: [
      {
        id: 'note-003',
        roundIndex: 11,
        content: '长时间暂停后状态明显下滑，后续3个回合错误率高，建议暂停时长控制在2分钟以内',
        author: '李老师',
        createdAt: BASE_TIME + 172800000 + 55000,
        isSupplementary: false,
        originalScoreSnapshot: -30,
      },
    ],
    source: '课堂计分表-2024春季第5周',
    createdAt: BASE_TIME + 172800000,
  },
]

export function createNewSession(levelParams: LevelParams): GameSession {
  return {
    id: `sess-${Date.now()}`,
    levelParams,
    status: 'idle',
    currentRound: 0,
    startedAt: null,
    pausedAt: null,
    totalPausedDuration: 0,
    endedAt: null,
    endReason: '',
    playerChoices: [],
    notes: [],
    source: '实时录入',
    createdAt: Date.now(),
  }
}

export function createPlayerChoice(
  roundIndex: number,
  noteId: string,
  action: PlayerChoice['action'],
  score: number
): PlayerChoice {
  return {
    roundIndex,
    noteId,
    action,
    timestamp: Date.now(),
    score,
  }
}

export function createSupplementaryNote(
  roundIndex: number,
  content: string,
  author: string,
  originalScoreSnapshot: number
): SupplementaryNote {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roundIndex,
    content,
    author,
    createdAt: Date.now(),
    isSupplementary: true,
    originalScoreSnapshot,
  }
}
