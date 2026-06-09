import type { JdItem } from '../types';

/** 三四条演示数据：覆盖 顺利 / 补录 / 异常 三种场景 */
export const mockItems: JdItem[] = [
  {
    id: 'jd-001',
    code: 'JD-001',
    major: '消防',
    system: '喷淋系统',
    location: 'B1层 / 机房北侧 3-5轴',
    versions: [
      { version: 'V1.0', date: '2026-05-12' },
      { version: 'V2.1', date: '2026-05-28', note: '增加末端试水装置' }
    ],
    bimNote: '喷淋管贴梁底敷设，与风管交叉处上翻50mm，已在模型中更新。',
    status: 'confirmed',
    conclusion: {
      canConstruct: true,
      clashRisk: 'none',
      needCoordination: false,
      remark: '资料齐全，可按V2.1施工'
    },
    overrides: [],
    supplements: [],
    changeTracks: [],
    createdAt: '2026-05-30 09:12',
    handler: '阿乔'
  },
  {
    id: 'jd-002',
    code: 'JD-002',
    major: '电气',
    system: '强电桥架',
    location: 'B1层 / 东西走廊 1-8轴',
    versions: [
      { version: 'V2.0', date: '2026-05-10' },
      { version: 'V2.1', date: '2026-05-20', note: '桥架宽度由400改为600' },
      { version: 'V2.2', date: '2026-06-02', note: '设计院未签回，待确认' }
    ],
    bimNote: '图纸版本存在V2.1与V2.2分歧，BIM模型未同步最新尺寸。',
    status: 'supplement_pending',
    conclusion: {
      canConstruct: false,
      clashRisk: 'medium',
      needCoordination: true,
      remark: '月底前补BIM备注后再判定'
    },
    overrides: [],
    supplements: [],
    changeTracks: [],
    createdAt: '2026-06-03 14:40',
    handler: '阿乔'
  },
  {
    id: 'jd-003',
    code: 'JD-003',
    major: '综合',
    system: '空调风管 + 给水主干管',
    location: '2层 / 大堂吊顶 2-6轴交C-E轴',
    versions: [
      { version: 'V1.5', date: '2026-05-15' },
      { version: 'V2.0', date: '2026-06-01', note: '管综调整：风管下压80mm' }
    ],
    bimNote: '风管与给水主干管在4轴交D轴处净高冲突约45mm，变更单尚未正式签回。',
    status: 'change_late',
    conclusion: {
      canConstruct: false,
      clashRisk: 'high',
      needCoordination: true,
      remark: '等待变更单，暂无法施工'
    },
    overrides: [
      {
        id: 'ov-1',
        itemId: 'jd-003',
        createdAt: '2026-06-05 16:20',
        operator: '施工经理阿乔',
        before: {
          canConstruct: true,
          clashRisk: 'low',
          needCoordination: false,
          remark: 'BIM显示净空满足，可施工'
        },
        after: {
          canConstruct: false,
          clashRisk: 'high',
          needCoordination: true,
          remark: '人工复核发现净高冲突45mm，改判为暂缓施工'
        },
        reason: '现场实测吊顶完成面2750，BIM按2800建模，叠加风管下压后给水无法通过。',
        impactPoints: [
          '结论从"可施工"改为"暂缓施工"，影响进场安排',
          '冲突等级由低风险升至高风险，需协调机电各专业',
          '触发需协调标记，责任从电气专业扩大到暖通+给排水'
        ],
        scope: ['2层大堂吊顶', '给水主干管DW-2-03', '空调风管AC-2-01', '强电桥架预留孔洞']
      }
    ],
    supplements: [],
    changeTracks: [
      {
        id: 'ct-1',
        itemId: 'jd-003',
        changeNo: 'BG-2026-06-007',
        receivedLate: true,
        sourceRow: '原清单第3条 / JD-003 版本V1.5',
        impactRows: ['JD-003', 'JD-004（受联动影响）'],
        scope: '2层大堂 2-6轴交C-E轴 管综整体下移',
        note: '变更单由设计院6月1日发出，项目部6月4日才收到，晚3天。'
      }
    ],
    createdAt: '2026-06-01 11:05',
    handler: '阿乔'
  }
];
