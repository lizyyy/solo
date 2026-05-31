import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Undo2, Shield, Lightbulb, FileText, X } from 'lucide-react';
import useStore from '../store/useStore';
import StatusBadge from '../components/StatusBadge';

const ArtworkDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentArtwork, loading, fetchArtwork, markChecked, correctArtwork, addDispute, resolveDispute, revertCorrection } = useStore();

  const [showCorrect, setShowCorrect] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [correctField, setCorrectField] = useState('');
  const [correctValue, setCorrectValue] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [disputeField, setDisputeField] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBasis, setDisputeBasis] = useState('');
  const [revertId, setRevertId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState('');

  useEffect(() => {
    if (id) fetchArtwork(id);
  }, [id, fetchArtwork]);

  const handleMarkChecked = async () => {
    if (id) {
      await markChecked(id);
      await fetchArtwork(id);
    }
  };

  const handleCorrect = async () => {
    if (!id || !correctField || !correctValue || !correctReason) return;
    const oldVal = currentArtwork?.[correctField as keyof typeof currentArtwork];
    await correctArtwork(id, { field: correctField, old_value: String(oldVal || ''), new_value: correctValue, reason: correctReason });
    setShowCorrect(false);
    setCorrectField('');
    setCorrectValue('');
    setCorrectReason('');
    await fetchArtwork(id);
  };

  const handleDispute = async () => {
    if (!id || !disputeField || !disputeReason || !disputeBasis) return;
    await addDispute(id, {
      field: disputeField,
      current_value: String(currentArtwork?.[disputeField as keyof typeof currentArtwork] || ''),
      dispute_reason: disputeReason,
      correction_basis: disputeBasis
    });
    setShowDispute(false);
    setDisputeField('');
    setDisputeReason('');
    setDisputeBasis('');
    await fetchArtwork(id);
  };

  const handleResolveDispute = async (disputeId: string) => {
    await resolveDispute(disputeId);
    if (id) await fetchArtwork(id);
  };

  const handleRevert = async (correctionId: string) => {
    if (id && revertReason) {
      await revertCorrection(correctionId, revertReason);
      setRevertId(null);
      setRevertReason('');
      await fetchArtwork(id);
    }
  };

  const sourceIcons: Record<string, any> = { insurance: Shield, lighting: Lightbulb, artwork_list: FileText };
  const fieldLabels: Record<string, string> = { title: '作品名', artist: '艺术家', dimensions: '尺寸', dimension_unit: '单位', medium: '材质', year: '年份', status: '状态' };

  if (loading) return <div className="p-6 text-gallery-muted">加载中...</div>;
  if (!currentArtwork) return <div className="p-6 text-gallery-muted">作品不存在</div>;

  return (
    <div className="p-6">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gallery-amber mb-6 hover:underline">
        <ArrowLeft className="w-4 h-4" /> 返回总表
      </button>

      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{currentArtwork.title}</h1>
            <p className="text-gallery-muted">{currentArtwork.artist}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={currentArtwork.status} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '尺寸', value: `${currentArtwork.dimensions} ${currentArtwork.dimension_unit}` },
            { label: '材质', value: currentArtwork.medium },
            { label: '年份', value: currentArtwork.year },
            { label: '最后更新', value: currentArtwork.updated_at ? new Date(currentArtwork.updated_at).toLocaleDateString() : '-' },
          ].map((item) => (
            <div key={item.label} className="bg-gallery-surface border border-gallery-border rounded p-4">
              <div className="text-xs text-gallery-muted mb-1">{item.label}</div>
              <div className="font-mono text-sm">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleMarkChecked}
            className="flex items-center gap-2 px-4 py-2 bg-gallery-sage text-white rounded text-sm"
          >
            <CheckCircle className="w-4 h-4" /> 标记已核对
          </button>
          <button
            onClick={() => setShowCorrect(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gallery-amber text-gallery-amber rounded text-sm hover:bg-gallery-amber hover:text-white"
          >
            修正信息
          </button>
          <button
            onClick={() => setShowDispute(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gallery-rust text-gallery-rust rounded text-sm hover:bg-gallery-rust hover:text-white"
          >
            <AlertTriangle className="w-4 h-4" /> 标记争议
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">来源追溯</h2>
          <div className="space-y-4">
            {currentArtwork.sources?.map((source, idx) => {
              const Icon = sourceIcons[source.source_type];
              return (
                <div key={source.id} className="relative pl-6">
                  {idx < (currentArtwork.sources?.length || 0) - 1 && (
                    <div className="absolute left-2 top-6 w-px h-full bg-gallery-border" />
                  )}
                  <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-gallery-amber" />
                  <div className="bg-gallery-surface border border-gallery-border rounded p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-gallery-amber" />
                      <span className="text-sm font-medium">{source.source_title}</span>
                    </div>
                    <div className="text-xs text-gallery-muted">{source.source_summary}</div>
                    <div className="text-xs text-gallery-muted mt-2">
                      {new Date(source.imported_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">修正历史</h2>
          <div className="space-y-4">
            {currentArtwork.corrections?.map((corr, idx) => (
              <div key={corr.id} className={`relative pl-6 ${corr.reverted ? 'opacity-50' : ''}`}>
                {idx < (currentArtwork.corrections?.length || 0) - 1 && (
                  <div className="absolute left-2 top-8 w-px h-full bg-gallery-border" />
                )}
                <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${corr.reverted ? 'bg-gallery-muted' : 'bg-gallery-amber'}`} />
                <div className="bg-gallery-surface border border-gallery-border rounded p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium">{fieldLabels[corr.field] || corr.field}</span>
                    {!corr.reverted && (
                      <button onClick={() => setRevertId(corr.id)} className="text-xs text-gallery-amber hover:underline">
                        <Undo2 className="w-3 h-3 inline mr-1" />撤回
                      </button>
                    )}
                  </div>
                  <div className="font-mono text-sm mb-2">
                    <span className="line-through text-gallery-muted">{corr.old_value || '(空)'}</span>
                    <span className="mx-2">→</span>
                    <span className="text-gallery-amber">{corr.new_value}</span>
                  </div>
                  <div className="text-xs text-gallery-muted">原因: {corr.reason}</div>
                  {corr.reverted && (
                    <div className="text-xs text-gallery-muted mt-2">已撤回: {corr.revert_reason}
                    </div>
                  )}
                  <div className="text-xs text-gallery-muted mt-1">
                    {new Date(corr.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {currentArtwork.disputes?.filter(d => !d.resolved).length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4 text-gallery-rust">争议标记</h2>
          <div className="border border-yellow-600/50 bg-yellow-900/20 rounded p-4">
            {currentArtwork.disputes.filter(d => !d.resolved).map(dispute => (
              <div key={dispute.id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium mb-1">{fieldLabels[dispute.field] || dispute.field}: {dispute.current_value}
                    </div>
                    <div className="text-xs text-gallery-muted">争议原因: {dispute.dispute_reason}
                    </div>
                    <div className="text-xs text-gallery-muted">修正依据: {dispute.correction_basis}
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveDispute(dispute.id)}
                    className="text-xs text-gallery-sage hover:underline"
                  >
                    解决争议
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCorrect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gallery-surface border border-gallery-border rounded p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">修正信息</h3>
              <button onClick={() => setShowCorrect(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gallery-muted mb-1">选择字段</label>
                <select
                  className="w-full px-3 py-2 rounded text-sm"
                  value={correctField}
                  onChange={(e) => setCorrectField(e.target.value)}
                >
                  <option value="">请选择</option>
                  {Object.entries(fieldLabels).map(([k, v]) => <option key={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gallery-muted mb-1">新值</label>
                <input
                  className="w-full px-3 py-2 rounded text-sm"
                  value={correctValue}
                  onChange={(e) => setCorrectValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gallery-muted mb-1">修正原因</label>
                <textarea
                  className="w-full px-3 py-2 rounded text-sm"
                  rows={3}
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                />
              </div>
              <button
                onClick={handleCorrect}
                className="w-full py-2 bg-gallery-amber text-white rounded text-sm"
              >
                确认修正
              </button>
            </div>
          </div>
        </div>
      )}

      {showDispute && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gallery-surface border border-gallery-border rounded p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">标记争议</h3>
              <button onClick={() => setShowDispute(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gallery-muted mb-1">争议字段</label>
                <select
                  className="w-full px-3 py-2 rounded text-sm"
                  value={disputeField}
                  onChange={(e) => setDisputeField(e.target.value)}
                >
                  <option value="">请选择</option>
                  {Object.entries(fieldLabels).map(([k, v]) => <option key={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gallery-muted mb-1">争议原因</label>
                <textarea
                  className="w-full px-3 py-2 rounded text-sm"
                  rows={2}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gallery-muted mb-1">修正依据</label>
                <textarea
                  className="w-full px-3 py-2 rounded text-sm"
                  rows={2}
                  value={disputeBasis}
                  onChange={(e) => setDisputeBasis(e.target.value)}
                />
              </div>
              <button
                onClick={handleDispute}
                className="w-full py-2 bg-gallery-rust text-white rounded text-sm"
              >
                确认标记
              </button>
            </div>
          </div>
        </div>
      )}

      {revertId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gallery-surface border border-gallery-border rounded p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">撤回修正</h3>
              <button onClick={() => { setRevertId(null); setRevertReason(''); }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gallery-muted mb-1">撤回原因</label>
                <textarea
                  className="w-full px-3 py-2 rounded text-sm"
                  rows={3}
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleRevert(revertId)}
                className="w-full py-2 bg-gallery-amber text-white rounded text-sm"
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtworkDetail;
