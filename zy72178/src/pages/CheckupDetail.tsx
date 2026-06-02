import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Target,
  Crosshair,
  Search,
  Gauge,
  Hash,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  MessageSquarePlus,
  History,
  GitBranch,
  Shield,
  AlertCircle,
  Filter,
  Search as SearchIcon,
  Eye,
  Plus,
} from 'lucide-react';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { MetricCard } from '../components/MetricCard';
import { EvidenceBlock } from '../components/EvidenceBlock';
import { JudgmentBadge } from '../components/JudgmentBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { useCheckupStore } from '../store/checkupStore';
import { useSampleStore } from '../store/sampleStore';
import { useAppStore } from '../store/appStore';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatDuration } from '../utils/date';
import { addManualJudgment, addNote } from '../services/checkupEngine';
import { getEntityHistory } from '../services/auditService';
import { cn } from '../lib/utils';
import type { SampleResult, JudgmentType, AuditLog, Note } from '../types';

export default function CheckupDetail() {
  const navigate = useNavigate();
  const { runId } = useParams();
  const { currentRun, results, fetchResults, loadRun, runs, loading } = useCheckupStore();
  const { samples, fetchSamples } = useSampleStore();
  const { sidebarOpen } = useAppStore();
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [judgmentModal, setJudgmentModal] = useState<{ result: SampleResult; onClose: () => void } | null>(null);
  const [noteModal, setNoteModal] = useState<{ result: SampleResult; onClose: () => void } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ resultId: string; onClose: () => void } | null>(null);
  const [filterJudgment, setFilterJudgment] = useState<JudgmentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<Map<string, Note[]>>(new Map());

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchSamples(),
      ]);
      if (runId) {
        await loadRun(runId);
        await fetchResults(runId);
      }
    };
    init();
  }, [runId]);

  useEffect(() => {
    const loadNotesForResults = async () => {
      const newNotes = new Map<string, Note[]>();
      for (const result of results) {
        const history = await getEntityHistory('sampleResult', result.id);
        const resultNotes = history.filter(h => h.action === 'add_note');
        if (resultNotes.length > 0) {
          newNotes.set(result.id, resultNotes.map(h => h.metadata?.note as Note));
        }
      }
      setNotes(newNotes);
    };
    if (results.length > 0) {
      loadNotesForResults();
    }
  }, [results]);

  const getChangeValue = (key: keyof typeof currentRun.metrics) => {
    if (!currentRun || runs.length < 2) return undefined;
    const currentIdx = runs.findIndex(r => r.id === currentRun.id);
    if (currentIdx === -1 || currentIdx >= runs.length - 1) return undefined;
    const current = currentRun.metrics[key] as number;
    const previous = runs[currentIdx + 1].metrics[key] as number;
    return current - previous;
  };

  const filteredResults = results.filter(r => {
    const sample = samples.find(s => s.id === r.sampleId);
    const matchesJudgment = filterJudgment === 'all' || r.finalJudgment === filterJudgment;
    const matchesSearch = !sample || sample.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesJudgment && matchesSearch;
  });

  const handleAddJudgment = async (resultId: string, judgment: JudgmentType, reason: string) => {
    try {
      await addManualJudgment(resultId, judgment, reason);
      if (runId) {
        await fetchResults(runId);
      }
      setJudgmentModal(null);
    } catch (error) {
      alert('改判失败: ' + (error as Error).message);
    }
  };

  const handleAddNote = async (resultId: string, content: string, diffSummary: string) => {
    try {
      await addNote('sample_result', resultId, content, diffSummary || undefined);
      if (runId) {
        await fetchResults(runId);
      }
      const history = await getEntityHistory('sample_result', resultId);
      const resultNotes = history.filter(h => h.action === 'add_note').map(h => h.metadata?.note as Note);
      setNotes(prev => new Map(prev).set(resultId, resultNotes));
      setNoteModal(null);
    } catch (error) {
      alert('添加备注失败: ' + (error as Error).message);
    }
  };

  if (!currentRun) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  const resultNotes = (resultId: string) => notes.get(resultId) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="体检详情"
          subtitle={`${currentRun.modelName} v${currentRun.version} · ${currentRun.batchName}`}
        />

        <main className="p-6">
          <div className="mb-4">
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回总览
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="card p-6 mb-4">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-serif font-bold text-slate-800">
                      {currentRun.batchName}
                    </h2>
                    <span className="badge badge-primary">{currentRun.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-primary-500" />
                      {currentRun.modelName} v{currentRun.version}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-400" />
                      {currentRun.operator}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {formatDateTime(currentRun.startedAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-slate-400" />
                      {results.length} 条样本
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <Shield className="w-3.5 h-3.5" />
                      数据哈希
                    </div>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                      {currentRun.dataHash.slice(0, 16)}...
                    </code>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="准确率"
                  value={currentRun.metrics.accuracy}
                  change={getChangeValue('accuracy')}
                  icon={<Target className="w-6 h-6" />}
                  color="primary"
                  delay={0}
                />
                <MetricCard
                  title="精确率"
                  value={currentRun.metrics.precision}
                  change={getChangeValue('precision')}
                  icon={<Crosshair className="w-6 h-6" />}
                  color="emerald"
                  delay={0.1}
                />
                <MetricCard
                  title="召回率"
                  value={currentRun.metrics.recall}
                  change={getChangeValue('recall')}
                  icon={<Search className="w-6 h-6" />}
                  color="amber"
                  delay={0.2}
                />
                <MetricCard
                  title="F1分数"
                  value={currentRun.metrics.f1}
                  change={getChangeValue('f1')}
                  icon={<Gauge className="w-6 h-6" />}
                  color="slate"
                  delay={0.3}
                />
              </div>
            </div>

            <div className="card p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64 relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="搜索问题..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    className="input w-40"
                    value={filterJudgment}
                    onChange={(e) => setFilterJudgment(e.target.value as JudgmentType | 'all')}
                  >
                    <option value="all">全部判定</option>
                    <option value="correct">正确</option>
                    <option value="incorrect">错误</option>
                    <option value="partial">部分正确</option>
                    <option value="unverified">未验证</option>
                  </select>
                </div>
                <span className="text-sm text-slate-600">
                  共 {filteredResults.length} 条结果
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="card p-12 text-center text-slate-500">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
                  加载结果中...
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="card p-12 text-center text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无匹配的结果</p>
                </div>
              ) : (
                filteredResults.map((result, idx) => {
                  const sample = samples.find(s => s.id === result.sampleId);
                  const isExpanded = expandedResultId === result.id;
                  const hasNotes = resultNotes(result.id).length > 0;
                  const hasManualJudgment = !!result.manualJudgment;

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="card overflow-hidden"
                    >
                      <div
                        className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                        onClick={() => setExpandedResultId(isExpanded ? null : result.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <JudgmentBadge judgment={result.finalJudgment} size="sm" />
                              {hasManualJudgment && (
                                <span className="badge badge-amber">已人工改判</span>
                              )}
                              {hasNotes && (
                                <span className="badge badge-slate">
                                  <MessageSquarePlus className="w-3 h-3 mr-1" />
                                  {resultNotes(result.id).length} 条备注
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-mono">
                                #{idx + 1}
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 font-medium line-clamp-1">
                              {sample?.question || '未知问题'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                              模型输出: {result.modelOutput}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ConfidenceBar
                              confidence={result.modelConfidence}
                              threshold={currentRun.confidenceThreshold}
                              size="sm"
                            />
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && sample && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-200"
                          >
                            <div className="p-4 bg-slate-50/50 space-y-4">
                              <div className="flex justify-end gap-2 mb-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setHistoryModal({ resultId: result.id, onClose: () => setHistoryModal(null) }); }}
                                  className="btn btn-secondary gap-1 text-xs"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  操作历史
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setNoteModal({ result, onClose: () => setNoteModal(null) }); }}
                                  className="btn btn-secondary gap-1 text-xs"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" />
                                  补录备注
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setJudgmentModal({ result, onClose: () => setJudgmentModal(null) }); }}
                                  className="btn btn-primary gap-1 text-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  人工改判
                                </button>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="label">问题</label>
                                    <p className="text-sm text-slate-800 bg-white rounded-lg p-3 border border-slate-200">
                                      {sample.question}
                                    </p>
                                  </div>
                                  {sample.referenceAnswer && (
                                    <div>
                                      <label className="label">参考答案</label>
                                      <div className="quote-block">{sample.referenceAnswer}</div>
                                    </div>
                                  )}
                                  <div>
                                    <label className="label">模型输出</label>
                                    <div className="quote-block border-l-accent-amber-300 bg-accent-amber-50">
                                      {result.modelOutput}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                      <label className="label">模型置信度</label>
                                      <ConfidenceBar
                                        confidence={result.modelConfidence}
                                        threshold={currentRun.confidenceThreshold}
                                        size="md"
                                      />
                                    </div>
                                    <div>
                                      <label className="label">原始判定</label>
                                      <JudgmentBadge judgment={result.originalJudgment} />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  {result.manualJudgment && (
                                    <div className="bg-accent-emerald-50 rounded-lg p-3 border border-accent-emerald-200">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Edit3 className="w-4 h-4 text-accent-emerald-600" />
                                        <span className="text-sm font-medium text-accent-emerald-800">
                                          人工改判
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <JudgmentBadge judgment={result.manualJudgment.judgment} />
                                        <span className="text-xs text-accent-emerald-600">
                                          by {result.manualJudgment.operator} · {formatDateTime(result.manualJudgment.timestamp)}
                                        </span>
                                      </div>
                                      <p className="text-sm text-accent-emerald-700">
                                        {result.manualJudgment.reason}
                                      </p>
                                    </div>
                                  )}

                                  {result.evidences.length > 0 && (
                                    <div>
                                      <label className="label">引用证据 ({result.evidences.length})</label>
                                      <div className="space-y-2">
                                        <EvidenceBlock evidences={result.evidences} />
                                      </div>
                                    </div>
                                  )}

                                  {hasNotes && (
                                    <div>
                                      <label className="label">补录备注 ({resultNotes(result.id).length})</label>
                                      <div className="space-y-2">
                                        {resultNotes(result.id).map((note, i) => (
                                          <div key={i} className="bg-white rounded-lg p-3 border border-slate-200">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs text-slate-500">
                                                {note.operator} · {formatDateTime(note.timestamp)}
                                              </span>
                                            </div>
                                            <p className="text-sm text-slate-700 mb-2">{note.content}</p>
                                            {note.diffSummary && (
                                              <div className="bg-slate-50 rounded p-2 text-xs text-slate-600">
                                                <span className="font-medium">差异说明: </span>
                                                {note.diffSummary}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {sample.manualCorrection && (
                                    <div>
                                      <label className="label">样本人工修正</label>
                                      <div className="quote-block border-l-accent-emerald-300 bg-accent-emerald-50">
                                        {sample.manualCorrection}
                                      </div>
                                    </div>
                                  )}

                                  {sample.onlineFeedback && (
                                    <div>
                                      <label className="label">线上反馈</label>
                                      <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
                                        {sample.onlineFeedback}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200">
                                    <span className="flex items-center gap-1">
                                      <Hash className="w-3 h-3" />
                                      {sample.sourceFile}:{sample.sourceLine}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Shield className="w-3 h-3" />
                                      {sample.dataHash.slice(0, 12)}...
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </main>
      </div>

      {judgmentModal && (
        <ManualJudgmentModal
          result={judgmentModal.result}
          onClose={judgmentModal.onClose}
          onConfirm={handleAddJudgment}
        />
      )}

      {noteModal && (
        <AddNoteModal
          result={noteModal.result}
          onClose={noteModal.onClose}
          onConfirm={handleAddNote}
        />
      )}

      {historyModal && (
        <HistoryModal
          resultId={historyModal.resultId}
          onClose={historyModal.onClose}
        />
      )}
    </div>
  );
}

function ManualJudgmentModal({
  result,
  onClose,
  onConfirm,
}: {
  result: SampleResult;
  onClose: () => void;
  onConfirm: (resultId: string, judgment: JudgmentType, reason: string) => void;
}) {
  const [judgment, setJudgment] = useState<JudgmentType>(result.finalJudgment);
  const [reason, setReason] = useState('');

  const judgments: { value: JudgmentType; label: string }[] = [
    { value: 'correct', label: '正确' },
    { value: 'partial', label: '部分正确' },
    { value: 'incorrect', label: '错误' },
    { value: 'unverified', label: '未验证' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-serif font-bold text-slate-800">人工改判</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">当前判定</label>
            <JudgmentBadge judgment={result.finalJudgment} />
          </div>
          <div>
            <label className="label">新判定</label>
            <div className="grid grid-cols-2 gap-2">
              {judgments.map(j => (
                <button
                  key={j.value}
                  onClick={() => setJudgment(j.value)}
                  className={cn(
                    "p-3 rounded-lg border text-sm font-medium transition-all",
                    judgment === j.value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 hover:border-primary-300"
                  )}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">改判原因</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="请说明改判原因，便于后续追溯..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-secondary">取消</button>
          <button
            onClick={() => onConfirm(result.id, judgment, reason)}
            disabled={!reason.trim()}
            className="btn btn-primary gap-2"
          >
            <Check className="w-4 h-4" />
            确认改判
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddNoteModal({
  result,
  onClose,
  onConfirm,
}: {
  result: SampleResult;
  onClose: () => void;
  onConfirm: (resultId: string, content: string, diffSummary: string) => void;
}) {
  const [content, setContent] = useState('');
  const [diffSummary, setDiffSummary] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-serif font-bold text-slate-800">补录备注</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">备注内容 <span className="text-accent-rose-500">*</span></label>
            <textarea
              className="input min-h-[80px]"
              placeholder="输入备注内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div>
            <label className="label">差异说明 <span className="text-slate-400">(可选)</span></label>
            <textarea
              className="input min-h-[60px]"
              placeholder="如果补录涉及数据变更，请说明差异..."
              value={diffSummary}
              onChange={(e) => setDiffSummary(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-secondary">取消</button>
          <button
            onClick={() => onConfirm(result.id, content, diffSummary)}
            disabled={!content.trim()}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            添加备注
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function HistoryModal({ resultId, onClose }: { resultId: string; onClose: () => void }) {
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const logs = await getEntityHistory('sampleResult', resultId);
        setHistory(logs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [resultId]);

  const actionLabels: Record<string, string> = {
    create: '创建结果',
    add_manual_judgment: '人工改判',
    add_note: '添加备注',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-serif font-bold text-slate-800">操作历史</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              加载中...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              暂无操作历史
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
              {history.map((log, idx) => (
                <div key={idx} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-[22px] top-1.5 w-4 h-4 rounded-full bg-primary-500 border-2 border-white" />
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800">
                        {actionLabels[log.action] || log.action}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      操作人: {log.operator}
                    </p>
                    {log.metadata?.note && (
                      <div className="mt-2 bg-white rounded p-2 text-xs text-slate-700">
                        {(log.metadata.note as any).content}
                      </div>
                    )}
                    {log.metadata?.judgment && (
                      <div className="mt-2 bg-white rounded p-2 text-xs text-slate-700">
                        <span className="font-medium">改判为:</span>{' '}
                        {log.metadata.judgment}
                        {log.metadata.reason && (
                          <div className="mt-1 text-slate-500">
                            原因: {log.metadata.reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
