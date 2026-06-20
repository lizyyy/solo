import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GitCompare, ArrowRight } from 'lucide-react';
import type { MaterialVersion } from '@/types';
import { Button } from '@/components/common/Button';
import { diffWords } from '@/utils/diff';
import { shortHash } from '@/utils/hash';

interface DiffViewerProps {
  materialName: string;
  versions: MaterialVersion[];
  fromVersion: number;
  toVersion: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  materialName,
  versions,
  fromVersion,
  toVersion,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showFullText, setShowFullText] = useState(false);

  const fromData = versions.find((v) => v.version === fromVersion);
  const toData = versions.find((v) => v.version === toVersion);

  if (!fromData || !toData) return null;

  const diffResult = diffWords(fromData.content, toData.content);
  const changeRate = ((toData.content.length - fromData.content.length) / fromData.content.length) * 100;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#1a202c] border border-[#4a5568] rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#2d3748]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-[#dd6b20]" />
          <div>
            <div className="font-mono text-sm text-[#e2e8f0]">
              {materialName} 版本差异
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#718096]">
              <span className="text-[#fc8181]">v{fromVersion}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-[#68d391]">v{toVersion}</span>
              <span className="mx-1">·</span>
              <span className={changeRate > 10 ? 'text-[#dd6b20]' : 'text-[#a0aec0]'}>
                变更率: {changeRate > 0 ? '+' : ''}{changeRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullText(!showFullText);
            }}
          >
            {showFullText ? '隐藏全文' : '查看全文'}
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#718096]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#718096]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#4a5568]">
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#c53030]/10 border border-[#c53030]/30 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-[#fc8181]">版本 v{fromVersion}</span>
                  <span className="text-xs font-mono text-[#718096]">
                    #{shortHash(fromData.contentHash, 6)}
                  </span>
                </div>
                <div className="text-xs text-[#718096]">
                  {formatDate(fromData.timestamp)} · {fromData.createdBy}
                </div>
              </div>
              <div className="p-3 bg-[#38a169]/10 border border-[#38a169]/30 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-[#68d391]">版本 v{toVersion}</span>
                  <span className="text-xs font-mono text-[#718096]">
                    #{shortHash(toData.contentHash, 6)}
                  </span>
                </div>
                <div className="text-xs text-[#718096]">
                  {formatDate(toData.timestamp)} · {toData.createdBy}
                </div>
              </div>
            </div>

            {showFullText && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-[#718096] mb-2">原文 v{fromVersion}</div>
                  <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-xs font-mono text-[#a0aec0] max-h-48 overflow-auto whitespace-pre-wrap">
                    {fromData.content}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-mono text-[#718096] mb-2">新文 v{toVersion}</div>
                  <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-xs font-mono text-[#a0aec0] max-h-48 overflow-auto whitespace-pre-wrap">
                    {toData.content}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-mono text-[#718096] mb-2">词级差异</div>
              <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono max-h-64 overflow-auto">
                {diffResult.map((part, index) => (
                  <span
                    key={index}
                    className={
                      part.added
                        ? 'bg-[#38a169]/30 text-[#68d391] px-0.5 rounded'
                        : part.removed
                        ? 'bg-[#c53030]/30 text-[#fc8181] line-through px-0.5 rounded'
                        : 'text-[#a0aec0]'
                    }
                  >
                    {part.value}
                  </span>
                ))}
              </div>
            </div>

            {toData.changeDescription && (
              <div className="p-3 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded">
                <div className="text-xs font-mono text-[#dd6b20] mb-1">口径变更说明</div>
                <p className="text-sm text-[#a0aec0]">{toData.changeDescription}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
