import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/StatusBadge';

const Inventory = () => {
  const navigate = useNavigate();
  const { artworks, stats, filters, loading, fetchArtworks, fetchStats, setFilters } = useStore();
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchArtworks({ ...filters, page, limit });
  }, [fetchArtworks, filters, page, limit]);

  const statusCounts = [
    { key: 'total', label: '总计', value: stats?.total || 0, color: 'text-gallery-fg' },
    { key: 'unchecked', label: '未核对', value: stats?.unchecked || 0, color: 'text-gallery-muted' },
    { key: 'disputed', label: '有争议', value: stats?.disputed || 0, color: 'text-gallery-rust' },
    { key: 'corrected', label: '已修正', value: stats?.corrected || 0, color: 'text-gallery-amber' },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statusCounts.map((item) => (
          <div key={item.key} className="bg-gallery-surface border border-gallery-border rounded p-4">
            <div className="text-xs text-gallery-muted mb-1">{item.label}</div>
            <div className={`text-2xl font-mono font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <select
          className="px-3 py-2 rounded text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
        >
          <option value="">全部状态</option>
          <option value="unchecked">未核对</option>
          <option value="checked">已核对</option>
          <option value="disputed">有争议</option>
          <option value="corrected">已修正</option>
        </select>

        <select
          className="px-3 py-2 rounded text-sm"
          value={filters.source}
          onChange={(e) => setFilters({ source: e.target.value })}
        >
          <option value="">全部来源</option>
          <option value="insurance">保险单</option>
          <option value="lighting">灯光记录</option>
          <option value="artwork_list">作品清单</option>
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.disputed === true}
            onChange={(e) => setFilters({ disputed: e.target.checked ? true : null })}
            className="w-4 h-4"
          />
          仅显示有争议
        </label>

        <button
          onClick={() => {
            setFilters({ status: '', source: '', disputed: null });
            setPage(1);
          }}
          className="px-3 py-2 text-sm text-gallery-amber hover:bg-gallery-surface rounded transition-colors"
        >
          清除筛选
        </button>
      </div>

      <div className="bg-gallery-surface border border-gallery-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gallery-border">
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">作品名</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">艺术家</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">尺寸</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">来源数</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">争议</th>
              <th className="text-left px-4 py-3 font-medium text-gallery-muted">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gallery-muted">加载中...</td>
              </tr>
            ) : artworks.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gallery-muted">暂无数据</td>
              </tr>
            ) : (
              artworks.map((artwork) => (
                <tr
                  key={artwork.id}
                  className="border-b border-gallery-border/50 cursor-pointer"
                  onClick={() => navigate(`/artwork/${artwork.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{artwork.title}</td>
                  <td className="px-4 py-3 text-gallery-muted">{artwork.artist}</td>
                  <td className="px-4 py-3 font-mono text-xs">{artwork.dimensions} {artwork.dimension_unit}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={artwork.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">-</td>
                  <td className="px-4 py-3">
                    {artwork.status === 'disputed' && (
                      <AlertCircle className="w-4 h-4 text-gallery-rust" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/artwork/${artwork.id}`); }}
                      className="p-1 hover:bg-gallery-bg rounded"
                    >
                      <Eye className="w-4 h-4 text-gallery-muted" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gallery-border">
          <span className="text-xs text-gallery-muted">第 {page} 页</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gallery-border rounded disabled:opacity-50 hover:bg-gallery-bg"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-sm border border-gallery-border rounded hover:bg-gallery-bg"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
