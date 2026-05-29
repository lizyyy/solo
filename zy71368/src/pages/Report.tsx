import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download, Printer, AlertTriangle } from 'lucide-react';
import { useExhibitionStore } from '@/store/useExhibitionStore';
import type { Artwork, ObstacleType, HistoryAction, HistorySource } from '@/types';

const OBSTACLE_TYPE_LABEL: Record<ObstacleType, string> = {
  switch: '开关',
  fire_extinguisher: '灭火器',
  pipe: '管道',
  outlet: '插座',
  other: '其他',
};

const ACTION_LABEL: Record<HistoryAction, string> = {
  create: '创建',
  update: '修改',
  delete: '删除',
  auto_calc: '自动计算',
  collision_fix: '碰撞修正',
};

const SOURCE_LABEL: Record<HistorySource, string> = {
  user: '用户操作',
  auto_calc: '自动计算',
  collision_fix: '碰撞修正',
  drag: '拖拽',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-['Playfair_Display',serif] text-lg font-semibold text-[#2C2C2C] tracking-wide">
      {children}
    </h2>
  );
}

export default function Report() {
  const { wall, artworks, obstacles, history } = useExhibitionStore();
  const [expandedArtworkIds, setExpandedArtworkIds] = useState<Set<string>>(new Set());

  const generatedAt = useMemo(() => formatTimestamp(new Date().toISOString()), []);

  const report = useMemo(() => ({
    wall,
    artworks,
    obstacles,
    historyEntries: history,
    generatedAt,
  }), [wall, artworks, obstacles, history, generatedAt]);

  const collisionArtworks = useMemo(() => artworks.filter((a) => a.hasCollision), [artworks]);

  const getArtworkHistory = (artworkId: string) =>
    history.filter((h) => h.entityType === 'artwork' && h.entityId === artworkId).slice(0, 5);

  const getCollisionName = (id: string): string => {
    const artwork = artworks.find((a) => a.id === id);
    if (artwork) return artwork.name;
    const obs = obstacles.find((o) => o.id === id);
    if (obs) return obs.name;
    return id;
  };

  const toggleArtworkExpand = (id: string) => {
    setExpandedArtworkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exhibition-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-['Noto_Sans_SC',sans-serif]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-['Playfair_Display',serif] text-3xl font-semibold text-[#2C2C2C] tracking-wide">
              布展报告
            </h1>
            <div className="mt-1 h-[2px] w-16 bg-[#C4623A]" />
          </div>
          <span className="text-xs text-[#2C2C2C]/40 font-mono">
            生成于 {generatedAt}
          </span>
        </div>

        <section className="mt-10">
          <SectionTitle>墙面概览</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-[#D4CFC4]/60 bg-white px-4 py-3">
              <div className="text-xs text-[#2C2C2C]/40">宽度</div>
              <div className="mt-1 text-lg font-medium text-[#2C2C2C]">{wall.width} cm</div>
            </div>
            <div className="rounded-lg border border-[#D4CFC4]/60 bg-white px-4 py-3">
              <div className="text-xs text-[#2C2C2C]/40">高度</div>
              <div className="mt-1 text-lg font-medium text-[#2C2C2C]">{wall.height} cm</div>
            </div>
            <div className="rounded-lg border border-[#D4CFC4]/60 bg-white px-4 py-3">
              <div className="text-xs text-[#2C2C2C]/40">地面偏移</div>
              <div className="mt-1 text-lg font-medium text-[#2C2C2C]">{wall.floorOffset} cm</div>
            </div>
            <div className="rounded-lg border border-[#D4CFC4]/60 bg-white px-4 py-3">
              <div className="text-xs text-[#2C2C2C]/40">视线高度</div>
              <div className="mt-1 text-lg font-medium text-[#C4623A]">{wall.sightLineHeight} cm</div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <SectionTitle>作品列表</SectionTitle>
          {artworks.length === 0 ? (
            <p className="mt-3 text-sm text-[#2C2C2C]/40">暂无作品</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[#D4CFC4]/60 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D4CFC4]/40 text-left text-xs text-[#2C2C2C]/40">
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">画框尺寸</th>
                    <th className="px-4 py-3 font-medium">位置 X</th>
                    <th className="px-4 py-3 font-medium">位置 Y</th>
                    <th className="px-4 py-3 font-medium">中心高度</th>
                    <th className="px-4 py-3 font-medium">视线偏差</th>
                    <th className="px-4 py-3 font-medium">碰撞</th>
                    <th className="px-4 py-3 font-medium">关联历史</th>
                    <th className="px-4 py-3 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {artworks.map((artwork) => {
                    const expanded = expandedArtworkIds.has(artwork.id);
                    const artHistory = getArtworkHistory(artwork.id);
                    const linkedHistoryIds = history
                      .filter((h) => h.entityType === 'artwork' && h.entityId === artwork.id)
                      .map((h) => h.id);

                    return (
                      <ArtworkRow
                        key={artwork.id}
                        artwork={artwork}
                        expanded={expanded}
                        linkedHistoryIds={linkedHistoryIds}
                        artHistory={artHistory}
                        onToggle={() => toggleArtworkExpand(artwork.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle>障碍物列表</SectionTitle>
          {obstacles.length === 0 ? (
            <p className="mt-3 text-sm text-[#2C2C2C]/40">暂无障碍物</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[#D4CFC4]/60 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D4CFC4]/40 text-left text-xs text-[#2C2C2C]/40">
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium">位置 (X, Y)</th>
                    <th className="px-4 py-3 font-medium">尺寸 (W x H)</th>
                  </tr>
                </thead>
                <tbody>
                  {obstacles.map((obs) => (
                    <tr key={obs.id} className="border-b border-[#D4CFC4]/20 last:border-b-0">
                      <td className="px-4 py-3 text-[#2C2C2C]">{obs.name}</td>
                      <td className="px-4 py-3 text-[#2C2C2C]/70">{OBSTACLE_TYPE_LABEL[obs.obstacleType]}</td>
                      <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{obs.posX}, {obs.posY}</td>
                      <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{obs.width} x {obs.height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <SectionTitle>碰撞记录</SectionTitle>
          {collisionArtworks.length === 0 ? (
            <p className="mt-3 text-sm text-[#2C2C2C]/40">无碰撞</p>
          ) : (
            <div className="mt-3 space-y-3">
              {collisionArtworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="rounded-lg border border-orange-200 bg-orange-50/50 px-5 py-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[#C4623A]" />
                    <span className="text-sm font-medium text-[#2C2C2C]">{artwork.name}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-[#2C2C2C]/60">
                    与以下对象碰撞：
                    {artwork.collisionWith.map((cid, i) => (
                      <span key={cid}>
                        {i > 0 && '、'}
                        <span className="font-medium text-[#2C2C2C]/80">{getCollisionName(cid)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-12 flex gap-3">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 rounded-lg border border-[#D4CFC4] bg-white px-5 py-2.5 text-sm font-medium text-[#2C2C2C] transition-colors hover:border-[#C4623A]/40 hover:text-[#C4623A]"
          >
            <Download size={16} />
            导出 JSON
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg border border-[#D4CFC4] bg-white px-5 py-2.5 text-sm font-medium text-[#2C2C2C] transition-colors hover:border-[#C4623A]/40 hover:text-[#C4623A]"
          >
            <Printer size={16} />
            打印报告
          </button>
        </div>
      </div>
    </div>
  );
}

function ArtworkRow({
  artwork,
  expanded,
  linkedHistoryIds,
  artHistory,
  onToggle,
}: {
  artwork: Artwork;
  expanded: boolean;
  linkedHistoryIds: string[];
  artHistory: { id: string; action: HistoryAction; field: string; oldValue: string; newValue: string; source: HistorySource; timestamp: string }[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#D4CFC4]/20 last:border-b-0">
        <td className="px-4 py-3 font-medium text-[#2C2C2C]">{artwork.name}</td>
        <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{artwork.frameWidth} x {artwork.frameHeight}</td>
        <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{artwork.posX}</td>
        <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{artwork.posY}</td>
        <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{artwork.centerHeight}</td>
        <td className="px-4 py-3 font-mono text-[#2C2C2C]/70">{artwork.sightLineDeviation}</td>
        <td className="px-4 py-3">
          {artwork.hasCollision ? (
            <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              碰撞
            </span>
          ) : (
            <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
              正常
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-[#2C2C2C]/40 font-mono">
          {linkedHistoryIds.length}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={onToggle}
            className="flex items-center text-[#2C2C2C]/40 transition-colors hover:text-[#C4623A]"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-[#FAFAF7] px-8 py-4">
            <div className="text-xs font-medium text-[#2C2C2C]/50 mb-2">历史溯源 (最近 5 条)</div>
            {artHistory.length === 0 ? (
              <p className="text-xs text-[#2C2C2C]/30">无历史记录</p>
            ) : (
              <div className="space-y-2">
                {artHistory.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-[#2C2C2C]/40 shrink-0">{formatTimestamp(h.timestamp)}</span>
                    <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                      {ACTION_LABEL[h.action]}
                    </span>
                    <span className="text-[#2C2C2C]/60">{h.field}</span>
                    <span className="text-[#2C2C2C]/30 line-through">{h.oldValue || '--'}</span>
                    <span className="text-[#C4623A]">&rarr;</span>
                    <span className="text-[#2C2C2C] font-medium">{h.newValue || '--'}</span>
                    <span className="rounded bg-[#D4CFC4]/40 px-1.5 py-0.5 text-[10px] text-[#2C2C2C]/50">
                      {SOURCE_LABEL[h.source]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
