import type { DogRecord, SnapshotData, HistoryEntry, Conclusion, VaccineRecord, Supplement, WeightUnit } from '@/types';
import { cloneSnapshot, formatDate } from '@/utils/dataUtils';

const daysAgo = (n: number, h = 10, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return formatDate(d);
};

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

// ===== 记录 1: 豆豆（正常记录）=====
const doudouV1Snapshot: SnapshotData = {
  dogName: '豆豆',
  breed: '金毛寻回犬',
  gender: '公',
  age: '3岁',
  weight: 28.5,
  weightUnit: 'kg' as WeightUnit,
  ownerName: '李明',
  ownerPhone: '138****2345',
  vaccines: [
    { id: 'v1-1', name: '狂犬疫苗', date: monthsAgo(2), expireDate: monthsAgo(-10), attachmentUrl: '#/att/doudou-1', attachmentName: '狂犬疫苗本页.jpg', attachmentNote: '现场清晰可辨' },
    { id: 'v1-2', name: '犬四联', date: monthsAgo(3), expireDate: monthsAgo(-9), attachmentUrl: '#/att/doudou-2', attachmentName: '四联疫苗记录.jpg' },
    { id: 'v1-3', name: '犬六联', date: monthsAgo(6), expireDate: monthsAgo(-6), attachmentUrl: '#/att/doudou-3', attachmentName: '六联疫苗记录.jpg' },
  ],
  supplements: [],
  conclusion: '疫苗合格 可寄养' as Conclusion,
};

const doudou: DogRecord = {
  id: 'dog-001-doudou',
  statusTag: 'normal',
  statusLabel: '正常记录',
  caseType: '标准流程 · 无补录 · 一次通过',
  createdAt: daysAgo(5, 9, 30),
  currentConclusion: '疫苗合格 可寄养',
  current: doudouV1Snapshot,
  vaccines: doudouV1Snapshot.vaccines,
  supplements: [],
  versionHistory: [
    {
      version: 1,
      timestamp: daysAgo(5, 9, 30),
      operator: '小温',
      snapshot: cloneSnapshot(doudouV1Snapshot),
      remark: '主人现场提供疫苗本扫描件，三针齐全且均在有效期内。',
    },
  ],
};

// ===== 记录 2: 旺财（补录 + 晚到附件 + 改判）=====
const wangcaiV1Snapshot: SnapshotData = {
  dogName: '旺财',
  breed: '中华田园犬',
  gender: '公',
  age: '2岁',
  weight: 14,
  weightUnit: 'kg' as WeightUnit,
  ownerName: '王桂芳',
  ownerPhone: '139****7788',
  vaccines: [
    { id: 'v2-1', name: '犬四联', date: monthsAgo(4), expireDate: monthsAgo(-8), attachmentUrl: '#/att/wangcai-1', attachmentName: '四联扫描.jpg' },
  ],
  supplements: [
    { id: 's2-1', time: daysAgo(4, 9, 15), content: '主人说狂犬疫苗本在家，今天出门忘记带，稍后拍照补发。', operator: '小温' },
  ],
  conclusion: '疫苗缺失 需补打' as Conclusion,
};

const wangcaiV2Snapshot: SnapshotData = cloneSnapshot(wangcaiV1Snapshot);
wangcaiV2Snapshot.vaccines.push({
  id: 'v2-2', name: '狂犬疫苗', date: monthsAgo(3), expireDate: monthsAgo(-9),
  attachmentUrl: '#/att/wangcai-2', attachmentName: '狂犬疫苗照片.jpg',
  attachmentNote: '主人 6/5 晚通过微信补发，比登记晚到 2 天',
  attachmentArrivedLate: true,
});
wangcaiV2Snapshot.supplements.push({
  id: 's2-2', time: daysAgo(2, 20, 12),
  content: '【微信照片】狂犬疫苗已补拍，接种日期 2026-03-06，有效期 1 年。',
  operator: '主人补录',
});
wangcaiV2Snapshot.conclusion = '疫苗合格 可寄养';

