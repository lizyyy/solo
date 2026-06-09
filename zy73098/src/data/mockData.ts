import type { FireZone, ReviewRecord, AnomalyItem, TimelineNode, SchemeId } from '../types';

export const FIRE_ZONES: FireZone[] = [
  {
    id: 'F1-Z01',
    floor: 1,
    name: '东侧商业区',
    position: [-6, 0, -4],
    size: [8, 2.2, 6],
    color: { A: '#2DD4A8', B: '#FB923C', C: '#A78BFA' }
  },
  {
    id: 'F1-Z02',
    floor: 1,
    name: '核心筒走道',
    position: [0, 0, -4],
    size: [5, 2.2, 6],
    color: { A: '#2DD4A8', B: '#FB923C', C: '#A78BFA' }
  },
  {
    id: 'F2-Z03',
    floor: 2,
    name: '西侧库房',
    position: [6, 0, 3],
    size: [7, 2.2, 5],
    color: { A: '#2DD4A8', B: '#FB923C', C: '#A78BFA' }
  },
  {
    id: 'F1-Z04',
    floor: 1,
    name: '消防电梯厅',
    position: [-6, 0, 3],
    size: [6, 2.2, 4],
    color: { A: '#2DD4A8', B: '#FB923C', C: '#A78BFA' }
  }
];

const iso = (d: string) => new Date(d).toISOString();

export const REVIEW_RECORDS: ReviewRecord[] = [
  {
    id: 'REC-001',
    zoneId: 'F1-Z01',
    schemeId: 'A',
    versionAt: iso('2026-06-08'),
    remarks: {
      bimOriginal: '分区面积1200㎡，防火墙等级A级，疏散门2扇，净宽1.8m',
      supplementary: '分区面积1200㎡，防火墙A级，疏散门2扇净宽1.8m，与BIM一致',
      verbal: '面积1200㎡，材料A级，疏散宽度满足',
      lastModified: iso('2026-06-08'),
      hasConflict: false
    },
    status: 'confirmed',
    fileConclusion: '方案A东侧商业区分区合规，已通过消防负责人复核',
    anomalyIds: [],
    reviewedBy: '消防负责人-李工',
    reviewedAt: iso('2026-06-08')
  },
  {
    id: 'REC-002',
    zoneId: 'F1-Z02',
    schemeId: 'B',
    versionAt: iso('2026-06-09'),
    remarks: {
      bimOriginal: '核心筒走道分区面积480㎡，防火卷帘3樘，与F1-Z01连通',
      supplementary: null,
      verbal: '核心筒按方案B调整后，走道面积应为520㎡，防火卷帘应增到4樘',
      lastModified: iso('2026-06-09'),
      hasConflict: true,
      conflictFields: ['area', 'other'],
      diffHighlights: ['480㎡ → 520㎡（口头口径）', '3樘 → 4樘（口头口径）']
    },
    status: 'pending',
    fileConclusion: '待后补备注完善后复核，当前与口头说明存在面积/卷帘口径差异',
    anomalyIds: ['ANOM-002', 'ANOM-003']
  },
  {
    id: 'REC-003',
    zoneId: 'F2-Z03',
    schemeId: 'B',
    versionAt: iso('2026-06-07'),
    remarks: {
      bimOriginal: '西侧库房面积1200㎡，防火墙耐火3h，与F2-Z04分区挡烟垂壁距地2.5m',
      supplementary: '库房分区面积1350㎡（后补实测），防火墙3h，挡烟垂壁调整为距地2.8m',
      verbal: '库房按1350㎡送审，但BIM还没改，碰撞点先记下来月底再核',
      lastModified: iso('2026-06-07'),
      hasConflict: true,
      conflictFields: ['area', 'height'],
      diffHighlights: ['1200㎡ (BIM) vs 1350㎡ (后补/口头)', '挡烟垂壁 2.5m vs 2.8m']
    },
    status: 'returned',
    fileConclusion: '退回：三源面积口径不一致(1200/1350)，且碰撞检测重复2次，需BIM同步后补口径后重报',
    anomalyIds: ['ANOM-001', 'ANOM-004'],
    reviewedBy: '消防负责人-李工',
    reviewedAt: iso('2026-06-09')
  },
  {
    id: 'REC-004',
    zoneId: 'F1-Z04',
    schemeId: 'C',
    versionAt: iso('2026-06-05'),
    remarks: {
      bimOriginal: '消防电梯厅面积320㎡，前室正压送风，甲级防火门2樘',
      supplementary: '消防电梯厅320㎡，前室送风参数与BIM一致，门2樘甲级',
      verbal: '电梯厅320㎡没问题，送审口径与BIM统一',
      lastModified: iso('2026-06-05'),
      hasConflict: false
    },
    status: 'confirmed',
    fileConclusion: '方案C电梯厅分区已确认，三源口径统一',
    anomalyIds: [],
    reviewedBy: '建筑师-小赵',
    reviewedAt: iso('2026-06-06')
  }
];

