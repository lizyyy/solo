import { Parser } from 'json2csv';
import { InspectionRecord, Device, Inspector, OperationHistory } from '../types';
import { DeviceModel } from '../models/Device';
import { InspectorModel } from '../models/Inspector';
import { InspectionRecordModel } from '../models/InspectionRecord';

export class ExportService {
  static async exportRecordsToCSV(params?: {
    status?: string;
    flowType?: string;
  }): Promise<string> {
    const { list: records } = await InspectionRecordModel.findAll(params as any);
    const devices = await DeviceModel.findAll();
    const inspectors = await InspectorModel.findAll();

    const deviceMap = new Map(devices.map(d => [d.id, d]));
    const inspectorMap = new Map(inspectors.map(i => [i.id, i]));

    const data = records.map(record => {
      const device = deviceMap.get(record.deviceId);
      const inspector = inspectorMap.get(record.inspectorId);
      
      return {
        '记录ID': record.id.substring(0, 8),
        '设备编码': device?.code || '-',
        '设备名称': device?.name || '-',
        '设备类型': device?.type || '-',
        '巡检人员': inspector?.name || '-',
        '所属部门': inspector?.department || '-',
        '计划巡检日期': record.planDate,
        '实际巡检日期': record.actualInspectionDate || '-',
        '补录日期': record.supplementDate || '-',
        '漏检发现日期': record.discoveredDate || '-',
        '补录原因': record.supplementReason || '-',
        '状态': this.translateStatus(record.status),
        '流程类型': this.translateFlowType(record.flowType),
        '备注': record.remarks || '-',
        '创建时间': record.createdAt
      };
    });

    const parser = new Parser();
    return parser.parse(data);
  }

  static async exportRecordDetailToCSV(recordId: string): Promise<string> {
    const record = await InspectionRecordModel.findById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const device = await DeviceModel.findById(record.deviceId);
    const inspector = await InspectorModel.findById(record.inspectorId);
    const history = await InspectionRecordModel.getHistory(recordId);

    const basicInfo = {
      '记录ID': record.id,
      '设备编码': device?.code || '-',
      '设备名称': device?.name || '-',
      '设备型号': device?.model || '-',
      '设备位置': device?.location || '-',
      '巡检人员': inspector?.name || '-',
      '员工编号': inspector?.employeeId || '-',
      '联系电话': inspector?.phone || '-',
      '计划巡检日期': record.planDate,
      '实际巡检日期': record.actualInspectionDate || '-',
      '补录日期': record.supplementDate || '-',
      '漏检发现日期': record.discoveredDate || '-',
      '补录原因': record.supplementReason || '-',
      '状态': this.translateStatus(record.status),
      '流程类型': this.translateFlowType(record.flowType),
      '备注': record.remarks || '-'
    };

    const inspectionResults = record.inspectionResults || {};
    const resultsData = Object.entries(inspectionResults).map(([key, value]) => ({
      '检查项': key,
      '检查结果': value
    }));

    const historyData = history.map(h => ({
      '操作时间': h.operationTime,
      '操作人': h.operatorName,
      '操作类型': this.translateOperationType(h.operationType),
      '原状态': h.previousStatus ? this.translateStatus(h.previousStatus) : '-',
      '新状态': this.translateStatus(h.newStatus),
      '备注': h.remarks || '-'
    }));

    const basicCSV = new Parser({ header: true }).parse([basicInfo]);
    const resultsCSV = resultsData.length > 0 ? '\n\n=== 检查项结果 ===\n' + new Parser().parse(resultsData) : '';
    const historyCSV = '\n\n=== 操作历史 ===\n' + new Parser().parse(historyData);

    return basicCSV + resultsCSV + historyCSV;
  }

  private static translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待巡检',
      'missed_pending': '漏检待补',
      'supplemented': '已补录',
      'confirmed': '已确认',
      'rejected': '已驳回',
      'manual_review': '人工复核'
    };
    return statusMap[status] || status;
  }

  private static translateFlowType(flowType: string): string {
    const flowMap: Record<string, string> = {
      'normal': '正常流',
      'rejection': '驳回流',
      'manual_review': '人工复核流'
    };
    return flowMap[flowType] || flowType;
  }

  private static translateOperationType(operationType: string): string {
    const operationMap: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'supplement': '补录提交',
      'confirm': '确认',
      'reject': '驳回',
      'submit_review': '提交复核',
      'approve_review': '复核通过'
    };
    return operationMap[operationType] || operationType;
  }
}
