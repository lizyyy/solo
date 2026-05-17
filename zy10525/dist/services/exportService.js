"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const json2csv_1 = require("json2csv");
const types_1 = require("../types");
class ExportService {
    exportToCSV(records) {
        const fields = [
            { label: 'ID', value: 'id' },
            { label: '配置键', value: 'configKey' },
            { label: '灰度范围类型', value: 'grayScope.type' },
            { label: '灰度范围值', value: (record) => Array.isArray(record.grayScope.value)
                    ? record.grayScope.value.join(',')
                    : record.grayScope.value
            },
            { label: '负责人', value: 'owner' },
            { label: '回收日期', value: (record) => record.recycleDate.toISOString() },
            { label: '命中租户数量', value: (record) => record.hitTenants.length },
            { label: '命中租户', value: (record) => record.hitTenants.join(',') },
            { label: '状态', value: 'status' },
            { label: '提醒次数', value: 'remindersSent' },
            { label: '创建时间', value: (record) => record.createdAt.toISOString() },
            { label: '更新时间', value: (record) => record.updatedAt.toISOString() },
            { label: '回收成功数', value: (record) => record.report?.recycledCount || 0 },
            { label: '回收失败数', value: (record) => record.report?.failedCount || 0 },
            { label: '异常数量', value: (record) => record.exceptions.length }
        ];
        const json2csvParser = new json2csv_1.Parser({ fields });
        return json2csvParser.parse(records);
    }
    exportStatistics(records) {
        const stats = {
            total: records.length,
            pending: records.filter(r => r.status === types_1.RecycleStatus.PENDING).length,
            inProgress: records.filter(r => r.status === types_1.RecycleStatus.IN_PROGRESS).length,
            completed: records.filter(r => r.status === types_1.RecycleStatus.COMPLETED).length,
            cancelled: records.filter(r => r.status === types_1.RecycleStatus.CANCELLED).length,
            expired: records.filter(r => r.status === types_1.RecycleStatus.EXPIRED).length,
            error: records.filter(r => r.status === types_1.RecycleStatus.ERROR).length,
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
        const json2csvParser = new json2csv_1.Parser({ fields });
        return json2csvParser.parse(data);
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
