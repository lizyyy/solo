import {
  ComplaintRecord,
  ComplaintStatus,
  ComplaintInfo,
  OperationType,
} from '../types';
import { dataStore } from '../store';
import { StatusManager } from './status-manager';
import { BoundaryRules } from '../boundary-rules';

export class ComplaintLinkService {
  static linkComplaint(
    recordId: string,
    complaintInfo: ComplaintInfo,
    operator: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (record.complaint) {
      throw new Error('该记录已关联投诉编号，如需修改请先回滚');
    }

    if (!BoundaryRules.validation.complaintIdPattern.test(complaintInfo.complaintId)) {
      throw new Error(
        `投诉编号格式不正确，应为 ${BoundaryRules.validation.complaintIdPattern}`
      );
    }

    record.complaint = { ...complaintInfo };
    dataStore.saveRecord(record);

    const updated = StatusManager.transitionStatus(
      record.id,
      ComplaintStatus.COMPLAINT_LINKED,
      OperationType.LINK_COMPLAINT,
      operator,
      `关联投诉编号: ${complaintInfo.complaintId}`
    );

    return updated;
  }

  static updateComplaintRemark(
    recordId: string,
    remark: string,
    operator: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (!record.complaint) {
      throw new Error('该记录尚未关联投诉编号');
    }

    record.complaint.remark = remark;
    dataStore.saveRecord(record);

    return record;
  }

  static findByComplaintId(complaintId: string): ComplaintRecord | undefined {
    return dataStore
      .getAllRecords()
      .find(r => r.complaint?.complaintId === complaintId);
  }
}
