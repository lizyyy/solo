
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, User, Settings } from 'lucide-react';
import { Evidence } from '../types';
import { getEvidenceTypeLabel, getEvidenceTypeColor, highlightText } from '../utils';

interface EvidenceCardProps {
  evidence: Evidence;
}

const iconMap = {
  model_output: FileText,
  manual_label: User,
  threshold_config: Settings,
};

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = iconMap[evidence.type];

  return (
    <div
      className={`border-l-4 ${getEvidenceTypeColor(evidence.type)} rounded-lg shadow-sm transition-all duration-200`}
    >
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-md shadow-sm">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <span className="font-medium text-gray-800">{getEvidenceTypeLabel(evidence.type)}</span>
            <p className="text-xs text-gray-500 mt-0.5">点击查看详细证据</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {highlightText(evidence.content, evidence.highlight)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
