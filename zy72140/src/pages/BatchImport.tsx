import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  GitMerge,
  RefreshCw,
} from 'lucide-react';
import { useImportStore } from '@/stores/importStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useMaterialStore } from '@/stores/materialStore';
import { useAuditStore } from '@/stores/auditStore';
import { parseImportFile } from '@/utils/importParser';
import { detectConflicts } from '@/utils/conflictDetector';
import type { Schedule, ImportResult } from '@/types';

export default function BatchImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [successRows, setSuccessRows] = useState<string[][]>([]);

  const { importResult, isImporting, startImport, setImportResult, clearImportResult, resolveConflict } =
    useImportStore();
  const { schedules, addSchedule, updateSchedule } = useScheduleStore();
  const { materials } = useMaterialStore();
  const { addLog } = useAuditStore();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) return;
      startImport();
      try {
        const { data, errors } = await parseImportFile(file);
        const partialSchedules: Partial<Schedule>[] = data.map((row) => ({
          volunteerName: row[0],
          role: row[1],
          timeSlot: row[2],
          date: row[3],
          status: (row[4] as Schedule['status']) || 'pending',
          remark: row[5] || '',
        }));
        const conflicts = detectConflicts(partialSchedules, schedules, materials);
        const result: ImportResult = {
          total: data.length + errors.length,
          succeeded: data.length,
          failed: errors,
          conflicts,
        };
        setImportResult(result);
        setSuccessRows(data);
        const now = new Date().toISOString();
        data.forEach((row) => {
          addSchedule({
            id: crypto.randomUUID(),
            volunteerName: row[0],
            role: row[1],
            timeSlot: row[2],
            date: row[3],
            status: (row[4] as Schedule['status']) || 'pending',
            remark: row[5] || '',
            remarkHistory: [],
            createdAt: now,
            updatedAt: now,
          });
        });
        addLog({
          scheduleId: 'batch',
          action: 'import_success',
          beforeValue: '',
          afterValue: `${data.length}条记录`,
          evidence: file.name,
          suggestion: '',
        });
        if (errors.length > 0) {
          addLog({
            scheduleId: 'batch',
            action: 'import_fail',
            beforeValue: '',
            afterValue: `${errors.length}条失败`,
            evidence: file.name,
            suggestion: errors.map((e) => e.suggestion).join('; '),
          });
        }
        if (conflicts.length > 0) {
          addLog({
            scheduleId: 'batch',
            action: 'conflict_detected',
            beforeValue: '',
            afterValue: `${conflicts.length}个冲突`,
            evidence: file.name,
            suggestion: '请逐条处理冲突',
          });
        }
      } catch {
        setImportResult({ total: 0, succeeded: 0, failed: [], conflicts: [] });
      }
    },
    [startImport, setImportResult, schedules, materials, addSchedule, addLog],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleResolve = useCallback(
    (conflictId: string, resolution: 'keep_import' | 'keep_contract' | 'manual_merge') => {
      if (!importResult) return;
      const conflict = importResult.conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      const schedule = schedules.find((s) => s.id === conflict.scheduleId);
      const beforeValue = schedule ? `${conflict.field}: ${schedule[conflict.field as keyof Schedule] ?? ''}` : '';
      let afterValue = '';

      if (resolution === 'keep_contract') {
        const update: Partial<Schedule> = {
          [conflict.field]: conflict.contractValue,
          status: 'confirmed',
        };
        updateSchedule(conflict.scheduleId, update);
        afterValue = `${conflict.field}: ${conflict.contractValue} (采纳合同值)`;
      } else if (resolution === 'keep_import') {
        const update: Partial<Schedule> = {
          [conflict.field]: conflict.importValue,
          status: 'confirmed',
        };
        updateSchedule(conflict.scheduleId, update);
        afterValue = `${conflict.field}: ${conflict.importValue} (采纳导入值)`;
      } else {
        updateSchedule(conflict.scheduleId, { status: 'pending' });
        afterValue = '手动合并，请在排班总览中编辑';
      }

      resolveConflict(conflictId, resolution, 'batch_import');
      addLog({
        scheduleId: conflict.scheduleId,
        action: 'conflict_resolved',
        beforeValue,
        afterValue,
        evidence: conflict.contractEvidence,
        suggestion: resolution === 'manual_merge'
          ? '已标记为待确认，请在排班总览中手动编辑后确认'
          : '',
      });
    },
    [importResult, schedules, resolveConflict, updateSchedule, addLog],
  );

  const handleReset = useCallback(() => {
    clearImportResult();
    setSuccessRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [clearImportResult]);

  if (!importResult) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900">批量导入</h1>
        <p className="mt-1 text-sm text-gray-500">上传排班数据文件，支持 CSV 和 JSON 格式</p>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-8 border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          } ${isImporting ? 'pointer-events-none opacity-60' : ''}`}
        >
          {isImporting ? (
            <>
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
              <p className="mt-4 text-gray-600">正在处理文件...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-600">拖拽文件到此处，或点击选择文件</p>
              <p className="mt-1 text-sm text-gray-400">支持 .csv 和 .json 格式</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={onFileSelect}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  const { total, succeeded, failed, conflicts } = importResult;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">批量导入</h1>
          <p className="mt-1 text-sm text-gray-500">上传排班数据文件，支持 CSV 和 JSON 格式</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          重新导入
        </button>
      </div>

      <div className="mt-6 flex gap-6 rounded-lg bg-gray-50 p-4 text-sm">
        <span className="text-gray-700">共{total}条</span>
        <span className="text-green-600 font-medium">成功{succeeded}条</span>
        <span className="text-amber-600 font-medium">失败{failed.length}条</span>
        <span className="text-red-600 font-medium">冲突{conflicts.length}条</span>
      </div>

      {successRows.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-green-700">
            <CheckCircle className="h-5 w-5" />
            导入成功
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {successRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm">
                <FileUp className="h-4 w-4 text-green-500" />
                <span className="font-medium text-gray-800">{row[0]}</span>
                <span className="text-gray-500">· {row[1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
            <XCircle className="h-5 w-5" />
            导入失败
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600">行号</th>
                  <th className="px-3 py-2 text-left text-gray-600">原始数据</th>
                  <th className="px-3 py-2 text-left text-gray-600">错误类型</th>
                  <th className="px-3 py-2 text-left text-gray-600">错误信息</th>
                  <th className="px-3 py-2 text-left text-gray-600">处理建议</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((f, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-gray-700">{f.rowIndex}</td>
                    <td
                      className="max-w-[200px] truncate px-3 py-2 text-gray-600"
                      title={f.rawData}
                    >
                      {f.rawData}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{f.errorType}</td>
                    <td className="px-3 py-2 text-gray-600">{f.errorMessage}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded bg-amber-50 px-2 py-1 text-amber-800">
                        {f.suggestion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700">
            <AlertTriangle className="h-5 w-5" />
            冲突检测
          </h2>
          <div className="mt-3 space-y-4">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="overflow-hidden rounded-lg border border-red-200 bg-white"
              >
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">合同扫描件证据</h3>
                    {conflict.contractEvidence && (
                      <p className="mb-2 text-xs text-gray-500">{conflict.contractEvidence}</p>
                    )}
                    <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                      {conflict.contractValue}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">导入数据</h3>
                    <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800">
                      {conflict.importValue}
                    </div>
                  </div>
                </div>
                <div className="border-t bg-gray-50 p-4">
                  <p className="mb-3 text-sm text-gray-600">
                    <span className="font-medium">操作建议：</span>
                    {conflict.field === 'volunteerName'
                      ? '志愿者姓名与合同记录不一致，请确认实际值班人员'
                      : conflict.field === 'timeSlot'
                        ? '时段安排与合同记录冲突，请确认最终排班时间'
                        : '数据与合同记录不一致，请确认正确值'}
                  </p>
                  <div className="flex gap-2">
                    {conflict.resolution ? (
                      <span className="text-sm text-gray-500">
                        已解决：
                        {conflict.resolution === 'keep_contract'
                          ? '采纳合同值'
                          : conflict.resolution === 'keep_import'
                            ? '采纳导入值'
                            : '手动合并'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleResolve(conflict.id, 'keep_contract')}
                          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          采纳合同值
                        </button>
                        <button
                          onClick={() => handleResolve(conflict.id, 'keep_import')}
                          className="flex items-center gap-1 rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
                        >
                          采纳导入值
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleResolve(conflict.id, 'manual_merge')}
                          className="flex items-center gap-1 rounded bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                          手动合并
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
