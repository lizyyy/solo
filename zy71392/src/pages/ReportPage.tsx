import { useEffect, useState } from 'react';
import { FileBarChart, Plus, Download, Check, X, Eye, ChevronRight } from 'lucide-react';
import { api, type Report, type ReportItem } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';
import { useAppStore } from '@/store/appStore';

export default function ReportPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ report: Report; items: ReportItem[] } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const { showToast, setLoading } = useAppStore();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setReports(await api.reports.list());
  }

  async function handleGenerate() {
    setLoading('generate', true);
    try {
      const { report_id } = await api.reports.generate({});
      showToast('报告已生成', 'success');
      await load();
      setSelected(report_id);
      loadDetail(report_id);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('generate', false);
    }
  }

  async function loadDetail(id: number) {
    setSelected(id);
    setDetail(await api.reports.get(id));
  }

  async function handleExport(id: number, format: 'json' | 'csv' | 'md') {
    try {
      const { content, filename } = await api.reports.export(id, format);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`已导出 ${filename}`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function handleReview(itemId: number, status: 'approved' | 'rejected') {
    if (!selected) return;
    try {
      await api.reports.review(selected, { item_id: itemId, review_status: status });
      loadDetail(selected);
      showToast('已复核', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  const filteredItems = detail ? (
    filter === 'all' ? detail.items :
    detail.items.filter(i => i.review_status === filter)
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileBarChart size={24} className="text-brand-400" />
            审计报告
          </h1>
          <p className="text-gray-400 text-sm mt-1">生成、复核和导出权限审计报告</p>
        </div>
        <button className="btn-primary" onClick={handleGenerate}>
          <Plus size={18} className="inline mr-2" />
          生成报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1 space-y-2">
          {reports.length > 0 ? reports.map(r => (
            <button
              key={r.id}
              onClick={() => loadDetail(r.id)}
              className={`w-full p-4 rounded-lg text-left transition-colors ${
                selected === r.id
                  ? 'bg-brand-500/15 border border-brand-500/30'
                  : 'bg-bg-secondary border border-transparent hover:border-gray-600'
              }`}
            >
              <div className="font-medium truncate">{r.title}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <FileBarChart size={12} />
                  {r.item_count || 0}
                </div>
              </div>
            </button>
          )) : (
            <div className="card text-center py-8 text-gray-500 text-sm">
              暂无报告，点击右上角生成
            </div>
          )}
        </div>

        <div className="col-span-3">
          {detail ? (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{detail.report.title}</h3>
                    <div className="text-sm text-gray-400 mt-1">
                      生成于 {new Date(detail.report.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detail.report.status} type="report" />
                    <div className="relative group">
                      <button className="btn-secondary text-sm py-1.5">
                        <Download size={14} className="inline mr-1" />
                        导出
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-gray-600 rounded-lg py-1 hidden group-hover:block z-10 w-32">
                        {(['json', 'csv', 'md'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => handleExport(detail.report.id, f)}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg-secondary transition-colors"
                          >
                            .{f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === f
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                          : 'bg-bg-tertiary text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {f === 'all' ? `全部 (${detail.items.length})` :
                       f === 'pending' ? `待复核 (${detail.items.filter(i => i.review_status === 'pending').length})` :
                       f === 'approved' ? `已通过 (${detail.items.filter(i => i.review_status === 'approved').length})` :
                       `已拒绝 (${detail.items.filter(i => i.review_status === 'rejected').length})`}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {filteredItems.map(item => (
                    <div key={item.id} className="p-4 bg-bg-tertiary rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={item.category} type="review" />
                            <StatusBadge status={item.review_status} type="review" />
                          </div>
                          <div className="text-sm text-gray-300">
                            {item.content.service && item.content.action ? `${item.content.service}:${item.content.action}` :
                             item.content.reason ? String(item.content.reason).slice(0, 100) :
                             JSON.stringify(item.content).slice(0, 100)}
                          </div>
                          {item.review_note && (
                            <div className="text-xs text-gray-500 mt-2">复核备注: {item.review_note}</div>
                          )}
                        </div>
                        {item.review_status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleReview(item.id, 'approved')}
                              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleReview(item.id, 'rejected')}
                              className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16 text-gray-500">
              <FileBarChart size={48} className="mx-auto mb-3 opacity-30" />
              <p>选择左侧报告查看详情，或点击生成新报告</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
