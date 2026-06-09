import type { TempControlRecord, JudgmentRecord, SupplementaryNote } from '@/types';

// 规范化体重为 kg
function normKg(weight: number, unit: 'kg' | 'g' | '斤' | 'lb'): number {
  switch (unit) {
    case 'kg': return weight;
    case 'g':  return weight / 1000;
    case '斤': return weight / 2;
    case 'lb': return weight * 0.453592;
  }
}

// 改判记录样例
const J1: JudgmentRecord[] = [
  {
    id: 'j-001',
    operator: '项目经理-陈晨',
    originalAnomaly: 'temp_out_of_range',
    newStatus: 'confirmed',
    reason: '主人在家使用环境温度计测量，未测泄殖腔温；到院复测体温26.3℃正常，标记为误报。',
    timestamp: '2026-06-08 15:42',
  },
];

const J2: JudgmentRecord[] = [
  {
    id: 'j-002',
    operator: '项目经理-陈晨',
    originalAnomaly: 'weight_unit_mixed',
    newStatus: 'confirmed',
    reason: '前台按主人口述"2斤"直接录入，确认无误；规范化后与过往记录一致。',
    timestamp: '2026-06-07 11:08',
  },
  {
    id: 'j-003',
    operator: '前台-小温',
    originalAnomaly: 'weight_unit_mixed',
    newStatus: 'anomaly',
    reason: '主人又改口说是"2公斤"，需要电话回访确认后再定。',
    timestamp: '2026-06-07 14:25',
  },
];

// 后补说明样例
const S1: SupplementaryNote[] = [
  {
    id: 's-001',
    author: '前台-小温',
    content: '主人在候诊区补充：昨天上午还开了加热灯，下午跳闸，可能因此温度偏低。',
    timestamp: '2026-06-08 10:15',
  },
  {
    id: 's-002',
    author: '项目经理-陈晨',
    content: '已电话确认：跳闸时间约4小时，环境温最低22℃。此记录作为对比样本保留，无需改判。',
    timestamp: '2026-06-08 10:48',
  },
];

const S2: SupplementaryNote[] = [
  {
    id: 's-003',
    author: '前台-小温',
    content: '现场照片显示是同一只宠物（左前爪有缺一块），主人报了两个名字，可能是孩子和老人分别起的。',
    timestamp: '2026-06-08 09:30',
  },
];

/**
 * 30条异宠温控记录
 *  15条正常（kg单位、confirmed）
 *  5条体重单位混写（2斤+2g+1lb）
 *  4条组成2组疑似同宠异名
 *  3条温度异常（2高+1低）
 *  2条带人工改判样例
 *  2条带后补说明样例
 *  6条含现场痕迹微信备注
 */
