import { useState, useRef } from 'react';
import {
  FileDown,
  FileSpreadsheet,
  Image,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle,
  Zap,
  DoorOpen,
  Users,
  MapPin,
  Copy,
  Check,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import { api } from '@/lib/api';
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CONFLICT_TYPE_LABELS,
  CONFLICT_SEVERITY_COLORS,
} from '@shared/types';
import html2canvas from 'html2canvas';
import SuccessToast from '@/components/SuccessToast';

export default function Export() {
  const {
    currentArrangement,
    assignments,
    conflicts,
    vendors,
    stalls,
  } = useMarketStore();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [reportText, setReportText] = useState('');
  const [copied, setCopied] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const maxRow = Math.max(...stalls.map((s) => s.row), 0);
  const maxCol = Math.max(...stalls.map((s) => s.col), 0);

  const getStallAtPosition = (row: number, col: number) =>
    stalls.find((s) => s.row === row && s.col === col);

  const getAssignmentForStall = (stallId: string) =>
    assignments.find((a) => a.stallId === stallId);

  const handleExportExcel = () => {
    if (!currentArrangement) return;
    api.export.excel(currentArrangement.id);
    setSuccessMsg('Excel 报告已开始下载');
  };

  const handleExportConflictReport = () => {
    if (!currentArrangement) return;
    api.export.conflictReport(currentArrangement.id);
    setSuccessMsg('冲突报告已开始下载');
  };

  const handleGenerateReportText = async () => {
    if (!currentArrangement) return;
    try {
      const data = await api.export.getConflictReportText(currentArrangement.id);
      setReportText(data.report);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleExportPng = async () => {
    if (!mapRef.current || !currentArrangement) return;

    setExportingPng(true);
    try {
      const canvas = await html2canvas(mapRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `摊位排布图_${currentArrangement.version}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setSuccessMsg('摊位地图已导出为 PNG');
    } catch (e: any) {
      console.error(e);
    } finally {
      setExportingPng(false);
    }
  };

  const handleCopyReport = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      console.error(e);
    }
  };

  const formatAffectedItems = (items: string[]) => {
    return items
      .map((item) => {
        const vendor = vendors.find((v) => v.id === item);
        const stall = stalls.find((s) => s.id === item);
        if (vendor) return `摊主「${vendor.name}」`;
        if (stall) return `摊位「${stall.name}」`;
        return item;
      })
      .join('、');
  };

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;
  const assignedCount = assignments.length;
  const totalStalls = stalls.length;

  if (!currentArrangement) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileDown size={32} className="text-teal-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">暂无排布数据</h3>
          <p className="text-slate-500">请先创建或切换到一个排布版本</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">报告导出</h1>
        <p className="text-slate-500 mt-1">导出摊位排布图、数据表格和冲突分析报告</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <MapPin size={24} className="text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">总摊位</div>
              <div className="text-2xl font-bold text-slate-800">{totalStalls}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-green-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">已分配</div>
              <div className="text-2xl font-bold text-slate-800">
                {assignedCount} / {totalStalls}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">严重错误</div>
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <div>
              <div className="text-sm text-slate-500">警告</div>
              <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Image size={18} className="text-teal-600" />
                摊位排布图预览
              </h3>
              <button
                onClick={handleExportPng}
                disabled={exportingPng}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {exportingPng ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    导出 PNG
                  </>
                )}
              </button>
            </div>
            <div className="p-6">
              <div ref={mapRef} className="bg-white p-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 font-serif">
                    {currentArrangement.name}
                  </h2>
                  <p className="text-slate-500 mt-1">
                    版本 {currentArrangement.version} | {new Date().toLocaleDateString('zh-CN')}
                  </p>
                </div>

                <div
                  className="grid gap-2 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${maxCol + 1}, 120px)`,
                    width: 'fit-content',
                  }}
                >
                  {Array.from({ length: maxRow + 1 }).map((_, row) =>
                    Array.from({ length: maxCol + 1 }).map((_, col) => {
                      const stall = getStallAtPosition(row, col);
                      if (!stall) {
                        return (
                          <div
                            key={`${row}-${col}`}
                            className="w-[120px] h-[100px] rounded-lg border border-dashed border-slate-100 bg-slate-50/30"
                          />
                        );
                      }
                      const assignment = getAssignmentForStall(stall.id);
                      const vendor = assignment?.vendor;
                      const hasConflict = conflicts.some(
                        (c) =>
                          c.affectedItems.includes(stall.id) ||
                          c.affectedItems.includes(vendor?.id || '')
                      );

                      return (
                        <div
                          key={stall.id}
                          className={`w-[120px] h-[100px] rounded-lg border-2 p-2 ${
                            hasConflict
                              ? 'border-red-400 bg-red-50'
                              : vendor
                              ? 'border-teal-300 bg-teal-50'
                              : stall.isEntrance
                              ? 'border-teal-400 bg-teal-50/50 border-dashed'
                              : 'border-slate-200 bg-white border-dashed'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-medium text-slate-800 text-xs">
                              {stall.name}
                            </div>
                            {stall.isEntrance && (
                              <DoorOpen size={10} className="text-teal-600" />
                            )}
                          </div>
                          {vendor ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-800 text-xs truncate">
                                {vendor.name}
                              </div>
                              <div className="flex flex-wrap gap-0.5">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[vendor.category]}`}
                                >
                                  {CATEGORY_LABELS[vendor.category]}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 text-[10px] text-slate-500">
                                <Zap size={8} className="text-amber-500" />
                                {vendor.powerRequirement}W
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              <div className="flex items-center gap-0.5">
                                <Zap size={8} className="text-amber-500" />
                                {stall.maxPower}W
                              </div>
                              <div className="text-slate-300 mt-1">空</div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-center gap-6 mt-6 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-teal-400 bg-teal-50" />
                    <span>入口摊位</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-teal-300 bg-teal-50" />
                    <span>已分配</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-red-400 bg-red-50" />
                    <span>有冲突</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-dashed border-slate-200 bg-white" />
                    <span>空摊位</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {reportText && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileText size={18} className="text-teal-600" />
                  冲突分析报告（文本）
                </h3>
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      复制文本
                    </>
                  )}
                </button>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded-lg overflow-auto max-h-[400px]">
                  {reportText}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">导出选项</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={handleExportPng}
                disabled={exportingPng}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Image size={20} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">导出 PNG 地图</div>
                  <div className="text-xs text-white/80">高清摊位布局图，适合打印</div>
                </div>
                <Download size={18} className="ml-auto" />
              </button>

              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">导出 Excel 报告</div>
                  <div className="text-xs text-white/80">多 Sheet 完整数据表格</div>
                </div>
                <Download size={18} className="ml-auto" />
              </button>

              <button
                onClick={handleExportConflictReport}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">导出冲突报告</div>
                  <div className="text-xs text-white/80">详细的冲突分析和建议</div>
                </div>
                <Download size={18} className="ml-auto" />
              </button>

              <button
                onClick={handleGenerateReportText}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <div className="font-semibold">生成文本报告</div>
                  <div className="text-xs text-white/80">可复制的纯文本格式</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">当前版本信息</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">版本号</span>
                <span className="font-mono font-semibold text-teal-600">
                  v{currentArrangement.version}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">版本名称</span>
                <span className="font-medium text-slate-800">
                  {currentArrangement.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">创建人</span>
                <span className="text-slate-700">{currentArrangement.createdBy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">创建时间</span>
                <span className="text-slate-700">
                  {new Date(currentArrangement.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              {currentArrangement.note && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1">版本说明</span>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {currentArrangement.note}
                  </p>
                </div>
              )}
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">冲突摘要</h3>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {conflicts.length} 项
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {conflicts.slice(0, 5).map((conflict) => (
                  <div key={conflict.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CONFLICT_SEVERITY_COLORS[conflict.severity]}`}
                      >
                        {CONFLICT_TYPE_LABELS[conflict.type]}
                      </span>
                    </div>
                    <div className="text-sm text-slate-800 mt-1 line-clamp-2">
                      {conflict.message}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      影响：{formatAffectedItems(conflict.affectedItems)}
                    </div>
                  </div>
                ))}
                {conflicts.length > 5 && (
                  <div className="p-3 text-center text-sm text-slate-500">
                    还有 {conflicts.length - 5} 项冲突...
                  </div>
                )}
              </div>
            </div>
          )}

          {conflicts.length === 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={24} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800">排布状态良好</h3>
                  <p className="text-sm text-green-700 mt-1">
                    没有检测到任何冲突，可以导出报告
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
