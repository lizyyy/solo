import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface CurrencyCellProps {
  currencyRaw: string;
  currency: string;
  hasMixed: boolean;
  onReview?: () => void;
}

export const CurrencyCell: React.FC<CurrencyCellProps> = ({ currencyRaw, currency, hasMixed, onReview }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!hasMixed) {
    return (
      <span className="font-mono text-sm text-navy-700">
        {currencyRaw}
      </span>
    );
  }

  return (
    <div 
      className="relative group cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onReview}
    >
      <div className="inline-block relative">
        <div 
          className="px-2 py-1 rounded bg-repeating-linear-gradient font-mono text-sm font-medium text-audit-orange border border-audit-orange/30 hover:scale-105 transition-transform"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(230, 126, 34, 0.1) 5px, rgba(230, 126, 34, 0.1) 10px)'
          }}
        >
          <div className="absolute -top-1 -right-1 w-0 h-0 border-t-[10px] border-t-audit-red border-l-[10px] border-l-transparent" />
          <div className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-audit-orange" />
            <span>{currencyRaw}</span>
          </div>
        </div>

        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-navy-900 text-white text-xs rounded shadow-xl animate-slide-in">
            <p className="font-semibold text-audit-orange mb-1">⚠️ 港币人民币同列</p>
            <p className="text-navy-200 mb-1">原始内容: <span className="font-mono">{currencyRaw}</span></p>
            <p className="text-navy-200 mb-1">检测币种: <span className="font-mono">{currency}</span></p>
            <p className="text-navy-300 text-[10px] mt-2">需托管对接人复核，点击查看详情</p>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-8 border-transparent border-t-navy-900" />
          </div>
        )}
      </div>
    </div>
  );
};