const wangcai: DogRecord = {
  id: 'dog-002-wangcai',
  statusTag: 'verdict',
  statusLabel: '补录 + 改判',
  caseType: '晚到附件 · 结论从「需补打」改判为「合格」',
  createdAt: daysAgo(4, 9, 0),
  currentConclusion: '疫苗合格 可寄养',
  current: wangcaiV2Snapshot,
  vaccines: wangcaiV2Snapshot.vaccines,
  supplements: wangcaiV2Snapshot.supplements,
  versionHistory: [
    {
      version: 1, timestamp: daysAgo(4, 9, 0), operator: '小温',
      snapshot: cloneSnapshot(wangcaiV1Snapshot),
      remark: '初登：仅提供四联疫苗，狂犬疫苗缺失。主人承诺当日晚些补发。',
    },
    {
      version: 2, timestamp: daysAgo(2, 20, 15), operator: '主人补录',
      snapshot: cloneSnapshot(wangcaiV2Snapshot),
      remark: '晚到 2 天的狂犬疫苗附件补录后，三针齐全（四联+狂犬）。',
      anomaly: 'late_attachment',
      anomalyExplanation: '附件比登记日晚到 2 天，导致 v1 结论按「疫苗缺失 需补打」判定；补录后狂犬疫苗有效期合格，结论改判。',
    },
  ],
  verdictChain: [
    {
      version: 2,
      fromConclusion: '疫苗缺失 需补打',
      toConclusion: '疫苗合格 可寄养',
      reason: '主人 6/5 20:12 通过微信补发狂犬疫苗照片，已核对在有效期内。',
      materials: ['狂犬疫苗照片.jpg（晚到附件）', '补录备注 s2-2'],
    },
  ],
};

// ===== 记录 3: 胖胖（体重单位混写异常）=====
const pangpangV1Snapshot: SnapshotData = {
  dogName: '胖胖',
  breed: '拉布拉多',
  gender: '母',
  age: '4岁',
  weight: 32,
  weightUnit: 'jin' as WeightUnit,
  ownerName: '张伟',
  ownerPhone: '137****6612',
  vaccines: [
    { id: 'v3-1', name: '狂犬疫苗', date: monthsAgo(1), expireDate: monthsAgo(-11), attachmentUrl: '#/att/pangpang-1', attachmentName: '狂犬盖章页.jpg' },
    { id: 'v3-2', name: '犬八联', date: monthsAgo(2), expireDate: monthsAgo(-10), attachmentUrl: '#/att/pangpang-2', attachmentName: '八联记录.jpg' },
  ],
  supplements: [],
  conclusion: '疫苗合格 可寄养' as Conclusion,
};

const pangpangV2Snapshot: SnapshotData = cloneSnapshot(pangpangV1Snapshot);
pangpangV2Snapshot.weightUnit = 'kg';
pangpangV2Snapshot.supplements.push({
  id: 's3-1', time: daysAgo(1, 11, 40),
  content: '现场称重量为 16kg，登记时误按「32斤」录入。单位改为 kg，数值未同步换算，核对后做异常标注。',
  operator: '小温',
});

const pangpang: DogRecord = {
  id: 'dog-003-pangpang',
  statusTag: 'anomaly',
  statusLabel: '异常 · 单位混写',
  caseType: '体重单位由「斤」改「kg」，数值未换算',
  createdAt: daysAgo(3, 10, 0),
  currentConclusion: '疫苗合格 可寄养',
  current: pangpangV2Snapshot,
  vaccines: pangpangV2Snapshot.vaccines,
  supplements: pangpangV2Snapshot.supplements,
  versionHistory: [
    {
      version: 1, timestamp: daysAgo(3, 10, 0), operator: '小温',
      snapshot: cloneSnapshot(pangpangV1Snapshot),
      remark: '初登：疫苗齐全，体重 32 斤。',
    },
    {
      version: 2, timestamp: daysAgo(1, 11, 45), operator: '小温',
      snapshot: cloneSnapshot(pangpangV2Snapshot),
      remark: '复核时发现单位应记 kg 而非斤，但数值未做同步换算（32 斤 ≈ 16 kg，登记员误改为「32 kg」），标注为异常。',
      anomaly: 'weight_unit_mixed',
      anomalyExplanation: 'v1 体重单位与系统默认 kg 不一致（用了「斤」）；v2 仅改单位字符串、数值未同步换算。若按正常记录走，数值 32 必须随单位变更做换算（32 斤 = 16 kg），因此本次变更不做自动合并，标记异常供人工核对。',
    },
  ],
};

