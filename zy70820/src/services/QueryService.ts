import { Parser } from 'json2csv';
import { dataStore } from '../store/DataStore';
import { AppointmentRecord, RecordStatus, OperationType } from '../types';

interface QueryFilters {
  childId?: string;
  childIdCard?: string;
  childName?: string;
  vaccineCode?: string;
  batchId?: string;
  status?: RecordStatus;
  startDate?: string;
  endDate?: string;
  waitlistOrder?: number;
}

export class QueryService {
  queryRecords(filters: QueryFilters): AppointmentRecord[] {
    let records = dataStore.getAppointmentRecords();

    if (filters.childId) {
      records = records.filter(r => r.childId === filters.childId);
    }

    if (filters.childIdCard) {
      records = records.filter(r => r.childIdCard.includes(filters.childIdCard!));
    }

    if (filters.childName) {
      records = records.filter(r => r.childName.includes(filters.childName!));
    }

    if (filters.vaccineCode) {
      records = records.filter(r => r.vaccineCode === filters.vaccineCode);
    }

    if (filters.batchId) {
      records = records.filter(r => r.batchId === filters.batchId);
    }

    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }

    if (filters.startDate) {
      records = records.filter(r => r.appointmentDate >= filters.startDate!);
    }

    if (filters.endDate) {
      records = records.filter(r => r.appointmentDate <= filters.endDate!);
    }

    if (filters.waitlistOrder) {
      records = records.filter(r => r.waitlistOrder === filters.waitlistOrder);
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecordWithTraceability(recordId: string): {
    record: AppointmentRecord | undefined;
    traceability: Array<{
      status: string;
      timestamp: string;
      operator: string;
      reason: string | undefined;
      explanation: string;
    }>;
  } {
    const record = dataStore.getAppointmentRecordById(recordId);
    if (!record) {
      return { record: undefined, traceability: [] };
    }

    const traceability = record.operationLogs.map(log => ({
      status: log.newStatus || log.operationType,
      timestamp: log.timestamp,
      operator: log.operator,
      reason: log.reason,
      explanation: this.getExplanation(log.operationType, log.reason)
    }));

    return { record, traceability };
  }

  private getExplanation(operationType: OperationType, reason?: string): string {
    const explanations: Record<OperationType, string> = {
      [OperationType.IMPORT]: '记录从CSV文件导入系统',
      [OperationType.CREATE_BATCH]: '创建新的预约批次',
      [OperationType.MARK_PROCESSED]: '预约已完成接种',
      [OperationType.RETURN]: '记录被退回，需要补充材料或重新审核',
      [OperationType.EXPORT]: '记录已导出',
      [OperationType.WAITLIST]: '因疫苗库存不足，进入候补队列',
      [OperationType.CONTRAINDICATION_BLOCK]: '因存在接种禁忌症，预约被拒绝',
      [OperationType.DUPLICATE_BLOCK]: '因重复预约，预约被拒绝',
      [OperationType.APPROVE]: '审核通过，可以接种',
      [OperationType.REJECT]: '审核不通过，预约被拒绝'
    };

    let explanation = explanations[operationType] || '未知操作';
    if (reason) {
      explanation += `。原因: ${reason}`;
    }
    return explanation;
  }

  exportToCSV(records: AppointmentRecord[]): string {
    const fields = [
      { label: '记录ID', value: 'id' },
      { label: '批次ID', value: 'batchId' },
      { label: '儿童ID', value: 'childId' },
      { label: '儿童姓名', value: 'childName' },
      { label: '身份证号', value: 'childIdCard' },
      { label: '疫苗编码', value: 'vaccineCode' },
      { label: '疫苗名称', value: 'vaccineName' },
      { label: '剂次', value: 'doseNumber' },
      { label: '预约日期', value: 'appointmentDate' },
      { label: '状态', value: 'status' },
      { label: '候补顺序', value: 'waitlistOrder' },
      { label: '候补来源', value: 'waitlistSource' },
      { label: '拒绝/退回原因', value: 'blockReason' },
      { label: '处理人', value: 'processedBy' },
      { label: '处理时间', value: 'processedAt' },
      { label: '备注', value: 'notes' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(records);
  }

  exportWithTraceability(recordId: string): string {
    const { record, traceability } = this.getRecordWithTraceability(recordId);
    if (!record) {
      return '';
    }

    const recordFields = [
      { label: '字段', value: 'field' },
      { label: '值', value: 'value' }
    ];

    const recordData = [
      { field: '记录ID', value: record.id },
      { field: '儿童姓名', value: record.childName },
      { field: '身份证号', value: record.childIdCard },
      { field: '疫苗名称', value: record.vaccineName },
      { field: '预约日期', value: record.appointmentDate },
      { field: '当前状态', value: record.status },
      { field: '候补顺序', value: record.waitlistOrder || '-' },
      { field: '候补来源', value: record.waitlistSource || '-' },
      { field: '处理人', value: record.processedBy || '-' },
      { field: '处理时间', value: record.processedAt || '-' }
    ];

    const traceabilityFields = [
      { label: '时间', value: 'timestamp' },
      { label: '状态变更', value: 'status' },
      { label: '操作人', value: 'operator' },
      { label: '原因', value: 'reason' },
      { label: '说明', value: 'explanation' }
    ];

    const recordParser = new Parser({ fields: recordFields });
    const traceabilityParser = new Parser({ fields: traceabilityFields });

    const recordCSV = recordParser.parse(recordData);
    const traceabilityCSV = traceabilityParser.parse(traceability);

    return `=== 预约记录信息 ===\n${recordCSV}\n\n=== 追踪日志 ===\n${traceabilityCSV}`;
  }

  getHistoryByChild(childIdCard: string): Array<{
    recordId: string;
    vaccineName: string;
    doseNumber: number;
    appointmentDate: string;
    status: string;
    blockReason?: string;
    waitlistOrder?: number;
  }> {
    const records = this.queryRecords({ childIdCard });
    return records.map(r => ({
      recordId: r.id,
      vaccineName: r.vaccineName,
      doseNumber: r.doseNumber,
      appointmentDate: r.appointmentDate,
      status: r.status,
      blockReason: r.blockReason,
      waitlistOrder: r.waitlistOrder
    }));
  }

  getWaitlistByBatch(batchId: string): Array<{
    order: number;
    recordId: string;
    childName: string;
    source: string | undefined;
    waitDate: string;
  }> {
    const records = this.queryRecords({ batchId, status: RecordStatus.WAITLISTED });
    return records
      .sort((a, b) => (a.waitlistOrder || 0) - (b.waitlistOrder || 0))
      .map(r => ({
        order: r.waitlistOrder || 0,
        recordId: r.id,
        childName: r.childName,
        source: r.waitlistSource,
        waitDate: r.createdAt
      }));
  }

  getStatisticsByBatch(batchId: string): {
    total: number;
    pending: number;
    approved: number;
    processed: number;
    rejected: number;
    returned: number;
    waitlisted: number;
  } {
    const records = dataStore.getAppointmentRecordsByBatchId(batchId);
    return {
      total: records.length,
      pending: records.filter(r => r.status === RecordStatus.PENDING).length,
      approved: records.filter(r => r.status === RecordStatus.APPROVED).length,
      processed: records.filter(r => r.status === RecordStatus.PROCESSED).length,
      rejected: records.filter(r => r.status === RecordStatus.REJECTED).length,
      returned: records.filter(r => r.status === RecordStatus.RETURNED).length,
      waitlisted: records.filter(r => r.status === RecordStatus.WAITLISTED).length
    };
  }
}

export const queryService = new QueryService();
