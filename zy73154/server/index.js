const express = require('express');
const cors = require('cors');
const path = require('path');
const ReportDataStore = require('./data-store');
const {
  parseLabReport,
  parseBoundarySample,
  parseVerbalNote,
  mergeData,
  filterRecords,
  exportData
} = require('./processor');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const store = new ReportDataStore();

function getCurrentData() {
  if (!store.latestVersion) {
    return { records: [], boundarySamples: [], verbalNotes: [] };
  }
  return {
    records: store.latestVersion.records,
    boundarySamples: store.latestVersion.boundarySamples,
    verbalNotes: store.latestVersion.verbalNotes
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/records', (req, res) => {
  const current = getCurrentData();
  const filters = req.query;
  const filtered = filterRecords(current.records, filters);
  
  res.json({
    total: filtered.length,
    filters: filters,
    records: filtered
  });
});

app.get('/api/records/:id', (req, res) => {
  const current = getCurrentData();
  const record = current.records.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

app.get('/api/boundary-samples', (req, res) => {
  const current = getCurrentData();
  res.json({
    total: current.boundarySamples.length,
    samples: current.boundarySamples
  });
});

app.get('/api/verbal-notes', (req, res) => {
  const current = getCurrentData();
  res.json({
    total: current.verbalNotes.length,
    notes: current.verbalNotes
  });
});

app.post('/api/import/lab-report', (req, res) => {
  try {
    const { data, sourceName, note } = req.body;
    if (!data) {
      return res.status(400).json({ error: '缺少数据' });
    }

    const parsed = parseLabReport(data, { name: sourceName || 'lab-report' });
    const current = getCurrentData();
    const merged = mergeData(current, { records: parsed.records }, 'lab-report');

    const version = store.createVersion(
      merged,
      sourceName || 'lab-report',
      note || '导入实验室结果表'
    );

    res.json({
      success: true,
      versionId: version.id,
      stats: version.stats,
      qualityCheck: parsed.qualityCheck,
      changes: version.changes
    });
  } catch (err) {
    console.error('导入实验室报告失败:', err);
    res.status(500).json({ error: '导入失败', message: err.message });
  }
});

app.post('/api/import/boundary-sample', (req, res) => {
  try {
    const { data, note } = req.body;
    if (!data) {
      return res.status(400).json({ error: '缺少数据' });
    }

    const sample = parseBoundarySample(data);
    const current = getCurrentData();
    const merged = mergeData(current, { boundarySamples: [sample] }, 'boundary-sample');

    const version = store.createVersion(
      merged,
      'boundary-sample',
      note || '导入边界样本'
    );

    res.json({
      success: true,
      versionId: version.id,
      sample: sample,
      stats: version.stats,
      changes: version.changes
    });
  } catch (err) {
    console.error('导入边界样本失败:', err);
    res.status(500).json({ error: '导入失败', message: err.message });
  }
});

app.post('/api/import/verbal-note', (req, res) => {
  try {
    const { data, note } = req.body;
    if (!data) {
      return res.status(400).json({ error: '缺少数据' });
    }

    const verbalNote = parseVerbalNote(data);
    const current = getCurrentData();
    const merged = mergeData(current, { verbalNotes: [verbalNote] }, 'verbal-note');

    const version = store.createVersion(
      merged,
      'verbal-note',
      note || '添加口头说明'
    );

    res.json({
      success: true,
      versionId: version.id,
      note: verbalNote,
      stats: version.stats,
      changes: version.changes
    });
  } catch (err) {
    console.error('添加口头说明失败:', err);
    res.status(500).json({ error: '添加失败', message: err.message });
  }
});

app.get('/api/versions', (req, res) => {
  const versions = store.getAllVersions();
  res.json({
    total: versions.length,
    versions: versions
  });
});

app.get('/api/versions/:id', (req, res) => {
  const version = store.getVersion(req.params.id);
  if (!version) {
    return res.status(404).json({ error: '版本不存在' });
  }
  res.json(version);
});

app.get('/api/versions/:id/diff', (req, res) => {
  const version = store.getVersion(req.params.id);
  if (!version) {
    return res.status(404).json({ error: '版本不存在' });
  }
  res.json({
    versionId: version.id,
    changes: version.changes,
    stats: version.stats
  });
});

app.get('/api/export', (req, res) => {
  const current = getCurrentData();
  const format = req.query.format || 'json';
  const filters = { ...req.query };
  delete filters.format;

  const filtered = filterRecords(current.records, filters);
  const exported = exportData(filtered, format);

  const filename = `ocean-ranch-export-${Date.now()}`;
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
  }

  res.json({
    format: format,
    filters: filters,
    recordCount: filtered.length,
    filename: filename,
    data: exported
  });
});

app.get('/api/summary', (req, res) => {
  const current = getCurrentData();
  const records = current.records;
  
  const stationStats = {};
  for (const r of records) {
    if (!stationStats[r.stationId]) {
      stationStats[r.stationId] = {
        stationId: r.stationId,
        stationName: r.stationName,
        longitude: r.longitude,
        latitude: r.latitude,
        count: 0,
        outliers: 0,
        pending: 0,
        normal: 0
      };
    }
    stationStats[r.stationId].count++;
    if (r.isOutlier) stationStats[r.stationId].outliers++;
    if (r.status === 'pending') stationStats[r.stationId].pending++;
    if (r.status === 'normal') stationStats[r.stationId].normal++;
  }

  res.json({
    totalRecords: records.length,
    totalStations: Object.keys(stationStats).length,
    totalOutliers: records.filter(r => r.isOutlier).length,
    totalPending: records.filter(r => r.status === 'pending').length,
    boundarySamples: current.boundarySamples.length,
    verbalNotes: current.verbalNotes.length,
    versionCount: store.versions.length,
    latestVersion: store.latestVersion ? {
      id: store.latestVersion.id,
      timestamp: store.latestVersion.timestamp,
      source: store.latestVersion.source,
      note: store.latestVersion.note
    } : null,
    stationStats: Object.values(stationStats)
  });
});

app.get('/api/pending-confirmations', (req, res) => {
  const current = getCurrentData();
  const pendingRecords = current.records.filter(r => r.status === 'pending');
  
  const pendingDetails = pendingRecords.map(r => ({
    recordId: r.id,
    stationId: r.stationId,
    sampleTime: r.sampleTime,
    pendingReasons: r.pendingReasons,
    tideLevel: r.tideLevel,
    tideUnit: r.tideUnit
  }));

  res.json({
    total: pendingDetails.length,
    records: pendingDetails
  });
});

app.get('/api/outliers', (req, res) => {
  const current = getCurrentData();
  const outlierRecords = current.records.filter(r => r.isOutlier);
  
  const outlierDetails = outlierRecords.map(r => ({
    recordId: r.id,
    stationId: r.stationId,
    sampleTime: r.sampleTime,
    outlierInfo: r.outlierInfo
  }));

  res.json({
    total: outlierDetails.length,
    records: outlierDetails
  });
});

app.post('/api/rerun', (req, res) => {
  try {
    const { note } = req.body;
    const current = getCurrentData();
    
    if (current.records.length === 0) {
      return res.status(400).json({ error: '没有数据可重跑' });
    }

    const { v4: uuidv4 } = require('uuid');
    const reprocessedRecords = current.records.map(r => ({
      ...r,
      id: r.id,
      reprocessTime: new Date().toISOString()
    }));

    const reprocessedData = {
      records: reprocessedRecords,
      boundarySamples: current.boundarySamples,
      verbalNotes: current.verbalNotes
    };

    const { detectTideUnitMismatch, detectOutliers } = require('./processor');
    const tideCheck = detectTideUnitMismatch(reprocessedRecords);
    const outliers = detectOutliers(reprocessedRecords);

    const outlierMap = new Map();
    for (const o of outliers) {
      if (!outlierMap.has(o.recordId)) {
        outlierMap.set(o.recordId, []);
      }
      outlierMap.get(o.recordId).push(o);
    }

    for (const record of reprocessedData.records) {
      if (outlierMap.has(record.id)) {
        record.isOutlier = true;
        record.outlierInfo = outlierMap.get(record.id);
      }
    }

    if (tideCheck.hasMismatch) {
      const affectedIds = new Set(tideCheck.affectedRecords.map(r => r.recordId));
      for (const record of reprocessedData.records) {
        if (affectedIds.has(record.id)) {
          record.status = 'pending';
        }
      }
    }

    const previousVersion = store.latestVersion;
    const version = store.createVersion(
      reprocessedData,
      'rerun',
      note || '补录后重跑'
    );

    const historyBroken = previousVersion && previousVersion.id !== store.versions[store.versions.length - 2]?.id;

    res.json({
      success: true,
      versionId: version.id,
      stats: version.stats,
      changes: version.changes,
      qualityCheck: {
        tideUnitMismatch: tideCheck,
        outliers: outliers,
        totalOutliers: outliers.length
      },
      history: {
        broken: historyBroken,
        previousVersionId: previousVersion ? previousVersion.id : null,
        totalVersions: store.versions.length
      }
    });
  } catch (err) {
    console.error('重跑失败:', err);
    res.status(500).json({ error: '重跑失败', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`海洋牧场报告汇总系统已启动: http://localhost:${PORT}`);
});

module.exports = app;
