import { AliasImportInput } from '../src/services/alias-import-service';
import { ScheduleImportInput } from '../src/services/schedule-import-service';
import { PhotoUploadInput } from '../src/services/photo-review-service';
import { MaterialSource } from '../src/types';

export const performers = [
  { id: 'P001', name: '张明' },
  { id: 'P002', name: '李华' },
  { id: 'P003', name: '王芳' },
  { id: 'P004', name: '赵强' },
];

export const locations = [
  { id: 'L001', name: '南京路步行街' },
  { id: 'L002', name: '外滩观景台' },
  { id: 'L003', name: '豫园商城' },
  { id: 'L004', name: '田子坊' },
];

export function createDate(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getNormalAliases(): AliasImportInput[] {
  return [
    {
      canonicalName: '茉莉花',
      aliases: ['好一朵美丽的茉莉花', '茉莉花开'],
      copyrightHolder: '中国传统民歌版权协会',
      source: 'normal',
    },
    {
      canonicalName: '康定情歌',
      aliases: ['跑马溜溜的山上', '康定之恋'],
      copyrightHolder: '四川民歌版权中心',
      source: 'normal',
    },
    {
      canonicalName: '在那遥远的地方',
      aliases: ['遥远的地方', '草原情歌'],
      copyrightHolder: '西部民歌版权联盟',
      source: 'normal',
    },
    {
      canonicalName: '掀起你的盖头来',
      aliases: ['掀盖头', '新疆婚礼曲'],
      copyrightHolder: '新疆民歌版权协会',
      source: 'normal',
    },
  ];
}

export function getNormalSchedules(): ScheduleImportInput[] {
  return [
    {
      sessionDate: createDate(-5),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '茉莉花',
      isConsumed: true,
      isLeave: false,
      consumedHours: 2,
      source: 'normal',
    },
    {
      sessionDate: createDate(-5),
      performerId: 'P002',
      performerName: '李华',
      locationId: 'L002',
      locationName: '外滩观景台',
      trackName: '康定情歌',
      isConsumed: true,
      isLeave: false,
      consumedHours: 3,
      source: 'normal',
    },
    {
      sessionDate: createDate(-4),
      performerId: 'P003',
      performerName: '王芳',
      locationId: 'L003',
      locationName: '豫园商城',
      trackName: '在那遥远的地方',
      isConsumed: true,
      isLeave: false,
      consumedHours: 2,
      source: 'normal',
    },
    {
      sessionDate: createDate(-3),
      performerId: 'P004',
      performerName: '赵强',
      locationId: 'L004',
      locationName: '田子坊',
      trackName: '掀起你的盖头来',
      isConsumed: true,
      isLeave: false,
      consumedHours: 4,
      source: 'normal',
    },
  ];
}

export function getNormalPhotos(): PhotoUploadInput[] {
  return [
    {
      sessionDate: createDate(-5),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '好一朵美丽的茉莉花',
      isLeave: false,
      photoUrl: 'photos/P001-001.jpg',
      source: 'normal',
    },
    {
      sessionDate: createDate(-5),
      performerId: 'P002',
      performerName: '李华',
      locationId: 'L002',
      locationName: '外滩观景台',
      trackName: '跑马溜溜的山上',
      isLeave: false,
      photoUrl: 'photos/P002-001.jpg',
      source: 'normal',
    },
    {
      sessionDate: createDate(-4),
      performerId: 'P003',
      performerName: '王芳',
      locationId: 'L003',
      locationName: '豫园商城',
      trackName: '草原情歌',
      isLeave: false,
      photoUrl: 'photos/P003-001.jpg',
      source: 'normal',
    },
    {
      sessionDate: createDate(-3),
      performerId: 'P004',
      performerName: '赵强',
      locationId: 'L004',
      locationName: '田子坊',
      trackName: '新疆婚礼曲',
      isLeave: false,
      photoUrl: 'photos/P004-001.jpg',
      source: 'normal',
    },
  ];
}

export function getWrongCaliberAliases(): AliasImportInput[] {
  return [
    ...getNormalAliases(),
    {
      canonicalName: '茉莉花',
      aliases: ['茉莉花香'],
      copyrightHolder: '错误版权方',
      source: 'wrong-caliber' as MaterialSource,
    },
  ];
}

export function getWrongCaliberSchedules(): ScheduleImportInput[] {
  return [
    ...getNormalSchedules(),
    {
      sessionDate: createDate(-2),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '茉莉花',
      isConsumed: true,
      isLeave: true,
      consumedHours: 2,
      source: 'wrong-caliber' as MaterialSource,
    },
    {
      sessionDate: createDate(-5),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '茉莉花',
      isConsumed: true,
      isLeave: false,
      consumedHours: 2,
      source: 'wrong-caliber' as MaterialSource,
    },
  ];
}

export function getWrongCaliberPhotos(): PhotoUploadInput[] {
  return [
    ...getNormalPhotos(),
    {
      sessionDate: createDate(-2),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '茉莉花',
      isLeave: true,
      leaveReason: '身体不适',
      photoUrl: 'photos/P001-leave.jpg',
      source: 'wrong-caliber' as MaterialSource,
    },
    {
      sessionDate: createDate(-1),
      performerId: 'P002',
      performerName: '李华',
      locationId: 'L002',
      locationName: '外滩观景台',
      trackName: '不知名歌曲',
      isLeave: false,
      photoUrl: 'photos/P002-unknown.jpg',
      source: 'wrong-caliber' as MaterialSource,
    },
  ];
}

export function getSupplementAliases(): AliasImportInput[] {
  return [
    ...getNormalAliases(),
    {
      canonicalName: '南泥湾',
      aliases: ['陕北好风光', '花篮的花儿香'],
      copyrightHolder: '延安民歌版权中心',
      source: 'supplement' as MaterialSource,
    },
  ];
}

export function getSupplementSchedules(): ScheduleImportInput[] {
  return [
    {
      sessionDate: createDate(-10),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L002',
      locationName: '外滩观景台',
      trackName: '南泥湾',
      isConsumed: true,
      isLeave: false,
      consumedHours: 3,
      source: 'supplement' as MaterialSource,
    },
    {
      sessionDate: createDate(-9),
      performerId: 'P002',
      performerName: '李华',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '南泥湾',
      isConsumed: true,
      isLeave: true,
      consumedHours: 0,
      source: 'supplement' as MaterialSource,
    },
  ];
}

export function getSupplementPhotos(): PhotoUploadInput[] {
  return [
    {
      sessionDate: createDate(-10),
      performerId: 'P001',
      performerName: '张明',
      locationId: 'L002',
      locationName: '外滩观景台',
      trackName: '花篮的花儿香',
      isLeave: false,
      photoUrl: 'photos/P001-supplement.jpg',
      source: 'supplement' as MaterialSource,
      supplementNote: '补录6月前遗漏的演出记录',
    },
    {
      sessionDate: createDate(-9),
      performerId: 'P002',
      performerName: '李华',
      locationId: 'L001',
      locationName: '南京路步行街',
      trackName: '陕北好风光',
      isLeave: true,
      leaveReason: '家中有事',
      photoUrl: 'photos/P002-supplement-leave.jpg',
      source: 'supplement' as MaterialSource,
      supplementNote: '补录请假记录，之前未上报',
    },
  ];
}
