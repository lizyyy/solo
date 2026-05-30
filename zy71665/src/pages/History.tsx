import { useState } from 'react';
import { useFiberStore } from '@/store';
import { Clock, Undo2, ChevronDown, ChevronRight, ArrowLeftRight } from 'lucide-react';

export default function History() {
  const history = useFiberStore((s) => s.history);
  const undoTo = useFiberStore((s) => s.undoTo);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

  const actionLabels: Record<string, string> = {
    calculate: '计算',
    modify: '修改',
    supplement: '补录',
    undo: '撤回',
    delete: '删除',
  };

  const actionColors: Record<string, string> = {
    calculate: 'bg-blue-100 text-blue-800',
    modify: 'bg-amber-100 text-amber-800',
    supplement: 'bg-emerald-100 text-emerald-800',
    undo: 'bg-purple-100 text-purple-800',
    delete: 'bg-red-100 text-red-800',
  };

  const parseSnapshot = (snap: string) => {
    try {
      return JSON.parse(snap) as { id: string; len: number; pin: number; pout: number }[];
    } catch {
      return [];
    }
  };

  const getDiff = (beforeId: string, afterId: string) => {
    const beforeEntry = history.find((h) => h.id === beforeId);
    const afterEntry = history.find((h) => h.id === afterId);
    if (!beforeEntry || !afterEntry) return null;

    const beforeData = parseSnapshot(beforeEntry.beforeSnapshot);
    const afterData = parseSnapshot(afterEntry.afterSnapshot);

    const beforeMap = new Map(beforeData.map((d) => [d.id, d]));
    const afterMap = new Map(afterData.map((d) => [d.id, d]));

    const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const diff: { id: string; type: 'added' | 'removed' | 'modified'; before?: typeof beforeData[0]; after?: typeof afterData[0]; changes: string[] }[] = [];

    for (const id of allIds) {
      const b = beforeMap.get(id);
      const a = afterMap.get(id);
      if (!b && a) {
        diff.push({ id, type: 'added', after: a, changes: [] });
      } else if (b && !a) {
        diff.push({ id, type: 'removed', before: b, changes: [] });
      } else if (b && a) {
        const changes: string[] = [];
        if (b.len !== a.len) changes.push(`长度: ${b.len} → ${a.len}`);
        if (b.pin !== a.pin) changes.push(`输入功率: ${b.pin} → ${a.pin}`);
        if (b.pout !== a.pout) changes.push(`输出功率: ${b.pout} → ${a.pout}`);
        if (changes.length > 0) {
          diff.push({ id, type: 'modified', before: b, after: a, changes });
        }
      }
    }
    return diff;
  };

  const compareDiff = compareIds ? getDiff(compareIds[0], compareIds[1]) : null;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-[#1B2A4A]">历史时间轴</h2>
        <p className="text-sm text-gray-500 mt-0.5">查看操作记录，对比前后变化，支持撤回与补录</p>
      </div>

      {history.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>暂无操作记录</p>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-0">
              {[...history].reverse().map((entry, idx) => {
                const isExpanded = expandedId === entry.id;
                const isSelected = compareIds && (compareIds[0] === entry.id || compareIds[1] === entry.id);

                return (
                  <div key={entry.id} className="relative pl-12 pb-4">
                    <div
                      className={`absolute left-3.5 w-3.5 h-3.5 rounded-full border-2 ${
                        isSelected ? 'bg-[#E8A838] border-[#E8A838]' : 'bg-white border-gray-300'
                      } z-10`}
                    />
                    <div
                      className={`bg-white rounded-lg border transition-all ${
                        isSelected ? 'border-[#E8A838] shadow-md' : 'border-gray-200 shadow-sm'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionColors[entry.action]}`}>
                          {actionLabels[entry.action]}
                        </span>
                        <span className="text-sm text-gray-700 flex-1">{entry.summary}</span>
                        <span
                          className="text-xs text-gray-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {entry.timestamp.slice(0, 19).replace('T', ' ')}
                        </span>
                        {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-3 border-t border-gray-100 space-y-2">
                          <div className="pt-2 text-xs text-gray-500">
                            <div className="font-medium text-gray-600 mb-1">变更摘要</div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-gray-400">变更前：</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                    {entry.beforeSnapshot.slice(0, 80)}...
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">变更后：</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                                    {entry.afterSnapshot.slice(0, 80)}...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                undoTo(entry.id);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-700 hover:bg-purple-100 transition-colors"
                            >
                              <Undo2 size={12} />
                              撤回到此节点
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!compareIds) {
                                  setCompareIds([entry.id, '']);
                                } else if (compareIds[1] === '') {
                                  setCompareIds([compareIds[0], entry.id]);
                                } else {
                                  setCompareIds([entry.id, '']);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <ArrowLeftRight size={12} />
                              对比
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {compareIds && compareIds[1] !== '' && compareDiff ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1B2A4A]">前后对比</h3>
                <button
                  onClick={() => setCompareIds(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  关闭
                </button>
              </div>
              <div className="p-4 space-y-2">
                {compareDiff.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-4">无差异</div>
                )}
                {compareDiff.map((d) => (
                  <div
                    key={d.id}
                    className={`rounded-lg px-3 py-2 text-xs border ${
                      d.type === 'added'
                        ? 'bg-emerald-50 border-emerald-200'
                        : d.type === 'removed'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          d.type === 'added'
                            ? 'bg-emerald-200 text-emerald-800'
                            : d.type === 'removed'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-amber-200 text-amber-800'
                        }`}
                      >
                        {d.type === 'added' ? '新增' : d.type === 'removed' ? '删除' : '修改'}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{d.id.slice(0, 8)}</span>
                    </div>
                    {d.changes.map((c, i) => (
                      <div key={i} className="text-amber-700 ml-4">
                        {c}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : compareIds && compareIds[1] === '' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 sticky top-6">
              请点击第二条记录的"对比"按钮完成对比选择
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 sticky top-6">
              <ArrowLeftRight size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">点击记录的"对比"按钮选择两条记录进行前后差异对比</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
