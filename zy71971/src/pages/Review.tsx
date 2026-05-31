import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { REVIEW_TYPE_LABELS } from '@/types';
import type { QARecord } from '@/types';
import PageHeader from '@/components/PageHeader';
import { Check, X, AlertCircle, Lightbulb, Link2Off, AlertTriangle, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUP_CONFIG = [
  { key: 'gray_conflict', label: '灰度冲突组', icon: AlertTriangle, color: 'amber', filter: (r: QARecord) => r.isGrayConflict && r.status === 'pending' },
  { key: 'source_broken', label: '答案断链组', icon: Link2Off, color: 'rose', filter: (r: QARecord) => r.isSourceBroken && r.status === 'pending' },
  { key: 'sensitive_leak', label: '敏感词漏脱敏组', icon: ShieldOff, color: 'rose', filter: (r: QARecord) => r.isSensitiveLeak && r.status === 'pending' },
] as const;

function buildNextStep(result: 'confirmed' | 'rejected' | 'known_issue', record: QARecord): string {
  if (result === 'confirmed') return '已确认答案正确，更新状态为正常';
  if (result === 'rejected') {
    const steps: string[] = ['退回修正'];
    if (record.isGrayConflict) steps.push('核对灰度结论与报表数据，以报表为准修正答案');
    if (record.isSourceBroken) steps.push('补充或修正来源文档链接');
    if (record.isSensitiveLeak) steps.push(`对敏感词"${record.sensitiveWordsFound.join('、')}"进行脱敏处理`);
    return steps.join('；');
  }
  return '标记为已知问题，纳入定期复查清单';
}

export default function Review() {
  const qaRecords = useStore((s) => s.qaRecords);
  const reviewRecord = useStore((s) => s.reviewRecord);
  const reviewLogs = useStore((s) => s.reviewLogs);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'confirmed' | 'rejected' | 'known_issue' | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [reason, setReason] = useState('');

  const pendingRecords = useMemo(() => qaRecords.filter((r) => r.status === 'pending'), [qaRecords]);
  const selectedRecord = pendingRecords.find((r) => r.id === selectedRecordId) ?? null;
  const selectedReviewLogs = selectedRecord ? reviewLogs.filter((l) => l.recordId === selectedRecord.id) : [];

  const grouped = useMemo(() => {
    return GROUP_CONFIG.map((g) => ({
      ...g,
      records: pendingRecords.filter(g.filter),
    }));
  }, [pendingRecords]);

  const handleSubmitReview = () => {
    if (!selectedRecordId || !reviewAction || !reviewer.trim() || !reason.trim()) return;
    reviewRecord(selectedRecordId, reviewAction, reviewer.trim(), reason.trim());
    setSelectedRecordId(null);
    setReviewAction(null);
    setReviewer('');
    setReason('');
  };

  const handleCancelReview = () => {
    setReviewAction(null);
    setReviewer('');
    setReason('');
  };

  return (
    <div className="h-full flex flex-col p-6">
      <PageHeader title="争议复核" subtitle="对系统检测出的争议记录进行人工复核" />

      <div className="flex-1 flex gap-6 min-h-0">
        <aside className="w-96 flex-shrink-0 overflow-y-auto space-y-4">
          {grouped.map((group) => (
            <div key={group.key} className="bg-[#1a2332] border border-[#2a3548] rounded-xl">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#2a3548]">
                <group.icon className={cn('w-4 h-4', group.color === 'amber' ? 'text-amber-400' : 'text-rose-400')} />
                <span className="text-sm font-medium text-gray-200">{group.label}</span>
                <span className="ml-auto text-xs text-gray-500">{group.records.length} 条</span>
              </div>
              {group.records.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-500">暂无待复核记录</p>
              ) : (
                <ul>
                  {group.records.map((record) => (
                    <li
                      key={record.id}
                      onClick={() => {
                        setSelectedRecordId(record.id);
                        setReviewAction(null);
                        setReviewer('');
                        setReason('');
                      }}
                      className={cn(
                        'px-4 py-3 cursor-pointer border-b border-[#2a3548] last:border-b-0 transition-colors',
                        selectedRecordId === record.id
                          ? 'bg-amber-400/5 border-l-2 border-l-amber-400'
                          : 'hover:bg-white/[0.02]'
                      )}
                    >
                      <p className="text-sm text-gray-200 leading-snug line-clamp-2">{record.question}</p>
                      <span className={cn(
                        'inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded',
                        group.color === 'amber'
                          ? 'bg-amber-400/15 text-amber-400'
                          : 'bg-rose-400/15 text-rose-400'
                      )}>
                        {REVIEW_TYPE_LABELS[group.key]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selectedRecord ? (
            <div className="h-full flex items-center justify-center bg-[#1a2332] border border-[#2a3548] rounded-xl">
              <div className="text-center">
                <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">请从左侧选择一条争议记录进行复核</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-2">问题</h3>
                <p className="text-base text-gray-100 leading-relaxed">{selectedRecord.question}</p>
                <h3 className="text-sm font-medium text-gray-400 mt-4 mb-2">答案</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{selectedRecord.answer}</p>
              </div>

              <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">争议原因</h3>
                <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-200 leading-relaxed">{selectedRecord.judgmentReason}</p>
                </div>
              </div>

              <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">证据区</h3>
                <div className="space-y-3">
                  {selectedRecord.isGrayConflict && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-medium text-gray-300">灰度结论</span>
                        </div>
                        <p className="text-sm text-amber-300">{selectedRecord.grayConclusion}</p>
                      </div>
                      <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-medium text-gray-300">报表结论</span>
                        </div>
                        <p className="text-sm text-blue-300">{selectedRecord.reportConclusion}</p>
                      </div>
                    </div>
                  )}
                  {selectedRecord.isSourceBroken && (
                    <div className="bg-rose-400/5 border border-rose-400/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Link2Off className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-medium text-gray-300">来源链路</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-rose-400/20 text-rose-400 rounded">{REVIEW_TYPE_LABELS.source_broken}</span>
                      </div>
                      <p className="text-sm text-rose-300">来源链接无效或为空，无法验证出处</p>
                    </div>
                  )}
                  {selectedRecord.isSensitiveLeak && (
                    <div className="bg-rose-400/5 border border-rose-400/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldOff className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-medium text-gray-300">敏感词漏脱敏</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-rose-400/20 text-rose-400 rounded">{REVIEW_TYPE_LABELS.sensitive_leak}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRecord.sensitiveWordsFound.map((w) => (
                          <span key={w} className="text-[11px] px-2 py-1 bg-rose-400/15 text-rose-300 rounded border border-rose-400/20">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">下一步建议</h3>
                <div className="space-y-2">
                  {(['confirmed', 'rejected', 'known_issue'] as const).map((result) => (
                    <div key={result} className="flex items-start gap-3 bg-[#0f1724] rounded-lg px-4 py-3">
                      <Lightbulb className={cn(
                        'w-4 h-4 mt-0.5 flex-shrink-0',
                        result === 'confirmed' ? 'text-blue-400' : result === 'rejected' ? 'text-orange-400' : 'text-amber-400'
                      )} />
                      <div>
                        <span className={cn(
                          'text-xs font-medium',
                          result === 'confirmed' ? 'text-blue-400' : result === 'rejected' ? 'text-orange-400' : 'text-amber-400'
                        )}>
                          {result === 'confirmed' ? '确认' : result === 'rejected' ? '驳回' : '已知问题'}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{buildNextStep(result, selectedRecord)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {reviewAction && (
                <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    复核操作 — {reviewAction === 'confirmed' ? '确认' : reviewAction === 'rejected' ? '驳回' : '已知问题'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">复核人</label>
                      <input
                        type="text"
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                        placeholder="请输入复核人姓名"
                        className="w-full bg-[#0f1724] border border-[#2a3548] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">复核理由</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="请输入复核理由"
                        rows={3}
                        className="w-full bg-[#0f1724] border border-[#2a3548] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-400/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubmitReview}
                        disabled={!reviewer.trim() || !reason.trim()}
                        className="px-4 py-2 text-sm font-medium bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        提交
                      </button>
                      <button
                        onClick={handleCancelReview}
                        className="px-4 py-2 text-sm font-medium text-gray-400 bg-[#0f1724] border border-[#2a3548] rounded-lg hover:text-gray-200 hover:border-gray-500 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!reviewAction && (
                <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">复核操作</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setReviewAction('confirmed')}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      确认
                    </button>
                    <button
                      onClick={() => setReviewAction('rejected')}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      驳回
                    </button>
                    <button
                      onClick={() => setReviewAction('known_issue')}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                      已知问题
                    </button>
                  </div>
                </div>
              )}

              {selectedReviewLogs.length > 0 && (
                <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">复核历史</h3>
                  <div className="space-y-2">
                    {selectedReviewLogs.map((log) => (
                      <div key={log.id} className="bg-[#0f1724] rounded-lg px-4 py-3 text-xs text-gray-400">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-300 font-medium">{log.reviewer}</span>
                          <span className="text-gray-600">·</span>
                          <span>{new Date(log.reviewDate).toLocaleString('zh-CN')}</span>
                        </div>
                        <p>{log.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
