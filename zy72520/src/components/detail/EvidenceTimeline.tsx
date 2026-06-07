import { useState } from 'react';
import { FileText, Ticket, Copy, Cog, CheckSquare, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Evidence, EVIDENCE_TYPE_LABELS } from '../../types';

interface EvidenceTimelineProps {
  evidences: Evidence[];
}

const EvidenceTimeline = ({ evidences }: EvidenceTimelineProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(evidences[0]?.id || null);
  
  const typeConfig = {
    kb_reference: { icon: FileText, color: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
    work_order: { icon: Ticket, color: 'bg-purple-100 text-purple-600', dot: 'bg-purple-500' },
    duplicate_check: { icon: Copy, color: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' },
    system: { icon: Cog, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-500' },
    review: { icon: CheckSquare, color: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  };

  return (
    <div className="card-border">
      <h3 className="text-lg font-serif font-semibold text-primary-800 mb-6">证据回放时间线</h3>
      
      <div className="relative">
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200" />
        
        <div className="space-y-4">
          {evidences.map((evidence, index) => {
            const config = typeConfig[evidence.type];
            const Icon = config.icon;
            const isExpanded = expandedId === evidence.id;
            const isFirst = index === 0;
            
            return (
              <div 
                key={evidence.id} 
                className={`relative pl-14 animate-slide-up ${evidence.isHighlighted ? 'ring-2 ring-amber-200 rounded-xl -mx-2 px-2 py-1' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`absolute left-0 w-11 h-11 rounded-full ${config.color} flex items-center justify-center shadow-md ${isFirst ? 'ring-4 ring-accent-100' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                
                <div 
                  className={`cursor-pointer transition-all duration-300 ${isExpanded ? '' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : evidence.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-primary-800">{evidence.title}</h4>
                        <span className="tag-info">{EVIDENCE_TYPE_LABELS[evidence.type]}</span>
                        {evidence.isHighlighted && (
                          <span className="tag bg-amber-100 text-amber-700">重点关注</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {evidence.timestamp} · {evidence.operator || '系统'}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  
                  {!isExpanded && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-1">{evidence.content}</p>
                  )}
                  
                  {isExpanded && (
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {evidence.content}
                      </p>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                        <span className="text-xs text-gray-500">
                          来源：{evidence.source}
                        </span>
                        {evidence.url && (
                          <a 
                            href={evidence.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            查看原始链接
                          </a>
                        )}
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
  );
};

export default EvidenceTimeline;
