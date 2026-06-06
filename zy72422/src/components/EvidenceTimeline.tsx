import { Upload, FileText, Tags, RefreshCw, CheckCircle, XCircle, Wrench, RotateCcw, User } from 'lucide-react';
import type { EvidenceNode, EvidenceType } from '../types';

interface EvidenceTimelineProps {
  evidence: EvidenceNode[];
}

const typeConfig: Record<EvidenceType, { icon: typeof Upload; color: string; bgColor: string }> = {
  import: { icon: Upload, color: 'text-accent-info', bgColor: 'bg-accent-infoLight' },
  parse: { icon: FileText, color: 'text-primary-600', bgColor: 'bg-primary-100' },
  alias_update: { icon: Tags, color: 'text-accent-gold', bgColor: 'bg-accent-goldLight' },
  rehearsal_update: { icon: RefreshCw, color: 'text-accent-success', bgColor: 'bg-accent-successLight' },
  review: { icon: CheckCircle, color: 'text-accent-warning', bgColor: 'bg-accent-warningLight' },
  complete: { icon: CheckCircle, color: 'text-accent-success', bgColor: 'bg-accent-successLight' },
  manual_fix: { icon: Wrench, color: 'text-accent-rework', bgColor: 'bg-accent-reworkLight' },
  rerun: { icon: RotateCcw, color: 'text-primary-600', bgColor: 'bg-primary-100' },
};

export default function EvidenceTimeline({ evidence }: EvidenceTimelineProps) {
  return (
    <div className="space-y-1">
      {evidence.map((node, index) => {
        const config = typeConfig[node.type];
        const Icon = config.icon;
        return (
          <div key={node.id} className="timeline-dot relative pl-8 pb-5 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className={`absolute left-0 top-0 w-4 h-4 rounded-full ${config.bgColor} ${config.color} flex items-center justify-center`}>
              <Icon className="w-2.5 h-2.5" />
            </div>
            <div className="bg-white rounded-lg p-3 border border-primary-100 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-primary-800 text-sm">{node.title}</h4>
                  <p className="text-xs text-primary-500 mt-1">{node.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-primary-400">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {node.operator}
                </span>
                <span>{node.timestamp}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
