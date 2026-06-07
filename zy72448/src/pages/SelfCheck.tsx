import { useState } from 'react';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { useAppStore } from '../store';
import { CheckType, SelfCheckResult, CheckItem } from '../types';
import { formatDateTime } from '../utils/helpers';

const checkTypes: { type: CheckType; desc: string; icon: typeof Copy }[] = [
  { type: '重复导入', desc: '检查相同合同号、相同曲目+日期+金额的重复记录', icon: Copy },
  { type: '同名异曲', desc: '检查同一曲目名对应不同标准名、金额差异异常', icon: FileCheck },
  { type: '补录重算', desc: '补录别名后重新计算汇总，验证金额一致性', icon: RefreshCw },
  { type: '导出一致', desc: '验证页面展示数据与导出数据完全一致', icon: CheckCircle2 },
];

export default function SelfCheck() {
  const { selfCheckResults, runSelfCheck, runAllSelfChecks } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const handleRun = (type: CheckType) => {
    setRunning(type);
    setTimeout(() => {
      runSelfCheck(type);
      setRunning(null);
    }, 500);
  };

  const handleRunAll = () => {
    setRunning('all');
    setTimeout(() => {
      runAllSelfChecks();
      setRunning(null);
    }, 1000);
  };

  const getLevelIcon = (level: CheckItem['level']) => {
    switch (level) {
      case '错误':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case '警告':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case '通过':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  const getLevelBadge = (level: CheckItem['level']) => {
    switch (level) {
      case '错误':
        return 'bg-red-100 text-red-700';
      case '警告':
        return 'bg-amber-100 text-amber-700';
      case '通过':
        return 'bg-emerald-100 text-emerald-700';
    }
  };

  const getResultStatusBadge = (result: SelfCheckResult) => {
    const hasErrors = result.items.some((i) => i.level === '错误');
    const hasWarnings = result.items.some((i) => i.level === '警告');
    if (hasErrors) return 'bg-red-100 text-red-700 border-red-200';
    if (hasWarnings) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-emerald-800 mb-0.5">基本自检覆盖</h4>
            <p className="text-xs text-emerald-700">
              至少覆盖重复导入、同一首歌有现场名和版权名（同名异曲）、补录后重算、导出一致这几个最容易出错的点。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
            自检类型
          </h3>
          <button
            onClick={handleRunAll}
            disabled={running !== null}
            className="text-xs px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {running === 'all' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                运行中...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                一键运行全部
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {checkTypes.map(({ type, desc, icon: Icon }) => {
            const latestResult = selfCheckResults.find((r) => r.checkType === type);
            return (
              <div
                key={type}
                className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{type}检测</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRun(type)}
                    disabled={running !== null}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {running === type ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    运行
                  </button>
                </div>
                {latestResult && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getResultStatusBadge(
                          latestResult
                        )}`}
                      >
                        {latestResult.summary}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(new Date(latestResult.runAt))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">历史检测记录</h3>
        <div className="space-y-3">
          {selfCheckResults.map((result) => {
            const isExpanded = expandedId === result.id;
            return (
              <div
                key={result.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getResultStatusBadge(
                      result
                    )}`}
                  >
                    {result.checkType}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{result.summary}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(new Date(result.runAt))}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="space-y-2">
                      {result.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 bg-white rounded-md border border-slate-200"
                        >
                          {getLevelIcon(item.level)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${getLevelBadge(
                                  item.level
                                )}`}
                              >
                                {item.level}
                              </span>
                              <span className="text-sm font-medium text-slate-800">
                                {item.description}
                              </span>
                            </div>
                            {item.evidence && (
                              <p className="text-xs text-slate-500 mt-1">{item.evidence}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {selfCheckResults.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无检测记录，点击上方按钮运行自检</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
