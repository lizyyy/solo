import { queueService } from './QueueService';
import { queueStore } from '../store/QueueStore';
import { QueueStatus, RecordStatus } from '../types';

describe('QueueService', () => {
  beforeEach(() => {
    queueStore.clearAll();
  });

  describe('核心业务场景测试', () => {
    test('场景1：访客溢出后原队列仍占位', () => {
      const originalRecord = queueService.createQueueRecord({
        visitor: { id: 'v001', name: '张三', businessObject: '订单咨询' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组',
        overflowTargetId: 'sg002',
        overflowTargetName: '客服二组',
        operatorId: 'op001',
        operatorName: '李主管'
      });

      expect(originalRecord.status).toBe(QueueStatus.QUEUING);
      expect(originalRecord.overflowTargetId).toBe('sg002');

      const result = queueService.processOverflow(originalRecord.id, 'op001', '李主管');

      expect(result.originalRecord).not.toBeNull();
      expect(result.originalRecord?.status).toBe(QueueStatus.OVERFLOWING);
      expect(result.originalRecord?.skillGroupId).toBe('sg001');

      expect(result.placeholderRecord).not.toBeNull();
      expect(result.placeholderRecord?.status).toBe(QueueStatus.OVERFLOWING);
      expect(result.placeholderRecord?.skillGroupId).toBe('sg002');
      expect(result.placeholderRecord?.isOverflowPlaceholder).toBe(true);

      const originalHistory = queueService.getStatusHistory(originalRecord.id);
      expect(originalHistory.length).toBe(2);
      expect(originalHistory[1].reason).toContain('原技能组溢出');

      const placeholderHistory = queueService.getStatusHistory(result.placeholderRecord!.id);
      expect(placeholderHistory.length).toBe(1);
      expect(placeholderHistory[0].reason).toContain('溢出到目标技能组');
    });

    test('场景2：重复请求处理', () => {
      const firstRecord = queueService.createQueueRecord({
        visitor: { id: 'v002', name: '李四', businessObject: '投诉建议' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组',
        operatorId: 'op001',
        operatorName: '李主管'
      });

      expect(firstRecord.recordStatus).toBe(RecordStatus.SUCCESS);
      expect(firstRecord.status).toBe(QueueStatus.QUEUING);

      const secondRecord = queueService.createQueueRecord({
        visitor: { id: 'v002', name: '李四', businessObject: '投诉建议' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组',
        operatorId: 'op001',
        operatorName: '李主管'
      });

      expect(secondRecord.recordStatus).toBe(RecordStatus.CONFLICT);
      expect(secondRecord.status).toBe(QueueStatus.QUEUING);

      const queryResult = queueService.queryRecords({ visitorId: 'v002' });
      expect(queryResult.total).toBe(2);
    });

    test('场景3：撤回后再提交', () => {
      const record = queueService.createQueueRecord({
        visitor: { id: 'v003', name: '王五', businessObject: '技术支持' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组',
        operatorId: 'op002',
        operatorName: '王专员'
      });

      expect(record.status).toBe(QueueStatus.QUEUING);

      const withdrawnRecord = queueService.withdrawQueueRecord(record.id, 'op002', '王专员');
      expect(withdrawnRecord).not.toBeNull();
      expect(withdrawnRecord?.status).toBe(QueueStatus.ABANDONED);

      const historyAfterWithdraw = queueService.getStatusHistory(record.id);
      expect(historyAfterWithdraw.length).toBe(2);
      expect(historyAfterWithdraw[1].reason).toContain('用户撤回排队');
      expect(historyAfterWithdraw[1].newStatus).toBe(QueueStatus.ABANDONED);

      const resubmittedRecord = queueService.resubmitQueueRecord(record.id, 'op002', '王专员');
      expect(resubmittedRecord).not.toBeNull();
      expect(resubmittedRecord?.status).toBe(QueueStatus.QUEUING);
      expect(resubmittedRecord?.abandonedTime).toBeUndefined();
      expect(resubmittedRecord?.queueDurationSeconds).toBe(0);

      const historyAfterResubmit = queueService.getStatusHistory(record.id);
      expect(historyAfterResubmit.length).toBe(3);
      expect(historyAfterResubmit[2].reason).toContain('撤回后重新提交排队');
      expect(historyAfterResubmit[2].previousStatus).toBe(QueueStatus.ABANDONED);
      expect(historyAfterResubmit[2].newStatus).toBe(QueueStatus.QUEUING);
    });
  });

  describe('四类记录状态测试', () => {
    test('状态1：成功（SUCCESS）', () => {
      const record = queueService.createQueueRecord({
        visitor: { id: 'v101', name: '赵六' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组'
      });

      expect(record.recordStatus).toBe(RecordStatus.SUCCESS);
    });

    test('状态2：冲突（CONFLICT）', () => {
      queueService.createQueueRecord({
        visitor: { id: 'v102', name: '钱七' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组'
      });

      const conflictRecord = queueService.createQueueRecord({
        visitor: { id: 'v102', name: '钱七' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组'
      });

      expect(conflictRecord.recordStatus).toBe(RecordStatus.CONFLICT);
    });

    test('状态3：驳回（REJECTED）', () => {
      const record = queueService.createQueueRecord({
        visitor: { id: 'v103', name: '孙八' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组'
      });

      const rejectedRecord = queueService.rejectRecord(
        record.id,
        'op003',
        '张经理',
        '信息不完整，需要补充'
      );

      expect(rejectedRecord).not.toBeNull();
      expect(rejectedRecord?.recordStatus).toBe(RecordStatus.REJECTED);
      expect(rejectedRecord?.status).toBe(QueueStatus.ABANDONED);
    });

    test('状态4：已完成（COMPLETED）', () => {
      const record = queueService.createQueueRecord({
        visitor: { id: 'v104', name: '周九' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组'
      });

      const completedRecord = queueService.updateStatus(
        record.id,
        QueueStatus.CONNECTED,
        'op004',
        '刘客服',
        '客户已接入'
      );

      expect(completedRecord).not.toBeNull();
      expect(completedRecord?.recordStatus).toBe(RecordStatus.COMPLETED);
      expect(completedRecord?.status).toBe(QueueStatus.CONNECTED);
      expect(completedRecord?.connectedTime).toBeDefined();
    });
  });

  describe('筛选功能测试', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        queueService.createQueueRecord({
          visitor: { id: `v${i}`, name: `访客${i}` },
          skillGroupId: i < 3 ? 'sg001' : 'sg002',
          skillGroupName: i < 3 ? '客服一组' : '客服二组',
          businessObject: i < 2 ? '订单咨询' : '投诉建议'
        });
      }
    });

    test('按技能组筛选', () => {
      const result = queueService.queryRecords({ skillGroupId: 'sg001' });
      expect(result.total).toBe(3);
    });

    test('按业务对象筛选', () => {
      const result = queueService.queryRecords({ businessObject: '订单咨询' });
      expect(result.total).toBe(2);
    });

    test('按状态筛选', () => {
      queueService.updateStatus(
        queueService.queryRecords({}).data[0].id,
        QueueStatus.CONNECTED
      );

      const result = queueService.queryRecords({ status: QueueStatus.CONNECTED });
      expect(result.total).toBe(1);
    });

    test('按记录状态筛选', () => {
      queueService.rejectRecord(queueService.queryRecords({}).data[0].id);
      
      const result = queueService.queryRecords({ recordStatus: RecordStatus.REJECTED });
      expect(result.total).toBe(1);
    });

    test('分页查询', () => {
      const result = queueService.queryRecords({ page: 1, pageSize: 2 });
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(5);
    });
  });

  describe('状态历史追踪测试', () => {
    test('每次状态变更都有完整历史记录', () => {
      const record = queueService.createQueueRecord({
        visitor: { id: 'v201', name: '吴十' },
        skillGroupId: 'sg001',
        skillGroupName: '客服一组',
        overflowTargetId: 'sg002',
        overflowTargetName: '客服二组'
      });

      let history = queueService.getStatusHistory(record.id);
      expect(history.length).toBe(1);
      expect(history[0].newStatus).toBe(QueueStatus.QUEUING);

      queueService.processOverflow(record.id);
      history = queueService.getStatusHistory(record.id);
      expect(history.length).toBe(2);
      expect(history[1].newStatus).toBe(QueueStatus.OVERFLOWING);
      expect(history[1].previousStatus).toBe(QueueStatus.QUEUING);

      queueService.withdrawQueueRecord(record.id);
      history = queueService.getStatusHistory(record.id);
      expect(history.length).toBe(3);
      expect(history[2].newStatus).toBe(QueueStatus.ABANDONED);
      expect(history[2].previousStatus).toBe(QueueStatus.OVERFLOWING);
    });
  });
});