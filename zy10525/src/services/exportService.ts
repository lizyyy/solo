import { Parser } from 'json2csv';
import { GrayConfigRecycle, RecycleStatus } from '../types';

export class ExportService {
  exportToCSV(records: GrayConfigRecycle[]): string {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '配置键', value: 'configKey' },
      { label: '灰度范围类型', value: 'grayScope.type' },
      { label: '灰度范围值', value: (record: GrayConfigRecycle) => 
        Array.isArray(record.grayScope.value) 
          ? record.grayScope.value.join(',') 
          : record.grayScope.value 
      },
      { label: '负责人', value: 'owner' },
      { label: '回收日期', value: (record: GrayConfigRecycle) => record.recycleDate.toISOString() },
      { label: '命中租户数量', value: (record: GrayConfigRecycle) => record.hitTenants.length },
      { label: '命中租户', value: (record: GrayConfigRecycle) => record.hitTenants.join(',') },
      { label: '状态', value: 'status' },
      { label: '提醒次数', value: 'remindersSent' },
      { label: '创建时间', value: (record: GrayConfigRecycle) => record.createdAt.toISOString() },
      { label: '更新时间', value: (record: GrayConfigRecycle) => record.updatedAt.toISOString() },
      { label: '回收成功数', value: (record: GrayConfigRecycle) => record.report?.recycledCount || 0 },
      { label: '回收失败数', value: (record: GrayConfigRecycle) => record.report?.failedCount || 0 },
      { label: '异常数量', value: (record: GrayConfigRecycle) => record.exceptions.length }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(records);
  }

  exportStatistics(records: GrayConfigRecycle[]): string {
    const stats = {
      total: records.length,
      pending: records.filter(r => r.status === RecycleStatus.PENDING).length,
      inProgress: records.filter(r => r.status === RecycleStatus.IN_PROGRESS).length,
      completed: records.filter(r => r.status === RecycleStatus.COMPLETED).length,
      cancelled: records.filter(r => r.status === RecycleStatus.CANCELLED).length,
      expired: records.filter(r => r.status === RecycleStatus.EXPIRED).length,
      error: records.filter(r => r.status === RecycleStatus.ERROR).length,
      totalTenants: records.reduce((sum, r) => sum + r.hitTenants.length, 0),
      totalRecycled: records.reduce((sum, r) => sum + (r.report?.recycledCount || 0), 0)
    };

    const fields = [
      { label: '指标', value: 'label' },
      { label: '数值', value: 'value' }
    ];

    const data = [
      { label: '总记录数', value: stats.total },
      { label: '待处理', value: stats.pending },
      { label: '进行中', value: stats.inProgress },
      { label: '已完成', value: stats.completed },
      { label: '已取消', value: stats.cancelled },
      { label: '已过期', value: stats.expired },
      { label: '异常', value: stats.error },
      { label: '总命中租户数', value: stats.totalTenants },
      { label: '总回收成功数', value: stats.totalRecycled }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }
}

export const exportService = new ExportService();
