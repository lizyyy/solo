const express = require('express');
const uuid = require('uuid');

const app = express();
app.use(express.json());

const REGIONS = ['CN-East', 'US-West'];

const stores = {
  'CN-East': {
    users: {},
    syncEvents: [],
    conflicts: []
  },
  'US-West': {
    users: {},
    syncEvents: [],
    conflicts: []
  }
};

const FIELD_MERGE_STRATEGIES = {
  'profile.name': 'last_write',
  'profile.email': 'last_write',
  'profile.phone': 'last_write',
  'address.street': 'conflict_arbitration',
  'address.city': 'conflict_arbitration',
  'address.province': 'conflict_arbitration',
  'address.postalCode': 'conflict_arbitration',
  'inventory.quantity': 'numeric_merge'
};

function getCurrentVersion() {
  return Date.now();
}

function logOperation(region, operation, details) {
  console.log(`[${new Date().toISOString()}] [${region}] ${operation}:`, JSON.stringify(details, null, 2));
}

app.post('/api/regions/:region/users', (req, res) => {
  const region = req.params.region;
  const { userId, data, timestamp } = req.body;

  if (!stores[region]) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  if (!userId || !data) {
    return res.status(400).json({ error: 'userId and data are required' });
  }

  const store = stores[region];
  const currentTime = timestamp || getCurrentVersion();

  const newEvent = {
    eventId: uuid.v4(),
    userId,
    region,
    data,
    timestamp: currentTime,
    version: currentTime
  };

  store.syncEvents.push(newEvent);

  logOperation(region, 'USER_WRITE_RECEIVED', {
    userId,
    timestamp: currentTime
  });

  if (!store.users[userId]) {
    store.users[userId] = {
      data: JSON.parse(JSON.stringify(data)),
      version: currentTime,
      lastUpdated: currentTime,
      updatedBy: region
    };
    
    logOperation(region, 'USER_CREATED', {
      userId,
      version: currentTime
    });
  } else {
    const existingUser = store.users[userId];
    const { mergedData, conflicts } = mergeData(existingUser.data, data, existingUser.version, currentTime, region, existingUser.updatedBy);
    
    if (conflicts.length > 0) {
      const conflictRecord = {
        conflictId: uuid.v4(),
        userId,
        regions: [existingUser.updatedBy, region],
        conflicts,
        baseData: JSON.parse(JSON.stringify(existingUser.data)),
        incomingData: JSON.parse(JSON.stringify(data)),
        baseVersion: existingUser.version,
        incomingVersion: currentTime,
        status: 'PENDING_ARBITRATION',
        createdAt: getCurrentVersion()
      };
      
      store.conflicts.push(conflictRecord);
      
      logOperation(region, 'CONFLICT_DETECTED', {
        userId,
        conflictId: conflictRecord.conflictId,
        conflictingFields: conflicts.map(c => c.field)
      });

      return res.status(200).json({
        status: 'CONFLICT_DETECTED',
        conflictId: conflictRecord.conflictId,
        conflicts,
        userId,
        regions: [existingUser.updatedBy, region],
        timestamp: currentTime
      });
    }

    store.users[userId] = {
      data: mergedData,
      version: currentTime,
      lastUpdated: currentTime,
      updatedBy: region
    };

    logOperation(region, 'USER_UPDATED', {
      userId,
      version: currentTime,
      mergedData
    });
  }

  return res.status(200).json({
    status: 'SUCCESS',
    userId,
    data: store.users[userId].data,
    version: store.users[userId].version,
    timestamp: store.users[userId].lastUpdated,
    region
  });
});

