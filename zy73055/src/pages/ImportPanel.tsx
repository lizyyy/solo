import { useMemo, useState } from 'react';
import { Upload, CheckCircle, FilePlus, RotateCcw, Check, SkipForward, Combine, Eraser, Download } from 'lucide-react';
import { useWorkOrderStore } from '../store/workOrderStore';
import { DuplicateResolution } from '../components/DuplicateResolution';
import { mockWorkOrders } from '../utils/mockData';
import type { WorkOrder, DuplicateResolutionResult } from '../types';
import { detectDuplicates } from '../utils/duplicateDetector';

export default function ImportPanel() {
  const { importWorkOrders, lastImportResult, duplicateWarningsFromImport, resetAll, workOrders } = useWorkOrderStore();
  const [dragging, setDragging] = useState(false);
  const [actionMap, setActionMap] = useState<Record<string, 'skip' | 'merge' | 'overwrite'>>({});
  const [result, setResult] = useState<DuplicateResolutionResult | null>(null);
  const [simulated, setSimulated] = useState(false);

  const simulateBatch = useMemo(() => {
    return [
      { ...mockWorkOrders[3], id: `sim-${Date.now()}-1`, orderNo: 'SIM-' + mockWorkOrders[3].orderNo },
      { ...mockWorkOrders[14], id: `sim-${Date.now()}-2`, orderNo: 'SIM-' + mockWorkOrders[14].orderNo },
      {
        ...mockWorkOrders[0],
        id: `sim-${Date.now()}-3`,
        orderNo: 'GD2026-NEW-099',
        deviceNo: 'DT-NEW-9999',
        deviceName: '深圳湾1号T7-1号梯（全新）',
        orderNoNew: undefined as any,
      } as WorkOrder,
    ];
  }, [workOrders.length]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    runImport(simulateBatch);
  };

  const runImport = (batch: WorkOrder[]) => {
    const warnings = detectDuplicates(workOrders, batch);
    const map: Record<string, 'skip' | 'merge' | 'overwrite'> = {};
    for (const w of warnings) map[`${w.deviceNo}::${w.newOrderId}`] = actionMap[`${w.deviceNo}::${w.newOrderId}`] ?? w.suggestion;
    const r = importWorkOrders(batch, map);
    setResult(r);
    setSimulated(true);
  };

  const changeAction = (key: string, action: 'skip' | 'merge' | 'overwrite') =>
    setActionMap(prev => ({ ...prev, [key]: action }));

  const showWarnings = (simulated ? duplicateWarningsFromImport : detectDuplicates(workOrders, simulateBatch));

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 md:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">数据导入面板</h1>
          <p className="text-sm text-slate-500 mb-4">
            支持拖拽上传工单批次。检测到设备编号重复时<b className="text-blue-600">不报错阻断</b>，而是显示"下一步处理"卡片。
            <br /><b className="text-emerald-600">正常记录默认不翻倍，人工备注永不被覆盖。</b>
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
              dragging
                ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/70'
            }`}
          >
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg flex items-center justify-center mb-4 transition-transform ${dragging ? 'scale-110' : ''}`}>
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-base font-bold text-slate-800 mb-1">
              {dragging ? '松开即可开始导入' : '拖拽 Excel/CSV 文件到此处'}
            </div>
            <div className="text-sm text-slate-500 mb-4">或点击下方按钮模拟导入一批包含重复编号的工单（2条重复 + 1条全新）</div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => runImport(simulateBatch)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <FilePlus className="w-4 h-4" />
                模拟导入批次工单
              </button>
              <button
                onClick={() => { resetAll(); setResult(null); setSimulated(false); setActionMap({}); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                重置为初始Mock数据
              </button>
            </div>
          </div>
        </div>

        <DuplicateResolution warnings={showWarnings} actionMap={actionMap} onChange={changeAction} />

        {(result || lastImportResult) && (
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold">导入完成</span>
              </div>
              <span className="text-xs bg-emerald-700/60 px-2 py-0.5 rounded">
                {(result || lastImportResult)?.warnings.length || 0} 条重复已处理
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-emerald-200">
              {([
                { k: 'imported', label: '全新导入', icon: <FilePlus className="w-4 h-4" />, cls: 'bg-white' },
                { k: 'skipped', label: '跳过·不翻倍', icon: <SkipForward className="w-4 h-4" />, cls: 'bg-slate-50' },
                { k: 'merged', label: '合并照片附件', icon: <Combine className="w-4 h-4" />, cls: 'bg-amber-50' },
                { k: 'overwritten', label: '覆盖·保留备注', icon: <Eraser className="w-4 h-4" />, cls: 'bg-violet-50' },
              ] as const).map(s => (
                <div key={s.k} className={`p-4 ${s.cls}`}>
                  <div className="flex items-center gap-2 text-slate-600 text-xs mb-2">
                    {s.icon} {s.label}
                  </div>
                  <div className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {(result || lastImportResult)?.[s.k] ?? 0}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/70 border-t border-emerald-200">
              <Check className="w-4 h-4" />
              <b>安全结果：</b>
              人工备注全部保留未被覆盖 · 重复设备编号未产生翻倍记录 · 原始 Mock 数据可随时重置恢复
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">当前工单库预览（最后 8 条）</div>
              <div className="text-xs text-slate-500 mt-0.5">重复导入后可在此处直观看到是否翻倍</div>
            </div>
            <div className="text-xs font-mono text-slate-600">共 {workOrders.length} 条</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2">工单编号</th>
                  <th className="text-left px-4 py-2">设备编号</th>
                  <th className="text-left px-4 py-2">设备名称</th>
                  <th className="text-left px-4 py-2">人工备注（前30字）</th>
                  <th className="text-center px-4 py-2">重复标记</th>
                </tr>
              </thead>
              <tbody>
                {[...workOrders].reverse().slice(0, 8).map(o => (
                  <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-mono text-slate-700">{o.orderNo}</td>
                    <td className="px-4 py-2 font-mono text-slate-600">{o.deviceNo}</td>
                    <td className="px-4 py-2 text-slate-800 truncate max-w-[220px]" title={o.deviceName}>{o.deviceName}</td>
                    <td className="px-4 py-2 text-slate-600 truncate max-w-[300px]" title={o.manualRemark}>
                      <span className="text-emerald-600 text-[10px] font-semibold">✓ 已保留</span> {o.manualRemark.slice(0, 30)}{o.manualRemark.length > 30 ? '...' : ''}
                    </td>
                    <td className="text-center px-4 py-2">
                      {o.isDuplicateWarning
                        ? <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                          已{ o.duplicateAction === 'merge' ? '合并' : o.duplicateAction === 'overwrite' ? '覆盖·保备注' : '跳过·不翻倍'}
                        </span>
                        : <span className="text-[10px] text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-4">
            <Download className="w-3.5 h-3.5" />
            提示：重置 Mock 后可多次测试重复导入。人工备注列始终显示 ✓ 已保留。
          </div>
        </div>
      </div>
    </div>
  );
}
