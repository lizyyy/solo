import React, { useState } from 'react';
import {
  Zap,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  ListChecks,
  User,
} from 'lucide-react';
import { FlashLoanRequest, LoanItem, User as UserType } from '@/types';
import { StatusBadge } from './StatusBadge';
import { VersionDiff } from './VersionDiff';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface FlashLoansProps {
  flashLoans: FlashLoanRequest[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  currentUser: UserType;
  onSubmit: (title: string, description: string, changes: LoanItem[]) => void;
  onOverride: (loanId: string, newStatus: FlashLoanRequest['status'], reason: string) => void;
  mockUsers: UserType[];
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  material_only: '仅补材料',
  conclusion_changed: '结论变更',
  needs_confirmation: '待确认',
  approved: '已批准',
  rejected: '已拒绝',
};

const changeTypeLabels: Record<string, string> = {
  material_supplement: '补充材料',
  conclusion_revision: '结论修订',
  both: '两者兼有',
};

export const FlashLoans: React.FC<FlashLoansProps> = ({
  flashLoans,
  selectedId,
  onSelect,
  currentUser,
  onSubmit,
  onOverride,
  mockUsers,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedJudgment, setExpandedJudgment] = useState<string | null>(null);
  const [newLoan, setNewLoan] = useState({
    title: '',
    description: '',
    changes: [] as LoanItem[],
  });
  const [overrideForm, setOverrideForm] = useState<{ loanId: string; status: FlashLoanRequest['status']; reason: string } | null>(null);

  const addChangeItem = () => {
    const newItem: LoanItem = {
      id: `new-${Date.now()}`,
      artworkId: '',
      artworkTitle: '',
      changeDescription: '',
      isMaterialOnly: true,
      impactLevel: 'low',
    };
    setNewLoan(prev => ({
      ...prev,
      changes: [...prev.changes, newItem],
    }));
  };

  const updateChangeItem = (index: number, field: keyof LoanItem, value: any) => {
    setNewLoan(prev => ({
      ...prev,
      changes: prev.changes.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeChangeItem = (index: number) => {
    setNewLoan(prev => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (!newLoan.title || newLoan.changes.length === 0) {
      alert('请填写标题并至少添加一项变更');
      return;
    }
    onSubmit(newLoan.title, newLoan.description, newLoan.changes);
    setNewLoan({ title: '', description: '', changes: [] });
    setShowCreateForm(false);
  };

  const handleOverrideSubmit = () => {
    if (!overrideForm || !overrideForm.reason) {
      alert('请填写人工干预理由');
      return;
    }
    onOverride(overrideForm.loanId, overrideForm.status, overrideForm.reason);
    setOverrideForm(null);
  };

  const getUserName = (userId: string) => {
    return mockUsers.find(u => u.id === userId)?.name || userId;
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Zap className="text-yellow-500" />
          快闪展品借调
        </h2>
        {currentUser.role === 'assistant' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus size={16} className="mr-1" />
            新建借调
          </button>
        )}
      </div>

      {showCreateForm && currentUser.role === 'assistant' && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4">新建快闪借调</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
              <input
                type="text"
                value={newLoan.title}
                onChange={(e) => setNewLoan(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="请输入借调标题"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">说明</label>
              <textarea
                value={newLoan.description}
                onChange={(e) => setNewLoan(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={2}
                placeholder="请简要说明借调原因"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">变更项目</label>
                <button
                  onClick={addChangeItem}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + 添加项目
                </button>
              </div>
              <div className="space-y-3">
                {newLoan.changes.map((item, index) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">变更项 {index + 1}</span>
                      <button
                        onClick={() => removeChangeItem(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        移除
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">作品名称</label>
                        <input
                          type="text"
                          value={item.artworkTitle}
                          onChange={(e) => updateChangeItem(index, 'artworkTitle', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">影响等级</label>
                        <select
                          value={item.impactLevel}
                          onChange={(e) => updateChangeItem(index, 'impactLevel', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">变更描述</label>
                      <input
                        type="text"
                        value={item.changeDescription}
                        onChange={(e) => updateChangeItem(index, 'changeDescription', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`material-${index}`}
                        checked={item.isMaterialOnly}
                        onChange={(e) => updateChangeItem(index, 'isMaterialOnly', e.target.checked)}
                      />
                      <label htmlFor={`material-${index}`} className="text-sm text-gray-600">
                        仅为补充材料，不改变布展方案
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="btn btn-primary"
              >
                提交借调
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {flashLoans.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">暂无快闪借调记录</p>
          </div>
        ) : (
          flashLoans.map(loan => (
            <div key={loan.id} className="card overflow-hidden">
              <div
                className="card-header flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => onSelect(selectedId === loan.id ? null : loan.id)}
              >
                <div className="flex items-center gap-3">
                  <Zap className="text-yellow-500" size={20} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{loan.title}</span>
                      <StatusBadge status={loan.status}>
                        {statusLabels[loan.status]}
                      </StatusBadge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {loan.requestNumber} · 提交人：{getUserName(loan.submittedBy)} · {format(new Date(loan.submittedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </div>
                  </div>
                </div>
                {selectedId === loan.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {selectedId === loan.id && (
                <div className="card-body space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <User className="text-blue-500 mt-0.5" size={20} />
                      <div>
                        <h4 className="text-sm font-medium text-blue-800 mb-1">给策展人的说明</h4>
                        <p className="text-sm text-blue-700">{loan.curatorMessage}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <ListChecks size={16} />
                      变更明细 ({loan.changes.length} 项)
                    </h4>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2">作品</th>
                          <th className="text-left px-3 py-2">变更描述</th>
                          <th className="text-center px-3 py-2">性质</th>
                          <th className="text-center px-3 py-2">影响</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loan.changes.map(change => (
                          <tr key={change.id}>
                            <td className="px-3 py-2 font-medium text-gray-800">{change.artworkTitle}</td>
                            <td className="px-3 py-2 text-gray-600">{change.changeDescription}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                change.isMaterialOnly ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {change.isMaterialOnly ? '补材料' : '改方案'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                change.impactLevel === 'high' ? 'bg-red-100 text-red-700' :
                                change.impactLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {change.impactLevel === 'high' ? '高' : change.impactLevel === 'medium' ? '中' : '低'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {loan.autoJudgment && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div
                        className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedJudgment(expandedJudgment === loan.id ? null : loan.id)}
                      >
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Eye size={16} />
                          自动判断详情
                          <span className="text-xs font-normal text-gray-500">
                            (置信度: {(loan.autoJudgment.confidence * 100).toFixed(0)}%)
                          </span>
                        </h4>
                        {expandedJudgment === loan.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                      {expandedJudgment === loan.id && (
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500 mb-1">判断结果</p>
                              <StatusBadge status={loan.autoJudgment.judgmentType}>
                                {statusLabels[loan.autoJudgment.judgmentType]}
                              </StatusBadge>
                            </div>
                            <div className="p-3 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500 mb-1">变更类型</p>
                              <span className="text-sm font-medium text-gray-700">
                                {changeTypeLabels[loan.changeType]}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-2">判断理由</p>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {loan.autoJudgment.reasons.map((reason, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="text-xs text-gray-400">
                            算法版本：{loan.autoJudgment.algorithmVersion} · 判断时间：
                            {format(new Date(loan.autoJudgment.judgedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                          </div>

                          {loan.manualOverride && (
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <p className="text-xs font-medium text-orange-700 mb-1">已人工干预</p>
                              <p className="text-sm text-orange-600">{loan.overrideReason}</p>
                              <p className="text-xs text-orange-500 mt-1">
                                操作人：{getUserName(loan.overrideBy!)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {loan.versionDiff && loan.versionDiff.length > 0 && (
                    <VersionDiff diffs={loan.versionDiff} title="与上一版本的差异" />
                  )}

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                      <ListChecks size={16} />
                      下一步操作
                    </h4>
                    <ol className="text-sm text-green-700 space-y-2">
                      {loan.nextSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {currentUser.role === 'curator' && !loan.manualOverride && (
                    <div className="border-t border-gray-200 pt-4">
                      {overrideForm?.loanId === loan.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">调整状态为</label>
                            <select
                              value={overrideForm.status}
                              onChange={(e) => setOverrideForm({ ...overrideForm, status: e.target.value as any })}
                              className="w-full border border-gray-300 rounded px-3 py-2"
                            >
                              <option value="material_only">仅补材料</option>
                              <option value="conclusion_changed">结论变更</option>
                              <option value="needs_confirmation">待确认</option>
                              <option value="approved">已批准</option>
                              <option value="rejected">已拒绝</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">干预理由</label>
                            <textarea
                              value={overrideForm.reason}
                              onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                              className="w-full border border-gray-300 rounded px-3 py-2"
                              rows={2}
                              placeholder="请说明人工干预的理由"
                            />
                          </div>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => setOverrideForm(null)}
                              className="btn btn-secondary"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleOverrideSubmit}
                              className="btn btn-primary"
                            >
                              确认干预
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500">
                            如对自动判断结果有异议，可进行人工干预
                          </p>
                          <button
                            onClick={() => setOverrideForm({ loanId: loan.id, status: 'approved', reason: '' })}
                            className="btn btn-secondary"
                          >
                            人工干预
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {currentUser.role === 'curator' && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                      {loan.status === 'material_only' && (
                        <button
                          onClick={() => onOverride(loan.id, 'approved', '策展人确认材料已收到')}
                          className="btn btn-success"
                        >
                          <CheckCircle2 size={16} className="mr-1" />
                          确认并归档
                        </button>
                      )}
                      {(loan.status === 'conclusion_changed' || loan.status === 'needs_confirmation') && (
                        <>
                          <button
                            onClick={() => onOverride(loan.id, 'rejected', '策展人驳回，需重新提交')}
                            className="btn btn-danger"
                          >
                            <XCircle size={16} className="mr-1" />
                            驳回
                          </button>
                          <button
                            onClick={() => onOverride(loan.id, 'approved', '策展人批准变更')}
                            className="btn btn-success"
                          >
                            <CheckCircle2 size={16} className="mr-1" />
                            批准变更
                          </button>
                        </>
                      )}
                      {loan.status === 'needs_confirmation' && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertTriangle size={16} />
                          请先处理异常后再审批
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
