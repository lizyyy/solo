import { exportService } from './ExportService';
import { queueService } from './QueueService';
import { queueStore } from '../store/QueueStore';
import { QueueStatus, RecordStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

describe('ExportService', () => {
  beforeEach(() => {
    queueStore.clearAll();
    const exportDir = path.join(process.cwd(), 'exports');
    if (fs.existsSync(exportDir)) {
      fs.readdirSync(exportDir).forEach(file => {
        fs.unlinkSync(path.join(exportDir, file));
      });
    }
  });

  test('导出口径一致 - 包含所有核心字段', async () => {
    queueService.createQueueRecord({
      visitor: { id: 'v001', name: '张三', phone: '13800138001', email: 'zhangsan@test.com', businessObject: '订单咨询' },
      skillGroupId: 'sg001',
      skillGroupName: '客服一组',
      overflowTargetId: 'sg002',
      overflowTargetName: '客服二组',
      operatorId: 'op001',
      operatorName: '李主管'
    });

    const filePath = await exportService.exportToCsv({});
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('记录ID');
    expect(content).toContain('访客ID');
    expect(content).toContain('访客姓名');
    expect(content).toContain('技能组ID');
    expect(content).toContain('技能组名称');
    expect(content).toContain('溢出目标ID');
    expect(content).toContain('溢出目标名称');
    expect(content).toContain('当前状态');
    expect(content).toContain('记录状态');
    expect(content).toContain('排队时长(秒)');
    expect(content).toContain('业务对象');
    expect(content).toContain('是否溢出占位');
    expect(content).toContain('状态变更次数');
    expect(content).toContain('最后状态变更时间');
  });

  test('导出数据与列表、详情、历史互相对齐', async () => {
    const record = queueService.createQueueRecord({
      visitor: { id: 'v002', name: '李四' },
      skillGroupId: 'sg001',
      skillGroupName: '客服一组'
    });

    queueService.updateStatus(record.id, QueueStatus.CONNECTED, 'op001', '李主管', '测试接入');

    const detailRecord = queueService.getQueueRecord(record.id);
    const historyList = queueService.getStatusHistory(record.id);
    const listRecords = queueService.queryRecords({}).data;

    const filePath = await exportService.exportToCsv({});
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain(record.id);
    expect(content).toContain('v002');
    expect(content).toContain('李四');
    expect(content).toContain('已接入');
    expect(content).toContain('已完成');
    expect(content).toContain('2');

    expect(detailRecord?.id).toBe(listRecords[0].id);
    expect(detailRecord?.visitor.id).toBe(listRecords[0].visitor.id);
    expect(historyList.length).toBe(2);
  });

  test('导入坏行检测', async () => {
    const testData = [
      { visitorId: 'v001', visitorName: '张三', skillGroupId: 'sg001', skillGroupName: '客服一组' },
      { visitorId: '', visitorName: '', skillGroupId: '', skillGroupName: '' },
      { visitorId: 'v003', skillGroupId: 'sg001', skillGroupName: '客服一组' },
      { visitorId: 'v004', visitorName: '赵六' }
    ];

    const result = await exportService.importFromJson(testData);

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(3);
    expect(result.errors.length).toBe(3);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toContain('访客ID不能为空');
  });
});