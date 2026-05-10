import { addDays } from 'date-fns';
import { store } from '../dataStore/inMemoryStore';
import { requisitionService } from '../services/requisitionService';
import { approvalFlowService } from '../services/approvalFlowService';
import { inventoryService } from '../services/inventoryService';
import { ledgerService } from '../services/ledgerService';
import { intervalRuleService } from '../services/intervalRuleService';

describe('Pesticide Requisition Compliance Flow', () => {
  let pesticideId: string;
  let cropId: string;
  let plotId: string;
  let ruleId: string;

  beforeAll(() => {
    store.clearAll();
  });

  beforeEach(() => {
    const now = new Date();
    
    const pesticide = store.pesticidesStore().create({
      name: '测试农药A',
      registrationNumber: 'TEST001',
      manufacturer: '测试厂商',
      activeIngredient: '有效成分A',
      concentration: '10%',
      formulation: '可湿性粉剂',
      category: 'INSECTICIDE',
      toxicity: 'LOW_TOXIC',
      storageConditions: '阴凉干燥',
      usageInstructions: '按说明使用'
    });
    pesticideId = pesticide.id;

    const crop = store.cropsStore().create({
      name: '测试作物',
      scientificName: 'Test Crop',
      category: 'GRAIN',
      growthCycle: '120天',
      plantingSeason: '春季'
    });
    cropId = crop.id;

    const plot = store.plotsStore().create({
      plotNumber: 'T-001',
      name: '测试地块1号',
      area: 10,
      areaUnit: 'MU',
      location: '测试区域',
      soilType: '壤土',
      currentCropId: cropId,
      plantingDate: addDays(now, -30),
      expectedHarvestDate: addDays(now, 90),
      status: 'PLANTED'
    });
    plotId = plot.id;

    const rule = store.intervalRulesStore().create({
      pesticideId,
      cropId,
      safetyIntervalDays: 21,
      maxApplicationsPerSeason: 3,
      minIntervalBetweenApplications: 14,
      maxDosagePerApplication: '20g/亩',
      isActive: true
    });
    ruleId = rule.id;

    store.inventoriesStore().create({
      pesticideId,
      batchNumber: 'BATCH-001',
      quantity: 100,
      unit: 'KG',
      expiryDate: addDays(now, 365),
      warehouse: '测试仓库',
      inboundDate: now,
      supplier: '测试供应商'
    });
  });

  afterEach(() => {
    store.clearAll();
  });

  describe('Main Flow - Normal Operation', () => {
    test('should create a complete requisition flow successfully', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      expect(requisition).toBeDefined();
      expect(requisition.status).toBe('DRAFT');
      expect(requisition.currentStage).toBe('DRAFT');

      const item = await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      expect(item).toBeDefined();
      expect(item.plotId).toBe(plotId);
      expect(item.cropId).toBe(cropId);

      const submitted = await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      expect(submitted.status).toBe('PENDING_APPROVAL');
      expect(submitted.currentStage).toBe('PLOT_VERIFICATION');

      const plotCheckResult = await approvalFlowService.autoProcessPlotVerification(requisition.id);
      expect(plotCheckResult.passed).toBe(true);

      const afterPlotCheck = await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );
      expect(afterPlotCheck.requisition.currentStage).toBe('INTERVAL_CHECK');

      const intervalCheckResult = await approvalFlowService.autoProcessIntervalCheck(requisition.id);
      expect(intervalCheckResult.passed).toBe(true);

      const afterIntervalCheck = await approvalFlowService.processStage(
        requisition.id,
        'INTERVAL_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );
      expect(afterIntervalCheck.requisition.currentStage).toBe('INVENTORY_CHECK');

      const inventoryCheckResult = await approvalFlowService.autoProcessInventoryCheck(requisition.id);
      expect(inventoryCheckResult.passed).toBe(true);

      const afterInventoryCheck = await approvalFlowService.processStage(
        requisition.id,
        'INVENTORY_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );
      expect(afterInventoryCheck.requisition.currentStage).toBe('SUPERVISOR_APPROVAL');

      const afterSupervisor = await approvalFlowService.processStage(
        requisition.id,
        'SUPERVISOR_APPROVAL',
        'APPROVE',
        { processorId: 'supervisor-001', processorName: '主管', comments: '同意' }
      );
      expect(afterSupervisor.requisition.currentStage).toBe('FINAL_APPROVAL');

      const afterFinal = await approvalFlowService.processStage(
        requisition.id,
        'FINAL_APPROVAL',
        'APPROVE',
        { processorId: 'manager-001', processorName: '经理', comments: '同意发放' }
      );
      expect(afterFinal.requisition.currentStage).toBe('COMPLETED');
      expect(afterFinal.requisition.status).toBe('FULFILLED');

      const progress = await approvalFlowService.getFlowProgress(requisition.id);
      expect(progress.currentStage).toBe('COMPLETED');
      expect(progress.processingHistory.length).toBeGreaterThan(0);
      expect(progress.isBlocked).toBe(false);
    });
  });

  describe('Safety Interval Rules', () => {
    test('should reject requisition when safety interval is violated', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 85)
      });

      const submitted = await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      const intervalCheckResult = await approvalFlowService.autoProcessIntervalCheck(requisition.id);
      expect(intervalCheckResult.passed).toBe(false);
      expect(intervalCheckResult.violations.length).toBeGreaterThan(0);
    });

    test('should reject when max applications per season exceeded', async () => {
      const now = new Date();

      for (let i = 0; i < 3; i++) {
        const pastReq = store.requisitionsStore().create({
          applicantId: 'user-past',
          applicantName: '历史用户',
          department: '历史部门',
          intendedUseDate: addDays(now, -25 + i * 7),
          status: 'FULFILLED',
          currentStage: 'COMPLETED',
          totalItems: 1,
          totalQuantity: 5,
          rejectionReason: null,
          lastProcessedById: 'system',
          lastProcessedAt: addDays(now, -25 + i * 7)
        });

        store.requisitionItemsStore().create({
          requisitionId: pastReq.id,
          pesticideId,
          pesticideName: '测试农药A',
          quantity: 5,
          unit: 'KG',
          usagePurpose: '历史使用',
          dosagePerUnitArea: '20g/亩',
          plotId,
          plotName: '测试地块1号',
          cropId,
          cropName: '测试作物',
          applicationMethod: '喷雾',
          expectedApplicationDate: addDays(now, -25 + i * 7)
        });
      }

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      const submitted = await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      const intervalCheckResult = await approvalFlowService.autoProcessIntervalCheck(requisition.id);
      expect(intervalCheckResult.passed).toBe(false);
    });
  });

  describe('Inventory Management', () => {
    test('should reject when inventory is insufficient', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 200,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      const submitted = await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'INTERVAL_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      const inventoryCheckResult = await approvalFlowService.autoProcessInventoryCheck(requisition.id);
      expect(inventoryCheckResult.passed).toBe(false);
      expect(inventoryCheckResult.shortfalls.length).toBeGreaterThan(0);
    });

    test('should deduct inventory after approval', async () => {
      const now = new Date();
      const initialQuantity = 100;
      const deductQuantity = 50;

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: deductQuantity,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      const submitted = await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'INTERVAL_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'INVENTORY_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'SUPERVISOR_APPROVAL',
        'APPROVE',
        { processorId: 'supervisor-001', processorName: '主管' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'FINAL_APPROVAL',
        'APPROVE',
        { processorId: 'manager-001', processorName: '经理' }
      );

      const deductResult = await inventoryService.deductInventory({
        requisitionId: requisition.id,
        operatorId: 'warehouse-001',
        operatorName: '仓管员'
      });

      expect(deductResult.success).toBe(true);
      expect(deductResult.deductions.length).toBeGreaterThan(0);

      const remainingQuantity = await inventoryService.getTotalQuantity(pesticideId);
      expect(remainingQuantity).toBe(initialQuantity - deductQuantity);
    });
  });

  describe('Flow Progress and History', () => {
    test('should track flow progress with current checkpoint and previous record', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      const progress1 = await approvalFlowService.getFlowProgress(requisition.id);
      expect(progress1.currentStage).toBe('PLOT_VERIFICATION');
      expect(progress1.currentStatus).toBe('PENDING_APPROVAL');
      expect(progress1.lastRecord?.action).toBe('SUBMIT');
      expect(progress1.nextStages).toContain('INTERVAL_CHECK');

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      const progress2 = await approvalFlowService.getFlowProgress(requisition.id);
      expect(progress2.currentStage).toBe('INTERVAL_CHECK');
      expect(progress2.lastRecord?.action).toBe('APPROVE');
      expect(progress2.lastRecord?.stage).toBe('PLOT_VERIFICATION');
      expect(progress2.previousRecord?.action).toBe('SUBMIT');
    });

    test('should show block reason when rejected', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'REJECT',
        { processorId: 'system', processorName: '系统', comments: '测试拒绝原因' }
      );

      const progress = await approvalFlowService.getFlowProgress(requisition.id);
      expect(progress.isBlocked).toBe(true);
      expect(progress.blockReason).toContain('测试拒绝原因');
      expect(progress.currentStage).toBe('PLOT_VERIFICATION');
    });
  });

  describe('Supervisor Ledger', () => {
    test('should generate ledger with compliance checkpoints', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'INTERVAL_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'INVENTORY_CHECK',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'SUPERVISOR_APPROVAL',
        'APPROVE',
        { processorId: 'supervisor-001', processorName: '主管' }
      );

      await approvalFlowService.processStage(
        requisition.id,
        'FINAL_APPROVAL',
        'APPROVE',
        { processorId: 'manager-001', processorName: '经理' }
      );

      const ledger = await ledgerService.generateLedger({
        requisitionId: requisition.id,
        operatorId: 'regulatory-001',
        operatorName: '监管员'
      });

      expect(ledger).toBeDefined();
      expect(ledger.ledgerNumber).toBeDefined();
      expect(ledger.checkpoints.length).toBeGreaterThan(0);
      expect(ledger.checkpoints.map(c => c.name)).toContain('地块验证');
      expect(ledger.checkpoints.map(c => c.name)).toContain('间隔期规则');
      expect(ledger.checkpoints.map(c => c.name)).toContain('库存检查');
      expect(ledger.checkpoints.map(c => c.name)).toContain('审批流程');
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistent state across all operations', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      const detailBefore = await requisitionService.getById(requisition.id);
      expect(detailBefore.items.length).toBe(0);
      expect(detailBefore.totalItems).toBe(0);

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      });

      const detailAfter = await requisitionService.getById(requisition.id);
      expect(detailAfter.items.length).toBe(1);
      expect(detailAfter.totalItems).toBe(1);
      expect(detailAfter.totalQuantity).toBe(5);
    });

    test('should create violation records when compliance check fails', async () => {
      const now = new Date();

      const requisition = await requisitionService.createRequisition({
        applicantId: 'user-001',
        applicantName: '测试用户',
        department: '测试部门',
        intendedUseDate: addDays(now, 3)
      });

      await requisitionService.addItem(requisition.id, {
        pesticideId,
        quantity: 5,
        unit: 'KG',
        usagePurpose: '测试使用',
        dosagePerUnitArea: '20g/亩',
        plotId,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 85)
      });

      await requisitionService.submit(requisition.id, {
        processorId: 'user-001',
        processorName: '测试用户'
      });

      await approvalFlowService.processStage(
        requisition.id,
        'PLOT_VERIFICATION',
        'APPROVE',
        { processorId: 'system', processorName: '系统' }
      );

      await approvalFlowService.autoProcessIntervalCheck(requisition.id);

      const violations = store.violationRecordsStore().findByRequisitionId(requisition.id);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].isResolved).toBe(false);
    });
  });
});
