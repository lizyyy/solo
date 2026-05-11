const { Op, fn, col } = require('sequelize');
const {
  Project,
  BillRecord,
  SharedAllocation,
  Anomaly,
  BudgetAlert,
  ManualAssignment,
  User,
} = require('../db/models');

async function getDashboardStats(req, res) {
  try {
    const { billMonth } = req.query;
    
    if (!billMonth) {
      return res.status(400).json({ success: false, message: '请指定账单月份' });
    }

    const [
      totalCost,
      autoAllocatedCost,
      manualAllocatedCost,
      sharedServiceCost,
      unallocatedCount,
      totalProjects,
      openAnomalies,
      activeAlerts,
    ] = await Promise.all([
      BillRecord.sum('costAmount', { where: { billMonth } }),
      BillRecord.sum('costAmount', { where: { billMonth, allocationMethod: 'auto_tag' } }),
      BillRecord.sum('costAmount', { where: { billMonth, allocationMethod: 'manual' } }),
      BillRecord.sum('costAmount', { where: { billMonth, allocationMethod: 'shared_service' } }),
      BillRecord.count({ where: { billMonth, allocationMethod: 'unallocated' } }),
      Project.count({ where: { isActive: true } }),
      Anomaly.count({ where: { billMonth, status: 'open' } }),
      BudgetAlert.count({ where: { alertMonth: billMonth, isAcknowledged: false } }),
    ]);

    const sharedAllocations = await SharedAllocation.findAll({
      where: { billMonth },
      include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
    });

    const sharedAllocationByProject = {};
    sharedAllocations.forEach((alloc) => {
      const projectId = alloc.projectId;
      if (!sharedAllocationByProject[projectId]) {
        sharedAllocationByProject[projectId] = {
          projectId,
          projectName: alloc.project?.name,
          totalAmount: 0,
        };
      }
      sharedAllocationByProject[projectId].totalAmount += parseFloat(alloc.allocatedAmount);
    });

    res.json({
      success: true,
      data: {
        totalCost: parseFloat(totalCost || 0),
        autoAllocatedCost: parseFloat(autoAllocatedCost || 0),
        manualAllocatedCost: parseFloat(manualAllocatedCost || 0),
        sharedServiceCost: parseFloat(sharedServiceCost || 0),
        unallocatedCount,
        totalProjects,
        openAnomalies,
        activeAlerts,
        sharedAllocationByProject: Object.values(sharedAllocationByProject),
      },
    });
  } catch (error) {
    console.error('获取看板统计失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getProjectCosts(req, res) {
  try {
    const { billMonth } = req.query;
    
    if (!billMonth) {
      return res.status(400).json({ success: false, message: '请指定账单月份' });
    }

    const projects = await Project.findAll({
      where: { isActive: true },
      include: [
        {
          model: BillRecord,
          as: 'billRecords',
          where: { billMonth },
          required: false,
          attributes: [[fn('SUM', col('costAmount')), 'totalCost']],
        },
      ],
    });

    const sharedAllocations = await SharedAllocation.findAll({
      where: { billMonth },
      attributes: ['projectId', [fn('SUM', col('allocatedAmount')), 'sharedCost']],
      group: ['projectId'],
    });

    const sharedCostMap = {};
    sharedAllocations.forEach((sa) => {
      sharedCostMap[sa.projectId] = parseFloat(sa.get('sharedCost') || 0);
    });

    const projectCosts = projects.map((p) => {
      const directCost = parseFloat(p.billRecords?.[0]?.get('totalCost') || 0);
      const sharedCost = sharedCostMap[p.id] || 0;
      const totalCost = directCost + sharedCost;
      const budgetUsage = p.budgetAmount > 0 ? (totalCost / p.budgetAmount) * 100 : 0;
      const budgetRemaining = Math.max(0, parseFloat(p.budgetAmount) - totalCost);

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        budgetAmount: parseFloat(p.budgetAmount),
        budgetPeriod: p.budgetPeriod,
        directCost,
        sharedCost,
        totalCost,
        budgetUsage: parseFloat(budgetUsage.toFixed(2)),
        budgetRemaining,
        isOverBudget: totalCost > parseFloat(p.budgetAmount),
        isNearBudget: budgetUsage >= 70 && budgetUsage < 100,
      };
    });

    res.json({
      success: true,
      data: projectCosts.sort((a, b) => b.totalCost - a.totalCost),
    });
  } catch (error) {
    console.error('获取项目成本失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getAnomalies(req, res) {
  try {
    const { billMonth, status, anomalyType, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const where = {};

    if (billMonth) where.billMonth = billMonth;
    if (status) where.status = status;
    if (anomalyType) where.anomalyType = anomalyType;

    const { count, rows } = await Anomaly.findAndCountAll({
      where,
      include: [
        {
          model: BillRecord,
          as: 'billRecord',
          attributes: ['id', 'resourceId', 'resourceName', 'costAmount', 'tags'],
        },
        {
          model: SharedService,
          as: 'sharedService',
          attributes: ['id', 'name', 'code'],
        },
      ],
      order: [['severity', 'DESC'], ['createdAt', 'DESC']],
      offset,
      limit: parseInt(pageSize),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取异常列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function handleAnomaly(req, res) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    const anomaly = await Anomaly.findByPk(id);
    if (!anomaly) {
      return res.status(404).json({ success: false, message: '异常记录不存在' });
    }

    await anomaly.update({
      status,
      resolvedBy: req.user.id,
      resolvedAt: new Date(),
      resolutionNote,
    });

    res.json({ success: true, message: '异常处理成功' });
  } catch (error) {
    console.error('处理异常失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getBudgetAlerts(req, res) {
  try {
    const { billMonth, isAcknowledged } = req.query;
    const where = {};

    if (billMonth) where.alertMonth = billMonth;
    if (isAcknowledged !== undefined && isAcknowledged !== '') {
      where.isAcknowledged = isAcknowledged === 'true';
    }

    const alerts = await BudgetAlert.findAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name', 'code', 'budgetAmount'] },
        { model: User, as: 'acknowledgedBy', attributes: ['id', 'fullName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取预算预警失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const { id } = req.params;

    const alert = await BudgetAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({ success: false, message: '预警不存在' });
    }

    await alert.update({
      isAcknowledged: true,
      acknowledgedBy: req.user.id,
      acknowledgedAt: new Date(),
    });

    res.json({ success: true, message: '预警已确认' });
  } catch (error) {
    console.error('确认预警失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getManualAssignmentHistory(req, res) {
  try {
    const { billMonth, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    const where = {};

    const { count, rows } = await ManualAssignment.findAndCountAll({
      where,
      include: [
        {
          model: BillRecord,
          as: 'billRecord',
          attributes: ['id', 'resourceId', 'resourceName', 'costAmount', 'billMonth'],
          where: billMonth ? { billMonth } : undefined,
        },
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'assignedByUser', attributes: ['id', 'fullName'] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(pageSize),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取人工分配历史失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function exportCostReport(req, res) {
  try {
    const { billMonth, format = 'json' } = req.query;
    
    if (!billMonth) {
      return res.status(400).json({ success: false, message: '请指定账单月份' });
    }

    const [projectCosts, directRecords, sharedAllocations] = await Promise.all([
      getProjectCostsWithQuery(billMonth),
      BillRecord.findAll({
        where: { billMonth, allocationMethod: { [Op.ne]: 'shared_service' } },
        include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'code'] }],
        order: [['costAmount', 'DESC']],
      }),
      SharedAllocation.findAll({
        where: { billMonth },
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
          { model: SharedService, as: 'sharedService', attributes: ['id', 'name', 'code'] },
          {
            model: BillRecord,
            as: 'billRecord',
            attributes: ['id', 'resourceId', 'resourceName', 'costAmount'],
          },
        ],
      }),
    ]);

    const report = {
      billMonth,
      generatedAt: new Date().toISOString(),
      summary: {
        projects: projectCosts,
        totalCost: projectCosts.reduce((sum, p) => sum + p.totalCost, 0),
      },
      details: {
        directAssignments: directRecords.map((r) => ({
          projectName: r.project?.name,
          resourceName: r.resourceName,
          resourceType: r.resourceType,
          productName: r.productName,
          region: r.region,
          costAmount: parseFloat(r.costAmount),
          allocationMethod: r.allocationMethod,
          environment: r.environment,
        })),
        sharedAllocations: sharedAllocations.map((sa) => ({
          sharedServiceName: sa.sharedService?.name,
          projectName: sa.project?.name,
          resourceName: sa.billRecord?.resourceName,
          ratio: parseFloat(sa.ratio),
          allocatedAmount: parseFloat(sa.allocatedAmount),
        })),
      },
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=cost-report-${billMonth}.json`);
      res.json(report);
    } else {
      res.json({ success: true, data: report });
    }
  } catch (error) {
    console.error('导出成本报表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getProjectCostsWithQuery(billMonth) {
  const projects = await Project.findAll({
    where: { isActive: true },
    include: [
      {
        model: BillRecord,
        as: 'billRecords',
        where: { billMonth },
        required: false,
        attributes: [[fn('SUM', col('costAmount')), 'totalCost']],
      },
    ],
  });

  const sharedAllocations = await SharedAllocation.findAll({
    where: { billMonth },
    attributes: ['projectId', [fn('SUM', col('allocatedAmount')), 'sharedCost']],
    group: ['projectId'],
  });

  const sharedCostMap = {};
  sharedAllocations.forEach((sa) => {
    sharedCostMap[sa.projectId] = parseFloat(sa.get('sharedCost') || 0);
  });

  return projects.map((p) => {
    const directCost = parseFloat(p.billRecords?.[0]?.get('totalCost') || 0);
    const sharedCost = sharedCostMap[p.id] || 0;
    const totalCost = directCost + sharedCost;

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      budgetAmount: parseFloat(p.budgetAmount),
      budgetPeriod: p.budgetPeriod,
      directCost,
      sharedCost,
      totalCost,
      budgetUsage: p.budgetAmount > 0 ? parseFloat(((totalCost / p.budgetAmount) * 100).toFixed(2)) : 0,
      budgetRemaining: Math.max(0, parseFloat(p.budgetAmount) - totalCost),
    };
  }).sort((a, b) => b.totalCost - a.totalCost);
}

module.exports = {
  getDashboardStats,
  getProjectCosts,
  getAnomalies,
  handleAnomaly,
  getBudgetAlerts,
  acknowledgeAlert,
  getManualAssignmentHistory,
  exportCostReport,
};
