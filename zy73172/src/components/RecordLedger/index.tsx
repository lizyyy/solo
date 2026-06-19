import { useAppStore } from '@/store/useAppStore';
import RecordCard from '@/components/RecordCard';
import { CheckCircle2, FileText, UserCheck } from 'lucide-react';

const buckets = [
  {
    key: 'processed' as const,
    title: '已处理记录',
    icon: CheckCircle2,
    color: 'text-ink-700',
    bgAccent: 'bg-ink-100',
    borderColor: 'border-ink-200',
  },
  {
    key: 'pending' as const,
    title: '待补材料',
    icon: FileText,
    color: 'text-ochre-700',
    bgAccent: 'bg-ochre-100',
    borderColor: 'border-ochre-200',
  },
  {
    key: 'manual' as const,
    title: '人工改判',
    icon: UserCheck,
    color: 'text-ink-600',
    bgAccent: 'bg-paper-200',
    borderColor: 'border-paper-300',
  },
];

export default function RecordLedger() {
  const { records, selectedNodeId, graph } = useAppStore();

  const filterByNode = (list: typeof records.processed) => {
    if (!selectedNodeId) return list;
    return list.filter((r) => r.nodeId === selectedNodeId);
  };

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="paper-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink-800">
            错题记录台账
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {selectedNode ? (
              <>
                当前筛选：
                <span className="text-ink-700 font-medium">{selectedNode.name}</span>
                <span className="text-ink-400 ml-1">（点击路径图其他节点切换，或点击空白处取消）</span>
              </>
            ) : (
              '展示全部记录，点击路径图节点可筛选'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {buckets.map((bucket) => {
          const Icon = bucket.icon;
          const list = filterByNode(records[bucket.key]);
          const totalCount = records[bucket.key].length;
          const shownCount = list.length;

          return (
            <div
              key={bucket.key}
              className={`rounded-lg border ${bucket.borderColor} bg-white/40 flex flex-col max-h-[420px]`}
            >
              <div className={`px-4 py-3 border-b ${bucket.borderColor} ${bucket.bgAccent}/50 rounded-t-lg`}>
                <div className="flex items-center gap-2">
                  <Icon size={16} className={bucket.color} />
                  <h3 className={`font-semibold text-sm ${bucket.color}`}>
                    {bucket.title}
                  </h3>
                  <span className="ml-auto text-xs px-2 py-0.5 bg-white/70 rounded-full text-ink-600 font-medium">
                    {selectedNode ? `${shownCount} / ${totalCount}` : totalCount}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2.5">
                {list.length === 0 ? (
                  <div className="text-center py-8 text-ink-400 text-sm">
                    <p>暂无记录</p>
                    {selectedNode && (
                      <p className="text-xs mt-1 text-ink-300">
                        该节点下无{bucket.title.slice(0, -2)}记录
                      </p>
                    )}
                  </div>
                ) : (
                  list.map((record, idx) => (
                    <RecordCard key={record.id} record={record} delay={idx * 50} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
