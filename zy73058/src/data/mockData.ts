import type { ReviewRecord, SparePart } from '@/types';

export const sparePartsMap: Record<string, SparePart> = {
  'SP-001': { id: 'SP-001', name: '通用钢丝绳脂', spec: 'ISO VG68', origin: 'SP-OLD-A3', batch: 'B2026-0512', quantity: 2 },
  'SP-002': { id: 'SP-002', name: '钢丝绳润滑脂A', spec: 'ISO VG100', origin: 'SP-OLD-A3', batch: 'B2026-0512', quantity: 2 },
  'SP-003': { id: 'SP-003', name: '门滑块', spec: 'DS-45-A', origin: 'SP-OLD-B7', batch: 'B2026-0520', quantity: 4 },
  'SP-004': { id: 'SP-004', name: '门机接触器', spec: 'CJX2-2510 AC220V', origin: 'SP-OLD-C1', batch: 'B2026-0528', quantity: 1 },
  'SP-005': { id: 'SP-005', name: '门机接触器', spec: '', origin: 'SP-OLD-C1', batch: '', quantity: 1 },
  'SP-006': { id: 'SP-006', name: '限速器钢丝绳', spec: 'Φ8mm 100m', origin: 'SP-OLD-D9', batch: 'B2026-0601', quantity: 1 },
};

export const mockReviewRecords: ReviewRecord[] = [
  {
    id: 'FT-20260601-003',
    elevatorId: 'EL-12B',
    reporter: '张工',
    faultType: '曳引钢丝绳磨损',
    status: 'pending',
    handler: '李师傅',
    reportedAt: '2026-06-01 09:24',
    handledAt: '2026-06-01 14:08',
    hasThresholdAdjustment: false,
    summary: '备件改名：钢丝绳润滑脂A → 通用钢丝绳脂，规格降级',
    changeLogs: [
      {
        id: 'CL-1001',
        operator: '王助理（早班）',
        changedAt: '2026-06-01 10:15',
        field: '备件名称',
        beforeValue: '钢丝绳润滑脂A',
        afterValue: '通用钢丝绳脂',
        impactExplanation:
          '原"钢丝绳润滑脂A"规格为 ISO VG100（高温型，承重 125% 额定载荷），改名后"通用钢丝绳脂"实际规格为 ISO VG68（常温通用），高温工况油膜强度下降约 22%。该电梯位于 32 层超高层、日均运行 1200 次，结论从"可安全运行至下次维保"变为"待补件——待更换为 VG100 规格后方可销项"。',
        changeType: 'rename',
      },
    ],
    rawSnapshot: {
      spareParts: [
        sparePartsMap['SP-002'],
        { id: 'SP-006', name: '限速器钢丝绳', spec: 'Φ8mm 100m', origin: 'SP-OLD-D9', batch: 'B2026-0601', quantity: 1 },
      ],
      notes: '6月1日早班巡检，12B曳引绳磨损超标 0.18mm，计划补润滑脂+观察。',
    },
    sparePartIds: ['SP-001', 'SP-006'],
  },
  {
    id: 'FT-20260602-007',
    elevatorId: 'EL-08A',
    reporter: '陈工',
    faultType: '厅门滑块磨损',
    status: 'confirmed',
    handler: '赵师傅',
    reportedAt: '2026-06-02 10:45',
    handledAt: '2026-06-02 15:20',
    hasThresholdAdjustment: false,
    summary: '正常记录：厅门滑块更换，无变更无异常',
    changeLogs: [],
    rawSnapshot: {
      spareParts: [sparePartsMap['SP-003']],
      notes: '8A 3F/7F 厅门滑块磨损，已更换 4 只，开合正常。',
    },
    sparePartIds: ['SP-003'],
  },
  {
    id: 'FT-20260603-011',
    elevatorId: 'EL-15C',
    reporter: '刘工',
    faultType: '载重传感器零漂',
    status: 'rejected',
    handler: '孙师傅',
    reportedAt: '2026-06-03 08:10',
    handledAt: '2026-06-03 12:42',
    hasThresholdAdjustment: true,
    summary: '⚠️ 阈值临时调高：超载报警 125% → 150%，3 次超载未报，退回重检',
    thresholdInfo: {
      field: '载重报警阈值',
      oldThreshold: '125% 额定载荷',
      newThreshold: '150% 额定载荷',
      triggeredMisses: 3,
    },
    changeLogs: [
      {
        id: 'CL-1002',
        operator: '孙师傅（中班）',
        changedAt: '2026-06-03 09:02',
        field: '载重报警阈值',
        beforeValue: '125% 额定载荷',
        afterValue: '150% 额定载荷',
        impactExplanation:
          '阈值临时调高 25 个百分点，当日 15:33/16:47/18:02 三次实际载重 131%、138%、142% 均未触发报警，结论从"校准后合格"改为"退回重检——需恢复出厂阈值并重新执行 125% 静载+150% 动载试验"。该操作已单独拎出，不计入正常处理记录。',
        changeType: 'threshold',
      },
    ],
    rawSnapshot: {
      spareParts: [],
      notes: '6月3日 15C 零漂报警，到场查看后校准。（原始备注中未提及阈值调整）',
    },
    sparePartIds: [],
  },
  {
    id: 'FT-20260604-015',
    elevatorId: 'EL-03D',
    reporter: '周工',
    faultType: '开关门异响',
    status: 'pending',
    handler: '吴师傅',
    reportedAt: '2026-06-04 11:30',
    handledAt: '2026-06-04 16:55',
    hasThresholdAdjustment: false,
    summary: '补录记录：原始上报型号缺字段（脏数据保留），后补录接触器规格',
    changeLogs: [
      {
        id: 'CL-1003',
        operator: '吴师傅（晚班交接补录）',
        changedAt: '2026-06-04 17:10',
        field: '备件规格型号',
        beforeValue: '（空）',
        afterValue: 'CJX2-2510 AC220V',
        impactExplanation:
          '原始上报时备件清单型号字段为空（脏数据，未填即提交），交接时发现无法核对批次，后补录型号。原始快照保留空字段未做修改，以避免把脏数据"修得看不出痕迹"。型号补录不影响处理结论，但影响溯源盘点，状态标记为"待补件"以便月底复核时关注。',
        changeType: 'supplement',
      },
    ],
    rawSnapshot: {
      spareParts: [sparePartsMap['SP-005']],
      notes: '3D 门机接触器触点烧蚀，更换一只。—— 型号未及时填写，原始提交即为空',
    },
    sparePartIds: ['SP-004'],
  },
];
