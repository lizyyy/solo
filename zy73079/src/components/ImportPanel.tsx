import { useMemo } from 'react';
import {
  Upload,
  ShieldAlert,
  ShieldCheck,
  History,
  XCircle,
  CheckCircle,
  RotateCcw,
  FilePlus2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatTime } from '../utils';
import type { InspectionRecord } from '../types';

const STATUS_CHIP = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  partial: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function ImportPanel() {
  const {
    pendingImportPreview,
    importLogs,
    inspections,
    remarks,
    previewImport,
    confirmImport,
    cancelImport,
    generateDuplicateForTest,
  } = useAppStore();

  const mockDuplicates = useMemo(() => generateDuplicateForTest(), [generateDuplicateForTest]);

  function handleTestDuplicate() {
    const testRecords: InspectionRecord[] = mockDuplicates.map((r, i) => ({
      ...r,
      id: 'import-' + i + '-' + Math.random().toString(36).slice(2, 6),
    }));
    previewImport('[测试重复导入] 巡检表-20260610.csv', testRecords);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        let records: InspectionRecord[] = [];
        try {
          records = JSON.parse(text);
        } catch {
          const lines = text.trim().split('\n');
          const header = lines[0].split(',').map((s) => s.trim());
          const rowToRec = (row: string[]): InspectionRecord => {
            const get = (k: string) => row[header.indexOf(k)] || '';
            return {
              id: 'imp-' + Math.random().toString(36).slice(2, 8),
              deviceId: get('deviceId') || 'DP-Z03-刀盘A',
              inspectionTime: Number(get('inspectionTime')) || Date.now(),
              inspector: get('inspector') || '导入用户',
              temperature: Number(get('temperature')) || 0,
              vibration: Number(get('vibration')) || 0,
              rotationSpeed: Number(get('rotationSpeed')) || 0,
              cutterWear: Number(get('cutterWear')) || 0,
              isAlarm: (get('isAlarm') || '').toLowerCase() === 'true',
              alarmType: (get('alarmType') as any) || null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          };
          records = lines.slice(1).map((l) => rowToRec(l.split(',')));
        }
        previewImport(f.name, records);
      } catch (err: any) {
        alert('文件解析失败：' + err.message);
      }
    };
    reader.readAsText(f);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700/60">
        <h3 className="text-slate-100 font-semibold tracking-wide text-sm flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          <Upload size={15} className="text-blue-400" />
          数据导入（自动去重 + 备注保护）
        </h3>
        <p className="text-slate-500 text-xs mt-0.5">
          当前 {inspections.length} 条巡检 · {remarks.length} 条人工备注
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!pendingImportPreview && (
          <div className="space-y-3">
            <label className="block rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/40 hover:bg-slate-800/70 hover:border-blue-500/50 p-6 cursor-pointer transition text-center">
              <Upload size={28} className="mx-auto mb-2 text-slate-400" />
              <div className="text-sm text-slate-300 font-medium">拖拽或点击上传巡检表文件</div>
              <div className="text-[11px] text-slate-500 mt-1">支持 JSON / CSV（列：deviceId,inspectionTime,inspector,temperature,vibration,rotationSpeed,cutterWear,isAlarm,alarmType）</div>
              <input
                type="file"
                accept=".json,.csv,text/csv,application/json"
                className="hidden"
                onChange={handleFile}
              />
            </label>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="text-xs text-amber-300 font-medium mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={13} /> 一键测试"重复导入"场景
              </div>
              <div className="text-[11px] text-amber-200/80 mb-2.5">
                将模拟导入 3 条数据，其中 <span className="font-bold text-amber-300">2 条与现有记录重复</span>
                （验证不翻倍 + 备注保护不覆盖），1 条为新记录。
              </div>
              <button
                onClick={handleTestDuplicate}
                className="w-full px-3 py-2 text-xs rounded bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center justify-center gap-1.5 transition"
              >
                <FilePlus2 size={12} /> 模拟重复导入（测试用）
              </button>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
              <div className="text-xs text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" />
                去重算法说明
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5">
                <li>• <span className="text-slate-300">去重键：</span>设备号 + 巡检时间（精确到分钟）哈希</li>
                <li>• <span className="text-slate-300">重复处理：</span>仅更新数值字段（温度/振动等），保留原 ID</li>
                <li>• <span className="text-slate-300 text-emerald-300">备注保护：</span>重复记录中的人工备注<span className="font-semibold underline">绝对不覆盖</span></li>
                <li>• <span className="text-slate-300">导入日志：</span>每次导入生成日志，记录去重条数和受保护备注数</li>
              </ul>
            </div>
          </div>
        )}

        {pendingImportPreview && (
          <div className="space-y-3 animate-in fade-in">
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-blue-300 font-medium flex items-center gap-1.5">
                  <FilePlus2 size={14} /> {pendingImportPreview.fileName}
                </div>
                <button
                  onClick={cancelImport}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400"
                >
                  <XCircle size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-slate-800/80 p-2">
                  <div className="text-xs text-slate-500 mb-0.5">总条数</div>
                  <div className="text-lg text-slate-100 font-semibold font-mono">
                    {pendingImportPreview.preview.length}
                  </div>
                </div>
                <div className="rounded bg-slate-800/80 p-2 border border-amber-500/40">
                  <div className="text-xs text-amber-400 mb-0.5 flex items-center justify-center gap-0.5">
                    <RotateCcw size={10} /> 重复
                  </div>
                  <div className="text-lg text-amber-300 font-semibold font-mono">
                    {pendingImportPreview.duplicateCount}
                  </div>
                </div>
                <div className="rounded bg-slate-800/80 p-2 border border-emerald-500/40">
                  <div className="text-xs text-emerald-400 mb-0.5 flex items-center justify-center gap-0.5">
                    <ShieldAlert size={10} /> 备注保护
                  </div>
                  <div className="text-lg text-emerald-300 font-semibold font-mono">
                    {pendingImportPreview.preservedRemarkCount}
                  </div>
                </div>
              </div>
              {pendingImportPreview.preservedRemarkCount > 0 && (
                <div className="mt-2 rounded bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] text-emerald-300">
                  ✅ {pendingImportPreview.preservedRemarkCount} 条人工备注将被保留，不会被新导入覆盖
                </div>
              )}
              {pendingImportPreview.duplicateCount === pendingImportPreview.preview.length && (
                <div className="mt-2 rounded bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-300">
                  ⚠ 所有 {pendingImportPreview.preview.length} 条均为重复记录，确认后将不产生新记录（不翻倍）
                </div>
              )}
            </div>

            <div className="rounded border border-slate-700 bg-slate-800/30 overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-normal">时间</th>
                    <th className="text-left px-2 py-1.5 font-normal">巡检员</th>
                    <th className="text-right px-2 py-1.5 font-normal">温度</th>
                    <th className="text-right px-2 py-1.5 font-normal">振动</th>
                    <th className="text-right px-2 py-1.5 font-normal">磨损</th>
                    <th className="text-center px-2 py-1.5 font-normal">报警</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingImportPreview.preview.map((r, i) => (
                    <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                      <td className="px-2 py-1.5 text-slate-300 font-mono text-[10px]">
                        {formatTime(r.inspectionTime)}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">{r.inspector}</td>
                      <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{r.temperature.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{r.vibration.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-300 font-mono">{r.cutterWear.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-center">
                        {r.isAlarm ? (
                          <span className="text-red-400 font-semibold">⚠</span>
                        ) : (
                          <span className="text-emerald-400">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                onClick={cancelImport}
                className="flex-1 px-3 py-2 text-xs rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <XCircle size={12} /> 取消
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 px-3 py-2 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={12} /> 确认导入（备注受保护）
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
            <History size={12} /> 导入日志（最近 5 条）
          </div>
          {importLogs.length === 0 && (
            <p className="text-[11px] text-slate-600 italic">暂无导入历史</p>
          )}
          <div className="space-y-1.5">
            {importLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="rounded border border-slate-700 bg-slate-800/40 p-2 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-mono text-[11px] truncate max-w-[55%]">
                    {log.fileName}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${STATUS_CHIP[log.status]}`}>
                    {log.status === 'success' ? '成功' : log.status === 'partial' ? '部分重复' : '失败'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {formatTime(log.importTime)}</span>
                  <span>总 {log.totalRecords}</span>
                  <span className="text-amber-400">去重 {log.duplicateRecords}</span>
                  <span className="text-emerald-400">备注保护 {log.preservedRemarks}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
