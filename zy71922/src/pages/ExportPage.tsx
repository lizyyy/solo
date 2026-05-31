import { useState, useEffect } from 'react';
import { Download, Filter } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/StatusBadge';

const ExportPage = () => {
  const { artworks, fetchArtworks, exportData } = useStore();
  const [filters, setFilters] = useState({
    status: [] as string[],
    source: [] as string[],
    disputed: false,
  });
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    fetchArtworks({ page: 1, limit: 100 });
  }, []);

  const toggleFilter = (category: 'status' | 'source', value: string) => {
    setFilters(f => {
      const arr = f[category];
      return {
        ...f,
        [category]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      };
    });
  };

  const applyFilters = () => {
    const q: any = { page: 1, limit: 100 };
    if (filters.status.length === 1) q.status = filters.status[0];
    if (filters.disputed) q.disputed = true;
    fetchArtworks(q);
  };

  const handleExport = async () => {
    const expFilters: any = {};
    if (filters.status.length) expFilters.status = filters.status;
    if (filters.source.length) expFilters.source = filters.source;
    if (filters.disputed) expFilters.disputed = true;
    const url = await exportData(expFilters);
    if (url) {
      setDownloadUrl(url);
      setTimeout(() => {
        window.open(url, '_blank');
      }, 100);
    }
  };

  const statusOptions = [
    { value: 'unchecked', label: '未核对' },
    { value: 'checked', label: '已核对' },
    { value: 'disputed', label: '有争议' },
    { value: 'corrected', label: '已修正' },
  ];

  const sourceOptions = [
    { value: 'insurance', label: '保险单' },
    { value: 'lighting', label: '灯光记录' },
    { value: 'artwork_list', label: '作品清单' },
  ];

  return (
    <div className="p-6 h-screen flex flex-col">
      <h1 className="text-2xl font-bold mb-6">筛选导出</h1>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="w-64 flex-shrink-0 bg-gallery-surface border border-gallery-border rounded p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gallery-amber" />
            <span className="font-medium">筛选条件</span>
          </div>

          <div className="mb-6">
            <div className="text-xs text-gallery-muted mb-2">状态</div>
            <div className="space-y-2">
              {statusOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(opt.value)}
                    onChange={() => toggleFilter('status', opt.value)}
                    className="w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-xs text-gallery-muted mb-2">来源</div>
            <div className="space-y-2">
              {sourceOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.source.includes(opt.value)}
                    onChange={() => toggleFilter('source', opt.value)}
                    className="w-4 h-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.disputed}
                onChange={(e) => setFilters(f => ({ ...f, disputed: e.target.checked }))}
                className="w-4 h-4"
              />
              仅显示有争议
            </label>
          </div>

          <button
            onClick={applyFilters}
            className="w-full py-2 border border-gallery-border rounded text-sm hover:bg-gallery-bg"
          >
            应用筛选
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 bg-gallery-surface border border-gallery-border rounded overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gallery-surface border-b border-gallery-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gallery-muted">作品名</th>
                    <th className="text-left px-4 py-3 font-medium text-gallery-muted">艺术家</th>
                    <th className="text-left px-4 py-3 font-medium text-gallery-muted">尺寸</th>
                    <th className="text-left px-4 py-3 font-medium text-gallery-muted">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-gallery-muted">最新修正</th>
                  </tr>
                </thead>
                <tbody>
                  {artworks.map(a => (
                    <tr key={a.id} className="border-b border-gallery-border/50">
                      <td className="px-4 py-3 font-medium">{a.title}</td>
                      <td className="px-4 py-3 text-gallery-muted">{a.artist}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.dimensions} {a.dimension_unit}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gallery-muted">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between bg-gallery-surface border border-gallery-border rounded p-4">
        <span className="text-sm text-gallery-muted">匹配 {artworks.length} 条记录</span>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-2 bg-gallery-amber text-white rounded text-sm hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      {downloadUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gallery-surface border border-gallery-border rounded p-6">
            <div className="text-sm mb-4">导出完成</div>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gallery-amber hover:underline text-sm"
            >
              {downloadUrl}
            </a>
            <button
              onClick={() => setDownloadUrl('')}
              className="block mt-4 px-4 py-2 border border-gallery-border rounded text-sm w-full"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
