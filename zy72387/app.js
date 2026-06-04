const App = (() => {
  function init() {
    DataManager.subscribe(() => {
      UI.renderSelfCheckPanel();
      UI.renderConflictSummary();
      UI.renderLateMaterialSummary();
      UI.renderVersionHistory();
      UI.renderDataSourceStatus();
    });
    UI.renderCenter(1);
    UI.renderSelfCheckPanel();
    UI.renderConflictSummary();
    UI.renderLateMaterialSummary();
    UI.renderVersionHistory();
    UI.renderDataSourceStatus();
  }

  function navigateToStep(step) {
    DataManager.advanceStep(step);
    UI.updateWorkflowBar(step);
    UI.renderCenter(step);
  }

  function goToStep(step) {
    const state = DataManager.getState();
    if (step === 2 && state.safetyThresholds.length === 0) {
      UI.showToast('请先导入安全阈值表', 'warn');
      return;
    }
    if (step === 3) {
      const pendingConflicts = state.conflicts.filter(c => c.status === 'pending' || c.status === 'pending_review');
      if (pendingConflicts.length > 0) {
        UI.showToast(`还有 ${pendingConflicts.length} 处冲突待处理`, 'warn');
        return;
      }
    }
    navigateToStep(step);
  }

  function loadDemoSafetyThresholds() {
    const demoData = [
      { paramName: '烟雾发生器出口温度', value: '250', unit: '°C', remark: '出厂校准值，实际可能偏差±5°C' },
      { paramName: '环境温度上限', value: '40', unit: '°C', remark: 'GB/T 2900.65-2016 规定' },
      { paramName: '烟雾颗粒浓度', value: '0.15', unit: 'mg/m³', remark: '8小时TWA限值' },
      { paramName: '扩散速率', value: '2.5', unit: 'm/s', remark: '强制通风条件' },
      { paramName: '安全距离', value: '3.0', unit: 'm', remark: '观众区最小距离' },
      { paramName: '烟雾发生器功率', value: '3000', unit: 'W', remark: '额定功率，峰值可达3500W' },
      { paramName: '储存温度下限', value: '263.15', unit: 'K', remark: '即-10°C，低于此温度设备可能受损' },
      { paramName: '烟雾剂闪点', value: '323.15', unit: 'K', remark: '即50°C，注意通风散热' }
    ];
    const result = DataManager.importSafetyThresholds(demoData);
    UI.showToast(`安全阈值表导入成功：${result.added} 条，重复 ${result.duplicates}，单位问题 ${result.unitIssues}`, 'success');
    DataManager.runFullSelfCheck();
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function loadDemoNameplates() {
    const demoData = [
      { paramName: '烟雾发生器出口温度', value: '528.15', unit: 'K', remark: '铭牌标注，实测约523K，与阈值表250°C需对比确认' },
      { paramName: '环境温度上限', value: '313.15', unit: 'K', remark: '铭牌写K，对应40°C' },
      { paramName: '烟雾颗粒浓度', value: '0.18', unit: 'mg/m³', remark: '铭牌标注高于阈值表，需核实' },
      { paramName: '扩散速率', value: '2.5', unit: 'm/s', remark: '' },
      { paramName: '储存温度下限', value: '-10', unit: '°C', remark: '铭牌标注为-10°C，阈值表为263.15K，数值一致但单位不同' },
      { paramName: '烟雾剂闪点', value: '50', unit: '°C', remark: '铭牌标注为50°C，阈值表为323.15K，数值一致但单位不同' }
    ];
    const result = DataManager.importEquipmentNameplates(demoData, false);
    UI.showToast(`设备铭牌参数导入成功：${result.added} 条，冲突检测中...`, 'success');
    DataManager.runFullSelfCheck();
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function loadLateArrivalNameplates() {
    const lateData = [
      { paramName: '烟雾发生器功率', value: '3200', unit: 'W', remark: '晚到铭牌数据，实测额定功率3200W（非3000W），请核实' },
      { paramName: '安全距离', value: '3.5', unit: 'm', remark: '晚到铭牌数据，建议安全距离3.5m（阈值表为3.0m）' }
    ];
    const result = DataManager.importEquipmentNameplates(lateData, true);
    UI.showToast(`晚到材料补录成功：${result.added} 条，仅刷新相关明细，已确认内容保留`, 'warn');
    DataManager.runFullSelfCheck();
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function confirmSafetyThreshold(id) {
    DataManager.confirmSafetyThreshold(id, '质检员小白');
    UI.showToast('已确认该安全阈值参数', 'success');
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function confirmAllSafetyThresholds() {
    const state = DataManager.getState();
    state.safetyThresholds.forEach(st => {
      if (st.status !== 'confirmed') {
        DataManager.confirmSafetyThreshold(st.id, '质检员小白');
      }
    });
    UI.showToast('已确认全部安全阈值参数', 'success');
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function resolveConflict(conflictId, decision, decidedBy) {
    const reasonInput = document.getElementById(`reason_${conflictId}`);
    const reason = reasonInput ? reasonInput.value.trim() : '';
    if (!reason) {
      UI.showToast('请填写取舍理由后再处理冲突', 'warn');
      if (reasonInput) reasonInput.focus();
      return;
    }
    DataManager.resolveConflict(conflictId, decision, decidedBy, reason);
    UI.showToast(`冲突已${decision === 'confirmed' ? '确认（采纳铭牌值）' : '驳回（保留阈值表值）'}`, decision === 'confirmed' ? 'success' : 'info');
    DataManager.runFullSelfCheck();
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function generateReport() {
    const report = DataManager.generateHandoverReport();
    UI.showToast('交接报告已生成', 'success');
    DataManager.runFullSelfCheck();
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function runSelfCheck() {
    const results = DataManager.runFullSelfCheck();
    const fails = results.filter(r => r.severity === 'fail').length;
    const warns = results.filter(r => r.severity === 'warn').length;
    UI.showToast(`自检完成：${results.length} 项，失败 ${fails}，警告 ${warns}`, fails > 0 ? 'error' : 'success');
    UI.renderCenter(DataManager.getState().currentStep);
  }

  function exportCSV() {
    const data = DataManager.getExportData();
    if (data.length === 0) {
      UI.showToast('暂无数据可导出', 'warn');
      return;
    }
    const headers = ['参数名称', '安全阈值', '安全阈值单位', '安全阈值备注', '铭牌值', '铭牌单位', '铭牌备注', '冲突状态', 'C/K混用', '需教练复核', '取舍理由'];
    const rows = data.map(r => [
      r.paramName,
      r.safety ? r.safety.value : '',
      r.safety ? r.safety.unit : '',
      r.safety ? (r.safety.remark || '') : '',
      r.nameplate ? r.nameplate.value : '',
      r.nameplate ? r.nameplate.unit : '',
      r.nameplate ? (r.nameplate.remark || '') : '',
      r.conflict ? r.conflict.status : '',
      r.unitFlag === 'mixed' ? '是' : '否',
      r.requiresCoachReview ? '是' : '否',
      r.conflict ? (r.conflict.reason || '') : ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `舞台烟雾扩散_交接明细_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('CSV 导出成功', 'success');
  }

  function exportJSON() {
    const data = DataManager.getExportData();
    if (data.length === 0) {
      UI.showToast('暂无数据可导出', 'warn');
      return;
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `舞台烟雾扩散_交接明细_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('JSON 导出成功', 'success');
  }

  function showApiReturn() {
    const data = DataManager.getApiReturnData();
    const consistent = DataManager.verifyExportConsistency();
    UI.showModal('API 返回数据', `
      <div style="margin-bottom:12px;">
        <span style="font-size:12px;color:var(--text-muted)">与展示/导出数据一致性：</span>
        <span class="status-dot ${consistent ? 'green' : 'red'}" style="margin-left:6px;"></span>
        <span style="font-size:12px;color:${consistent ? 'var(--success)' : 'var(--error)'};margin-left:4px;">${consistent ? '一致' : '不一致'}</span>
      </div>
      <pre style="background:var(--bg);padding:12px;border-radius:8px;overflow-x:auto;font-size:11px;max-height:400px;line-height:1.4;">${JSON.stringify(data, null, 2)}</pre>
    `);
  }

  function clearAll() {
    DataManager.clearAll();
    UI.showToast('已清空所有数据', 'info');
    UI.updateWorkflowBar(1);
    UI.renderCenter(1);
  }

  return {
    init, navigateToStep, goToStep,
    loadDemoSafetyThresholds, loadDemoNameplates, loadLateArrivalNameplates,
    confirmSafetyThreshold, confirmAllSafetyThresholds,
    resolveConflict, generateReport, runSelfCheck,
    exportCSV, exportJSON, showApiReturn, clearAll,
    closeModal: UI.closeModal
  };
})();
