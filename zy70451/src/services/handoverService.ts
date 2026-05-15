import { v4 as uuidv4 } from 'uuid';
import {
  HandoverForm,
  ServiceRecord,
  ServiceStatus,
  RecordStatus,
  CreateHandoverFormRequest,
  ManualFixRequest,
  MaterialSummary,
  Remark,
  HistoryRecord
} from '../types';
import { fileStore } from '../store/fileStore';

class HandoverService {
  private generateFormNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HJ${dateStr}${random}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private addHistoryRecord(
    resourceType: string,
    resourceId: string,
    resourceRange: string,
    action: string,
    reason: string,
    operator: string,
    beforeChange?: any,
    afterChange?: any
  ): void {
    const record: HistoryRecord = {
      id: uuidv4(),
      resourceType,
      resourceId,
      resourceRange,
      action,
      reason,
      operator,
      beforeChange,
      afterChange,
      createdAt: this.now()
    };
    fileStore.addHistoryRecord(record);
  }

  createHandoverForm(request: CreateHandoverFormRequest): HandoverForm {
    const serviceRecords: ServiceRecord[] = request.serviceRecords.map(sr => ({
      ...sr,
      id: uuidv4(),
      status: sr.status || ServiceStatus.PENDING,
      materialSummaries: sr.materialSummaries || [],
      remarks: sr.remarks || [],
      systemConclusion: sr.systemConclusion || '',
      createdAt: this.now(),
      updatedAt: this.now()
    }));

    const form: HandoverForm = {
      id: uuidv4(),
      formNo: this.generateFormNo(),
      tenantId: request.tenantId,
      tenantName: request.tenantName,
      handler: request.handler,
      status: RecordStatus.PENDING,
      serviceRecords,
      createdAt: this.now(),
      updatedAt: this.now()
    };

    fileStore.saveHandoverForm(form);

    this.addHistoryRecord(
      'handover_form',
      form.id,
      `tenant:${request.tenantId}`,
      'create',
      '创建交接单',
      request.handler
    );

    return form;
  }

  getHandoverForm(id: string): HandoverForm | undefined {
    return fileStore.getHandoverFormById(id);
  }

  getAllHandoverForms(): HandoverForm[] {
    return fileStore.getHandoverForms();
  }

  private validateVersionConsistency(serviceRecord: ServiceRecord): ServiceRecord {
    const hasMismatch = serviceRecord.versions.some(v => !v.isMatch);
    const updatedRecord = { ...serviceRecord };

    if (hasMismatch) {
      updatedRecord.status = ServiceStatus.ABNORMAL;
      const mismatchedServices = serviceRecord.versions
        .filter(v => !v.isMatch)
        .map(v => `${v.serviceName}(期望:${v.expectedVersion},实际:${v.actualVersion})`)
        .join('; ');
      updatedRecord.systemConclusion = `版本不一致: ${mismatchedServices}`;
    } else {
      updatedRecord.status = ServiceStatus.NORMAL;
      updatedRecord.systemConclusion = '所有服务版本校验通过';
    }

    updatedRecord.updatedAt = this.now();
    return updatedRecord;
  }

  processHandoverForm(formId: string): HandoverForm {
    const form = fileStore.getHandoverFormById(formId);
    if (!form) {
      throw new Error(`交接单不存在: ${formId}`);
    }

    const beforeChange = { status: form.status, serviceRecords: form.serviceRecords };

    const processedRecords = form.serviceRecords.map(sr =>
      this.validateVersionConsistency(sr)
    );

    const allNormal = processedRecords.every(sr => sr.status === ServiceStatus.NORMAL);
    const allAbnormal = processedRecords.every(sr => sr.status === ServiceStatus.ABNORMAL);

    let status: RecordStatus;
    if (allNormal) {
      status = RecordStatus.SUCCESS;
    } else if (allAbnormal) {
      status = RecordStatus.FAILED;
    } else {
      status = RecordStatus.PARTIAL_SUCCESS;
    }

    const updatedForm: HandoverForm = {
      ...form,
      serviceRecords: processedRecords,
      status,
      updatedAt: this.now()
    };

    fileStore.saveHandoverForm(updatedForm);

    this.addHistoryRecord(
      'handover_form',
      formId,
      `tenant:${form.tenantId}`,
      'process',
      '处理交接单，执行版本一致性校验',
      form.handler,
      beforeChange,
      { status: updatedForm.status, serviceRecords: processedRecords }
    );

    return updatedForm;
  }

  manualFix(formId: string, request: ManualFixRequest): HandoverForm {
    const form = fileStore.getHandoverFormById(formId);
    if (!form) {
      throw new Error(`交接单不存在: ${formId}`);
    }

    const serviceRecordIndex = form.serviceRecords.findIndex(
      sr => sr.id === request.serviceRecordId
    );

    if (serviceRecordIndex === -1) {
      throw new Error(`服务记录不存在: ${request.serviceRecordId}`);
    }

    const beforeChange = { ...form.serviceRecords[serviceRecordIndex] };

    const updatedRecords = [...form.serviceRecords];
    const targetRecord = { ...updatedRecords[serviceRecordIndex] };

    const remark: Remark = {
      id: uuidv4(),
      content: request.remark,
      operator: request.operator,
      createdAt: this.now()
    };

    targetRecord.remarks = [...targetRecord.remarks, remark];
    targetRecord.manualConclusion = request.manualConclusion;
    targetRecord.status = ServiceStatus.MANUAL_FIXED;
    targetRecord.updatedAt = this.now();

    updatedRecords[serviceRecordIndex] = targetRecord;

    const updatedForm: HandoverForm = {
      ...form,
      serviceRecords: updatedRecords,
      updatedAt: this.now()
    };

    fileStore.saveHandoverForm(updatedForm);

    this.addHistoryRecord(
      'service_record',
      request.serviceRecordId,
      `tenant:${form.tenantId},form:${formId}`,
      'manual_fix',
      request.remark,
      request.operator,
      beforeChange,
      targetRecord
    );

    return updatedForm;
  }

  addMaterialSummary(
    formId: string,
    serviceRecordId: string,
    type: string,
    content: string
  ): HandoverForm {
    const form = fileStore.getHandoverFormById(formId);
    if (!form) {
      throw new Error(`交接单不存在: ${formId}`);
    }

    const serviceRecordIndex = form.serviceRecords.findIndex(
      sr => sr.id === serviceRecordId
    );

    if (serviceRecordIndex === -1) {
      throw new Error(`服务记录不存在: ${serviceRecordId}`);
    }

    const summary: MaterialSummary = {
      id: uuidv4(),
      type,
      content,
      createdAt: this.now()
    };

    const updatedRecords = [...form.serviceRecords];
    const targetRecord = { ...updatedRecords[serviceRecordIndex] };
    targetRecord.materialSummaries = [...targetRecord.materialSummaries, summary];
    targetRecord.updatedAt = this.now();
    updatedRecords[serviceRecordIndex] = targetRecord;

    const updatedForm: HandoverForm = {
      ...form,
      serviceRecords: updatedRecords,
      updatedAt: this.now()
    };

    fileStore.saveHandoverForm(updatedForm);

    return updatedForm;
  }

  getHistoryByResourceRange(resourceRange: string): HistoryRecord[] {
    const allHistory = fileStore.getHistoryRecords();
    return allHistory.filter(h => h.resourceRange.includes(resourceRange));
  }

  getAllHistory(): HistoryRecord[] {
    return fileStore.getHistoryRecords();
  }
}

export const handoverService = new HandoverService();
