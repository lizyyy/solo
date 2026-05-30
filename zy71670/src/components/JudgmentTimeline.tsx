import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Calculator, Layers, AlertTriangle, History } from 'lucide-react';
import { JudgmentDetail, DETAIL_CATEGORY_LABELS } from '../types';
import { formatDate } from '../utils/tension';

interface JudgmentTimelineProps {
  details: JudgmentDetail[];
}

export const JudgmentTimeline: React.FC<JudgmentTimelineProps> = ({ details }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(details.map((d) => d.id)));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tension_calc':
        return <Calculator size={16} />;
      case 'spec_match':
        return <Layers size={16} />;
      case 'risk_assess':
        return <AlertTriangle size={16} />;
      case 'repair_history':
        return <History size={16} />;
      default:
        return <Calculator size={16} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tension_calc':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'spec_match':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'risk_assess':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'repair_history':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const sortedDetails = [...details].sort((a, b) => a.version - b.version);

  return (
    <div className="space-y-2">
      {sortedDetails.map((detail, index) => (
        <div
          key={detail.id}
          className="border rounded-lg overflow-hidden animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <button
            onClick={() => toggleExpand(detail.id)}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
          >
            <span className={`p-1.5 rounded ${getCategoryColor(detail.category)}`}>
              {getCategoryIcon(detail.category)}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-800">
                  {DETAIL_CATEGORY_LABELS[detail.category]}
                </span>
                <span className="text-xs text-gray-400">v{detail.version}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{detail.reason}</p>
            </div>
            <span className="text-xs text-gray-400">
              {formatDate(detail.createdAt)}
            </span>
            {expandedIds.has(detail.id) ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </button>
          
          {expandedIds.has(detail.id) && (
            <div className="px-3 pb-3 pl-12">
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div className="mb-2">
                  <span className="text-xs text-gray-500">判断理由：</span>
                  <p className="text-gray-700 mt-1">{detail.reason}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">证据/数据：</span>
                  <p className="text-gray-600 mt-1 font-mono text-xs bg-white p-2 rounded border">
                    {detail.evidence}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      
      {details.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          暂无判断明细
        </div>
      )}
    </div>
  );
};
