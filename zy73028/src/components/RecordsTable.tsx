import { useMemo } from 'react';
import {
  Eye,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  PET_CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_CHIP_CLASS,
  ANOMALY_CHIP_CLASS,
  ANOMALY_LABEL,
  type TempControlRecord,
  type FilterState,
} from '@/types';

export default function RecordsTable() {
  const records = useAppStore((s) => s.records);
  const filterState = useAppStore((s) => s.filterState);
  const drillDown = useAppStore((s) => s.drillDown);
  const confirmedIds = useAppStore((s) => s.confirmedIds);
  const mergeGroups = useAppStore((s) => s.mergeGroups);
  const toggleConfirm = useAppStore((s) => s.toggleConfirm);
  const setOpenDetail = useAppStore((s) => s.setOpenDetail);

  const mergeGroupMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const mg of mergeGroups) {
      m.set(mg.id, mg.confirmed);
    }
    return m;
  }, [mergeGroups]);

  const filteredRecords = useMemo(
    () => applyFilters(records, filterState),
    [records, filterState]
  );

  const now = Date.now();
  const highlightWindowMs = 5000;

  return (
    <div
      className="flex-1 min-w-0 bg-white rounded-xl ring-1 ring-ink-200/70 overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - 140px - 20px)' }}
    >
      <div className="overflow-auto flex-1 scrollbar-thin">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-12 text-center">
                <span className="sr-only">确认</span>
              </th>
              <th className="w-[160px]">宠物名</th>
              <th className="w-[140px]">品类 / 品种</th>
              <th className="w-[160px]">主人 / 电话</th>
              <th className="w-[140px]">体重</th>
              <th className="w-[100px]">温度</th>
              <th className="w-[140px]">测量时间</th>
              <th className="w-[90px]">状态</th>
              <th className="w-[200px]">异常标签</th>
              <th className="w-[80px] text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-ink-400">
                    <AlertCircle className="w-10 h-10 opacity-40" />
                    <div className="text-sm">暂无匹配的记录</div>
                    <div className="text-xs text-ink-400/80">
                      尝试调整筛选条件或清空搜索关键词
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                const isConfirmed = confirmedIds.includes(r.id);
                const shouldHighlight =
                  drillDown.recordIds.includes(r.id) &&
                  now - drillDown.highlightAt < highlightWindowMs;
                const isDrillOpen = drillDown.openedRecordId === r.id;

                return (
                  <tr
                    key={r.id}
                    className={cn(
                      shouldHighlight && 'row-flash',
                      isDrillOpen && 'bg-clinic-50/60'
                    )}
                  >
                    <td className="text-center relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-clinic-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r" />
                      <button
                        onClick={() => toggleConfirm(r.id)}
                        className={cn(
                          'w-5 h-5 rounded-md border-2 inline-flex items-center justify-center transition-all',
                          isConfirmed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-ink-300 hover:border-clinic-400 hover:bg-clinic-50 text-transparent'
                        )}
                        title={isConfirmed ? '取消确认' : '确认记录'}
                      >
                        {isConfirmed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </button>
                    </td>

                    <td>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink-800 text-[13.5px]">
                            {r.petName}
                          </span>
                          {r.mergeGroupId && (
                            <span
                              className={cn(
                                'chip chip-anom-dup text-[10px]',
                                mergeGroupMap.get(r.mergeGroupId) &&
                                  'opacity-60'
                              )}
                            >
                              {mergeGroupMap.get(r.mergeGroupId)
                                ? '已合并'
                                : '疑似重名'}
                            </span>
                          )}
                        </div>
                        {r.aliases && r.aliases.length > 0 && (
                          <span className="text-[11px] text-ink-400 italic truncate max-w-[150px]">
                            又名：{r.aliases.join(' / ')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="chip bg-clinic-50 text-clinic-700 ring-1 ring-clinic-200 text-[10px] py-px">
                            {PET_CATEGORY_LABEL[r.petCategory]}
                          </span>
                        </span>
                        <span className="text-[12px] text-ink-600 truncate max-w-[130px]">
                          {r.species}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-ink-700">
                          {r.ownerName}
                        </span>
                        <span className="text-[11.5px] text-ink-500 font-mono tracking-tight">
                          {r.ownerPhone}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-mono font-medium text-ink-700">
                            {r.weight}
                          </span>
                          <span className="text-[11px] text-ink-500">
                            {r.weightUnit}
                          </span>
                          {r.weightUnitAbnormal && (
                            <span className="relative inline-flex">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-warnSpin" />
                            </span>
                          )}
                        </div>
                        {r.weightUnitAbnormal && (
                          <span className="text-[10.5px] text-ink-400">
                            ≈ {r.weightNormalizedKg.toFixed(3)} kg
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'text-[13px] font-mono font-semibold',
                            r.anomalyType.includes('temp_out_of_range')
                              ? 'text-orange-600'
                              : 'text-ink-700'
                          )}
                        >
                          {r.temperature.toFixed(1)}
                        </span>
                        <span className="text-[11px] text-ink-400">℃</span>
                      </div>
                    </td>

                    <td>
                      <span className="text-[12px] text-ink-600 font-mono text-balance">
                        {formatMeasureTime(r.measureTime)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={cn(
                          'chip',
                          STATUS_CHIP_CLASS[r.status]
                        )}
                      >
                        {r.status === 'confirmed' && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {r.status === 'anomaly' && (
                          <XCircle className="w-3 h-3" />
                        )}
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>

                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.anomalyType.length === 0 ? (
                          <span className="text-[11px] text-ink-400">—</span>
                        ) : (
                          r.anomalyType.map((a) => (
                            <span
                              key={a}
                              className={cn('chip', ANOMALY_CHIP_CLASS[a])}
                              title={ANOMALY_LABEL[a]}
                            >
                              {ANOMALY_LABEL[a]}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="text-center">
                      <button
                        onClick={() => setOpenDetail(r.id)}
                        className={cn(
                          'btn-ghost w-full justify-center !py-1 !px-2 text-[12px]',
                          isDrillOpen &&
                            'bg-clinic-100 text-clinic-700 hover:bg-clinic-200'
                        )}
                        title="查看明细"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        明细
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-ink-200/70 flex items-center justify-between bg-ink-50/50 text-[11.5px] text-ink-500">
        <div className="flex items-center gap-4">
          <span>
            共 <span className="font-semibold text-ink-700">{filteredRecords.length}</span> 条
            {filteredRecords.length !== records.length && (
              <span className="text-ink-400">（总数 {records.length}）</span>
            )}
          </span>
          <span className="text-ink-300">|</span>
          <span>
            已确认{' '}
            <span className="font-semibold text-emerald-600">
              {filteredRecords.filter((r) => confirmedIds.includes(r.id)).length}
            </span>
          </span>
        </div>
        {drillDown.recordIds.length > 0 && (
          <div className="flex items-center gap-1.5 text-clinic-600">
            <span className="w-1.5 h-1.5 rounded-full bg-clinic-500 animate-pulse" />
            已定位 {drillDown.recordIds.length} 条相关记录
          </div>
        )}
      </div>
    </div>
  );
}

function applyFilters(
  records: TempControlRecord[],
  f: FilterState
): TempControlRecord[] {
  const search = f.search.trim().toLowerCase();

  return records.filter((r) => {
    if (search) {
      const haystack = [
        r.petName,
        ...(r.aliases || []),
        r.ownerName,
        r.ownerPhone,
        r.species,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (f.category !== 'all' && r.petCategory !== f.category) {
      return false;
    }

    if (f.status !== 'all' && r.status !== f.status) {
      return false;
    }

    if (f.anomaly !== 'all' && !r.anomalyType.includes(f.anomaly)) {
      return false;
    }

    if (f.weightAbnormal !== 'all') {
      if (f.weightAbnormal === 'abnormal' && !r.weightUnitAbnormal) return false;
      if (f.weightAbnormal === 'normal' && r.weightUnitAbnormal) return false;
    }

    if (f.hasDuplicate !== 'all') {
      const hasDup = !!r.mergeGroupId;
      if (f.hasDuplicate === 'yes' && !hasDup) return false;
      if (f.hasDuplicate === 'no' && hasDup) return false;
    }

    return true;
  });
}

function formatMeasureTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const sameDay =
      sameYear &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) {
      return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (sameYear) {
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}
