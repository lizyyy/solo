import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  BookOpen,
  FileText,
  History,
  AlertTriangle,
  Check,
  X,
  Plus,
  MessageSquare,
  User,
} from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import { StepProgress } from '@/components/StepProgress';
import { StatusBadge } from '@/components/StatusBadge';
import { TrainingLogItem } from '@/components/TrainingLogItem';
import { ChangeHistoryItem } from '@/components/ChangeHistoryItem';
import { SummaryItemCard } from '@/components/SummaryItemCard';
import { formatDate } from '@/utils/common';
import { SummarySource } from '@/types';
import { clsx } from 'clsx';

type TabType = 'logs' | 'notes' | 'summary' | 'history';

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentReview = useReviewStore(s => s.currentReview);
  const currentUser = useReviewStore(s => s.currentUser);
  const loadReviewDetail = useReviewStore(s => s.loadReviewDetail);
  const importTrainingLogs = useReviewStore(s => s.importTrainingLogs);
  const advanceStep = useReviewStore(s => s.advanceStep);
  const addThresholdNote = useReviewStore(s => s.addThresholdNote);
  const addSummaryItem = useReviewStore(s => s.addSummaryItem);
  const updateSummaryItem = useReviewStore(s => s.updateSummaryItem);
  const confirmReview = useReviewStore(s => s.confirmReview);
  const clearCurrent = useReviewStore(s => s.clearCurrent);

  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [batchId, setBatchId] = useState('');
  const [importMessages, setImportMessages] = useState<string[]>([]);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [summarySource, setSummarySource] = useState<SummarySource>('training_log');
  const [summaryNeedsConfirm, setSummaryNeedsConfirm] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [confirmDecision, setConfirmDecision] = useState<'confirm' | 'reject'>('confirm');

  useEffect(() => {
    if (id) {
      loadReviewDetail(id);
    }
    return () => clearCurrent();
  }, [id, loadReviewDetail, clearCurrent]);

  if (!currentReview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-primary-400">加载中...</p>
      </div>
    );
  }

  const { review, trainingLogs, changeHistories, thresholdNotes, summaryItems } = currentReview;

  const handleImport = () => {
    if (!importText.trim() || !batchId.trim()) return;
    const result = importTrainingLogs(review.id, importText, batchId);
    setImportMessages(result.messages);
    if (result.added > 0) {
      setTimeout(() => {
        setShowImportModal(false);
        setImportText('');
        setBatchId('');
        setImportMessages([]);
      }, 1500);
    }
  };

  const handleAddNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addThresholdNote(review.id, noteTitle.trim(), noteContent.trim(), []);
    setShowNoteModal(false);
    setNoteTitle('');
    setNoteContent('');
  };

  const handleAddSummary = () => {
    if (!summaryContent.trim()) return;
    addSummaryItem(review.id, summaryContent.trim(), summarySource, summaryNeedsConfirm);
    setShowSummaryModal(false);
    setSummaryContent('');
    setSummaryNeedsConfirm(false);
  };

  const handleConfirmReview = () => {
    const result = confirmReview(review.id, reviewComment, confirmDecision === 'confirm');
    if (result.success) {
      setShowConfirmModal(false);
      setReviewComment('');
    }
  };

  const handleAdvanceStep = () => {
    const result = advanceStep(review.id);
  };

  const tabs: Array<{ key: TabType; label: string; icon: any; count?: number }> = [
    { key: 'logs', label: '训练日志', icon: FileText, count: trainingLogs.length },
    { key: 'notes', label: '阈值笔记', icon: BookOpen, count: thresholdNotes.length },
    { key: 'summary', label: '可解释摘要', icon: MessageSquare, count: summaryItems.length },
    { key: 'history', label: '修改历史', icon: History, count: changeHistories.length },
  ];

  return (
    <div className="min-h-screen bg-primary-50">
      <header className="bg-white border-b border-primary-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-primary-500 hover:text-primary-800 hover:bg-primary-100 rounded"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-primary-900 truncate">
                {review.title}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <StatusBadge status={review.status} />
                <span className="text-primary-400 flex items-center gap-1">
                  <User size={12} />
                  负责人：{review.assignee}
                </span>
                <span className="text-primary-400">
                  更新于 {formatDate(review.updatedAt)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {review.hasDefaultScoreIssue && review.status === 'pending_review' && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="btn btn-warning flex items-center gap-2"
                >
                  <AlertTriangle size={14} />
                  复核处理
                </button>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-primary-100">
            <StepProgress
              currentStep={review.currentStep}
              onAdvance={handleAdvanceStep}
              canAdvance={true}
            />
          </div>
        </div>
      </header>

      {review.hasDefaultScoreIssue && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center gap-2 text-orange-800 text-sm">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>
                <strong>注意：</strong>检测到存在"线上特征缺失却给了默认分"的情况，
                需推荐负责人复核后才能标记为已完成。
              </span>
              {review.reviewComment && (
                <span className="text-orange-600 ml-4">
                  复核意见：{review.reviewComment}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex border-b border-primary-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary-800 text-primary-800'
                  : 'border-transparent text-primary-500 hover:text-primary-700'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 bg-primary-100 text-primary-600 text-xs rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <div className="pb-2">
            {activeTab === 'logs' && (
              <button
                onClick={() => setShowImportModal(true)}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Upload size={14} />
                导入日志
              </button>
            )}
            {activeTab === 'notes' && (
              <button
                onClick={() => setShowNoteModal(true)}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                添加笔记
              </button>
            )}
            {activeTab === 'summary' && (
              <button
                onClick={() => setShowSummaryModal(true)}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                添加结论
              </button>
            )}
          </div>
        </div>

        {activeTab === 'logs' && (
          <div className="card overflow-hidden">
            {trainingLogs.length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={40} className="mx-auto text-primary-300 mb-3" />
                <p className="text-primary-500 text-sm mb-4">暂无训练日志</p>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn btn-secondary text-sm"
                >
                  导入训练日志
                </button>
              </div>
            ) : (
              <div className="divide-y divide-primary-100">
                {trainingLogs.map(log => (
                  <TrainingLogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            {thresholdNotes.length === 0 ? (
              <div className="card p-12 text-center">
                <BookOpen size={40} className="mx-auto text-primary-300 mb-3" />
                <p className="text-primary-500 text-sm">暂无阈值调参笔记</p>
              </div>
            ) : (
              thresholdNotes.map(note => (
                <div key={note.id} className="card p-5">
                  <h4 className="font-medium text-primary-800 mb-2">{note.title}</h4>
                  <p className="text-sm text-primary-600 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  <div className="mt-3 pt-3 border-t border-primary-100 flex items-center justify-between text-xs text-primary-400">
                    <span>由 {note.createdBy} 创建于 {formatDate(note.createdAt)}</span>
                    {note.relatedLogIds.length > 0 && (
                      <span>关联 {note.relatedLogIds.length} 条日志</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-3">
            {summaryItems.length === 0 ? (
              <div className="card p-12 text-center">
                <MessageSquare size={40} className="mx-auto text-primary-300 mb-3" />
                <p className="text-primary-500 text-sm">暂无可解释摘要</p>
              </div>
            ) : (
              summaryItems.map(item => (
                <SummaryItemCard
                  key={item.id}
                  item={item}
                  showActions={true}
                  onToggleConfirm={() =>
                    updateSummaryItem(item.id, {
                      isConfirmed: true,
                      confirmedBy: currentUser,
                      confirmedAt: new Date().toISOString(),
                    })
                  }
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="card p-5">
            {changeHistories.length === 0 ? (
              <p className="text-primary-400 text-sm text-center py-8">暂无修改历史</p>
            ) : (
              <div className="divide-y divide-primary-100">
                {changeHistories.map(h => (
                  <ChangeHistoryItem key={h.id} history={h} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-between items-center">
          <button onClick={() => navigate('/')} className="btn btn-secondary">
            返回列表
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleAdvanceStep}
              className="btn btn-primary"
              disabled={review.currentStep === 'summary_update'}
            >
              完成此步，进入下一步
            </button>
          </div>
        </div>
      </main>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">导入训练日志</h3>

            <label className="label-text">批次标识（用于去重，相同批次不会重复导入）</label>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="例如：train_20240601_v3"
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
            />

            <label className="label-text">日志内容</label>
            <textarea
              className="input-field font-mono text-xs mb-4"
              rows={10}
              placeholder="粘贴训练日志内容，每行一条..."
              value={importText}
              onChange={e => setImportText(e.target.value)}
            />

            {importMessages.length > 0 && (
              <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded text-sm text-primary-700">
                {importMessages.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                  setBatchId('');
                  setImportMessages([]);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="btn btn-primary"
                disabled={!importText.trim() || !batchId.trim()}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">添加阈值调参笔记</h3>

            <label className="label-text">笔记标题</label>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="例如：item_price_std 阈值调参记录"
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
            />

            <label className="label-text">笔记内容</label>
            <textarea
              className="input-field mb-4"
              rows={5}
              placeholder="记录阈值调参的背景、决策和结果..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteTitle('');
                  setNoteContent('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                className="btn btn-primary"
                disabled={!noteTitle.trim() || !noteContent.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">添加可解释摘要</h3>

            <label className="label-text">结论内容</label>
            <textarea
              className="input-field mb-4"
              rows={3}
              placeholder="用简洁的语言描述这条结论..."
              value={summaryContent}
              onChange={e => setSummaryContent(e.target.value)}
            />

            <label className="label-text">来源</label>
            <select
              className="input-field mb-4"
              value={summarySource}
              onChange={e => setSummarySource(e.target.value as SummarySource)}
            >
              <option value="training_log">训练日志</option>
              <option value="threshold_note">阈值笔记</option>
              <option value="manual">人工补充</option>
            </select>

            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={summaryNeedsConfirm}
                onChange={e => setSummaryNeedsConfirm(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-primary-700">需要推荐负责人确认</span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  setSummaryContent('');
                  setSummaryNeedsConfirm(false);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddSummary}
                className="btn btn-primary"
                disabled={!summaryContent.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">复核处理</h3>

            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
              该复盘检测到"特征缺失给默认分"问题，请复核后决定是否可以归档。
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setConfirmDecision('confirm')}
                className={clsx(
                  'flex-1 py-3 border-2 rounded text-sm font-medium transition-colors',
                  confirmDecision === 'confirm'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-primary-200 text-primary-600 hover:border-primary-300'
                )}
              >
                <Check size={16} className="inline mr-2" />
                确认正常，完成复盘
              </button>
              <button
                onClick={() => setConfirmDecision('reject')}
                className={clsx(
                  'flex-1 py-3 border-2 rounded text-sm font-medium transition-colors',
                  confirmDecision === 'reject'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-primary-200 text-primary-600 hover:border-primary-300'
                )}
              >
                <X size={16} className="inline mr-2" />
                退回重新分析
              </button>
            </div>

            <label className="label-text">复核意见</label>
            <textarea
              className="input-field mb-4"
              rows={3}
              placeholder="请填写复核意见..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setReviewComment('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReview}
                className="btn btn-primary"
                disabled={!reviewComment.trim()}
              >
                提交复核结果
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
