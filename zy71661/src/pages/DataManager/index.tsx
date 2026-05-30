import { useState, useRef } from 'react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useSimulationStore } from '@/store/useSimulationStore';
import { exportToJSON } from '@/utils/export/exporter';
import dayjs from 'dayjs';
import {
  GitBranch,
  ArrowLeftRight,
  Upload,
  Download,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { Simulation } from '@/types/simulation';

type DataManagerTab = 'history' | 'compare' | 'import' | 'export';

function VersionHistory() {
  const { currentSimulation, setSimulation } = useSimulationStore();
  const { versions, revertToVersion, loadVersions } = useHistoryStore();
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const displayVersions = currentSimulation?.versions ?? versions;

  const handleRevert = (versionId: string) => {
    const sim = revertToVersion(versionId);
    if (sim) {
      setSimulation(sim);
      loadVersions(sim.versions);
      setRevertingId(null);
    }
  };

  if (displayVersions.length === 0) {
    return <p className="text-sm text-primary-300 py-4 text-center">暂无版本记录</p>;
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-primary-700/30" />
      <div className="space-y-4">
        {displayVersions.map((v, i) => (
          <div key={v.id} className="relative">
            <div className="absolute -left-5 top-3 h-4 w-4 rounded-full bg-primary-600 border-2 border-primary-400" />
            <div className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">v{v.versionNumber}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    v.importStatus === 'new'
                      ? 'bg-success-500/20 text-success-400'
                      : v.importStatus === 'duplicate'
                      ? 'bg-primary-600/20 text-primary-200'
                      : v.importStatus === 'update'
                      ? 'bg-accent-400/20 text-accent-400'
                      : v.importStatus === 'conflict'
                      ? 'bg-danger-500/20 text-danger-400'
                      : 'bg-primary-600/20 text-primary-200'
                  }`}
                >
                  {v.importStatus === 'new' ? '新建' : v.importStatus === 'duplicate' ? '重复' : v.importStatus === 'update' ? '更新' : v.importStatus === 'conflict' ? '冲突' : v.importStatus}
                </span>
              </div>
              <p className="text-xs text-primary-200 mb-1">{v.changeSummary}</p>
              <p className="text-xs text-primary-400">
                {dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')} · {v.createdBy}
              </p>
              {i < displayVersions.length - 1 && (
                <button
                  onClick={() => setRevertingId(revertingId === v.id ? null : v.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-primary-300 hover:text-accent-400 transition-colors"
                >
                  <RotateCcw size={12} />
                  回滚到此版本
                </button>
              )}
              {revertingId === v.id && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleRevert(v.id)}
                    className="flex items-center gap-1 text-xs bg-danger-500/20 text-danger-400 px-2 py-1 rounded hover:bg-danger-500/30"
                  >
                    <Check size={12} />
                    确认回滚
                  </button>
                  <button
                    onClick={() => setRevertingId(null)}
                    className="flex items-center gap-1 text-xs bg-primary-600/20 text-primary-200 px-2 py-1 rounded hover:bg-primary-600/30"
                  >
                    <X size={12} />
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionCompare() {
  const { currentSimulation } = useSimulationStore();
  const { versions, getVersionDiff } = useHistoryStore();
  const [v1, setV1] = useState<string>('');
  const [v2, setV2] = useState<string>('');

  const displayVersions = currentSimulation?.versions ?? versions;
  const diff = v1 && v2 ? getVersionDiff(v1, v2) : null;

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-xs text-primary-200 mb-1 block">版本 A</label>
          <select value={v1} onChange={(e) => setV1(e.target.value)} className="input-field w-full text-sm">
            <option value="">选择版本</option>
            {displayVersions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} - {v.changeSummary}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <ArrowLeftRight size={16} className="text-primary-300" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-primary-200 mb-1 block">版本 B</label>
          <select value={v2} onChange={(e) => setV2(e.target.value)} className="input-field w-full text-sm">
            <option value="">选择版本</option>
            {displayVersions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} - {v.changeSummary}
              </option>
            ))}
          </select>
        </div>
      </div>

      {diff && (
        <div className="space-y-2">
          {diff.added.length > 0 && (
            <div className="rounded-lg bg-success-500/10 border border-success-500/20 p-3">
              <h4 className="text-xs font-semibold text-success-400 mb-1">新增</h4>
              {diff.added.map((f) => (
                <p key={f} className="text-xs text-success-300">+ {f}</p>
              ))}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div className="rounded-lg bg-danger-500/10 border border-danger-500/20 p-3">
              <h4 className="text-xs font-semibold text-danger-400 mb-1">删除</h4>
              {diff.removed.map((f) => (
                <p key={f} className="text-xs text-danger-300">- {f}</p>
              ))}
            </div>
          )}
          {diff.modified.length > 0 && (
            <div className="rounded-lg bg-accent-400/10 border border-accent-400/20 p-3">
              <h4 className="text-xs font-semibold text-accent-400 mb-1">修改</h4>
              {diff.modified.map((f) => (
                <p key={f} className="text-xs text-accent-300">~ {f}</p>
              ))}
            </div>
          )}
          {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
            <p className="text-xs text-primary-300 text-center py-4">两个版本无差异</p>
          )}
        </div>
      )}
    </div>
  );
}

function DataImport() {
  const { currentSimulation, setSimulation } = useSimulationStore();
  const { checkImport, importCheckResult, clearImportCheck } = useHistoryStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<Simulation | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, 'keep_old' | 'use_new'>>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Simulation;
        setImportData(data);
        if (currentSimulation) {
          checkImport(currentSimulation, data);
        }
      } catch {
        setImportData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleResolveConflict = (field: string, resolution: 'keep_old' | 'use_new') => {
    setConflictResolutions((prev) => ({ ...prev, [field]: resolution }));
  };

  const handleApplyImport = () => {
    if (!importData) return;
    if (currentSimulation && importCheckResult?.status === 'conflict') {
      const merged = { ...currentSimulation };
      importCheckResult.conflictFields.forEach((field) => {
        const resolution = conflictResolutions[field];
        if (resolution === 'use_new') {
          (merged as unknown as Record<string, unknown>)[field] = (importData as unknown as Record<string, unknown>)[field];
        }
      });
      setSimulation(merged as Simulation);
    } else if (importCheckResult?.status === 'new') {
      setSimulation(importData);
    } else if (importCheckResult?.status === 'update') {
      setSimulation(importData);
    }
    setImportData(null);
    clearImportCheck();
  };

  return (
    <div>
      <div className="mb-4">
        <label className="text-xs text-primary-200 mb-2 block">选择 JSON 文件导入</label>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-primary text-sm flex items-center gap-1.5">
            <Upload size={14} />
            选择文件
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {importCheckResult && (
        <div className="card p-4 mb-4">
          <h4 className="text-sm font-semibold text-white mb-3">导入检测结果</h4>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`text-xs px-2 py-1 rounded font-medium ${
                importCheckResult.status === 'new'
                  ? 'bg-success-500/20 text-success-400'
                  : importCheckResult.status === 'duplicate'
                  ? 'bg-primary-600/20 text-primary-200'
                  : importCheckResult.status === 'update'
                  ? 'bg-accent-400/20 text-accent-400'
                  : 'bg-danger-500/20 text-danger-400'
              }`}
            >
              {importCheckResult.status === 'new'
                ? '新数据'
                : importCheckResult.status === 'duplicate'
                ? '重复数据'
                : importCheckResult.status === 'update'
                ? '更新数据'
                : '冲突数据'}
            </span>
          </div>

          {importCheckResult.differences.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-primary-300 mb-1">差异字段:</p>
              <div className="flex flex-wrap gap-1">
                {importCheckResult.differences.map((d) => (
                  <span key={d} className="text-xs bg-primary-700/50 text-primary-200 px-2 py-0.5 rounded">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {importCheckResult.status === 'conflict' && importCheckResult.conflictFields.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-danger-400 mb-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                冲突字段 - 请选择保留方案:
              </p>
              <div className="space-y-2">
                {importCheckResult.conflictFields.map((field) => (
                  <div key={field} className="rounded-lg bg-primary-800/50 p-3">
                    <p className="text-xs text-white mb-2">{field}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(field, 'keep_old')}
                        className={`text-xs px-3 py-1 rounded ${
                          conflictResolutions[field] === 'keep_old'
                            ? 'bg-primary-600 text-white'
                            : 'bg-primary-700/50 text-primary-200 hover:text-white'
                        }`}
                      >
                        保留旧值
                      </button>
                      <button
                        onClick={() => handleResolveConflict(field, 'use_new')}
                        className={`text-xs px-3 py-1 rounded ${
                          conflictResolutions[field] === 'use_new'
                            ? 'bg-accent-400 text-white'
                            : 'bg-primary-700/50 text-primary-200 hover:text-white'
                        }`}
                      >
                        使用新值
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importCheckResult.status !== 'duplicate' && (
            <button onClick={handleApplyImport} className="btn-accent text-sm">
              应用导入
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DataExport() {
  const { currentSimulation } = useSimulationStore();

  const handleExport = () => {
    if (!currentSimulation) return;
    exportToJSON(currentSimulation, currentSimulation.name);
  };

  return (
    <div>
      <p className="text-xs text-primary-200 mb-3">导出当前模拟数据为 JSON 文件</p>
      <button onClick={handleExport} disabled={!currentSimulation} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
        <Download size={14} />
        导出 JSON
      </button>
    </div>
  );
}

export default function DataManager() {
  const [activeTab, setActiveTab] = useState<DataManagerTab>('history');
  const { currentSimulation } = useSimulationStore();

  if (!currentSimulation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-primary-300">尚未创建模拟，请先新建模拟</p>
      </div>
    );
  }

  const tabs: { key: DataManagerTab; label: string; icon: React.ReactNode }[] = [
    { key: 'history', label: '版本历史', icon: <GitBranch size={14} /> },
    { key: 'compare', label: '版本对比', icon: <ArrowLeftRight size={14} /> },
    { key: 'import', label: '数据导入', icon: <Upload size={14} /> },
    { key: 'export', label: '导出数据', icon: <Download size={14} /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-primary-700/30 px-4 py-2">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary-600 text-white'
                : 'text-primary-200 hover:bg-primary-800 hover:text-white'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'history' && <VersionHistory />}
        {activeTab === 'compare' && <VersionCompare />}
        {activeTab === 'import' && <DataImport />}
        {activeTab === 'export' && <DataExport />}
      </div>
    </div>
  );
}
