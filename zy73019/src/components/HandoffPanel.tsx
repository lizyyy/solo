import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoffPanelProps {
  text: string;
}

const HandoffPanel = ({ text }: HandoffPanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  return (
    <div className="bg-[#FFFBEB] border border-[#F59E0B]/20 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FEF3C7]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-[#92400E]">交接说明</span>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-[#92400E]" />
        ) : (
          <ChevronDown size={18} className="text-[#92400E]" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="relative bg-white/60 border border-[#F59E0B]/15 rounded-lg">
            <pre
              className={cn(
                'text-sm text-[#78350F] whitespace-pre-wrap',
                'font-sans leading-relaxed p-4 pr-12'
              )}
            >
              {text || <span className="text-[#D97706]/60 italic">暂无交接说明</span>}
            </pre>
            {text && (
              <button
                onClick={handleCopy}
                className={cn(
                  'absolute top-3 right-3 p-2 rounded-md transition-all',
                  copied
                    ? 'bg-[#10B981]/20 text-[#059669]'
                    : 'hover:bg-[#F59E0B]/15 text-[#92400E]/70 hover:text-[#92400E]'
                )}
                title={copied ? '已复制' : '复制内容'}
              >
                {copied ? (
                  <>
                    <Check size={16} className="inline" />
                    <span className="ml-1 text-xs font-medium">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} className="inline" />
                    <span className="ml-1 text-xs font-medium">复制</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HandoffPanel;
