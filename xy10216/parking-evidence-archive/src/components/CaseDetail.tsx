import React, { useState } from 'react';
import type { ParkingCase, EvidenceType } from '../types';
import { 
  getStatusLabel, 
  getStatusColor, 
  getEvidenceTypeLabel, 
  formatCurrency, 
  formatDateTime 
} from '../utils/helpers';
import { useAppContext } from '../context/AppContext';

interface CaseDetailProps {
  caseData: ParkingCase;
  onEdit: () => void;
}

const CaseDetail: React.FC<CaseDetailProps> = ({ caseData, onEdit }) => {
  const { addPayment, addEvidence, reviewManualRelease, exportCase, updateCaseStatus } = useAppContext();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('other');
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [reviewApproved, setReviewApproved] = useState(true);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewer, setReviewer] = useState('');

  const handlePayment = () => {
    if (!paymentAmount || !paymentMethod) return;
    
    addPayment(caseData.id, {
      amount: parseFloat(paymentAmount),
      timestamp: new Date().toISOString(),
      method: paymentMethod,
    });
    
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentMethod('');
  };

  const handleAddEvidence = () => {
    if (!evidenceName) return;
    
    addEvidence(caseData.id, {
      type: evidenceType,
      name: evidenceName,
      placeholder: false,
      uploadedAt: new Date().toISOString(),
      size: '0KB',
      description: evidenceDescription,
    });
    
    setShowEvidenceModal(false);
    setEvidenceName('');
    setEvidenceDescription('');
  };

  const handleReview = (releaseId: string) => {
    if (!reviewComment || !reviewer) return;
    
    reviewManualRelease(caseData.id, releaseId, reviewApproved, reviewer, reviewComment);
    
    setShowReviewModal(null);
    setReviewComment('');
    setReviewer('');
  };

  const handleExport = () => {
    if (!reviewer) return;
    exportCase(caseData.id, reviewer);
    setReviewer('');
  };

  const pendingAmount = caseData.feeAmount - caseData.paidAmount;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-800">{caseData.plateNumber}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(caseData.status)}`}>
                    {getStatusLabel(caseData.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">案件编号: {caseData.id}</p>
              </div>
              <button
                onClick={onEdit}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                编辑案件
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50">
            <div>
              <div className="text-sm text-gray-500">入场时间</div>
              <div className="font-medium">{formatDateTime(caseData.entryTime)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">出场时间</div>
              <div className="font-medium">{formatDateTime(caseData.exitTime)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">停车时长</div>
              <div className="font-medium">{caseData.duration}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">创建时间</div>
              <div className="font-medium">{formatDateTime(caseData.createdAt)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">应付金额</div>
              <div className="text-xl font-bold text-gray-800">{formatCurrency(caseData.feeAmount)}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">已付金额</div>
              <div className="text-xl font-bold text-green-700">{formatCurrency(caseData.paidAmount)}</div>
            </div>
            <div className={`text-center p-4 rounded-lg ${pendingAmount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <div className="text-sm text-gray-500 mb-1">待付金额</div>
              <div className={`text-xl font-bold ${pendingAmount > 0 ? 'text-red-700' : 'text-gray-800'}`}>
                {formatCurrency(pendingAmount)}
              </div>
            </div>
          </div>

          {caseData.remarks && (
            <div className="px-6 pb-6">
              <div className="text-sm text-gray-500 mb-1">备注</div>
              <div className="p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
                {caseData.remarks}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">证据附件</h3>
              <button
                onClick={() => setShowEvidenceModal(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                + 添加证据
              </button>
            </div>
            <div className="p-4 space-y-3">
              {caseData.evidences.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📎</div>
                  <p>暂无证据附件</p>
                </div>
              ) : (
                caseData.evidences.map(evidence => (
                  <div
                    key={evidence.id}
                    className={`p-4 rounded-lg border ${evidence.placeholder ? 'border-dashed border-orange-300 bg-orange-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {evidence.placeholder ? '📝' : '📄'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{evidence.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {getEvidenceTypeLabel(evidence.type)}
                            {evidence.size && ` • ${evidence.size}`}
                            {evidence.uploadedAt && ` • ${formatDateTime(evidence.uploadedAt)}`}
                          </div>
                        </div>
                      </div>
                      {evidence.placeholder && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                          待补录
                        </span>
                      )}
                    </div>
                    {evidence.description && (
                      <div className="mt-2 text-sm text-gray-600">
                        {evidence.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">人工放行记录</h3>
            </div>
            <div className="p-4 space-y-3">
              {caseData.manualReleases.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🚗</div>
                  <p>无人工放行记录</p>
                </div>
              ) : (
                caseData.manualReleases.map(release => (
                  <div key={release.id} className="p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👮</span>
                        <span className="font-medium">{release.operator}</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${release.reviewed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {release.reviewed ? '已复核' : '待复核'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      {formatDateTime(release.timestamp)}
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      <span className="text-gray-500">放行理由: </span>
                      <span className="text-gray-800">{release.reason}</span>
                    </div>
                    {release.reviewed && release.reviewComment && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <span className="text-gray-500">复核意见 ({release.reviewer}): </span>
                        <span className="text-gray-800">{release.reviewComment}</span>
                      </div>
                    )}
                    {!release.reviewed && (
                      <button
                        onClick={() => {
                          setShowReviewModal(release.id);
                          setReviewApproved(true);
                        }}
                        className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        复核放行记录
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">补缴记录</h3>
              {pendingAmount > 0 && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  + 记录补缴
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              {caseData.payments.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">💰</div>
                  <p>暂无补缴记录</p>
                </div>
              ) : (
                caseData.payments.map(payment => (
                  <div key={payment.id} className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-green-800">{formatCurrency(payment.amount)}</div>
                        <div className="text-xs text-gray-500">
                          {payment.method} • {formatDateTime(payment.timestamp)}
                        </div>
                      </div>
                      <span className="text-lg">✅</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">案件时间线</h3>
            </div>
            <div className="p-4">
              <div className="relative">
                {caseData.timeline.map((event, index) => (
                  <div key={event.id} className="flex gap-4 mb-6 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        event.type === 'event' ? 'bg-blue-500' :
                        event.type === 'review' ? 'bg-yellow-500' :
                        event.type === 'payment' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`} />
                      {index < caseData.timeline.length - 1 && (
                        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">{event.description}</span>
                        {event.operator && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {event.operator}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{formatDateTime(event.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-center gap-3">
            {caseData.status === 'pending_review' && (
              <>
                <button
                  onClick={() => {
                    if (window.confirm('确认通过该案件的复核？')) {
                      updateCaseStatus(caseData.id, 'approved', '当前操作员', '复核通过，证据链完整');
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  通过复核
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt('请输入拒绝理由:');
                    if (reason) {
                      updateCaseStatus(caseData.id, 'rejected', '当前操作员', `拒绝: ${reason}`);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  拒绝案件
                </button>
              </>
            )}

            {(caseData.status === 'approved' || caseData.status === 'payment_completed') && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="操作员姓名"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleExport}
                  disabled={!reviewer}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📦 导出案件包
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">记录补缴</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">补缴金额 (元)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={`最高 ${pendingAmount}`}
                  max={pendingAmount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支付方式</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">请选择</option>
                  <option value="微信支付">微信支付</option>
                  <option value="支付宝">支付宝</option>
                  <option value="现金">现金</option>
                  <option value="银行转账">银行转账</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handlePayment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvidenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">添加证据附件</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">证据类型</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="entry_image">入场图片</option>
                  <option value="exit_record">出场记录</option>
                  <option value="manual_release">人工放行</option>
                  <option value="payment_proof">补缴凭证</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">文件名称</label>
                <input
                  type="text"
                  value={evidenceName}
                  onChange={(e) => setEvidenceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="例如: 入场照片_20240510.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                <textarea
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="可选，简要描述证据内容"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowEvidenceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleAddEvidence}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">复核人工放行记录</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">复核结果</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={reviewApproved}
                      onChange={() => setReviewApproved(true)}
                      className="w-4 h-4"
                    />
                    <span>通过</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!reviewApproved}
                      onChange={() => setReviewApproved(false)}
                      className="w-4 h-4"
                    />
                    <span>拒绝</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">复核人</label>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="请输入复核人姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">复核意见</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="请输入复核意见"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowReviewModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={() => handleReview(showReviewModal)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
