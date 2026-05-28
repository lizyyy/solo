import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { AuditAction, BusinessStatus } from '@/types';
import { ACTION_LABELS, PURPOSE_CODE_RULES } from '@/constants/purposeCodes';
import { useBusinessStore } from '@/store/businessStore';

interface ActionModalProps {
  businessId: string;
  action: AuditAction;
  currentStatus: BusinessStatus;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ActionModal = ({ businessId, action, currentStatus, onClose, onSuccess }: ActionModalProps) => {
  const [remark, setRemark] = useState('');
  const [supplementType, setSupplementType] = useState<'contract' | 'invoice' | 'purpose'>('contract');
  const [purposeCode, setPurposeCode] = useState('');
  const [purposeName, setPurposeName] = useState('');
  const [documentData, setDocumentData] = useState<Record<string, string>>({});
  const [coversOriginal, setCoversOriginal] = useState(true);
  const [manualIssueDesc, setManualIssueDesc] = useState('');
  const [manualIssueSeverity, setManualIssueSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [loading, setLoading] = useState(false);

  const { performAction, updatePurposeCode, uploadSupplement, addManualIssue, currentUser, getBusinessById } = useBusinessStore();

  const business = getBusinessById(businessId);
  if (!business) return null;

  const isSupplementAction = action === 'request_supplement' || action === 'upload_supplement';
  const isReviewAction = action === 'review_pass' || action === 'review_reject';
  const isUpdatePurpose = action === 'upload_supplement' && supplementType === 'purpose';
  const isAddIssue = action === 'detect_issue';

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (isUpdatePurpose && purposeCode) {
        updatePurposeCode(businessId, purposeCode, purposeName);
      } else if (action === 'upload_supplement' && supplementType !== 'purpose') {
        const latestApp = business.applications[business.applications.length - 1];
        uploadSupplement(
          businessId,
          supplementType,
          {
            ...documentData,
            amount: parseFloat(documentData.amount) || latestApp.amount,
            currency: documentData.currency || latestApp.currency,
          },
          remark,
          coversOriginal
        );
      } else if (isAddIssue && manualIssueDesc) {
        addManualIssue(businessId, manualIssueDesc, manualIssueSeverity);
      } else {
        await performAction(businessId, action, remark);
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurposeCodeChange = (code: string) => {
    setPurposeCode(code);
    const rule = PURPOSE_CODE_RULES.find((r) => r.code === code);
    setPurposeName(rule?.name || '');
  };

  const getActionWarning = () => {
    if (action === 'review_reject') return '此操作将拒绝该业务，业务状态将变为"已拒绝"，请谨慎操作';
    if (action === 'withdraw') return '此操作将撤回已确认的业务，业务状态将变为"已撤回"';
    if (action === 'review_pass') return '此操作将确认通过该业务，请确保所有问题已处理完毕';
    return null;
  };

  const warning = getActionWarning();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {ACTION_LABELS[action] || action}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              业务编号: {business.businessNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {warning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-amber-700">{warning}</p>
            </div>
          )}

          {isSupplementAction && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                补件类型
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'contract', label: '合同' },
                  { value: 'invoice', label: '发票' },
                  { value: 'purpose', label: '用途代码' },
                ].map((type) => (
                  <label
                    key={type.value}
                    className={`flex-1 flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      supplementType === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="supplementType"
                      value={type.value}
                      checked={supplementType === type.value}
                      onChange={(e) => setSupplementType(e.target.value as any)}
                      className="sr-only"
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {isUpdatePurpose && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择正确的用途代码
              </label>
              <select
                value={purposeCode}
                onChange={(e) => handlePurposeCodeChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择用途代码</option>
                {PURPOSE_CODE_RULES.map((rule) => (
                  <option key={rule.code} value={rule.code}>
                    {rule.code} - {rule.name} ({rule.category})
                  </option>
                ))}
              </select>
              {purposeName && (
                <p className="mt-2 text-sm text-emerald-600">
                  已选择: {purposeName}
                </p>
              )}
            </div>
          )}

          {action === 'upload_supplement' && supplementType !== 'purpose' && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {supplementType === 'contract' ? '合同编号' : '发票编号'}
                </label>
                <input
                  type="text"
                  value={documentData[supplementType === 'contract' ? 'contractNo' : 'invoiceNo'] || ''}
                  onChange={(e) =>
                    setDocumentData({
                      ...documentData,
                      [supplementType === 'contract' ? 'contractNo' : 'invoiceNo']: e.target.value,
                    })
                  }
                  placeholder={`请输入${supplementType === 'contract' ? '合同' : '发票'}编号`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  金额
                </label>
                <input
                  type="number"
                  value={documentData.amount || ''}
                  onChange={(e) =>
                    setDocumentData({ ...documentData, amount: e.target.value })
                  }
                  placeholder="请输入金额"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  币种
                </label>
                <input
                  type="text"
                  value={documentData.currency || 'USD'}
                  onChange={(e) =>
                    setDocumentData({ ...documentData, currency: e.target.value })
                  }
                  placeholder="USD / EUR 等"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {supplementType === 'contract' ? '合同日期' : '发票日期'}
                </label>
                <input
                  type="date"
                  value={documentData[supplementType === 'contract' ? 'contractDate' : 'invoiceDate'] || ''}
                  onChange={(e) =>
                    setDocumentData({
                      ...documentData,
                      [supplementType === 'contract' ? 'contractDate' : 'invoiceDate']: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  货物描述
                </label>
                <textarea
                  value={documentData.goodsDescription || ''}
                  onChange={(e) =>
                    setDocumentData({ ...documentData, goodsDescription: e.target.value })
                  }
                  placeholder="请输入货物描述"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={coversOriginal}
                  onChange={(e) => setCoversOriginal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">此补件覆盖原有{supplementType === 'contract' ? '合同' : '发票'}</span>
              </label>
            </div>
          )}

          {isAddIssue && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  问题描述
                </label>
                <textarea
                  value={manualIssueDesc}
                  onChange={(e) => setManualIssueDesc(e.target.value)}
                  placeholder="请描述发现的问题..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  风险等级
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'low', label: '低风险', color: 'bg-slate-100 border-slate-300 text-slate-700' },
                    { value: 'medium', label: '中风险', color: 'bg-amber-100 border-amber-300 text-amber-700' },
                    { value: 'high', label: '高风险', color: 'bg-red-100 border-red-300 text-red-700' },
                  ].map((level) => (
                    <label
                      key={level.value}
                      className={`flex-1 flex items-center justify-center p-2 border-2 rounded-lg cursor-pointer transition-colors ${
                        manualIssueSeverity === level.value ? level.color : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="severity"
                        value={level.value}
                        checked={manualIssueSeverity === level.value}
                        onChange={(e) => setManualIssueSeverity(e.target.value as any)}
                        className="sr-only"
                      />
                      {level.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {isReviewAction || action === 'withdraw' ? '审核意见' : '备注说明'}
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入说明..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">
              操作人: {currentUser.name} ({currentUser.role === 'supervisor' ? '主管' : currentUser.role === 'auditor' ? '审计' : '柜员'})
            </p>
            <p className="text-xs text-slate-500 mt-1">
              状态变化: {currentStatus} → {
                action === 'review_pass' ? 'confirmed' :
                action === 'review_reject' ? (currentStatus === 'duplicate_check' ? 'rejected' : 'issue_found') :
                action === 'withdraw' ? 'withdrawn' :
                action === 'resubmit' ? 'pending' :
                action === 'request_supplement' ? 'supplementing' :
                action === 'upload_supplement' ? 'processing' :
                currentStatus
              }
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (remark.trim() === '' && !isAddIssue && !isUpdatePurpose && action !== 'resubmit')}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : '确认操作'}
          </button>
        </div>
      </div>
    </div>
  );
};
