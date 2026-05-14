import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

async function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        try {
          if (data.statusHistory) {
            data.statusHistory = JSON.parse(data.statusHistory);
          }
          if (data.failureDetail && data.failureDetail !== '') {
            data.failureDetail = JSON.parse(data.failureDetail);
          }
          if (data.approverList) {
            data.approverList = JSON.parse(data.approverList);
          }
          data.isDirty = data.isDirty === 'true';
          data.isBoundary = data.isBoundary === 'true';
        } catch (e) {
        }
        results.push(data);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function loadAllRecords(dataDir) {
  const files = await fs.promises.readdir(dataDir);
  const csvFiles = files.filter(f => f.endsWith('.csv') && !f.includes('-failures') && !f.includes('-boundary'));
  const allRecords = [];

  for (const file of csvFiles) {
    const filePath = path.join(dataDir, file);
    const records = await parseCsvFile(filePath);
    allRecords.push(...records);
  }

  return allRecords;
}

export async function queryRecords(dataDir, filters = {}) {
  const { batchId, operator, riskType, status, isDirty, isBoundary } = filters;
  
  let records = await loadAllRecords(dataDir);

  if (batchId) {
    records = records.filter(r => r.batchId === batchId);
  }

  if (operator) {
    records = records.filter(r => r.operator && r.operator.includes(operator));
  }

  if (riskType) {
    records = records.filter(r => r.riskType === riskType || r.riskName?.includes(riskType));
  }

  if (status) {
    records = records.filter(r => r.status === status);
  }

  if (isDirty !== undefined) {
    records = records.filter(r => r.isDirty === isDirty);
  }

  if (isBoundary !== undefined) {
    records = records.filter(r => r.isBoundary === isBoundary);
  }

  return {
    queryTime: new Date().toISOString(),
    totalCount: records.length,
    filters,
    records
  };
}

export async function getFailures(dataDir) {
  const allRecords = await loadAllRecords(dataDir);
  const failureRecords = allRecords.filter(r => r.status === '已失败');

  return {
    queryTime: new Date().toISOString(),
    totalCount: failureRecords.length,
    records: failureRecords
  };
}

export async function getBoundaryRecords(dataDir) {
  const allRecords = await loadAllRecords(dataDir);
  const boundaryRecords = allRecords.filter(r => r.isBoundary === true);

  return {
    queryTime: new Date().toISOString(),
    totalCount: boundaryRecords.length,
    records: boundaryRecords
  };
}

export async function getReminderList(dataDir) {
  const allRecords = await loadAllRecords(dataDir);
  
  const recordsWithReminders = allRecords
    .filter(r => r.approverList && Array.isArray(r.approverList) && r.approverList.length > 0)
    .map(record => {
      const reminders = record.statusHistory
        ? record.statusHistory.filter(h => h.status === '已催办')
        : [];
      
      return {
        id: record.id,
        batchId: record.batchId,
        system: record.system,
        operator: record.operator,
        status: record.status,
        approverList: record.approverList,
        reminders: reminders.map(r => ({
          time: r.timestamp,
          operator: r.operator,
          remark: r.remark,
          approver: r.approver
        })),
        reminderCount: reminders.length,
        createTime: record.createTime
      };
    })
    .sort((a, b) => b.reminderCount - a.reminderCount);

  return {
    queryTime: new Date().toISOString(),
    totalCount: recordsWithReminders.length,
    records: recordsWithReminders
  };
}

export async function getBatches(dataDir) {
  const allRecords = await loadAllRecords(dataDir);
  const batchMap = new Map();

  for (const record of allRecords) {
    if (!batchMap.has(record.batchId)) {
      batchMap.set(record.batchId, {
        batchId: record.batchId,
        recordCount: 0,
        failureCount: 0,
        dirtyCount: 0,
        boundaryCount: 0,
        operators: new Set(),
        riskTypes: new Set(),
        createTime: record.createTime
      });
    }
    
    const batch = batchMap.get(record.batchId);
    batch.recordCount++;
    
    if (record.status === '已失败') batch.failureCount++;
    if (record.isDirty) batch.dirtyCount++;
    if (record.isBoundary) batch.boundaryCount++;
    if (record.operator) batch.operators.add(record.operator);
    if (record.riskName) batch.riskTypes.add(record.riskName);
  }

  const batches = Array.from(batchMap.values())
    .map(b => ({
      ...b,
      operators: Array.from(b.operators),
      riskTypes: Array.from(b.riskTypes)
    }))
    .sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

  return {
    queryTime: new Date().toISOString(),
    totalCount: batches.length,
    batches
  };
}
