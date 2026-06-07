import { useState } from 'react';
import {
  History,
  FileText,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { downloadJSON } from '@/utils/common';

type TabType = 'summaries' | 'logs';

export default function HistoryPage() {
  const { summaries, logs, exportData } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('summaries');
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  const handleExportAll = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `社区托育步行可达数据_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSummary = (summaryId: string) => {
    const summary = summaries.find(s => s.id === summaryId);
    if (summary) {
      downloadJSON(summary, `街道摘要_第${summary.version}版_${summary.generatedAt.replace(/[:\s]/g, '-')}.json`);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">历史记录</h2>
          <p className="text-slate-500 mt-1">查看摘要版本历史和全量操作日志</p>
        </div>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Download size={18} />
          导出全部数据
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 mb-6">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('summaries')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summaries'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={18} />
            摘要版本 ({summaries.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock size={18} />
            操作日志 ({logs.length})
          </button>
        </div>
      </div>

      {activeTab === 'summaries' && (
        <div className="space-y-4">
          {summaries.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 text-lg">暂无摘要版本</p>
              <p className="text-slate-400 text-sm mt-2">在主工作台第三步生成街道摘要</p>
            </div>
          ) : (
            summaries.slice().reverse().map((summary) => (
              <div
                key={summary.id}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedSummaryId(
                    expandedSummaryId === summary.id ? null : summary.id
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">
                        第 {summary.version} 版摘要
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {summary.generatedAt}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {summary.generatedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded">
                        {summary.stats.totalCommunities} 小区
                      </span>
                      <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded">
                        {summary.stats.totalPhotos} 照片
                      </span>
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded">
                        {summary.stats.totalBusRecords} 公交
                      </span>
                      <span className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded">
                        {summary.stats.conflictsResolved} 已处理冲突
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSummary(summary.id);
                      }}
                      className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded"
                      title="导出此版本"
                    >
                      <Download size={16} />
                    </button>
                    {expandedSummaryId === summary.id ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>

                {expandedSummaryId === summary.id && (
                  <div className="border-t border-slate-100 p-4">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded-lg border border-slate-200">
                      {summary.content}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-lg border border-slate-200">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <History size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 text-lg">暂无操作日志</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-800">{log.operator}</span>
                        <span className="px-2 py-0.5 text-xs bg-sky-50 text-sky-600 rounded">
                          {log.action}
                        </span>
                        <span className="text-xs text-slate-400">{log.timestamp}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{log.detail}</p>
                      {(log.before || log.after) && (
                        <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded">
                          {log.before && <div>变更前: {JSON.stringify(log.before)}</div>}
                          {log.after && <div>变更后: {JSON.stringify(log.after)}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
