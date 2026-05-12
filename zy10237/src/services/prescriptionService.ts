import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/database';
import {
  ConsultationStatus,
  PrescriptionStatus,
  CreateConsultationRequest,
  CreatePrescriptionRequest,
  PharmacistReviewRequest,
  PaymentConfirmRequest,
  ShipRequest,
  RejectCancelRequest
} from '../types';

export class PrescriptionService {
  private async checkIdempotent(idempotentKey: string): Promise<boolean> {
    const existing = await get(
      'SELECT id FROM status_logs WHERE idempotent_key = ?',
      [idempotentKey]
    );
    return !!existing;
  }

  private async logStatus(
    businessType: 'CONSULTATION' | 'PRESCRIPTION',
    businessId: string,
    fromStatus: string | undefined,
    toStatus: string,
    operatorId: string,
    operatorName: string,
    idempotentKey: string,
    remark?: string
  ): Promise<void> {
    await run(
      `INSERT INTO status_logs (id, business_type, business_id, from_status, to_status, operator_id, operator_name, remark, idempotent_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        businessType,
        businessId,
        fromStatus,
        toStatus,
        operatorId,
        operatorName,
        remark || null,
        idempotentKey,
        new Date().toISOString()
      ]
    );
  }

  async createConsultation(req: CreateConsultationRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get(
        'SELECT * FROM consultations WHERE patient_id = ? AND doctor_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.patientId, req.doctorId]
      );
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const consultationNo = `CZ${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO consultations (id, consultation_no, patient_id, patient_name, doctor_id, doctor_name, status, amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, consultationNo, req.patientId, req.patientName, req.doctorId, req.doctorName, ConsultationStatus.CREATED, now, now]
    );

    await this.logStatus(
      'CONSULTATION',
      id,
      undefined,
      ConsultationStatus.CREATED,
      req.patientId,
      req.patientName,
      req.idempotentKey,
      '问诊建单'
    );

    const consultation = await get('SELECT * FROM consultations WHERE id = ?', [id]);
    return { success: true, data: consultation };
  }

  async createPrescription(req: CreatePrescriptionRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get(
        'SELECT * FROM prescriptions WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.consultationId]
      );
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const consultation = await get(
      'SELECT * FROM consultations WHERE id = ?',
      [req.consultationId]
    );

    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    if (consultation.status === ConsultationStatus.PAID ||
        consultation.status === ConsultationStatus.PHARMACIST_APPROVED ||
        consultation.status === ConsultationStatus.SHIPPED) {
      return { success: false, message: '已支付或已发货的问诊单不能修改处方' };
    }

    if (consultation.status !== ConsultationStatus.CREATED &&
        consultation.status !== ConsultationStatus.REJECTED) {
      return { success: false, message: '当前状态不允许开方' };
    }

    const totalAmount = req.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const prescriptionNo = `CF${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const prescriptionId = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO prescriptions (id, prescription_no, consultation_id, doctor_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prescriptionId, prescriptionNo, req.consultationId, req.doctorId, PrescriptionStatus.SUBMITTED, now, now]
    );

    for (const item of req.items) {
      await run(
        `INSERT INTO prescription_items (id, prescription_id, medicine_id, medicine_name, specification, quantity, unit, dosage, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), prescriptionId, item.medicineId, item.medicineName, item.specification, item.quantity, item.unit, item.dosage, item.price]
      );
    }

    await run(
      'UPDATE consultations SET status = ?, amount = ?, updated_at = ? WHERE id = ?',
      [ConsultationStatus.PRESCRIBED, totalAmount, now, req.consultationId]
    );

    await this.logStatus(
      'PRESCRIPTION',
      prescriptionId,
      PrescriptionStatus.DRAFT,
      PrescriptionStatus.SUBMITTED,
      req.doctorId,
      '医生',
      req.idempotentKey,
      '医生开方'
    );

    await this.logStatus(
      'CONSULTATION',
      req.consultationId,
      consultation.status,
      ConsultationStatus.PRESCRIBED,
      req.doctorId,
      '医生',
      `${req.idempotentKey}_consultation`,
      '已开处方'
    );

    const prescription = await get('SELECT * FROM prescriptions WHERE id = ?', [prescriptionId]);
    const items = await all('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
    return { success: true, data: { ...prescription, items, totalAmount } };
  }

  async pharmacistReview(req: PharmacistReviewRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get('SELECT * FROM prescriptions WHERE id = ?', [req.prescriptionId]);
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const prescription = await get(
      'SELECT * FROM prescriptions WHERE id = ?',
      [req.prescriptionId]
    );

    if (!prescription) {
      return { success: false, message: '处方不存在' };
    }

    if (prescription.status !== PrescriptionStatus.SUBMITTED) {
      return { success: false, message: '当前处方状态不允许审核' };
    }

    if (!req.approved && !req.rejectReason) {
      return { success: false, message: '驳回处方必须填写驳回原因' };
    }

    const consultation = await get(
      'SELECT * FROM consultations WHERE id = ?',
      [prescription.consultation_id]
    );

    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    const now = new Date().toISOString();
    const newPrescriptionStatus = req.approved
      ? PrescriptionStatus.PHARMACIST_APPROVED
      : PrescriptionStatus.PHARMACIST_REJECTED;

    await run(
      `UPDATE prescriptions 
       SET status = ?, pharmacist_id = ?, pharmacist_name = ?, reject_reason = ?, approved_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        newPrescriptionStatus,
        req.pharmacistId,
        req.pharmacistName,
        req.rejectReason || null,
        req.approved ? now : null,
        now,
        req.prescriptionId
      ]
    );

    let newConsultationStatus: ConsultationStatus;
    let remark: string;

    if (req.approved) {
      newConsultationStatus = ConsultationStatus.PHARMACIST_APPROVED;
      remark = '药师审核通过';
    } else {
      newConsultationStatus = ConsultationStatus.REJECTED;
      remark = `药师驳回: ${req.rejectReason}`;
    }

    await run(
      'UPDATE consultations SET status = ?, updated_at = ? WHERE id = ?',
      [newConsultationStatus, now, prescription.consultation_id]
    );

    await this.logStatus(
      'PRESCRIPTION',
      req.prescriptionId,
      prescription.status,
      newPrescriptionStatus,
      req.pharmacistId,
      req.pharmacistName,
      req.idempotentKey,
      remark
    );

    await this.logStatus(
      'CONSULTATION',
      prescription.consultation_id,
      consultation.status,
      newConsultationStatus,
      req.pharmacistId,
      req.pharmacistName,
      `${req.idempotentKey}_consultation`,
      remark
    );

    const updatedPrescription = await get('SELECT * FROM prescriptions WHERE id = ?', [req.prescriptionId]);
    return { success: true, data: updatedPrescription };
  }

  async confirmPayment(req: PaymentConfirmRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const consultation = await get(
      'SELECT * FROM consultations WHERE id = ?',
      [req.consultationId]
    );

    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    if (consultation.status === ConsultationStatus.REJECTED) {
      return { success: false, message: '处方已被驳回，无法支付，请重新开方' };
    }

    if (consultation.status === ConsultationStatus.PRESCRIBED) {
      return { success: false, message: '处方尚未经药师审核，请先审核再支付' };
    }

    if (consultation.status !== ConsultationStatus.PHARMACIST_APPROVED) {
      return { success: false, message: '当前状态不允许支付' };
    }

    if (Math.abs(consultation.amount - req.amount) > 0.01) {
      return { success: false, message: '支付金额与处方金额不符' };
    }

    const now = new Date().toISOString();

    await run(
      'UPDATE consultations SET status = ?, paid_at = ?, payment_no = ?, updated_at = ? WHERE id = ?',
      [ConsultationStatus.PAID, now, req.paymentNo, now, req.consultationId]
    );

    await this.logStatus(
      'CONSULTATION',
      req.consultationId,
      consultation.status,
      ConsultationStatus.PAID,
      consultation.patient_id,
      consultation.patient_name,
      req.idempotentKey,
      `支付完成，支付单号: ${req.paymentNo}`
    );

    const updated = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
    return { success: true, data: updated };
  }

  async ship(req: ShipRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const consultation = await get(
      'SELECT * FROM consultations WHERE id = ?',
      [req.consultationId]
    );

    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    if (consultation.status === ConsultationStatus.PHARMACIST_APPROVED) {
      return { success: false, message: '处方尚未支付，请先支付再发货' };
    }

    if (consultation.status !== ConsultationStatus.PAID) {
      return { success: false, message: '当前状态不允许发货' };
    }

    const now = new Date().toISOString();

    await run(
      'UPDATE consultations SET status = ?, logistics_no = ?, logistics_company = ?, updated_at = ? WHERE id = ?',
      [ConsultationStatus.SHIPPED, req.logisticsNo, req.logisticsCompany, now, req.consultationId]
    );

    await this.logStatus(
      'CONSULTATION',
      req.consultationId,
      consultation.status,
      ConsultationStatus.SHIPPED,
      req.operatorId,
      req.operatorName,
      req.idempotentKey,
      `已发货，物流单号: ${req.logisticsNo}`
    );

    const updated = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
    return { success: true, data: updated };
  }

  async cancelOrReject(req: RejectCancelRequest) {
    if (await this.checkIdempotent(req.idempotentKey)) {
      const existing = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
      return { success: true, data: existing, message: '重复请求，返回已有数据' };
    }

    const consultation = await get(
      'SELECT * FROM consultations WHERE id = ?',
      [req.consultationId]
    );

    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    if (consultation.status === ConsultationStatus.SHIPPED ||
        consultation.status === ConsultationStatus.COMPLETED) {
      return { success: false, message: '已发货或已完成的订单无法撤销' };
    }

    const now = new Date().toISOString();

    await run(
      'UPDATE consultations SET status = ?, updated_at = ? WHERE id = ?',
      [ConsultationStatus.CANCELLED, now, req.consultationId]
    );

    await this.logStatus(
      'CONSULTATION',
      req.consultationId,
      consultation.status,
      ConsultationStatus.CANCELLED,
      req.operatorId,
      req.operatorName,
      req.idempotentKey,
      `撤销原因: ${req.reason}`
    );

    const updated = await get('SELECT * FROM consultations WHERE id = ?', [req.consultationId]);
    return { success: true, data: updated };
  }

  async getConsultation(id: string) {
    const consultation = await get('SELECT * FROM consultations WHERE id = ?', [id]);
    if (!consultation) {
      return { success: false, message: '问诊单不存在' };
    }

    const prescription = await get(
      'SELECT * FROM prescriptions WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    let items: any[] = [];
    if (prescription) {
      items = await all('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescription.id]);
    }

    const statusLogs = await all(
      'SELECT * FROM status_logs WHERE business_type = ? AND business_id = ? ORDER BY created_at ASC',
      ['CONSULTATION', id]
    );

    return {
      success: true,
      data: {
        consultation,
        prescription: prescription ? { ...prescription, items } : null,
        statusLogs
      }
    };
  }

  async getStatusSummary() {
    const result = await all(`
      SELECT status, COUNT(*) as count 
      FROM consultations 
      GROUP BY status
    `);

    const total = result.reduce((sum, r: any) => sum + r.count, 0);
    const totalAmount = await get('SELECT SUM(amount) as total_amount FROM consultations WHERE status = ?', [ConsultationStatus.PAID]);

    return {
      success: true,
      data: {
        total,
        byStatus: result,
        totalPaidAmount: (totalAmount as any)?.total_amount || 0
      }
    };
  }

  async getAllStatusLogs() {
    const logs = await all('SELECT * FROM status_logs ORDER BY created_at DESC LIMIT 100');
    return { success: true, data: logs };
  }
}

export const prescriptionService = new PrescriptionService();
