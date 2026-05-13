const Contract = require('../models/Contract');
const ContractVersion = require('../models/ContractVersion');
const AuditLog = require('../models/AuditLog');
const CallbackRecord = require('../models/CallbackRecord');

async function getContractFullHistory(contractId) {
  const [contract, versions, auditLogs, callbacks] = await Promise.all([
    Contract.findById(contractId).lean(),
    ContractVersion.find({ contractId }).sort({ version: 1 }).lean(),
    AuditLog.find({ contractId }).sort({ timestamp: 1 }).lean(),
    CallbackRecord.find({ contractId }).sort({ createdAt: 1 }).lean()
  ]);

  if (!contract) {
    throw new Error('合同不存在');
  }

  const events = [];

  versions.forEach(version => {
    events.push({
      type: 'version',
      timestamp: version.createdAt,
      version: version.version,
      data: version
    });
  });

  auditLogs.forEach(log => {
    events.push({
      type: 'audit',
      timestamp: log.timestamp,
      operationId: log.operationId,
      action: log.action,
      data: log
    });
  });

  callbacks.forEach(callback => {
    events.push({
      type: 'callback',
      timestamp: callback.createdAt,
      callbackId: callback.callbackId,
      event: callback.event,
      status: callback.status,
      data: callback
    });
  });

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    contract,
    timeline: events,
    summary: {
      totalVersions: versions.length,
      totalAuditLogs: auditLogs.length,
      totalCallbacks: callbacks.length,
      totalEvents: events.length
    }
  };
}

async function getVersionTimeline(contractId) {
  const versions = await ContractVersion.find({ contractId })
    .sort({ version: 1 })
    .lean();

  const timeline = [];

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const nextVersion = versions[i + 1];

    const entry = {
      version: version.version,
      createdAt: version.createdAt,
      status: version.status,
      isFrozen: version.isFrozen,
      frozenAt: version.frozenAt,
      freezeReason: version.freezeReason,
      changes: []
    };

    if (nextVersion) {
      if (version.title !== nextVersion.title) {
        entry.changes.push({
          field: 'title',
          from: version.title,
          to: nextVersion.title
        });
      }

      if (version.status !== nextVersion.status) {
        entry.changes.push({
          field: 'status',
          from: version.status,
          to: nextVersion.status
        });
      }

      if (version.parties.length !== nextVersion.parties.length) {
        entry.changes.push({
          field: 'parties',
          from: `${version.parties.length} 方`,
          to: `${nextVersion.parties.length} 方`
        });
      }
    }

    timeline.push(entry);
  }

  return timeline;
}

async function getStateTransitionHistory(contractId) {
  const auditLogs = await AuditLog.find({
    contractId,
    action: {
      $in: ['initiate_signing', 'sign', 'reject', 'withdraw', 'reinitiate', 'complete', 'status_change']
    }
  }).sort({ timestamp: 1 }).lean();

  const contract = await Contract.findById(contractId).lean();

  const transitions = auditLogs.map(log => ({
    from: log.previousState?.status,
    to: log.currentState?.status,
    action: log.action,
    operator: log.operator?.name,
    timestamp: log.timestamp,
    operationId: log.operationId,
    reason: log.details?.reason
  }));

  return {
    contractId,
    contractNo: contract?.contractNo,
    currentStatus: contract?.status,
    transitions
  };
}

async function getCallbackHistory(contractId, options = {}) {
  const { page = 1, limit = 50, event, status } = options;
  const skip = (page - 1) * limit;

  const query = { contractId };

  if (event) query.event = event;
  if (status) query.status = status;

  const [callbacks, total] = await Promise.all([
    CallbackRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CallbackRecord.countDocuments(query)
  ]);

  const stats = await CallbackRecord.aggregate([
    { $match: { contractId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    callbacks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    stats: stats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
}

async function getPartySigningHistory(contractId, partyId) {
  const contract = await Contract.findById(contractId).lean();

  if (!contract) {
    throw new Error('合同不存在');
  }

  const party = contract.parties.find(p => p.id === partyId);

  if (!party) {
    throw new Error('签署方不存在');
  }

  const auditLogs = await AuditLog.find({
    contractId,
    'details.partyId': partyId
  }).sort({ timestamp: 1 }).lean();

  return {
    party,
    events: auditLogs.map(log => ({
      action: log.action,
      timestamp: log.timestamp,
      details: log.details,
      operator: log.operator
    }))
  };
}

async function getCompensationHistory(contractId) {
  const compensationLogs = await AuditLog.find({
    contractId,
    $or: [
      { action: 'compensation' },
      { compensationStatus: { $ne: 'none' } }
    ]
  }).sort({ timestamp: -1 }).lean();

  const exhaustedCallbacks = await CallbackRecord.find({
    contractId,
    status: { $in: ['exhausted', 'compensated'] }
  }).sort({ createdAt: -1 }).lean();

  return {
    compensations: compensationLogs,
    exhaustedCallbacks,
    summary: {
      totalCompensations: compensationLogs.length,
      totalExhausted: exhaustedCallbacks.filter(c => c.status === 'exhausted').length,
      totalCompensated: exhaustedCallbacks.filter(c => c.status === 'compensated').length
    }
  };
}

module.exports = {
  getContractFullHistory,
  getVersionTimeline,
  getStateTransitionHistory,
  getCallbackHistory,
  getPartySigningHistory,
  getCompensationHistory
};
