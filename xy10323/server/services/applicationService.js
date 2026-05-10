const { db } = require('../database');

class ApplicationService {
  static getAllApplications(filters = {}) {
    let query = `
      SELECT a.*,
             (SELECT COUNT(*) FROM refunds r WHERE r.application_id = a.id AND r.status = 'approved') as refund_count,
             (SELECT GROUP_CONCAT(DISTINCT ip.is_rectified) FROM inspections i 
              LEFT JOIN inspection_problems ip ON ip.inspection_id = i.id
              WHERE i.application_id = a.id) as rectification_status,
             (SELECT COUNT(*) FROM property_fees pf WHERE pf.application_id = a.id AND pf.is_paid = 0) as unpaid_fees
      FROM applications a
    `;
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    if (filters.keyword) {
      conditions.push('(a.application_no LIKE ? OR a.room_no LIKE ? OR a.owner_name LIKE ?)');
      const like = `%${filters.keyword}%`;
      params.push(like, like, like);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.created_at DESC';

    return db.prepare(query).all(...params);
  }

  static getApplicationById(id) {
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  }

  static getApplicationDetails(id) {
    const application = this.getApplicationById(id);
    if (!application) return null;

    const inspections = db.prepare(`
      SELECT i.*,
             (SELECT COUNT(*) FROM inspection_problems ip WHERE ip.inspection_id = i.id) as problem_count,
             (SELECT COUNT(*) FROM inspection_problems ip WHERE ip.inspection_id = i.id AND ip.is_rectified = 0) as unrectified_count
      FROM inspections i
      WHERE i.application_id = ?
      ORDER BY i.inspection_date DESC
    `).all(id);

    const problems = db.prepare(`
      SELECT ip.*, i.inspection_date
      FROM inspection_problems ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE i.application_id = ?
      ORDER BY ip.created_at DESC
    `).all(id);

    const fees = db.prepare(`
      SELECT * FROM property_fees
      WHERE application_id = ?
      ORDER BY due_date DESC
    `).all(id);

    const refunds = db.prepare(`
      SELECT r.*,
             (SELECT GROUP_CONCAT(item_type || ': ' || description || ' (¥' || amount || ')') 
              FROM deduction_items di WHERE di.refund_id = r.id) as deduction_details
      FROM refunds r
      WHERE r.application_id = ?
      ORDER BY r.created_at DESC
    `).all(id);

    const timeline = db.prepare(`
      SELECT * FROM timeline
      WHERE application_id = ?
      ORDER BY created_at DESC
    `).all(id);

    return {
      application,
      inspections,
      problems,
      fees,
      refunds,
      timeline
    };
  }

  static createApplication(data) {
    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO applications (application_no, room_no, owner_name, phone, deposit_amount, application_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        data.application_no,
        data.room_no,
        data.owner_name,
        data.phone || null,
        data.deposit_amount,
        data.application_date
      );

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        result.lastInsertRowid,
        '申请提交',
        `装修押金申请已提交，押金金额：¥${parseFloat(data.deposit_amount).toFixed(2)}`,
        data.operator || '系统'
      );

      return result.lastInsertRowid;
    });

    return tx();
  }

  static updateApplication(id, data) {
    const tx = db.transaction(() => {
      const current = this.getApplicationById(id);
      const changes = [];

      if (data.room_no !== undefined && data.room_no !== current.room_no) {
        changes.push(`房间号: ${current.room_no} → ${data.room_no}`);
      }
      if (data.owner_name !== undefined && data.owner_name !== current.owner_name) {
        changes.push(`业主: ${current.owner_name} → ${data.owner_name}`);
      }
      if (data.phone !== undefined && data.phone !== current.phone) {
        changes.push(`电话: ${current.phone || '未设置'} → ${data.phone || '未设置'}`);
      }
      if (data.deposit_amount !== undefined && parseFloat(data.deposit_amount) !== current.deposit_amount) {
        changes.push(`押金: ¥${current.deposit_amount.toFixed(2)} → ¥${parseFloat(data.deposit_amount).toFixed(2)}`);
      }

      db.prepare(`
        UPDATE applications
        SET room_no = COALESCE(?, room_no),
            owner_name = COALESCE(?, owner_name),
            phone = COALESCE(?, phone),
            deposit_amount = COALESCE(?, deposit_amount),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(
        data.room_no ?? null,
        data.owner_name ?? null,
        data.phone ?? null,
        data.deposit_amount ?? null,
        id
      );

      if (changes.length > 0) {
        db.prepare(`
          INSERT INTO timeline (application_id, action_type, action_details, operator)
          VALUES (?, ?, ?, ?)
        `).run(
          id,
          '申请修改',
          changes.join('；'),
          data.operator || '系统'
        );
      }

      return true;
    });

    return tx();
  }

  static addInspection(data) {
    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO inspections (application_id, inspection_date, inspector, overall_condition)
        VALUES (?, ?, ?, ?)
      `).run(
        data.application_id,
        data.inspection_date,
        data.inspector,
        data.overall_condition || null
      );

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        data.application_id,
        '新增巡检',
        `巡检日期：${data.inspection_date}，巡检人：${data.inspector}`,
        data.inspector
      );

      return result.lastInsertRowid;
    });

    return tx();
  }

  static addInspectionProblem(data) {
    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO inspection_problems (inspection_id, problem_type, description, location, severity, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        data.inspection_id,
        data.problem_type,
        data.description,
        data.location || null,
        data.severity || 'normal',
        data.estimated_cost || 0
      );

      const inspection = db.prepare('SELECT application_id FROM inspections WHERE id = ?').get(data.inspection_id);

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        inspection.application_id,
        '巡检发现问题',
        `${data.problem_type}：${data.description}${data.location ? '（' + data.location + '）' : ''}${data.estimated_cost ? '，预估费用：¥' + parseFloat(data.estimated_cost).toFixed(2) : ''}`,
        data.operator || '系统'
      );

      return result.lastInsertRowid;
    });

    return tx();
  }

  static rectifyProblem(problemId, data) {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE inspection_problems
        SET is_rectified = 1,
            rectification_date = ?,
            rectifier = ?
        WHERE id = ?
      `).run(
        data.rectification_date,
        data.rectifier,
        problemId
      );

      const problem = db.prepare(`
        SELECT ip.*, i.application_id
        FROM inspection_problems ip
        JOIN inspections i ON ip.inspection_id = i.id
        WHERE ip.id = ?
      `).get(problemId);

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        problem.application_id,
        '整改完成',
        `${problem.problem_type}：${problem.description} 已整改完成`,
        data.rectifier
      );

      return true;
    });

    return tx();
  }

  static addPropertyFee(data) {
    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO property_fees (application_id, fee_type, amount, due_date)
        VALUES (?, ?, ?, ?)
      `).run(
        data.application_id,
        data.fee_type,
        data.amount,
        data.due_date || null
      );

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        data.application_id,
        '新增欠费',
        `${data.fee_type}：¥${parseFloat(data.amount).toFixed(2)}${data.due_date ? '，到期日期：' + data.due_date : ''}`,
        data.operator || '系统'
      );

      return result.lastInsertRowid;
    });

    return tx();
  }

  static payPropertyFee(feeId, data) {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE property_fees
        SET is_paid = 1,
            paid_date = ?
        WHERE id = ?
      `).run(
        data.paid_date,
        feeId
      );

      const fee = db.prepare('SELECT * FROM property_fees WHERE id = ?').get(feeId);

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        fee.application_id,
        '欠费结清',
        `${fee.fee_type} ¥${fee.amount.toFixed(2)} 已结清`,
        data.operator || '系统'
      );

      return true;
    });

    return tx();
  }

  static canRefund(applicationId) {
    const unrectified = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspection_problems ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE i.application_id = ? AND ip.is_rectified = 0
    `).get(applicationId);

    if (unrectified.count > 0) {
      return { canRefund: false, reason: `存在 ${unrectified.count} 个未整改问题，请先完成整改后再申请退款` };
    }

    const unpaidFees = db.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM property_fees
      WHERE application_id = ? AND is_paid = 0
    `).get(applicationId);

    const existingRefund = db.prepare(`
      SELECT COUNT(*) as count
      FROM refunds
      WHERE application_id = ? AND status IN ('pending', 'approved')
    `).get(applicationId);

    if (existingRefund.count > 0) {
      return { canRefund: false, reason: '该申请已存在退款记录，不能重复退款' };
    }

    const hasInspection = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspections
      WHERE application_id = ?
    `).get(applicationId);

    if (hasInspection.count === 0) {
      return { canRefund: false, reason: '尚未进行完工巡检，请先完成巡检' };
    }

    if (unpaidFees.count > 0) {
      return {
        canRefund: true,
        hasUnpaidFees: true,
        unpaidFeeAmount: unpaidFees.total,
        unpaidFeeCount: unpaidFees.count
      };
    }

    return { canRefund: true };
  }

  static calculateRefund(applicationId, deductionItems = [], offsetFees = false) {
    const application = this.getApplicationById(applicationId);
    if (!application) return null;

    let totalDeduction = 0;
    deductionItems.forEach(item => {
      totalDeduction += parseFloat(item.amount) || 0;
    });

    let feeOffset = 0;
    if (offsetFees) {
      const unpaidFees = db.prepare(`
        SELECT SUM(amount) as total
        FROM property_fees
        WHERE application_id = ? AND is_paid = 0
      `).get(applicationId);
      feeOffset = unpaidFees.total || 0;
    }

    const actualRefund = application.deposit_amount - totalDeduction - feeOffset;

    return {
      totalDeposit: application.deposit_amount,
      totalDeduction,
      feeOffset,
      actualRefund: Math.max(actualRefund, 0)
    };
  }

  static createRefund(data) {
    const check = this.canRefund(data.application_id);
    if (!check.canRefund) {
      throw new Error(check.reason);
    }

    const tx = db.transaction(() => {
      const application = this.getApplicationById(data.application_id);
      const refundNo = `TK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      let totalDeduction = 0;
      data.deduction_items?.forEach(item => {
        totalDeduction += parseFloat(item.amount) || 0;
      });

      let feeOffset = 0;
      if (data.offset_fees) {
        const unpaidFees = db.prepare(`
          SELECT SUM(amount) as total
          FROM property_fees
          WHERE application_id = ? AND is_paid = 0
        `).get(data.application_id);
        feeOffset = unpaidFees.total || 0;

        db.prepare(`
          UPDATE property_fees
          SET is_paid = 1,
              paid_date = date('now', 'localtime')
          WHERE application_id = ? AND is_paid = 0
        `).run(data.application_id);
      }

      const actualRefund = application.deposit_amount - totalDeduction - feeOffset;

      const result = db.prepare(`
        INSERT INTO refunds (
          application_id, refund_no, total_deposit, deduction_amount, deduction_reason,
          fee_offset_amount, actual_refund, refund_date, approver, status, remarks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `).run(
        data.application_id,
        refundNo,
        application.deposit_amount,
        totalDeduction,
        data.deduction_reason || null,
        feeOffset,
        Math.max(actualRefund, 0),
        data.refund_date,
        data.approver,
        data.remarks || null
      );

      if (data.deduction_items?.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO deduction_items (refund_id, item_type, description, amount)
          VALUES (?, ?, ?, ?)
        `);
        data.deduction_items.forEach(item => {
          stmt.run(
            result.lastInsertRowid,
            item.item_type,
            item.description,
            parseFloat(item.amount) || 0
          );
        });
      }

      let timelineDetails = `退款单号：${refundNo}`;
      timelineDetails += `，押金总额：¥${application.deposit_amount.toFixed(2)}`;
      if (totalDeduction > 0) {
        timelineDetails += `，扣款：¥${totalDeduction.toFixed(2)}`;
        if (data.deduction_reason) {
          timelineDetails += `（${data.deduction_reason}）`;
        }
      }
      if (feeOffset > 0) {
        timelineDetails += `，物业费抵扣：¥${feeOffset.toFixed(2)}`;
      }
      timelineDetails += `，实际退款：¥${Math.max(actualRefund, 0).toFixed(2)}`;

      db.prepare(`
        INSERT INTO timeline (application_id, action_type, action_details, operator)
        VALUES (?, ?, ?, ?)
      `).run(
        data.application_id,
        '退款审批',
        timelineDetails,
        data.approver
      );

      db.prepare(`
        UPDATE applications
        SET status = 'completed',
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(data.application_id);

      return {
        refundId: result.lastInsertRowid,
        refundNo,
        actualRefund: Math.max(actualRefund, 0)
      };
    });

    return tx();
  }

  static getRefundDetails(refundId) {
    const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
    if (!refund) return null;

    const deductionItems = db.prepare(`
      SELECT * FROM deduction_items WHERE refund_id = ?
    `).all(refundId);

    return {
      refund,
      deductionItems
    };
  }
}

module.exports = ApplicationService;
