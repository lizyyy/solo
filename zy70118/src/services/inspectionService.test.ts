import { InMemoryBatchRepository, IBatchRepository } from '../infrastructure';
import { RuleEngine, BatchStatus, TicketType, TemperatureUnit, InspectionType } from '../domain';
import { InspectionService, InspectionReport } from './inspectionService';

describe('验收服务测试', () => {
  let repository: InMemoryBatchRepository;
  let ruleEngine: RuleEngine;
  let service: InspectionService;

  beforeEach(() => {
    repository = new InMemoryBatchRepository();
    ruleEngine = new RuleEngine();
    service = new InspectionService(repository, ruleEngine);
  });

  const createTestBatch = async () => {
    return service.createBatch({
      supplierId: 'S001',
      materialCode: 'M001',
      materialName: '冷冻鸡肉',
      quantity: 100,
      unit: 'kg',
      expectedDeliveryDate: new Date(),
      actualDeliveryDate: new Date(),
      vehiclePlate: '京A12345',
      driverId: 'DRV001',
      operatorId: 'OP001'
    });
  };

  describe('创建批次', () => {
    it('应成功创建批次，初始状态为 PENDING', async () => {
      const batch = await createTestBatch();

      expect(batch.id).toBeDefined();
      expect(batch.status).toBe(BatchStatus.PENDING);
      expect(batch.version).toBe(0);
      expect(batch.supplierId).toBe('S001');
      expect(batch.materialCode).toBe('M001');
      expect(batch.temperatureChecks).toEqual([]);
      expect(batch.weightChecks).toEqual([]);
      expect(batch.ticketChecks).toEqual([]);
    });
  });

  describe('完整验收流程（主流程）', () => {
    it('应完成完整的验收流程：验温→验重→验票→验收', async () => {
      const batch = await createTestBatch();

      let result = await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: -5,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ],
        note: '温度正常'
      });

      expect(result.success).toBe(true);
      expect(result.batch?.status).toBe(BatchStatus.TEMPERATURE_CHECKED);
      expect(result.batch?.temperatureChecks.length).toBe(1);

      result = await service.performWeightCheck({
        batchId: batch.id,
        items: [
          {
            expected: 100,
            actual: 102,
            unit: 'KILOGRAM'
          }
        ],
        operatorId: 'OP001',
        note: '重量偏差在允许范围内'
      });

      expect(result.success).toBe(true);
      expect(result.batch?.status).toBe(BatchStatus.WEIGHT_CHECKED);
      expect(result.batch?.weightChecks.length).toBe(1);

      result = await service.performTicketCheck({
        batchId: batch.id,
        items: [
          {
            type: 'QUALIFICATION_CERT',
            provided: true,
            valid: true,
            ticketNumber: 'QC-2024-001'
          },
          {
            type: 'DELIVER_NOTE',
            provided: true,
            valid: true,
            ticketNumber: 'DN-2024-001'
          }
        ],
        operatorId: 'OP001',
        note: '票证齐全'
      });

      expect(result.success).toBe(true);
      expect(result.batch?.status).toBe(BatchStatus.TICKET_CHECKED);
      expect(result.batch?.ticketChecks.length).toBe(2);

      result = await service.acceptBatch({
        batchId: batch.id,
        operatorId: 'OP001',
        note: '全部合格'
      });

      expect(result.success).toBe(true);
      expect(result.batch?.status).toBe(BatchStatus.ACCEPTED);
    });
  });

  describe('拒收补货流程', () => {
    it('应支持拒收后补货再验收', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: -5,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      let rejectResult = await service.rejectBatch({
        batchId: batch.id,
        reasons: [
          {
            type: 'WEIGHT',
            code: 'W001',
            description: '重量不足',
            detail: '实际重量 90kg，超出允许偏差范围'
          }
        ],
        operatorId: 'OP001'
      });

      expect(rejectResult.success).toBe(true);
      expect(rejectResult.batch?.status).toBe(BatchStatus.REJECTED);
      expect(rejectResult.batch?.rejectionReasons.length).toBe(1);

      const replenishResult = await service.replenishBatch({
        batchId: batch.id,
        operatorId: 'OP001',
        note: '供应商已补货',
        newBatchId: 'NEW-001'
      });

      expect(replenishResult.success).toBe(true);
      expect(replenishResult.batch?.status).toBe(BatchStatus.REPLENISHED);
      expect(replenishResult.batch?.replenishmentInfo).toBeDefined();
      expect(replenishResult.batch?.replenishmentInfo?.newBatchId).toBe('NEW-001');
    });
  });

  describe('异常流程测试', () => {
    it('跳过验温直接验重应抛出状态流转错误', async () => {
      const batch = await createTestBatch();

      await expect(
        service.performWeightCheck({
          batchId: batch.id,
          items: [{ expected: 100, actual: 100, unit: 'KILOGRAM' }],
          operatorId: 'OP001'
        })
      ).rejects.toThrow('状态流转非法');
    });

    it('重复提交验温应抛出重复提交错误', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      await expect(
        service.performTemperatureCheck({
          batchId: batch.id,
          items: [
            {
              location: '车厢内部',
              value: 2,
              unit: 'CELSIUS',
              measuredAt: new Date(),
              operatorId: 'OP001'
            }
          ]
        })
      ).rejects.toThrow('重复提交错误');
    });

    it('温度超出范围应返回校验失败', async () => {
      const batch = await createTestBatch();

      const result = await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 20,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain('超出允许范围');
    });

    it('重量偏差超出范围应返回校验失败', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      const result = await service.performWeightCheck({
        batchId: batch.id,
        items: [{ expected: 100, actual: 110, unit: 'KILOGRAM' }],
        operatorId: 'OP001'
      });

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('缺少必需票证应返回校验失败', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      await service.performWeightCheck({
        batchId: batch.id,
        items: [{ expected: 100, actual: 100, unit: 'KILOGRAM' }],
        operatorId: 'OP001'
      });

      const result = await service.performTicketCheck({
        batchId: batch.id,
        items: [
          {
            type: 'INVOICE',
            provided: true,
            valid: true,
            ticketNumber: 'INV-001'
          }
        ],
        operatorId: 'OP001'
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('缺少必需的票证类型');
    });
  });

  describe('数据一致性测试', () => {
    it('并发更新应检测到版本冲突', async () => {
      const batch = await createTestBatch();

      const loaded1 = await service.getBatch(batch.id);
      const loaded2 = await service.getBatch(batch.id);

      expect(loaded1?.version).toBe(0);
      expect(loaded2?.version).toBe(0);

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      const updated = await service.getBatch(batch.id);
      expect(updated?.version).toBe(1);
    });

    it('版本号应随每次操作递增', async () => {
      const batch = await createTestBatch();
      expect(batch.version).toBe(0);

      const tempResult = await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });
      expect(tempResult.batch?.version).toBe(1);

      const weightResult = await service.performWeightCheck({
        batchId: batch.id,
        items: [{ expected: 100, actual: 100, unit: 'KILOGRAM' }],
        operatorId: 'OP001'
      });
      expect(weightResult.batch?.version).toBe(2);
    });
  });

  describe('验收报表测试', () => {
    it('应生成完整的验收报表', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: -5,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          },
          {
            location: '货物中心',
            value: -2,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      await service.performWeightCheck({
        batchId: batch.id,
        items: [{ expected: 100, actual: 98, unit: 'KILOGRAM' }],
        operatorId: 'OP001'
      });

      await service.performTicketCheck({
        batchId: batch.id,
        items: [
          {
            type: 'QUALIFICATION_CERT',
            provided: true,
            valid: true,
            ticketNumber: 'QC-001'
          },
          {
            type: 'DELIVER_NOTE',
            provided: true,
            valid: true,
            ticketNumber: 'DN-001'
          }
        ],
        operatorId: 'OP001'
      });

      await service.acceptBatch({
        batchId: batch.id,
        operatorId: 'OP001'
      });

      const report = await service.generateReport(batch.id);

      expect(report.batchId).toBe(batch.id);
      expect(report.status).toBe(BatchStatus.ACCEPTED);

      expect(report.temperatureSummary.checked).toBe(true);
      expect(report.temperatureSummary.passed).toBe(true);
      expect(report.temperatureSummary.count).toBe(2);
      expect(report.temperatureSummary.minTemp).toBe(-5);
      expect(report.temperatureSummary.maxTemp).toBe(-2);
      expect(report.temperatureSummary.avgTemp).toBe(-3.5);

      expect(report.weightSummary.checked).toBe(true);
      expect(report.weightSummary.passed).toBe(true);
      expect(report.weightSummary.totalExpected).toBe(100);
      expect(report.weightSummary.totalActual).toBe(98);
      expect(report.weightSummary.deviationPercent).toBeCloseTo(-2);

      expect(report.ticketSummary.checked).toBe(true);
      expect(report.ticketSummary.passed).toBe(true);
      expect(report.ticketSummary.totalProvided).toBe(2);
      expect(report.ticketSummary.totalRequired).toBe(2);
    });

    it('未完成验收的批次也能生成报表', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      const report = await service.generateReport(batch.id);

      expect(report.temperatureSummary.checked).toBe(true);
      expect(report.weightSummary.checked).toBe(false);
      expect(report.ticketSummary.checked).toBe(false);
    });
  });

  describe('部分验收', () => {
    it('应支持部分验收', async () => {
      const batch = await createTestBatch();

      await service.performTemperatureCheck({
        batchId: batch.id,
        items: [
          {
            location: '车厢内部',
            value: 0,
            unit: 'CELSIUS',
            measuredAt: new Date(),
            operatorId: 'OP001'
          }
        ]
      });

      await service.performWeightCheck({
        batchId: batch.id,
        items: [{ expected: 100, actual: 100, unit: 'KILOGRAM' }],
        operatorId: 'OP001'
      });

      await service.performTicketCheck({
        batchId: batch.id,
        items: [
          {
            type: 'QUALIFICATION_CERT',
            provided: true,
            valid: true,
            ticketNumber: 'QC-001'
          },
          {
            type: 'DELIVER_NOTE',
            provided: true,
            valid: true,
            ticketNumber: 'DN-001'
          }
        ],
        operatorId: 'OP001'
      });

      const result = await service.acceptBatch({
        batchId: batch.id,
        operatorId: 'OP001',
        partialAccept: true,
        acceptedQuantity: 80,
        note: '部分合格'
      });

      expect(result.success).toBe(true);
      expect(result.batch?.status).toBe(BatchStatus.PARTIALLY_ACCEPTED);
    });
  });
});
