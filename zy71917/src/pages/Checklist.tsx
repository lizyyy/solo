import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Headphones, AlertTriangle, ListChecks, Check } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { formatTimestamp } from '@/utils/subtitleParser';
import Layout from '@/components/Layout';
import type { Segment } from '@/types';

const statusConfig: Record<
  Segment['alignmentStatus'],
  { label: string; color: string; bg: string }
> = {
  aligned: { label: '已对齐', color: 'text-[#2EC4B6]', bg: 'bg-[#2EC4B6]/15' },
  needs_review: { label: '需重听', color: 'text-[#FF6B35]', bg: 'bg-[#FF6B35]/15' },
  has_issue: { label: '有问题', color: 'text-[#E94560]', bg: 'bg-[#E94560]/15' },
};

export default function Checklist() {
  const { id } = useParams<{ id: string }>();
  const currentProject = useProjectStore((s) => s.currentProject);
  const openProject = useProjectStore((s) => s.openProject);
  const segments = useProjectStore((s) => s.segments);
  const issues = useProjectStore((s) => s.issues);
  const tracks = useProjectStore((s) => s.tracks);
  const entries = useProjectStore((s) => s.entries);
  const updateSegment = useProjectStore((s) => s.updateSegment);
  const saveSegment = useProjectStore((s) => s.updateSegment);

  useEffect(() => {
    if (id) {
      openProject(id);
    }
  }, [id, openProject]);

  useEffect(() => {
    if (currentProject && segments.length === 0 && tracks.length > 0) {
      generateSegments();
    }
  }, [currentProject, segments.length, tracks.length]);

  const generateSegments = async () => {
    if (!currentProject) return;
    const allBoundaries = new Set<number>();
    allBoundaries.add(0);
    allBoundaries.add(currentProject.audioDuration);

    entries.forEach((e) => {
      allBoundaries.add(e.startTime);
      allBoundaries.add(e.endTime);
    });

    const sorted = Array.from(allBoundaries).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (end - start < 0.5) continue;
      const overlappingIssues = issues.filter(
        (iss) => iss.status === 'open' && iss.startTime < end && iss.endTime > start,
      );
      const status: Segment['alignmentStatus'] = overlappingIssues.length > 0 ? 'has_issue' : 'needs_review';
      const newSegment: Segment = {
        id: crypto.randomUUID(),
        projectId: currentProject.id,
        startTime: start,
        endTime: end,
        alignmentStatus: status,
        notes: '',
      };
      await saveSegment(newSegment.id, newSegment);
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const aligned = segments.filter((s) => s.alignmentStatus === 'aligned').length;
    const needsReview = segments.filter((s) => s.alignmentStatus === 'needs_review').length;
    const hasIssue = segments.filter((s) => s.alignmentStatus === 'has_issue').length;
    const pct = segments.length > 0 ? Math.round((aligned / segments.length) * 100) : 0;
    return { aligned, needsReview, hasIssue, total: segments.length, pct };
  }, [segments]);

  function issueTypeForSegment(seg: Segment): string {
    const segIssues = issues.filter(
      (i) => i.startTime >= seg.startTime && i.endTime <= seg.endTime && i.status === 'open',
    );
    if (segIssues.length === 0) return '-';
    const typeLabels: Record<string, string> = {
      silent_deletion: '静音段误删',
      timeline_drift: '时间轴漂移',
      missing_line: '语种遗漏',
    };
    return segIssues.map((i) => typeLabels[i.type] ?? i.type).join(', ');
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === segments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(segments.map((s) => s.id)));
    }
  }

  function batchUpdateStatus(status: Segment['alignmentStatus']) {
    for (const id of selectedIds) {
      updateSegment(id, { alignmentStatus: status });
    }
    setSelectedIds(new Set());
  }

  function handleNotesBlur(segId: string) {
    const note = notesMap[segId];
    if (note !== undefined) {
      updateSegment(segId, { notes: note });
    }
  }

  return (
    <Layout>
      <div className="h-full flex flex-col bg-[#1A1A2E] text-white">
        <div className="px-6 py-4 border-b border-[#0F3460]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold">
              {currentProject?.name ?? '项目'} — 制作检查单
            </h1>
            <span className="text-xs text-gray-500">{stats.total} 个分段</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="已对齐" value={stats.aligned} color="#2EC4B6" />
            <StatCard icon={<Headphones className="w-4 h-4" />} label="需重听" value={stats.needsReview} color="#FF6B35" />
            <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="有问题" value={stats.hasIssue} color="#E94560" />
            <StatCard icon={<ListChecks className="w-4 h-4" />} label="总分段" value={stats.total} color="#0F3460" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#0F3460] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2EC4B6] rounded-full transition-all"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 font-mono">{stats.pct}%</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {segments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              运行检测以生成分段
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#0F3460] sticky top-0 bg-[#1A1A2E]">
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === segments.length && segments.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-[#2EC4B6]"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">序号</th>
                  <th className="px-3 py-2 text-left">时间范围</th>
                  <th className="px-3 py-2 text-left">对齐状态</th>
                  <th className="px-3 py-2 text-left">问题类型</th>
                  <th className="px-3 py-2 text-left">操作人</th>
                  <th className="px-3 py-2 text-left">备注</th>
                  <th className="px-3 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((seg, idx) => {
                  const cfg = statusConfig[seg.alignmentStatus];
                  return (
                    <tr key={seg.id} className="border-b border-[#0F3460]/50 hover:bg-[#16213E]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(seg.id)}
                          onChange={() => toggleSelect(seg.id)}
                          className="accent-[#2EC4B6]"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">
                        {formatTimestamp(seg.startTime)} → {formatTimestamp(seg.endTime)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={seg.alignmentStatus}
                          onChange={(e) =>
                            updateSegment(seg.id, {
                              alignmentStatus: e.target.value as Segment['alignmentStatus'],
                            })
                          }
                          className={`${cfg.bg} ${cfg.color} text-[11px] rounded px-1.5 py-0.5 border-0 outline-none cursor-pointer`}
                        >
                          <option value="aligned">已对齐</option>
                          <option value="needs_review">需重听</option>
                          <option value="has_issue">有问题</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-gray-400">{issueTypeForSegment(seg)}</td>
                      <td className="px-3 py-2 text-gray-500">{seg.reviewedBy ?? '-'}</td>
                      <td className="px-3 py-2">
                        <input
                          value={notesMap[seg.id] ?? seg.notes}
                          onChange={(e) =>
                            setNotesMap((m) => ({ ...m, [seg.id]: e.target.value }))
                          }
                          onBlur={() => handleNotesBlur(seg.id)}
                          placeholder="添加备注..."
                          className="w-full bg-transparent text-gray-300 text-[11px] outline-none placeholder-gray-600 border-b border-transparent focus:border-[#2EC4B6] transition-colors"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() =>
                            updateSegment(seg.id, {
                              reviewedBy: 'current_user',
                              alignmentStatus: 'aligned',
                            })
                          }
                          className="flex items-center gap-1 text-[#2EC4B6] hover:underline"
                        >
                          <Check className="w-3 h-3" /> 审核通过
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="px-4 py-3 bg-[#16213E] border-t border-[#0F3460] flex items-center gap-4">
            <span className="text-xs text-gray-400">已选 {selectedIds.size} 项</span>
            <button
              onClick={() => batchUpdateStatus('aligned')}
              className="text-xs px-3 py-1.5 rounded bg-[#2EC4B6]/15 text-[#2EC4B6] hover:bg-[#2EC4B6]/25 transition-colors"
            >
              批量标记已对齐
            </button>
            <button
              onClick={() => batchUpdateStatus('needs_review')}
              className="text-xs px-3 py-1.5 rounded bg-[#FF6B35]/15 text-[#FF6B35] hover:bg-[#FF6B35]/25 transition-colors"
            >
              批量标记需重听
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-[#16213E] border border-[#0F3460] p-3 flex items-center gap-3">
      <div className="p-1.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold font-mono" style={{ color }}>
          {value}
        </div>
        <div className="text-[11px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}
