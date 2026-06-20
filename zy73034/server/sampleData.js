import { EMPTY_PROFILE } from './tracker.js';

const BASE = Date.parse('2026-06-08T08:00:00+08:00');
const HOUR = 60 * 60 * 1000;
const OPERATOR = '老周（寄养店店长）';

function event(id, petId, type, atHour, before, after, extra = {}) {
  return {
    id,
    petId,
    type,
    timestamp: BASE + atHour * HOUR,
    operator: OPERATOR,
    snapshotBefore: before,
    snapshotAfter: after,
    ...extra,
  };
}

function profile(input) {
  return { ...EMPTY_PROFILE, ...input };
}

export function demoEvents() {
  const doudou0 = profile({});
  const doudou1 = profile({
    name: '豆豆',
    aliases: ['豆包', '小胖'],
    species: '狗',
    breed: '柯基',
    vaccineStatus: '已接种 3 针（疫苗本照片 2024-11）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '训练课第 4 节，坐、卧、等待已掌握',
    photoUrls: ['vaccine/old/doudou-20241115.jpg'],
  });
  const doudou2 = { ...doudou1, confirmed: true };
  const doudou3 = {
    ...doudou2,
    vaccineStatus: '已接种 4 针（含加强针，主人微信补发 2025-01）',
    latestNote: '训练课第 4 节；主人临时补充 2025-01-20 加强针，新截图已保留',
    photoUrls: [...doudou2.photoUrls, 'vaccine/new/doudou-20250120.jpg'],
  };

  const doubao0 = profile({});
  const doubao1 = profile({
    name: '豆包',
    aliases: ['豆豆', '团子'],
    species: '狗',
    breed: '柴犬',
    vaccineStatus: '已接种 3 针（旧照片 2024-09）',
    trainingProgress: '未开始',
    trainingJudge: '待评定',
    latestNote: '预约下周二入训',
    photoUrls: ['vaccine/old/doubao-202409.jpg'],
  });
  const doubao2 = { ...doubao1, revoked: true };
  const doubao3 = {
    ...doubao2,
    vaccineStatus: '已接种 4 针（新版疫苗本 2024-12，含狂犬）',
    trainingProgress: '进行中',
    latestNote: '预约下周二入训；旧照片漏记狂犬，新版补齐',
    photoUrls: [...doubao2.photoUrls, 'vaccine/new/doubao-202412.jpg'],
    revoked: false,
  };
  const doubao4 = { ...doubao3, confirmed: true };

  const wangcai0 = profile({});
  const wangcai1 = profile({
    name: '旺财',
    aliases: ['阿财'],
    species: '狗',
    breed: '拉布拉多',
    vaccineStatus: '已接种 5 针（2024-06 全齐）',
    trainingProgress: '已完成',
    trainingJudge: '不合格',
    latestNote: '12 节训练课结束，最后 2 节拒食训练未达标',
    photoUrls: ['course/wangcai-final-old.png'],
  });
  const wangcai2 = { ...wangcai1, confirmed: true };
  const wangcai3 = {
    ...wangcai2,
    trainingJudge: '合格',
    latestNote: '12 节训练课结束；补看监控和主人加练视频后通过拒食项目',
    photoUrls: [...wangcai2.photoUrls, 'course/wangcai-rejudge-video-still.png'],
  };

  const meiqiu0 = profile({});
  const meiqiu1 = profile({
    name: '煤球',
    aliases: ['小黑'],
    species: '猫',
    breed: '中华田园黑猫',
    vaccineStatus: '已接种 2 针（2024-10）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '脱敏训练第 2 节，对陌生人仍躲沙发底',
    photoUrls: ['vaccine/meiqiu-202410.jpg'],
  });
  const meiqiu2 = {
    ...meiqiu1,
    trainingProgress: '已完成',
    trainingJudge: '合格',
    latestNote: '脱敏训练第 2 节；主人补录第 3-5 节居家视频，现可接受陌生人抚摸',
    photoUrls: [...meiqiu1.photoUrls, 'owner-video/meiqiu-desensitization-v2.png'],
  };

  const maomao0 = profile({});
  const maomao1 = profile({
    name: '毛毛',
    aliases: ['毛豆', '毛毛'],
    species: '狗',
    breed: '边牧',
    vaccineStatus: '已接种 3 针（2024-08）',
    trainingProgress: '进行中',
    trainingJudge: '待评定',
    latestNote: '飞盘训练第 6 节，专注力偏弱',
    photoUrls: ['vaccine/maomao-202408.jpg'],
  });
  const maomao2 = { ...maomao1, confirmed: true };
  const maomao3 = {
    ...maomao2,
    latestNote: '飞盘训练第 6 节；主人补充上周遛狗挣脱牵引，疑似受惊，暂停户外训练',
  };
  const maomao4 = {
    ...maomao3,
    trainingProgress: '中止',
    trainingJudge: '不合格',
    latestNote: `${maomao3.latestNote}；因受惊评估，本期训练中止`,
  };

  return [
    event('evt-doudou-import', 'pet_doudou', 'import', 1, doudou0, doudou1, {
      source: 'vaccine_photo',
      note: '首次导入疫苗本照片「柯基-豆豆-20241115.jpg」',
    }),
    event('evt-doubao-import-old', 'pet_doubao', 'import', 2, doubao0, doubao1, {
      source: 'vaccine_photo',
      note: '首次导入旧版疫苗本照片，后来发现与纸质原件不符',
    }),
    event('evt-doubao-revoke', 'pet_doubao', 'revoke', 3, doubao1, doubao2, {
      source: 'manual',
      note: '撤回旧版疫苗本照片，保留为历史版本',
    }),
    event('evt-doudou-confirm', 'pet_doudou', 'confirm', 5, doudou1, doudou2, {
      source: 'manual',
      note: '核对疫苗本与系统记录一致，确认归档',
    }),
    event('evt-doubao-reimport', 'pet_doubao', 'import', 7, doubao2, doubao3, {
      source: 'reimport',
      note: '重新导入新版疫苗本照片，含狂犬记录',
    }),
    event('evt-doubao-confirm', 'pet_doubao', 'confirm', 9, doubao3, doubao4, {
      source: 'manual',
      note: '确认新版疫苗本信息正确',
    }),
    event('evt-wangcai-import', 'pet_wangcai', 'import', 12, wangcai0, wangcai1, {
      source: 'vaccine_photo',
      note: '导入疫苗本和训练结课记录',
    }),
    event('evt-wangcai-confirm', 'pet_wangcai', 'confirm', 13, wangcai1, wangcai2, {
      source: 'manual',
      note: '初次评定：结课考核不合格',
    }),
    event('evt-maomao-import', 'pet_maomao', 'import', 22, maomao0, maomao1, {
      source: 'vaccine_photo',
      note: '导入疫苗本照片，别名列表中把主名也写入了别名',
    }),
    event('evt-maomao-confirm', 'pet_maomao', 'confirm', 24, maomao1, maomao2, {
      source: 'manual',
      note: '确认训练进度',
    }),
    event('evt-meiqiu-import', 'pet_meiqiu', 'import', 30, meiqiu0, meiqiu1, {
      source: 'vaccine_photo',
      note: '导入疫苗本照片，待确认结课进度',
    }),
    event('evt-doudou-addendum', 'pet_doudou', 'addendum', 35, doudou2, doudou3, {
      source: 'owner_supplement',
      note: '主人补发加强针截图，导出应显示疫苗状态与备注变化',
    }),
    event('evt-wangcai-rejudge', 'pet_wangcai', 'rejudge', 40, wangcai2, wangcai3, {
      source: 'manual',
      note: '人工改判：不合格 -> 合格',
      oldJudge: '不合格',
      newJudge: '合格',
      rejudgeReason: '主人提供自行加练视频和训练课补拍监控，拒食项目在家中与陌生人均达标，原考核受当日紧张影响，予以改判',
    }),
    event('evt-meiqiu-addendum', 'pet_meiqiu', 'addendum', 48, meiqiu1, meiqiu2, {
      source: 'owner_supplement',
      note: '主人电话补录后续 3 节脱敏课，导出需说明训练进度、评定、备注和截图变化',
    }),
    event('evt-maomao-addendum', 'pet_maomao', 'addendum', 52, maomao2, maomao3, {
      source: 'owner_supplement',
      note: '主人补充户外挣脱事件，建议暂停',
    }),
    event('evt-maomao-rejudge', 'pet_maomao', 'rejudge', 58, maomao3, maomao4, {
      source: 'manual',
      note: '人工改判：待评定 -> 不合格并中止本期',
      oldJudge: '待评定',
      newJudge: '不合格',
      rejudgeReason: '户外挣脱后对陌生环境与移动目标明显受惊，建议转为居家安抚，待情绪稳定后重新入训',
    }),
  ];
}
