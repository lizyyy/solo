import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { Contract, RefundApplication, RefundCalculation, RefundItemDetail, ApprovalHistory } from '../types';
import { BusinessError, ErrorCodes } from '../utils/errors';
import { recordBusinessHistory } from '../utils/history';
import { getContractById, getInstallmentsByContractId, getAttendancesByContractId } from './contractService';

export const calculateRefund = async (contractId: string): Promise<RefundCalculation> => {
  const contract = await getContractById(contractId);
  const installments = await getInstallmentsByContractId(contractId);
  const attendances = await getAttendancesByContractId(contractId);
  const existingRefunds = await getRefundsByContractId(contractId);
  
  const warnings: string[] = [];
  const items: RefundItemDetail[] = [];
  
  const paidInstallments = installments.filter(i => i.status === 'paid');
  const unpaidInstallments = installments.filter(i => i.status === 'pending');
  
  const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
  const totalPrincipalPaid = paidInstallments.reduce((sum, i) => sum + i.principal, 0);
  const totalFeesPaid = paidInstallments.reduce((sum, i) => sum + i.fee, 0);
  const unpaidFees = unpaidInstallments.reduce((sum, i) => sum + i.fee, 0);
  
  const attendedPaidLessons = attendances.filter(a => a.is_gifted === 0).length;
  const attendedGiftedLessons = attendances.filter(a => a.is_gifted === 1).length;
  
  const remainingPaidLessons = contract.paid_lessons - attendedPaidLessons;
  const remainingGiftedLessons = contract.gifted_lessons - attendedGiftedLessons;
  
  if (attendedGiftedLessons > contract.gifted_lessons) {
    warnings.push('赠课消课数量超过合同赠课总数，赠课被当成付费课使用');
  }
  
  const consumedCourseAmount = attendedPaidLessons * contract.unit_price;
  
  items.push({
    type: 'course',
    name: '已上课时费',
    amount: consumedCourseAmount,
    quantity: attendedPaidLessons,
    unit_price: contract.unit_price,
    remark: `已上付费课${attendedPaidLessons}节，赠课${attendedGiftedLessons}节`
  });
  
  let materialFeeDeduction = 0;
  let materialFeeRefunded = 0;
  const approvedRefunds = existingRefunds.filter(r => r.status === 'approved');
  
  if (approvedRefunds.length > 0) {
    materialFeeDeduction = contract.material_fee;
    warnings.push('存在已审批退费，教材费已在之前的退费中扣除');
  } else {
    materialFeeRefunded = contract.material_fee;
    items.push({
      type: 'material',
      name: '教材费返还',
      amount: materialFeeRefunded,
      quantity: 1,
      remark: '未使用教材全额退还'
    });
  }
  
  items.push({
    type: 'installment_fee',
    name: '分期手续费',
    amount: unpaidFees,
    quantity: unpaidInstallments.length,
    remark: `未付清分期${unpaidInstallments.length}期，手续费不予退还`
  });
  
  if (unpaidInstallments.length > 0) {
    warnings.push(`存在${unpaidInstallments.length}期未付清分期，分期手续费不予退还`);
  }
  
  const totalRefundAmount = Math.max(0, totalPrincipalPaid - consumedCourseAmount + materialFeeRefunded);
  const actualRefundAmount = Math.max(0, totalRefundAmount - unpaidFees);
  
  return {
    contract,
    attended_paid_lessons: attendedPaidLessons,
    attended_gifted_lessons: attendedGiftedLessons,
    remaining_paid_lessons: remainingPaidLessons,
    remaining_gifted_lessons: Math.max(0, remainingGiftedLessons),
    total_paid: totalPaid,
    paid_installments_count: paidInstallments.length,
    unpaid_installments_count: unpaidInstallments.length,
    unpaid_installment_fees: unpaidFees,
    material_fee_deduction: materialFeeDeduction,
    material_fee_refunded: materialFeeRefunded,
    items,
    total_refund_amount: totalRefundAmount,
    actual_refund_amount: actualRefundAmount,
    warnings
  };
};

export const createRefundApplication = async (
  contractId: string,
  reason: string,
  requestedDate: string,
  createdBy: string,
  createdByName: string
): Promise<{ refund: RefundApplication; calculation: RefundCalculation }> => {
  const contract = await getContractById(contractId);
  
  if (contract.status === 'refunded') {
    throw new BusinessError(ErrorCodes.CONTRACT_ALREADY_REFUNDED, '该合同已完成退费');
  }
  
  const existingPending = await new Promise<RefundApplication | null>((resolve, reject) => {
    db.get(
      'SELECT * FROM refund_applications WHERE contract_id = ? AND status IN (?, ?)',
      [contractId, 'pending', 'approved'],
      (err, row: any) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
  
  if (existingPending) {
    throw new BusinessError(ErrorCodes.DUPLICATE_APPLICATION, '该合同已有待审批或已批准的退费申请', {
      existingApplicationNo: existingPending.application_no,
      status: existingPending.status
    });
  }
  
  const calculation = await calculateRefund(contractId);
  const applicationNo = `REF${Date.now()}`;
  
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.serialize(() => {
      db.run(
        `INSERT INTO refund_applications (id, contract_id, application_no, reason, requested_date, total_refund_amount, actual_refund_amount, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contractId,
          applicationNo,
          reason,
          requestedDate,
          calculation.total_refund_amount,
          calculation.actual_refund_amount,
          'pending',
          createdBy,
          now,
          now
        ],
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          const refundItems = calculation.items.map(item => ({
            id: uuidv4(),
            refund_id: id,
            item_type: item.type,
            item_name: item.name,
            amount: item.amount,
            quantity: item.quantity,
            unit_price: item.unit_price || null,
            remark: item.remark,
            created_at: now
          }));
          
          for (const item of refundItems) {
            await new Promise<void>((res, rej) => {
              db.run(
                `INSERT INTO refund_items (id, refund_id, item_type, item_name, amount, quantity, unit_price, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.id, item.refund_id, item.item_type, item.item_name, item.amount, item.quantity, item.unit_price, item.remark, item.created_at],
                (e) => e ? rej(e) : res()
              );
            });
          }
          
          await addApprovalHistory(id, 'submit', 'pending', createdBy, createdByName, '提交退费申请');
          await recordBusinessHistory('refund', id, 'create', createdBy, createdByName, null, {
            application_no: applicationNo,
            contract_id: contractId,
            ...calculation
          });
          
          resolve({
            refund: {
              id,
              contract_id: contractId,
              application_no: applicationNo,
              reason,
              requested_date: requestedDate,
              total_refund_amount: calculation.total_refund_amount,
              actual_refund_amount: calculation.actual_refund_amount,
              status: 'pending',
              created_by: createdBy,
              created_at: now,
              updated_at: now
            },
            calculation
          });
        }
      );
    });
  });
};

