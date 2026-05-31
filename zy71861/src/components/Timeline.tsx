import { useState } from 'react';
import { TimelineNode } from '@/types';
import { 
  FileText, 
  Image, 
  Edit3, 
  MessageSquare, 
  CheckCircle2,
  User,
  Clock,
  Eye
} from 'lucide-react';
import ImageViewer from './ImageViewer';

interface TimelineProps {
  nodes: TimelineNode[];
}

const Timeline = ({ nodes }: TimelineProps) => {
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const getNodeIcon = (type: TimelineNode['type']) => {
    const icons = {
      mistake_created: FileText,
      snapshot_attached: Image,
      correction_made: Edit3,
      commentary_added: MessageSquare,
      conclusion_reached: CheckCircle2
    };
    return icons[type];
  };

  const getNodeColor = (type: TimelineNode['type']) => {
    const colors = {
      mistake_created: 'bg-blue-500',
      snapshot_attached: 'bg-green-500',
      correction_made: 'bg-amber-500',
      commentary_added: 'bg-purple-500',
      conclusion_reached: 'bg-primary-600'
    };
    return colors[type];
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-primary-200" />
      
      <div className="space-y-6">
        {nodes.map((node, index) => {
          const Icon = getNodeIcon(node.type);
          const isExpanded = expandedNodes.has(node.id);
          const hasEvidence = node.evidenceRefs.length > 0;
          
          return (
            <div 
              key={node.id} 
              className={`relative pl-16 animate-slide-in stagger-${Math.min(index + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <div className={`absolute left-4 w-5 h-5 rounded-full ${getNodeColor(node.type)} border-4 border-white shadow-md transform -translate-x-1/2 z-10 flex items-center justify-center`}>
                <Icon className="w-2.5 h-2.5 text-white" />
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-primary-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleNode(node.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-primary-800">{node.title}</h4>
                        {hasEvidence && (
                          <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
                            {node.evidenceRefs.length} 个证据
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-primary-600">{node.description}</p>
                      <div className="mt-3 flex items-center space-x-4 text-xs text-primary-500">
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{node.operator}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(node.timestamp)}</span>
                        </span>
                      </div>
                    </div>
                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {isExpanded && hasEvidence && (
                  <div className="border-t border-primary-100 p-4 bg-primary-50">
                    <h5 className="text-sm font-medium text-primary-700 mb-3">相关证据</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {node.evidenceRefs.map((ref, refIndex) => (
                        <div 
                          key={refIndex}
                          className="bg-white rounded-lg p-3 border border-primary-100 flex items-center space-x-3"
                        >
                          {ref.type === 'image' && ref.url && (
                            <>
                              <img 
                                src={ref.url} 
                                alt="" 
                                className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewerImage({ src: ref.url!, alt: node.title });
                                }}
                              />
                              <button
                                className="text-sm text-primary-600 hover:text-primary-800 flex items-center space-x-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewerImage({ src: ref.url!, alt: node.title });
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                <span>查看大图</span>
                              </button>
                            </>
                          )}
                          {ref.type === 'text' && (
                            <>
                              <MessageSquare className="w-8 h-8 text-purple-500 flex-shrink-0" />
                              <span className="text-sm text-primary-600">讲评稿内容</span>
                            </>
                          )}
                          {ref.type === 'record' && (
                            <>
                              <Edit3 className="w-8 h-8 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-primary-600">人工更正记录</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.alt}
          isOpen={true}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
};

export default Timeline;
