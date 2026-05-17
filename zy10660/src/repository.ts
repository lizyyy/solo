import { v4 as uuidv4 } from 'uuid';
import {
  Prescription,
  Doctor,
  Medicine,
  Consultation,
  WithdrawalRecord,
  PrescriptionStatus,
  ImportResult
} from './models';
import { WithdrawalValidator, StatusValidationError } from './validator';

export class PrescriptionRepository {
  private prescriptions: Map<string, Prescription> = new Map();

  private ensureDate(value: any): Date {
    return value instanceof Date ? value : new Date(value);
  }

  create(data: {
    prescriptionNo: string;
    consultation: Omit<Consultation, 'id'>;
    doctor: Omit<Doctor, 'id'>;
    medicines: Omit<Medicine, 'id'>[];
  }): Prescription {
    const now = new Date();
    const prescription: Prescription = {
      id: uuidv4(),
      prescriptionNo: data.prescriptionNo,
      consultation: {
        ...data.consultation,
        id: uuidv4(),
        consultTime: this.ensureDate(data.consultation.consultTime)
      },
      doctor: {
        ...data.doctor,
        id: uuidv4()
      },
      medicines: data.medicines.map(m => ({ ...m, id: uuidv4() })),
      status: PrescriptionStatus.PRESCRIBED,
      createdAt: now,
      updatedAt: now,
      isDispensed: false,
      withdrawalRecords: []
    };

    this.prescriptions.set(prescription.id, prescription);
    return prescription;
  }

  findById(id: string): Prescription | undefined {
    return this.prescriptions.get(id);
  }

  findByPrescriptionNo(no: string): Prescription | undefined {
    return Array.from(this.prescriptions.values()).find(p => p.prescriptionNo === no);
  }

  findAll(filters?: { status?: PrescriptionStatus; patientName?: string }): Prescription[] {
    let results = Array.from(this.prescriptions.values());

    if (filters?.status) {
      results = results.filter(p => p.status === filters.status);
    }

    if (filters?.patientName) {
      results = results.filter(p =>
        p.consultation.patientName.includes(filters.patientName!)
      );
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateStatus(id: string, status: PrescriptionStatus): Prescription {
    const prescription = this.findById(id);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    prescription.status = status;
    prescription.updatedAt = new Date();
    return prescription;
  }

  markAsDispensed(id: string): Prescription {
    const prescription = this.findById(id);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    WithdrawalValidator.validateDispensed(prescription);
    prescription.isDispensed = true;
    prescription.status = PrescriptionStatus.DISPENSED;
    prescription.updatedAt = new Date();
    return prescription;
  }

  addWithdrawalRecord(id: string, record: Omit<WithdrawalRecord, 'id' | 'prescriptionId' | 'operateTime'>): Prescription {
    const prescription = this.findById(id);
    if (!prescription) {
      throw new StatusValidationError('处方不存在');
    }

    const withdrawalRecord: WithdrawalRecord = {
      ...record,
      id: uuidv4(),
      prescriptionId: id,
      operateTime: new Date()
    };

    prescription.withdrawalRecords.push(withdrawalRecord);
    prescription.updatedAt = new Date();
    return prescription;
  }

  importFromData(dataArray: any[]): ImportResult {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    dataArray.forEach((data, index) => {
      try {
        if (!data.prescriptionNo || !data.patientName) {
          throw new Error('缺少必填字段: 处方号或患者姓名');
        }

        if (this.findByPrescriptionNo(data.prescriptionNo)) {
          throw new Error(`处方号 ${data.prescriptionNo} 已存在`);
        }

        const medicines = this.parseMedicines(data.medicines);
        if (medicines.length === 0) {
          throw new Error('药品列表不能为空');
        }

        this.create({
          prescriptionNo: data.prescriptionNo,
          consultation: {
            patientName: data.patientName,
            patientId: data.patientId || '',
            diagnosis: data.diagnosis || '',
            consultTime: data.consultTime ? new Date(data.consultTime) : new Date()
          },
          doctor: {
            name: data.doctorName || '',
            department: data.department || '',
            licenseNo: data.licenseNo || ''
          },
          medicines
        });

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: index + 1,
          message: error.message,
          data
        });
      }
    });

    return result;
  }

  private parseMedicines(medicinesStr: string | undefined): Omit<Medicine, 'id'>[] {
    if (!medicinesStr) return [];
    try {
      const parsed = JSON.parse(medicinesStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return medicinesStr.split(';').map(m => {
        const [name, spec, dosage, qty, price] = m.split(',');
        return {
          name: name?.trim() || '',
          specification: spec?.trim() || '',
          dosage: dosage?.trim() || '',
          quantity: parseInt(qty) || 0,
          price: parseFloat(price) || 0
        };
      }).filter(m => m.name);
    }
  }

  exportToData(): any[] {
    return Array.from(this.prescriptions.values()).map(p => ({
      id: p.id,
      prescriptionNo: p.prescriptionNo,
      patientName: p.consultation.patientName,
      patientId: p.consultation.patientId,
      diagnosis: p.consultation.diagnosis,
      consultTime: this.ensureDate(p.consultation.consultTime).toISOString(),
      doctorName: p.doctor.name,
      department: p.doctor.department,
      licenseNo: p.doctor.licenseNo,
      medicines: JSON.stringify(p.medicines),
      status: p.status,
      createdAt: this.ensureDate(p.createdAt).toISOString(),
      updatedAt: this.ensureDate(p.updatedAt).toISOString(),
      isDispensed: p.isDispensed,
      withdrawalCount: p.withdrawalRecords.length
    }));
  }

  delete(id: string): boolean {
    return this.prescriptions.delete(id);
  }

  clear(): void {
    this.prescriptions.clear();
  }
}

export const repository = new PrescriptionRepository();
