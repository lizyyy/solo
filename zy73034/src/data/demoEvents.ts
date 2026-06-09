import type { PetEvent, PetProfile } from '@/types';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEMO_OPERATOR = '老周（寄养店店长）';

export const EMPTY_PROFILE: PetProfile = {
  name: '',
  aliases: [],
  species: '狗',
  breed: '',
  vaccineStatus: '',
  trainingProgress: '未开始',
  trainingJudge: '待评定',
  latestNote: '',
  photoUrls: [],
  confirmed: false,
  revoked: false,
};

const BASE = Date.now() - 1000 * 60 * 60 * 24 * 7;
const HOUR = 1000 * 60 * 60;

function buildPet1(): PetEvent[] {
  const petId = 'pet_doudou';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport: PetProfile = {
    name: '豆豆',
    aliases: ['豆包', '小胖'],
    species: '狗',
    breed: '柯基',
    vaccineStatus: '已接种 3 针（疫苗本照片 2024-11）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '训练课第 4 节，坐、卧、等待已掌握',
    photoUrls: [
      'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 2,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '首次导入疫苗本照片「柯基-豆豆-20241115.jpg」',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport }),
  });

  const afterConfirm: PetProfile = { ...current, confirmed: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'confirm',
    timestamp: BASE + HOUR * 5,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '核对疫苗本与系统记录一致，确认归档',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterConfirm }),
  });

  const afterAddendum: PetProfile = {
    ...current,
    vaccineStatus: '已接种 4 针（含加强针，主人微信补发 2025-01）',
    latestNote:
      '训练课第 4 节，坐、卧、等待已掌握；主人临时补充：2025-01-20 接种加强针，附新疫苗本截图',
    photoUrls: [
      ...current.photoUrls,
      'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&q=70',
    ],
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'addendum',
    timestamp: BASE + HOUR * 26,
    operator: DEMO_OPERATOR,
    source: 'owner_supplement',
    note: '主人微信临时补充：已在 2025-01 接种加强针，旧疫苗本照片未体现',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterAddendum }),
  });

  return events;
}

function buildPet2(): PetEvent[] {
  const petId = 'pet_doubao';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport1: PetProfile = {
    name: '豆包',
    aliases: ['豆豆', '团子'],
    species: '狗',
    breed: '柴犬',
    vaccineStatus: '已接种 3 针（旧照片 2024-09）',
    trainingProgress: '未开始',
    trainingJudge: '待评定',
    latestNote: '预约下周二入训',
    photoUrls: [
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 1,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '首次导入疫苗本照片「柴犬-豆包-旧版.jpg」，后来发现与纸质原件不符',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport1 }),
  });

  const afterRevoke: PetProfile = { ...current, revoked: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'revoke',
    timestamp: BASE + HOUR * 3,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '撤回：旧版疫苗本照片与主人提供的纸质原件不一致，作废',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterRevoke }),
  });

  const afterReimport: PetProfile = {
    ...current,
    vaccineStatus: '已接种 4 针（新版疫苗本 2024-12，含狂犬）',
    trainingProgress: '进行中',
    latestNote: '预约下周二入训；主人补充：旧照片漏记狂犬，新版补齐',
    photoUrls: [
      ...current.photoUrls,
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&q=70',
    ],
    revoked: false,
    confirmed: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 7,
    operator: DEMO_OPERATOR,
    source: 'reimport',
    note: '重新导入：主人带来新版疫苗本照片，含 2024-12 狂犬记录',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterReimport }),
  });

  const afterConfirm: PetProfile = { ...current, confirmed: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'confirm',
    timestamp: BASE + HOUR * 9,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '确认新版疫苗本信息正确',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterConfirm }),
  });

  return events;
}

function buildPet3(): PetEvent[] {
  const petId = 'pet_wangcai';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport: PetProfile = {
    name: '旺财',
    aliases: ['阿财'],
    species: '狗',
    breed: '拉布拉多',
    vaccineStatus: '已接种 5 针（2024-06 全齐）',
    trainingProgress: '已完成',
    trainingJudge: '不合格',
    latestNote: '12 节训练课结束，最后 2 节拒食训练未达标',
    photoUrls: [
      'https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 12,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '导入疫苗本 + 训练结课记录',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport }),
  });

  const afterConfirm: PetProfile = { ...current, confirmed: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'confirm',
    timestamp: BASE + HOUR * 13,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '初次评定：结课考核不合格',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterConfirm }),
  });

  const afterRejudge: PetProfile = {
    ...current,
    trainingJudge: '合格',
    latestNote:
      '12 节训练课结束，最后 2 节拒食训练未达标；补看训练课监控，主人自行加练后已通过',
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'rejudge',
    timestamp: BASE + HOUR * 40,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '人工改判：不合格 → 合格',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterRejudge }),
    rejudgeReason:
      '主人提供自行加练视频 + 训练课补拍监控，拒食项目在家中与陌生人均达标，原考核因旺财当日紧张未正常发挥，予以改判',
    oldJudge: '不合格',
    newJudge: '合格',
  } as import('@/types').RejudgeEvent);

  return events;
}

