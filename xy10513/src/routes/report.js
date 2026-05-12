const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const service = require('../services/pointsService');
const db = require('../database').getDb;

router.get('/member/:memberId', (req, res) => {
  const { format = 'json' } = req.query;
  const memberId = req.params.memberId;
  
  const member = service.getMember(memberId);
  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'MEMBER_NOT_FOUND',
      message: '会员不存在'
    });
  }
  
  const balance = service.getMemberBalance(memberId);
  const batches = service.getMemberBatches(memberId);
  const expiringSoon = service.getExpiringSoon(memberId, 30);
  const ledger = service.getLedger(memberId, 50);
  const freezes = db().prepare(`
    SELECT * FROM freeze_records WHERE member_id = ? ORDER BY created_at DESC
  `).all(memberId);
  const consumes = db().prepare(`
    SELECT * FROM consume_records WHERE member_id = ? ORDER BY created_at DESC
  `).all(memberId);
  const refunds = db().prepare(`
    SELECT * FROM refund_records WHERE member_id = ? ORDER BY created_at DESC
  `).all(memberId);
  const expires = db().prepare(`
    SELECT * FROM expire_records WHERE member_id = ? ORDER BY created_at DESC
  `).all(memberId);
  const adjustments = db().prepare(`
    SELECT * FROM adjustment_records WHERE member_id = ? ORDER BY created_at DESC
  `).all(memberId);
  
  const report = {
    generatedAt: new Date().toISOString(),
    member: {
      ...member,
      balance
    },
    summary: {
      totalBatches: batches.length,
      activeBatches: batches.filter(b => b.status === 'active').length,
      expiredBatches: batches.filter(b => b.status === 'expired').length,
      expiringIn30Days: {
        count: expiringSoon.length,
        totalPoints: expiringSoon.reduce((sum, b) => sum + b.available_points, 0)
      },
      totalTransactions: ledger.length,
      totalFreezes: freezes.length,
      totalConsumes: consumes.length,
      totalRefunds: refunds.length,
      totalExpires: expires.length,
      totalAdjustments: adjustments.length
    },
    batches,
    expiringSoon,
    ledger,
    freezes,
    consumes,
    refunds,
    expires,
    adjustments
  };
  
  if (format === 'csv') {
    const fields = [
      'memberId', 'name', 'phone', 'level',
      'balance.available', 'balance.frozen', 'balance.consumed', 'balance.expired',
      'summary.totalBatches', 'summary.activeBatches', 'summary.expiredBatches',
      'summary.expiringIn30Days.count', 'summary.expiringIn30Days.totalPoints'
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse([{
      memberId: member.member_id,
      name: member.name,
      phone: member.phone,
      level: member.level,
      'balance.available': balance.available,
      'balance.frozen': balance.frozen,
      'balance.consumed': balance.consumed,
      'balance.expired': balance.expired,
      'summary.totalBatches': report.summary.totalBatches,
      'summary.activeBatches': report.summary.activeBatches,
      'summary.expiredBatches': report.summary.expiredBatches,
      'summary.expiringIn30Days.count': report.summary.expiringIn30Days.count,
      'summary.expiringIn30Days.totalPoints': report.summary.expiringIn30Days.totalPoints
    }]);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`points-report-${memberId}.csv`);
    return res.send(csv);
  }
  
  res.json({
    success: true,
    data: report
  });
});

router.get('/all', (req, res) => {
  const { format = 'json' } = req.query;
  
  const members = service.getAllMembers();
  const reports = members.map(m => {
    const balance = service.getMemberBalance(m.member_id);
    const batches = service.getMemberBatches(m.member_id);
    const expiringSoon = service.getExpiringSoon(m.member_id, 30);
    
    return {
      memberId: m.member_id,
      name: m.name,
      phone: m.phone,
      level: m.level,
      balance,
      totalBatches: batches.length,
      expiringIn30Days: {
        count: expiringSoon.length,
        points: expiringSoon.reduce((sum, b) => sum + b.available_points, 0)
      }
    };
  });
  
  if (format === 'csv') {
    const fields = [
      'memberId', 'name', 'phone', 'level',
      'available', 'frozen', 'consumed', 'expired',
      'totalBatches', 'expiringCount', 'expiringPoints'
    ];
    
    const csvData = reports.map(r => ({
      memberId: r.memberId,
      name: r.name,
      phone: r.phone,
      level: r.level,
      available: r.balance.available,
      frozen: r.balance.frozen,
      consumed: r.balance.consumed,
      expired: r.balance.expired,
      totalBatches: r.totalBatches,
      expiringCount: r.expiringIn30Days.count,
      expiringPoints: r.expiringIn30Days.points
    }));
    
    const parser = new Parser({ fields });
    const csv = parser.parse(csvData);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('all-members-points-report.csv');
    return res.send(csv);
  }
  
  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      totalMembers: reports.length,
      totalAvailable: reports.reduce((sum, r) => sum + r.balance.available, 0),
      totalFrozen: reports.reduce((sum, r) => sum + r.balance.frozen, 0),
      totalExpiring30Days: reports.reduce((sum, r) => sum + r.expiringIn30Days.points, 0),
      members: reports
    }
  });
});

module.exports = router;
