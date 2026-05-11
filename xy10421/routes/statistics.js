const express = require('express');
const router = express.Router();
const store = require('../data/store');

router.get('/', (req, res) => {
  const { agentId, problemType, startDate, endDate } = req.query;
  const stats = store.getStatistics();
  
  const agentMap = {};
  stats.agents.forEach(a => {
    agentMap[a.agentId] = a;
  });
  
  let paidCompensations = stats.compensations.filter(
    c => c.status === 'paid'
  );
  
  if (agentId) {
    paidCompensations = paidCompensations.filter(c => {
      const complaint = stats.complaints.find(compl => compl.complaintId === c.complaintId);
      return complaint && complaint.agentId === agentId;
    });
  }
  
  if (problemType) {
    paidCompensations = paidCompensations.filter(c => {
      const complaint = stats.complaints.find(compl => compl.complaintId === c.complaintId);
      return complaint && complaint.problemType === problemType;
    });
  }
  
  if (startDate) {
    const start = new Date(startDate);
    paidCompensations = paidCompensations.filter(c => {
      if (!c.paidAt) return false;
      return new Date(c.paidAt) >= start;
    });
  }
  
  if (endDate) {
    const end = new Date(endDate);
    paidCompensations = paidCompensations.filter(c => {
      if (!c.paidAt) return false;
      return new Date(c.paidAt) <= end;
    });
  }
  
  const byAgent = {};
  const byProblemType = {};
  const byDate = {};
  
  paidCompensations.forEach(c => {
    const complaint = stats.complaints.find(compl => compl.complaintId === c.complaintId);
    if (!complaint) return;
    
    const agentId = complaint.agentId;
    const pType = complaint.problemType;
    const date = c.paidAt ? c.paidAt.split('T')[0] : 'unknown';
    
    if (!byAgent[agentId]) {
      byAgent[agentId] = {
        agentId,
        agentName: agentMap[agentId]?.name || '未知',
        count: 0,
        totalAmount: 0
      };
    }
    byAgent[agentId].count += 1;
    byAgent[agentId].totalAmount += c.amount;
    
    if (!byProblemType[pType]) {
      byProblemType[pType] = {
        problemType: pType,
        count: 0,
        totalAmount: 0
      };
    }
    byProblemType[pType].count += 1;
    byProblemType[pType].totalAmount += c.amount;
    
    if (!byDate[date]) {
      byDate[date] = {
        date,
        count: 0,
        totalAmount: 0
      };
    }
    byDate[date].count += 1;
    byDate[date].totalAmount += c.amount;
  });
  
  const totalCount = paidCompensations.length;
  const totalAmount = paidCompensations.reduce((sum, c) => sum + c.amount, 0);
  
  res.json({
    summary: {
      totalCount,
      totalAmount,
      avgAmount: totalCount > 0 ? (totalAmount / totalCount).toFixed(2) : 0
    },
    byAgent: Object.values(byAgent).sort((a, b) => b.totalAmount - a.totalAmount),
    byProblemType: Object.values(byProblemType).sort((a, b) => b.totalAmount - a.totalAmount),
    byDate: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  });
});

module.exports = router;
