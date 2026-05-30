import { useState, useRef } from 'react';
import type { ModalRecord, RecordStatus } from '@/types';
import { useGuitarStore } from '@/store/useStore';
import StatusBadge from './StatusBadge';
import AuditTimeline from './AuditTimeline';
import { LENGTH_UNIT_LABELS, DENSITY_UNIT_LABELS } from '@/utils/unitConversion';
import { Download, Upload, Trash2, ChevronDown, ChevronUp, FileDown, AlertTriangle, CheckCircle, RotateCcw, Search, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

export default function RecordList() {
  const {
    records, statusFilter, selectedRecordIds,
    setStatusFilter, toggleSelectRecord, setCurrentRecord,
    deleteRecord, changeStatus, exportRecordById, exportSelected, importData, loadSampleData,
  } = useGuitarStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusDialog, setStatusDialog] = useState<{ id: string; target: RecordStatus } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusOperator, setStatusOperator] = useState('');
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = records.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchText && !r.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  function handleExport(id: string) {
    const data = exportRecordById(id);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modal-record-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportSelected() {
    if (selectedRecordIds.length === 0) return;
    const data = exportSelected();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modal-records-batch.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const result = importData(importText, importFormat);
    setImportResult(result);
    setImportText('');
    setTimeout(() => setImportResult(null), 5000);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      const ext = file.name.split('.').pop()?.toLowerCase();
      setImportFormat(ext === 'csv' ? 'csv' : 'json');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleStatusChange() {
    if (!statusDialog) return;
    changeStatus(statusDialog.id, statusDialog.target, statusOperator || '当前用户', statusReason);
    setStatusDialog(null);
    setStatusReason('');
    setStatusOperator('');
  }

  const statusCounts = {
    all: records.length,
    processed: records.filter((r) => r.status === 'processed').length,
    pending: records.filter((r) => r.status === 'pending').length,
    returned: records.filter((r) => r.status === 'returned').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">记录管理</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSampleData}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            加载样例
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className={clsx(
              'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs',
              showImport ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            导入
          </button>
          <button
            onClick={handleExportSelected}
            disabled={selectedRecordIds.length === 0}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            <FileDown className="h-3.5 w-3.5" />
            导出选中 ({selectedRecordIds.length})
          </button>
        </div>
      </div>

      {showImport && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as 'json' | 'csv')}
              className="rounded-md border border-stone-200 px-2 py-1 text-xs"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-stone-200 px-3 py-1 text-xs text-stone-600 hover:bg-white"
            >
              选择文件
            </button>
            <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="在此粘贴 JSON/CSV 数据，或选择文件..."
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 outline-none focus:border-amber-300"
            rows={4}
          />
          <div className="flex items-center justify-between">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="rounded-lg bg-amber-700 px-4 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-40"
            >
              确认导入
            </button>
            {importResult && (
              <span className="text-xs text-stone-600">
                成功 {importResult.success} 条，失败 {importResult.failed} 条
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索记录名称..."
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-700 outline-none focus:border-amber-300"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5">
          {(['all', 'processed', 'pending', 'returned'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                statusFilter === s ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-700'
              )}
            >
              {s === 'all' ? `全部 ${statusCounts.all}` : s === 'processed' ? `已处理 ${statusCounts.processed}` : s === 'pending' ? `待确认 ${statusCounts.pending}` : `需退回 ${statusCounts.returned}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-stone-400">无匹配记录</div>
        )}
        {filtered.map((record) => (
          <div
            key={record.id}
            className={clsx(
              'rounded-xl border bg-white transition-colors',
              expandedId === record.id ? 'border-amber-300 shadow-md' : 'border-stone-200 hover:border-stone-300',
              selectedRecordIds.includes(record.id) && 'ring-2 ring-amber-200'
            )}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
            >
              <input
                type="checkbox"
                checked={selectedRecordIds.includes(record.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelectRecord(record.id); }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-400"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-stone-800">{record.name}</span>
                  <StatusBadge status={record.status} />
                  {record.peaks.some((p) => p.isOverlapping) && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-500">
                      <AlertTriangle className="h-3 w-3" />
                      重叠
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  {record.parameters.source === 'import' ? '导入' : '手动'} · {new Date(record.updatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(record.id); }}
                  className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  title="导出"
                >
                  <Download className="h-4 w-4" />
                </button>
                {record.status === 'pending' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatusDialog({ id: record.id, target: 'processed' }); }}
                      className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
                      title="确认处理"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatusDialog({ id: record.id, target: 'returned' }); }}
                      className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="退回"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </>
                )}
                {record.status === 'returned' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setStatusDialog({ id: record.id, target: 'pending' }); }}
                    className="rounded-md p-1.5 text-amber-400 hover:bg-amber-50 hover:text-amber-600"
                    title="提交审核"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                )}
                {expandedId === record.id ? (
                  <ChevronUp className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                )}
              </div>
            </div>

            {expandedId === record.id && (
              <div className="border-t border-stone-100 px-4 py-4 space-y-4">
                <div>
                  <h4 className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider">参数快照</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-stone-50 p-3">
                      <p className="text-xs text-stone-400">箱体尺寸</p>
                      <p className="mt-1 text-sm font-medium text-stone-700">
                        {record.parameters.boxDims.length} × {record.parameters.boxDims.width} × {record.parameters.boxDims.depth} {LENGTH_UNIT_LABELS[record.parameters.lengthUnit]}
                      </p>
                      <p className="text-xs text-stone-400">来源: {record.parameters.sourceDetail}</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 p-3">
                      <p className="text-xs text-stone-400">音孔</p>
                      <p className="mt-1 text-sm font-medium text-stone-700">
                        Ø {record.parameters.soundHole.diameter} {LENGTH_UNIT_LABELS[record.parameters.lengthUnit]}
                      </p>
                      <p className="text-xs text-stone-400">{record.parameters.soundHole.position}</p>
                    </div>
                    <div className="rounded-lg bg-stone-50 p-3">
                      <p className="text-xs text-stone-400">木材</p>
                      <p className="mt-1 text-sm font-medium text-stone-700">{record.parameters.wood.name}</p>
                      <p className="text-xs text-stone-400">
                        {record.parameters.wood.density} {DENSITY_UNIT_LABELS[record.parameters.densityUnit]} · E={record.parameters.wood.elasticModulus} GPa
                      </p>
                    </div>
                  </div>
                </div>

                {record.peaks.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider">频率峰</h4>
                    <div className="space-y-1">
                      {record.peaks.map((peak) => (
                        <div
                          key={peak.id}
                          className={clsx(
                            'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                            peak.isOverlapping ? 'bg-orange-50 text-orange-700' : 'bg-stone-50 text-stone-600'
                          )}
                        >
                          <span>{peak.modeLabel}</span>
                          <span className="font-mono font-medium">
                            {peak.frequency} Hz {peak.isOverlapping && '⚠'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wider">审计追踪</h4>
                  <AuditTimeline entries={record.auditLog} />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-800">
              {statusDialog.target === 'processed' ? '确认处理' : statusDialog.target === 'pending' ? '提交审核' : '退回记录'}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              请填写操作人和原因，确保审计追踪完整
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-stone-500">操作人</label>
                <input
                  type="text"
                  value={statusOperator}
                  onChange={(e) => setStatusOperator(e.target.value)}
                  placeholder="例如: 审核同事B"
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500">原因</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="为什么这样处理..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-300"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setStatusDialog(null); setStatusReason(''); setStatusOperator(''); }}
                className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
              >
                取消
              </button>
              <button
                onClick={handleStatusChange}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
