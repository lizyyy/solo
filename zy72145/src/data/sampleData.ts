import { TrackRecord } from '../types';
import { v4 as uuidv4 } from '../utils/uuid';
import { validateAllRecords } from '../utils/validator';

const now = Date.now();
const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;

function daysAgo(days: number): string {
  const date = new Date(now - days * oneDay);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysLater(days: number): string {
  const date = new Date(now + days * oneDay);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const rawRecords: Omit<TrackRecord, 'id' | 'importedAt' | 'lastModifiedAt' | 'validationStatus' | 'validationErrors' | 'modifyHistory' | 'rawData'>[] = [
  {
    teacherName: '张明华',
    trackName: '夜曲',
    authStart: daysAgo(365),
    authEnd: daysLater(180),
    tcIn: '00:00:00',
    tcOut: '00:05:30',
    duration: 5,
    remark: '初级班必学曲目',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: 'Li Na',
    trackName: '致爱丽丝',
    authStart: daysAgo(200),
    authEnd: daysLater(100),
    tcIn: '00:00:00',
    tcOut: '00:04:20',
    duration: 4,
    remark: '贝多芬经典作品',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '王老师',
    trackName: '茉莉花',
    authStart: daysAgo(150),
    authEnd: daysLater(200),
    tcIn: '00:00:00',
    tcOut: '00:06:15',
    duration: 6,
    remark: '中国民歌改编版',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: 'Chen Wei',
    trackName: 'Canon in D',
    authStart: daysAgo(300),
    authEnd: daysLater(60),
    tcIn: '00:00:00',
    tcOut: '00:08:00',
    duration: 8,
    remark: '卡农D大调',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '刘芳',
    trackName: '月光奏鸣曲',
    authStart: daysAgo(100),
    authEnd: daysLater(265),
    tcIn: '00:00:00',
    tcOut: '00:12:30',
    duration: 12,
    remark: '贝多芬第十四钢琴奏鸣曲',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '赵强',
    trackName: '土耳其进行曲',
    authStart: daysAgo(80),
    authEnd: daysLater(285),
    tcIn: '00:00:00',
    tcOut: '00:07:45',
    duration: 7,
    remark: '莫扎特作品',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '张明华',
    trackName: '夜曲',
    authStart: daysAgo(365),
    authEnd: daysLater(180),
    tcIn: '00:00:00',
    tcOut: '00:05:30',
    duration: 5,
    remark: '重复录入，请核对',
    sourceFile: '音乐教师课时核销_补充.xlsx',
  },
  {
    teacherName: '张明华',
    trackName: '夜曲',
    authStart: daysAgo(365),
    authEnd: daysLater(180),
    tcIn: '00:00:00',
    tcOut: '00:05:30',
    duration: 5,
    remark: '',
    sourceFile: '音乐教师课时核销_补充.xlsx',
  },
  {
    teacherName: 'Li Na',
    trackName: '致爱丽丝',
    authStart: daysAgo(200),
    authEnd: daysLater(100),
    tcIn: '00:00:00',
    tcOut: '00:04:20',
    duration: 4,
    remark: '',
    sourceFile: '音乐教师课时核销_补充.xlsx',
  },
  {
    teacherName: '王老师',
    trackName: '二泉映月',
    authStart: daysAgo(400),
    authEnd: daysAgo(30),
    tcIn: '00:00:00',
    tcOut: '00:10:00',
    duration: 10,
    remark: '授权已过期，需重新申请',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: 'Chen Wei',
    trackName: 'River Flows in You',
    authStart: daysAgo(500),
    authEnd: daysAgo(100),
    tcIn: '00:00:00',
    tcOut: '00:06:30',
    duration: 6,
    remark: 'Yiruma作品，授权过期',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '刘芳',
    trackName: '梁祝',
    authStart: daysAgo(600),
    authEnd: daysAgo(50),
    tcIn: '00:00:00',
    tcOut: '00:15:00',
    duration: 15,
    remark: '小提琴协奏曲，待续期',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '赵强',
    trackName: '命运交响曲',
    authStart: daysAgo(100),
    authEnd: daysLater(265),
    tcIn: '00:10:00',
    tcOut: '00:05:00',
    duration: 0,
    remark: '时码错位，开始大于结束',
    sourceFile: '音乐教师课时核销_脏数据.xlsx',
  },
  {
    teacherName: 'Sun Ming',
    trackName: '小步舞曲',
    authStart: daysAgo(50),
    authEnd: daysLater(315),
    tcIn: '25:61:70',
    tcOut: '26:00:00',
    duration: 0,
    remark: '时码格式错误',
    sourceFile: '音乐教师课时核销_脏数据.xlsx',
  },
  {
    teacherName: '',
    trackName: '田园交响曲',
    authStart: daysAgo(80),
    authEnd: daysLater(285),
    tcIn: '00:00:00',
    tcOut: '00:20:00',
    duration: 20,
    remark: '教师姓名为空，需补充',
    sourceFile: '音乐教师课时核销_脏数据.xlsx',
  },
  {
    teacherName: '周杰倫',
    trackName: '',
    authStart: '2025/13/45',
    authEnd: '二〇二六年十二月',
    tcIn: '00.00.00',
    tcOut: '00.04.30',
    duration: 0,
    remark: '日期格式混乱，曲目名称为空',
    sourceFile: '音乐教师课时核销_脏数据.xlsx',
  },
  {
    teacherName: 'zhang老师',
    trackName: 'Unknown Track',
    authStart: 'invalid date',
    authEnd: '',
    tcIn: '',
    tcOut: '',
    duration: -5,
    remark: '多项数据异常，半英文半中文命名',
    sourceFile: 'music_teacher核销_123.xlsx',
  },
];

export function generateSampleRecords(): TrackRecord[] {
  const records: TrackRecord[] = rawRecords.map((r, index) => {
    const baseRecord: TrackRecord = {
      id: uuidv4(),
      ...r,
      importedAt: now - (rawRecords.length - index) * 1000,
      lastModifiedAt: now - (rawRecords.length - index) * 1000,
      validationStatus: 'normal',
      validationErrors: [],
      modifyHistory: [],
      rawData: { ...r },
    };

    if (index === 0 && baseRecord.remark) {
      const modifyTime = now - 2 * oneDay;
      baseRecord.modifyHistory = [
        {
          timestamp: modifyTime,
          oldRemark: '初级班曲目',
          newRemark: '初级班必学曲目',
          diff: '新增: "必学"',
        },
      ];
      baseRecord.lastModifiedAt = modifyTime;
    }

    if (index === 4 && baseRecord.remark) {
      const modifyTime = now - 5 * oneHour;
      baseRecord.modifyHistory = [
        {
          timestamp: modifyTime,
          oldRemark: '',
          newRemark: '贝多芬第十四钢琴奏鸣曲',
          diff: '新增备注: 贝多芬第十四钢琴奏鸣曲',
        },
      ];
      baseRecord.lastModifiedAt = modifyTime;
    }

    return baseRecord;
  });

  return validateAllRecords(records);
}
