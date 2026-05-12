import { equipmentService, BusinessError } from './equipmentService';
import { templateService } from './templateService';
import { inspectionService } from './inspectionService';
import { exceptionService } from './exceptionService';
import { historyRepository } from '../repositories/historyRepository';
import { 
  EquipmentStatus, CheckType, ItemType, InspectionStatus, 
  ExceptionStatus, DowntimeStatus, MaintenanceStatus, RecheckStatus 
} from '../models';

const operator = { id: 'test-operator', name: '测试操作员' };

async function createEquipmentWithTemplate(
  name: string, 
  code: string, 
  items: Array<{ name: string; itemType: ItemType; standard: string; method: string; sortOrder: number }>
) {
  const equipment = await equipmentService.create({
    name,
    code,
    location: '车间A',
    type: 'CNC',
    status: EquipmentStatus.RUNNING
  }, operator);

  const template = await templateService.createTemplate({
    equipmentId: equipment.id,
    checkType: CheckType.DAILY,
    name: '日常点检模板'
  }, operator);

  for (const item of items) {
    await templateService.addItem({
      templateId: template.id,
      ...item
    }, operator);
  }

  const templateItems = await templateService.getItemsByTemplate(template.id);

  return { equipment, template, templateItems };
}

describe('生产设备点检 API - 核心业务规则测试', () => {
  
  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    delete require.cache[require.resolve('../database')];
  });

  describe('规则1: 同一班次重复点检被拒绝', () => {
    test('同一设备同一班次同一天只能创建一次点检', async () => {
      const { equipment, template } = await createEquipmentWithTemplate('测试设备1', 'EQ-001', [
        { name: '温度检查', itemType: ItemType.NORMAL, standard: '< 80°C', method: '测温枪', order: 1 }
      ]);

      await inspectionService.create({
        equipmentId: equipment.id,
        templateId: template.id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      await expect(
        inspectionService.create({
          equipmentId: equipment.id,
          templateId: template.id,
          shift: '白班',
          shiftDate: '2025-07-01'
        }, operator)
      ).rejects.toThrow(expect.objectContaining({
        code: 'DUPLICATE_SHIFT_INSPECTION'
      }));
    });
  });

  describe('规则2: 关键项异常触发设备状态变化', () => {
    test('发现关键项异常时，设备状态变为 ABNORMAL', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备2', 'EQ-002', [
        { name: '主轴转速', itemType: ItemType.KEY, standard: '稳定', method: '观察', order: 1 }
      ]);

      const keyItem = templateItems[0];

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      await inspectionService.checkItem(inspection.id, {
        itemId: keyItem.id,
        actualValue: '8000',
        isNormal: false,
        remark: '主轴异响'
      }, operator);

      const updatedEquipment = await equipmentService.getById(equipment.id);
      expect(updatedEquipment?.status).toBe(EquipmentStatus.ABNORMAL);

      const updatedInspection = await inspectionService.getById(inspection.id);
      expect(updatedInspection?.status).toBe(InspectionStatus.EXCEPTION);
    });
  });

  describe('规则3: 维修未完成不能关闭点检', () => {
    test('存在未解决异常时不能关闭点检', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备3', 'EQ-003', [
        { name: '油压', itemType: ItemType.NORMAL, standard: '5-8MPa', method: '目视', order: 1 }
      ]);

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      await inspectionService.checkItem(inspection.id, {
        itemId: templateItems[0].id,
        actualValue: '3MPa',
        isNormal: false,
        remark: '油压过低'
      }, operator);

      await expect(
        inspectionService.close(inspection.id, operator)
      ).rejects.toThrow(expect.objectContaining({
        code: 'UNRESOLVED_EXCEPTIONS'
      }));
    });

    test('点检未完成（非COMPLETED状态）不能关闭', async () => {
      const { equipment } = await createEquipmentWithTemplate('测试设备4', 'EQ-004', []);

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      await expect(
        inspectionService.close(inspection.id, operator)
      ).rejects.toThrow(expect.objectContaining({
        code: 'INCOMPLETE_INSPECTION'
      }));
    });
  });

  describe('规则4: 完整闭环流程 - 关键异常→停机→维修→复检→解决', () => {
    test('完整异常闭环流程验证', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备5', 'EQ-005', [
        { name: '主轴振动', itemType: ItemType.KEY, standard: '< 0.1mm', method: '振动仪', order: 1 }
      ]);

      expect(equipment.status).toBe(EquipmentStatus.RUNNING);
      const keyItem = templateItems[0];

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      const itemResult = await inspectionService.checkItem(inspection.id, {
        itemId: keyItem.id,
        actualValue: '0.5mm',
        isNormal: false,
        remark: '主轴振动异常'
      }, operator);

      let updatedEquipment = await equipmentService.getById(equipment.id);
      expect(updatedEquipment?.status).toBe(EquipmentStatus.ABNORMAL);

      const exception = await exceptionService.reportException({
        inspectionId: inspection.id,
        itemResultId: itemResult.id,
        description: '主轴振动超过标准值',
        level: 'CRITICAL'
      }, operator);

      expect(exception.status).toBe(ExceptionStatus.DETECTED);

      const downtime = await exceptionService.createDowntime({
        equipmentId: equipment.id,
        exceptionId: exception.id,
        inspectionId: inspection.id,
        reason: '主轴振动异常，需要停机检修'
      }, operator);

      updatedEquipment = await equipmentService.getById(equipment.id);
      expect(updatedEquipment?.status).toBe(EquipmentStatus.STOPPED);
      expect(downtime.status).toBe(DowntimeStatus.IN_PROGRESS);

      const maintenance = await exceptionService.assignMaintenance({
        exceptionId: exception.id,
        assigneeId: 'maintainer-001',
        assigneeName: '维修工程师A',
        priority: 'HIGH',
        description: '更换主轴轴承'
      }, operator);

      expect(maintenance.status).toBe(MaintenanceStatus.ASSIGNED);

      await exceptionService.startMaintenance(maintenance.id, { id: 'maintainer-001', name: '维修工程师A' });

      const startedMaintenance = await exceptionService.getMaintenanceById(maintenance.id);
      expect(startedMaintenance?.status).toBe(MaintenanceStatus.IN_PROGRESS);

      await exceptionService.completeMaintenance(
        maintenance.id, 
        '已更换主轴轴承，振动值恢复正常', 
        { id: 'maintainer-001', name: '维修工程师A' }
      );

      const completedMaintenance = await exceptionService.getMaintenanceById(maintenance.id);
      expect(completedMaintenance?.status).toBe(MaintenanceStatus.COMPLETED);

      const updatedException = await exceptionService.getExceptionById(exception.id);
      expect(updatedException?.status).toBe(ExceptionStatus.MAINTENANCE_COMPLETED);

      await exceptionService.recheck({
        exceptionId: exception.id,
        result: RecheckStatus.PASSED,
        remark: '主轴振动值0.08mm，符合标准'
      }, operator);

      const resolvedException = await exceptionService.getExceptionById(exception.id);
      expect(resolvedException?.status).toBe(ExceptionStatus.RESOLVED);

      updatedEquipment = await equipmentService.getById(equipment.id);
      expect(updatedEquipment?.status).toBe(EquipmentStatus.RUNNING);

      await exceptionService.endDowntime(downtime.id, operator);
      const endedDowntime = await exceptionService.getAllDowntime({ equipmentId: equipment.id });
      expect(endedDowntime[0].status).toBe(DowntimeStatus.COMPLETED);
    });
  });

  describe('规则5: 复检失败可重新派工', () => {
    test('复检失败后状态变为 RECHECK_FAILED，可重新派工', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备6', 'EQ-006', [
        { name: '润滑系统', itemType: ItemType.KEY, standard: '正常', method: '目视', order: 1 }
      ]);

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      const itemResult = await inspectionService.checkItem(inspection.id, {
        itemId: templateItems[0].id,
        actualValue: '异常',
        isNormal: false,
        remark: '油路堵塞'
      }, operator);

      const exception = await exceptionService.reportException({
        inspectionId: inspection.id,
        itemResultId: itemResult.id,
        description: '油路堵塞需要疏通',
        level: 'HIGH'
      }, operator);

      const maintenance = await exceptionService.assignMaintenance({
        exceptionId: exception.id,
        assigneeId: 'maintainer-001',
        assigneeName: '维修工程师A',
        priority: 'HIGH',
        description: '疏通油路'
      }, operator);

      await exceptionService.startMaintenance(maintenance.id, { id: 'maintainer-001', name: '维修工程师A' });
      await exceptionService.completeMaintenance(maintenance.id, '已疏通油路', { id: 'maintainer-001', name: '维修工程师A' });

      await exceptionService.recheck({
        exceptionId: exception.id,
        result: RecheckStatus.FAILED,
        remark: '仍有漏油现象'
      }, operator);

      const failedException = await exceptionService.getExceptionById(exception.id);
      expect(failedException?.status).toBe(ExceptionStatus.RECHECK_FAILED);

      const secondMaintenance = await exceptionService.assignMaintenance({
        exceptionId: exception.id,
        assigneeId: 'maintainer-002',
        assigneeName: '维修工程师B',
        priority: 'HIGH',
        description: '更换密封圈'
      }, operator);

      expect(secondMaintenance.status).toBe(MaintenanceStatus.ASSIGNED);

      await exceptionService.startMaintenance(secondMaintenance.id, { id: 'maintainer-002', name: '维修工程师B' });
      await exceptionService.completeMaintenance(secondMaintenance.id, '已更换密封圈，无漏油', { id: 'maintainer-002', name: '维修工程师B' });

      await exceptionService.recheck({
        exceptionId: exception.id,
        result: RecheckStatus.PASSED,
        remark: '检查确认无漏油'
      }, operator);

      const resolvedException = await exceptionService.getExceptionById(exception.id);
      expect(resolvedException?.status).toBe(ExceptionStatus.RESOLVED);
    });
  });

  describe('规则6: 幂等性保证 - 重复请求返回相同结果', () => {
    test('使用相同的 idempotentKey 多次创建点检只创建一次', async () => {
      const { equipment } = await createEquipmentWithTemplate('测试设备7', 'EQ-007', []);

      const idempotentKey = 'inspection-' + Date.now();

      const inspection1 = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01',
        idempotentKey
      }, operator);

      const inspection2 = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01',
        idempotentKey
      }, operator);

      expect(inspection1.id).toBe(inspection2.id);
    });

    test('重复完成维修只执行一次', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备8', 'EQ-008', [
        { name: '电机', itemType: ItemType.NORMAL, standard: '正常', method: '目视', order: 1 }
      ]);

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      const itemResult = await inspectionService.checkItem(inspection.id, {
        itemId: templateItems[0].id,
        actualValue: '异常',
        isNormal: false,
        remark: '电机异常'
      }, operator);

      const exception = await exceptionService.reportException({
        inspectionId: inspection.id,
        itemResultId: itemResult.id,
        description: '电机异常',
        level: 'HIGH'
      }, operator);

      const maintenance = await exceptionService.assignMaintenance({
        exceptionId: exception.id,
        assigneeId: 'maintainer-001',
        assigneeName: '维修工程师A',
        priority: 'HIGH',
        description: '检查电机'
      }, operator);

      await exceptionService.startMaintenance(maintenance.id, { id: 'maintainer-001', name: '维修工程师A' });

      const completed1 = await exceptionService.completeMaintenance(
        maintenance.id, 
        '已修复电机', 
        { id: 'maintainer-001', name: '维修工程师A' }
      );

      const completed2 = await exceptionService.completeMaintenance(
        maintenance.id, 
        '已修复电机', 
        { id: 'maintainer-001', name: '维修工程师A' }
      );

      expect(completed1.completedAt).toBe(completed2.completedAt);
    });
  });

  describe('规则7: 人工修正必须记录前后差异和操作者', () => {
    test('人工修正操作会在历史记录中保存详细信息', async () => {
      await exceptionService.manualCorrection(
        'INSPECTION',
        'test-inspection-id',
        {
          field: 'status',
          oldValue: InspectionStatus.EXCEPTION,
          newValue: InspectionStatus.COMPLETED,
          reason: '管理层特批，需记录原因'
        },
        { id: 'manager-001', name: '张经理' }
      );

      const histories = await historyRepository.findAll({
        entityType: 'INSPECTION'
      });

      expect(histories.length).toBeGreaterThan(0);
      const correction = histories.find(h => h.action === 'MANUAL_CORRECTION');
      
      expect(correction).toBeDefined();
      expect(correction?.operatorId).toBe('manager-001');
      expect(correction?.operatorName).toBe('张经理');
      expect(correction?.reason).toBe('管理层特批，需记录原因');

      const changes = JSON.parse(correction?.changes || '{}');
      expect(changes.field).toBe('status');
      expect(changes.oldValue).toBe(InspectionStatus.EXCEPTION);
      expect(changes.newValue).toBe(InspectionStatus.COMPLETED);
    });
  });

  describe('规则8: 正常点检无异常流程', () => {
    test('所有项目正常可完成并关闭点检', async () => {
      const { equipment, templateItems } = await createEquipmentWithTemplate('测试设备9', 'EQ-009', [
        { name: '温度', itemType: ItemType.NORMAL, standard: '< 80°C', method: '测温枪', order: 1 },
        { name: '压力', itemType: ItemType.NORMAL, standard: '5-8MPa', method: '压力表', order: 2 }
      ]);

      const inspection = await inspectionService.create({
        equipmentId: equipment.id,
        templateId: (await templateService.getTemplatesByEquipment(equipment.id))[0].id,
        shift: '白班',
        shiftDate: '2025-07-01'
      }, operator);

      for (const item of templateItems) {
        await inspectionService.checkItem(inspection.id, {
          itemId: item.id,
          actualValue: item.itemType === ItemType.KEY ? '正常' : '75°C',
          isNormal: true
        }, operator);
      }

      const completed = await inspectionService.complete(inspection.id, operator);
      expect(completed.status).toBe(InspectionStatus.COMPLETED);

      const closed = await inspectionService.close(inspection.id, operator);
      expect(closed.status).toBe(InspectionStatus.CLOSED);

      const finalEquipment = await equipmentService.getById(equipment.id);
      expect(finalEquipment?.status).toBe(EquipmentStatus.RUNNING);
    });
  });
});
