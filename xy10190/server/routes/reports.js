const express = require('express');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalOffers,
      offersByStatus,
      totalCandidates,
      candidatesByStatus,
      pendingApprovals,
      recentActivity
    ] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM offers`),
      db.all(`SELECT status, COUNT(*) as count FROM offers GROUP BY status`),
      db.get(`SELECT COUNT(*) as count FROM candidates`),
      db.all(`SELECT status, COUNT(*) as count FROM candidates GROUP BY status`),
      db.get(`SELECT COUNT(*) as count FROM offers WHERE status = 'pending_approval'`),
      db.all(`
        SELECT al.*, u.name as user_name 
        FROM audit_logs al 
        LEFT JOIN users u ON al.user_id = u.id 
        ORDER BY al.created_at DESC 
        LIMIT 10
      `)
    ]);

    const statusMap = {
      draft: '草稿',
      pending_approval: '审批中',
      approved: '已通过',
      rejected: '已拒绝',
      withdrawn: '已撤回',
      rejected_by_candidate: '候选人拒绝'
    };

    const candidateStatusMap = {
      interviewing: '面试中',
      offer_sent: '已发 Offer',
      offer_accepted: '已接受',
      rejected: '已拒绝',
      hired: '已入职'
    };

    const offersByStatusFormatted = {};
    offersByStatus.forEach(item => {
      offersByStatusFormatted[statusMap[item.status] || item.status] = item.count;
    });

    const candidatesByStatusFormatted = {};
    candidatesByStatus.forEach(item => {
      candidatesByStatusFormatted[candidateStatusMap[item.status] || item.status] = item.count;
    });

    res.json({
      success: true,
      data: {
        totalOffers: totalOffers.count,
        offersByStatus: offersByStatusFormatted,
        totalCandidates: totalCandidates.count,
        candidatesByStatus: candidatesByStatusFormatted,
        pendingApprovals: pendingApprovals.count,
        recentActivity
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/offer/:id/pdf', async (req, res, next) => {
  try {
    const offer = await db.get(
      `SELECT o.*, c.name as candidate_name, c.position, c.department as candidate_department,
              u.name as creator_name, u.department as creator_department
       FROM offers o 
       LEFT JOIN candidates c ON o.candidate_id = c.id 
       LEFT JOIN users u ON o.created_by = u.id 
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    const approverIds = JSON.parse(offer.approver_ids || '[]');
    const approvers = [];
    for (const id of approverIds) {
      const appr = await db.get(`SELECT name, role, department FROM users WHERE id = ?`, [id]);
      if (appr) approvers.push(appr);
    }

    const approvalRecords = await db.all(
      `SELECT ar.*, u.name as approver_name 
       FROM approval_records ar 
       LEFT JOIN users u ON ar.approver_id = u.id 
       WHERE ar.offer_id = ? 
       ORDER BY ar.approver_order`,
      [offer.id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Offer_${offer.candidate_name}_v${offer.version}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('录用通知书 (Offer Letter)', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`版本: v${offer.version}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text(`候选人: ${offer.candidate_name}`);
    doc.text(`职位: ${offer.position}`);
    doc.text(`部门: ${offer.candidate_department || '-'}`);
    doc.moveDown();

    doc.fontSize(14).text('薪酬福利', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`基本工资: ¥${Number(offer.base_salary).toLocaleString()} / 月`);
    doc.text(`年度奖金: ¥${Number(offer.bonus).toLocaleString()}`);
    doc.text(`试用期: ${offer.probation_period} 个月`);
    doc.text(`入职日期: ${offer.start_date}`);
    doc.text(`工作地点: ${offer.work_location || '-'}`);
    if (offer.benefits) {
      doc.text(`其他福利: ${offer.benefits}`);
    }
    doc.moveDown();

    if (offer.change_reason) {
      doc.fontSize(14).text('变更说明', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(offer.change_reason);
      doc.moveDown();
    }

    doc.fontSize(14).text('审批流程', { underline: true });
    doc.moveDown();
    approvers.forEach((appr, index) => {
      const record = approvalRecords[index];
      const status = record 
        ? (record.action === 'approve' ? '✓ 已通过' : '✗ 已拒绝')
        : '○ 待审批';
      doc.fontSize(12).text(`${index + 1}. ${appr.name} (${appr.department} - ${appr.role}) - ${status}`);
      if (record && record.comment) {
        doc.fontSize(10).text(`   意见: ${record.comment}`);
      }
    });
    doc.moveDown();

    doc.fontSize(10).text(`创建人: ${offer.creator_name} (${offer.creator_department})`);
    doc.text(`创建时间: ${offer.created_at}`);
    if (offer.accepted_at) {
      doc.text(`接受时间: ${offer.accepted_at}`);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

router.get('/offers/export', requireRole('hr_admin', 'hr', 'director'), async (req, res, next) => {
  try {
    const { status, start_date, end_date } = req.query;

    let sql = `
      SELECT o.id, o.version, o.base_salary, o.bonus, o.start_date, o.status,
             o.created_at, o.is_accepted, o.accepted_at, o.change_reason,
             c.name as candidate_name, c.position, c.department as candidate_department,
             u.name as creator_name
      FROM offers o
      LEFT JOIN candidates c ON o.candidate_id = c.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND o.status = ?`;
      params.push(status);
    }
    if (start_date) {
      sql += ` AND o.created_at >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND o.created_at <= ?`;
      params.push(end_date);
    }
    sql += ` ORDER BY o.created_at DESC`;

    const offers = await db.all(sql, params);

    const statusMap = {
      draft: '草稿',
      pending_approval: '审批中',
      approved: '已通过',
      rejected: '已拒绝',
      withdrawn: '已撤回',
      rejected_by_candidate: '候选人拒绝'
    };

    const data = offers.map(offer => ({
      'Offer ID': offer.id.substring(0, 8),
      '版本': offer.version,
      '候选人': offer.candidate_name,
      '职位': offer.position,
      '部门': offer.candidate_department || '-',
      '基本工资': `¥${Number(offer.base_salary).toLocaleString()}`,
      '年度奖金': `¥${Number(offer.bonus).toLocaleString()}`,
      '入职日期': offer.start_date,
      '状态': statusMap[offer.status] || offer.status,
      '是否接受': offer.is_accepted ? '是' : '否',
      '接受时间': offer.accepted_at || '-',
      '变更原因': offer.change_reason || '-',
      '创建人': offer.creator_name,
      '创建时间': offer.created_at
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    ws['!cols'] = [
      { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Offer列表');

    const fileName = `Offer列表_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
