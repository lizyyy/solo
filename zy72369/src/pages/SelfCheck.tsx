import { useState } from 'react';
import { useStore } from '@/store';
import { ShieldCheck, CheckCircle2, XCircle, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { exportAsJSON, exportAsCSV } from '@/utils/export';
import type { SelfCheckType } from '@/types';

const checkLabels: Record<string, { title: string; desc: string }> = {
  nameplate_validation: { title: '铭牌参数校验', desc: '检查空值、数值范围、重复设备编码' },
  duplicate_import: { title: '重复导入检测', desc: '区分本次重复/历史重复/新记录，不糊在总数里' },
  negative_direction: { title: '负方向异常检测', desc: '检查向左/向右是否正确标记待复核，不归为正常' },
  supplementary_recalc: { title: '补录后重算验证', desc: '检查补录说明完整性，是否触发重算联动' },
  export_consistency: { title: '导出一致性校验', desc: '检查未裁决冲突和待复核记录' },
  screenshot_note_integrity: { title: '截图备注完整性', desc: '检查维修群截图备注是否完整、关键信息未清洗' },
};

export default function SelfCheckPage() {
  const selfCheckResults = useStore(s => s.selfCheckResults);
  const lastSelfCheckTime = useStore(s => s.lastSelfCheckTime);
  const runSelfCheck = useStore(s => s.runSelfCheck);
  const nameplates = useStore(s => s.nameplates);
  const records = useStore(s => s.records);
  const conflicts = useStore(s => s.conflicts);
  const screenshots = useStore(s => s.screenshots);
  const auditLogs = useStore(s => s.auditLogs);

  const [running, setRunning] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<SelfCheckType | null>(null);

  const passedCount = selfCheckResults.filter(r => r.passed).length;
  const allPassed = selfCheckResults.length === 6 && selfCheckResults.every(r => r.passed);
  const failedCount = selfCheckResults.filter(r => !r.passed).length;

  const handleRunCheck = () => {
    setRunning(true);
    setTimeout(() => {
      runSelfCheck();
      setRunning(false);
    }, 700);
  };

  const handleExportJSON = () => {
    if (!allPassed) return;
    exportAsJSON(nameplates, records, conflicts, screenshots, auditLogs);
  };

  const handleExportCSV = () => {
    if (!allPassed) return;
    exportAsCSV(records, nameplates);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">自检与导出</h2>
        {selfCheckResults.length === 6 && (
          <div className="flex items-center gap-4 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 font-medium border border-green-200">✅ 通过 {passedCount}</span>
            <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium border border-red-200">❌ 未通过 {failedCount}</span>
          </div>
        )}
      </div>

      {/* Self Check Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0F4C5C]" />
            <h3 className="font-semibold text-gray-800">系统自检（6项全覆盖）</h3>
          </div>
          <div className="flex items-center gap-3">
            {lastSelfCheckTime && (
              <span className="text-xs text-gray-400">上次自检: {new Date(lastSelfCheckTime).toLocaleString('zh-CN')}</span>
            )}
            <button
              onClick={handleRunCheck}
              disabled={running}
              className="px-5 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <ShieldCheck size={14} />
              {running ? '检测中...' : '一键自检'}
            </button>
          </div>
        </div>

        {selfCheckResults.length === 0 ? (
          <div className="py-10 text-center">
            <ShieldCheck size={48} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 mb-4">点击"一键自检"运行 <b className="text-[#0F4C5C]">6</b> 项检查：铭牌参数、重复导入（分类）、负方向、补录重算、导出一致、截图备注</p>
            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
              {(['nameplate_validation', 'duplicate_import', 'negative_direction', 'supplementary_recalc', 'export_consistency', 'screenshot_note_integrity'] as SelfCheckType[]).map(t => (
                <div key={t} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                  <p className="text-xs font-semibold text-gray-700">{checkLabels[t].title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{checkLabels[t].desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {selfCheckResults.map(result => {
                const label = checkLabels[result.type];
                const expanded = expandedDetail === result.type;
                const realDetails = result.details.filter(d => !d.startsWith('提示:') && !d.includes('(非错误'));
                const hintCount = result.details.length - realDetails.length;
                return (
                  <div key={result.type} className={`p-4 rounded-xl border-2 transition-colors ${result.passed ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
                    <div className="flex items-start gap-3">
                      {result.passed ? (
                        <CheckCircle2 size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{label.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{label.desc}</p>
                        <p className={`text-xs mt-2 font-semibold ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.message}</p>

                        {realDetails.length > 0 && (
                          <div className="mt-2">
                            <button onClick={() => setExpandedDetail(expanded ? null : result.type)} className="text-[10px] text-[#0F4C5C] hover:underline font-medium">
                              {expanded ? '收起' : `展开 ${realDetails.length} 条问题`}
                            </button>
                            {expanded && (
                              <ul className="mt-2 space-y-1">
                                {realDetails.map((d, i) => (
                                  <li key={i} className="text-[10px] text-red-600 bg-white/80 px-2 py-1 rounded font-mono border border-red-200/60 break-words">
                                    {d}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {hintCount > 0 && (
                          <p className="text-[10px] text-blue-500 mt-1.5 flex items-center gap-1"><AlertTriangle size={10} /> 含 {hintCount} 条工作提示（不影响通过率）</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-4 bg-[#0F4C5C]/5 rounded-lg border border-[#0F4C5C]/10">
              <p className="text-xs text-gray-600 font-medium">📊 检测范围统计</p>
              <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                <div><p className="text-gray-400">铭牌</p><p className="font-mono font-bold text-[#0F4C5C] text-lg">{nameplates.length}</p></div>
                <div><p className="text-gray-400">弯曲记录</p><p className="font-mono font-bold text-[#0F4C5C] text-lg">{records.length}</p></div>
                <div><p className="text-gray-400">冲突</p><p className="font-mono font-bold text-[#0F4C5C] text-lg">{conflicts.length}</p></div>
                <div><p className="text-gray-400">截图</p><p className="font-mono font-bold text-[#0F4C5C] text-lg">{screenshots.length}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">报告导出</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleExportJSON}
            disabled={!allPassed}
            className="flex items-center gap-2 px-6 py-3 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <FileJson size={18} /> 导出完整 JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!allPassed}
            className="flex items-center gap-2 px-6 py-3 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <FileSpreadsheet size={18} /> 导出弯曲记录 CSV
          </button>
          {!allPassed && selfCheckResults.length > 0 && (
            <div className="px-4 py-2 bg-[#E36414]/10 border border-[#E36414]/30 rounded-lg">
              <p className="text-xs text-[#E36414] font-semibold">⚠ 自检未全部通过（{failedCount}项），请在上方修复后重新自检。</p>
              <p className="text-[10px] text-[#E36414]/70 mt-0.5">防止把待复核、冲突、重复数据误导出为"干净报告"</p>
            </div>
          )}
          {allPassed && (
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700 font-semibold">✅ 自检全部通过，可以安全导出</p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-4">导出内容包含：<b>铭牌参数原文</b> + <b>弯曲记录（含补录标记/备注/变更历史）</b> + <b>冲突证据+裁决</b> + <b>维修群截图备注原文</b> + <b>完整操作日志</b> + <b>本次自检结果</b></p>
      </div>
    </div>
  );
}
