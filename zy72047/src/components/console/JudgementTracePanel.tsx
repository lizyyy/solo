import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  GitBranch,
  Brain,
  Scale,
  ChevronDown,
  ChevronUp,
  Filter,
  Disc,
  MousePointer,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { Operation, JudgementTrace } from '@/types/game';

interface TraceItemProps {
  operation: Operation;
  isNew: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const getTypeIcon = (type: string) => {
  if (type === 'drag') return <Disc className="w-4 h-4" />;
  if (type === 'click') return <MousePointer className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
};

const getTypeColor = (type: string): string => {
  if (type === 'drag') return 'text-purple-400 bg-purple-500/20';
  if (type === 'click') return 'text-blue-400 bg-blue-500/20';
  return 'text-vinyl-400 bg-vinyl-500/20';
};

const getRuleIcon = (rule: string) => {
  if (rule.includes('资源') || rule.includes('resource')) {
    return <Scale className="w-3 h-3" />;
  }
  if (rule.includes('风险') || rule.includes('risk')) {
    return <AlertTriangle className="w-3 h-3" />;
  }
  if (rule.includes('分数') || rule.includes('score')) {
    return <CheckCircle className="w-3 h-3" />;
  }
  if (rule.includes('拖拽') || rule.includes('drag')) {
    return <Disc className="w-3 h-3" />;
  }
  if (rule.includes('点击') || rule.includes('click')) {
    return <MousePointer className="w-3 h-3" />;
  }
  return <GitBranch className="w-3 h-3" />;
};

const TraceItem = ({ operation, isNew, isExpanded, onToggle }: TraceItemProps) => {
  const trace = operation.judgementTrace;
  const isJudgementCall = operation.isJudgementCall;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: 1, x: 0 }}
      className={`relative mb-2 rounded-lg border ${
        isJudgementCall
          ? 'border-gold-500/50 bg-gold-500/5'
          : 'border-vinyl-700 bg-vinyl-800/30'
      }`}
    >
      {isNew && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: 2 }}
          className="absolute inset-0 rounded-lg bg-gold-500/10 pointer-events-none"
        />
      )}

      <button
        onClick={onToggle}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-vinyl-700/30 rounded-lg transition-colors"
      >
        <div className={`p-1.5 rounded ${getTypeColor(operation.type)}`}>
          {getTypeIcon(operation.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-vinyl-100">{operation.elementLabel}</span>
            {isJudgementCall && (
              <span className="text-xs px-1.5 py-0.5 bg-gold-500/20 text-gold-400 rounded">
                裁判干预
              </span>
            )}
            <span className="text-xs text-vinyl-500 font-mono">
              {formatTime(operation.timestamp)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-1 text-xs">
            {operation.resourceDelta !== 0 && (
              <span className={operation.resourceDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                资源 {operation.resourceDelta > 0 ? '+' : ''}{operation.resourceDelta}
              </span>
            )}
            {operation.scoreDelta !== 0 && (
              <span className={operation.scoreDelta > 0 ? 'text-blue-400' : 'text-red-400'}>
                分数 {operation.scoreDelta > 0 ? '+' : ''}{operation.scoreDelta}
              </span>
            )}
            {operation.riskDelta !== 0 && (
              <span className={operation.riskDelta > 0 ? 'text-orange-400' : 'text-green-400'}>
                风险 {operation.riskDelta > 0 ? '+' : ''}{operation.riskDelta}
              </span>
            )}
          </div>

          {trace && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Brain className="w-3 h-3 text-gold-500" />
              <span className="text-vinyl-400 truncate">{trace.decision}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-vinyl-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-vinyl-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && trace && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-vinyl-700/50">
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-vinyl-400">
                  <Clock className="w-3 h-3" />
                  <span>判断时间: {formatTime(trace.timestamp)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-vinyl-400">
                  <GitBranch className="w-3 h-3" />
                  <span>处理模块: {trace.module}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-vinyl-300 mb-2">
                    <Search className="w-3 h-3 text-gold-500" />
                    <span>应用规则 ({trace.rulesApplied.length})</span>
                  </div>
                  <div className="space-y-1">
                    {trace.rulesApplied.map((rule, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-xs bg-vinyl-900/50 rounded px-2 py-1.5"
                      >
                        <span className="text-gold-500 mt-0.5">{getRuleIcon(rule)}</span>
                        <span className="text-vinyl-300">{rule}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-vinyl-300 mb-2">
                    <Brain className="w-3 h-3 text-gold-500" />
                    <span>决策理由</span>
                  </div>
                  <div className="text-xs text-vinyl-300 bg-vinyl-900/50 rounded px-2 py-1.5">
                    {trace.decision}
                  </div>
                </div>

                {operation.judgementReason && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-vinyl-300 mb-2">
                      <Scale className="w-3 h-3 text-gold-500" />
                      <span>裁判备注</span>
                    </div>
                    <div className="text-xs text-gold-400 bg-gold-500/10 border border-gold-500/30 rounded px-2 py-1.5">
                      {operation.judgementReason}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-vinyl-700/50">
                  <div className="text-center">
                    <div className="text-xs text-vinyl-500">操作后资源</div>
                    <div className={`font-mono font-bold ${
                      operation.resourcesAfter < 0 ? 'text-red-400' : 'text-vinyl-200'
                    }`}>
                      {operation.resourcesAfter}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-vinyl-500">操作后分数</div>
                    <div className="font-mono font-bold text-vinyl-200">
                      {operation.scoreAfter}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-vinyl-500">操作后风险</div>
                    <div className="font-mono font-bold text-vinyl-200">
                      {operation.riskAfter}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const JudgementTracePanel = () => {
  const { operations, lastOperation, currentRound } = useGameStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'drag' | 'click'>('all');
  const [showJudgementOnly, setShowJudgementOnly] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newOperationId, setNewOperationId] = useState<string | null>(null);

  useEffect(() => {
    if (lastOperation) {
      setNewOperationId(lastOperation.id);
      setExpandedId(lastOperation.id);
      const timer = setTimeout(() => setNewOperationId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastOperation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [operations.length]);

  const filteredOperations = operations.filter((op) => {
    if (filterType !== 'all' && op.type !== filterType) return false;
    if (showJudgementOnly && !op.isJudgementCall) return false;
    if (op.source !== '黑胶节拍修复赛') return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const judgementCount = operations.filter(
    (op) => op.isJudgementCall && op.source === '黑胶节拍修复赛'
  ).length;

  const dragCount = operations.filter(
    (op) => op.type === 'drag' && op.source === '黑胶节拍修复赛'
  ).length;

  const clickCount = operations.filter(
    (op) => op.type === 'click' && op.source === '黑胶节拍修复赛'
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-vinyl-900/90 backdrop-blur-sm rounded-2xl p-6 shadow-vinyl border border-vinyl-700 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-gold-500" />
          <h3 className="text-lg font-bold text-vinyl-100">样例验证区</h3>
          <span className="text-xs text-vinyl-500 px-2 py-0.5 bg-vinyl-800 rounded">
            黑胶节拍修复赛
          </span>
        </div>
        {!currentRound && (
          <span className="text-xs text-vinyl-500 px-2 py-1 bg-vinyl-800 rounded">
            等待比赛开始
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-vinyl-500" />
          <span className="text-xs text-vinyl-400">筛选:</span>
        </div>
        <button
          onClick={() => setFilterType('all')}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            filterType === 'all'
              ? 'bg-gold-500 text-vinyl-900'
              : 'bg-vinyl-800 text-vinyl-400 hover:bg-vinyl-700'
          }`}
        >
          全部 ({filteredOperations.length})
        </button>
        <button
          onClick={() => setFilterType('drag')}
          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            filterType === 'drag'
              ? 'bg-purple-500 text-white'
              : 'bg-vinyl-800 text-vinyl-400 hover:bg-vinyl-700'
          }`}
        >
          <Disc className="w-3 h-3" />
          拖拽 ({dragCount})
        </button>
        <button
          onClick={() => setFilterType('click')}
          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            filterType === 'click'
              ? 'bg-blue-500 text-white'
              : 'bg-vinyl-800 text-vinyl-400 hover:bg-vinyl-700'
          }`}
        >
          <MousePointer className="w-3 h-3" />
          点击 ({clickCount})
        </button>
        <button
          onClick={() => setShowJudgementOnly(!showJudgementOnly)}
          className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            showJudgementOnly
              ? 'bg-gold-500 text-vinyl-900'
              : 'bg-vinyl-800 text-vinyl-400 hover:bg-vinyl-700'
          }`}
        >
          <Scale className="w-3 h-3" />
          裁判干预 ({judgementCount})
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-vinyl-600 scrollbar-track-transparent"
      >
        {filteredOperations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-vinyl-500 py-12">
            <Search className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无判断记录</p>
            <p className="text-xs text-vinyl-600 mt-1">
              进行操作后将在这里显示判断过程
            </p>
          </div>
        ) : (
          filteredOperations.map((operation) => (
            <TraceItem
              key={operation.id}
              operation={operation}
              isNew={newOperationId === operation.id}
              isExpanded={expandedId === operation.id}
              onToggle={() => toggleExpand(operation.id)}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-vinyl-700">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-vinyl-200 font-mono">
              {filteredOperations.length}
            </div>
            <div className="text-xs text-vinyl-500">总操作</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400 font-mono">
              {dragCount}
            </div>
            <div className="text-xs text-vinyl-500">拖拽操作</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400 font-mono">
              {clickCount}
            </div>
            <div className="text-xs text-vinyl-500">点击操作</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gold-500 font-mono">
              {judgementCount}
            </div>
            <div className="text-xs text-vinyl-500">裁判干预</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-vinyl-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-vinyl-400">规则通过</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" />
            <span className="text-vinyl-400">规则拦截</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <span className="text-vinyl-400">风险警告</span>
          </div>
          <div className="flex items-center gap-1">
            <Scale className="w-3 h-3 text-gold-400" />
            <span className="text-vinyl-400">裁判干预</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
