import type { Game, Class, Student, Teacher, GameSession, Move, ErrorDetail, Score, Phrase } from '@/types/music';
import { getPhraseById } from '@/data/phrases';

export const SAMPLE_TEACHER: Teacher = {
  id: 'teacher-001',
  name: '张老师',
  email: 'zhang@jazzschool.edu',
};

export const SAMPLE_CLASS: Class = {
  id: 'class-001',
  name: '爵士即兴入门班',
  teacherId: 'teacher-001',
  joinCode: 'JAZZ2024',
  students: [
    { id: 'student-001', name: '小明', classId: 'class-001' },
    { id: 'student-002', name: '小红', classId: 'class-001' },
    { id: 'student-003', name: '小刚', classId: 'class-001' },
    { id: 'student-004', name: '小丽', classId: 'class-001' },
    { id: 'student-005', name: '小华', classId: 'class-001' },
  ],
};

export const SAMPLE_GAMES: Game[] = [
  {
    id: 'game-001',
    name: '样例：II-V-I 基础练习',
    description: '练习最基础的C大调II-V-I和弦进行，每小节选择一个合适的乐句',
    chordProgressionId: 'prog-ii-v-i-c',
    rhythmPatternId: 'rhythm-44-120',
    availablePhraseIds: [
      'phrase-001', 'phrase-002', 'phrase-003', 'phrase-004',
      'phrase-005', 'phrase-006', 'phrase-007', 'phrase-010',
      'phrase-011', 'phrase-012',
    ],
    classId: 'class-001',
    createdAt: Date.now() - 86400000 * 3,
    dueDate: Date.now() + 86400000 * 4,
  },
  {
    id: 'game-002',
    name: 'I-VI-II-V 进阶练习',
    description: '练习C大调I-VI-II-V和弦进行，注意和弦之间的连接',
    chordProgressionId: 'prog-i-vi-ii-v-c',
    rhythmPatternId: 'rhythm-44-100',
    availablePhraseIds: [
      'phrase-001', 'phrase-002', 'phrase-003', 'phrase-004',
      'phrase-005', 'phrase-006', 'phrase-007', 'phrase-008',
      'phrase-009', 'phrase-010',
    ],
    classId: 'class-001',
    createdAt: Date.now() - 86400000 * 1,
    dueDate: Date.now() + 86400000 * 7,
  },
  {
    id: 'game-003',
    name: '摇摆节奏挑战',
    description: '在快速摇摆节奏下完成II-V-I进行，注意节拍的稳定性',
    chordProgressionId: 'prog-ii-v-i-c',
    rhythmPatternId: 'rhythm-44-160-fast',
    availablePhraseIds: [
      'phrase-001', 'phrase-002', 'phrase-003', 'phrase-005',
      'phrase-006', 'phrase-009', 'phrase-010',
    ],
    classId: 'class-001',
    createdAt: Date.now() - 86400000 * 7,
    dueDate: Date.now() - 86400000 * 1,
  },
];

function createError(
  id: string,
  type: 'data' | 'rule' | 'material',
  measure: number,
  beat: number,
  description: string,
  deduction: number,
  suggestion: string
): ErrorDetail {
  return { id, type, measure, beat, description, deduction, suggestion };
}

function createMove(
  measureNumber: number,
  phraseId: string,
  isCorrect: boolean,
  errors: ErrorDetail[],
  chordScore: number,
  rhythmScore: number
): Move {
  const phrase = getPhraseById(phraseId)!;
  return {
    id: `move-${measureNumber}`,
    measureNumber,
    phraseId,
    phrase,
    timestamp: Date.now(),
    isCorrect,
    errors,
    chordScore,
    rhythmScore,
  };
}

function createCompleteMovesForSession001(): Move[] {
  return [
    createMove(1, 'phrase-002', true, [], 90, 85),
    createMove(2, 'phrase-003', true, [], 85, 80),
    createMove(
      3,
      'phrase-011',
      false,
      [
        createError(
          'err-001',
          'data',
          3,
          2,
          '和弦外音：C# 不属于 Cmaj7 的和弦内音或经过音',
          5,
          '建议使用 Cmaj7 的和弦内音 (C, E, G, B) 或经过音 (D, F)'
        ),
        createError(
          'err-002',
          'data',
          3,
          3,
          '和弦外音：D# 不属于 Cmaj7 的和弦内音或经过音',
          5,
          '建议使用 Cmaj7 的和弦内音 (C, E, G, B) 或经过音 (D, F)'
        ),
      ],
      60,
      70
    ),
    createMove(
      4,
      'phrase-012',
      false,
      [
        createError(
          'err-003',
          'rule',
          4,
          1,
          '小节超拍：乐句总时长为2拍，超过小节容量1拍',
          8,
          '请选择总时长不超过1拍的乐句，或拆分长乐句'
        ),
        createError(
          'err-004',
          'material',
          4,
          1,
          '材料问题：该乐句与Cmaj7和弦的兼容性不佳',
          3,
          '建议选择标注为Cmaj7兼容的乐句，或扩充材料库'
        ),
      ],
      75,
      55
    ),
  ];
}