const RAW: Partial<TempControlRecord>[] = [
  // ===== 15条正常记录 =====
  { petName:'豆豆', petCategory:'reptile', species:'豹纹守宫', ownerName:'李婷', ownerPhone:'13800000001',
    ownerWechatNote:'按预约时间来的，状态都正常。',
    weight:0.055, weightUnit:'kg', temperature:27.8, measureTime:'2026-06-09 09:15', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:02' },

  { petName:'雪球', petCategory:'smallMammal', species:'仓鼠（银狐）', ownerName:'王建国', ownerPhone:'13800000002',
    ownerWechatNote:'正常。',
    weight:0.045, weightUnit:'kg', temperature:25.2, measureTime:'2026-06-09 09:22', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:05' },

  { petName:'小灰', petCategory:'bird', species:'玄凤鹦鹉', ownerName:'赵思敏', ownerPhone:'13800000003',
    ownerWechatNote:'按期体检，食欲好。',
    weight:0.095, weightUnit:'kg', temperature:41.2, measureTime:'2026-06-09 09:30', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:10' },

  { petName:'皮蛋', petCategory:'reptile', species:'鬃狮蜥', ownerName:'刘子墨', ownerPhone:'13800000004',
    ownerWechatNote:'老顾客，温度按常规记录。',
    weight:0.520, weightUnit:'kg', temperature:30.1, measureTime:'2026-06-09 09:40', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:12' },

  { petName:'糖糖', petCategory:'smallMammal', species:'蜜袋鼬', ownerName:'周思琪', ownerPhone:'13800000005',
    ownerWechatNote:'正常。',
    weight:0.110, weightUnit:'kg', temperature:28.5, measureTime:'2026-06-09 09:55', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:14' },

  { petName:'毛毛', petCategory:'smallMammal', species:'龙猫（标灰）', ownerName:'郑小华', ownerPhone:'13800000006',
    ownerWechatNote:'正常。',
    weight:0.520, weightUnit:'kg', temperature:24.0, measureTime:'2026-06-09 10:05', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:20' },

  { petName:'小鹦', petCategory:'bird', species:'虎皮鹦鹉', ownerName:'钱多多', ownerPhone:'13800000007',
    ownerWechatNote:'正常，做年度体检。',
    weight:0.035, weightUnit:'kg', temperature:41.5, measureTime:'2026-06-09 10:15', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:22' },

  { petName:'阿绿', petCategory:'reptile', species:'绿鬣蜥', ownerName:'孙浩然', ownerPhone:'13800000008',
    ownerWechatNote:'状态良好，UVB灯已换。',
    weight:1.800, weightUnit:'kg', temperature:32.0, measureTime:'2026-06-09 10:25', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:25' },

  { petName:'黑眼', petCategory:'smallMammal', species:'豚鼠', ownerName:'吴佳怡', ownerPhone:'13800000009',
    ownerWechatNote:'正常。',
    weight:0.850, weightUnit:'kg', temperature:26.2, measureTime:'2026-06-09 10:35', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:30' },

  { petName:'鹦鹉先生', petCategory:'bird', species:'灰鹦鹉', ownerName:'冯磊', ownerPhone:'13800000010',
    ownerWechatNote:'体检。',
    weight:0.420, weightUnit:'kg', temperature:41.0, measureTime:'2026-06-09 10:45', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:32' },

  { petName:'小花', petCategory:'reptile', species:'玉米蛇（牛油）', ownerName:'陈雨晴', ownerPhone:'13800000011',
    ownerWechatNote:'蜕皮后状态好。',
    weight:0.200, weightUnit:'kg', temperature:28.0, measureTime:'2026-06-09 10:55', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:35' },

  { petName:'阿球', petCategory:'smallMammal', species:'荷兰猪', ownerName:'韩梅', ownerPhone:'13800000012',
    ownerWechatNote:'正常。',
    weight:0.900, weightUnit:'kg', temperature:25.8, measureTime:'2026-06-09 11:05', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:40' },

  { petName:'小蜥', petCategory:'reptile', species:'蓝舌石龙子', ownerName:'徐浩', ownerPhone:'13800000013',
    ownerWechatNote:'常规复查。',
    weight:0.450, weightUnit:'kg', temperature:29.5, measureTime:'2026-06-09 11:15', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:42' },

  { petName:'啾啾', petCategory:'bird', species:'牡丹鹦鹉', ownerName:'曹阳', ownerPhone:'13800000014',
    ownerWechatNote:'正常。',
    weight:0.050, weightUnit:'kg', temperature:41.3, measureTime:'2026-06-09 11:25', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:45' },

  { petName:'毛毛2', petCategory:'reptile', species:'球蟒（原色）', ownerName:'严晨', ownerPhone:'13800000015',
    ownerWechatNote:'已禁食一周，准备体检。',
    weight:1.200, weightUnit:'kg', temperature:30.5, measureTime:'2026-06-09 11:35', status:'confirmed', anomalyType:[],
    confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 18:50' },

  // ===== 5条 体重单位混写 =====
  { petName:'小胖', petCategory:'smallMammal', species:'金丝熊', ownerName:'姚思雨', ownerPhone:'13800000016',
    ownerWechatNote:'主人说大概2斤左右，昨天家里测的温度正常。',
    weight:2, weightUnit:'斤', temperature:25.3, measureTime:'2026-06-09 13:00',
    status:'pending', anomalyType:['weight_unit_mixed','wechat_note_flag'] },

  { petName:'胖墩', petCategory:'smallMammal', species:'侏儒兔', ownerName:'秦勇', ownerPhone:'13800000017',
    ownerWechatNote:'刚到医院，路上2小时，笼子里量的3斤。',
    weight:3, weightUnit:'斤', temperature:26.8, measureTime:'2026-06-09 13:15',
    status:'anomaly', anomalyType:['weight_unit_mixed','wechat_note_flag'],
    judgments: J2, supplementaryNotes: S1 },

  { petName:'金金', petCategory:'bird', species:'玄凤鹦鹉', ownerName:'方圆', ownerPhone:'13800000018',
    ownerWechatNote:'主人写的是95克，昨天还正常今天有点蔫。',
    weight:95, weightUnit:'g', temperature:42.1, measureTime:'2026-06-09 13:25',
    status:'pending', anomalyType:['weight_unit_mixed','temp_out_of_range','wechat_note_flag'] },

  { petName:'阿黄', petCategory:'reptile', species:'缅甸陆龟', ownerName:'何欣怡', ownerPhone:'13800000019',
    ownerWechatNote:'昨天量的3200克，今天基本一致。',
    weight:3200, weightUnit:'g', temperature:29.2, measureTime:'2026-06-09 13:35',
    status:'pending', anomalyType:['weight_unit_mixed','wechat_note_flag'] },

  { petName:'贝塔', petCategory:'smallMammal', species:'飞鼠（日本鼯鼠）', ownerName:'罗宇', ownerPhone:'13800000020',
    ownerWechatNote:'主人说2磅，出门前测的温度。',
    weight:2, weightUnit:'lb', temperature:27.5, measureTime:'2026-06-09 13:45',
    status:'pending', anomalyType:['weight_unit_mixed','wechat_note_flag'] },

  // ===== 4条 组成2组疑似同宠异名（主人手机号+品种一致） =====
  // 组1：小绿/绿哥 - 豹纹守宫
  { petName:'小绿', petCategory:'reptile', species:'豹纹守宫', ownerName:'许文博', ownerPhone:'13800001234',
    ownerWechatNote:'刚测的，状态和上次一样。',
    weight:0.060, weightUnit:'kg', temperature:27.5, measureTime:'2026-06-09 14:00',
    status:'pending', anomalyType:['duplicate_pet','wechat_note_flag'],
    supplementaryNotes: S2, mergeGroupId:'MG-001' },

  { petName:'绿哥', petCategory:'reptile', species:'豹纹守宫', ownerName:'许文博（孩子妈）', ownerPhone:'13800001234',
    ownerWechatNote:'孩子爸爸带过来的，说叫绿哥。',
    weight:0.061, weightUnit:'kg', temperature:27.6, measureTime:'2026-06-09 14:05',
    status:'pending', anomalyType:['duplicate_pet'],
    mergeGroupId:'MG-001' },

  // 组2：团子/汤圆 - 金丝熊
  { petName:'团子', petCategory:'smallMammal', species:'金丝熊', ownerName:'姜丽', ownerPhone:'13800005678',
    ownerWechatNote:'到医院前在空调房里待了半小时。',
    weight:0.130, weightUnit:'kg', temperature:25.0, measureTime:'2026-06-09 14:15',
    status:'pending', anomalyType:['duplicate_pet','wechat_note_flag'],
    mergeGroupId:'MG-002' },

  { petName:'汤圆', petCategory:'smallMammal', species:'金丝熊', ownerName:'姜丽', ownerPhone:'13800005678',
    ownerWechatNote:'主人说孩子又给起了个名字叫汤圆。',
    weight:0.129, weightUnit:'kg', temperature:25.1, measureTime:'2026-06-09 14:18',
    status:'pending', anomalyType:['duplicate_pet'],
    mergeGroupId:'MG-002' },

  // ===== 3条 温度异常（2高+1低），其中1条带改判 =====
  { petName:'暖宝', petCategory:'reptile', species:'红腿陆龟', ownerName:'高丽', ownerPhone:'13800000021',
    ownerWechatNote:'加热灯一直开着，刚测。',
    weight:2.300, weightUnit:'kg', temperature:35.8, measureTime:'2026-06-09 14:30',
    status:'pending', anomalyType:['temp_out_of_range','wechat_note_flag'] },

  { petName:'冰冰', petCategory:'reptile', species:'豹纹守宫', ownerName:'邓凯', ownerPhone:'13800000022',
    ownerWechatNote:'主人说昨天还正常，今天不吃东西。',
    weight:0.048, weightUnit:'kg', temperature:22.5, measureTime:'2026-06-09 14:40',
    status:'pending', anomalyType:['temp_out_of_range','wechat_note_flag'] },

  { petName:'火火', petCategory:'bird', species:'葵花凤头鹦鹉', ownerName:'谢晓彤', ownerPhone:'13800000023',
    ownerWechatNote:'在候诊区有点应激。',
    weight:0.750, weightUnit:'kg', temperature:43.5, measureTime:'2026-06-09 14:50',
    status:'confirmed', anomalyType:['temp_out_of_range','wechat_note_flag'],
    judgments: J1, confirmedBy:'项目经理-陈晨', confirmedAt:'2026-06-08 16:00' },
];

// 填充 id & 派生字段
let idx = 0;
export const MOCK_RECORDS: TempControlRecord[] = RAW.map((r) => {
  idx += 1;
  const id = 'REC-' + String(2026060900 + idx).padStart(10, '0');
  const weightUnit = r.weightUnit!;
  const weight = r.weight!;
  const weightNormalizedKg = Number(normKg(weight, weightUnit).toFixed(4));
  const weightUnitAbnormal = weightUnit !== 'kg';
  return {
    id,
    petName: r.petName!,
    petCategory: r.petCategory!,
    species: r.species!,
    ownerName: r.ownerName!,
    ownerPhone: r.ownerPhone!,
    ownerWechatNote: r.ownerWechatNote || '',
    weight,
    weightUnit,
    weightNormalizedKg,
    weightUnitAbnormal,
    temperature: r.temperature!,
    measureTime: r.measureTime!,
    status: r.status!,
    anomalyType: r.anomalyType || [],
    confirmedBy: r.confirmedBy,
    confirmedAt: r.confirmedAt,
    mergeGroupId: r.mergeGroupId,
    aliases: r.aliases,
    judgments: r.judgments,
    supplementaryNotes: r.supplementaryNotes,
  };
});

// 疑似重名候选（供 mergeStore 使用）
export const PRESET_MERGE_GROUPS = [
  {
    id: 'MG-001',
    primaryName: '小绿',
    aliases: ['绿哥'],
    mergedRecordIds: MOCK_RECORDS.filter(r => r.mergeGroupId === 'MG-001').map(r => r.id),
    ownerPhone: '13800001234',
    species: '豹纹守宫',
    confirmed: false,
    confidence: 0.92,
    matchReasons: ['主人手机号完全一致', '品种均为豹纹守宫', '体重接近（0.060 vs 0.061）'],
  },
  {
    id: 'MG-002',
    primaryName: '团子',
    aliases: ['汤圆'],
    mergedRecordIds: MOCK_RECORDS.filter(r => r.mergeGroupId === 'MG-002').map(r => r.id),
    ownerPhone: '13800005678',
    species: '金丝熊',
    confirmed: false,
    confidence: 0.95,
    matchReasons: ['主人手机号完全一致', '品种均为金丝熊', '主人备注：孩子又起了一个名字'],
  },
];

export const CURRENT_OPERATOR = '项目经理-陈晨';