export const approveRefund = async (
  refundId: string,
  approverId: string,
  approverName: string,
  comment?: string
): Promise<RefundApplication> => {
  const refund = await getRefundById(refundId);
  
  if (refund.status === 'approved') {
    throw new BusinessError(ErrorCodes.REFUND_ALREADY_APPROVED, '该退费申请已审批通过');
  }
  
  if (refund.status === 'cancelled') {
    throw new BusinessError(ErrorCodes.REFUND_ALREADY_CANCELLED, '该退费申请已取消');
  }
  
  if (refund.status !== 'pending') {
    throw new BusinessError(ErrorCodes.INVALID_STATUS_TRANSITION, '只有待审批的申请可以批准');
  }
  
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const oldStatus = refund.status;
    
    db.run(
      `UPDATE refund_applications SET status = ?, updated_at = ? WHERE id = ?`,
      ['approved', now, refundId],
      async (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        await addApprovalHistory(refundId, 'approve', 'approved', approverId, approverName, comment, oldStatus, 'approved');
        await recordBusinessHistory('refund', refundId, 'approve', approverId, approverName, { status: oldStatus }, { status: 'approved' }, comment);
        
        db.run(
          `UPDATE contracts SET status = 'refunded', updated_at = ? WHERE id = ?`,
          [now, refund.contract_id],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve({ ...refund, status: 'approved', updated_at: now });
          }
        );
      }
    );
  });
};

export const cancelRefund = async (
  refundId: string,
  operatorId: string,
  operatorName: string,
  comment?: string
): Promise<RefundApplication> => {
  const refund = await getRefundById(refundId);
  
  if (refund.status === 'cancelled') {
    throw new BusinessError(ErrorCodes.REFUND_ALREADY_CANCELLED, '该退费申请已取消');
  }
  
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const oldStatus = refund.status;
    
    db.run(
      `UPDATE refund_applications SET status = ?, updated_at = ? WHERE id = ?`,
      ['cancelled', now, refundId],
      async (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        await addApprovalHistory(refundId, 'cancel', 'cancelled', operatorId, operatorName, comment, oldStatus, 'cancelled');
        await recordBusinessHistory('refund', refundId, 'cancel', operatorId, operatorName, { status: oldStatus }, { status: 'cancelled' }, comment);
        
        db.run(
          `UPDATE contracts SET status = 'active', updated_at = ? WHERE id = ?`,
          [now, refund.contract_id],
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({ ...refund, status: 'cancelled', updated_at: now });
          }
        );
      }
    );
  });
};

export const getRefundById = (id: string): Promise<RefundApplication> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM refund_applications WHERE id = ?', [id], (err, row: any) => {
      if (err) reject(err);
      else if (!row) reject(new BusinessError(ErrorCodes.REFUND_NOT_FOUND, '退费申请不存在'));
      else resolve(row);
    });
  });
};

export const getRefundsByContractId = (contractId: string): Promise<RefundApplication[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM refund_applications WHERE contract_id = ? ORDER BY created_at DESC', [contractId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const getRefundItems = (refundId: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM refund_items WHERE refund_id = ?', [refundId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const getApprovalHistory = (refundId: string): Promise<ApprovalHistory[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM approval_history WHERE refund_id = ? ORDER BY created_at DESC', [refundId], (err, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const addApprovalHistory = (
  refundId: string,
  action: string,
  status: string,
  approverId: string,
  approverName: string,
  comment?: string,
  previousStatus?: string,
  newStatus?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.run(
      `INSERT INTO approval_history (id, refund_id, action, status, approver_id, approver_name, comment, previous_status, new_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, refundId, action, status, approverId, approverName, comment || null, previousStatus || null, newStatus || null, now],
      (err) => err ? reject(err) : resolve()
    );
  });
};

export const getRefundDetail = async (refundId: string) => {
  const refund = await getRefundById(refundId);
  const items = await getRefundItems(refundId);
  const approvalHistory = await getApprovalHistory(refundId);
  const contract = await getContractById(refund.contract_id);
  
  return {
    refund,
    contract,
    items,
    approvalHistory
  };
};