app.post('/api/sync/event', (req, res) => {
  const { eventId, userId, sourceRegion, targetRegion, data, version, timestamp } = req.body;

  if (!eventId || !userId || !sourceRegion || !targetRegion || !data || !version) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!stores[sourceRegion] || !stores[targetRegion]) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  const targetStore = stores[targetRegion];

  const existingEvent = targetStore.syncEvents.find(e => e.eventId === eventId);
  if (existingEvent) {
    logOperation(targetRegion, 'SYNC_EVENT_IDEMPOTENT', {
      eventId,
      userId,
      sourceRegion
    });

    return res.status(200).json({
      status: 'IDEMPOTENT',
      eventId,
      message: 'Event already processed',
      existingEvent
    });
  }

  targetStore.syncEvents.push({
    eventId,
    userId,
    region: targetRegion,
    data,
    timestamp: timestamp || getCurrentVersion(),
    version
  });

  logOperation(targetRegion, 'SYNC_EVENT_RECEIVED', {
    eventId,
    userId,
    from: sourceRegion,
    version
  });

  if (!targetStore.users[userId]) {
    targetStore.users[userId] = {
      data: JSON.parse(JSON.stringify(data)),
      version,
      lastUpdated: timestamp || getCurrentVersion(),
      updatedBy: sourceRegion
    };

    logOperation(targetRegion, 'USER_CREATED_VIA_SYNC', {
      userId,
      from: sourceRegion,
      version
    });

    return res.status(200).json({
      status: 'SYNCED',
      userId,
      eventId,
      data: targetStore.users[userId].data
    });
  }

  const existingUser = targetStore.users[userId];

  if (version <= existingUser.version) {
    logOperation(targetRegion, 'SYNC_EVENT_STALE', {
      eventId,
      userId,
      incomingVersion: version,
      existingVersion: existingUser.version
    });

    return res.status(200).json({
      status: 'STALE',
      userId,
      eventId,
      message: 'Incoming version is older or equal to current version',
      currentVersion: existingUser.version
    });
  }

  const { mergedData, conflicts } = mergeData(
    existingUser.data, 
    data, 
    existingUser.version, 
    version, 
    sourceRegion, 
    existingUser.updatedBy
  );

  if (conflicts.length > 0) {
    const conflictRecord = {
      conflictId: uuid.v4(),
      userId,
      regions: [existingUser.updatedBy, sourceRegion],
      conflicts,
      baseData: JSON.parse(JSON.stringify(existingUser.data)),
      incomingData: JSON.parse(JSON.stringify(data)),
      baseVersion: existingUser.version,
      incomingVersion: version,
      sourceEventId: eventId,
      status: 'PENDING_ARBITRATION',
      createdAt: getCurrentVersion()
    };

    targetStore.conflicts.push(conflictRecord);

    logOperation(targetRegion, 'CONFLICT_DETECTED_DURING_SYNC', {
      userId,
      conflictId: conflictRecord.conflictId,
      conflictingFields: conflicts.map(c => c.field)
    });

    return res.status(200).json({
      status: 'CONFLICT_DETECTED',
      conflictId: conflictRecord.conflictId,
      conflicts,
      userId,
      regions: [existingUser.updatedBy, sourceRegion]
    });
  }

  targetStore.users[userId] = {
    data: mergedData,
    version,
    lastUpdated: timestamp || getCurrentVersion(),
    updatedBy: sourceRegion
  };

  logOperation(targetRegion, 'USER_UPDATED_VIA_SYNC', {
    userId,
    from: sourceRegion,
    version,
    mergedData
  });

  return res.status(200).json({
    status: 'SYNCED',
    userId,
    eventId,
    data: targetStore.users[userId].data,
    version
  });
});

app.get('/api/regions/:region/conflicts', (req, res) => {
  const region = req.params.region;
  if (!stores[region]) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  const conflicts = stores[region].conflicts.map(conflict => ({
    conflictId: conflict.conflictId,
    userId: conflict.userId,
    regions: conflict.regions,
    status: conflict.status,
    createdAt: conflict.createdAt,
    conflicts: conflict.conflicts.map(c => ({
      field: c.field,
      baseValue: c.baseValue,
      incomingValue: c.incomingValue,
      strategy: c.strategy,
      autoMerged: c.autoMerged
    })),
    resolution: conflict.resolution
  }));

  return res.status(200).json({
    region,
    totalConflicts: conflicts.length,
    pendingCount: conflicts.filter(c => c.status === 'PENDING_ARBITRATION').length,
    resolvedCount: conflicts.filter(c => c.status === 'RESOLVED').length,
    conflicts
  });
});

