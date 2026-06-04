const DataManager = (() => {
  const state = {
    safetyThresholds: [],
    equipmentNameplates: [],
    conflicts: [],
    selfCheckResults: [],
    parameterVersions: [],
    lateMaterials: [],
    currentStep: 1,
    handoverReport: null,
    _idCounter: 0
  };

  const listeners = [];

  function genId() { return 'id_' + (++state._idCounter) + '_' + Date.now(); }
  function subscribe(fn) { listeners.push(fn); }
  function notify(eventType, payload) { listeners.forEach(fn => fn(eventType, payload)); }
  function getState() { return state; }

  function importSafetyThresholds(rows) {
    const duplicateCheck = checkDuplicateImport(rows, state.safetyThresholds, 'safety');
    const unitIssues = checkUnitIssues(rows);

    const newRows = rows.map(r => ({
      ...r,
      id: genId(),
      status: 'imported',
      confirmedAt: null,
      confirmedBy: null,
      version: 1,
      unitFlag: detectUnitFlag(r.unit, r.value),
      _originalRemark: r.remark || ''
    }));

    state.safetyThresholds = [...state.safetyThresholds, ...newRows];

    if (duplicateCheck.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', '发现重复导入的安全阈值参数', 'warn', duplicateCheck.map(d => d.id));
    }

    unitIssues.forEach(issue => {
      addSelfCheck('UNIT_MISMATCH', issue.message, 'fail', issue.relatedIds || []);
    });

    recordParameterVersions(newRows, 'safety_threshold_import', '首次导入安全阈值表');
    detectConflicts();
    notify('safety_thresholds_updated', state.safetyThresholds);
    return { added: newRows.length, duplicates: duplicateCheck.length, unitIssues: unitIssues.length };
  }

  function importEquipmentNameplates(rows, isLateArrival = false) {
    const duplicateCheck = checkDuplicateImport(rows, state.equipmentNameplates, 'nameplate');
    const unitIssues = checkUnitIssues(rows);

    const newRows = rows.map(r => ({
      ...r,
      id: genId(),
      arrivedAt: new Date().toISOString(),
      isLateArrival: isLateArrival,
      version: 1,
      unitFlag: detectUnitFlag(r.unit, r.value),
      _originalRemark: r.remark || ''
    }));

    if (isLateArrival) {
      state.lateMaterials.push(...newRows);
      notify('late_material_arrived', newRows);
    }

    state.equipmentNameplates = [...state.equipmentNameplates, ...newRows];

    if (duplicateCheck.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', '发现重复导入的设备铭牌参数', 'warn', duplicateCheck.map(d => d.id));
    }

    unitIssues.forEach(issue => {
      addSelfCheck('UNIT_MISMATCH', issue.message, 'fail', issue.relatedIds || []);
    });

    if (isLateArrival) {
      refreshRelatedDetailsOnly(newRows);
    }

    recordParameterVersions(newRows, 'nameplate_import', isLateArrival ? '晚到材料补录' : '补看设备铭牌参数');
    detectConflicts();

    if (state.currentStep >= 2) {
      addSelfCheck('RECALC_NEEDED', '补录设备铭牌参数后需重算相关指标', 'warn', newRows.map(r => r.id));
    }

    notify('equipment_nameplates_updated', state.equipmentNameplates);
    return { added: newRows.length, duplicates: duplicateCheck.length, unitIssues: unitIssues.length };
  }

  function refreshRelatedDetailsOnly(lateRows) {
    lateRows.forEach(lateRow => {
      const paramName = lateRow.paramName;
      state.safetyThresholds.forEach(st => {
        if (st.paramName === paramName && st.status === 'confirmed') {
          if (!st._lateRefreshed) {
            st._lateRefreshed = true;
            st._lateRelatedId = lateRow.id;
          }
        }
      });
    });
  }

  function detectConflicts() {
    state.safetyThresholds.forEach(st => {
      state.equipmentNameplates.forEach(np => {
        if (st.paramName === np.paramName) {
          const stNorm = normalizeUnitValue(st.value, st.unit);
          const npNorm = normalizeUnitValue(np.value, np.unit);

          const valueMismatch = stNorm !== null && npNorm !== null && Math.abs(stNorm - npNorm) > 0.01;
          const mixedUnit = isMixedUnit(st.unit, np.unit);

          if (valueMismatch || mixedUnit) {
            const existing = state.conflicts.find(c =>
              c.safetyThresholdId === st.id && c.nameplateId === np.id
            );
            if (!existing) {
              state.conflicts.push({
                id: genId(),
                safetyThresholdId: st.id,
                nameplateId: np.id,
                paramName: st.paramName,
                safetyValue: st.value,
                safetyUnit: st.unit,
                nameplateValue: np.value,
                nameplateUnit: np.unit,
                safetyRemark: st._originalRemark,
                nameplateRemark: np._originalRemark,
                evidence: buildConflictEvidence(st, np, valueMismatch, mixedUnit),
                status: mixedUnit && !valueMismatch ? 'pending_review' : 'pending',
                decidedBy: null,
                decidedAt: null,
                reason: ''
              });

              if (mixedUnit) {
                addSelfCheck('UNIT_MISMATCH',
                  `参数"${st.paramName}"在安全阈值表中为${st.unit}，在铭牌中为${np.unit}，摄氏度与开尔文混用，需训练教练复核`,
                  'fail', [st.id, np.id]);
              }
            }
          }
        }
      });
    });
    notify('conflicts_updated', state.conflicts);
  }

  function buildConflictEvidence(st, np, valueMismatch, mixedUnit) {
    const stNorm = normalizeUnitValue(st.value, st.unit);
    const npNorm = normalizeUnitValue(np.value, np.unit);
    const diff = stNorm !== null && npNorm !== null ? Math.abs(stNorm - npNorm) : null;
    return {
      safetySource: '安全阈值表',
      safetyValue: `${st.value} ${st.unit}`,
      safetyRemark: st._originalRemark || '（无备注）',
      nameplateSource: '设备铭牌参数',
      nameplateValue: `${np.value} ${np.unit}`,
      nameplateRemark: np._originalRemark || '（无备注）',
      normalizedDiff: diff !== null ? `${diff.toFixed(4)} K` : '无法归一化比较',
      mixedUnit: mixedUnit,
      valueMismatch: valueMismatch,
      requiresCoachReview: mixedUnit
    };
  }

  function resolveConflict(conflictId, decision, decidedBy, reason) {
    const c = state.conflicts.find(x => x.id === conflictId);
    if (!c) return;

    if (c.evidence && c.evidence.requiresCoachReview && decision !== 'coach_reviewed') {
      c.status = decision;
      c.decidedBy = decidedBy;
      c.decidedAt = new Date().toISOString();
      c.reason = (reason || '') + ' [注：含C/K混用，建议训练教练复核]';
    } else {
      c.status = decision;
      c.decidedBy = decidedBy;
      c.decidedAt = new Date().toISOString();
      c.reason = reason || '';
    }

    recordParameterVersion(
      c.paramName,
      decision === 'confirmed' ? c.nameplateValue : c.safetyValue,
      decision === 'confirmed' ? c.nameplateUnit : c.safetyUnit,
      decision === 'confirmed' ? 'nameplate' : 'safety_threshold',
      `冲突解决：${decision === 'confirmed' ? '采纳铭牌值' : '保留阈值表值'}，理由：${reason || '未填写'}`
    );

    notify('conflict_resolved', c);
  }

  function addSelfCheck(checkType, description, severity, relatedIds) {
    const existing = state.selfCheckResults.find(sc =>
      sc.checkType === checkType && sc.description === description
    );
    if (existing) return;
    state.selfCheckResults.push({
      id: genId(),
      checkType,
      description,
      severity,
      relatedIds: relatedIds || [],
      timestamp: new Date().toISOString()
    });
    notify('selfcheck_updated', state.selfCheckResults);
  }

  function runFullSelfCheck() {
    state.selfCheckResults = [];

    const stParams = state.safetyThresholds.map(r => r.paramName);
    const stDupes = stParams.filter((p, i) => stParams.indexOf(p) !== i);
    if (stDupes.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', `安全阈值表中存在 ${stDupes.length} 组重复参数`, 'warn', stDupes);
    } else if (state.safetyThresholds.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', '安全阈值表无重复参数', 'pass', []);
    }

    const npParams = state.equipmentNameplates.map(r => r.paramName);
    const npDupes = npParams.filter((p, i) => npParams.indexOf(p) !== i);
    if (npDupes.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', `设备铭牌中存在 ${npDupes.length} 组重复参数`, 'warn', npDupes);
    } else if (state.equipmentNameplates.length > 0) {
      addSelfCheck('DUPLICATE_IMPORT', '设备铭牌无重复参数', 'pass', []);
    }

    const mixedUnitIssues = [];
    state.safetyThresholds.forEach(r => { if (r.unitFlag === 'mixed') mixedUnitIssues.push(r.id); });
    state.equipmentNameplates.forEach(r => { if (r.unitFlag === 'mixed') mixedUnitIssues.push(r.id); });
    state.conflicts.forEach(c => {
      if (c.evidence && c.evidence.mixedUnit) mixedUnitIssues.push(c.id);
    });
    if (mixedUnitIssues.length > 0) {
      addSelfCheck('UNIT_MISMATCH', `发现 ${mixedUnitIssues.length} 处摄氏度/开尔文混用，需训练教练复核`, 'fail', mixedUnitIssues);
    } else if (state.safetyThresholds.length > 0 || state.equipmentNameplates.length > 0) {
      addSelfCheck('UNIT_MISMATCH', '未发现摄氏度/开尔文混用', 'pass', []);
    }

    if (state.equipmentNameplates.length > 0 && state.safetyThresholds.length > 0) {
      addSelfCheck('RECALC_NEEDED', '补录设备铭牌参数后需重算相关指标', 'warn',
        state.equipmentNameplates.map(r => r.id));
    } else if (state.safetyThresholds.length > 0) {
      addSelfCheck('RECALC_NEEDED', '暂无补录，无需重算', 'pass', []);
    }

    const exportConsistent = verifyExportConsistency();
    if (exportConsistent && (state.safetyThresholds.length > 0 || state.equipmentNameplates.length > 0)) {
      addSelfCheck('EXPORT_CONSISTENCY', '导出数据与展示数据一致', 'pass', []);
    } else if (!exportConsistent) {
      addSelfCheck('EXPORT_CONSISTENCY', '导出数据与展示数据不一致', 'fail', []);
    }

    notify('selfcheck_completed', state.selfCheckResults);
    return state.selfCheckResults;
  }

  function verifyExportConsistency() {
    const displayData = getDisplayData();
    const exportData = getExportData();
    const apiData = getApiReturnData();
    return JSON.stringify(displayData) === JSON.stringify(exportData) &&
           JSON.stringify(exportData) === JSON.stringify(apiData);
  }

  function getDisplayData() { return buildUnifiedResult(); }
  function getExportData() { return buildUnifiedResult(); }
  function getApiReturnData() { return buildUnifiedResult(); }

  function buildUnifiedResult() {
    const allParams = {};

    state.safetyThresholds.forEach(st => {
      allParams[st.paramName] = allParams[st.paramName] || {};
      allParams[st.paramName].safety = {
        value: st.value,
        unit: st.unit,
        remark: st._originalRemark,
        unitFlag: st.unitFlag,
        status: st.status
      };
    });

    state.equipmentNameplates.forEach(np => {
      allParams[np.paramName] = allParams[np.paramName] || {};
      allParams[np.paramName].nameplate = {
        value: np.value,
        unit: np.unit,
        remark: np._originalRemark,
        unitFlag: np.unitFlag,
        isLateArrival: np.isLateArrival
      };
    });

    state.conflicts.forEach(c => {
      if (allParams[c.paramName]) {
        allParams[c.paramName].conflict = {
          status: c.status,
          decidedBy: c.decidedBy,
          reason: c.reason,
          evidence: c.evidence,
          mixedUnit: c.evidence ? c.evidence.mixedUnit : false
        };
      }
    });

    state.parameterVersions.forEach(pv => {
      if (allParams[pv.paramName]) {
        allParams[pv.paramName].versions = allParams[pv.paramName].versions || [];
        allParams[pv.paramName].versions.push({
          version: pv.version,
          value: pv.value,
          unit: pv.unit,
          source: pv.source,
          reason: pv.reason,
          timestamp: pv.timestamp
        });
      }
    });

    const results = [];
    Object.entries(allParams).forEach(([name, data]) => {
      const r = { paramName: name };
      if (data.safety) r.safety = data.safety;
      if (data.nameplate) r.nameplate = data.nameplate;
      if (data.conflict) r.conflict = data.conflict;
      if (data.versions) r.versions = data.versions;

      const isMixed = data.safety && data.nameplate &&
        isMixedUnit(data.safety.unit, data.nameplate.unit);
      if (isMixed) {
        r.unitFlag = 'mixed';
        r.requiresCoachReview = true;
      }

      results.push(r);
    });
    return results;
  }

  function recordParameterVersions(rows, source, reason) {
    rows.forEach(r => {
      state.parameterVersions.push({
        id: genId(),
        paramName: r.paramName,
        version: r.version || 1,
        value: r.value,
        unit: r.unit,
        source,
        reason,
        timestamp: new Date().toISOString()
      });
    });
    notify('versions_updated', state.parameterVersions);
  }

  function recordParameterVersion(paramName, value, unit, source, reason) {
    const existing = state.parameterVersions.filter(pv => pv.paramName === paramName);
    const nextVer = existing.length > 0 ? Math.max(...existing.map(pv => pv.version)) + 1 : 1;
    state.parameterVersions.push({
      id: genId(),
      paramName,
      version: nextVer,
      value,
      unit,
      source,
      reason,
      timestamp: new Date().toISOString()
    });
    notify('versions_updated', state.parameterVersions);
  }

  function advanceStep(step) {
    if (step > state.currentStep) {
      state.currentStep = step;
      notify('step_changed', step);
    }
  }

  function confirmSafetyThreshold(id, confirmedBy) {
    const st = state.safetyThresholds.find(x => x.id === id);
    if (st) {
      st.status = 'confirmed';
      st.confirmedAt = new Date().toISOString();
      st.confirmedBy = confirmedBy;
      notify('safety_threshold_confirmed', st);
    }
  }

  function generateHandoverReport() {
    const results = buildUnifiedResult();
    state.handoverReport = {
      id: genId(),
      generatedAt: new Date().toISOString(),
      safetyThresholdCount: state.safetyThresholds.length,
      nameplateCount: state.equipmentNameplates.length,
      conflictCount: state.conflicts.length,
      resolvedConflicts: state.conflicts.filter(c => c.status !== 'pending' && c.status !== 'pending_review').length,
      pendingConflicts: state.conflicts.filter(c => c.status === 'pending' || c.status === 'pending_review').length,
      mixedUnitItems: results.filter(r => r.requiresCoachReview).length,
      data: results,
      selfChecks: [...state.selfCheckResults]
    };
    notify('report_generated', state.handoverReport);
    return state.handoverReport;
  }

  function checkDuplicateImport(newRows, existingRows, type) {
    const dupes = [];
    const seen = new Map();
    const allRows = type.endsWith('-internal') ? newRows : [...existingRows, ...newRows];
    allRows.forEach(r => {
      const key = `${r.paramName}_${r.unit}`;
      if (seen.has(key)) {
        dupes.push({ id: r.id || seen.get(key), paramName: r.paramName, unit: r.unit });
      } else {
        seen.set(key, r.id);
      }
    });
    return dupes;
  }

  function checkUnitIssues(rows) {
    const issues = [];
    rows.forEach(r => {
      const flag = detectUnitFlag(r.unit, r.value);
      if (flag === 'mixed') {
        issues.push({
          message: `参数"${r.paramName}"存在摄氏度/开尔文混用嫌疑（值=${r.value}, 单位=${r.unit}）`,
          relatedIds: [r.id],
          severity: 'fail'
        });
      }
    });
    return issues;
  }

  function detectUnitFlag(unit, value) {
    if (!unit) return 'unknown';
    const u = unit.toLowerCase().trim();
    if (u === '°c' || u === 'celsius' || u === '摄氏度') return 'celsius';
    if (u === 'k' || u === 'kelvin' || u === '开尔文') return 'kelvin';
    if (u.includes('°c') && u.includes('k')) return 'mixed';
    return 'other';
  }

  function isMixedUnit(unit1, unit2) {
    const f1 = detectUnitFlag(unit1, '');
    const f2 = detectUnitFlag(unit2, '');
    return (f1 === 'celsius' && f2 === 'kelvin') || (f1 === 'kelvin' && f2 === 'celsius');
  }

  function normalizeUnitValue(value, unit) {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return null;
    const flag = detectUnitFlag(unit, '');
    if (flag === 'celsius') return numVal + 273.15;
    if (flag === 'kelvin') return numVal;
    return numVal;
  }

  function clearAll() {
    state.safetyThresholds = [];
    state.equipmentNameplates = [];
    state.conflicts = [];
    state.selfCheckResults = [];
    state.parameterVersions = [];
    state.lateMaterials = [];
    state.currentStep = 1;
    state.handoverReport = null;
    notify('all_cleared', null);
  }

  return {
    getState, subscribe, notify, genId,
    importSafetyThresholds, importEquipmentNameplates,
    resolveConflict, addSelfCheck, runFullSelfCheck,
    verifyExportConsistency, getDisplayData, getExportData, getApiReturnData,
    buildUnifiedResult, advanceStep, confirmSafetyThreshold,
    generateHandoverReport, clearAll, refreshRelatedDetailsOnly,
    isMixedUnit, detectUnitFlag, normalizeUnitValue
  };
})();
