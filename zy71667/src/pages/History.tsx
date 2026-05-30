import { useState } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import HistoryList from '../components/HistoryList';
import ReportModal from '../components/ReportModal';
import { FileText, Trash2, Search } from 'lucide-react';

export default function History() {
  const { history, clearHistory } = useDrumStore();
  const [reportId, setReportId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? history.filter(h => {
        const s = search.toLowerCase();
        return (
          String(h.diameter).includes(s) ||
          String(h.tension).includes(s) ||
          h.notes.toLowerCase().includes(s) ||
          h.targetNote.toLowerCase().includes(s)
        );
      })
    : history;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-drum-text">历史与报告</h1>
          <p className="text-drum-textMuted text-sm mt-1">查看调鼓记录、生成换算报告</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 text-drum-textDim hover:text-drum-red text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-drum-textDim" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索记录..."
            className="w-full bg-drum-card border border-drum-border rounded-lg pl-9 pr-3 py-2 text-drum-text text-sm focus:outline-none focus:border-drum-copper transition-colors"
          />
        </div>
      )}

      <div className="space-y-2 mb-6">
        <HistoryList />
        {search.trim() && filtered.length === 0 && (
          <p className="text-drum-textDim text-sm text-center py-4">没有匹配的记录</p>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-drum-card rounded-xl border border-drum-border p-5">
          <div className="flex items-center gap-2 text-drum-copper font-semibold mb-3">
            <FileText className="w-4 h-4" />
            批量报告
          </div>
          <p className="text-drum-textMuted text-sm mb-3">选择一条记录生成详细换算报告</p>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map(record => (
              <button
                key={record.id}
                onClick={() => setReportId(record.id)}
                className="px-3 py-1.5 bg-drum-bg border border-drum-border rounded-lg text-drum-textMuted text-xs hover:border-drum-copper/40 hover:text-drum-copper transition-all"
              >
                {record.diameter}" {record.material === 'custom' ? '自定义' : record.material}
              </button>
            ))}
            {history.length > 5 && (
              <span className="text-drum-textDim text-xs self-center">...还有 {history.length - 5} 条</span>
            )}
          </div>
        </div>
      )}

      {reportId && (
        <ReportModal recordId={reportId} onClose={() => setReportId(null)} />
      )}
    </div>
  );
}