app.get('/api/conflicts/:conflictId', (req, res) => {
  const { conflictId } = req.params;

  for (const region of REGIONS) {
    const conflict = stores[region].conflicts.find(c => c.conflictId === conflictId);
    if (conflict) {
      return res.status(200).json({
        conflictId: conflict.conflictId,
        userId: conflict.userId,
        regions: conflict.regions,
        status: conflict.status,
        createdAt: conflict.createdAt,
        conflicts: conflict.conflicts.map(c => ({
          field: c.field,
          baseValue: c.baseValue,
          incomingValue: c.incomingValue,
          strategy: c.strategy,
          autoMerged: c.autoMerged
        })),
        baseData: conflict.baseData,
        incomingData: conflict.incomingData,
        baseVersion: conflict.baseVersion,
        incomingVersion: conflict.incomingVersion,
        resolution: conflict.resolution
      });
    }
  }

  return res.status(404).json({ error: 'Conflict not found' });
});

app.post('/api/conflicts/:conflictId/arbitrate', (req, res) => {
  const { conflictId } = req.params;
  const { arbiter, resolution, compensatoryAction, note } = req.body;

  if (!arbiter || !resolution) {
    return res.status(400).json({ error: 'arbiter and resolution are required' });
  }

  if (!['USE_BASE', 'USE_INCOMING', 'USE_CUSTOM'].includes(resolution.strategy)) {
    return res.status(400).json({ error: 'Invalid resolution strategy' });
  }

  let targetConflict = null;
  let targetRegion = null;

  for (const region of REGIONS) {
    const conflict = stores[region].conflicts.find(c => c.conflictId === conflictId);
    if (conflict) {
      targetConflict = conflict;
      targetRegion = region;
      break;
    }
  }

  if (!targetConflict) {
    return res.status(404).json({ error: 'Conflict not found' });
  }

  let resolvedData;
  if (resolution.strategy === 'USE_BASE') {
    resolvedData = JSON.parse(JSON.stringify(targetConflict.baseData));
  } else if (resolution.strategy === 'USE_INCOMING') {
    resolvedData = JSON.parse(JSON.stringify(targetConflict.incomingData));
  } else {
    resolvedData = resolution.customData || JSON.parse(JSON.stringify(targetConflict.baseData));
  }

  const newVersion = getCurrentVersion();
  const resolutionRecord = {
    arbiter,
    strategy: resolution.strategy,
    customData: resolution.strategy === 'USE_CUSTOM' ? resolution.customData : null,
    compensatoryAction: compensatoryAction || null,
    note: note || null,
    resolvedAt: newVersion,
    finalData: resolvedData,
    finalVersion: newVersion
  };

  targetConflict.status = 'RESOLVED';
  targetConflict.resolution = resolutionRecord;

  const syncEvents = [];

  for (const region of REGIONS) {
    stores[region].users[targetConflict.userId] = {
      data: JSON.parse(JSON.stringify(resolvedData)),
      version: newVersion,
      lastUpdated: newVersion,
      updatedBy: 'ARBITRATION'
    };

    const eventId = uuid.v4();
    stores[region].syncEvents.push({
      eventId,
      userId: targetConflict.userId,
      region,
      data: JSON.parse(JSON.stringify(resolvedData)),
      timestamp: newVersion,
      version: newVersion,
      source: 'ARBITRATION',
      conflictId
    });

    const otherConflict = stores[region].conflicts.find(c => c.conflictId === conflictId);
    if (otherConflict && otherConflict !== targetConflict) {
      otherConflict.status = 'RESOLVED';
      otherConflict.resolution = resolutionRecord;
    }

    syncEvents.push({
      region,
      eventId,
      status: 'BROADCASTED'
    });

    logOperation(region, 'ARBITRATION_RESOLUTION_SYNCED', {
      userId: targetConflict.userId,
      conflictId,
      strategy: resolution.strategy,
      version: newVersion
    });
  }

  return res.status(200).json({
    status: 'RESOLVED',
    conflictId,
    userId: targetConflict.userId,
    resolution: resolutionRecord,
    syncEvents,
    compensatoryAction: compensatoryAction || { message: 'No compensatory action needed for this field type' }
  });
});

