import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitMerge, ChevronDown, ChevronRight } from "lucide-react";
import { useAppStore } from "../store/app.store";
import { api } from "../utils/api";
import StatusBadge from "../components/StatusBadge";
import EvidenceTag from "../components/EvidenceTag";
import type { ConflictItem } from "../../shared/types";

export default function Review() {
  const navigate = useNavigate();
  const { currentBatch, mergedPoints, reviewLoading, fetchMergedPoints, addToast } = useAppStore();
  const [merging, setMerging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [conflictMap, setConflictMap] = useState<Record<string, ConflictItem[]>>({});

  useEffect(() => {
    if (currentBatch) {
      fetchMergedPoints(currentBatch.id);
      api.conflicts.list(currentBatch.id).then((list) => {
        const map: Record<string, ConflictItem[]> = {};
        list.forEach((c) => {
          if (!map[c.mergedPointId]) map[c.mergedPointId] = [];
          map[c.mergedPointId].push(c);
        });
        setConflictMap(map);
      }).catch(() => {});
    }
  }, [currentBatch, fetchMergedPoints]);

  const handleMerge = async () => {
    if (!currentBatch) return;
    setMerging(true);
    try {
      const result = await api.merge.trigger(currentBatch.id);
      await fetchMergedPoints(currentBatch.id);
      api.conflicts.list(currentBatch.id).then((list) => {
        const map: Record<string, ConflictItem[]> = {};
        list.forEach((c) => {
          if (!map[c.mergedPointId]) map[c.mergedPointId] = [];
          map[c.mergedPointId].push(c);
        });
        setConflictMap(map);
      }).catch(() => {});
      addToast(
        "success",
        `归并完成: 新增 ${result.newCount} 条, 匹配 ${result.matchedCount} 条, 冲突 ${result.conflictCount} 条`
      );
    } catch {
      addToast("error", "归并执行失败");
    } finally {
      setMerging(false);
    }
  };

  const pointConflicts = (ptId: string) => conflictMap[ptId] || [];

  if (reviewLoading && mergedPoints.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 skeleton" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-ink">归并与复核</h2>
        <button className="btn-primary flex items-center gap-2" onClick={handleMerge} disabled={merging}>
          <GitMerge className="w-4 h-4" />
          {merging ? "归并中..." : "执行归并"}
        </button>
      </div>

      {mergedPoints.length === 0 ? (
        <div className="card">
          <div className="card-body py-16 text-center text-sm text-gray-500">
            暂无归并数据，请先导入数据并执行归并
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">归并点位列表</h3>
            <span className="text-xs text-gray-500">{mergedPoints.length} 条</span>
          </div>
          <div className="divide-y divide-gray-100">
            {mergedPoints.map((pt) => {
              const expanded = expandedId === pt.id;
              const conflicts = pointConflicts(pt.id);
              return (
                <div key={pt.id}>
                  <div
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expanded ? null : pt.id)}
                  >
                    <span className="text-gray-400">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <span className="font-mono text-sm text-ink w-28 truncate" title={pt.gisId}>{pt.gisId || "—"}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate" title={pt.address}>{pt.address}</span>
                    <span className="text-sm text-gray-600 w-24">{pt.businessType || "—"}</span>
                    <span className="text-sm text-ink font-mono w-20">{pt.area || "—"}</span>
                    <span className="inline-flex items-center justify-center w-7 h-5 rounded-sm bg-ochre-tint text-xs font-medium text-ochre">
                      {pt.sourceCount}
                    </span>
                    <StatusBadge status={pt.conflictStatus} />
                    {conflicts.length > 0 && !conflicts[0].resolution && (
                      <button
                        className="text-xs text-ochre hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/review/${conflicts[0].id}`); }}
                      >
                        查看冲突
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="px-4 pb-3 pl-12">
                      <div className="bg-gray-50 rounded-sm p-3 space-y-2">
                        <div className="text-xs text-gray-500">证据来源</div>
                        <div className="flex flex-wrap gap-2">
                          {pt.sources.length > 0 ? pt.sources.map((src) => (
                            <span key={src.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-sm px-2 py-1">
                              <EvidenceTag sourceType={src.sourceType} />
                              <span className="truncate max-w-[120px]" title={src.fileName}>{src.fileName}</span>
                            </span>
                          )) : <span className="text-xs text-gray-400">暂无证据记录</span>}
                        </div>
                        {pt.originalNotes && (
                          <div className="text-xs text-gray-500 mt-1">原始备注: {pt.originalNotes}</div>
                        )}
                        {conflicts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-gray-500">冲突项 ({conflicts.length})</div>
                            {conflicts.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-xs">
                                <StatusBadge status={c.resolution ? "resolved" : "conflict"} />
                                <span className="text-ink">字段: {c.fieldName}</span>
                                <span className="text-gray-400">GIS: {c.gisValue} | 导入: {c.importedValue}</span>
                                {!c.resolution && (
                                  <button
                                    className="text-ochre hover:underline ml-auto"
                                    onClick={() => navigate(`/review/${c.id}`)}
                                  >
                                    处理
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
