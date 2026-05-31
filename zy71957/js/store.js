var Store = (function() {
  var STORAGE_KEY = 'reservoir_debris_store';
  var BATTERY_CYCLE_THRESHOLD = 10;

  var state = {
    records: [],
    changeLog: [],
    filters: {
      status: 'all',
      changeType: 'all',
      reservoir: 'all',
      dateFrom: '',
      dateTo: '',
      keyword: ''
    },
    selectedRecordId: null,
    exportSnapshot: null
  };

  function generateId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
  }

  function dedupeKey(recordId, category, contentHash) {
    return recordId + '::' + category + '::' + contentHash;
  }

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  }

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        state.records = parsed.records || [];
        state.changeLog = parsed.changeLog || [];
        state.filters = parsed.filters || state.filters;
        state.selectedRecordId = parsed.selectedRecordId || null;
      }
    } catch (e) {
      console.warn('Store load failed, using defaults:', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        records: state.records,
        changeLog: state.changeLog,
        filters: state.filters,
        selectedRecordId: state.selectedRecordId
      }));
    } catch (e) {
      console.warn('Store save failed:', e);
    }
  }

  function classifyChange(category, previousValue, newValue) {
    var supplementCategories = {
      'weather': true,
      'pilot_note': true
    };

    if (supplementCategories[category]) {
      if (previousValue === null || previousValue === undefined || previousValue === '' || previousValue === '未提供') {
        return {
          changeType: 'supplement',
          conclusionAffected: false,
          explanation: explainSupplement(category)
        };
      }
      return {
        changeType: 'supplement',
        conclusionAffected: false,
        explanation: explainSupplementUpdate(category)
      };
    }

    if (category === 'photo') {
      return {
        changeType: 'conclusion_change',
        conclusionAffected: true,
        explanation: '巡检照片存在手工修改痕迹，可能影响漂浮物识别结论，需复核识别结果。'
      };
    }

    if (category === 'battery') {
      var diff = Math.abs((newValue || 0) - (previousValue || 0));
      if (diff > BATTERY_CYCLE_THRESHOLD) {
        return {
          changeType: 'conclusion_change',
          conclusionAffected: true,
          explanation: '电池循环数差异 ' + diff + ' 次超出阈值(' + BATTERY_CYCLE_THRESHOLD + ')，电池可能违规使用，影响飞行安全结论。'
        };
      }
      return {
        changeType: 'supplement',
        conclusionAffected: false,
        explanation: '电池循环数差异 ' + diff + ' 次在阈值内(' + BATTERY_CYCLE_THRESHOLD + ')，仅为记录更正，不影响飞行安全结论。'
      };
    }

    if (category === 'result') {
      return {
        changeType: 'conclusion_change',
        conclusionAffected: true,
        explanation: '漂浮物识别结果被人工修改，直接影响巡检结论。'
      };
    }

    if (category === 'conclusion') {
      return {
        changeType: 'conclusion_change',
        conclusionAffected: true,
        explanation: '巡检结论被修改，需确认变更原因。'
      };
    }

    return {
      changeType: 'supplement',
      conclusionAffected: false,
      explanation: '补充材料，不影响已有结论。'
    };
  }

  function explainSupplement(category) {
    var explanations = {
      'weather': '气象数据为事后补充，不影响已出的识别结论，仅完善归档材料。',
      'pilot_note': '飞手备注为事后补充，不影响已出的识别结论，仅完善归档材料。'
    };
    return explanations[category] || '补充材料，不影响已有结论。';
  }

  function explainSupplementUpdate(category) {
    var explanations = {
      'weather': '气象数据被更新，因气象信息不直接改变已识别的漂浮物结果，归为补充材料。',
      'pilot_note': '飞手备注被更新，备注内容不改变漂浮物识别结论，归为补充材料。'
    };
    return explanations[category] || '补充材料更新，不影响已有结论。';
  }

  function addRecord(recordData) {
    var existing = state.records.find(function(r) { return r.flightId === recordData.flightId; });
    if (existing) {
      return updateRecord(existing.id, recordData);
    }

    var record = {
      id: generateId('REC'),
      flightId: recordData.flightId || generateId('FLT'),
      flightDate: recordData.flightDate || new Date().toISOString().slice(0, 10),
      pilot: recordData.pilot || '',
      inspector: recordData.inspector || '',
      safetyOfficer: recordData.safetyOfficer || '',
      reservoir: recordData.reservoir || '',
      batteryId: recordData.batteryId || '',
      batteryCycles: recordData.batteryCycles || 0,
      batteryCyclesActual: recordData.batteryCyclesActual || null,
      weatherData: recordData.weatherData || null,
      pilotNotes: recordData.pilotNotes || '',
      photos: (recordData.photos || []).map(function(p) {
        return {
          id: generateId('PHO'),
          filename: p.filename || '未命名',
          timestamp: p.timestamp || new Date().toISOString(),
          location: p.location || '',
          hash: p.hash || simpleHash(p.filename + Date.now()),
          modified: false
        };
      }),
      debrisResults: (recordData.debrisResults || []).map(function(d) {
        return {
          id: generateId('DEB'),
          type: d.type || '未分类',
          confidence: d.confidence || 0,
          location: d.location || '',
          photoRef: d.photoRef || '',
          confirmed: d.confirmed || false
        };
      }),
      status: 'pending',
      conclusion: recordData.conclusion || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.records.push(record);
    save();
    return record;
  }

  function updateRecord(recordId, updates) {
    var record = state.records.find(function(r) { return r.id === recordId; });
    if (!record) return null;

    var fieldMap = {
      weatherData: 'weather',
      pilotNotes: 'pilot_note',
      batteryCyclesActual: 'battery',
      conclusion: 'conclusion'
    };

    Object.keys(updates).forEach(function(key) {
      if (key === 'id' || key === 'flightId') return;

      var previousValue = record[key];
      var newValue = updates[key];

      if (JSON.stringify(previousValue) === JSON.stringify(newValue)) return;

      var category = fieldMap[key] || 'supplement';
      var classification = classifyChange(category, previousValue, newValue);

      var contentHash = simpleHash(key + JSON.stringify(previousValue) + JSON.stringify(newValue));
      var dKey = dedupeKey(recordId, category, contentHash);

      var existingChange = state.changeLog.find(function(c) { return c.dedupeKey === dKey; });
      if (existingChange) return;

      state.changeLog.push({
        id: generateId('CHG'),
        recordId: recordId,
        dedupeKey: dKey,
        category: category,
        changeType: classification.changeType,
        conclusionAffected: classification.conclusionAffected,
        description: getChangeDescription(key, category),
        explanation: classification.explanation,
        beforeValue: previousValue,
        afterValue: newValue,
        timestamp: new Date().toISOString(),
        operator: updates._operator || '系统'
      });

      record[key] = newValue;
    });

    if (updates.photos) {
      updates.photos.forEach(function(photoUpdate) {
        if (photoUpdate.modified) {
          var photoRecord = record.photos.find(function(p) { return p.id === photoUpdate.id; });
          if (photoRecord && !photoRecord.modified) {
            var pHash = simpleHash('photo-modified-' + photoUpdate.id);
            var pDKey = dedupeKey(recordId, 'photo', pHash);
            var existingPChange = state.changeLog.find(function(c) { return c.dedupeKey === pDKey; });
            if (!existingPChange) {
              state.changeLog.push({
                id: generateId('CHG'),
                recordId: recordId,
                dedupeKey: pDKey,
                category: 'photo',
                changeType: 'conclusion_change',
                conclusionAffected: true,
                description: '巡检照片手工修改',
                explanation: '巡检照片存在手工修改痕迹，可能影响漂浮物识别结论，需复核识别结果。',
                beforeValue: '原始照片',
                afterValue: '已修改',
                timestamp: new Date().toISOString(),
                operator: updates._operator || '系统'
              });
            }
            photoRecord.modified = true;
          }
        }
      });
    }

    if (updates.debrisResults) {
      updates.debrisResults.forEach(function(resultUpdate) {
        var existingResult = record.debrisResults.find(function(d) { return d.id === resultUpdate.id; });
        if (existingResult) {
          if (resultUpdate.confirmed !== undefined && resultUpdate.confirmed !== existingResult.confirmed) {
            var rHash = simpleHash('result-confirm-' + resultUpdate.id + resultUpdate.confirmed);
            var rDKey = dedupeKey(recordId, 'result', rHash);
            var existingRChange = state.changeLog.find(function(c) { return c.dedupeKey === rDKey; });
            if (!existingRChange) {
              var rClassification = classifyChange('result', existingResult.confirmed, resultUpdate.confirmed);
              state.changeLog.push({
                id: generateId('CHG'),
                recordId: recordId,
                dedupeKey: rDKey,
                category: 'result',
                changeType: rClassification.changeType,
                conclusionAffected: rClassification.conclusionAffected,
                description: '漂浮物识别结果确认状态变更: ' + (existingResult.confirmed ? '已确认' : '待确认') + ' → ' + (resultUpdate.confirmed ? '已确认' : '待确认'),
                explanation: rClassification.explanation,
                beforeValue: existingResult.confirmed ? '已确认' : '待确认',
                afterValue: resultUpdate.confirmed ? '已确认' : '待确认',
                timestamp: new Date().toISOString(),
                operator: updates._operator || '系统'
              });
            }
            existingResult.confirmed = resultUpdate.confirmed;
          }
          if (resultUpdate.type !== undefined && resultUpdate.type !== existingResult.type) {
            var tHash = simpleHash('result-type-' + resultUpdate.id + resultUpdate.type);
            var tDKey = dedupeKey(recordId, 'result', tHash);
            var existingTChange = state.changeLog.find(function(c) { return c.dedupeKey === tDKey; });
            if (!existingTChange) {
              var tClassification = classifyChange('result', existingResult.type, resultUpdate.type);
              state.changeLog.push({
                id: generateId('CHG'),
                recordId: recordId,
                dedupeKey: tDKey,
                category: 'result',
                changeType: tClassification.changeType,
                conclusionAffected: tClassification.conclusionAffected,
                description: '漂浮物类型变更: ' + existingResult.type + ' → ' + resultUpdate.type,
                explanation: tClassification.explanation,
                beforeValue: existingResult.type,
                afterValue: resultUpdate.type,
                timestamp: new Date().toISOString(),
                operator: updates._operator || '系统'
              });
            }
            existingResult.type = resultUpdate.type;
          }
        }
      });
    }

    record.updatedAt = new Date().toISOString();
    recalculateStatus(record);
    save();
    return record;
  }

  function getChangeDescription(key, category) {
    var descriptions = {
      'weatherData': '气象数据补充/更新',
      'pilotNotes': '飞手备注补充/更新',
      'batteryCyclesActual': '电池循环数更正',
      'conclusion': '巡检结论修改'
    };
    return descriptions[key] || category + '变更';
  }

  function recalculateStatus(record) {
    var recordChanges = state.changeLog.filter(function(c) { return c.recordId === record.id; });
    var hasConclusionChange = recordChanges.some(function(c) { return c.conclusionAffected; });

    if (hasConclusionChange) {
      record.status = 'anomaly';
    } else if (record.debrisResults.length > 0 && record.debrisResults.every(function(d) { return d.confirmed; })) {
      record.status = 'reviewed';
    } else {
      record.status = 'pending';
    }
  }

  function getRecord(id) {
    return state.records.find(function(r) { return r.id === id; }) || null;
  }

  function getChangeLog(recordId) {
    return state.changeLog
      .filter(function(c) { return c.recordId === recordId; })
      .sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  }

  function getAnomalies(recordId) {
    return state.changeLog.filter(function(c) {
      return c.recordId === recordId && c.conclusionAffected;
    });
  }

  function getFilteredRecords() {
    var f = state.filters;
    return state.records.filter(function(r) {
      if (f.status !== 'all' && r.status !== f.status) return false;

      if (f.changeType !== 'all') {
        var recordChanges = state.changeLog.filter(function(c) { return c.recordId === r.id; });
        if (f.changeType === 'supplement') {
          var hasConclusion = recordChanges.some(function(c) { return c.changeType === 'conclusion_change'; });
          if (hasConclusion) return false;
        } else if (f.changeType === 'conclusion_change') {
          var hasConclusionChange = recordChanges.some(function(c) { return c.changeType === 'conclusion_change'; });
          if (!hasConclusionChange) return false;
        }
      }

      if (f.reservoir !== 'all' && r.reservoir !== f.reservoir) return false;

      if (f.dateFrom && r.flightDate < f.dateFrom) return false;
      if (f.dateTo && r.flightDate > f.dateTo) return false;

      if (f.keyword) {
        var kw = f.keyword.toLowerCase();
        var match = (r.pilot + ' ' + r.inspector + ' ' + r.safetyOfficer + ' ' + r.flightId + ' ' + r.reservoir).toLowerCase();
        if (match.indexOf(kw) === -1) return false;
      }

      return true;
    }).sort(function(a, b) {
      return b.flightDate.localeCompare(a.flightDate) || b.createdAt.localeCompare(a.createdAt);
    });
  }

  function getReservoirs() {
    var set = {};
    state.records.forEach(function(r) { set[r.reservoir] = true; });
    return Object.keys(set).sort();
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    state.exportSnapshot = null;
    save();
  }

  function resetFilters() {
    state.filters = {
      status: 'all',
      changeType: 'all',
      reservoir: 'all',
      dateFrom: '',
      dateTo: '',
      keyword: ''
    };
    state.exportSnapshot = null;
    save();
  }

  function selectRecord(id) {
    state.selectedRecordId = id;
    save();
  }

  function captureExportSnapshot() {
    var filtered = getFilteredRecords();
    state.exportSnapshot = {
      timestamp: new Date().toISOString(),
      filterState: JSON.parse(JSON.stringify(state.filters)),
      recordIds: filtered.map(function(r) { return r.id; }),
      recordCount: filtered.length
    };
    save();
    return state.exportSnapshot;
  }

  function getExportData() {
    if (!state.exportSnapshot) {
      captureExportSnapshot();
    }

    var snapshot = state.exportSnapshot;
    var records = snapshot.recordIds.map(function(id) {
      return getRecord(id);
    }).filter(Boolean);

    return {
      snapshot: snapshot,
      records: records.map(function(r) {
        return {
          record: r,
          changes: getChangeLog(r.id),
          anomalies: getAnomalies(r.id)
        };
      })
    };
  }

  function batchProcess(items) {
    var results = { processed: 0, skipped: 0, errors: [] };

    items.forEach(function(item) {
      try {
        var existing = state.records.find(function(r) { return r.flightId === item.flightId; });

        if (existing) {
          if (item.updates) {
            updateRecord(existing.id, item.updates);
            results.processed++;
          } else {
            results.skipped++;
          }
        } else {
          addRecord(item);
          results.processed++;
        }
      } catch (e) {
        results.errors.push({ flightId: item.flightId, error: e.message });
      }
    });

    save();
    return results;
  }

  function initSampleData() {
    if (state.records.length > 0) return;

    var now = new Date();
    var dates = [];
    for (var i = 0; i < 5; i++) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    var sampleRecords = [
      {
        flightId: 'FLT-20260531-001',
        flightDate: dates[0],
        pilot: '张伟',
        inspector: '李明',
        safetyOfficer: '王强',
        reservoir: '青山水库',
        batteryId: 'BAT-A001',
        batteryCycles: 45,
        batteryCyclesActual: 45,
        weatherData: { windSpeed: '3.2m/s', visibility: '8km', temperature: '22°C', source: '气象站', timestamp: dates[0] + 'T08:30:00' },
        pilotNotes: '西北角发现大面积漂浮物聚集，建议增加巡检频次。',
        photos: [
          { filename: 'IMG_001.jpg', timestamp: dates[0] + 'T09:15:00', location: 'N30.25 E120.15', hash: 'a1b2c3' },
          { filename: 'IMG_002.jpg', timestamp: dates[0] + 'T09:16:00', location: 'N30.25 E120.16', hash: 'd4e5f6' },
          { filename: 'IMG_003.jpg', timestamp: dates[0] + 'T09:17:00', location: 'N30.26 E120.15', hash: 'g7h8i9' }
        ],
        debrisResults: [
          { type: '塑料垃圾', confidence: 0.92, location: 'N30.25 E120.15', confirmed: true },
          { type: '浮萍', confidence: 0.85, location: 'N30.25 E120.16', confirmed: true },
          { type: '疑似油污', confidence: 0.67, location: 'N30.26 E120.15', confirmed: false }
        ],
        conclusion: '发现塑料垃圾及浮萍聚集，疑似油污待确认。建议安排清理作业。'
      },
      {
        flightId: 'FLT-20260530-002',
        flightDate: dates[1],
        pilot: '刘洋',
        inspector: '陈静',
        safetyOfficer: '赵磊',
        reservoir: '碧波水库',
        batteryId: 'BAT-B003',
        batteryCycles: 120,
        batteryCyclesActual: 135,
        weatherData: null,
        pilotNotes: '',
        photos: [
          { filename: 'IMG_010.jpg', timestamp: dates[1] + 'T10:00:00', location: 'N31.10 E121.20', hash: 'j1k2l3' },
          { filename: 'IMG_011.jpg', timestamp: dates[1] + 'T10:01:00', location: 'N31.10 E121.21', hash: 'm4n5o6', modified: true }
        ],
        debrisResults: [
          { type: '枯枝落叶', confidence: 0.95, location: 'N31.10 E121.20', confirmed: true },
          { type: '塑料垃圾', confidence: 0.78, location: 'N31.10 E121.21', confirmed: false }
        ],
        conclusion: '发现枯枝落叶自然聚集，疑似塑料垃圾待确认。'
      },
      {
        flightId: 'FLT-20260529-003',
        flightDate: dates[2],
        pilot: '张伟',
        inspector: '李明',
        safetyOfficer: '王强',
        reservoir: '青山水库',
        batteryId: 'BAT-A002',
        batteryCycles: 200,
        batteryCyclesActual: 200,
        weatherData: { windSpeed: '5.8m/s', visibility: '5km', temperature: '18°C', source: '气象站', timestamp: dates[2] + 'T07:45:00' },
        pilotNotes: '',
        photos: [
          { filename: 'IMG_020.jpg', timestamp: dates[2] + 'T08:30:00', location: 'N30.24 E120.14', hash: 'p7q8r9' }
        ],
        debrisResults: [
          { type: '浮萍', confidence: 0.91, location: 'N30.24 E120.14', confirmed: true }
        ],
        conclusion: '浮萍正常分布，无需处理。'
      },
      {
        flightId: 'FLT-20260528-004',
        flightDate: dates[3],
        pilot: '刘洋',
        inspector: '陈静',
        safetyOfficer: '赵磊',
        reservoir: '龙潭水库',
        batteryId: 'BAT-C001',
        batteryCycles: 88,
        batteryCyclesActual: null,
        weatherData: { windSpeed: '2.1m/s', visibility: '10km', temperature: '25°C', source: '气象站', timestamp: dates[3] + 'T09:00:00' },
        pilotNotes: '水质较清，未发现明显漂浮物。',
        photos: [
          { filename: 'IMG_030.jpg', timestamp: dates[3] + 'T09:45:00', location: 'N29.88 E119.95', hash: 's1t2u3' },
          { filename: 'IMG_031.jpg', timestamp: dates[3] + 'T09:46:00', location: 'N29.89 E119.96', hash: 'v4w5x6' }
        ],
        debrisResults: [],
        conclusion: '未发现漂浮物，水质正常。'
      },
      {
        flightId: 'FLT-20260527-005',
        flightDate: dates[4],
        pilot: '张伟',
        inspector: '赵磊',
        safetyOfficer: '李明',
        reservoir: '碧波水库',
        batteryId: 'BAT-B001',
        batteryCycles: 310,
        batteryCyclesActual: 298,
        weatherData: null,
        pilotNotes: '',
        photos: [
          { filename: 'IMG_040.jpg', timestamp: dates[4] + 'T14:00:00', location: 'N31.12 E121.22', hash: 'y7z8a1', modified: true },
          { filename: 'IMG_041.jpg', timestamp: dates[4] + 'T14:01:00', location: 'N31.12 E121.23', hash: 'b2c3d4' }
        ],
        debrisResults: [
          { type: '工业废料', confidence: 0.82, location: 'N31.12 E121.22', confirmed: false },
          { type: '浮萍', confidence: 0.73, location: 'N31.12 E121.23', confirmed: false }
        ],
        conclusion: ''
      }
    ];

    sampleRecords.forEach(function(data) {
      var record = {
        id: generateId('REC'),
        flightId: data.flightId,
        flightDate: data.flightDate,
        pilot: data.pilot,
        inspector: data.inspector,
        safetyOfficer: data.safetyOfficer,
        reservoir: data.reservoir,
        batteryId: data.batteryId,
        batteryCycles: data.batteryCycles,
        batteryCyclesActual: data.batteryCyclesActual,
        weatherData: data.weatherData,
        pilotNotes: data.pilotNotes,
        photos: (data.photos || []).map(function(p) {
          return {
            id: generateId('PHO'),
            filename: p.filename,
            timestamp: p.timestamp,
            location: p.location,
            hash: p.hash,
            modified: p.modified || false
          };
        }),
        debrisResults: (data.debrisResults || []).map(function(d) {
          return {
            id: generateId('DEB'),
            type: d.type,
            confidence: d.confidence,
            location: d.location,
            photoRef: d.photoRef || '',
            confirmed: d.confirmed || false
          };
        }),
        status: 'pending',
        conclusion: data.conclusion,
        createdAt: data.flightDate + 'T08:00:00Z',
        updatedAt: data.flightDate + 'T08:00:00Z'
      };

      state.records.push(record);

      if (record.weatherData === null || record.weatherData === undefined) {
        var wHash = simpleHash('weather-null-' + record.id);
        state.changeLog.push({
          id: generateId('CHG'),
          recordId: record.id,
          dedupeKey: dedupeKey(record.id, 'weather', wHash),
          category: 'weather',
          changeType: 'supplement',
          conclusionAffected: false,
          description: '气象数据缺失，待补充',
          explanation: '气象截图未同步，需飞手或巡检员事后补充，不影响识别结论。',
          beforeValue: null,
          afterValue: '待补充',
          timestamp: record.createdAt,
          operator: '系统'
        });
      }

      if (!record.pilotNotes) {
        var nHash = simpleHash('notes-null-' + record.id);
        state.changeLog.push({
          id: generateId('CHG'),
          recordId: record.id,
          dedupeKey: dedupeKey(record.id, 'pilot_note', nHash),
          category: 'pilot_note',
          changeType: 'supplement',
          conclusionAffected: false,
          description: '飞手备注缺失，待补充',
          explanation: '飞手备注未填写，需飞手事后补充，不影响识别结论。',
          beforeValue: null,
          afterValue: '待补充',
          timestamp: record.createdAt,
          operator: '系统'
        });
      }

      if (record.batteryCyclesActual !== null && record.batteryCyclesActual !== record.batteryCycles) {
        var bDiff = Math.abs(record.batteryCyclesActual - record.batteryCycles);
        var bHash = simpleHash('battery-diff-' + record.id + bDiff);
        var bClassification = classifyChange('battery', record.batteryCycles, record.batteryCyclesActual);
        state.changeLog.push({
          id: generateId('CHG'),
          recordId: record.id,
          dedupeKey: dedupeKey(record.id, 'battery', bHash),
          category: 'battery',
          changeType: bClassification.changeType,
          conclusionAffected: bClassification.conclusionAffected,
          description: '电池循环数差异: 申报 ' + record.batteryCycles + ' 次, 实际 ' + record.batteryCyclesActual + ' 次',
          explanation: bClassification.explanation,
          beforeValue: record.batteryCycles,
          afterValue: record.batteryCyclesActual,
          timestamp: record.createdAt,
          operator: '系统'
        });
      }

      record.photos.forEach(function(photo) {
        if (photo.modified) {
          var pHash = simpleHash('photo-modified-' + photo.id);
          state.changeLog.push({
            id: generateId('CHG'),
            recordId: record.id,
            dedupeKey: dedupeKey(record.id, 'photo', pHash),
            category: 'photo',
            changeType: 'conclusion_change',
            conclusionAffected: true,
            description: '巡检照片手工修改: ' + photo.filename,
            explanation: '巡检照片存在手工修改痕迹，可能影响漂浮物识别结论，需复核识别结果。',
            beforeValue: '原始照片',
            afterValue: '已修改',
            timestamp: record.createdAt,
            operator: '系统'
          });
        }
      });

      recalculateStatus(record);
    });

    save();
  }

  load();
  initSampleData();

  return {
    getFilteredRecords: getFilteredRecords,
    getRecord: getRecord,
    getChangeLog: getChangeLog,
    getAnomalies: getAnomalies,
    getReservoirs: getReservoirs,
    getExportData: getExportData,
    addRecord: addRecord,
    updateRecord: updateRecord,
    batchProcess: batchProcess,
    setFilter: setFilter,
    resetFilters: resetFilters,
    selectRecord: selectRecord,
    captureExportSnapshot: captureExportSnapshot,
    getState: function() { return state; }
  };
})();
