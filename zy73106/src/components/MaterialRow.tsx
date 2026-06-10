import { useState } from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import type { MaterialBatch } from '@/types';

interface MaterialRowProps {
  material: MaterialBatch;
  onMarkSupplied?: (id: string) => void;
  zebraIndex?: number;
}

export default function MaterialRow({ material, onMarkSupplied, zebraIndex = 0 }: MaterialRowProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isMissing = material.isMissing;
  const isOdd = zebraIndex % 2 === 0;

  return (
    <div
      className={`
        relative p-3 md:p-4 transition-all
        ${isMissing
          ? `
              border-2 border-dashed border-[#E67E22] bg-[#E67E22]/10
              hover:bg-[#E67E22]/15
            `
          : `
              border border-steel-700/50
              ${isOdd ? 'bg-steel-700/40' : 'bg-steel-800/40'}
              hover:bg-steel-700/60
            `
        }
      `}
    >
      {isMissing && (
        <div
          className="absolute top-0 right-0 p-1.5 cursor-help z-10"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <AlertTriangle className="w-5 h-5 text-[#E67E22]" />
          {showTooltip && material.reviewHint && (
            <div className="absolute right-0 top-full mt-1 w-64 p-3 bg-steel-900 border-2 border-[#E67E22]
                            shadow-panel z-20">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#E67E22] mb-1">
                ⚠ 复核提示
              </div>
              <div className="font-mono text-xs text-steel-200 leading-relaxed">
                {material.reviewHint}
              </div>
            </div>
          )}
          {showTooltip && !material.reviewHint && (
            <div className="absolute right-0 top-full mt-1 w-64 p-3 bg-steel-900 border-2 border-[#E67E22]
                            shadow-panel z-20">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#E67E22] mb-1">
                ⚠ 复核提示
              </div>
              <div className="font-mono text-xs text-steel-200 leading-relaxed">
                缺失待补，接手请复核批次记录，确认后标记为已供应。
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 pr-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`
              font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border
              ${isMissing
                ? 'border-[#E67E22] text-[#E67E22] bg-[#E67E22]/10'
                : 'border-blueprint-green text-blueprint-green bg-blueprint-green/10'
              }
            `}>
              {isMissing ? '缺件' : '齐备'}
            </span>
            <span className="font-mono text-xs text-steel-400 tracking-wider">
              BATCH · {material.batchNo}
            </span>
            {!isMissing && (
              <CheckCircle className="w-3.5 h-3.5 text-blueprint-green" />
            )}
          </div>
          <div className="font-mono text-sm md:text-base text-steel-100 truncate">
            {material.materialName}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-steel-500">
            录入人：{material.recordedBy}
            {material.suppliedAt && (
              <span className="ml-3 text-blueprint-green">
                供应时间：{material.suppliedAt}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isMissing && (
            <div className="flex items-center gap-1.5 text-blueprint-green">
              <CheckCircle className="w-4 h-4" />
              <span className="font-mono text-xs uppercase tracking-wider">已供应</span>
            </div>
          )}

          {isMissing && onMarkSupplied && (
            <>
              <button
                onClick={() => setShowTooltip(v => !v)}
                className="p-2 border border-steel-600 text-steel-400 hover:text-steel-200
                           hover:border-steel-400 transition-all"
                title="查看提示"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMarkSupplied(material.id)}
                className="btn-success text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>标记齐备</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
