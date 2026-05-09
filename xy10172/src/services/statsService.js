const Contract = require('../models/Contract');
const AuditLog = require('../models/AuditLog');
const ContractVersion = require('../models/ContractVersion');

async function getContractStats(options = {}) {
  const { startDate, endDate, initiatorId } = options;

  const matchQuery = { isDeleted: false };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  if (initiatorId) {
    matchQuery['initiator.id'] = initiatorId;
  }

  const stats = await Contract.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await Contract.countDocuments(matchQuery);

  const byStatus = stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    total,
    byStatus,
    breakdown: stats
  };
}

async function getDashboardStats(options = {}) {
  const { startDate, endDate } = options;

  const dateQuery = {};
  if (startDate || endDate) {
    dateQuery.timestamp = {};
    if (startDate) dateQuery.timestamp.$gte = new Date(startDate);
    if (endDate) dateQuery.timestamp.$lte = new Date(endDate);
  }

  const [
    contractStats,
    totalContracts,
    createdToday,
    completedToday,
    actionStats,
    versionStats
  ] = await Promise.all([
    getContractStats(options),
    Contract.countDocuments({ isDeleted: false }),
    Contract.countDocuments({
      isDeleted: false,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }),
    Contract.countDocuments({
      isDeleted: false,
      status: 'completed',
      updatedAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }),
    AuditLog.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]),
    ContractVersion.aggregate([
      { $match: { isFrozen: true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const actionBreakdown = actionStats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    contracts: contractStats,
    summary: {
      total: totalContracts,
      createdToday,
      completedToday,
      frozenVersions: versionStats[0]?.count || 0
    },
    actions: {
      total: actionStats.reduce((sum, item) => sum + item.count, 0),
      breakdown: actionBreakdown
    }
  };
}

async function getMonthlyTrend(months = 6) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await Contract.aggregate([
    {
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    }
  ]);

  const trend = {};
  result.forEach(item => {
    const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
    if (!trend[key]) {
      trend[key] = { total: 0 };
    }
    trend[key][item._id.status] = item.count;
    trend[key].total += item.count;
  });

  return trend;
}

async function getInitiatorStats(options = {}) {
  const { limit = 10 } = options;

  const result = await Contract.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: {
          id: '$initiator.id',
          name: '$initiator.name',
          email: '$initiator.email'
        },
        total: { $sum: 1 },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        withdrawn: {
          $sum: {
            $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0]
          }
        },
        rejected: {
          $sum: {
            $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
          }
        },
        inProgress: {
          $sum: {
            $cond: [
              {
                $in: ['$status', ['initiated', 'in_signing', 'partially_signed', 'reinitiated']]
              },
              1,
              0
            ]
          }
        }
      }
    },
    { $sort: { total: -1 } },
    { $limit: limit }
  ]);

  return result.map(item => ({
    initiator: item._id,
    stats: {
      total: item.total,
      completed: item.completed,
      withdrawn: item.withdrawn,
      rejected: item.rejected,
      inProgress: item.inProgress,
      completionRate: item.total > 0 ? ((item.completed / item.total) * 100).toFixed(2) : '0.00'
    }
  }));
}

async function getProcessingTimeStats() {
  const result = await Contract.aggregate([
    {
      $match: {
        isDeleted: false,
        status: 'completed'
      }
    },
    {
      $project: {
        createdAt: 1,
        updatedAt: 1,
        processingTime: {
          $subtract: ['$updatedAt', '$createdAt']
        }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        minProcessingTime: { $min: '$processingTime' },
        maxProcessingTime: { $max: '$processingTime' }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      count: 0,
      avgProcessingTime: 0,
      minProcessingTime: 0,
      maxProcessingTime: 0
    };
  }

  const stats = result[0];
  return {
    count: stats.count,
    avgProcessingTimeMs: stats.avgProcessingTime,
    avgProcessingTimeHours: (stats.avgProcessingTime / 3600000).toFixed(2),
    minProcessingTimeMs: stats.minProcessingTime,
    minProcessingTimeHours: (stats.minProcessingTime / 3600000).toFixed(2),
    maxProcessingTimeMs: stats.maxProcessingTime,
    maxProcessingTimeHours: (stats.maxProcessingTime / 3600000).toFixed(2)
  };
}

module.exports = {
  getContractStats,
  getDashboardStats,
  getMonthlyTrend,
  getInitiatorStats,
  getProcessingTimeStats
};
