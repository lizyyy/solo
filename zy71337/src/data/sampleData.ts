import { Note, Work } from '@/types';
import { createMelodySegment } from '@/utils/melodyEngine';

function createNotesFromPitches(pitches: number[], baseDuration: number = 1): Note[] {
  const notes: Note[] = [];
  let startTime = 0;
  for (let i = 0; i < pitches.length; i++) {
    notes.push({
      pitch: pitches[i],
      duration: baseDuration,
      startTime: startTime,
      velocity: 80,
    });
    startTime += baseDuration;
  }
  return notes;
}

const work1Notes = createNotesFromPitches([60, 62, 64, 65, 67, 69, 71, 72]);
const work2Notes = createNotesFromPitches([62, 64, 65, 67, 69, 71, 72, 74]);
const work3Notes = createNotesFromPitches([60, 59, 57, 55, 57, 59, 60, 62]);
const work4Notes = createNotesFromPitches([60, 60, 64, 64, 67, 67, 64, 62]);
const work5Notes = createNotesFromPitches([72, 71, 69, 67, 65, 64, 62, 60]);
const work6Notes = createNotesFromPitches([60, 64, 67, 64, 60, 64, 67, 72], 0.5);

export const sampleWorks: Work[] = [
  {
    id: 'work_001',
    title: 'C大调练习曲',
    studentName: '张三',
    tags: ['C大调', '练习曲', '初级'],
    keySignature: 'C',
    remarks: '第一首习作，音阶上行练习',
    segments: [createMelodySegment(work1Notes, 'work_001')],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'work_002',
    title: 'D大调小旋律',
    studentName: '李四',
    tags: ['D大调', '移调测试'],
    keySignature: 'D',
    remarks: '移调后与work1相似，用于测试移调匹配',
    segments: [createMelodySegment(work2Notes, 'work_002')],
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
  },
  {
    id: 'work_003',
    title: 'a小调练习',
    studentName: '王五',
    tags: ['a小调', '下行音阶'],
    keySignature: 'Am',
    remarks: '自然小调音阶',
    segments: [createMelodySegment(work3Notes, 'work_003')],
    createdAt: new Date('2024-01-17'),
    updatedAt: new Date('2024-01-17'),
  },
  {
    id: 'work_004',
    title: '分解和弦练习',
    studentName: '赵六',
    tags: ['C大调', '分解和弦'],
    keySignature: 'C',
    remarks: 'C大三和弦分解',
    segments: [createMelodySegment(work4Notes, 'work_004')],
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 'work_005',
    title: '下行音阶',
    studentName: '孙七',
    tags: ['C大调', '下行'],
    keySignature: 'C',
    remarks: '与work1方向相反',
    segments: [createMelodySegment(work5Notes, 'work_005')],
    createdAt: new Date('2024-01-19'),
    updatedAt: new Date('2024-01-19'),
  },
  {
    id: 'work_006',
    title: '节奏拉伸测试',
    studentName: '周八',
    tags: ['节奏测试', '拉伸'],
    keySignature: 'C',
    remarks: '与work4节奏型相同但时值减半',
    segments: [createMelodySegment(work6Notes, 'work_006')],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  },
];

export const presetQueries = {
  cMajorScale: [
    { pitch: 60, duration: 1, startTime: 0 },
    { pitch: 62, duration: 1, startTime: 1 },
    { pitch: 64, duration: 1, startTime: 2 },
    { pitch: 65, duration: 1, startTime: 3 },
    { pitch: 67, duration: 1, startTime: 4 },
    { pitch: 69, duration: 1, startTime: 5 },
    { pitch: 71, duration: 1, startTime: 6 },
    { pitch: 72, duration: 1, startTime: 7 },
  ],
  brokenChord: [
    { pitch: 60, duration: 1, startTime: 0 },
    { pitch: 64, duration: 1, startTime: 1 },
    { pitch: 67, duration: 1, startTime: 2 },
    { pitch: 72, duration: 1, startTime: 3 },
  ],
};
