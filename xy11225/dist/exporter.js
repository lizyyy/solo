"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReport = exportReport;
const csv_writer_1 = require("csv-writer");
async function exportReport(records, filePath) {
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filePath,
        header: [
            { id: 'id', title: '记录ID' },
            { id: 'cabinetId', title: '柜子ID' },
            { id: 'faultType', title: '故障类型' },
            { id: 'description', title: '故障描述' },
            { id: 'reporter', title: '上报人' },
            { id: 'handler', title: '处理人' },
            { id: 'status', title: '状态' },
            { id: 'isOffline', title: '柜子离线' },
            { id: 'processingResult', title: '处理结果' },
            { id: 'processingReason', title: '处理原因' },
            { id: 'createdAt', title: '创建时间' },
            { id: 'updatedAt', title: '更新时间' },
            { id: 'resolvedAt', title: '解决时间' },
            { id: 'mergedFrom', title: '合并自' }
        ]
    });
    const recordsForCsv = records.map(r => ({
        id: r.id,
        cabinetId: r.cabinetId,
        faultType: r.faultType,
        description: r.description,
        reporter: r.reporter,
        handler: r.handler || '',
        status: r.status,
        isOffline: r.isOffline ? '是' : '否',
        processingResult: r.processingResult || '',
        processingReason: r.processingReason || '',
        createdAt: new Date(r.createdAt).toLocaleString('zh-CN'),
        updatedAt: new Date(r.updatedAt).toLocaleString('zh-CN'),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toLocaleString('zh-CN') : '',
        mergedFrom: (r.mergedFrom || []).join(', ')
    }));
    await csvWriter.writeRecords(recordsForCsv);
}
