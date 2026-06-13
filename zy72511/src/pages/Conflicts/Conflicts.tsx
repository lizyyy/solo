import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, X, ExternalLink, Send, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getSampleTypeLabel, getSampleTypeColor, getStatusLabel, getStatusColor } from '../../utils';
import { AttributionStatus } from '../../types';

const Conflicts: React.FC = () => {
  const navigate = useNavigate();
  const { samples, getConflicts, confirmSample, rejectSample, submitForReview, currentUser } = useStore();
  const [remark, setRemark] = useState('');
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'confirm' | 'reject' | 'review' | null>(null);

  const conflictSamples = getConflicts();

  const handleConfirm = () => {
    if (!selectedSample || !remark.trim()) {
      alert('请填写确认原因');
      return;
    }
    confirmSample(selectedSample, remark, currentUser.name, currentUser.role);
    setShowModal(null);
    setSelectedSample(null);
    setRemark('');
  };

  const handleReject = () => {
    if (!selectedSample || !remark.trim()) {
      alert('请填写驳回原因');
      return;
    }
    rejectSample(selectedSample, remark, currentUser.name, currentUser.role);
    setShowModal(null);
    setSelectedSample(null);
    setRemark('');
  };

  const handleSubmitReview = () => {
    if (!selectedSample) return;
    submitForReview(selectedSample, currentUser.name, currentUser.role);
    setShowModal(null);
    setSelectedSample(null);
  };

  const openModal = (type: 'confirm' | 'reject' | 'review', sampleId: string) => {
    setSelectedSample(sampleId);
    setShowModal(type);
    setRemark('');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          冲突处理中心
        </h2>
        <p className="text-sm text-slate-500">
          脱敏规则备注与灰度批次存在冲突的样本列表，请人工确认或提交运营复核
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">处理原则</p>
            <p className="text-xs text-amber-700 mt-1">
              当脱敏规则备注和灰度批次互相矛盾时，先列出冲突证据，由 AI 产品经理阿宁选择确认或驳回，不要替业务同事自动拍板。
              碰到模型版本换了但样本编号没变时，别急着归正常，留给运营复核人复核。
            </p>
          </div>
        </div>
      </div>

      {conflictSamples.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-800 mb-2">暂无冲突样本</p>
          <p className="text-sm text-slate-500">所有样本的脱敏规则备注与灰度批次信息一致</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflictSamples.map((sample) => (
            <div
              key={sample.id}
              className="bg-white rounded-lg border-2 border-red-200 overflow-hidden"
            >
              <div className="bg-red-50 px-5 py-3 border-b border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-red-600" />
                  <span className="font-medium text-red-800">样本 {sample.sampleNo}</span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${getSampleTypeColor(sample.type)}`}>
                    {getSampleTypeLabel(sample.type)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(sample.status)}`}>
                    {getStatusLabel(sample.status)}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/sample/${sample.id}`)}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  查看详情
                  <ExternalLink size={12} />
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-2">脱敏规则备注主张</p>
                    <p className="text-sm text-slate-700">
                      {sample.conflictEvidence?.desensitizationClaim}
                    </p>
                  </div>
                  <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                    <p className="text-xs font-medium text-violet-700 mb-2">灰度批次信息主张</p>
                    <p className="text-sm text-slate-700">
                      {sample.conflictEvidence?.grayBatchClaim}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">冲突点</p>
                  <ul className="space-y-1">
                    {sample.conflictEvidence?.conflictPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-red-500 mt-0.5">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {sample.status === AttributionStatus.CONFLICT && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600 mb-3">
                      AI 产品经理阿宁，请选择：
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal('confirm', sample.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors"
                      >
                        <Check size={16} />
                        确认脱敏规则主张
                      </button>
                      <button
                        onClick={() => openModal('reject', sample.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        <X size={16} />
                        确认灰度批次主张
                      </button>
                      <button
                        onClick={() => openModal('review', sample.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors ml-auto"
                      >
                        <Send size={16} />
                        提交运营复核
                      </button>
                    </div>
                  </div>
                )}

                {sample.status === AttributionStatus.PENDING_REVIEW && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-amber-600 mb-3">
                      <Send size={16} />
                      <span className="text-sm font-medium">已提交运营复核，请运营复核人最终确认：</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      模型版本换了但样本编号没变，您来拍板最终以哪方为准：
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal('confirm', sample.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors"
                      >
                        <Check size={16} />
                        运营确认：以脱敏规则为准
                      </button>
                      <button
                        onClick={() => openModal('reject', sample.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        <X size={16} />
                        运营确认：以灰度批次为准
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {showModal === 'confirm' && '确认脱敏规则主张'}
              {showModal === 'reject' && '确认灰度批次主张'}
              {showModal === 'review' && '提交运营复核'}
            </h3>

            {showModal !== 'review' && (
              <div className="mb-4">
                <label className="text-xs text-slate-500 mb-1 block">决策原因（必填）</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请输入决策原因..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            )}

            {showModal === 'review' && (
              <p className="text-sm text-slate-600 mb-4">
                确定要将此样本提交运营复核吗？运营复核人将进行最终确认。
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowModal(null);
                  setSelectedSample(null);
                  setRemark('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={
                  showModal === 'confirm'
                    ? handleConfirm
                    : showModal === 'reject'
                    ? handleReject
                    : handleSubmitReview
                }
                className={`px-4 py-2 text-sm text-white rounded transition-colors ${
                  showModal === 'confirm'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : showModal === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conflicts;
