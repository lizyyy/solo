const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
  loadJSON, 
  saveJSON, 
  getNextId, 
  stableUpdate 
} = require('./dataStore');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const requestTracker = new Map();
const MAX_REQUEST_AGE = 10000;

function generateRequestId(req) {
  const body = JSON.stringify(req.body || {});
  const url = req.originalUrl;
  const method = req.method;
  return `${method}:${url}:${body}`;
}

function ensureIdempotency(req, res, next) {
  const requestId = generateRequestId(req);
  const now = Date.now();
  
  for (const [key, value] of requestTracker) {
    if (now - value.timestamp > MAX_REQUEST_AGE) {
      requestTracker.delete(key);
    }
  }
  
  if (requestTracker.has(requestId)) {
    const cached = requestTracker.get(requestId);
    return res.status(200).json({
      ...cached.response,
      _cached: true,
      _requestId: requestId
    });
  }
  
  res.cacheResponse = (response) => {
    requestTracker.set(requestId, {
      response,
      timestamp: now
    });
  };
  
  next();
}

app.get('/api/overview', (req, res) => {
  try {
    const employees = loadJSON('employees.json');
    const assets = loadJSON('assets.json');
    const acceptances = loadJSON('returnAcceptances.json');
    const fees = loadJSON('damageFees.json');
    const differences = loadJSON('inventoryDifferences.json');
    const reviews = loadJSON('reviewRecords.json');

    const stats = {
      totalAssets: assets.length,
      inUseAssets: assets.filter(a => a.status === 'in_use').length,
      pendingReturnAssets: assets.filter(a => a.status === 'pending_return').length,
      pendingReviews: reviews.filter(r => r.status === 'pending').length,
      pendingAcceptances: acceptances.filter(a => a.status === 'pending').length,
      pendingFees: fees.filter(f => f.status === 'pending_approval').length,
      pendingDifferences: differences.filter(d => d.status === 'pending').length,
      resignedEmployees: employees.filter(e => e.status === 'resigned').length,
      pendingResignation: employees.filter(e => e.status === 'pending_resignation').length
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/employees', (req, res) => {
  try {
    const { status, search } = req.query;
    let employees = loadJSON('employees.json');

    if (status) {
      employees = employees.filter(e => e.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      employees = employees.filter(e => 
        e.name.toLowerCase().includes(searchLower) ||
        e.id.toLowerCase().includes(searchLower) ||
        e.department.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/employees/:id/validate-resignation', (req, res) => {
  try {
    const { id } = req.params;
    const employees = loadJSON('employees.json');
    const assets = loadJSON('assets.json');
    const acceptances = loadJSON('returnAcceptances.json');
    const fees = loadJSON('damageFees.json');

    const employee = employees.find(e => e.id === id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: '员工不存在'
      });
    }

    const employeeAssets = assets.filter(a => a.currentHolder === id || 
      acceptances.some(acc => acc.employeeId === id && acc.assetId === a.id));

    const pendingAssets = employeeAssets.filter(a => 
      a.status === 'pending_return' || a.currentHolder === id
    );

    const pendingAcceptances = acceptances.filter(acc => 
      acc.employeeId === id && acc.status === 'pending'
    );

    const pendingFees = fees.filter(f => 
      f.employeeId === id && (f.status === 'pending_approval' || f.status === 'pending_payment')
    );

    const isResigned = employee.status === 'resigned';
    const isPendingResignation = employee.status === 'pending_resignation';

    const result = {
      employeeId: id,
      employeeName: employee.name,
      currentStatus: employee.status,
      isResigned,
      isPendingResignation,
      canProceed: isResigned || (isPendingResignation && pendingAssets.length === 0 && pendingAcceptances.length === 0 && pendingFees.length === 0),
      issues: {
        pendingAssets: pendingAssets.map(a => ({
          id: a.id,
          assetNumber: a.assetNumber,
          name: a.name,
          status: a.status
        })),
        pendingAcceptances: pendingAcceptances.map(acc => ({
          id: acc.id,
          assetNumber: acc.assetNumber,
          status: acc.status
        })),
        pendingFees: pendingFees.map(f => ({
          id: f.id,
          feeAmount: f.newFeeAmount || f.feeAmount,
          status: f.status
        }))
      },
      oldStatus: employee.status,
      newStatus: isPendingResignation ? 'resigned' : employee.status
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/assets', (req, res) => {
  try {
    const { status, search, category } = req.query;
    let assets = loadJSON('assets.json');
    const employees = loadJSON('employees.json');

    if (status) {
      assets = assets.filter(a => a.status === status);
    }

    if (category) {
      assets = assets.filter(a => a.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      assets = assets.filter(a => 
        a.assetNumber.toLowerCase().includes(searchLower) ||
        (a.previousAssetNumber && a.previousAssetNumber.toLowerCase().includes(searchLower)) ||
        a.name.toLowerCase().includes(searchLower)
      );
    }

    const assetsWithHolder = assets.map(asset => {
      const holder = employees.find(e => e.id === asset.currentHolder);
      return {
        ...asset,
        holderName: holder ? holder.name : null,
        hasNumberChange: asset.assetNumber !== asset.previousAssetNumber
      };
    });

    res.json({
      success: true,
      data: assetsWithHolder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/return-acceptances', (req, res) => {
  try {
    const { status, search } = req.query;
    let acceptances = loadJSON('returnAcceptances.json');

    if (status) {
      acceptances = acceptances.filter(a => a.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      acceptances = acceptances.filter(a => 
        a.assetNumber.toLowerCase().includes(searchLower) ||
        a.employeeName.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: acceptances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/damage-fees', (req, res) => {
  try {
    const { status, search } = req.query;
    let fees = loadJSON('damageFees.json');

    if (status) {
      fees = fees.filter(f => f.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      fees = fees.filter(f => 
        f.assetNumber.toLowerCase().includes(searchLower) ||
        f.employeeName.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/damage-fees/:id/advance', ensureIdempotency, (req, res) => {
  try {
    const { id } = req.params;
    const { approver, approverName } = req.body;

    let fees = loadJSON('damageFees.json');
    const fee = fees.find(f => f.id === id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        error: '损坏扣费记录不存在'
      });
    }

    const oldStatus = fee.status;
    let newStatus = fee.status;
    let canAdvance = false;

    if (fee.status === 'pending_approval') {
      newStatus = 'pending_payment';
      canAdvance = true;
      fee.approver = approver || 'admin-01';
      fee.approverName = approverName || '系统管理员';
      fee.approvalDate = new Date().toISOString().split('T')[0];
    } else if (fee.status === 'pending_payment') {
      newStatus = 'completed';
      canAdvance = true;
      fee.paymentDate = new Date().toISOString().split('T')[0];
    } else {
      newStatus = fee.status;
    }

    fee.status = newStatus;
    fee.oldStatus = oldStatus;
    fee.newStatus = newStatus;

    saveJSON('damageFees.json', fees);

    const trails = loadJSON('assetTrails.json');
    const trail = {
      id: getNextId(trails, 'trail'),
      assetId: fee.assetId,
      assetNumber: fee.assetNumber,
      previousAssetNumber: fee.assetNumber,
      timestamp: new Date().toISOString(),
      action: 'fee_advance',
      oldStatus,
      newStatus,
      operator: approver || 'admin-01',
      operatorName: approverName || '系统管理员',
      notes: `损坏扣费从 ${oldStatus} 推进到 ${newStatus}`
    };
    trails.push(trail);
    saveJSON('assetTrails.json', trails);

    const response = {
      success: true,
      data: {
        id: fee.id,
        oldStatus,
        newStatus,
        canAdvance,
        isFinal: newStatus === 'completed',
        changes: {
          status: { oldValue: oldStatus, newValue: newStatus }
        }
      }
    };

    res.cacheResponse(response);
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/inventory-differences', (req, res) => {
  try {
    const { status, search, responsiblePerson, startDate, endDate } = req.query;
    let differences = loadJSON('inventoryDifferences.json');

    if (status) {
      differences = differences.filter(d => d.status === status);
    }

    if (responsiblePerson) {
      differences = differences.filter(d => 
        d.responsiblePerson === responsiblePerson || 
        d.responsiblePersonName.includes(responsiblePerson)
      );
    }

    if (startDate) {
      differences = differences.filter(d => d.reportDate >= startDate);
    }

    if (endDate) {
      differences = differences.filter(d => d.reportDate <= endDate);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      differences = differences.filter(d => 
        d.assetNumber.toLowerCase().includes(searchLower) ||
        d.responsiblePersonName.toLowerCase().includes(searchLower) ||
        d.description.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: differences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/inventory-differences', ensureIdempotency, (req, res) => {
  try {
    const {
      assetId,
      assetNumber,
      previousAssetNumber,
      inventoryPeriod,
      oldLocation,
      newLocation,
      oldStatus,
      newStatus,
      oldHolder,
      newHolder,
      oldHolderName,
      newHolderName,
      discrepancyType,
      description,
      responsiblePerson,
      responsiblePersonName,
      notes
    } = req.body;

    if (!assetNumber || !description) {
      return res.status(400).json({
        success: false,
        error: '资产编号和描述为必填项'
      });
    }

    let differences = loadJSON('inventoryDifferences.json');

    const newDiff = {
      id: getNextId(differences, 'diff'),
      assetId: assetId || null,
      assetNumber,
      previousAssetNumber: previousAssetNumber || assetNumber,
      inventoryPeriod: inventoryPeriod || '2026-Q2',
      oldLocation: oldLocation || null,
      newLocation: newLocation || null,
      oldStatus: oldStatus || null,
      newStatus: newStatus || null,
      oldHolder: oldHolder || null,
      newHolder: newHolder || null,
      oldHolderName: oldHolderName || null,
      newHolderName: newHolderName || null,
      discrepancyType: discrepancyType || '未分类',
      description,
      reportDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      responsiblePerson: responsiblePerson || null,
      responsiblePersonName: responsiblePersonName || '未指定',
      notes: notes || ''
    };

    const existing = differences.find(d => 
      d.assetNumber === assetNumber && 
      d.inventoryPeriod === newDiff.inventoryPeriod
    );

    if (existing) {
      const changes = {};
      Object.keys(newDiff).forEach(key => {
        if (key !== 'id' && key !== 'reportDate' && JSON.stringify(existing[key]) !== JSON.stringify(newDiff[key])) {
          changes[key] = {
            oldValue: existing[key],
            newValue: newDiff[key]
          };
        }
      });

      if (Object.keys(changes).length > 0) {
        Object.assign(existing, newDiff);
        existing.id = existing.id;
        saveJSON('inventoryDifferences.json', differences);
      }

      const response = {
        success: true,
        data: {
          id: existing.id,
          ...existing,
          isNew: false,
          changes
        }
      };
      res.cacheResponse(response);
      return res.json(response);
    }

    differences.push(newDiff);
    saveJSON('inventoryDifferences.json', differences);

    const response = {
      success: true,
      data: {
        ...newDiff,
        isNew: true,
        changes: {}
      }
    };
    res.cacheResponse(response);
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/review-records', (req, res) => {
  try {
    const { type, status, search } = req.query;
    let reviews = loadJSON('reviewRecords.json');

    if (type) {
      reviews = reviews.filter(r => r.type === type);
    }

    if (status) {
      reviews = reviews.filter(r => r.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      reviews = reviews.filter(r => 
        (r.assetNumber && r.assetNumber.toLowerCase().includes(searchLower)) ||
        (r.employeeName && r.employeeName.toLowerCase().includes(searchLower)) ||
        r.notes.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/asset-trails', (req, res) => {
  try {
    const { assetId, assetNumber, action } = req.query;
    let trails = loadJSON('assetTrails.json');

    if (assetId) {
      trails = trails.filter(t => t.assetId === assetId);
    }

    if (assetNumber) {
      trails = trails.filter(t => 
        t.assetNumber === assetNumber || 
        t.previousAssetNumber === assetNumber
      );
    }

    if (action) {
      trails = trails.filter(t => t.action === action);
    }

    trails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: trails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/export/report', (req, res) => {
  try {
    const { responsiblePerson, startDate, endDate, format } = req.query;

    let differences = loadJSON('inventoryDifferences.json');
    let fees = loadJSON('damageFees.json');
    let acceptances = loadJSON('returnAcceptances.json');
    let reviews = loadJSON('reviewRecords.json');

    if (responsiblePerson) {
      differences = differences.filter(d => 
        d.responsiblePerson === responsiblePerson || 
        d.responsiblePersonName.includes(responsiblePerson)
      );
      fees = fees.filter(f => 
        f.operatorName.includes(responsiblePerson) ||
        f.employeeName.includes(responsiblePerson)
      );
      reviews = reviews.filter(r => 
        r.reviewerName && r.reviewerName.includes(responsiblePerson)
      );
    }

    if (startDate) {
      differences = differences.filter(d => d.reportDate >= startDate);
      fees = fees.filter(f => f.reportDate >= startDate);
      acceptances = acceptances.filter(a => a.acceptanceDate >= startDate);
    }

    if (endDate) {
      differences = differences.filter(d => d.reportDate <= endDate);
      fees = fees.filter(f => f.reportDate <= endDate);
      acceptances = acceptances.filter(a => a.acceptanceDate <= endDate);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      filters: {
        responsiblePerson,
        startDate,
        endDate
      },
      summary: {
        totalDifferences: differences.length,
        pendingDifferences: differences.filter(d => d.status === 'pending').length,
        resolvedDifferences: differences.filter(d => d.status === 'resolved').length,
        totalFees: fees.length,
        pendingFees: fees.filter(f => f.status === 'pending_approval' || f.status === 'pending_payment').length,
        totalAmount: fees.reduce((sum, f) => sum + (f.newFeeAmount || f.feeAmount || 0), 0),
        totalAcceptances: acceptances.length,
        totalReviews: reviews.length
      },
      details: {
        inventoryDifferences: differences,
        damageFees: fees,
        returnAcceptances: acceptances,
        reviewRecords: reviews
      }
    };

    if (format === 'csv') {
      let csv = '类型,资产编号,员工,责任人,日期,状态,变更前,变更后\n';
      
      differences.forEach(d => {
        csv += `盘点差异,${d.assetNumber},${d.oldHolderName || ''},${d.responsiblePersonName},${d.reportDate},${d.status},"${d.oldLocation || ''} → ${d.newLocation || ''}","${d.oldStatus || ''} → ${d.newStatus || ''}"\n`;
      });

      fees.forEach(f => {
        csv += `损坏扣费,${f.assetNumber},${f.employeeName},${f.operatorName},${f.reportDate},${f.status},${f.oldValue || ''},${f.newFeeAmount || f.feeAmount || ''}\n`;
      });

      acceptances.forEach(a => {
        csv += `归还验收,${a.assetNumber},${a.employeeName},${a.operatorName},${a.acceptanceDate},${a.status},${a.oldCondition || ''},${a.newCondition || ''}\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=asset_report_${Date.now()}.csv`);
      return res.send('\uFEFF' + csv);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/search', (req, res) => {
  try {
    const { q, type } = req.query;
    const searchLower = (q || '').toLowerCase();

    const assets = loadJSON('assets.json');
    const employees = loadJSON('employees.json');
    const acceptances = loadJSON('returnAcceptances.json');
    const fees = loadJSON('damageFees.json');
    const differences = loadJSON('inventoryDifferences.json');

    const results = {
      assets: [],
      employees: [],
      acceptances: [],
      fees: [],
      differences: []
    };

    if (!type || type === 'all' || type === 'assets') {
      results.assets = assets.filter(a => 
        a.assetNumber.toLowerCase().includes(searchLower) ||
        (a.previousAssetNumber && a.previousAssetNumber.toLowerCase().includes(searchLower)) ||
        a.name.toLowerCase().includes(searchLower)
      ).slice(0, 10);
    }

    if (!type || type === 'all' || type === 'employees') {
      results.employees = employees.filter(e => 
        e.name.toLowerCase().includes(searchLower) ||
        e.id.toLowerCase().includes(searchLower)
      ).slice(0, 10);
    }

    if (!type || type === 'all' || type === 'acceptances') {
      results.acceptances = acceptances.filter(a => 
        a.assetNumber.toLowerCase().includes(searchLower) ||
        a.employeeName.toLowerCase().includes(searchLower)
      ).slice(0, 10);
    }

    if (!type || type === 'all' || type === 'fees') {
      results.fees = fees.filter(f => 
        f.assetNumber.toLowerCase().includes(searchLower) ||
        f.employeeName.toLowerCase().includes(searchLower)
      ).slice(0, 10);
    }

    if (!type || type === 'all' || type === 'differences') {
      results.differences = differences.filter(d => 
        d.assetNumber.toLowerCase().includes(searchLower) ||
        d.responsiblePersonName.toLowerCase().includes(searchLower)
      ).slice(0, 10);
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`资产设备管理工具服务已启动: http://localhost:${PORT}`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`API 说明请查看 README.md`);
  console.log(`\n如端口被占用，可使用: PORT=4001 npm start`);
});

module.exports = app;
