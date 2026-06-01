import { useState } from 'react';
import { useStore } from '@/store';
import { ClipboardCheck, AlertTriangle, ArrowRightLeft, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import type { InspectionData, ConflictResolution } from '@/types';

const MOCK_ROWS = [
  { date: '2024-07-15', temperature: 23, temperatureUnit: '°C', humidity: 55, coolingLoad: 180, coolingLoadUnit: 'kW' },
  { date: '2024-08-20', temperature: 26, temperatureUnit: '°C', humidity: 70, coolingLoad: 310, coolingLoadUnit: 'kW' },
];

export default function Inspection() {
  const { currentBatch, importInspection, resolveConflict } = useStore();
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});

  if (!currentBatch) {
    return (
      <div className="flex items-center justify-center h-64 text-industrial-400 font-mono text-sm">
        请先选择或创建批次
      </div>
    );
  }

  const inspections = currentBatch.inspectionData;
  const pendingConflicts = inspections.filter(i => i.conflictStatus === 'pending');
  const resolvedRecords = inspections.filter(i => i.conflictStatus === 'resolved');
  const cleanRecords = inspections.filter(i => i.conflictStatus === 'none');

  const handleMockImport = () => {
    const sourceName = `设备巡检表_${new Date().getFullYear()}Q${Math.ceil((new Date().getMonth() + 1) / 3)}.xlsx`;
    importInspection(currentBatch.id, MOCK_ROWS, sourceName, 'new');
  };

  const handleResolve = (inspectionId: string, type: ConflictResolution) => {
    const notes = customNotes[inspectionId] || '';
    resolveConflict(currentBatch.id, inspectionId, type, notes);
  };

  const caliberLabel = (c: 'new' | 'old') => c === 'new' ? '新口径' : '旧口径';
  const resolutionLabel = (t: ConflictResolution) => {
    const m: Record<ConflictResolution, string> = { use_imported: '采用导入数据', use_inspection: '采用巡检数据', custom: '自定义' };
    return m[t];
  };

  return (
    <div className="space-y-4">
      <div className="industrial-card">
        <div className="industrial-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} />
            <span>巡检数据校验</span>
          </div>
          <button className="industrial-btn-primary flex items-center gap-1 text-xs" onClick={handleMockImport}>
            <Upload size={14} />
            导入巡检数据
          </button>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="industrial-card p-3 text-center border-l-4 border-l-warning-400">
            <div className="font-mono text-2xl font-bold text-warning-600">{pendingConflicts.length}</div>
            <div className="font-mono text-xs text-warning-600">待处理冲突</div>
          </div>
          <div className="industrial-card p-3 text-center border-l-4 border-l-success-400">
            <div className="font-mono text-2xl font-bold text-success-600">{resolvedRecords.length}</div>
            <div className="font-mono text-xs text-success-600">已解决</div>
          </div>
          <div className="industrial-card p-3 text-center border-l-4 border-l-primary-400">
            <div className="font-mono text-2xl font-bold text-primary-600">{cleanRecords.length}</div>
            <div className="font-mono text-xs text-primary-600">无冲突</div>
          </div>
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <div className="industrial-card">
          <div className="industrial-card-header flex items-center gap-2">
            <AlertTriangle size={16} className="text-alert-500" />
            <span>冲突待处理（{pendingConflicts.length}）</span>
          </div>
          <div className="p-4 space-y-4">
            {pendingConflicts.map(ins => (
              <ConflictPanel key={ins.id} ins={ins} customNotes={customNotes} setCustomNotes={setCustomNotes} onResolve={handleResolve} />
            ))}
          </div>
        </div>
      )}

      {resolvedRecords.length > 0 && (
        <div className="industrial-card">
          <div className="industrial-card-header flex items-center gap-2">
            <CheckCircle size={16} className="text-success-500" />
            <span>已解决（{resolvedRecords.length}）</span>
          </div>
          <div className="p-4 space-y-2">
            {resolvedRecords.map(ins => (
              <div key={ins.id} className="border border-success-200 bg-success-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="status-badge status-badge-normal gap-1"><CheckCircle size={12} />已解决</span>
                    <span className="font-mono text-sm font-medium">{ins.source}</span>
                    <span className="status-badge status-badge-old">{caliberLabel(ins.caliber)}</span>
                  </div>
                  <span className="font-mono text-xs text-industrial-500">{new Date(ins.recordDate).toLocaleDateString('zh-CN')}</span>
                </div>
                {ins.resolution && (
                  <div className="mt-2 text-xs font-mono text-industrial-600 space-y-1">
                    <div>处理方式：<span className="font-semibold text-success-700">{resolutionLabel(ins.resolution.type)}</span></div>
                    <div>处理人：{ins.resolution.resolvedBy} | 时间：{new Date(ins.resolution.resolvedAt).toLocaleString('zh-CN')}</div>
                    {ins.resolution.notes && <div>备注：{ins.resolution.notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cleanRecords.length > 0 && (
        <div className="industrial-card">
          <div className="industrial-card-header flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-success-500" />
            <span>无冲突记录（{cleanRecords.length}）</span>
          </div>
          <div className="p-4 space-y-1">
            {cleanRecords.map(ins => (
              <div key={ins.id} className="flex items-center justify-between p-2 border-b border-primary-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="status-badge status-badge-normal gap-1"><CheckCircle size={12} />正常</span>
                  <span className="font-mono text-sm">{ins.source}</span>
                  <span className="status-badge status-badge-old">{caliberLabel(ins.caliber)}</span>
                </div>
                <span className="font-mono text-xs text-industrial-500">{new Date(ins.recordDate).toLocaleDateString('zh-CN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inspections.length === 0 && (
        <div className="industrial-card p-8 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-industrial-300" />
          <p className="text-industrial-500 font-mono text-sm">暂无巡检数据，点击上方按钮导入</p>
        </div>
      )}
    </div>
  );
}

function ConflictPanel({ ins, customNotes, setCustomNotes, onResolve }: {
  ins: InspectionData;
  customNotes: Record<string, string>;
  setCustomNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onResolve: (id: string, type: ConflictResolution) => void;
}) {
  const evidence = ins.conflictEvidence;
  const fields = ins.conflictingFields;
  const imported = evidence?.importedData ?? {};
  const inspected = evidence?.inspectionData ?? {};
  const suggestions = evidence?.suggestions ?? [];

  return (
    <div className="border-2 border-alert-300 bg-alert-50">
      <div className="bg-alert-100 border-b border-alert-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="status-badge status-badge-conflict gap-1"><AlertTriangle size={12} />冲突</span>
          <span className="font-mono text-sm font-semibold text-alert-700">{ins.source}</span>
          <span className="status-badge status-badge-old">{ins.caliber === 'new' ? '新口径' : '旧口径'}</span>
        </div>
        <span className="font-mono text-xs text-industrial-500">{new Date(ins.recordDate).toLocaleString('zh-CN')}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-xs font-semibold text-primary-600 mb-2 flex items-center gap-1">
              <FileSpreadsheet size={12} /> 导入数据
            </div>
            {fields.map(f => (
              <div key={f} className="flex items-center gap-2 py-1 border-b border-alert-200">
                <span className="font-mono text-xs text-industrial-500 w-20">{f}</span>
                <span className="font-mono text-sm text-red-600 font-semibold bg-red-100 px-1">{String(imported[f] ?? '-')}</span>
                <a className="data-source-link" title="来源追溯">{ins.source}:{1}</a>
              </div>
            ))}
          </div>
          <div>
            <div className="font-mono text-xs font-semibold text-primary-600 mb-2 flex items-center gap-1">
              <ClipboardCheck size={12} /> 巡检数据
            </div>
            {fields.map(f => (
              <div key={f} className="flex items-center gap-2 py-1 border-b border-alert-200">
                <span className="font-mono text-xs text-industrial-500 w-20">{f}</span>
                <span className="font-mono text-sm text-red-600 font-semibold bg-red-100 px-1">{String(inspected[f] ?? '-')}</span>
                <a className="data-source-link" title="来源追溯">巡检表:{1}</a>
              </div>
            ))}
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="bg-white border border-primary-200 p-2">
            <div className="font-mono text-xs font-semibold text-primary-700 mb-1">建议操作</div>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="font-mono text-xs text-industrial-600 flex items-start gap-1">
                  <ArrowRightLeft size={12} className="mt-0.5 text-primary-500 shrink-0" />{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-alert-200">
          <button className="industrial-btn-warning text-xs" onClick={() => onResolve(ins.id, 'use_imported')}>采用导入</button>
          <button className="industrial-btn-success text-xs" onClick={() => onResolve(ins.id, 'use_inspection')}>采用巡检</button>
          <div className="flex items-center gap-1 flex-1">
            <input
              className="industrial-input flex-1 text-xs"
              placeholder="自定义备注…"
              value={customNotes[ins.id] || ''}
              onChange={e => setCustomNotes(prev => ({ ...prev, [ins.id]: e.target.value }))}
            />
            <button className="industrial-btn-primary text-xs" onClick={() => onResolve(ins.id, 'custom')}>自定义</button>
          </div>
        </div>
      </div>
    </div>
  );
}
