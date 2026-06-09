import { useState, useMemo } from 'react';
import { X, RotateCcw, Check, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils';

type TriState = 'all' | 'yes' | 'no';

export default function FilterDrawer() {
  const { filters, setFilters, resetFilters, loadList, items, loading } = useScheduleStore();
  const [localFilters, setLocalFilters] = useState(filters);
  const [batchCollapsed, setBatchCollapsed] = useState(false);
  const [elevatorCollapsed, setElevatorCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const batches = useScheduleStore((s) => s.batches);

  const uniqueBatchIds = useMemo(() => {
    const ids = new Set<string>();
    batches.forEach((b) => ids.add(b.batchId));
    return Array.from(ids).sort();
  }, [batches]);

  const uniqueElevatorNos = useMemo(() => {
    const nos = new Set<string>();
    items.forEach((i) => nos.add(i.elevatorNo));
    return Array.from(nos).sort();
  }, [items]);

  const hitCount = items.length;

  const triState: TriState =
    localFilters.isOverridden === true ? 'yes' : localFilters.isOverridden === false ? 'no' : 'all';

  const setTriState = (s: TriState) => {
    setLocalFilters({
      ...localFilters,
      isOverridden: s === 'all' ? undefined : s === 'yes',
    });
  };

  const toggleBatch = (id: string) => {
    const cur = localFilters.batchIds || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setLocalFilters({ ...localFilters, batchIds: next.length ? next : undefined });
  };

  const toggleElevator = (no: string) => {
    const cur = localFilters.elevatorNos || [];
    const next = cur.includes(no) ? cur.filter((x) => x !== no) : [...cur, no];
    setLocalFilters({ ...localFilters, elevatorNos: next.length ? next : undefined });
  };

  const handlePartNosInput = (v: string) => {
    const arr = v
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setLocalFilters({ ...localFilters, partNos: arr.length ? arr : undefined });
  };

  const handleReset = () => {
    setLocalFilters({});
  };

  const handleApply = () => {
    setFilters(localFilters);
    loadList();
    setMobileOpen(false);
  };

  const partNosDisplay = (localFilters.partNos || []).join(', ');

  const DrawerContent = (
    <div className="h-full flex flex-col bg-ink-800/80 border-r border-ink-600">
      <div className="p-4 border-b border-ink-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-100 font-semibold">
          <Filter className="w-4 h-4 text-warn-400" />
          筛选条件
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 text-ink-300 hover:text-ink-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="block text-xs text-ink-300 mb-2 font-medium">日期段</label>
          <div className="space-y-2">
            <input
              type="date"
              value={localFilters.dateFrom || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, dateFrom: e.target.value || undefined })}
              className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-warn-400"
            />
            <input
              type="date"
              value={localFilters.dateTo || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, dateTo: e.target.value || undefined })}
              className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-warn-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-ink-300 mb-2 font-medium">是否人工改判</label>
          <div className="flex gap-1">
            {(['all', 'yes', 'no'] as TriState[]).map((s) => (
              <button
                key={s}
                onClick={() => setTriState(s)}
                className={cn(
                  'flex-1 px-3 py-1.5 text-xs font-medium rounded-sm border-2 transition-colors',
                  triState === s
                    ? s === 'all'
                      ? 'bg-ink-600 text-ink-100 border-ink-400'
                      : s === 'yes'
                      ? 'bg-warn-400/20 text-warn-100 border-warn-400'
                      : 'bg-mint-400/20 text-mint-100 border-mint-300'
                    : 'bg-ink-700 text-ink-300 border-ink-500 hover:border-ink-400'
                )}
              >
                {s === 'all' ? '全部' : s === 'yes' ? '是' : '否'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={() => setBatchCollapsed(!batchCollapsed)}
            className="w-full flex items-center justify-between text-xs text-ink-300 mb-2 font-medium hover:text-ink-100"
          >
            <span>批次号多选 ({uniqueBatchIds.length})</span>
            {batchCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {!batchCollapsed && (
            <div className="max-h-40 overflow-y-auto border border-ink-600 rounded-sm p-2 bg-ink-900/50 space-y-1">
              {uniqueBatchIds.length === 0 ? (
                <div className="text-xs text-ink-400 py-2 text-center">加载中...</div>
              ) : (
                uniqueBatchIds.map((id) => {
                  const selected = (localFilters.batchIds || []).includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleBatch(id)}
                      className={cn(
                        'w-full text-left px-2 py-1 text-xs rounded-sm transition-colors flex items-center gap-2',
                        selected
                          ? 'bg-warn-400/20 text-warn-100 border border-warn-400'
                          : 'text-ink-200 hover:bg-ink-700/60 border border-transparent'
                      )}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      <span className="font-mono">{id}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
          {localFilters.batchIds && localFilters.batchIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {localFilters.batchIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-warn-400/15 text-warn-100 border border-warn-400/50 rounded-sm"
                >
                  <span className="font-mono">{id}</span>
                  <button onClick={() => toggleBatch(id)} className="text-warn-300 hover:text-warn-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setElevatorCollapsed(!elevatorCollapsed)}
            className="w-full flex items-center justify-between text-xs text-ink-300 mb-2 font-medium hover:text-ink-100"
          >
            <span>电梯号多选 ({uniqueElevatorNos.length})</span>
            {elevatorCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {!elevatorCollapsed && (
            <div className="max-h-40 overflow-y-auto border border-ink-600 rounded-sm p-2 bg-ink-900/50 space-y-1">
              {uniqueElevatorNos.length === 0 ? (
                <div className="text-xs text-ink-400 py-2 text-center">加载中...</div>
              ) : (
                uniqueElevatorNos.map((no) => {
                  const selected = (localFilters.elevatorNos || []).includes(no);
                  return (
                    <button
                      key={no}
                      onClick={() => toggleElevator(no)}
                      className={cn(
                        'w-full text-left px-2 py-1 text-xs rounded-sm transition-colors flex items-center gap-2',
                        selected
                          ? 'bg-mint-400/20 text-mint-100 border border-mint-300'
                          : 'text-ink-200 hover:bg-ink-700/60 border border-transparent'
                      )}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      <span className="font-mono">{no}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
          {localFilters.elevatorNos && localFilters.elevatorNos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {localFilters.elevatorNos.map((no) => (
                <span
                  key={no}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-mint-400/15 text-mint-100 border border-mint-300/50 rounded-sm"
                >
                  <span className="font-mono">{no}</span>
                  <button onClick={() => toggleElevator(no)} className="text-mint-200 hover:text-mint-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-ink-300 mb-2 font-medium">
            备件型号（逗号分隔）
          </label>
          <input
            type="text"
            value={partNosDisplay}
            onChange={(e) => handlePartNosInput(e.target.value)}
            placeholder="PART-001, PART-002"
            className="w-full bg-ink-700 border border-ink-500 rounded-sm px-3 py-2 text-sm text-ink-100 font-mono focus:outline-none focus:border-warn-400"
          />
        </div>
      </div>

      <div className="p-4 border-t border-ink-600 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-300">当前命中</span>
          <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-warn-400/15 text-warn-100 border border-warn-400/50 rounded-sm">
            {hitCount} 条
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={loading}
            className="btn-industrial border-ink-500 text-ink-200 bg-ink-700/50 flex-1 justify-center text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
          <button
            onClick={handleApply}
            disabled={loading}
            className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/15 flex-1 justify-center text-xs"
          >
            <Check className="w-3.5 h-3.5" />
            应用
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-20 left-4 z-40 btn-industrial border-ink-500 text-ink-200 bg-ink-800 text-sm"
      >
        <Filter className="w-4 h-4" />
        筛选
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-ink-900/70"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-16 left-0 bottom-0 w-[280px] z-40 transition-transform duration-200',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {DrawerContent}
      </aside>
    </>
  );
}
