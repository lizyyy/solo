import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Clock, Filter } from 'lucide-react';
import { useExhibitionStore } from '@/store/useExhibitionStore';
import type { HistoryAction, HistorySource, HistoryEntityType } from '@/types';

const ACTION_LABEL: Record<HistoryAction, string> = {
  create: '创建',
  update: '修改',
  delete: '删除',
  auto_calc: '自动计算',
  collision_fix: '碰撞修正',
};

const ACTION_COLOR: Record<HistoryAction, string> = {
  create: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  update: 'bg-sky-100 text-sky-800 border-sky-200',
  delete: 'bg-red-100 text-red-800 border-red-200',
  auto_calc: 'bg-amber-100 text-amber-800 border-amber-200',
  collision_fix: 'bg-orange-100 text-orange-800 border-orange-200',
};

const SOURCE_LABEL: Record<HistorySource, string> = {
  user: '用户操作',
  auto_calc: '自动计算',
  collision_fix: '碰撞修正',
  drag: '拖拽',
};

const SOURCE_COLOR: Record<HistorySource, string> = {
  user: 'bg-[#D4CFC4]/60 text-[#2C2C2C] border-[#D4CFC4]',
  auto_calc: 'bg-amber-50 text-amber-700 border-amber-200',
  collision_fix: 'bg-orange-50 text-orange-700 border-orange-200',
  drag: 'bg-sky-50 text-sky-700 border-sky-200',
};

const ENTITY_LABEL: Record<HistoryEntityType, string> = {
  wall: '墙面',
  artwork: '作品',
  obstacle: '障碍物',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function History() {
  const { history, artworks, obstacles, wall } = useExhibitionStore();

  const [entityFilter, setEntityFilter] = useState<HistoryEntityType | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<HistoryAction | 'all'>('all');
  const [searchId, setSearchId] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (searchId.trim() && !entry.entityId.toLowerCase().includes(searchId.trim().toLowerCase())) return false;
      return true;
    });
  }, [history, entityFilter, actionFilter, searchId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getEntityName = (entityType: HistoryEntityType, entityId: string): string => {
    if (entityType === 'artwork') return artworks.find((a) => a.id === entityId)?.name ?? entityId;
    if (entityType === 'obstacle') return obstacles.find((o) => o.id === entityId)?.name ?? entityId;
    if (entityType === 'wall') return wall.id === entityId ? '主墙面' : entityId;
    return entityId;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-['Noto_Sans_SC',sans-serif]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-['Playfair_Display',serif] text-3xl font-semibold text-[#2C2C2C] tracking-wide">
          调整历史
        </h1>
        <div className="mt-1 h-[2px] w-16 bg-[#C4623A]" />

        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-lg border border-[#D4CFC4]/60 bg-white px-4 py-3">
          <Filter size={16} className="text-[#2C2C2C]/40" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as HistoryEntityType | 'all')}
            className="rounded border border-[#D4CFC4] bg-[#FAFAF7] px-3 py-1.5 text-sm text-[#2C2C2C] outline-none focus:border-[#C4623A]/60"
          >
            <option value="all">全部类型</option>
            <option value="artwork">作品</option>
            <option value="wall">墙面</option>
            <option value="obstacle">障碍物</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as HistoryAction | 'all')}
            className="rounded border border-[#D4CFC4] bg-[#FAFAF7] px-3 py-1.5 text-sm text-[#2C2C2C] outline-none focus:border-[#C4623A]/60"
          >
            <option value="all">全部操作</option>
            <option value="create">创建</option>
            <option value="update">修改</option>
            <option value="delete">删除</option>
            <option value="auto_calc">自动计算</option>
            <option value="collision_fix">碰撞修正</option>
          </select>

          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2C2C2C]/30" />
            <input
              type="text"
              placeholder="搜索实体 ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full rounded border border-[#D4CFC4] bg-[#FAFAF7] py-1.5 pl-8 pr-3 text-sm text-[#2C2C2C] outline-none focus:border-[#C4623A]/60 placeholder:text-[#2C2C2C]/30"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-[#2C2C2C]/40">
            <Clock size={40} strokeWidth={1} />
            <p className="mt-4 text-sm">暂无历史记录</p>
          </div>
        ) : (
          <div className="relative mt-8 pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#D4CFC4]" />

            {filtered.map((entry) => {
              const expanded = expandedIds.has(entry.id);
              return (
                <div key={entry.id} className="relative mb-6 last:mb-0">
                  <div
                    className={`absolute left-[-20px] top-2 h-3.5 w-3.5 rounded-full border-2 ${
                      entry.action === 'create'
                        ? 'border-emerald-500 bg-emerald-100'
                        : entry.action === 'delete'
                        ? 'border-red-500 bg-red-100'
                        : entry.action === 'auto_calc'
                        ? 'border-amber-500 bg-amber-100'
                        : entry.action === 'collision_fix'
                        ? 'border-orange-500 bg-orange-100'
                        : 'border-sky-500 bg-sky-100'
                    }`}
                  />

                  <div
                    className="cursor-pointer rounded-lg border border-[#D4CFC4]/50 bg-white px-5 py-4 transition-colors hover:border-[#C4623A]/30"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <div className="flex items-center gap-2 text-xs text-[#2C2C2C]/50">
                      <span className="font-mono">{formatTimestamp(entry.timestamp)}</span>
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[entry.action]}`}>
                        {ACTION_LABEL[entry.action]}
                      </span>
                      <span className="text-xs text-[#2C2C2C]/60">
                        {ENTITY_LABEL[entry.entityType]}
                      </span>
                      <span className="text-xs font-medium text-[#2C2C2C]">
                        {getEntityName(entry.entityType, entry.entityId)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-[#2C2C2C]/60">{entry.field}</span>
                      <span className="text-[#2C2C2C]/30">:</span>
                      <span className="text-[#2C2C2C]/50 line-through">{entry.oldValue || '--'}</span>
                      <span className="text-[#C4623A]">&rarr;</span>
                      <span className="font-medium text-[#2C2C2C]">{entry.newValue || '--'}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[10px] ${SOURCE_COLOR[entry.source]}`}>
                        {SOURCE_LABEL[entry.source]}
                      </span>
                    </div>

                    {expanded && (
                      <div className="mt-4 border-t border-[#D4CFC4]/40 pt-3 text-xs text-[#2C2C2C]/50">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          <div>记录 ID<span className="ml-2 font-mono text-[#2C2C2C]/70">{entry.id}</span></div>
                          <div>实体 ID<span className="ml-2 font-mono text-[#2C2C2C]/70">{entry.entityId}</span></div>
                          <div>实体类型<span className="ml-2 text-[#2C2C2C]/70">{ENTITY_LABEL[entry.entityType]}</span></div>
                          <div>操作类型<span className="ml-2 text-[#2C2C2C]/70">{ACTION_LABEL[entry.action]}</span></div>
                          <div>变更字段<span className="ml-2 text-[#2C2C2C]/70">{entry.field}</span></div>
                          <div>来源<span className="ml-2 text-[#2C2C2C]/70">{SOURCE_LABEL[entry.source]}</span></div>
                          <div className="col-span-2">时间戳<span className="ml-2 font-mono text-[#2C2C2C]/70">{formatTimestamp(entry.timestamp)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