export const ANOMALY_ITEMS: AnomalyItem[] = [
  {
    id: 'ANOM-001',
    type: 'collision_duplicate',
    zoneId: 'F2-Z03',
    schemeId: 'B',
    description: 'F2-Z03 西侧库房与 F2-Z04 分区隔墙碰撞点重复登记',
    detail: '碰撞ID CL-2026-071 在 6月3日14:22、6月4日09:15、6月5日17:40 三次登记同一坐标 (x=6.2,y=0.3,z=3.1)，属于同一碰撞点重复上报3次而非新增碰撞',
    createdAt: iso('2026-06-06'),
    resolved: false,
    duplicateCount: 3
  },
  {
    id: 'ANOM-002',
    type: 'remark_missing',
    zoneId: 'F1-Z02',
    schemeId: 'B',
    description: 'F1-Z02 核心筒走道后补备注缺失',
    detail: '三源备注中"后补备注"字段为空，口头说明已更新但缺少书面后补件，月底送审附件不齐',
    createdAt: iso('2026-06-09'),
    resolved: false
  },
  {
    id: 'ANOM-003',
    type: 'remark_conflict',
    zoneId: 'F1-Z02',
    schemeId: 'B',
    description: 'F1-Z02 核心筒走道 BIM 与口头说明口径冲突',
    detail: 'BIM原备注 面积480㎡/卷帘3樘；口头说明 面积520㎡/卷帘4樘。差异字段：面积(差40㎡)、卷帘数量(差1樘)，需后补备注统一口径',
    createdAt: iso('2026-06-09'),
    resolved: false
  },
  {
    id: 'ANOM-004',
    type: 'remark_conflict',
    zoneId: 'F2-Z03',
    schemeId: 'B',
    description: 'F2-Z03 西侧库房 三源面积口径不一致',
    detail: 'BIM 1200㎡ / 后补 1350㎡ / 口头 1350㎡。差异：面积差150㎡，挡烟垂壁高度 2.5m vs 2.8m。BIM未同步后补实测数据',
    createdAt: iso('2026-06-07'),
    resolved: false
  }
];

export const TIMELINE_NODES: TimelineNode[] = [
  { date: '2026-06-05', label: '方案初版（A/C）', schemeId: 'A', index: 0 },
  { date: '2026-06-06', label: '方案 B 介入', schemeId: 'B', index: 1 },
  { date: '2026-06-07', label: '后补备注导入', schemeId: 'B', index: 2 },
  { date: '2026-06-08', label: '口头说明更新', schemeId: 'A', index: 3 },
  { date: '2026-06-09', label: '退回记录标记', schemeId: 'B', index: 4 }
];

export const SCHEME_COLORS: Record<SchemeId, { main: string; glow: string; label: string }> = {
  A: { main: '#2DD4A8', glow: 'rgba(45,212,168,0.35)', label: '方案A · 均衡型' },
  B: { main: '#FB923C', glow: 'rgba(251,146,60,0.35)', label: '方案B · 集约型' },
  C: { main: '#A78BFA', glow: 'rgba(167,139,250,0.35)', label: '方案C · 预留型' }
};

export const STATUS_LABEL = {
  confirmed: { text: '已确认', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  pending:   { text: '待补件', color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/40'   },
  returned:  { text: '退回',   color: 'text-rose-300',    bg: 'bg-rose-500/15',    border: 'border-rose-500/40'    }
};

export const ANOMALY_LABEL = {
  collision_duplicate: { text: '碰撞点重复', color: 'bg-rose-500/90' },
  remark_conflict:     { text: '口径不一致', color: 'bg-orange-500/90' },
  remark_missing:      { text: '备注缺失',   color: 'bg-yellow-500/90' }
};
