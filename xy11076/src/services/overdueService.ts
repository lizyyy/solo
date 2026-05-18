import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler';

export const checkPartialReturn = async (orderId: string): Promise<{
  hasPartialReturn: boolean;
  returnedItems: any[];
  pendingItems: any[];
  message: string;
}> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ri.*, e.type, e.brand, e.model 
       FROM rental_items ri 
       JOIN equipment e ON ri.equipment_id = e.equipment_id 
       WHERE ri.order_id = ?`,
      [orderId],
      (err, items: any[]) => {
        if (err) return reject(err);

        const returnedItems = items.filter(item => item.actual_return_date);
        const pendingItems = items.filter(item => !item.actual_return_date);

        const hasPartialReturn = returnedItems.length > 0 && pendingItems.length > 0;

        let message = '';
        if (hasPartialReturn) {
          const returnedTypes = returnedItems.map(i => `${i.brand} ${i.model} (${i.type === 'camera_body' ? '机身' : i.type === 'lens' ? '镜头' : '配件'})`).join('、');
          const pendingTypes = pendingItems.map(i => `${i.brand} ${i.model} (${i.type === 'camera_body' ? '机身' : i.type === 'lens' ? '镜头' : '配件'})`).join('、');
          message = `检测到部分归还：已归还 ${returnedTypes}，但 ${pendingTypes} 仍未归还。需要人工审核确认。`;
        }

        resolve({ hasPartialReturn, returnedItems, pendingItems, message });
      }
    );
  });
};

export const verifyBillConsistency = async (orderId: string): Promise<{
  isConsistent: boolean;
  discrepancies: string[];
  calculatedAmount: number;
  billedAmount: number;
}> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT expected_return_date FROM rental_orders WHERE order_id = ?`,
      [orderId],
      (err, order: any) => {
        if (err) return reject(err);

        db.all(
          `SELECT ri.*, e.daily_rental_price 
           FROM rental_items ri 
           JOIN equipment e ON ri.equipment_id = e.equipment_id 
           WHERE ri.order_id = ? AND ri.actual_return_date IS NULL`,
          [orderId],
          async (err, pendingItems: any[]) => {
            if (err) return reject(err);

            const discrepancies: string[] = [];
            const expectedReturnDate = new Date(order.expected_return_date);
            const today = new Date();
            const overdueDays = Math.max(0, Math.floor((today.getTime() - expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24)));

            let calculatedAmount = 0;
            pendingItems.forEach(item => {
              calculatedAmount += overdueDays * item.daily_rental_price;
            });

            db.get(
              `SELECT overdue_amount FROM overdue_bills WHERE order_id = ? AND status = 'pending'`,
              [orderId],
              (err, bill: any) => {
                if (err) return reject(err);

                const billedAmount = bill ? bill.overdue_amount : 0;

                if (Math.abs(calculatedAmount - billedAmount) > 0.01) {
                  discrepancies.push(`逾期金额不一致：系统计算 ${calculatedAmount.toFixed(2)} 元，账单记录 ${billedAmount.toFixed(2)} 元`);
                }

                if (pendingItems.length === 0 && billedAmount > 0) {
                  discrepancies.push('所有设备已归还，但仍有未结清的逾期账单');
                }

                resolve({
                  isConsistent: discrepancies.length === 0,
                  discrepancies,
                  calculatedAmount,
                  billedAmount
                });
              }
            );
          }
        );
      }
    );
  });
};

