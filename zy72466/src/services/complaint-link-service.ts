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
      throw new Error(
        '该记录已关联投诉编号，如需修改请使用 relinkComplaint 接口或先回滚'
      );
    }

    if (
      !BoundaryRules.validation.complaintIdPattern.test(
        complaintInfo.complaintId
      )
    ) {
      throw new Error(
        `投诉编号格式不正确，应为 ${BoundaryRules.validation.complaintIdPattern}`
      );
    }

    return StatusManager.executeWithTransition(
      record.id,
      ComplaintStatus.COMPLAINT_LINKED,
      OperationType.LINK_COMPLAINT,
      operator,
      r => {
        r.complaint = { ...complaintInfo };
      },
      `关联投诉编号: ${complaintInfo.complaintId}`
    );
  }

  static relinkComplaint(
    recordId: string,
    complaintInfo: ComplaintInfo,
    operator: string,
    reason?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (
      !BoundaryRules.validation.complaintIdPattern.test(
        complaintInfo.complaintId
      )
    ) {
      throw new Error(
        `投诉编号格式不正确，应为 ${BoundaryRules.validation.complaintIdPattern}`
      );
    }

    return StatusManager.executeManualEdit(
      recordId,
      operator,
      r => {
        r.complaint = { ...complaintInfo };
      },
      reason ||
        (record.complaint
          ? `返工：修改投诉编号 ${record.complaint.complaintId} → ${complaintInfo.complaintId}`
          : `补录：关联投诉编号 ${complaintInfo.complaintId}`)
    );
  }

  static updateComplaintRemark(
    recordId: string,
    remark: string,
    operator: string,
    errorNote?: string
  ): ComplaintRecord | null {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (!record.complaint) {
      throw new Error('该记录尚未关联投诉编号，请先关联或补录');
    }

    return StatusManager.executeManualEdit(
      recordId,
      operator,
      r => {
        if (r.complaint) {
          r.complaint.remark = remark;
        }
      },
      errorNote ? `修改备注/误差说明: ${errorNote}` : '修改投诉备注'
    );
  }

  static findByComplaintId(complaintId: string): ComplaintRecord | undefined {
    return dataStore
      .getAllRecords()
      .find(r => r.complaint?.complaintId === complaintId);
  }
}
