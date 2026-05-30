import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Anomaly } from '@/types';
import { ANOMALY_TYPES } from '@/data/constants';
import { AnomalyEngine } from '@/engine/anomalyEngine';

interface AnomalyAlertProps {
  anomalies: Anomaly[];
  onClose?: () => void;
}

export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({ anomalies, onClose }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (anomalies.length === 0) return null;

  const groupedAnomalies = anomalies.reduce(
    (acc, anomaly) => {
      if (!acc[anomaly.type]) {
        acc[anomaly.type] = [];
      }
      acc[anomaly.type].push(anomaly);
      return acc;
    },
    {} as Record<string, Anomaly[]>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-semibold">异常诊断结果</h3>
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/20 text-red-400">
            {anomalies.length} 项异常
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-2">
        {Object.entries(groupedAnomalies).map(([type, typeAnomalies]) => {
          const config = ANOMALY_TYPES[type];
          return (
            <div key={type} className="mb-2 last:mb-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50">
                <span className="text-lg">{config?.icon}</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: config?.color }}
                >
                  {config?.label}
                </span>
                <span className="text-xs text-gray-500">
                  {typeAnomalies.length} 项
                </span>
              </div>

              <div className="mt-1 space-y-1 ml-4">
                {typeAnomalies.map((anomaly) => (
                  <AnomalyItem
                    key={anomaly.id}
                    anomaly={anomaly}
                    isExpanded={expandedId === anomaly.id}
                    onToggle={() => setExpandedId(
                      expandedId === anomaly.id ? null : anomaly.id
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

interface AnomalyItemProps {
  anomaly: Anomaly;
  isExpanded: boolean;
  onToggle: () => void;
}

const AnomalyItem: React.FC<AnomalyItemProps> = ({ anomaly, isExpanded, onToggle }) => {
  const config = ANOMALY_TYPES[anomaly.type];
  const severityColor = AnomalyEngine.getAnomalySeverityColor(anomaly.severity);
  const severityLabel = AnomalyEngine.getAnomalySeverityLabel(anomaly.severity);
  const diagnosis = AnomalyEngine.diagnoseRootCause(anomaly);

  return (
    <div className="rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 text-xs font-medium rounded"
              style={{ backgroundColor: `${severityColor}20`, color: severityColor }}
            >
              {severityLabel}
            </span>
            <span className="text-sm text-gray-300 truncate">
              {anomaly.description}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 bg-slate-700/20"
          >
            <div className="pt-2 space-y-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">根本原因</div>
                <div className="text-gray-300">{anomaly.rootCause}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">问题分类</div>
                <div className="text-gray-300">{diagnosis.category}</div>
              </div>

              {diagnosis.possibleCauses.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">可能原因</div>
                  <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                    {diagnosis.possibleCauses.map((cause, i) => (
                      <li key={i}>{cause}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="text-xs text-emerald-400 font-medium mb-1">
                  💡 修复建议
                </div>
                <div className="text-gray-300">{anomaly.suggestion}</div>
              </div>

              {diagnosis.preventionTips.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">预防措施</div>
                  <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                    {diagnosis.preventionTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnomalyAlert;
