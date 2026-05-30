import { Level, NoteCard, Measure, WorkSlot } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const noteTemplates: Record<string, Omit<NoteCard, 'id'>> = {
  'whole': { type: 'whole', duration: 4, name: '全音符' },
  'half': { type: 'half', duration: 2, name: '二分音符' },
  'quarter': { type: 'quarter', duration: 1, name: '四分音符' },
  'eighth': { type: 'eighth', duration: 0.5, name: '八分音符' },
  'sixteenth': { type: 'sixteenth', duration: 0.25, name: '十六分音符' },
  'dotted-half': { type: 'half', duration: 3, name: '附点二分音符', hasDot: true },
  'dotted-quarter': { type: 'dotted-quarter', duration: 1.5, name: '附点四分音符', hasDot: true },
  'dotted-eighth': { type: 'dotted-eighth', duration: 0.75, name: '附点八分音符', hasDot: true },
  'rest-half': { type: 'rest-half', duration: 2, name: '二分休止符', isRest: true },
  'rest-quarter': { type: 'rest-quarter', duration: 1, name: '四分休止符', isRest: true },
  'rest-eighth': { type: 'rest-eighth', duration: 0.5, name: '八分休止符', isRest: true },
};

function createNote(templateKey: string): NoteCard {
  const template = noteTemplates[templateKey];
  return {
    ...template,
    id: generateId()
  };
}

function createSlot(measureIndex: number, slotIndex: number, fixedNote?: NoteCard): WorkSlot {
  return {
    id: `slot-${measureIndex}-${slotIndex}`,
    measureIndex,
    slotIndex,
    assignedNote: fixedNote || null,
    isFixed: !!fixedNote,
    errorState: null
  };
}

function createMeasure(index: number, slotCount: number, targetBeats: number, fixedNotes: { slotIndex: number; note: NoteCard }[] = []): Measure {
  const slots: WorkSlot[] = [];
  for (let i = 0; i < slotCount; i++) {
    const fixedNote = fixedNotes.find(f => f.slotIndex === i)?.note;
    slots.push(createSlot(index, i, fixedNote));
  }
  return {
    id: `measure-${index}`,
    index,
    slots,
    targetBeats,
    currentBeats: 0,
    isLoaded: false
  };
}

export const levels: Level[] = [
  {
    id: 'level-1',
    name: '入门：认识四分音符',
    difficulty: 'easy',
    description: '学习四分音符，每个小节放4个四分音符',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('quarter'),
      createNote('quarter'),
      createNote('quarter'),
      createNote('quarter'),
    ],
    measures: [
      createMeasure(0, 4, 4),
    ]
  },
  {
    id: 'level-2',
    name: '基础：二分与四分',
    difficulty: 'easy',
    description: '组合二分音符和四分音符',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('half'),
      createNote('quarter'),
      createNote('quarter'),
      createNote('half'),
      createNote('quarter'),
      createNote('quarter'),
    ],
    measures: [
      createMeasure(0, 3, 4),
      createMeasure(1, 3, 4),
    ]
  },
  {
    id: 'level-3',
    name: '进阶：八分音符',
    difficulty: 'easy',
    description: '加入八分音符，学习半拍',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('quarter'),
      createNote('eighth'),
      createNote('eighth'),
      createNote('half'),
      createNote('eighth'),
      createNote('eighth'),
      createNote('quarter'),
    ],
    measures: [
      createMeasure(0, 4, 4),
      createMeasure(1, 3, 4),
    ]
  },
  {
    id: 'level-4',
    name: '挑战：附点音符',
    difficulty: 'medium',
    description: '小心附点音符！时值是原来的1.5倍',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('dotted-half'),
      createNote('quarter'),
      createNote('dotted-quarter'),
      createNote('eighth'),
      createNote('quarter'),
      createNote('half'),
    ],
    measures: [
      createMeasure(0, 2, 4),
      createMeasure(1, 3, 4),
    ]
  },
  {
    id: 'level-5',
    name: '高手：休止符',
    difficulty: 'medium',
    description: '休止符也是节拍的一部分，别漏掉！',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('half'),
      createNote('rest-quarter'),
      createNote('quarter'),
      createNote('quarter'),
      createNote('rest-half'),
      createNote('quarter'),
      createNote('eighth'),
      createNote('eighth'),
    ],
    measures: [
      createMeasure(0, 3, 4),
      createMeasure(1, 3, 4),
      createMeasure(2, 3, 4),
    ]
  },
  {
    id: 'level-6',
    name: '大师：综合挑战',
    difficulty: 'hard',
    description: '综合运用所有音符和休止符',
    timeSignature: { numerator: 4, denominator: 4 },
    perfectScore: 100,
    notePool: [
      createNote('dotted-quarter'),
      createNote('eighth'),
      createNote('quarter'),
      createNote('quarter'),
      createNote('half'),
      createNote('rest-eighth'),
      createNote('dotted-eighth'),
      createNote('quarter'),
      createNote('eighth'),
      createNote('eighth'),
      createNote('rest-quarter'),
      createNote('half'),
    ],
    measures: [
      createMeasure(0, 3, 4),
      createMeasure(1, 3, 4),
      createMeasure(2, 4, 4),
      createMeasure(3, 2, 4),
    ]
  },
];

export function getLevelById(id: string): Level | undefined {
  return levels.find(l => l.id === id);
}

export function cloneLevel(level: Level): Level {
  return JSON.parse(JSON.stringify(level));
}
