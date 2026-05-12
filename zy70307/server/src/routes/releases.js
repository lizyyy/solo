const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { loadData, saveData, generateId } = require('../utils/dataStore');
const { batchEvaluate, generateMockRequests } = require('../services/rateLimitEngine');

router.get('/', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.releases });
});

router.get('/current', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.currentRelease });
});

router.post('/preview', (req, res) => {
  const { ruleIds, requests: customRequests, mockCount = 50 } = req.body;
  const data = loadData();
  
  const selectedRules = ruleIds ? 
    data.rules.filter(r => ruleIds.includes(r.id)) : 
    data.rules.filter(r => r.status !== 'DEPRECATED');
  
  const requests = customRequests || generateMockRequests(mockCount);
  const result = batchEvaluate(
    requests,
    selectedRules,
    data.tenants,
    data.interfaceGroups,
    data.regions
  );
  
  res.json({ 
    success: true, 
    data: {
      ...result,
      selectedRules: selectedRules.map(r => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
        vipExempt: r.vipExempt,
        regionCode: r.regionCode,
      })),
    } 
  });
});

router.post('/', (req, res) => {
  const data = loadData();
  const { name, description, ruleIds } = req.body;
  
  const existingRelease = data.releases.find(
    r => r.status === 'ACTIVE' && JSON.stringify(r.ruleIds.sort()) === JSON.stringify(ruleIds.sort())
  );
  
  if (existingRelease) {
    return res.status(400).json({ 
      success: false, 
      message: '相同规则组合的发布已存在且处于激活状态' 
    });
  }
  
  const sameVersion = data.releases.find(
    r => JSON.stringify(r.ruleIds.sort()) === JSON.stringify(ruleIds.sort())
  );
  
  const version = sameVersion ? 
    `${sameVersion.version.split('.')[0]}.${parseInt(sameVersion.version.split('.')[1]) + 1}` : 
    `${dayjs().format('YYYYMMDD')}.1`;
  
  const release = {
    id: generateId(),
    name,
    description,
    ruleIds,
    version,
    status: 'PENDING',
    releasedAt: null,
    pausedAt: null,
    rolledBackAt: null,
    createdAt: dayjs().toISOString(),
  };
  
  data.releases.push(release);
  saveData(data);
  
  res.json({ success: true, data: release });
});

router.post('/:id/publish', (req, res) => {
  const data = loadData();
  const release = data.releases.find(r => r.id === req.params.id);
  
  if (!release) {
    return res.status(404).json({ success: false, message: '发布批次不存在' });
  }
  
  if (release.status === 'ACTIVE') {
    const activeRules = data.rules.filter(r => r.status === 'ACTIVE');
    const sameRules = release.ruleIds.every(id => activeRules.some(r => r.id === id)) &&
                      activeRules.every(r => release.ruleIds.includes(r.id));
    if (sameRules) {
      return res.status(400).json({ success: false, message: '该版本已发布且处于激活状态' });
    }
  }
  
  if (data.currentRelease && data.currentRelease.id !== release.id) {
    const previousRelease = data.releases.find(r => r.id === data.currentRelease.id);
    if (previousRelease) {
      previousRelease.status = 'DEPRECATED';
      previousRelease.rolledBackAt = dayjs().toISOString();
    }
    data.rules.forEach(r => {
      if (r.status === 'ACTIVE') {
        r.status = 'DEPRECATED';
      }
    });
  }
  
  release.status = 'ACTIVE';
  release.releasedAt = dayjs().toISOString();
  
  data.rules.forEach(r => {
    if (release.ruleIds.includes(r.id)) {
      r.status = 'ACTIVE';
      r.releaseId = release.id;
      r.releasedAt = dayjs().toISOString();
    }
  });
  
  data.currentRelease = {
    id: release.id,
    name: release.name,
    version: release.version,
    releasedAt: release.releasedAt,
  };
  
  saveData(data);
  
  res.json({ success: true, data: release });
});

router.post('/:id/pause', (req, res) => {
  const data = loadData();
  const release = data.releases.find(r => r.id === req.params.id);
  
  if (!release) {
    return res.status(404).json({ success: false, message: '发布批次不存在' });
  }
  
  if (release.status !== 'ACTIVE') {
    return res.status(400).json({ success: false, message: '只有激活状态的发布可以暂停' });
  }
  
  release.status = 'PAUSED';
  release.pausedAt = dayjs().toISOString();
  
  data.rules.forEach(r => {
    if (release.ruleIds.includes(r.id)) {
      r.status = 'PAUSED';
    }
  });
  
  data.currentRelease = null;
  saveData(data);
  
  res.json({ success: true, data: release });
});

router.post('/:id/rollback', (req, res) => {
  const data = loadData();
  const release = data.releases.find(r => r.id === req.params.id);
  
  if (!release) {
    return res.status(404).json({ success: false, message: '发布批次不存在' });
  }
  
  const previousRelease = data.releases
    .filter(r => r.id !== release.id && r.status !== 'PENDING')
    .sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
  
  release.status = 'ROLLED_BACK';
  release.rolledBackAt = dayjs().toISOString();
  
  data.rules.forEach(r => {
    if (release.ruleIds.includes(r.id)) {
      r.status = 'ROLLED_BACK';
    }
  });
  
  if (previousRelease) {
    previousRelease.status = 'ACTIVE';
    data.rules.forEach(r => {
      if (previousRelease.ruleIds.includes(r.id)) {
        r.status = 'ACTIVE';
      }
    });
    data.currentRelease = {
      id: previousRelease.id,
      name: previousRelease.name,
      version: previousRelease.version,
      releasedAt: previousRelease.releasedAt,
    };
  } else {
    data.currentRelease = null;
  }
  
  saveData(data);
  
  res.json({ success: true, data: { release, previousRelease } });
});

module.exports = router;