// ===== 记录 4: 可乐（附件模糊 + 人工确认 + 改判）=====
const keleV1Snapshot: SnapshotData = {
  dogName: '可乐',
  breed: '柯基',
  gender: '公',
  age: '1岁半',
  weight: 12,
  weightUnit: 'kg' as WeightUnit,
  ownerName: '陈小琳',
  ownerPhone: '186****9900',
  vaccines: [
    { id: 'v4-1', name: '狂犬疫苗', date: monthsAgo(5), expireDate: monthsAgo(-7), attachmentUrl: '#/att/kele-1-fuzzy', attachmentName: '疫苗本照片（模糊）.jpg', attachmentNote: '章印部分反光' },
    { id: 'v4-2', name: '犬六联', date: monthsAgo(5), expireDate: monthsAgo(-7), attachmentUrl: '#/att/kele-2-fuzzy', attachmentName: '六联页（模糊）.jpg', attachmentNote: '同上' },
  ],
  supplements: [],
  conclusion: '待审核' as Conclusion,
};

const keleV2Snapshot: SnapshotData = cloneSnapshot(keleV1Snapshot);
keleV2Snapshot.vaccines = [
  { id: 'v4-1r', name: '狂犬疫苗', date: monthsAgo(5), expireDate: monthsAgo(-7), attachmentUrl: '#/att/kele-1-clear', attachmentName: '疫苗本狂犬页（清晰）.jpg', attachmentNote: '6/7 主人重拍，章印清楚可见' },
  { id: 'v4-2r', name: '犬六联', date: monthsAgo(5), expireDate: monthsAgo(-7), attachmentUrl: '#/att/kele-2-clear', attachmentName: '六联页（清晰）.jpg', attachmentNote: '同上，2026-01 接种日期可辨' },
];
keleV2Snapshot.supplements.push({
  id: 's4-1', time: daysAgo(0, 9, 10),
  content: '主人今早重新拍摄疫苗本，反光已消除，日期/章印均清晰。',
  operator: '主人补录',
});
keleV2Snapshot.conclusion = '疫苗合格 可寄养';

const kele: DogRecord = {
  id: 'dog-004-kele',
  statusTag: 'verdict',
  statusLabel: '人工确认 + 改判',
  caseType: '附件模糊→待审核→补发清晰截图→人工确认→合格',
  createdAt: daysAgo(2, 14, 30),
  currentConclusion: '疫苗合格 可寄养',
  current: keleV2Snapshot,
  vaccines: keleV2Snapshot.vaccines,
  supplements: keleV2Snapshot.supplements,
  versionHistory: [
    {
      version: 1, timestamp: daysAgo(2, 14, 30), operator: '小温',
      snapshot: cloneSnapshot(keleV1Snapshot),
      remark: '初登：主人提供的疫苗本照片反光严重，狂犬章印和六联接种日期无法辨识，结论「待审核」。',
      anomaly: 'fuzzy_attachment',
      anomalyExplanation: '附件图片质量不足（反光/模糊），关键信息（章印、接种日期）无法 OCR 识别，系统按「待审核」暂缓，未走自动通过流程。',
    },
    {
      version: 2, timestamp: daysAgo(0, 9, 20), operator: '现场老师',
      snapshot: cloneSnapshot(keleV2Snapshot),
      remark: '主人补发清晰截图，现场老师逐项人工比对：日期与有效期均匹配，章印一致，改判为合格。',
      anomaly: 'manual_confirm',
      anomalyExplanation: '由「待审核」→「疫苗合格 可寄养」需人工确认节点：现场老师核对章印真实性后通过，确保结论变化有责任人可追溯。',
    },
  ],
  manualConfirm: {
    before: 1,
    after: 2,
    confirmedBy: '现场老师',
    confirmedAt: daysAgo(0, 9, 25),
  },
  verdictChain: [
    {
      version: 2,
      fromConclusion: '待审核',
      toConclusion: '疫苗合格 可寄养',
      reason: '补发附件清晰可读，现场老师人工确认：狂犬章印、六联接种日期与登记信息一致，通过。',
      materials: ['疫苗本狂犬页（清晰）.jpg', '六联页（清晰）.jpg', '补录备注 s4-1'],
    },
  ],
};

export const mockDogRecords: DogRecord[] = [doudou, wangcai, pangpang, kele];

export { doudou, wangcai, pangpang, kele };
