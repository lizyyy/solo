import { useMemo, useState } from 'react';
import { Search, AlertCircle, MapPin, Waves } from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import type { StationRecord, StationStatus } from '@/types';

// 状态排序权重：exception → pending → normal
const STATUS_WEIGHT: Record<StationStatus, number> = {
  exception: 0,
  pending: 1,
  normal: 2,
};

// 边框颜色
const STATUS_BORDER: Record<StationStatus, string> = {
  exception: 'border-l-buoy-red',
  pending: 'border-l-buoy-yellow',
  normal: 'border-l-buoy-green',
};

// 徽章样式
const STATUS_BADGE: Record<StationStatus, string> = {
  exception: 'badge-exception',
  pending: 'badge-pending',
  normal: 'badge-normal',
};

const STATUS_TEXT: Record<StationStatus, string> = {
  exception: '异常',
  pending: '待核查',
  normal: '正常',
};

function StationCard({
  station,
  selected,
  onClick,
}: {
  station: StationRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const coordNull = station.latitude === null || station.longitude === null;
  const tideNull = station.tide_meters === null;

  return (
    <div
      onClick={onClick}
      className={`panel cursor-pointer p-3 pl-4 border-l-4 transition-all duration-150
        ${STATUS_BORDER[station.status]}
        ${selected
          ? 'shadow-glow border-glow-cyan bg-glow-cyan/5 ring-1 ring-glow-cyan/30'
          : 'hover:border-glow-cyan hover:shadow-glow'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin size={13} className="text-console-muted shrink-0" />
          <span className="font-mono text-[13px] text-console-text truncate">
            {station.station_name}
          </span>
        </div>
        <span className={`badge ${STATUS_BADGE[station.status]} shrink-0`}>
          {STATUS_TEXT[station.status]}
        </span>
      </div>

      {/* 潮位等级 */}
      <div className="flex items-center gap-1.5 mb-2">
        <Waves size={12} className="text-glow-cyanDim shrink-0" />
        <span className="text-[12px] font-mono text-console-muted">
          潮位等级:
        </span>
        <span
          className={`text-[12px] font-mono ${
            tideNull ? 'text-buoy-red' : 'text-buoy-green'
          }`}
        >
          {tideNull ? (
            <span className="inline-flex items-center gap-1">
              <AlertCircle size={11} /> ⚠ 解析失败
            </span>
          ) : (
            station.tide_level
          )}
        </span>
      </div>

      {/* 坐标 */}
      <div className="font-mono text-[11px] leading-relaxed">
        {coordNull ? (
          <div className="flex items-center gap-1 text-buoy-red">
            <AlertCircle size={11} /> ⚠ 解析失败
          </div>
        ) : (
          <div className="text-console-muted space-y-0.5">
            <div>
              <span className="text-console-dim">LAT</span>{' '}
              <span className="text-console-text">
                {station.latitude?.toFixed(6)}
              </span>
            </div>
            <div>
              <span className="text-console-dim">LNG</span>{' '}
              <span className="text-console-text">
                {station.longitude?.toFixed(6)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StationList() {
  const { stations, selected_station_id, selectStation } = useTidalStore();
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list = kw
      ? stations.filter(
          (s) =>
            s.station_name.toLowerCase().includes(kw) ||
            s.log_id.toLowerCase().includes(kw) ||
            s.annotation_id.toLowerCase().includes(kw),
        )
      : [...stations];
    // 按状态排序
    list.sort(
      (a, b) =>
        STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] ||
        a.station_name.localeCompare(b.station_name),
    );
    return list;
  }, [stations, keyword]);

  return (
    <aside className="flex flex-col h-full bg-ocean-deep/40 border-r border-ocean-line">
      {/* 搜索框 */}
      <div className="p-3 border-b border-ocean-line">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-console-dim"
          />
          <input
            type="text"
            placeholder="搜索站点名 / log_id..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-ocean-surface/60 border border-ocean-line
              rounded-sm text-[12px] text-console-text font-mono outline-none
              focus:border-glow-cyanDim placeholder:text-console-dim"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto console-scroll p-2.5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-console-dim text-[12px] font-mono py-12">
            {stations.length === 0
              ? '暂无数据，请点击「加载示例浮标日志」或「粘贴日志」'
              : '无匹配结果'}
          </div>
        ) : (
          filtered.map((s) => (
            <StationCard
              key={s.annotation_id}
              station={s}
              selected={s.annotation_id === selected_station_id}
              onClick={() => selectStation(s.annotation_id)}
            />
          ))
        )}
      </div>

      {/* 底部计数 */}
      <div className="px-3 py-2 border-t border-ocean-line flex items-center justify-between">
        <span className="text-[11px] font-mono text-console-muted">
          显示 {filtered.length}/{stations.length}
        </span>
        <span className="text-[11px] font-mono text-console-dim">
          按 exception → pending → normal 排序
        </span>
      </div>
    </aside>
  );
}