function createCompleteMovesForSession002(): Move[] {
  return [
    createMove(1, 'phrase-002', true, [], 95, 90),
    createMove(2, 'phrase-006', true, [], 92, 88),
    createMove(3, 'phrase-001', true, [], 90, 85),
    createMove(
      4,
      'phrase-010',
      true,
      [
        createError(
          'err-005',
          'material',
          4,
          1,
          '材料提示：与第3小节乐句风格相似，建议增加变化',
          2,
          '可以尝试使用不同的节奏型或音高走向增加音乐性'
        ),
      ],
      88,
      90
    ),
  ];
}

function createCompleteMovesForSession003(): Move[] {
  return [
    createMove(
      1,
      'phrase-011',
      false,
      [
        createError(
          'err-006',
          'data',
          1,
          2,
          '和弦外音：C# 不属于 Dm7 的和弦内音或经过音',
          5,
          '建议使用 Dm7 的和弦内音 (D, F, A, C) 或经过音 (E, G)'
        ),
        createError(
          'err-007',
          'data',
          1,
          3,
          '和弦外音：D# 不属于 Dm7 的和弦内音或经过音',
          5,
          '建议使用 Dm7 的和弦内音 (D, F, A, C) 或经过音 (E, G)'
        ),
      ],
      55,
      60
    ),
    createMove(
      2,
      'phrase-012',
      false,
      [
        createError(
          'err-008',
          'rule',
          2,
          1,
          '小节超拍：乐句总时长为2拍，超过小节容量1拍',
          8,
          '请选择总时长不超过1拍的乐句'
        ),
      ],
      65,
      50
    ),
    createMove(
      3,
      'phrase-011',
      false,
      [
        createError(
          'err-009',
          'material',
          3,
          1,
          '重复乐句：与第1小节选择了相同的乐句',
          4,
          '建议选择不同的乐句增加音乐变化，或使用转调/变奏'
        ),
        createError(
          'err-010',
          'data',
          3,
          2,
          '和弦外音：C# 不属于 Cmaj7 的和弦内音或经过音',
          5,
          '建议使用 Cmaj7 的和弦内音 (C, E, G, B) 或经过音 (D, F)'
        ),
      ],
      60,
      65
    ),
    createMove(4, 'phrase-004', true, [], 85, 80),
  ];
}

function createScoreForSession001(): Score {
  const moves = createCompleteMovesForSession001();
  const allErrors = moves.flatMap((m) => m.errors);
  
  return {
    chordScore: 85,
    rhythmScore: 78,
    totalScore: 82,
    grade: 'B',
    errors: allErrors,
    keyDecisions: [
      {
        measure: 1,
        choice: '选择了 Dm7下行音阶 乐句',
        isCorrect: true,
        explanation: '很好地使用了Dm7的和弦内音D,F,A,C，下行音阶流畅自然',
      },
      {
        measure: 2,
        choice: '选择了 G7引导音 乐句',
        isCorrect: true,
        explanation: '正确使用了G7的引导音B和F，属七和弦的倾向性明确',
      },
      {
        measure: 3,
        choice: '选择了 错误乐句-和弦外音 乐句',
        isCorrect: false,
        explanation: '使用了C#和D#两个和弦外音，需要注意Cmaj7的音高选择',
      },
      {
        measure: 4,
        choice: '选择了 超长乐句-超拍 乐句',
        isCorrect: false,
        explanation: '乐句时长超过小节容量，且与Cmaj7的兼容性需要改进',
      },
    ],
    suggestions: [
      '加强Dm7到G7的连接乐句练习，注意属七和弦的引导音使用',
      '注意节拍的稳定性，使用节拍器练习120BPM的摇摆节奏',
      '避免使用和弦外音C#和D#，选择标注为Cmaj7兼容的乐句',
      '注意控制乐句时长，不要超过1拍的小节容量',
    ],
  };
}

