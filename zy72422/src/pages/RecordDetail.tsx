import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Image, Music, Clock, AlertTriangle, Tags, RefreshCw, Edit3, CheckCircle, XCircle } from 'lucide-react';
import { useRoyaltyStore } from '../store/useRoyaltyStore';
import StatusBadge from '../components/StatusBadge';
import EvidenceTimeline from '../components/EvidenceTimeline';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const { getRecordById, initData, updateTrackAlias, addEvidenceNode, addRehearsalChange, reviewRecord, currentOperator } = useRoyaltyStore();
  const [record, setRecord] = useState(getRecordById(id || ''));
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [oldAliasInput, setOldAliasInput] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    initData();
    setRecord(getRecordById(id || ''));
  }, [id, initData, getRecordById]);

  if (!record) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-medium text-primary-600 mb-2">记录不存在</h3>
        <Link to="/" className="text-primary-500 hover:text-primary-700">返回看板</Link>
      </div>
    );
  }

  const handleUpdateAlias = (trackId: string) => {
    if (!aliasInput.trim()) return;
    
    updateTrackAlias(record.id, trackId, aliasInput, oldAliasInput || undefined);
    
    addEvidenceNode(record.id, {
      type: 'alias_update',
      title: '补录/更新曲目别名',
      description: `为轨道更新别名：${aliasInput}${oldAliasInput ? `，旧口径：${oldAliasInput}` : ''}`,
      operator: currentOperator,
    });

    addRehearsalChange(record.id, {
      trackId,
      changeType: 'alias',
      oldValue: '无别名',
      newValue: aliasInput,
      changedBy: currentOperator,
    });

    addEvidenceNode(record.id, {
      type: 'rehearsal_update',
      title: '排练变更记录更新',
      description: '别名更新后，关联的排练变更记录已同步',
      operator: '系统',
    });

    setEditingTrack(null);
    setAliasInput('');
    setOldAliasInput('');
    setRecord(getRecordById(record.id));
  };

  const handleReview = (action: 'approve' | 'reject') => {
    reviewRecord(record.id, action, reviewNote || (action === 'approve' ? '复核通过' : '请重新检查返工原因'));
    setShowReviewModal(false);
    setReviewNote('');
    setRecord(getRecordById(record.id));
  };

  const reworkTracks = record.tracks.filter(t => t.hasReworkReason);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="flex items-center gap-1 text-primary-500 hover:text-primary-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回看板
        </Link>
        <div className="flex-1" />
        <StatusBadge status={record.status} />
        {record.status === 'review' && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-warning hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            版权运营复核
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100 flex items-center gap-2">
              <Image className="w-5 h-5 text-primary-500" />
              <h2 className="font-serif font-semibold text-primary-800">合同页截图</h2>
            </div>
            <div className="p-4">
              <img
                src={record.contractImage}
                alt="合同截图"
                className="w-full rounded-lg border border-primary-200"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100 flex items-center gap-2">
              <Music className="w-5 h-5 text-primary-500" />
              <h2 className="font-serif font-semibold text-primary-800">轨道信息</h2>
              <span className="ml-0 text-sm text-primary-400">({record.tracks.length} 条)</span>
            </div>
            <div className="divide-y divide-primary-100">
              {record.tracks.map(track => (
                <div key={track.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                        {track.trackNumber}
                      </span>
                      <h3 className="font-medium text-primary-800">{track.name}</h3>
                      {track.hasReworkReason && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-reworkLight text-accent-rework">
                          <AlertTriangle className="w-3 h-3" />
                          返工
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-primary-500 mt-2 ml-11">{track.remark}</p>
                    {track.reworkReason && (
                      <div className="ml-11 mt-2 p-2 bg-accent-reworkLight/50 rounded-lg border border-accent-rework/20">
                        <p className="text-sm text-accent-rework font-medium">返工原因：{track.reworkReason}</p>
                      </div>
                    )}

                    <div className="ml-11 mt-3 flex items-center gap-3 flex-wrap">
                      {track.alias && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent-goldLight text-amber-700">
                          <Tags className="w-3 h-3" />
                          别名：{track.alias}
                        </span>
                      )}
                      {track.oldAlias && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary-100 text-primary-600">
                          旧口径：{track.oldAlias}
                        </span>
                      )}
                      {editingTrack !== track.id && !track.alias && (
                        <span className="text-xs text-primary-400">暂无别名</span>
                      )}
                    </div>

                    {editingTrack === track.id && (
                      <div className="ml-11 mt-3 space-y-2">
                      <input
                          type="text"
                          value={aliasInput}
                          onChange={e => setAliasInput(e.target.value)}
                          placeholder="输入别名（如英文名）"
                          className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      <input
                          type="text"
                          value={oldAliasInput}
                          onChange={e => setOldAliasInput(e.target.value)}
                          placeholder="旧口径名称（可选）"
                          className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      <div className="flex gap-2">
                        <button
                            onClick={() => handleUpdateAlias(track.id)}
                            className="px-3 py-1.5 text-sm bg-primary-700 text-white rounded-md hover:bg-primary-600 transition-colors"
                          >
                            保存
                          </button>
                        <button
                            onClick={() => {
                              setEditingTrack(null);
                              setAliasInput('');
                              setOldAliasInput('');
                            }}
                            className="px-3 py-1.5 text-sm text-primary-500 hover:text-primary-700"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                    {editingTrack !== track.id && record.status !== 'completed' && (
                      <button
                        onClick={() => {
                          setEditingTrack(track.id);
                          setAliasInput(track.alias || '');
                          setOldAliasInput(track.oldAlias || '');
                        }}
                        className="flex-shrink-0 p-2 text-primary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {record.rehearsalChanges.length > 0 && (
            <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
              <div className="p-4 border-b border-primary-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary-500" />
                <h2 className="font-serif font-semibold text-primary-800">排练变更记录</h2>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {record.rehearsalChanges.map(change => {
                    const track = record.tracks.find(t => t.id === change.trackId);
                    return (
                      <div key={change.id} className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-primary-400 mt-2" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary-700 text-sm">{track?.name || '未知曲目'}</span>
                            <span className="text-xs text-primary-400">
                              {change.changeType === 'alias' ? '别名变更' : change.changeType === 'name' ? '名称变更' : '其他变更'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="text-primary-500 line-through">{change.oldValue}</span>
                            <span className="text-primary-300">→</span>
                            <span className="text-primary-700 font-medium">{change.newValue}</span>
                          </div>
                          <div className="text-xs text-primary-400 mt-1">
                            {change.changedBy} · {change.changedAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100">
              <h2 className="font-serif font-semibold text-primary-800">合同信息</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-primary-500">合同编号</span>
                <span className="font-medium text-primary-800">{record.contractNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-500">唱片店</span>
                <span className="font-medium text-primary-800">{record.recordStore}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-500">导入日期</span>
                <span className="font-medium text-primary-800">{record.importDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-500">轨道数</span>
                <span className="font-medium text-primary-800">{record.tracks.length}</span>
              </div>
              {reworkTracks.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-accent-rework">待复核轨道</span>
                  <span className="font-medium text-accent-rework">{reworkTracks.length}</span>
                </div>
              )}
              {record.reviewNote && (
                <div className="pt-3 border-t border-primary-100">
                  <p className="text-xs text-primary-500 mb-1">复核备注</p>
                  <p className="text-sm text-primary-700">{record.reviewNote}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
            <div className="p-4 border-b border-primary-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-500" />
              <h2 className="font-serif font-semibold text-primary-800">证据链时间线</h2>
            </div>
            <div className="p-4">
              <EvidenceTimeline evidence={record.evidenceChain} />
            </div>
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 animate-slide-up">
            <div className="p-4 border-b border-primary-100">
              <h3 className="font-serif font-semibold text-primary-800 text-lg">版权运营复核</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-primary-600 mb-4">
                该合同包含 {reworkTracks.length} 条轨道存在返工原因，请确认后进行复核。
              </p>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="输入复核备注（可选）"
                className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                rows={3}
              />
            </div>
            <div className="p-4 border-t border-primary-100 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-primary-500 hover:text-primary-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleReview('reject')}
                className="px-4 py-2 bg-accent-reworkLight text-accent-rework rounded-lg hover:bg-red-100 transition-colors"
              >
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  驳回
                </span>
              </button>
              <button
                onClick={() => handleReview('approve')}
                className="px-4 py-2 bg-accent-success text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  通过
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
