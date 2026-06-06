import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, AlertTriangle, CheckCircle, XCircle, Eye, Music } from 'lucide-react';
import { useRoyaltyStore } from '../store/useRoyaltyStore';
import StatusBadge from '../components/StatusBadge';

export default function ReviewWorkbench() {
  const { records, initData, reviewRecord } = useRoyaltyStore();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    initData();
  }, [initData]);

  const pendingRecords = records.filter(r => r.status === 'review');

  const handleReview = (recordId: string, action: 'approve' | 'reject') => {
    reviewRecord(recordId, action, reviewNote || (action === 'approve' ? '复核通过' : '请重新检查'));
    setSelectedRecord(null);
    setReviewNote('');
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-primary-800">复核工作台</h1>
        <p className="text-primary-500 mt-1">版权运营人员复核包含返工原因的分账记录</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">待复核</div>
          <div className="text-3xl font-serif font-semibold text-accent-warning">
            {pendingRecords.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">已完成</div>
          <div className="text-3xl font-serif font-semibold text-accent-success">
            {records.filter(r => r.status === 'completed').length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">总记录</div>
          <div className="text-3xl font-serif font-semibold text-primary-700">
            {records.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">返工轨道数</div>
          <div className="text-3xl font-serif font-semibold text-accent-rework">
            {records.reduce((acc, r) => acc + r.tracks.filter(t => t.hasReworkReason).length, 0)}
          </div>
        </div>
      </div>

      {pendingRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card border border-primary-100 p-12 text-center">
          <CheckSquare className="w-16 h-16 text-accent-success mx-auto mb-4" />
          <h3 className="font-medium text-primary-800 text-lg mb-2">太棒了！</h3>
          <p className="text-primary-500">当前没有待复核的记录，所有分账都已处理完毕。</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
          <div className="p-4 border-b border-primary-100 bg-accent-warningLight/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent-warning" />
              <h2 className="font-serif font-semibold text-primary-800">待复核列表</h2>
              <span className="ml-auto text-sm text-accent-warning font-medium">
                {pendingRecords.length} 条待处理
              </span>
            </div>
          </div>

          <div className="divide-y divide-primary-100">
            {pendingRecords.map(record => {
              const reworkTracks = record.tracks.filter(t => t.hasReworkReason);
              const isExpanded = selectedRecord === record.id;

              return (
                <div key={record.id}>
                  <div
                    className="p-4 cursor-pointer hover:bg-primary-50 transition-colors"
                    onClick={() => setSelectedRecord(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-accent-reworkLight rounded-lg flex items-center justify-center flex-shrink-0">
                        <Music className="w-6 h-6 text-accent-rework" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-primary-800">{record.contractNo}</h3>
                          <StatusBadge status={record.status} />
                        </div>
                        <p className="text-sm text-primary-500 mt-0.5">{record.recordStore}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-primary-400">
                          <span>导入日期：{record.importDate}</span>
                          <span>
                            <span className="text-accent-rework font-medium">{reworkTracks.length}</span> 条返工轨道
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/record/${record.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-500 hover:text-primary-700 hover:bg-primary-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        查看详情
                      </Link>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-primary-50 border-t border-primary-100">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-primary-700 mb-2">返工原因列表</h4>
                        <div className="space-y-2">
                          {reworkTracks.map(track => (
                            <div
                              key={track.id}
                              className="p-3 bg-white rounded-lg border border-accent-rework/20"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-accent-reworkLight flex items-center justify-center text-xs font-medium text-accent-rework">
                                  {track.trackNumber}
                                </span>
                                <span className="font-medium text-primary-800">{track.name}</span>
                              </div>
                              <p className="text-sm text-accent-rework mt-1.5 ml-8">
                                {track.reworkReason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {record.reviewNote && (
                        <div className="mb-4 p-3 bg-accent-goldLight/30 rounded-lg border border-accent-gold/30">
                          <p className="text-xs text-primary-500 mb-1">提交备注</p>
                          <p className="text-sm text-primary-700">{record.reviewNote}</p>
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-primary-700 mb-1">复核备注</label>
                        <textarea
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          placeholder="输入复核意见（可选）"
                          className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                          rows={2}
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleReview(record.id, 'reject')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-accent-reworkLight text-accent-rework rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          驳回
                        </button>
                        <button
                          onClick={() => handleReview(record.id, 'approve')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-accent-success text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          通过
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
