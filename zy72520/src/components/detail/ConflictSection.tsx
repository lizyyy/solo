import { useState } from 'react';
import { AlertTriangle, Check, X, FileText, Ticket } from 'lucide-react';
import { Conflict, ConflictResolution } from '../../types';
import { useReviewStore } from '../../store/useReviewStore';

interface ConflictSectionProps {
  conflicts: Conflict[];
  recordId: string;
}

const ConflictSection = ({ conflicts, recordId }: ConflictSectionProps) => {
  const resolveConflict = useReviewStore(state => state.resolveConflict);
  const [selectedResolution, setSelectedResolution] = useState<Record<string, ConflictResolution>>({});

  if (!conflicts || conflicts.length === 0) return null;

  const handleResolve = (conflictId: string, resolution: ConflictResolution) => {
    setSelectedResolution(prev => ({ ...prev, [conflictId]: resolution }));
    resolveConflict(recordId, conflictId, resolution, '周姐');
  };

  return (
    <div className="card-border border-red-200 bg-red-50/30 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-serif font-semibold text-red-800">冲突证据对比</h3>
          <p className="text-sm text-red-600">知识库引用与线上工单存在矛盾，请标注负责人选择确认</p>
        </div>
      </div>
      
      {conflicts.map((conflict) => {
        const currentResolution = conflict.resolution || selectedResolution[conflict.id];
        
        return (
          <div key={conflict.id} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border-2 transition-all ${
                currentResolution === 'confirm_kb' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-primary-800">知识库引用</span>
                  {currentResolution === 'confirm_kb' && (
                    <span className="tag-success ml-auto">已确认</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{conflict.kbContent}</p>
              </div>
              
              <div className={`p-4 rounded-lg border-2 transition-all ${
                currentResolution === 'confirm_work_order' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                  <Ticket className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-primary-800">线上工单（补录）</span>
                  {currentResolution === 'confirm_work_order' && (
                    <span className="tag-success ml-auto">已确认</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{conflict.workOrderContent}</p>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                矛盾点（{conflict.conflictingPoints.length}处）
              </h4>
              <ul className="space-y-1">
                {conflict.conflictingPoints.map((point, idx) => (
                  <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            
            {!currentResolution ? (
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  请作为标注负责人选择处理方式（系统不自动拍板）：
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleResolve(conflict.id, 'confirm_kb')}
                    className="btn-outline text-sm"
                  >
                    <Check className="w-4 h-4 mr-2 inline" />
                    确认知识库口径
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'confirm_work_order')}
                    className="btn-outline text-sm"
                  >
                    <Check className="w-4 h-4 mr-2 inline" />
                    确认工单口径
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'reject_both')}
                    className="btn-danger text-sm"
                  >
                    <X className="w-4 h-4 mr-2 inline" />
                    驳回两方，重新核实
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <strong>已处理：</strong>
                  {currentResolution === 'confirm_kb' && '已确认知识库口径为最终结果'}
                  {currentResolution === 'confirm_work_order' && '已确认工单口径为最终结果'}
                  {currentResolution === 'reject_both' && '已驳回两方，需重新核实'}
                  {conflict.resolvedBy && ` · 处理人：${conflict.resolvedBy}`}
                  {conflict.resolvedAt && ` · ${conflict.resolvedAt}`}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConflictSection;
