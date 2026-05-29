import { MapPin, Clock, User, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import type { TransportNode } from '../../shared/types';
import { TransportStatusBadge } from './StatusBadge';
import { NODE_TYPE_LABELS } from '../../shared/types';
import { cn } from '../lib/utils';

interface TransportTimelineProps {
  nodes: TransportNode[];
}

export function TransportTimeline({ nodes }: TransportTimelineProps) {
  const sortedNodes = [...nodes].sort((a, b) => {
    const order: Record<string, number> = { origin: 0, transit: 1, destination: 2 };
    return order[a.nodeType] - order[b.nodeType];
  });

  const getNodeIcon = (status: TransportNode['status']) => {
    switch (status) {
      case 'delivered':
      case 'arrived':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'in_transit':
        return <ArrowRight className="w-5 h-5" />;
      default:
        return <Circle className="w-5 h-5" />;
    }
  };

  const getNodeStyle = (status: TransportNode['status']) => {
    switch (status) {
      case 'delivered':
      case 'arrived':
        return 'bg-emerald-500 text-white border-emerald-500';
      case 'in_transit':
        return 'bg-blue-500 text-white border-blue-500';
      default:
        return 'bg-white text-stone-400 border-stone-300';
    }
  };

  const isCompleted = (index: number) => {
    const current = sortedNodes[index];
    return current.status === 'delivered' || current.status === 'arrived';
  };

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8">
        <MapPin className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500">暂无运输节点信息</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {sortedNodes.length > 1 && (
        <div className="absolute top-8 left-6 right-6 h-0.5 bg-stone-200">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
            style={{
            width: `${(sortedNodes.filter(n => n.status !== 'pending').length / (sortedNodes.length - 1)) * 100}%`,
          }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {sortedNodes.map((node, index) => (
          <div key={node.id} className="relative">
            <div
              className={cn(
              'bg-white rounded-xl border p-4 transition-all duration-300',
              node.status === 'pending'
                ? 'border-stone-200 opacity-60'
                : 'border-stone-200 hover:border-slate-300 hover:shadow-md'
            )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                  'p-2 rounded-full border-2 transition-all',
                  getNodeStyle(node.status)
                )}
                >
                  {getNodeIcon(node.status)}
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">
                    {NODE_TYPE_LABELS[node.nodeType]}
                  </div>
                  <div className="font-bold text-stone-900">{node.location}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-stone-600">
                  <TransportStatusBadge status={node.status} />
                </div>
                {node.handler && (
                  <div className="flex items-center gap-2 text-stone-500">
                    <User className="w-4 h-4" />
                    <span>{node.handler}</span>
                  </div>
                )}
                {node.timestamp && (
                  <div className="flex items-center gap-2 text-stone-500">
                    <Clock className="w-4 h-4" />
                    <span>
                      {new Date(node.timestamp).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    </span>
                  </div>
                )}
                {node.remarks && (
                  <p className="text-stone-500 text-xs pt-2 border-t border-stone-100">
                    {node.remarks}
                  </p>
                )}
              </div>
            </div>

            {index < sortedNodes.length - 1 && (
              <div
                className={cn(
                'hidden md:flex absolute top-8 -right-2 z-10 w-4 h-4 rounded-full items-center justify-center',
                isCompleted(index) ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'
              )}
              >
                {isCompleted(index) ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
