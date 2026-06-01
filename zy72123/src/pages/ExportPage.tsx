import React, { useState } from 'react';
import { useStore } from '@/store';
import { Download, FileText, User, ClipboardList } from 'lucide-react';

export default function ExportPage() {
  const {
    sensorBatches,
    currentBatchId,
    paramVersions,
    currentParamVersionId,
    estimationRuns,
    currentRunId,
    estimationResults,
    anomalyRecords,
    conflictRecords,
    dirtyDataRecords,
    manualCorrections,
    fieldNotes,
  } = useStore();

  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [includeAnomalies, setIncludeAnomalies] = useState(true);
  const [includeConflicts, setIncludeConflicts] = useState(true);
  const [includeDirtyData, setIncludeDirtyData] = useState(true);
  const [includeParams, setIncludeParams] = useState(true);
  const [handoffTo, setHandoffTo] = useState('老唐');
  const [exported, setExported] = useState(false);

  const currentBatch = sensorBatches.find((b) => b.id === currentBatchId);
  const currentVersion = paramVersions.find((v) => v.id === currentParamVersionId);
  const currentRun = estimationRuns.find((r) => r.id === currentRunId);

  const resolvedConflicts = conflictRecords.filter((c) => c.userDecision);
  const unresolvedConflicts = conflictRecords.filter((c) => !c.userDecision);
  const resolvedDirty = dirtyDataRecords.filter((d) => d.resolution);
  const unresolvedDirty = dirtyDataRecords.filter((d) => !d.resolution);

  const handleExport = () => {
    const exportData: Record<string, any> = {
      meta: {
        exportTime: new Date().toISOString(),
        system: 'EV再生制动估算系统 v1.0',
        batchId: currentBatchId,
        batchName: currentBatch?.name,
        paramVersionId: currentParamVersionId,
        paramVersion: currentVersion?.versionNumber,
        runId: currentRunId,
      },
    };

    if (includeParams && currentVersion) {
      exportData.parameters = {
        version: currentVersion.versionNumber,
        values: currentVersion.values,
        changedBy: currentVersion.changedBy,
        changedAt: currentVersion.changedAt,
        changeNote: currentVersion.changeNote,
      };
    }

    exportData.results = estimationResults.map((r) => ({
      timestamp: r.timestamp,
      regenBrakeForce: r.regenBrakeForce,
      energyRecoveryRate: r.energyRecoveryRate,
      totalEnergyRecovered: r.totalEnergyRecovered,
      anomalyFlag: r.anomalyFlag,
    }));

    if (includeAnomalies) {
      exportData.anomalies = anomalyRecords.map((a) => ({
        level: a.level,
        type: a.type,
        description: a.description,
        evidence: a.evidence,
        resolution: a.resolution,
      }));
    }

    if (includeConflicts) {
      exportData.conflicts = conflictRecords.map((c) => ({
        sensorEvidence: c.sensorEvidence,
        noteEvidence: c.noteEvidence,
        suggestedAction: c.suggestedAction,
        userDecision: c.userDecision,
        decisionReason: c.decisionReason,
        decisionTime: c.decisionTime,
      }));
    }

    if (includeDirtyData) {
      exportData.dirtyData = dirtyDataRecords.map((d) => ({
        dirtyType: d.dirtyType,
        field: d.field,
        description: d.description,
        suggestion: d.suggestion,
        resolution: d.resolution,
      }));
    }

    exportData.corrections = manualCorrections.map((c) => ({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
      correctedBy: c.correctedBy,
      correctedAt: c.correctedAt,
    }));

    exportData.handoff = {
      to: handoffTo,
      from: currentVersion?.changedBy || '未知',
      notes: '',
    };

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `regen-braking-${currentBatchId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'csv') {
      const headers = ['时间(s)', '再生制动力(N)', '能量回收率(%)', '累计回收能量(J)', '异常标记'];
      const rows = estimationResults.map((r) =>
        [r.timestamp, r.regenBrakeForce, r.energyRecoveryRate, r.totalEnergyRecovered, r.anomalyFlag].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `regen-braking-${currentBatchId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'pdf') {
      generatePDF(exportData);
    }

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const generatePDF = async (data: Record<string, any>) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('EV Regen Braking Estimation Report', 20, 20);

    doc.setFontSize(10);
    let y = 35;
    doc.text(`Batch: ${data.meta.batchName || data.meta.batchId}`, 20, y); y += 6;
    doc.text(`Param Version: v${data.meta.paramVersion}`, 20, y); y += 6;
    doc.text(`Run Time: ${data.meta.exportTime}`, 20, y); y += 6;
    doc.text(`Handoff To: ${data.handoff.to}`, 20, y); y += 12;

    doc.setFontSize(14);
    doc.text('Estimation Results', 20, y); y += 8;
    doc.setFontSize(8);
    doc.text('Time(s) | RegenForce(N) | RecoveryRate(%) | Energy(J) | Anomaly', 20, y); y += 5;

    for (const r of data.results.slice(0, 40)) {
      doc.text(
        `${r.timestamp} | ${r.regenBrakeForce} | ${r.energyRecoveryRate} | ${r.totalEnergyRecovered} | ${r.anomalyFlag}`,
        20, y
      );
      y += 4;
      if (y > 280) { doc.addPage(); y = 20; }
    }

    if (data.anomalies && data.anomalies.length > 0) {
      y += 8;
      doc.setFontSize(14);
      doc.text('Anomaly Records', 20, y); y += 8;
      doc.setFontSize(8);
      for (const a of data.anomalies) {
        doc.text(`[${a.level}] ${a.type}: ${a.description}`, 20, y); y += 5;
        if (y > 280) { doc.addPage(); y = 20; }
      }
    }

    if (data.conflicts && data.conflicts.length > 0) {
      y += 8;
      doc.setFontSize(14);
      doc.text('Conflict Records', 20, y); y += 8;
      doc.setFontSize(8);
      for (const c of data.conflicts) {
        doc.text(`Sensor: ${c.sensorEvidence}`, 20, y); y += 4;
        doc.text(`Note: ${c.noteEvidence}`, 20, y); y += 4;
        doc.text(`Decision: ${c.userDecision || 'Pending'}`, 20, y); y += 6;
        if (y > 280) { doc.addPage(); y = 20; }
      }
    }

    doc.save(`regen-braking-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-brand-500">导出与交接</h2>
        <p className="text-sm text-muted mt-1">导出估算结果与源材料关联，生成交接文档给训练教练</p>
      </div>

      {currentBatch && currentVersion ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <ClipboardList size={16} />
              导出内容概览
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">批次：</span>
                <span className="font-medium">{currentBatch.name}</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">参数版本：</span>
                <span className="font-mono font-medium">v{currentVersion.versionNumber}</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">估算结果：</span>
                <span className="font-mono">{estimationResults.length} 条</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">异常记录：</span>
                <span className="font-mono">{anomalyRecords.length} 条</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">冲突（已处理/待处理）：</span>
                <span className="font-mono">{resolvedConflicts.length}/{unresolvedConflicts.length}</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">脏数据（已处理/待处理）：</span>
                <span className="font-mono">{resolvedDirty.length}/{unresolvedDirty.length}</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">人工修正：</span>
                <span className="font-mono">{manualCorrections.length} 条</span>
              </div>
              <div className="bg-gray-50 px-3 py-2 rounded">
                <span className="text-muted">现场备注：</span>
                <span className="font-mono">{fieldNotes.length} 条</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Download size={16} />
              导出设置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-2 block">导出格式</label>
                <div className="flex gap-2">
                  {(['csv', 'json', 'pdf'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`px-4 py-2 text-sm rounded-lg font-medium uppercase ${
                        exportFormat === fmt
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-100 text-muted hover:bg-gray-200'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted mb-2 block">包含内容</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAnomalies}
                      onChange={(e) => setIncludeAnomalies(e.target.checked)}
                      className="rounded"
                    />
                    异常记录
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeConflicts}
                      onChange={(e) => setIncludeConflicts(e.target.checked)}
                      className="rounded"
                    />
                    冲突记录
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDirtyData}
                      onChange={(e) => setIncludeDirtyData(e.target.checked)}
                      className="rounded"
                    />
                    脏数据记录
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeParams}
                      onChange={(e) => setIncludeParams(e.target.checked)}
                      className="rounded"
                    />
                    参数版本快照
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <User size={16} />
              交接信息
            </h3>
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-xs text-muted mb-2 block">交接人</label>
                <input
                  type="text"
                  value={handoffTo}
                  onChange={(e) => setHandoffTo(e.target.value)}
                  className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-40"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-2 block">经办人</label>
                <span className="text-sm">{currentVersion.changedBy}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              <Download size={16} />
              导出 {exportFormat.toUpperCase()}
            </button>
            {exported && (
              <span className="text-ok text-sm flex items-center gap-1">
                ✓ 导出成功
              </span>
            )}
          </div>

          {unresolvedConflicts.length > 0 && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
              <p className="text-sm text-danger font-medium">
                ⚠ 仍有 {unresolvedConflicts.length} 条数据冲突未处理，建议在导出前完成冲突审查
              </p>
            </div>
          )}
          {unresolvedDirty.length > 0 && (
            <div className="bg-warn/5 border border-warn/20 rounded-xl p-4">
              <p className="text-sm text-warn font-medium">
                ⚠ 仍有 {unresolvedDirty.length} 条脏数据未处理，导出时将标注为"未处理"
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <FileText size={48} className="mb-4 opacity-30" />
          <p className="text-lg">请先完成数据导入和估算</p>
        </div>
      )}
    </div>
  );
}
