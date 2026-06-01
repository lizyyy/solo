import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OperationRecord } from '../types';
import { formatTimestamp, getStateChangeSummary } from '../utils/gameEngine';
import { ChevronDown, ChevronRight, Calculator } from 'lucide-react';

interface OperationTimelineProps {
  records: OperationRecord[];
}

interface RecordItemProps {
  record: OperationRecord;
  index: number;
}

function RecordItem({ record, index }: RecordItemProps) {
  const [expanded, setExpanded] = useState(false);
  const changes = getStateChangeSummary(record.stateBefore, record.stateAfter);

  const formatChange = (value: number, label: string) => {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '';
    const color = value > 0 ? 'text-skate-teal' : 'text-skate-red';
    return (
      <span className={`${color} font-mono text-xs`}>
        {label}: {sign}{value}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-8 pb-4"
    >
      {index < 100 && (
        <div className="absolute left-[5px] top-[10px] bottom-0 timeline-line" />
      )}
      <div className="absolute left-0 top-2 timeline-dot" />

      <div
        className="bg-chalkboard-light rounded-lg p-3 border border-chalk/20 cursor-pointer hover:border-skate-orange/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-chalk-muted font-mono">
                {formatTimestamp(record.timestamp)}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  record.type === 'drag'
                    ? 'bg-skate-blue/20 text-skate-blue'
                    : 'bg-skate-teal/20 text-skate-teal'
                }`}
              >
                {record.type === 'drag' ? '拖拽' : '点击'}
              </span>
              <span className="text-sm">{record.elementLabel}</span>
              {record.zoneName && (
                <span className="text-sm text-chalk-muted">→ {record.zoneName}</span>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              {formatChange(changes.resources, '资源')}
              {formatChange(changes.score, '分数')}
              {formatChange(changes.risk, '风险')}
            </div>
          </div>
          <div className="text-chalk-muted">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-chalk/10 overflow-hidden"
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-chalkboard/50 p-2 rounded">
                    <div className="text-chalk-muted mb-1">操作前状态</div>
                    <div className="font-mono space-y-0.5">
                      <div>资源: {record.stateBefore.resources}</div>
                      <div>分数: {record.stateBefore.score}</div>
                      <div>风险: {record.stateBefore.risk}%</div>
                    </div>
                  </div>
                  <div className="bg-chalkboard/50 p-2 rounded">
                    <div className="text-chalk-muted mb-1">操作后状态</div>
                    <div className="font-mono space-y-0.5">
                      <div>资源: {record.stateAfter.resources}</div>
                      <div>分数: {record.stateAfter.score}</div>
                      <div>风险: {record.stateAfter.risk}%</div>
                    </div>
                  </div>
                </div>

                <div className="bg-chalkboard/50 p-3 rounded">
                  <div className="flex items-center gap-2 text-chalk-muted mb-2 text-xs">
                    <Calculator size={14} />
                    <span>计算过程（判断留痕）</span>
                  </div>
                  <div className="font-mono text-xs space-y-2">
                    <div className="text-skate-orange">
                      公式: {record.calculationTrace.formula}
                    </div>
                    <div className="space-y-1">
                      {record.calculationTrace.steps.map((step, i) => (
                        <div key={i} className="text-chalk-muted pl-3 border-l-2 border-chalk/20">
                          {step.description}
                        </div>
                      ))}
                    </div>
                    <div className="text-skate-teal pt-2 border-t border-chalk/10">
                      结果: {record.calculationTrace.result}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-chalk-muted font-mono">
                  <span>操作人: {record.operator}</span>
                  <span>来源: {record.source}</span>
                  <span>规则ID: {record.calculationTrace.ruleId}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function OperationTimeline({ records }: OperationTimelineProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-chalk-muted">
        <div className="text-4xl mb-3">📝</div>
        <div className="font-hand text-xl">暂无操作记录</div>
        <div className="text-xs font-mono mt-1">拖拽道具或点击开始操作</div>
      </div>
    );
  }

  return (
    <div className="max-h-[500px] overflow-y-auto pr-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-hand text-xl text-skate-orange">📊 操作记录</h3>
        <span className="text-xs font-mono text-chalk-muted">
          共 {records.length} 条记录
        </span>
      </div>
      <div>
        {records.map((record, index) => (
          <RecordItem key={record.id} record={record} index={index} />
        ))}
      </div>
    </div>
  );
}
