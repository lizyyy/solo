import { useState } from 'react';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import type { TraceNode } from '@/types/carbon';

const TYPE_COLORS: Record<string, string> = {
  source: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  calculation: 'bg-blue-100 text-blue-700 border-blue-300',
  aggregation: 'bg-purple-100 text-purple-700 border-purple-300',
};

const TYPE_LABELS: Record<string, string> = {
  source: '来源',
  calculation: '计算',
  aggregation: '聚合',
};

function TraceTreeNode({ node, depth = 0 }: { node: TraceNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-forest-green-100, #D1E1DB)' }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-cool-gray">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="font-medium text-forest-green">{node.label}</span>
        <span className="text-cool-gray">=</span>
        <span className="font-semibold text-forest-green">
          {typeof node.value === 'number' ? node.value.toLocaleString() : node.value}
        </span>
        <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${TYPE_COLORS[node.type]}`}>
          {TYPE_LABELS[node.type]}
        </span>
      </div>
      {node.sourceFile && (
        <p className="mt-1 pl-7 text-xs text-cool-gray">
          来源: {node.sourceFile}
          {node.timestamp && ` | ${node.timestamp}`}
        </p>
      )}
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children!.map((child) => (
            <TraceTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TracePanel() {
  const { tracePanel, closeTrace } = useCarbonStore();
  const { open, targetType, targetId, data } = tracePanel;

  return (
    <div
      className={`fixed right-0 top-0 z-40 h-screen w-96 transform bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="font-serif text-lg text-forest-green">数据追溯</h3>
          <p className="text-xs text-cool-gray">
            {targetType}/{targetId}
          </p>
        </div>
        <button
          onClick={closeTrace}
          className="rounded-md p-1.5 text-cool-gray transition-colors hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="h-[calc(100vh-65px)] overflow-y-auto p-6">
        {!data ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest-green border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-cool-gray">暂无追溯数据</p>
        ) : (
          <div className="space-y-2">
            {data.map((node) => (
              <TraceTreeNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
