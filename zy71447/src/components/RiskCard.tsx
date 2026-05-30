import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Code, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RiskItem } from '@/types';
import { RISK_TYPE_LABELS } from '@/types';
import { BusinessRules } from '@/utils/businessRules';

interface RiskCardProps {
  risk: RiskItem;
  showRawData: boolean;
}

const severityColors: Record<string, string> = {
  low: 'text-acoustic-mid',
  medium: 'text-bronze-500',
  high: 'text-acoustic-high',
};

const severityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export function RiskCard({ risk, showRawData }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`risk-card ${risk.severity}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${severityColors[risk.severity]}`}>
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-serif text-bronze-400">
                {RISK_TYPE_LABELS[risk.type]}
              </h4>
              <span
                className={`
                  px-2 py-0.5 rounded text-xs font-mono
                  ${risk.severity === 'high' ? 'bg-acoustic-high/20 text-acoustic-high' : ''}
                  ${risk.severity === 'medium' ? 'bg-bronze-500/20 text-bronze-400' : ''}
                  ${risk.severity === 'low' ? 'bg-acoustic-mid/20 text-acoustic-mid' : ''}
                `}
              >
                {severityLabels[risk.severity]}危險
              </span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-charcoal-700 rounded transition-colors text-gray-400"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <p className="text-sm text-gray-300 mt-1">{risk.description}</p>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-charcoal-700 space-y-3">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-bronze-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">业务解释</p>
                      <p className="text-sm text-bronze-300 font-mono">
                        {risk.businessInterpretation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Info size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">规则说明</p>
                      <p className="text-sm text-gray-400">
                        {BusinessRules.getRiskDescription(risk.type)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Code size={12} />
                    <span>检测时间：{new Date(risk.detectedAt).toLocaleString('zh-CN')}</span>
                  </div>

                  {showRawData && (
                    <div className="p-3 bg-charcoal-950 rounded-lg border border-charcoal-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Code size={12} className="text-gray-500" />
                        <span className="text-xs text-gray-500 font-mono">原始数据快照</span>
                      </div>
                      <pre className="text-xs text-gray-400 font-mono overflow-x-auto scrollbar-thin max-h-40">
                        {JSON.stringify(risk.rawDataSnapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