export const createOverdueBill = async (orderId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM rental_orders WHERE order_id = ?`,
      [orderId],
      async (err, order: any) => {
        if (err) return reject(err);
        if (!order) {
          return reject(new AppError(404, 'ORDER_NOT_FOUND', '订单不存在', `未找到订单号 ${orderId} 的租赁记录`, '请检查订单号是否正确'));
        }

        const partialReturnCheck = await checkPartialReturn(orderId);
        const consistencyCheck = await verifyBillConsistency(orderId);

        if (!consistencyCheck.isConsistent) {
          return reject(new AppError(
            400,
            'BILL_INCONSISTENT',
            '逾期账单数据不一致，无法自动处理',
            consistencyCheck.discrepancies.join('；'),
            '请转人工审核确认账单金额'
          ));
        }

        db.all(
          `SELECT equipment_id FROM rental_items WHERE order_id = ? AND actual_return_date IS NULL`,
          [orderId],
          (err, pendingItems: any[]) => {
            if (err) return reject(err);

            if (pendingItems.length === 0) {
              return reject(new AppError(
                400,
                'NO_PENDING_ITEMS',
                '该订单所有设备已归还，无逾期未还设备',
                '订单下所有租赁物品均已完成归还手续',
                '请确认是否需要生成其他类型的费用账单'
              ));
            }

            const expectedReturnDate = new Date(order.expected_return_date);
            const today = new Date();
            const overdueDays = Math.max(0, Math.floor((today.getTime() - expectedReturnDate.getTime()) / (1000 * 60 * 60 * 24)));

            if (overdueDays === 0) {
              return reject(new AppError(
                400,
                'NOT_OVERDUE',
                '该订单尚未逾期',
                `预计归还日期为 ${expectedReturnDate.toLocaleDateString()}，当前为 ${today.toLocaleDateString()}`,
                '请在订单逾期后再生成逾期账单'
              ));
            }

            db.all(
              `SELECT SUM(e.daily_rental_price) as total_daily_price 
               FROM rental_items ri 
               JOIN equipment e ON ri.equipment_id = e.equipment_id 
               WHERE ri.order_id = ? AND ri.actual_return_date IS NULL`,
              [orderId],
              (err, result: any[]) => {
                if (err) return reject(err);

                const totalDailyPrice = result[0].total_daily_price || 0;
                const overdueAmount = overdueDays * totalDailyPrice;
                const equipmentIds = pendingItems.map(item => item.equipment_id).join(',');

                const billId = 'BILL' + Date.now();
                const reviewStatus = partialReturnCheck.hasPartialReturn ? 'needs_review' : 'pending';
                const reviewNotes = partialReturnCheck.message || null;

                db.run(
                  `INSERT INTO overdue_bills (bill_id, order_id, customer_id, overdue_days, overdue_amount, equipment_ids, status, review_status, review_notes) 
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
                  [billId, orderId, order.customer_id, overdueDays, overdueAmount, equipmentIds, reviewStatus, reviewNotes],
                  function(err) {
                    if (err) return reject(err);

                    db.run(
                      `UPDATE rental_orders SET status = 'overdue' WHERE order_id = ?`,
                      [orderId],
                      (err) => {
                        if (err) return reject(err);

                        resolve({
                          bill_id: billId,
                          order_id: orderId,
                          customer_id: order.customer_id,
                          overdue_days: overdueDays,
                          overdue_amount: overdueAmount,
                          equipment_ids: equipmentIds,
                          review_status: reviewStatus,
                          review_notes: reviewNotes,
                          needs_manual_review: partialReturnCheck.hasPartialReturn
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

export const processEquipmentReturn = async (returnData: {
  order_id: string;
  equipment_id: string;
  return_condition: string;
  return_staff: string;
  actual_return_date?: string;
}): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM rental_orders WHERE order_id = ?`,
      [returnData.order_id],
      async (err, order: any) => {
        if (err) return reject(err);
        if (!order) {
          return reject(new AppError(404, 'ORDER_NOT_FOUND', '订单不存在', `未找到订单号 ${returnData.order_id} 的租赁记录`, '请检查订单号是否正确'));
        }

        db.get(
          `SELECT * FROM rental_items WHERE order_id = ? AND equipment_id = ?`,
          [returnData.order_id, returnData.equipment_id],
          (err, item: any) => {
            if (err) return reject(err);
            if (!item) {
              return reject(new AppError(
                404,
                'ITEM_NOT_IN_ORDER',
                '该设备不在此订单中',
                `订单 ${returnData.order_id} 中未包含设备 ${returnData.equipment_id}`,
                '请检查设备编号或订单号是否匹配'
              ));
            }

            if (item.actual_return_date) {
              return reject(new AppError(
                400,
                'ALREADY_RETURNED',
                '该设备已归还',
                `设备 ${returnData.equipment_id} 已于 ${new Date(item.actual_return_date).toLocaleDateString()} 归还`,
                '请勿重复提交归还申请'
              ));
            }

            const returnDate = returnData.actual_return_date ? new Date(returnData.actual_return_date) : new Date();

            db.run(
              `UPDATE rental_items 
               SET actual_return_date = ?, return_condition = ?, return_staff = ?
               WHERE order_id = ? AND equipment_id = ?`,
              [returnDate.toISOString(), returnData.return_condition, returnData.return_staff, returnData.order_id, returnData.equipment_id],
              async function(err) {
                if (err) return reject(err);

                db.run(
                  `UPDATE equipment SET status = 'available' WHERE equipment_id = ?`,
                  [returnData.equipment_id],
                  async (err) => {
                    if (err) return reject(err);

                    const partialReturnCheck = await checkPartialReturn(returnData.order_id);

                    if (partialReturnCheck.pendingItems.length === 0) {
                      db.run(
                        `UPDATE rental_orders SET actual_return_date = ?, status = 'completed' WHERE order_id = ?`,
                        [returnDate.toISOString(), returnData.order_id],
                        (err) => {
                          if (err) return reject(err);
                          resolve({
                            success: true,
                            message: '所有设备已归还，订单已完成',
                            order_completed: true
                          });
                        }
                      );
                    } else {
                      if (partialReturnCheck.hasPartialReturn) {
                        db.get(
                          `SELECT bill_id FROM overdue_bills WHERE order_id = ? AND status = 'pending'`,
                          [returnData.order_id],
                          (err, bill: any) => {
                            if (bill) {
                              db.run(
                                `UPDATE overdue_bills 
                                 SET review_status = 'needs_review', 
                                     review_notes = ?,
                                     equipment_ids = ?
                                 WHERE bill_id = ?`,
                                [partialReturnCheck.message, partialReturnCheck.pendingItems.map(i => i.equipment_id).join(','), bill.bill_id],
                                (err) => {
                                  if (err) return reject(err);
                                }
                              );
                            }
                          }
                        );
                      }

                      resolve({
                        success: true,
                        message: '设备归还成功，但订单中还有未归还设备',
                        partial_return: true,
                        needs_manual_review: partialReturnCheck.hasPartialReturn,
                        review_note: partialReturnCheck.message,
                        pending_items_count: partialReturnCheck.pendingItems.length
                      });
                    }
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

export const getOverdueBills = async (status?: string, reviewStatus?: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT ob.*, c.name as customer_name, c.phone as customer_phone,
             ro.pickup_location, ro.return_location, ro.staff_name,
             ro.expected_return_date
      FROM overdue_bills ob
      JOIN customers c ON ob.customer_id = c.customer_id
      JOIN rental_orders ro ON ob.order_id = ro.order_id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (status) {
      query += ` AND ob.status = ?`;
      params.push(status);
    }

    if (reviewStatus) {
      query += ` AND ob.review_status = ?`;
      params.push(reviewStatus);
    }

    query += ` ORDER BY ob.created_at DESC`;

    db.all(query, params, (err, bills) => {
      if (err) return reject(err);
      resolve(bills);
    });
  });
};

export const reviewOverdueBill = async (billId: string, reviewDecision: string, reviewNotes: string, reviewedBy: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM overdue_bills WHERE bill_id = ?`,
      [billId],
      (err, bill: any) => {
        if (err) return reject(err);
        if (!bill) {
          return reject(new AppError(404, 'BILL_NOT_FOUND', '逾期账单不存在', `未找到账单号 ${billId} 的记录`, '请检查账单号是否正确'));
        }

        if (!['approved', 'rejected'].includes(reviewDecision)) {
          return reject(new AppError(
            400,
            'INVALID_DECISION',
            '无效的审核决定',
            `审核决定必须是 'approved' (批准) 或 'rejected' (驳回)，当前为 ${reviewDecision}`,
            '请使用正确的审核决定参数'
          ));
        }

        const newStatus = reviewDecision === 'approved' ? 'pending' : 'waived';

        db.run(
          `UPDATE overdue_bills 
           SET review_status = ?, status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?
           WHERE bill_id = ?`,
          [reviewDecision, newStatus, reviewNotes, reviewedBy, new Date().toISOString(), billId],
          function(err) {
            if (err) return reject(err);

            resolve({
              bill_id: billId,
              review_decision: reviewDecision,
              review_notes: reviewNotes,
              reviewed_by: reviewedBy,
              new_status: newStatus,
              message: reviewDecision === 'approved' 
                ? '逾期账单已批准，账单状态更新为待支付' 
                : '逾期账单已驳回，费用已豁免'
            });
          }
        );
      }
    );
  });
};
