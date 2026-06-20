import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { shortHash } from '@/utils/hash';
import { persistenceService } from '@/services/persistence';
import type { Material } from '@/types';

interface CitationPopoverProps {
  x: number;
  y: number;
  content: string;
  materialId: string;
  anchorText: string;
  onClose: () => void;
}

export const CitationPopover: React.FC<CitationPopoverProps> = ({
  x,
  y,
  content,
  materialId,
  anchorText,
  onClose,
}) => {
  const [material, setMaterial] = useState<Material | null>(null);

  useEffect(() => {
    const loadMaterial = async () => {
      try {
        const m = await persistenceService.getMaterial(materialId);
        setMaterial(m || null);
      } catch (error) {
        console.error('Failed to load material:', error);
      }
    };
    loadMaterial();
  }, [materialId]);

  const highlightText = (fullText: string, highlight: string) => {
    const index = fullText.indexOf(highlight);
    if (index === -1) return fullText;

    const before = fullText.substring(Math.max(0, index - 50), index);
    const after = fullText.substring(index + highlight.length, Math.min(fullText.length, index + highlight.length + 50));

    return (
      <>
        <span className="text-[#718096]">{before.length === index ? '' : '...'}{before}</span>
        <span className="bg-[#1a365d] text-[#63b3ed] px-1 rounded">{highlight}</span>
        <span className="text-[#718096]">{after}{after.length === 50 ? '...' : ''}</span>
      </>
    );
  };

  return (
    <div
      className="fixed z-50 w-96 bg-[#1a202c] border border-[#3182ce] rounded-lg shadow-2xl"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-[#3182ce]/20 border-b border-[#3182ce]/50">
        <div className="flex items-center gap-2 text-xs font-mono">
          <ExternalLink className="w-3.5 h-3.5 text-[#63b3ed]" />
          <span className="text-[#e2e8f0]">原文引用</span>
          {material && (
            <span className="text-[#718096]">
              #{shortHash(material.id, 6)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#718096] hover:text-[#e2e8f0] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4">
        {material && (
          <div className="mb-3 pb-3 border-b border-[#4a5568]">
            <div className="font-mono text-sm text-[#e2e8f0] mb-1">{material.name}</div>
            <div className="text-xs font-mono text-[#718096]">
              版本 v{material.version} · {material.versions.length} 个历史版本
            </div>
          </div>
        )}

        <div className="text-xs font-mono text-[#718096] mb-2">上下文</div>
        <p className="text-sm text-[#a0aec0] leading-relaxed">
          {highlightText(content, anchorText)}
        </p>

        {material && (
          <div className="mt-3 pt-3 border-t border-[#4a5568]">
            <div className="text-xs font-mono text-[#718096]">材料内容哈希</div>
            <div className="font-mono text-xs text-[#a0aec0] mt-0.5">
              {shortHash(material.contentHash, 16)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
