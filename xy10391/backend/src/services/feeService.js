const db = require('../config/db');
const dayjs = require('dayjs');

class FeeService {
  
  static async calculateMemberFee(memberId, feeYear) {
    const member = db.prepare(`
      SELECT m.*, ml.level_name, ml.level_code
      FROM members m
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      WHERE m.id = ?
    `).get(memberId);

    if (!member) {
      throw new Error('会员不存在');
    }

    const rule = db.prepare(`
      SELECT fee_amount FROM fee_rules
      WHERE member_level_id = ? AND effective_year = ?
      LIMIT 1
    `).get(member.member_level_id, feeYear);

    if (!rule) {
      throw new Error(`未找到${feeYear}年度的会费规则`);
    }

    const originalAmount = parseFloat(rule.fee_amount);

    const reductionRequests = db.prepare(`
      SELECT applied_amount, request_type, request_value
      FROM reduction_requests
      WHERE member_id = ? AND fee_year = ? AND status = 'approved'
    `).all(memberId, feeYear);

    let reductionAmount = 0;
    reductionRequests.forEach(req => {
      reductionAmount += parseFloat(req.applied_amount || 0);
    });

    reductionAmount = Math.min(reductionAmount, originalAmount);

    const payments = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) as total_paid
      FROM payments
      WHERE member_id = ? AND fee_year = ? AND status = 'paid'
    `).get(memberId, feeYear);

    const paidAmount = parseFloat(payments.total_paid || 0);
    const dueAmount = Math.max(0, originalAmount - reductionAmount - paidAmount);

    return {
      member,
      feeYear,
      originalAmount,
      reductionAmount,
      paidAmount,
      dueAmount,
      isFullyPaid: dueAmount <= 0.01
    };
  }

  static async getMemberReminderStatus(member, currentDate = dayjs()) {
    if (member.status === 'resigned') {
      return {
        status: 'resigned',
        description: '已退会，不再催缴',
        level: 'inactive'
      };
    }

    const currentYear = currentDate.year();
    
    const feeResult = await this.calculateMemberFee(member.id, currentYear);
    
    if (feeResult.isFullyPaid) {
      return {
        status: 'paid',
        description: `${currentYear}年度会费已结清`,
        level: 'success',
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount
      };
    }

    if (member.status === 'inactive') {
      return {
        status: 'inactive',
        description: '会员已暂停，待联系确认',
        level: 'warning',
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount
      };
    }

    const expiryDate = dayjs(member.expiry_date);
    const daysToExpiry = expiryDate.diff(currentDate, 'day');

    if (daysToExpiry < 0) {
      return {
        status: 'overdue',
        description: `会费已逾期${Math.abs(daysToExpiry)}天`,
        level: 'danger',
        daysOverdue: Math.abs(daysToExpiry),
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount
      };
    }

    const settings = db.prepare(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'reminder_days_before'
    `).get();
    
    const reminderDaysBefore = settings ? parseInt(settings.setting_value) : 30;

    if (daysToExpiry <= reminderDaysBefore) {
      return {
        status: 'pending',
        description: `距离到期还有${daysToExpiry}天，需要催缴`,
        level: 'warning',
        daysToExpiry,
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount
      };
    }

    return {
      status: 'normal',
      description: '会费正常，暂无需催缴',
      level: 'info',
      daysToExpiry,
      originalAmount: feeResult.originalAmount,
      reductionAmount: feeResult.reductionAmount,
      paidAmount: feeResult.paidAmount,
      dueAmount: feeResult.dueAmount
    };
  }

  static async createPayment(paymentData, createdBy) {
    const { memberId, feeYear, paidAmount, paymentMethod, paymentDate, remark, reductionRequestId } = paymentData;

    const insert = db.transaction((paymentInfo) => {
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
      if (!member) {
        throw new Error('会员不存在');
      }

      if (member.status === 'resigned') {
        throw new Error('该会员已退会，无法录入缴费');
      }

      const existingPayments = db.prepare(`
        SELECT SUM(paid_amount) as total_paid
        FROM payments
        WHERE member_id = ? AND fee_year = ? AND status = 'paid'
      `).get(memberId, feeYear);

      const existingPaid = parseFloat(existingPayments.total_paid || 0);
      
      const feeResult = FeeService.calculateMemberFee(memberId, feeYear);
      const amountDue = feeResult.originalAmount - feeResult.reductionAmount - existingPaid;

      if (paidAmount > amountDue + 0.01) {
        throw new Error(`缴费金额超额，该年度剩余应缴：¥${amountDue.toFixed(2)}`);
      }

      const paymentNo = `PAY${feeYear}${Date.now().toString().slice(-6)}`;
      
      let reductionAmount = 0;
      if (reductionRequestId) {
        const request = db.prepare(`
          SELECT * FROM reduction_requests WHERE id = ? AND status = 'approved'
        `).get(reductionRequestId);
        
        if (!request) {
          throw new Error('减免申请不存在或未批准');
        }
        
        reductionAmount = parseFloat(request.applied_amount || 0);
      } else {
        reductionAmount = feeResult.reductionAmount;
      }

      const result = db.prepare(`
        INSERT INTO payments 
        (payment_no, member_id, fee_year, original_amount, reduction_amount, paid_amount, 
         payment_method, payment_date, remark, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
      `).run(
        paymentNo,
        memberId,
        feeYear,
        feeResult.originalAmount,
        reductionAmount,
        paidAmount,
        paymentMethod,
        paymentDate,
        remark,
        createdBy
      );

      return {
        id: result.lastInsertRowid,
        paymentNo,
        message: '缴费记录创建成功'
      };
    });

    return insert(paymentData);
  }

  static async handleReductionRequest(requestId, action, userId, approvalComment = null) {
    const update = db.transaction((params) => {
      const request = db.prepare(`
        SELECT rr.*, m.member_code, m.company_name
        FROM reduction_requests rr
        LEFT JOIN members m ON rr.member_id = m.id
        WHERE rr.id = ?
      `).get(params.requestId);

      if (!request) {
        throw new Error('减免申请不存在');
      }

      if (request.status !== 'pending') {
        throw new Error('该申请已处理，无法重复操作');
      }

      const settings = db.prepare(`
        SELECT setting_value FROM system_settings WHERE setting_key = 'max_reduction_percentage'
      `).get();
      
      const maxPercentage = settings ? parseFloat(settings.setting_value) : 100;
      
      let appliedAmount = 0;
      
      if (params.action === 'approved') {
        if (request.request_type === 'percentage') {
          if (request.request_value > maxPercentage) {
            throw new Error(`减免比例(${request.request_value}%)超过上限(${maxPercentage}%)`);
          }
          appliedAmount = request.original_amount * (request.request_value / 100);
        } else {
          appliedAmount = Math.min(request.request_value, request.original_amount);
          const percentage = (appliedAmount / request.original_amount) * 100;
          if (percentage > maxPercentage) {
            throw new Error(`实际减免比例(${percentage.toFixed(1)}%)超过上限(${maxPercentage}%)`);
          }
        }
      }

      db.prepare(`
        UPDATE reduction_requests
        SET status = ?, approved_by = ?, approved_at = datetime('now'), approval_comment = ?, applied_amount = ?
        WHERE id = ?
      `).run(params.action, params.userId, params.approvalComment, appliedAmount, params.requestId);

      return {
        success: true,
        message: params.action === 'approved' ? '减免申请已批准' : '减免申请已拒绝',
        appliedAmount
      };
    });

    return update({ requestId, action, userId, approvalComment });
  }

  static async getAnnualReport(year) {
    const levels = db.prepare('SELECT * FROM membership_levels ORDER BY sort_order').all();
    
    const members = db.prepare(`
      SELECT m.*, ml.level_name, ml.level_code
      FROM members m
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      ORDER BY ml.sort_order, m.join_date
    `).all();

    const reportData = [];
    let totalOriginal = 0;
    let totalReduction = 0;
    let totalPaid = 0;

    for (const member of members) {
      const feeResult = await this.calculateMemberFee(member.id, year);
      const reminderStatus = await this.getMemberReminderStatus(member, dayjs().year(year));
      
      const payments = db.prepare(`
        SELECT p.*, u.real_name as creator_name
        FROM payments p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.member_id = ? AND p.fee_year = ? AND p.status = 'paid'
        ORDER BY p.payment_date
      `).all(member.id, year);

      const reductions = db.prepare(`
        SELECT rr.*, u1.real_name as creator_name, u2.real_name as approver_name
        FROM reduction_requests rr
        LEFT JOIN users u1 ON rr.created_by = u1.id
        LEFT JOIN users u2 ON rr.approved_by = u2.id
        WHERE rr.member_id = ? AND rr.fee_year = ?
        ORDER BY rr.created_at
      `).all(member.id, year);

      let unpaidReason = '';
      if (!feeResult.isFullyPaid && member.status !== 'resigned') {
        if (reductions.some(r => r.status === 'pending')) {
          unpaidReason = '减免申请待审批';
        } else if (member.status === 'inactive') {
          unpaidReason = '会员暂停，待联系';
        } else if (feeResult.dueAmount > 0) {
          unpaidReason = '待催缴';
        }
      }

      reportData.push({
        memberCode: member.member_code,
        companyName: member.company_name,
        memberLevel: member.level_name,
        joinDate: member.join_date,
        expiryDate: member.expiry_date,
        status: member.status,
        isSmallEnterprise: member.is_small_enterprise,
        contactPhone: member.contact_phone,
        contactPerson: member.contact_person,
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount,
        isFullyPaid: feeResult.isFullyPaid,
        reminderStatus: reminderStatus.status,
        reminderDescription: reminderStatus.description,
        reminderLevel: reminderStatus.level,
        unpaidReason,
        payments,
        reductions
      });

      totalOriginal += feeResult.originalAmount;
      totalReduction += feeResult.reductionAmount;
      totalPaid += feeResult.paidAmount;
    }

    const byLevel = {};
    levels.forEach(level => {
      const levelData = reportData.filter(r => r.memberLevel === level.level_name);
      byLevel[level.level_code] = {
        levelName: level.level_name,
        totalMembers: levelData.length,
        paidMembers: levelData.filter(r => r.isFullyPaid).length,
        overdueMembers: levelData.filter(r => r.reminderStatus === 'overdue').length,
        originalAmount: levelData.reduce((sum, r) => sum + r.originalAmount, 0),
        reductionAmount: levelData.reduce((sum, r) => sum + r.reductionAmount, 0),
        paidAmount: levelData.reduce((sum, r) => sum + r.paidAmount, 0),
        dueAmount: levelData.reduce((sum, r) => sum + r.dueAmount, 0)
      };
    });

    const totalMembers = members.length;
    const paidMembers = reportData.filter(r => r.isFullyPaid).length;
    const overdueMembers = reportData.filter(r => r.reminderStatus === 'overdue').length;
    const pendingReduction = reportData.filter(r => r.reductions?.some(x => x.status === 'pending')).length;
    const resignedMembers = members.filter(m => m.status === 'resigned').length;
    const inactiveMembers = members.filter(m => m.status === 'inactive').length;

    return {
      year,
      summary: {
        totalMembers,
        paidMembers,
        paymentRate: totalMembers > 0 ? ((paidMembers / totalMembers) * 100).toFixed(1) : '0',
        overdueMembers,
        pendingReduction,
        resignedMembers,
        inactiveMembers,
        totalOriginal,
        totalReduction,
        totalPaid,
        totalDue: totalOriginal - totalReduction - totalPaid
      },
      byLevel,
      details: reportData
    };
  }

  static async getDashboardData() {
    const currentYear = dayjs().year();
    const currentDate = dayjs();

    const members = db.prepare(`
      SELECT m.*, ml.level_name
      FROM members m
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
    `).all();

    const settings = db.prepare(`
      SELECT setting_key, setting_value FROM system_settings
    `).all();
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);
    const reminderDaysBefore = parseInt(settingsMap.reminder_days_before || '30');

    const stats = {
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      resignedMembers: 0,
      paidThisYear: 0,
      overdue: 0,
      needReminder: 0,
      pendingReductions: 0
    };

    const risks = [];
    const todos = [];
    const highValueMembers = [];

    for (const member of members) {
      stats.totalMembers++;
      
      if (member.status === 'active') stats.activeMembers++;
      else if (member.status === 'inactive') stats.inactiveMembers++;
      else if (member.status === 'resigned') stats.resignedMembers++;

      if (member.status === 'resigned') continue;

      const feeResult = await this.calculateMemberFee(member.id, currentYear);
      const reminderStatus = await this.getMemberReminderStatus(member, currentDate);

      if (feeResult.isFullyPaid) {
        stats.paidThisYear++;
      }

      if (reminderStatus.status === 'overdue') {
        stats.overdue++;
        risks.push({
          type: 'overdue',
          memberCode: member.member_code,
          companyName: member.company_name,
          memberLevel: member.level_name,
          description: `会费逾期${reminderStatus.daysOverdue}天，应缴¥${reminderStatus.dueAmount?.toFixed(2)}`,
          level: 'high'
        });
      } else if (reminderStatus.status === 'pending') {
        stats.needReminder++;
        todos.push({
          type: 'reminder',
          memberCode: member.member_code,
          companyName: member.company_name,
          memberLevel: member.level_name,
          description: `距离到期${reminderStatus.daysToExpiry}天，应缴¥${reminderStatus.dueAmount?.toFixed(2)}`,
          dueInDays: reminderStatus.daysToExpiry
        });
      }

      if (feeResult.originalAmount >= 15000) {
        highValueMembers.push({
          memberCode: member.member_code,
          companyName: member.company_name,
          memberLevel: member.level_name,
          originalAmount: feeResult.originalAmount,
          isPaid: feeResult.isFullyPaid
        });
      }
    }

    const pendingRequests = db.prepare(`
      SELECT rr.*, m.member_code, m.company_name, ml.level_name
      FROM reduction_requests rr
      LEFT JOIN members m ON rr.member_id = m.id
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      WHERE rr.status = 'pending'
      ORDER BY rr.created_at
    `).all();

    stats.pendingReductions = pendingRequests.length;
    
    pendingRequests.forEach(req => {
      todos.push({
        type: 'reduction',
        requestCode: req.request_code,
        memberCode: req.member_code,
        companyName: req.company_name,
        memberLevel: req.level_name,
        requestType: req.request_type === 'percentage' ? `${req.request_value}%减免` : `¥${req.request_value}减免`,
        reason: req.reason,
        createdAt: req.created_at
      });
    });

    risks.sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      return levelOrder[a.level] - levelOrder[b.level];
    });

    todos.sort((a, b) => {
      if (a.type === 'reminder' && b.type === 'reminder') {
        return a.dueInDays - b.dueInDays;
      }
      if (a.type === 'reduction' && b.type === 'reduction') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return a.type === 'reduction' ? -1 : 1;
    });

    const annualReport = await this.getAnnualReport(currentYear);

    return {
      currentYear,
      stats,
      completionRate: stats.activeMembers > 0 ? ((stats.paidThisYear / stats.activeMembers) * 100).toFixed(1) : '0',
      risks: risks.slice(0, 10),
      todos: todos.slice(0, 15),
      highValueMembers,
      annualSummary: annualReport.summary
    };
  }
}

module.exports = FeeService;
