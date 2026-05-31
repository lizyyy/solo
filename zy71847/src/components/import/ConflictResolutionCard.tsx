import React from 'react';
import { ImportConflict, SuggestedAction } from '@/types';
import { generateHumanMessage } from '@/utils/humanMessageGenerator';
import { HumanMessageCard } from '@/components/common/HumanMessageCard';
import { Check, X, Merge, ArrowRight, RotateCcw, SkipForward } from 'lucide-react';

interface ConflictResolutionCardProps {
  conflict: ImportConflict;
  index: number;
  onResolve: (index: number, action: SuggestedAction) => void;
}

const actionIcons: Record<SuggestedAction, React.ReactNode> = {
  keep: <Check className="w-3.5 h-3.5" />,
  overwrite: <ArrowRight className="w-3.5 h-3.5" />,
  merge: <Merge className="w-3.5 h-3.5" />,
  skip: <SkipForward className="w-3.5 h-3.5" />,
};

const actionLabels: Record<SuggestedAction, string> = {
  keep: '保留现有',
  overwrite: '覆盖更新',
  merge: '合并信息',
  skip: '跳过',
};

export const ConflictResolutionCard: React.FC<ConflictResolutionCardProps> = ({ conflict, index, onResolve }) => {
  const message = generateHumanMessage(conflict);

  const handleAction = (action: SuggestedAction) => {
    if (action === 'keep' && conflict.conflictType === 'coordinate_flipped') {
      onResolve(index, 'fix_flipped' as SuggestedAction);
    } else {
      onResolve(index, action);
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      conflict.resolved 
        ? 'border-gray-200 bg-gray-50 opacity-75' 
        : 'border-gray-200 bg-white'
    }`}>
      {conflict.resolved && (
        <div className="bg-signal-green/10 px-4 py-2 flex items-center gap-2 text-xs text-signal-green">
          <Check className="w-4 h-4" />
          已处理：{conflict.resolution && actionLabels[conflict.resolution]}
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-industrial-800 text-white text-xs font-mono rounded">
            #{index + 1}
          </span>
          {conflict.conflictType === 'duplicate' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
              重复记录
            </span>
          )}
          {conflict.conflictType === 'coordinate_flipped' && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              坐标翻转
            </span>
          )}
          {conflict.conflictType === 'invalid_data' && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
              数据不完整
            </span>
          )}
        </div>

        <HumanMessageCard 
          message={message} 
          sourceType={conflict.sourceInfo?.type}
          onAction={(action) => {
            const actionMap: Record<string, SuggestedAction> = {
              'skip': 'skip',
              'overwrite': 'overwrite',
              'merge': 'merge',
              'keep': 'keep',
              'fix_flipped': 'keep',
            };
            if (actionMap[action]) {
              handleAction(actionMap[action]);
            }
          }}
        />

        {conflict.existingRecord && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">现有记录</p>
              <p className="text-sm font-mono text-gray-800">{conflict.existingRecord.cableNo}</p>
              <p className="text-xs text-gray-500 mt-1">
                起点: ({conflict.existingRecord.startPoint.x}, {conflict.existingRecord.startPoint.y})
              </p>
              <p className="text-xs text-gray-500">
                终点: ({conflict.existingRecord.endPoint.x}, {conflict.existingRecord.endPoint.y})
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(conflict.existingRecord.updatedAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-medium text-blue-600 mb-2">新导入数据</p>
              <p className="text-sm font-mono text-gray-800">{conflict.incomingData.cableNo}</p>
              <p className="text-xs text-gray-500 mt-1">
                起点: ({conflict.incomingData.startPoint?.x}, {conflict.incomingData.startPoint?.y})
              </p>
              <p className="text-xs text-gray-500">
                终点: ({conflict.incomingData.endPoint?.x}, {conflict.incomingData.endPoint?.y})
              </p>
              {conflict.sourceInfo && (
                <p className="text-xs text-blue-500 mt-1">
                  来自: {conflict.sourceInfo.uploader}
                </p>
              )}
            </div>
          </div>
        )}

        {!conflict.resolved && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(['skip', 'keep', 'overwrite', 'merge'] as SuggestedAction[]).map(action => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-all ${
                  action === 'skip'
                    ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    : action === 'overwrite'
                    ? 'bg-signal-blue text-white border-signal-blue hover:bg-blue-600'
                    : action === 'merge'
                    ? 'bg-signal-orange text-white border-signal-orange hover:bg-orange-600'
                    : 'bg-signal-green text-white border-signal-green hover:bg-green-600'
                }`}
              >
                {actionIcons[action]}
                {actionLabels[action]}
                {action === 'keep' && conflict.conflictType === 'coordinate_flipped' && '（自动修正）'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
