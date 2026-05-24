import { useState, useMemo } from 'react';
import { Filter, Plus, Eye, EyeOff, UserX } from 'lucide-react';
import { useAppStore, useFilteredSeats } from '@/store/appStore';

export function LeftPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const seats = useFilteredSeats();
  const { filters, setFilters, addSeatRow, showLineOfSight, setShowLineOfSight } = useAppStore();

  const rowNumbers = useMemo(() => {
    const rows = new Set(seats.map((s) => s.row));
    return Array.from(rows).sort((a, b) => a - b);
  }, [seats]);

  const toggleRowFilter = (row: number) => {
    const newRows = filters.rows.includes(row)
      ? filters.rows.filter((r) => r !== row)
      : [...filters.rows, row];
    setFilters({ ...filters, rows: newRows });
  };

  const toggleBlockedOnly = () => {
    setFilters({ ...filters, blockedOnly: !filters.blockedOnly });
  };

  const blockedSeats = seats.filter((s) => s.isBlocked);
  const visibleSeats = seats.filter((s) => s.isVisible);

  if (isCollapsed) {
    return (
      <div className="absolute left-0 top-14 bottom-20 w-10 bg-slate-900/95 backdrop-blur-sm border-r border-slate-700 flex items-center justify-center z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <Filter size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute left-0 top-14 bottom-20 w-64 bg-slate-900/95 backdrop-blur-sm border-r border-slate-700 flex flex-col z-10">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">座位控制</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <EyeOff size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
            <UserX size={16} />
            仅显示遮挡座位
          </label>
          <button
            onClick={toggleBlockedOnly}
            className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              filters.blockedOnly
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {filters.blockedOnly ? '已启用' : '已禁用'}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium">按排筛选</label>
          <div className="grid grid-cols-4 gap-2">
            {rowNumbers.map((row) => (
              <button
                key={row}
                onClick={() => toggleRowFilter(row)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filters.rows.length === 0 || filters.rows.includes(row)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {row + 1}排
              </button>
            ))}
          </div>
          {filters.rows.length > 0 && (
            <button
              onClick={() => setFilters({ ...filters, rows: [] })}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-slate-300 text-sm font-medium flex items-center gap-2">
            <Eye size={16} />
            显示视线
          </label>
          <button
            onClick={() => setShowLineOfSight(!showLineOfSight)}
            className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              showLineOfSight
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {showLineOfSight ? '已显示' : '已隐藏'}
          </button>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <button
            onClick={addSeatRow}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            添加座位排
          </button>
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-2">
          <h4 className="text-slate-300 text-sm font-medium">图例</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-slate-400 text-xs">正常座位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-slate-400 text-xs">遮挡座位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-slate-400 text-xs">选中座位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-emerald-500" />
              <span className="text-slate-400 text-xs">视线通畅</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500" />
              <span className="text-slate-400 text-xs">视线遮挡</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>总座位数:</span>
            <span className="text-white">{seats.length}</span>
          </div>
          <div className="flex justify-between">
            <span>遮挡座位:</span>
            <span className="text-red-400">{blockedSeats.length}</span>
          </div>
          <div className="flex justify-between">
            <span>可见座位:</span>
            <span className="text-white">{visibleSeats.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
