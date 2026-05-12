import express from 'express';
import store from '../store.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { status, type, severity, limit, offset } = req.query;
  
  let problems = [...store.problems];
  
  if (status) {
    problems = problems.filter(p => p.status === status);
  }
  
  if (type) {
    problems = problems.filter(p => p.type === type);
  }
  
  if (severity) {
    problems = problems.filter(p => p.severity === severity);
  }
  
  problems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const limitNum = limit ? parseInt(limit) : 100;
  const offsetNum = offset ? parseInt(offset) : 0;
  
  const paginated = problems.slice(offsetNum, offsetNum + limitNum);
  
  res.json({
    success: true,
    data: paginated,
    pagination: {
      total: problems.length,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < problems.length
    }
  });
});

router.get('/:id', (req, res) => {
  const problem = store.problems.find(p => p.id === req.params.id);
  
  if (!problem) {
    return res.status(404).json({
      success: false,
      message: '问题记录不存在'
    });
  }
  
  res.json({
    success: true,
    data: problem
  });
});

router.put('/:id/resolve', (req, res) => {
  const problem = store.problems.find(p => p.id === req.params.id);
  
  if (!problem) {
    return res.status(404).json({
      success: false,
      message: '问题记录不存在'
    });
  }
  
  const { resolution } = req.body;
  
  problem.status = 'resolved';
  problem.resolvedAt = new Date().toISOString();
  problem.resolution = resolution || '已解决';
  
  res.json({
    success: true,
    data: problem,
    message: '问题已标记为已解决'
  });
});

router.put('/:id/ignore', (req, res) => {
  const problem = store.problems.find(p => p.id === req.params.id);
  
  if (!problem) {
    return res.status(404).json({
      success: false,
      message: '问题记录不存在'
    });
  }
  
  const { reason } = req.body;
  
  problem.status = 'ignored';
  problem.resolvedAt = new Date().toISOString();
  problem.resolution = reason || '已忽略';
  
  res.json({
    success: true,
    data: problem,
    message: '问题已标记为已忽略'
  });
});

router.get('/stats/summary', (req, res) => {
  const problems = store.problems;
  const openProblems = problems.filter(p => p.status === 'open');
  
  const bySeverity = {
    error: problems.filter(p => p.severity === 'error').length,
    warning: problems.filter(p => p.severity === 'warning').length,
    info: problems.filter(p => p.severity === 'info').length
  };
  
  const byType = {};
  for (const p of problems) {
    byType[p.type] = (byType[p.type] || 0) + 1;
  }
  
  const bySource = {};
  for (const p of problems) {
    bySource[p.source] = (bySource[p.source] || 0) + 1;
  }
  
  res.json({
    success: true,
    data: {
      total: problems.length,
      open: openProblems.length,
      resolved: problems.filter(p => p.status === 'resolved').length,
      ignored: problems.filter(p => p.status === 'ignored').length,
      bySeverity,
      byType,
      bySource,
      recentProblems: openProblems.slice(0, 5)
    }
  });
});

export default router;
