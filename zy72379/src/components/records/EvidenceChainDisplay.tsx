import React from 'react';
import { Link as LinkIcon, FileText, Camera, Edit3, Check, Wrench, AlertTriangle, Clock } from 'lucide-react';
import type { EvidenceChainNode } from '@/types';
import { Timeline } from '@/components/common/Timeline';

interface EvidenceChainDisplayProps {
  chain: EvidenceChainNode[];
  className?: string;
}

const getStepIcon = (node: EvidenceChainNode) => {
  switch (node.operationType) {
    case 'import_photo':
      return <Camera className="w-4 h-4" />;
    case 'review_note':
      return <Edit3 className="w-4 h-4" />;
    case 'unit_conversion':
      return <FileText className="w-4 h-4" />;
    case 'data_cleaning':
      return <AlertTriangle className="w-4 h-4" />;
    case 'conflict_resolution':
      return <Check className="w-4 h-4" />;
    case 'threshold_review':
      return <Wrench className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getStepStatusColor = (node: EvidenceChainNode) => {
  switch (node.operationType) {
    case 'import_photo':
      return 'bg-primary-500';
    case 'review_note':
      return 'bg-success-500';
    case 'unit_conversion':
      return 'bg-info-500';
    case 'data_cleaning':
      return 'bg-warning-500';
    case 'conflict_resolution':
      return 'bg-danger-500';
    case 'threshold_review':
      return 'bg-primary-500';
    default:
      return 'bg-neutral-500';
  }
};

export const EvidenceChainDisplay: React.FC<EvidenceChainDisplayProps> = ({ chain, className = '' }) => {
  const timelineItems = chain.map(node => ({
    id: node.id,
    title: node.description,
    time: node.operateTime,
    icon: getStepIcon(node),
    color: getStepStatusColor(node),
    operator: node.operator,
    evidenceRefs: node.evidenceRefs,
  }));

  return (
    <div className={`bg-white border border-neutral-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <LinkIcon className="w-5 h-5 text-primary-600" />
        <h3 className="font-bold text-lg text-neutral-900">证据链追踪</h3>
      </div>
      <div className="text-sm text-neutral-600 mb-4">
        共 {chain.length} 个操作节点，点击可查看关联的证据文件
      </div>
      <Timeline items={timelineItems} />
    </div>
  );
};