function buildPet4(): PetEvent[] {
  const petId = 'pet_xueqiu';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport: PetProfile = {
    name: '雪球',
    aliases: [],
    species: '猫',
    breed: '英短银渐层',
    vaccineStatus: '已接种 3 针猫三联 + 狂犬',
    trainingProgress: '已完成',
    trainingJudge: '合格',
    latestNote: '5 节基础服从课完成，状态稳定',
    photoUrls: [
      'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 18,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '导入疫苗本与训练结课表',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport }),
  });

  const afterConfirm: PetProfile = { ...current, confirmed: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'confirm',
    timestamp: BASE + HOUR * 19,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '确认无误',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterConfirm }),
  });

  return events;
}

function buildPet5(): PetEvent[] {
  const petId = 'pet_meiqiu';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport: PetProfile = {
    name: '煤球',
    aliases: ['小黑'],
    species: '猫',
    breed: '中华田园黑猫',
    vaccineStatus: '已接种 2 针（2024-10）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '脱敏训练第 2 节，对陌生人仍躲沙发底',
    photoUrls: [
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 30,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '导入疫苗本照片，待确认结课进度',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport }),
  });

  const afterAddendum: PetProfile = {
    ...current,
    trainingProgress: '已完成',
    trainingJudge: '合格',
    latestNote:
      '脱敏训练第 2 节，对陌生人仍躲沙发底；主人电话补：第 3、4、5 节均在家完成，现可接受陌生人抚摸',
    photoUrls: [
      ...current.photoUrls,
      'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400&q=70',
    ],
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'addendum',
    timestamp: BASE + HOUR * 48,
    operator: DEMO_OPERATOR,
    source: 'owner_supplement',
    note: '主人电话临时补充：脱敏课后续 3 节在家由主人完成并录像确认，进度从进行中改为已完成',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterAddendum }),
  });

  return events;
}

function buildPet6(): PetEvent[] {
  const petId = 'pet_maomao';
  const events: PetEvent[] = [];
  let current: PetProfile = { ...EMPTY_PROFILE };

  const afterImport: PetProfile = {
    name: '毛毛',
    aliases: ['毛豆', '毛毛'],
    species: '狗',
    breed: '边牧',
    vaccineStatus: '已接种 3 针（2024-08）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '飞盘训练第 6 节，专注力偏弱',
    photoUrls: [
      'https://images.unsplash.com/photo-1503256207526-0d5d80fa2f47?w=400&q=70',
    ],
    confirmed: false,
    revoked: false,
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'import',
    timestamp: BASE + HOUR * 22,
    operator: DEMO_OPERATOR,
    source: 'vaccine_photo',
    note: '导入疫苗本照片，注意别名列表里重复写了「毛毛」（与主名同名）',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterImport }),
  });

  const afterConfirm: PetProfile = { ...current, confirmed: true };
  events.push({
    id: uid('evt'),
    petId,
    type: 'confirm',
    timestamp: BASE + HOUR * 24,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '确认训练进度',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterConfirm }),
  });

  const afterAddendum: PetProfile = {
    ...current,
    latestNote:
      '飞盘训练第 6 节，专注力偏弱；主人补：上周遛狗时挣脱牵引，疑似受惊，需暂停户外训练 2 周',
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'addendum',
    timestamp: BASE + HOUR * 52,
    operator: DEMO_OPERATOR,
    source: 'owner_supplement',
    note: '主人补充户外挣脱事件，建议暂停',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterAddendum }),
  });

  const afterRejudge: PetProfile = {
    ...current,
    trainingProgress: '中止',
    trainingJudge: '不合格',
    latestNote:
      '飞盘训练第 6 节，专注力偏弱；主人补：上周遛狗时挣脱牵引，疑似受惊，需暂停户外训练 2 周；因受惊评估，本期训练中止',
  };
  events.push({
    id: uid('evt'),
    petId,
    type: 'rejudge',
    timestamp: BASE + HOUR * 58,
    operator: DEMO_OPERATOR,
    source: 'manual',
    note: '人工改判：待评定 → 中止（本期）',
    snapshotBefore: { ...current },
    snapshotAfter: (current = { ...afterRejudge }),
    rejudgeReason:
      '户外挣脱事件后主人反馈狗狗对陌生环境与移动目标明显受惊，建议本期训练中止、转为居家安抚，待情绪稳定后再重新入训',
    oldJudge: '待评定',
    newJudge: '不合格',
  } as import('@/types').RejudgeEvent);

  return events;
}

export function generateDemoEvents(): PetEvent[] {
  return [
    ...buildPet1(),
    ...buildPet2(),
    ...buildPet3(),
    ...buildPet4(),
    ...buildPet5(),
    ...buildPet6(),
  ].sort((a, b) => a.timestamp - b.timestamp);
}
