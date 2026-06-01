import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { formatTimestamp, getStateChangeSummary } from '../utils/gameEngine';
import { renderDiffToHTML, getDiffStats } from '../utils/diffUtils';
import type { GameSession, OperationRecord, Note } from '../types';
import { ChevronDown, ChevronRight, Trash2, Calendar, User, Target, AlertTriangle } from 'lucide-react';

interface SessionCardProps {
  session: GameSession;
  index: number;
}

function SessionCard({ session, index }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'notes'>('records');

  const duration = session.endTime
    ? Math.round((session.endTime - session.startTime) / 1000)
    : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const totalChanges = session.records.reduce(
    (acc, record) => {
      const changes = getStateChangeSummary(record.stateBefore, record.stateAfter);
      return {
        resources: acc.resources + changes.resources,
        score: acc.score + changes.score,
        risk: acc.risk + changes.risk,
      };
    },
    { resources: 0, score: 0, risk: 0 }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-chalkboard-light rounded-lg border border-chalk/20 overflow-hidden"
    >
      <div
        className="p-4 cursor-pointer hover:bg-chalkboard/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-hand text-xl text-chalk">{session.levelName}</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  session.finalState?.isNegative
                    ? 'bg-skate-red/20 text-skate-red'
                    : 'bg-skate-teal/20 text-skate-teal'
                }`}
              >
                {session.finalState?.isNegative ? '资源异常' : '正常结束'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-chalk-muted font-mono">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatTimestamp(session.startTime)}
              </span>
              {duration && (
                <span>时长: {formatDuration(duration)}</span>
              )}
              <span className="flex items-center gap-1">
                <User size={12} />
                {session.operator}
              </span>
              <span className="flex items-center gap-1">
                <Target size={12} />
                {session.records.length} 次操作
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs font-mono">
              <div className="text-chalk">
                最终分数: <span className="text-skate-orange font-bold">{session.finalState?.score || 0}</span>
              </div>
              <div className="text-chalk-muted">
                资源: {session.finalState?.resources || 0} | 风险: {session.finalState?.risk || 0}%
              </div>
            </div>
            {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </div>

        <div className="flex gap-6 mt-3 pt-3 border-t border-chalk/10 text-xs font-mono">
          <div>
            <span className="text-chalk-muted">累计资源变化: </span>
            <span className={totalChanges.resources >= 0 ? 'text-skate-teal' : 'text-skate-red'}>
              {totalChanges.resources >= 0 ? '+' : ''}{totalChanges.resources}
            </span>
          </div>
          <div>
            <span className="text-chalk-muted">累计得分: </span>
            <span className="text-skate-orange">+{totalChanges.score}</span>
          </div>
          <div>
            <span className="text-chalk-muted">累计风险变化: </span>
            <span className={totalChanges.risk <= 0 ? 'text-skate-teal' : 'text-skate-red'}>
              {totalChanges.risk >= 0 ? '+' : ''}{totalChanges.risk}
            </span>
          </div>
          <div>
            <span className="text-chalk-muted">备注数: </span>
            <span className="text-skate-blue">{session.notes.length}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-chalk/10"
          >
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('records');
                  }}
                  className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                    activeTab === 'records'
                      ? 'bg-skate-orange/20 text-skate-orange'
                      : 'text-chalk-muted hover:bg-chalkboard/30'
                  }`}
                >
                  📊 操作记录 ({session.records.length})
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('notes');
                  }}
                  className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                    activeTab === 'notes'
                      ? 'bg-skate-orange/20 text-skate-orange'
                      : 'text-chalk-muted hover:bg-chalkboard/30'
                  }`}
                >
                  📋 备注记录 ({session.notes.length})
                </button>
              </div>

              {activeTab === 'records' && (
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {session.records.length === 0 ? (
                    <div className="text-center py-8 text-chalk-muted">
                      暂无操作记录
                    </div>
                  ) : (
                    session.records.map((record: OperationRecord, i: number) => (
                      <RecordDetail key={record.id} record={record} index={i} />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  {session.notes.length === 0 ? (
                    <div className="text-center py-8 text-chalk-muted">
                      暂无备注
                    </div>
                  ) : (
                    session.notes.map((note: Note) => (
                      <NoteDetail key={note.id} note={note} />
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RecordDetail({ record, index }: { record: OperationRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const changes = getStateChangeSummary(record.stateBefore, record.stateAfter);

  return (
    <div
      className="bg-chalkboard/50 rounded-lg p-3 border border-chalk/10"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-skate-orange/20 text-skate-orange text-xs flex items-center justify-center font-mono">
            {index + 1}
          </span>
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
        <div className="flex gap-2 text-xs font-mono">
          {changes.resources !== 0 && (
            <span className={changes.resources > 0 ? 'text-skate-teal' : 'text-skate-red'}>
              资源{changes.resources > 0 ? '+' : ''}{changes.resources}
            </span>
          )}
          {changes.score !== 0 && (
            <span className="text-skate-orange">分数+{changes.score}</span>
          )}
          {changes.risk !== 0 && (
            <span className={changes.risk < 0 ? 'text-skate-teal' : 'text-skate-red'}>
              风险{changes.risk > 0 ? '+' : ''}{changes.risk}
            </span>
          )}
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
            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div className="bg-chalkboard/30 p-2 rounded">
                <div className="text-chalk-muted mb-1">操作前</div>
                <div className="font-mono">
                  资源:{record.stateBefore.resources} 分数:{record.stateBefore.score} 风险:{record.stateBefore.risk}%
                </div>
              </div>
              <div className="bg-chalkboard/30 p-2 rounded">
                <div className="text-chalk-muted mb-1">操作后</div>
                <div className="font-mono">
                  资源:{record.stateAfter.resources} 分数:{record.stateAfter.score} 风险:{record.stateAfter.risk}%
                </div>
              </div>
            </div>
            <div className="bg-chalkboard/30 p-3 rounded">
              <div className="text-xs text-chalk-muted mb-2">计算过程</div>
              <div className="font-mono text-xs space-y-1">
                <div className="text-skate-orange">公式: {record.calculationTrace.formula}</div>
                {record.calculationTrace.steps.map((step, i) => (
                  <div key={i} className="text-chalk-muted pl-3 border-l-2 border-chalk/20">
                    {step.description}
                  </div>
                ))}
                <div className="text-skate-teal pt-2 border-t border-chalk/10">
                  结果: {record.calculationTrace.result}
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-chalk-muted font-mono">
              <span>操作人: {record.operator}</span>
              <span>来源: {record.source}</span>
              <span>规则ID: {record.calculationTrace.ruleId}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NoteDetail({ note }: { note: Note }) {
  const [showDiff, setShowDiff] = useState(false);
  const isOriginal = note.type === 'original';
  const hasRevisions = note.revisions && note.revisions.length > 0;
  const latestRevision = hasRevisions ? note.revisions![note.revisions!.length - 1] : null;
  const diffStats = latestRevision ? getDiffStats(latestRevision.diff) : null;

  return (
    <div className={`p-4 rounded-lg ${isOriginal ? 'sticky-note-yellow' : 'sticky-note-blue'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="font-hand text-lg font-bold">
          {isOriginal ? '📋 原始备注' : '📝 补录备注'}
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`stamp ${
              isOriginal ? 'border-amber-600 text-amber-600' : 'border-blue-600 text-blue-600'
            }`}
          >
            {isOriginal ? '原始' : '补录'}
          </span>
          {hasRevisions && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="p-1 hover:bg-black/10 rounded"
            >
              <ChevronDown
                size={14}
                className={`text-gray-700 transition-transform ${showDiff ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>
      <div className="font-hand text-base whitespace-pre-wrap leading-relaxed text-gray-800">
        {note.content}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-600 font-mono">
        <span>作者: {note.author}</span>
        <span>时间: {formatTimestamp(note.createdAt)}</span>
        <span>来源: {note.source}</span>
      </div>

      <AnimatePresence>
        {showDiff && latestRevision && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t-2 border-dashed border-gray-400 overflow-hidden"
          >
            <div className="text-xs font-mono text-gray-700 mb-2">
              <div className="font-bold mb-1">📌 修改记录</div>
              <div className="flex items-center gap-4">
                <span>修改人: {latestRevision.author}</span>
                <span>时间: {formatTimestamp(latestRevision.createdAt)}</span>
                <span>原因: {latestRevision.reason}</span>
              </div>
              {diffStats && (
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-green-700">+{diffStats.added} 新增</span>
                  <span className="text-red-700">-{diffStats.removed} 删除</span>
                </div>
              )}
            </div>
            <div className="bg-white/50 p-3 rounded text-sm font-mono">
              <div
                dangerouslySetInnerHTML={{
                  __html: renderDiffToHTML(latestRevision.diff),
                }}
                className="leading-relaxed whitespace-pre-wrap"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function History() {
  const { history, clearHistory, init } = useGameStore();
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const handleClearHistory = () => {
    clearHistory();
    setShowConfirm(false);
  };

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="font-hand text-4xl text-chalk chalk-text">📜 历史记录</h1>
          <p className="text-chalk-muted font-mono text-sm mt-1">
            查看所有已结束的对局记录
          </p>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-chalk-muted font-mono">
              共 {history.length} 条记录
            </span>
            <button
              onClick={() => setShowConfirm(true)}
              className="chalk-button text-sm py-1 px-3 border-skate-red text-skate-red"
            >
              <Trash2 size={14} className="inline mr-1" />
              清空历史
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowConfirm(false)}
          >
            <div
              className="bg-chalkboard-light p-6 rounded-xl border-2 border-skate-red max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-skate-red" size={24} />
                <h3 className="font-hand text-2xl text-chalk">确认清空历史记录？</h3>
              </div>
              <p className="text-chalk-muted font-mono text-sm mb-6">
                此操作不可恢复，所有历史对局记录将被永久删除。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="chalk-button text-sm py-1 px-4"
                >
                  取消
                </button>
                <button
                  onClick={handleClearHistory}
                  className="chalk-button text-sm py-1 px-4 border-skate-red text-skate-red"
                >
                  确认清空
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {history.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📜</div>
          <div className="font-hand text-2xl text-chalk mb-2">暂无历史记录</div>
          <div className="text-chalk-muted font-mono text-sm">
            结束对局后会自动保存到这里
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((session, index) => (
            <SessionCard key={session.id} session={session} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
