import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Users, Percent, Tag, Receipt, ClipboardCheck } from 'lucide-react';
import type { AuditLinkNode, NodeType, NodeStatus } from '../../../shared/types';

interface AuditTimelineProps {
  nodes: AuditLinkNode[];
}

const nodeIcons: Record<NodeType, React.ReactNode> = {
  contract: <FileText className="w-4 h-4" />,
  share: <Users className="w-4 h-4" />,
  rate: <Percent className="w-4 h-4" />,
  promotion: <Tag className="w-4 h-4" />,
  charge: <Receipt className="w-4 h-4" />,
  audit: <ClipboardCheck className="w-4 h-4" />,
};

const nodeLabels: Record<NodeType, string> = {
  contract: '产品合同',
  share: '客户份额',
  rate: '费率版本',
  promotion: '优惠期',
  charge: '扣费流水',
  audit: '审计结论',
};

const statusClass: Record<NodeStatus, string> = {
  ok: 'timeline-node-ok',
  warning: 'timeline-node-warning',
  error: 'timeline-node-error',
};

const statusBgClass: Record<NodeStatus, string> = {
  ok: 'bg-emerald-900/20 border-emerald-700/50',
  warning: 'bg-amber-900/20 border-amber-700/50',
  error: 'bg-red-900/20 border-red-700/50',
};

export function AuditTimeline({ nodes }: AuditTimelineProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  const toggleNode = (index: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0">
      {nodes.map((node, index) => {
        const isExpanded = expandedNodes.has(index);
        return (
          <div
            key={index}
            className={`timeline-node ${statusClass[node.status]}`}
          >
            <div
              className="cursor-pointer group"
              onClick={() => toggleNode(index)}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`p-1.5 rounded-md ${statusBgClass[node.status]}`}
                  >
                    {nodeIcons[node.type]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {nodeLabels[node.type]}
                      </span>
                      <span className="text-xs text-dark-muted">
                        点击展开详情
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-dark-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-dark-muted" />
                      )}
                    </div>
                    <p
                      className={`text-sm mt-1 ${
                        node.status === 'error'
                          ? 'text-red-400'
                          : node.status === 'warning'
                            ? 'text-amber-400'
                            : 'text-dark-text'
                      }`}
                    >
                      {node.message}
                    </p>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 ml-10 p-4 bg-dark-bg/50 rounded-lg border border-dark-border animate-fade-in">
                  <p className="text-xs text-dark-muted mb-2 font-mono">数据详情</p>
                  <pre className="text-xs text-dark-text overflow-x-auto scrollbar-thin max-h-60">
                    {JSON.stringify(node.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
