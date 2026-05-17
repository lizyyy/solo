import { repository } from './repository';
import { WithdrawalValidator, ConflictError, StatusValidationError } from './validator';
import { Prescription, PrescriptionStatus, WithdrawalRequest, AuditRequest, ImportResult } from './models';

export class PrescriptionService {
  async createPrescription(data: {
    prescriptionNo: string;
    consultation: any;
    doctor: any;
    medicines: any[];
  }): Promise<Prescription> {
    return repository.create(data);
  }

  async getPrescription(id: string): Promise<Prescription | undefined> {
    return repository.findById(id);
  }

  async listPrescriptions(filters?: { status?: PrescriptionStatus; patientName?: string }): Promise<Prescription[]> {
    return repository.findAll(filters);
  }

  async requestWithdrawal(request: WithdrawalRequest): Promise<Prescription> {
    const prescription = repository.findById(request.prescriptionId);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    WithdrawalValidator.validateWithdrawalRequest(prescription, request);

    repository.updateStatus(request.prescriptionId, PrescriptionStatus.WITHDRAWING);
    return repository.addWithdrawalRecord(request.prescriptionId, {
      reason: request.reason,
      operatorId: request.operatorId,
      operatorName: request.operatorName
    });
  }

  async auditWithdrawal(request: AuditRequest): Promise<Prescription> {
    const prescription = repository.findById(request.prescriptionId);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    WithdrawalValidator.validateAudit(prescription, request);

    const targetStatus = request.approved ? PrescriptionStatus.NOTIFIED : PrescriptionStatus.REJECTED;
    repository.updateStatus(request.prescriptionId, targetStatus);

    return repository.addWithdrawalRecord(request.prescriptionId, {
      reason: request.approved ? '审核通过' : '审核驳回',
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      remark: request.remark
    });
  }

  async closePrescription(id: string): Promise<Prescription> {
    const prescription = repository.findById(id);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    WithdrawalValidator.validateClose(prescription);
    return repository.updateStatus(id, PrescriptionStatus.CLOSED);
  }

  async markAsDispensed(id: string): Promise<Prescription> {
    return repository.markAsDispensed(id);
  }

  async importPrescriptions(dataArray: any[]): Promise<ImportResult> {
    return repository.importFromData(dataArray);
  }

  async exportPrescriptions(): Promise<any[]> {
    return repository.exportToData();
  }

  async getWithdrawalHistory(prescriptionId: string): Promise<any[]> {
    const prescription = repository.findById(prescriptionId);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    return prescription.withdrawalRecords
      .sort((a, b) => b.operateTime.getTime() - a.operateTime.getTime())
      .map(r => ({
        id: r.id,
        reason: r.reason,
        operatorName: r.operatorName,
        operateTime: r.operateTime,
        remark: r.remark
      }));
  }
}

export const prescriptionService = new PrescriptionService();
