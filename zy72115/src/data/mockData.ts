import type { Compressor, VibrationRecord } from '@/types';

export const COMPRESSORS: Compressor[] = [
  {
    id: 'comp-001',
    name: 'C-101',
    model: '螺杆式 3L-10/8',
    ratedRpm: 3000,
  },
];

export const MOCK_RECORDS: VibrationRecord[] = [
  {
    id: 'rec-001',
    compressorId: 'comp-001',
    direction: 'V',
    frequencyHz: 50,
    amplitude: 2.8,
    amplitudeUnit: 'mm/s',
    amplitudeMmPerS: 2.8,
    rpm: 3000,
    dataSource: '实验表',
    recordTime: '2024-11-20T09:15:00',
    status: '正常',
    validationNotes: [],
    confirmationNote: '',
    isExtreme: false,
  },
  {
    id: 'rec-002',
    compressorId: 'comp-001',
    direction: 'H',
    frequencyHz: 100,
    amplitude: 8.5,
    amplitudeUnit: 'mm/s',
    amplitudeMmPerS: 8.5,
    rpm: 3000,
    dataSource: '实验表',
    recordTime: '2024-11-20T09:17:00',
    status: '需确认',
    validationNotes: [
      '该记录与已有记录（2024-11-20T09:15:00）时间间隔仅 2.0 分钟，可能是重复录入，请确认是否为不同测量。',
      '幅值 8.5 mm/s 处于警告区间（4.5~11.2 mm/s），需人工确认是否为真实异常振动。',
    ],
    confirmationNote: '幅值超标，与上条记录间隔短，待工程师现场确认。',
    isExtreme: false,
  },
  {
    id: 'rec-003',
    compressorId: 'comp-001',
    direction: 'A',
    frequencyHz: 25,
    amplitude: 0.3,
    amplitudeUnit: 'in/s',
    amplitudeMmPerS: 7.62,
    rpm: 3000,
    dataSource: '维修微信群',
    recordTime: '2024-03-15T14:20:00',
    status: '旧口径',
    validationNotes: [
      '单位为 in/s，系统已自动换算为 7.62 mm/s 进行阈值判断。',
      '数据来源为维修微信群（非正式记录），按2024年3月微信群口径补录，请注意数据可靠性。',
    ],
    confirmationNote: '按2024年3月微信群口径补录，原始单位 in/s，换算后为 7.62 mm/s，处于警告区间。',
    isExtreme: false,
  },
];

export function generateId(): string {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