function createScoreForSession002(): Score {
  const moves = createCompleteMovesForSession002();
  const allErrors = moves.flatMap((m) => m.errors);
  
  return {
    chordScore: 92,
    rhythmScore: 88,
    totalScore: 90,
    grade: 'A',
    errors: allErrors,
    keyDecisions: [
      {
        measure: 1,
        choice: '选择了 Dm7下行音阶 乐句',
        isCorrect: true,
        explanation: '完美使用Dm7和弦内音，下行音阶流畅，节奏准确',
      },
      {
        measure: 2,
        choice: '选择了 G7摇摆乐句 乐句',
        isCorrect: true,
        explanation: '摇摆节奏把握到位，G7的和弦音使用准确',
      },
      {
        measure: 3,
        choice: '选择了 C大调上行琶音 乐句',
        isCorrect: true,
        explanation: 'Cmaj7琶音清晰，解决感强',
      },
      {
        measure: 4,
        choice: '选择了 Cmaj7 resolved 乐句',
        isCorrect: true,
        explanation: 'B到C的半音解决非常好，终止感明确，略嫌与第3小节风格接近',
      },
    ],
    suggestions: [
      '可以尝试更复杂的经过音，增加音乐的丰富度',
      '保持当前的节奏稳定性，摇摆感觉很好',
      '第3、4小节可以增加更多对比，使用不同的节奏型',
    ],
  };
}

function createScoreForSession003(): Score {
  const moves = createCompleteMovesForSession003();
  const allErrors = moves.flatMap((m) => m.errors);
  
  return {
    chordScore: 72,
    rhythmScore: 65,
    totalScore: 68,
    grade: 'D',
    errors: allErrors,
    keyDecisions: [
      {
        measure: 1,
        choice: '选择了 错误乐句-和弦外音 乐句',
        isCorrect: false,
        explanation: '使用了不属于Dm7的和弦外音C#和D#，需要加强和弦音的识别',
      },
      {
        measure: 2,
        choice: '选择了 超长乐句-超拍 乐句',
        isCorrect: false,
        explanation: '乐句时长2拍超过了1拍的小节容量，节奏控制需要加强',
      },
      {
        measure: 3,
        choice: '重复选择了 错误乐句-和弦外音 乐句',
        isCorrect: false,
        explanation: '重复使用同一乐句且仍有和弦外音问题，建议先放慢速度练习',
      },
      {
        measure: 4,
        choice: '选择了 Cmaj7分解和弦 乐句',
        isCorrect: true,
        explanation: '最后一小节正确使用了Cmaj7分解和弦，有明显进步',
      },
    ],
    suggestions: [
      '先放慢速度练习，从60BPM开始，确保每个音都正确',
      '重点练习属七和弦的引导音使用，理解G7到Cmaj7的解决关系',
      '先熟记每个和弦的和弦内音，再尝试加入经过音',
      '使用节拍器练习，确保乐句时长不超过小节容量',
      '第4小节表现不错，保持这个状态继续练习',
    ],
  };
}

export function createSampleSession(studentId: string, studentName: string): GameSession {
  return {
    id: `session-${Date.now()}`,
    gameId: 'game-001',
    studentId,
    studentName,
    startTime: Date.now(),
    moves: [],
    confirmed: false,
  };
}

export function getCompletedSampleSessions(): GameSession[] {
  const now = Date.now();
  return [
    {
      id: 'session-001',
      gameId: 'game-001',
      studentId: 'student-001',
      studentName: '小明',
      startTime: now - 86400000 * 2,
      endTime: now - 86400000 * 2 + 1800000,
      moves: createCompleteMovesForSession001(),
      score: createScoreForSession001(),
      confirmed: true,
      confirmedBy: 'teacher-001',
      confirmedAt: now - 86400000,
    },
    {
      id: 'session-002',
      gameId: 'game-001',
      studentId: 'student-002',
      studentName: '小红',
      startTime: now - 86400000 * 1,
      endTime: now - 86400000 * 1 + 1500000,
      moves: createCompleteMovesForSession002(),
      score: createScoreForSession002(),
      confirmed: false,
    },
    {
      id: 'session-003',
      gameId: 'game-003',
      studentId: 'student-001',
      studentName: '小明',
      startTime: now - 86400000 * 5,
      endTime: now - 86400000 * 5 + 2400000,
      moves: createCompleteMovesForSession003(),
      score: createScoreForSession003(),
      confirmed: true,
      confirmedBy: 'teacher-001',
      confirmedAt: now - 86400000 * 4,
    },
  ];
}

export const SAMPLE_DATA = {
  teacher: SAMPLE_TEACHER,
  class: SAMPLE_CLASS,
  games: SAMPLE_GAMES,
  sessions: getCompletedSampleSessions(),
};

export function importSampleData(): void {
  localStorage.setItem('jazz_teacher', JSON.stringify(SAMPLE_TEACHER));
  localStorage.setItem('jazz_class', JSON.stringify(SAMPLE_CLASS));
  localStorage.setItem('jazz_games', JSON.stringify(SAMPLE_GAMES));
  localStorage.setItem('jazz_sessions', JSON.stringify(getCompletedSampleSessions()));
}