app.get('/api/regions/:region/users/:userId', (req, res) => {
  const { region, userId } = req.params;

  if (!stores[region]) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  const user = stores[region].users[userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const pendingConflicts = stores[region].conflicts.filter(
    c => c.userId === userId && c.status === 'PENDING_ARBITRATION'
  );

  return res.status(200).json({
    userId,
    region,
    data: user.data,
    version: user.version,
    lastUpdated: user.lastUpdated,
    updatedBy: user.updatedBy,
    hasPendingConflicts: pendingConflicts.length > 0,
    pendingConflictIds: pendingConflicts.map(c => c.conflictId)
  });
});

function deepGet(obj, path) {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}

function deepSet(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function mergeData(baseData, incomingData, baseVersion, incomingVersion, incomingRegion, baseRegion) {
  const mergedData = JSON.parse(JSON.stringify(baseData));
  const conflicts = [];

  const allFields = new Set();
  
  function collectFields(prefix, obj) {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        collectFields(fullPath, value);
      } else {
        allFields.add(fullPath);
      }
    }
  }

  collectFields('', baseData);
  collectFields('', incomingData);

  for (const field of allFields) {
    const baseValue = deepGet(baseData, field);
    const incomingValue = deepGet(incomingData, field);
    const strategy = FIELD_MERGE_STRATEGIES[field] || 'conflict_arbitration';

    if (baseValue === incomingValue) {
      continue;
    }

    const conflict = {
      field,
      baseValue,
      incomingValue,
      strategy,
      autoMerged: false,
      regions: [baseRegion, incomingRegion],
      versions: {
        base: baseVersion,
        incoming: incomingVersion
      }
    };

    if (strategy === 'last_write') {
      if (incomingVersion >= baseVersion) {
        deepSet(mergedData, field, incomingValue);
        conflict.autoMerged = true;
        conflict.mergedValue = incomingValue;
        logOperation('MERGE', 'AUTO_MERGE_LAST_WRITE', {
          field,
          selected: 'incoming',
          version: incomingVersion
        });
      } else {
        conflict.autoMerged = true;
        conflict.mergedValue = baseValue;
        logOperation('MERGE', 'AUTO_MERGE_LAST_WRITE', {
          field,
          selected: 'base',
          version: baseVersion
        });
      }
    } else if (strategy === 'numeric_merge') {
      if (typeof baseValue === 'number' && typeof incomingValue === 'number') {
        const mergedValue = Math.min(baseValue, incomingValue);
        deepSet(mergedData, field, mergedValue);
        conflict.autoMerged = true;
        conflict.mergedValue = mergedValue;
        conflict.compensatoryAction = {
          type: 'INVENTORY_RECONCILIATION_SUGGESTED',
          baseValue,
          incomingValue,
          mergedValue,
          difference: Math.abs(baseValue - incomingValue),
          suggestion: `建议对账确认实际库存。原值分别为 ${baseValue} 和 ${incomingValue}，合并为较小值 ${mergedValue}，差值 ${Math.abs(baseValue - incomingValue)} 需要人工核对。`
        };
        logOperation('MERGE', 'NUMERIC_MERGE_CONSERVATIVE', {
          field,
          baseValue,
          incomingValue,
          mergedValue,
          difference: Math.abs(baseValue - incomingValue)
        });
      } else {
        conflicts.push(conflict);
      }
    } else if (strategy === 'conflict_arbitration') {
      conflicts.push(conflict);
    }
  }

  return {
    mergedData,
    conflicts
  };
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  异地多活冲突 API 服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`========================================\n`);
  console.log(`可用区域: ${REGIONS.join(', ')}`);
  console.log(`\nAPI 端点:`);
  console.log(`  POST /api/regions/:region/users        - 写入用户数据`);
  console.log(`  POST /api/sync/event                    - 同步事件（跨区域）`);
  console.log(`  GET  /api/regions/:region/conflicts     - 查询区域冲突列表`);
  console.log(`  GET  /api/conflicts/:conflictId         - 查询单个冲突详情`);
  console.log(`  POST /api/conflicts/:conflictId/arbitrate - 人工仲裁`);
  console.log(`  GET  /api/regions/:region/users/:userId - 查询用户数据`);
  console.log(`\n========================================\n`);
});
