const express = require('express');
const router = express.Router();
const service = require('../services/pointsService');

router.get('/', (req, res) => {
  const members = service.getAllMembers();
  const withBalances = members.map(m => ({
    ...m,
    balance: service.getMemberBalance(m.member_id)
  }));
  res.json({ success: true, data: withBalances });
});

router.get('/:memberId', (req, res) => {
  const member = service.getMember(req.params.memberId);
  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'MEMBER_NOT_FOUND',
      message: '会员不存在'
    });
  }
  
  const balance = service.getMemberBalance(req.params.memberId);
  res.json({
    success: true,
    data: {
      ...member,
      balance
    }
  });
});

router.post('/', (req, res) => {
  const { memberId, name, phone, level } = req.body;
  
  if (!memberId || !name) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'memberId 和 name 为必填'
    });
  }
  
  const member = service.createMember(memberId, name, phone, level);
  res.status(201).json({
    success: true,
    data: member
  });
});

router.get('/:memberId/summary', (req, res) => {
  const member = service.getMember(req.params.memberId);
  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'MEMBER_NOT_FOUND',
      message: '会员不存在'
    });
  }
  
  const balance = service.getMemberBalance(req.params.memberId);
  const batches = service.getMemberBatches(req.params.memberId);
  const expiringSoon = service.getExpiringSoon(req.params.memberId, 30);
  const ledger = service.getLedger(req.params.memberId, 20);
  
  res.json({
    success: true,
    data: {
      member,
      summary: {
        balance,
        totalBatches: batches.length,
        expiringIn30Days: {
          count: expiringSoon.length,
          totalPoints: expiringSoon.reduce((sum, b) => sum + b.available_points, 0),
          batches: expiringSoon
        },
        recentTransactions: ledger
      }
    }
  });
});

module.exports = router;
