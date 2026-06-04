import { useState } from 'react';
import { useStore } from '@/store';
import { ShieldCheck, CheckCircle2, XCircle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportAsJSON, exportAsCSV } from '@/utils/export';
import type { SelfCheckType } from '@/types';

const checkLabels: Record<SelfCheckType, { title: string; desc: string }> = {
  duplicate_import: { title: '重复导入检测', desc: '检查是否存在完全相同的重复记录' },
  negative_direction: { title: '负方向异常检测', desc: '检查"向左"方向是否正确标记为待复核' },
  supplementary_recalc: { title: '补录后重算验证', desc: '检查补录数据是否完整并触发重算' },
  export_consistency: { title: '导出一致性校验', desc: '检查未裁决冲突和待复核记录' },
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

  const allPassed = selfCheckResults.length > 0 && selfCheckResults.every(r => r.passed);

  const handleRunCheck = () => {
    setRunning(true);
    setTimeout(() => {
      runSelfCheck();
      setRunning(false);
    }, 500);
  };

  const handleExportJSON = () => {
    if (!allPassed) return;
    exportAsJSON(nameplates, records, conflicts, screenshots, auditLogs);
  };

  const handleExportCSV = () => {
    if (!allPassed) return;
    exportAsCSV(records);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">自检与导出</h2>

      {/* Self Check Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0F4C5C]" />
            <h3 className="font-semibold text-gray-800">系统自检</h3>
          </div>
          <div className="flex items-center gap-3">
            {lastSelfCheckTime && (
              <span className="text-xs text-gray-400">上次自检: {new Date(lastSelfCheckTime).toLocaleString('zh-CN')}</span>
            )}
            <button
              onClick={handleRunCheck}
              disabled={running}
              className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <ShieldCheck size={14} />
              {running ? '检测中...' : '一键自检'}
            </button>
          </div>
        </div>

        {selfCheckResults.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">点击"一键自检"运行四项自检</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {selfCheckResults.map(result => {
              const label = checkLabels[result.type];
              const expanded = expandedDetail === result.type;
              return (
                <div key={result.type} className={`p-4 rounded-lg border-2 transition-colors ${result.passed ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-start gap-3">
                    {result.passed ? (
                      <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label.desc}</p>
                      <p className={`text-xs mt-1 ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{result.message}</p>
                      {!result.passed && result.details.length > 0 && (
                        <div>
                          <button onClick={() => setExpandedDetail(expanded ? null : result.type)} className="text-xs text-[#0F4C5C] hover:underline mt-1">
                            {expanded ? '收起详情' : '查看详情'}
                          </button>
                          {expanded && (
                            <ul className="mt-2 space-y-1">
                              {result.details.map((d, i) => (
                                <li key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-mono">{d}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">报告导出</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportJSON}
            disabled={!allPassed}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileJson size={16} /> 导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!allPassed}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} /> 导出 CSV
          </button>
          {!allPassed && selfCheckResults.length > 0 && (
            <span className="text-xs text-[#E36414]">⚠ 自检未全部通过，请修复后再导出</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">导出内容包含：原始数据 + 截图备注 + 冲突裁决 + 自检结果</p>
      </div>
    </div>
  );
}
