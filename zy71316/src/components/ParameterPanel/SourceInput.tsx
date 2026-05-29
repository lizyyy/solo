import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { SourceInfo } from '../../types';

interface SourceInputProps {
  paramName: string;
  sourceInfo: SourceInfo;
  onSourceChange: (sourceInfo: Partial<SourceInfo>) => void;
}

export const SourceInput: React.FC<SourceInputProps> = ({
  paramName,
  sourceInfo,
  onSourceChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <FileText size={12} />
        <span>来源材料</span>
        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700 space-y-2 animate-fadeIn">
          <div>
            <label className="block text-xs text-gray-400 mb-1">文档名称</label>
            <input
              type="text"
              value={sourceInfo.documentName}
              onChange={(e) => onSourceChange({ documentName: e.target.value })}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-cyan-500 focus:outline-none"
              placeholder="输入文档名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">版本</label>
              <input
                type="text"
                value={sourceInfo.documentVersion}
                onChange={(e) => onSourceChange({ documentVersion: e.target.value })}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-cyan-500 focus:outline-none"
                placeholder="v1.0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">提供方</label>
              <input
                type="text"
                value={sourceInfo.provider}
                onChange={(e) => onSourceChange({ provider: e.target.value })}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-cyan-500 focus:outline-none"
                placeholder="提供方名称"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">备注</label>
            <input
              type="text"
              value={sourceInfo.remarks}
              onChange={(e) => onSourceChange({ remarks: e.target.value })}
              className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-cyan-500 focus:outline-none"
              placeholder="备注信息"
            />
          </div>
        </div>
      )}
    </div>
  );
};
