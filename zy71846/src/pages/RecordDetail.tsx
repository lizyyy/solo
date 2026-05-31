import { useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, User, MessageSquare } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { STATUS_LABELS, SOURCE_LABELS, ROLE_LABELS, type RecordSource, type ModificationHistory } from '../types';

const SOURCE_COLORS: Record<RecordSource, string> = {
  initial: 'source-initial',
  late_attachment: 'source-late_attachment',
  duplicate: 'source-duplicate',
  manual_correction: 'source-manual_correction',
};

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, getHistoryByRecordId, currentUser, reviewRecord, markQuestion } = useRecordStore();

  const record = getRecordById(id ?? '');
  const history = getHistoryByRecordId(id ?? '');

  const [reviewComment, setReviewComment] = useState('');
  const [questionText, setQuestionText] = useState('');

  if (!record) {
    return (
      <div className="min-h-screen bg-museum-cream flex items-center justify-center">
        <p className="text-museum-mid text-lg">记录不存在</p>
      </div>
    );
  }

  const canReview = (record.isDisputed || record.status === 'pending') && currentUser === 'project_lead' && !record.reviewResult;
  const isDocent = currentUser === 'docent';

  const statusClass = `status-${record.status}` as const;

  return (
    <div className="min-h-screen bg-museum-cream pb-8">
      {record.isDisputed && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-bold">⚡ 争议记录</span>
          <span className="text-red-100 text-sm">— 此记录存在争议，需工程负责人复核确认</span>
        </div>
      )}

      <div className="px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-museum-mid hover:text-museum-dark transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回列表</span>
        </button>

        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <span className="text-museum-mid text-sm">文物名称</span>
                <p className="text-museum-dark font-serif text-lg">{record.artifactName}</p>
              </div>
              <div>
                <span className="text-museum-mid text-sm">文物编号</span>
                <p className="text-museum-dark">{record.artifactCode}</p>
              </div>
              <div>
                <span className="text-museum-mid text-sm">展柜编号</span>
                <p className="text-museum-dark">{record.cabinetId}</p>
              </div>
              <div>
                <span className="text-museum-mid text-sm">摆放位置</span>
                <p className="text-museum-dark">{record.position}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-museum-mid text-sm">坐标轴</span>
                <p className="text-museum-dark font-mono">{record.coordinateAxis}</p>
              </div>
              <div>
                <span className="text-museum-mid text-sm">轴向翻转</span>
                {record.axisFlipped ? (
                  <p className="text-red-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    已翻转
                  </p>
                ) : (
                  <p className="text-museum-dark">否</p>
                )}
              </div>
              <div>
                <span className="text-museum-mid text-sm">来源标签</span>
                <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-sm border ${SOURCE_COLORS[record.source]}`}>
                  {SOURCE_LABELS[record.source]}
                </span>
              </div>
              <div>
                <span className="text-museum-mid text-sm">状态</span>
                <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-sm ${statusClass}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {(record.status === 'pending' || record.pendingReason) && record.pendingReason && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-amber-800 font-bold">待处理原因</span>
            </div>
            <p className="text-amber-900">{record.pendingReason}</p>
          </div>
        )}

        {record.reviewResult && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h3 className="text-museum-dark font-bold mb-3 flex items-center gap-2">
              {record.reviewResult === 'confirmed' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              复核结果
            </h3>
            <div className="space-y-2">
              <p className="text-museum-dark">
                结果：
                <span className={record.reviewResult === 'confirmed' ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                  {record.reviewResult === 'confirmed' ? '确认通过' : '驳回'}
                </span>
              </p>
              <p className="text-museum-mid flex items-center gap-1">
                <User className="w-4 h-4" />
                复核人：{record.reviewedBy}
              </p>
              <p className="text-museum-mid flex items-center gap-1">
                <Clock className="w-4 h-4" />
                复核时间：{record.reviewedAt}
              </p>
              {record.reviewComment && (
                <p className="text-museum-mid flex items-start gap-1">
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                  复核意见：{record.reviewComment}
                </p>
              )}
            </div>
          </div>
        )}

        {canReview && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h3 className="text-museum-dark font-bold mb-3">复核操作</h3>
            <textarea
              value={reviewComment}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReviewComment(e.target.value)}
              placeholder="输入复核意见…"
              className="w-full border border-museum-border rounded-lg p-3 text-museum-dark bg-museum-cream/50 focus:outline-none focus:ring-2 focus:ring-museum-copper resize-none h-24"
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => { reviewRecord(record.id, 'confirmed', reviewComment); setReviewComment(''); }}
                className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                复核确认
              </button>
              <button
                onClick={() => { reviewRecord(record.id, 'rejected', reviewComment); setReviewComment(''); }}
                className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                复核驳回
              </button>
            </div>
          </div>
        )}

        {isDocent && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h3 className="text-museum-dark font-bold mb-3">标注疑问</h3>
            <textarea
              value={questionText}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuestionText(e.target.value)}
              placeholder="输入疑问内容…"
              className="w-full border border-museum-border rounded-lg p-3 text-museum-dark bg-museum-cream/50 focus:outline-none focus:ring-2 focus:ring-museum-copper resize-none h-24"
            />
            <button
              onClick={() => { if (questionText.trim()) { markQuestion(record.id, questionText.trim()); setQuestionText(''); } }}
              className="mt-3 flex items-center gap-1 px-4 py-2 bg-museum-copper text-white rounded-lg hover:bg-museum-copperLight transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              标注疑问
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-museum-dark font-bold mb-4">修改记录</h3>
            <div className="relative">
              {history.map((h: ModificationHistory, idx: number) => (
                <div key={h.id} className="relative pl-8 pb-6 last:pb-0">
                  {idx < history.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-[#c48a5a]/40" />
                  )}
                  <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-[#c48a5a] border-2 border-white shadow-sm" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2 text-museum-mid">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{h.timestamp}</span>
                      <span className="font-medium text-museum-dark">{h.operator}</span>
                      <span className="text-museum-mid">({ROLE_LABELS[h.operatorRole]})</span>
                    </div>
                    <p className="text-museum-dark mt-1 font-medium">{h.action}</p>
                    {h.field && (
                      <p className="text-museum-mid mt-0.5">
                        <span className="font-mono text-xs bg-museum-cream px-1 rounded">{h.field}</span>
                        {h.oldValue && <span className="mx-1">「{h.oldValue}」→「{h.newValue}」</span>}
                      </p>
                    )}
                    {h.reason && <p className="text-museum-mid mt-0.5 text-xs">原因：{h.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
