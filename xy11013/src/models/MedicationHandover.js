const HandoverStatus = {
  NORMAL: 'normal',
  PENDING: 'pending',
  REJECTED: 'rejected'
};

const RecordType = {
  NORMAL: 'normal',
  ABNORMAL: 'abnormal'
};

class MedicationHandover {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    
    this.elderlyInfo = {
      name: data.elderlyInfo?.name || '',
      idCard: data.elderlyInfo?.idCard || '',
      roomNumber: data.elderlyInfo?.roomNumber || '',
      bedNumber: data.elderlyInfo?.bedNumber || '',
      primaryDisease: data.elderlyInfo?.primaryDisease || '',
      allergies: data.elderlyInfo?.allergies || []
    };

    this.medication = {
      name: data.medication?.name || '',
      specification: data.medication?.specification || '',
      dosage: data.medication?.dosage || '',
      frequency: data.medication?.frequency || '',
      route: data.medication?.route || '',
      prescribedDosage: data.medication?.prescribedDosage || '',
      actualDosage: data.medication?.actualDosage || ''
    };

    this.doctorsOrder = {
      doctorName: data.doctorsOrder?.doctorName || '',
      orderDate: data.doctorsOrder?.orderDate || new Date().toISOString(),
      remarks: data.doctorsOrder?.remarks || ''
    };

    this.familyChange = {
      hasChange: data.familyChange?.hasChange || false,
      changeTime: data.familyChange?.changeTime || null,
      familyMemberName: data.familyChange?.familyMemberName || '',
      familyMemberPhone: data.familyChange?.familyMemberPhone || '',
      changedDosage: data.familyChange?.changedDosage || '',
      changeReason: data.familyChange?.changeReason || ''
    };

    this.nurseConfirmation = {
      hasConfirmed: data.nurseConfirmation?.hasConfirmed || false,
      confirmTime: data.nurseConfirmation?.confirmTime || null,
      nurseName: data.nurseConfirmation?.nurseName || '',
      nurseSignature: data.nurseConfirmation?.nurseSignature || ''
    };

    this.medicationRecords = data.medicationRecords || [];

    this.handoverInfo = {
      handoverTime: data.handoverInfo?.handoverTime || new Date().toISOString(),
      fromNurse: data.handoverInfo?.fromNurse || '',
      toNurse: data.handoverInfo?.toNurse || '',
      handoverRemarks: data.handoverInfo?.handoverRemarks || ''
    };

    this.status = data.status || HandoverStatus.PENDING;
    this.recordType = data.recordType || RecordType.NORMAL;
    this.abnormalReason = data.abnormalReason || '';
    this.processingSuggestion = data.processingSuggestion || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validateConsistency() {
    const issues = [];

    if (this.familyChange.hasChange && !this.nurseConfirmation.hasConfirmed) {
      issues.push({
        code: 'FAMILY_DOSAGE_CHANGE_UNCONFIRMED',
        message: `家属${this.familyChange.familyMemberName}于${this.familyChange.changeTime}临时将${this.medication.name}剂量从"${this.medication.prescribedDosage}"修改为"${this.familyChange.changedDosage}"，但护士${this.nurseConfirmation.nurseName || '未指定'}未确认`,
        suggestion: '请联系护士确认剂量变更，或通知家属重新提交变更申请并等待护士签字确认'
      });
    }

    if (this.medicationRecords.length > 0) {
      const lastRecord = this.medicationRecords[this.medicationRecords.length - 1];
      if (lastRecord.dosage !== this.medication.actualDosage) {
        issues.push({
          code: 'DOSAGE_INCONSISTENCY',
          message: `服药记录与实际剂量不一致：历史记录剂量为"${lastRecord.dosage}"，当前实际剂量为"${this.medication.actualDosage}"`,
          suggestion: '请核对服药记录的一致性，补充缺失的剂量变更审批流程'
        });
      }
    }

    return issues;
  }

  process() {
    const issues = this.validateConsistency();

    if (issues.length > 0) {
      this.status = HandoverStatus.PENDING;
      this.recordType = RecordType.ABNORMAL;
      this.abnormalReason = issues.map(i => i.message).join('; ');
      this.processingSuggestion = issues.map(i => i.suggestion).join('; ');
    } else {
      this.status = HandoverStatus.NORMAL;
      this.recordType = RecordType.NORMAL;
    }

    this.updatedAt = new Date().toISOString();
    return {
      success: issues.length === 0,
      status: this.status,
      recordType: this.recordType,
      issues: issues,
      abnormalReason: this.abnormalReason,
      processingSuggestion: this.processingSuggestion
    };
  }
}

module.exports = { MedicationHandover, HandoverStatus, RecordType };
