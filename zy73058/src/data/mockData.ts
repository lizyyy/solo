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
    primarySourceSparePartId: 'SP-002',
    sparePartIds: ['SP-002', 'SP-001', 'SP-006'],
    sparePartRefs: [
      { id: 'SP-002', role: 'primary-anomaly', roleLabel: '原始异常对象：改名前的旧材料，规格 VG100，结论依据所在' },
      { id: 'SP-001', role: 'corrected', roleLabel: '修正后对照：改名后的通用脂，规格 VG68，不可替代原始来源' },
      { id: 'SP-006', role: 'normal', roleLabel: '普通关联备件' },
    ],
    changeLogs: [
      {
        id: 'CL-1001',
        operator: '王助理（早班）',
        changedAt: '2026-06-01 10:15',
        field: '备件名称 + 规格',
        beforeValue: '钢丝绳润滑脂A（ISO VG100）',
        afterValue: '通用钢丝绳脂（ISO VG68）',
        sparePartRefBeforeId: 'SP-002',
        sparePartRefAfterId: 'SP-001',
        impactExplanation:
          '溯源请回到 SP-002「钢丝绳润滑脂A」，这是上报时的原始对象，规格 ISO VG100（高温型，125% 额定载荷下仍能保持油膜）。改名后指向 SP-001「通用钢丝绳脂」，实际规格为 ISO VG68（常温通用），高温工况油膜强度下降约 22%。该电梯位于 32 层超高层、日均运行 1200 次，结论从"可安全运行至下次维保"变为"待补件——待换回 VG100（SP-002 所代表的规格）后方可销项"。修正后的 SP-001 仅作为对照展示，不能替代原始来源。',
        changeType: 'rename',
      },
    ],
    rawSnapshot: {
      spareParts: [
        sparePartsMap['SP-002'],
        sparePartsMap['SP-006'],
      ],
      notes: '6月1日早班巡检，12B曳引绳磨损超标 0.18mm，计划补润滑脂+观察。（原始快照保留 SP-002，未被改名覆盖）',
    },
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
    sparePartIds: ['SP-003'],
    sparePartRefs: [
      { id: 'SP-003', role: 'normal', roleLabel: '普通关联备件' },
    ],
    changeLogs: [],
    rawSnapshot: {
      spareParts: [sparePartsMap['SP-003']],
      notes: '8A 3F/7F 厅门滑块磨损，已更换 4 只，开合正常。',
    },
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
    sparePartIds: [],
    sparePartRefs: [],
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
    primarySourceSparePartId: 'SP-005',
    sparePartIds: ['SP-005', 'SP-004'],
    sparePartRefs: [
      { id: 'SP-005', role: 'primary-anomaly', roleLabel: '原始异常对象：规格/批次为空的脏数据，导致无法核对盘点' },
      { id: 'SP-004', role: 'corrected', roleLabel: '修正后对照：补录了规格型号，但不覆盖原始脏数据' },
    ],
    changeLogs: [
      {
        id: 'CL-1003',
        operator: '吴师傅（晚班交接补录）',
        changedAt: '2026-06-04 17:10',
        field: '备件规格型号 + 批次号',
        beforeValue: '（空）— 原始脏数据',
        afterValue: 'CJX2-2510 AC220V · B2026-0528',
        sparePartRefBeforeId: 'SP-005',
        sparePartRefAfterId: 'SP-004',
        impactExplanation:
          '溯源请回到 SP-005「门机接触器（规格空、批次空）」，这是原始上报时的脏数据对象——型号/批次未填即提交，月底复核时无法与仓管批次对账，是影响复核结论的核心原因。交接同事如果只看到修正后的 SP-004（CJX2-2510 AC220V），会误以为原始提交就是完整的，无法判断"谁、什么时候、为何补录"。因此 SP-005 必须作为 PRIMARY SOURCE 保留，SP-004 仅作修正后对照，不可替代原始来源。',
        changeType: 'supplement',
      },
    ],
    rawSnapshot: {
      spareParts: [sparePartsMap['SP-005']],
      notes: '3D 门机接触器触点烧蚀，更换一只。—— 型号/批次未及时填写，原始提交即为空（SP-005）',
    },
  },
];
