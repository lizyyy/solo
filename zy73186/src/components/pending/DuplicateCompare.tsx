import React, { useState, useEffect } from 'react';
import { ArrowRight, Copy, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { diffWords } from '@/utils/diff';
import { shortHash } from '@/utils/hash';
import { persistenceService } from '@/services/persistence';

interface DuplicateCompareProps {
  newSampleHash: string;
  existingSampleHash: string;
  similarity: number;
  onClose: () => void;
}

export const DuplicateCompare: React.FC<DuplicateCompareProps> = ({
  newSampleHash,
  existingSampleHash,
  similarity,
  onClose,
}) => {
  const [newContent, setNewContent] = useState<string>('');
  const [existingContent, setExistingContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showDiff, setShowDiff] = useState(true);

  useEffect(() => {
    const loadContents = async () => {
      setLoading(true);
      try {
        const allMaterials = await persistenceService.getAllMaterials();
        
        const newMaterial = allMaterials.find((m) => m.contentHash === newSampleHash);
        const existingMaterial = allMaterials.find((m) => m.contentHash === existingSampleHash);

        if (newMaterial) {
          setNewContent(newMaterial.content);
        }
        if (existingMaterial) {
          setExistingContent(existingMaterial.content);
        }
      } catch (error) {
        console.error('Failed to load sample contents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContents();
  }, [newSampleHash, existingSampleHash]);

  const diffResult = showDiff && newContent && existingContent
    ? diffWords(existingContent, newContent)
    : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-[#718096] font-mono">
        加载样本内容中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded-lg">
        <div>
          <div className="font-mono text-sm text-[#e2e8f0] mb-1">相似度检测结果</div>
          <div className="text-2xl font-mono font-bold text-[#dd6b20]">
            {(similarity * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-[#718096] mt-1">
            超过 85% 阈值，系统自动挂起
          </div>
        </div>
        <div className="text-right">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="px-3 py-1 text-xs font-mono text-[#a0aec0] bg-[#0d1117] border border-[#4a5568] rounded hover:bg-[#2d3748] transition-colors"
          >
            {showDiff ? '隐藏差异' : '显示差异'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono text-[#fc8181]">
              历史样本 #{shortHash(existingSampleHash, 8)}
            </div>
            <button
              onClick={() => copyToClipboard(existingContent)}
              className="p-1 text-[#718096] hover:text-[#a0aec0]"
              title="复制"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {showDiff && diffResult ? (
            <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono max-h-64 overflow-auto whitespace-pre-wrap">
              {diffResult.map((part, index) => (
                <span
                  key={index}
                  className={
                    part.removed
                      ? 'bg-[#c53030]/30 text-[#fc8181] line-through px-0.5 rounded'
                      : part.added
                      ? ''
                      : 'text-[#a0aec0]'
                  }
                >
                  {part.removed ? part.value : ''}
                </span>
              ))}
            </div>
          ) : (
            <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono text-[#a0aec0] max-h-64 overflow-auto whitespace-pre-wrap">
              {existingContent || '内容加载失败'}
            </pre>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono text-[#68d391]">
              当前样本 #{shortHash(newSampleHash, 8)}
            </div>
            <button
              onClick={() => copyToClipboard(newContent)}
              className="p-1 text-[#718096] hover:text-[#a0aec0]"
              title="复制"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {showDiff && diffResult ? (
            <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono max-h-64 overflow-auto whitespace-pre-wrap">
              {diffResult.map((part, index) => (
                <span
                  key={index}
                  className={
                    part.added
                      ? 'bg-[#38a169]/30 text-[#68d391] px-0.5 rounded'
                      : part.removed
                      ? ''
                      : 'text-[#a0aec0]'
                  }
                >
                  {part.added ? part.value : ''}
                </span>
              ))}
            </div>
          ) : (
            <pre className="p-3 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono text-[#a0aec0] max-h-64 overflow-auto whitespace-pre-wrap">
              {newContent || '内容加载失败'}
            </pre>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#4a5568]">
        <div className="flex items-center gap-4 text-xs font-mono text-[#718096]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#c53030]" />
            删除内容
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#38a169]" />
            新增内容
          </span>
        </div>
        <p className="text-xs text-[#718096] max-w-md text-right">
          请现场老师确认两份样本是否为同一实体。若为不同样本，请选择"继续处理"；若为重复样本，可选择"驳回"或"新建会话"处理。
        </p>
      </div>
    </div>
  );
};
