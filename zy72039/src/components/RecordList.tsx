import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, User, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { GameRecord } from '../types';
import { DATA_FLAG_LABELS, FAILURE_REASON_LABELS, DATA_SOURCE_LABELS } from '../types';
import { FLAG_COLORS } from '../config/gameConfig';

interface RecordListProps {
  records: GameRecord[];
  highlightId?: string | null;
}

export const RecordList: React.FC<RecordListProps> = ({ records, highlightId }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getFlagBadge = (flag: string) => {
    const colorClass = FLAG_COLORS[flag] || 'bg-gray-500';
    return (
      <span
        key={flag}
        className={`px-2 py-0.5 text-xs font-bold rounded text-white ${colorClass}`}
      >
        {DATA_FLAG_LABELS[flag as keyof typeof DATA_FLAG_LABELS] || flag}
      </span>
    );
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>暂无记录</p>
        <p className="text-sm mt-1">开始游戏后，提交的数据会显示在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {[...records].reverse().map((record, idx) => {
        const isExpanded = expandedId === record.id;
        const isHighlighted = highlightId === record.id;
        const isLatest = idx === 0;

        return (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-lg border-2 transition-all duration-200 overflow-hidden ${
              isHighlighted
                ? 'border-amber-500 bg-amber-900/20 shadow-lg shadow-amber-500/20'
                : isLatest
                ? 'border-slate-600 bg-slate-800/80'
                : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <div
              className="p-3 cursor-pointer"
              onClick={() => toggleExpand(record.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    record.isSuccess ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {record.sequence}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.isSuccess ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-mono font-bold text-white">
                        {record.processedValue !== null ? record.processedValue : '空值'}
                        <span className="text-gray-500 text-sm ml-1">kg</span>
                      </span>
                      <span className="text-gray-500 text-sm">
                        → 载荷 {record.load}kg
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {record.flags.map(getFlagBadge)}
                      {!record.isSuccess && record.failureReason && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-900/50 text-red-400 border border-red-700">
                          {FAILURE_REASON_LABELS[record.failureReason]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {record.formattedTime.split(' ')[1]}
                    </div>
                    {record.responseTime && (
                      <div className="text-xs text-gray-600 font-mono">
                        {record.responseTime}ms
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 pt-0 border-t border-slate-700 mt-2">
                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="w-4 h-4" />
                          <span>处理人:</span>
                          <span className="text-white">{record.operator}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <FileText className="w-4 h-4" />
                          <span>来源:</span>
                          <span className="text-white">{DATA_SOURCE_LABELS[record.source]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span>原始值:</span>
                          <span className="text-amber-400 font-mono">
                            {record.rawValue !== null && record.rawValue !== '' 
                              ? String(record.rawValue) 
                              : '<空值>'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span>回合:</span>
                          <span className="text-white">第 {record.roundNumber} 轮</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-gray-400">
                          <span>原始备注:</span>
                          <p className="text-white mt-1 bg-slate-900/50 p-2 rounded border border-slate-700 text-sm">
                            {record.note || '<无备注>'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {record.processingNote && (
                      <div className="mt-3 p-2 bg-amber-900/20 border border-amber-700/50 rounded">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                          <AlertTriangle className="w-4 h-4" />
                          处理说明（给阿蓝交接用）
                        </div>
                        <p className="text-amber-200 text-sm">{record.processingNote}</p>
                      </div>
                    )}

                    {!record.isSuccess && record.failureDetail && (
                      <div className="mt-3 p-2 bg-red-900/20 border border-red-700/50 rounded">
                        <div className="text-red-400 text-xs font-bold mb-1">失败详情</div>
                        <p className="text-red-200 text-sm">{record.failureDetail}</p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-600 font-mono">
                      记录ID: {record.id}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};
