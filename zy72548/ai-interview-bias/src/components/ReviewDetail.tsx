import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { getConflictTypeName, getStatusName, getRoleName } from '../utils/storage';
import { getRelatedRecords } from '../utils/business';
import type { ReviewRecord, PromptVersion } from '../types';
import { generateId } from '../utils/storage';

interface Props {
  record: ReviewRecord;
  onBack: () => void;
}

const ReviewDetail: React.FC<Props> = ({ record, onBack }) => {
  const { state, dispatch } = useApp();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [selectedPromptVersion, setSelectedPromptVersion] = useState('');
  const [newPromptVersion, setNewPromptVersion] = useState({
    versionNumber: '',
    description: '',
    effectiveDate: '',
  });
  const [showAddPrompt, setShowAddPrompt] = useState(false);

  const unresolvedConflicts = record.conflicts.filter(c => !c.resolved);
  const resolvedConflicts = record.conflicts.filter(c => c.resolved);
  const relatedRecords = getRelatedRecords(record, state.reviewRecords);

  const handleResolveConflict = (conflictId: string, resolution: 'confirm' | 'reject' | 'operation_review') => {
    dispatch({
      type: 'RESOLVE_CONFLICT',
      payload: {
        recordId: record.recordId,
        conflictId,
        resolution,
        operator: state.currentUser,
      },
    });
  };

  const handlePMConfirm = () => {
    dispatch({
      type: 'PM_CONFIRM',
      payload: { recordId: record.recordId, operator: state.currentUser },
    });
  };

  const handlePMReject = () => {
    if (!rejectReason.trim()) {
      alert('请填写驳回理由');
      return;
    }
    dispatch({
      type: 'PM_REJECT',
      payload: {
        recordId: record.recordId,
        operator: state.currentUser,
        reason: rejectReason,
      },
    });
    setRejectReason('');
    setShowRejectInput(false);
  };

  const handleOperationApprove = () => {
    dispatch({
      type: 'OPERATION_APPROVE',
      payload: { recordId: record.recordId, operator: state.currentUser },
    });
  };

  const handleOperationReject = () => {
    if (!rejectReason.trim()) {
      alert('请填写驳回理由');
      return;
    }
    dispatch({
      type: 'OPERATION_REJECT',
      payload: {
        recordId: record.recordId,
        operator: state.currentUser,
        reason: rejectReason,
      },
    });
    setRejectReason('');
    setShowRejectInput(false);
  };

  const handleFinalize = () => {
    dispatch({
      type: 'FINALIZE_RECORD',
      payload: { recordId: record.recordId, operator: state.currentUser },
    });
  };

  const handleApplyPromptVersion = () => {
    const pv = state.promptVersions.find(p => p.versionId === selectedPromptVersion);
    if (!pv) {
      alert('请选择提示词版本');
      return;
    }
    dispatch({
      type: 'APPLY_PROMPT_VERSION',
      payload: { recordId: record.recordId, promptVersion: pv },
    });
    setSelectedPromptVersion('');
  };

  const handleAddPromptVersion = () => {
    if (!newPromptVersion.versionNumber.trim() || !newPromptVersion.effectiveDate) {
      alert('请填写版本号和生效日期');
      return;
    }
    const pv: PromptVersion = {
      versionId: generateId('prompt'),
      versionNumber: newPromptVersion.versionNumber,
      description: newPromptVersion.description,
      effectiveDate: newPromptVersion.effectiveDate,
      importedBy: state.currentUser,
      importedAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_PROMPT_VERSION', payload: pv });
    dispatch({
      type: 'APPLY_PROMPT_VERSION',
      payload: { recordId: record.recordId, promptVersion: pv },
    });
    setNewPromptVersion({ versionNumber: '', description: '', effectiveDate: '' });
    setShowAddPrompt(false);
  };

  const getConflictColor = (type: string) => {
    switch (type) {
      case 'prompt_version_mismatch': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'duplicate_import': return 'bg-red-100 border-red-300 text-red-800';
      case 'conclusion_inconsistent': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const canPMReview = state.currentRole === 'product_manager' && 
    (record.status === 'conflict_detected' || record.status === 'pending_review');
  
  const canOperationReview = state.currentRole === 'operation_reviewer' && 
    record.status === 'pending_operation';

  const canFinalize = ['pm_confirmed', 'operation_approved'].includes(record.status) &&
    unresolvedConflicts.length === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
          ← 返回列表
        </button>
        <h2 className="text-2xl font-bold">审核详情</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          record.status === 'conflict_detected' ? 'bg-red-100 text-red-700' :
          record.status === 'pm_confirmed' ? 'bg-green-100 text-green-700' :
          record.status === 'pm_rejected' ? 'bg-gray-100 text-gray-700' :
          record.status === 'pending_operation' ? 'bg-yellow-100 text-yellow-700' :
          record.status === 'operation_approved' ? 'bg-blue-100 text-blue-700' :
          record.status === 'operation_rejected' ? 'bg-gray-100 text-gray-700' :
          record.status === 'finalized' ? 'bg-gray-200 text-gray-800' :
          'bg-blue-50 text-blue-700'
        }`}>
          {getStatusName(record.status)}
        </span>
        <span className="text-xs text-gray-400 font-mono">ID: {record.recordId.slice(-8)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">面试基本信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">样本编号</span>
                <p className="font-medium">{record.interview.sampleId}</p>
              </div>
              <div>
                <span className="text-gray-500">候选人</span>
                <p className="font-medium">{record.interview.candidateName}</p>
              </div>
              <div>
                <span className="text-gray-500">应聘岗位</span>
                <p className="font-medium">{record.interview.position}</p>
              </div>
              <div>
                <span className="text-gray-500">面试日期</span>
                <p className="font-medium">{record.interview.interviewDate}</p>
              </div>
              <div>
                <span className="text-gray-500">模型版本</span>
                <p className="font-medium">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                    {record.interview.modelVersion}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-gray-500">AI评分</span>
                <p className={`font-bold text-lg ${record.interview.aiScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                  {record.interview.aiScore}
                </p>
              </div>
            </div>
          </div>

          {relatedRecords.length > 0 && (
            <div className="border rounded-lg p-4 border-orange-200 bg-orange-50">
              <h3 className="font-semibold mb-3 text-orange-800">关联记录（同样本编号，不同模型版本）</h3>
              <p className="text-xs text-orange-700 mb-3">
                样本编号 {record.sampleId} 在不同模型版本下存在 {relatedRecords.length} 条独立记录。
                每条记录独立审核，产品经理确认后转运营复核，不可自动归为正常。
              </p>
              <div className="space-y-2">
                {relatedRecords.map(related => (
                  <div key={related.recordId} className="flex items-center gap-3 p-2 bg-white rounded border text-sm">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      {related.interview.modelVersion}
                    </span>
                    <span>AI评分：{related.interview.aiScore}</span>
                    {related.correction && <span>人工评分：{related.correction.humanScore}</span>}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      related.status === 'finalized' ? 'bg-gray-200 text-gray-700' :
                      related.status === 'pending_operation' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {getStatusName(related.status)}
                    </span>
                    <span className="text-gray-400 text-xs font-mono">ID: {related.recordId.slice(-8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.correction && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">人工改判信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">人工评分</span>
                  <p className={`font-bold text-lg ${record.correction.humanScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {record.correction.humanScore}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">人工结论</span>
                  <p className="font-medium">
                    <span className={`px-2 py-0.5 rounded text-xs ${record.correction.conclusion.includes('通过') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {record.correction.conclusion}
                    </span>
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">改判理由</span>
                  <p className="font-medium mt-1 p-2 bg-gray-50 rounded">{record.correction.reason}</p>
                </div>
                <div>
                  <span className="text-gray-500">改判人</span>
                  <p className="font-medium">{record.correction.correctedBy}</p>
                </div>
                <div>
                  <span className="text-gray-500">改判时间</span>
                  <p className="font-medium">{record.correction.correctedAt}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">提示词版本</h3>
              <div className="flex gap-2">
                <select
                  value={selectedPromptVersion}
                  onChange={e => setSelectedPromptVersion(e.target.value)}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value="">选择已有版本</option>
                  {state.promptVersions.map(pv => (
                    <option key={pv.versionId} value={pv.versionId}>
                      {pv.versionNumber} - {pv.description}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleApplyPromptVersion}
                  disabled={!selectedPromptVersion}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  应用
                </button>
                <button
                  onClick={() => setShowAddPrompt(!showAddPrompt)}
                  className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300"
                >
                  {showAddPrompt ? '取消' : '新增版本'}
                </button>
              </div>
            </div>

            {showAddPrompt && (
              <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="版本号（如 v2.0）"
                    value={newPromptVersion.versionNumber}
                    onChange={e => setNewPromptVersion(p => ({ ...p, versionNumber: e.target.value }))}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="版本描述"
                    value={newPromptVersion.description}
                    onChange={e => setNewPromptVersion(p => ({ ...p, description: e.target.value }))}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <input
                    type="date"
                    value={newPromptVersion.effectiveDate}
                    onChange={e => setNewPromptVersion(p => ({ ...p, effectiveDate: e.target.value }))}
                    className="px-2 py-1 border rounded text-sm"
                  />
                </div>
                <button
                  onClick={handleAddPromptVersion}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                >
                  确认添加并应用
                </button>
              </div>
            )}

            {record.promptVersion ? (
              <div className="p-3 bg-blue-50 rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded font-medium">
                    {record.promptVersion.versionNumber}
                  </span>
                  <span className="text-gray-600">{record.promptVersion.description}</span>
                  <span className="text-gray-400 ml-auto">生效于 {record.promptVersion.effectiveDate}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">未补录提示词版本，AI产品经理阿宁可补看后录入</p>
            )}
          </div>

          {unresolvedConflicts.length > 0 && (
            <div className="border rounded-lg p-4 border-red-300 bg-red-50">
              <h3 className="font-semibold mb-3 text-red-800">待处理冲突 ({unresolvedConflicts.length})</h3>
              <div className="space-y-3">
                {unresolvedConflicts.map(conflict => (
                  <div key={conflict.conflictId} className={`border rounded p-3 ${getConflictColor(conflict.type)}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-white bg-opacity-50 rounded text-xs font-medium">
                            {getConflictTypeName(conflict.type)}
                          </span>
                          <span className="text-xs opacity-75">检测于 {conflict.detectedAt}</span>
                        </div>
                        <p className="font-medium">{conflict.description}</p>
                        {conflict.fieldA && conflict.fieldB && (
                          <div className="mt-2 flex gap-4 text-xs">
                            <div>
                              <span className="opacity-75">{conflict.fieldA}：</span>
                              <span className="font-mono">{conflict.valueA}</span>
                            </div>
                            <div>
                              <span className="opacity-75">{conflict.fieldB}：</span>
                              <span className="font-mono">{conflict.valueB}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {canPMReview && (
                        <div className="flex gap-2 ml-4 shrink-0">
                          <button
                            onClick={() => handleResolveConflict(conflict.conflictId, 'confirm')}
                            className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.conflictId, 'reject')}
                            className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                          >
                            驳回
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-red-700">
                注意：系统仅列出冲突证据，由 AI 产品经理人工确认或驳回，不自动拍板
              </p>
            </div>
          )}

          {resolvedConflicts.length > 0 && (
            <div className="border rounded-lg p-4 border-gray-200">
              <h3 className="font-semibold mb-3 text-gray-600">已处理冲突 ({resolvedConflicts.length})</h3>
              <div className="space-y-2">
                {resolvedConflicts.map(conflict => (
                  <div key={conflict.conflictId} className="border rounded p-2 bg-gray-50 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                        {getConflictTypeName(conflict.type)}
                      </span>
                      <span className="text-gray-500">{conflict.description}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                        conflict.resolution === 'confirm' ? 'bg-green-100 text-green-700' :
                        conflict.resolution === 'reject' ? 'bg-gray-200 text-gray-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {conflict.resolution === 'confirm' ? '已确认' :
                         conflict.resolution === 'reject' ? '已驳回' : '转运营复核'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      处理人：{conflict.resolvedBy}，处理时间：{conflict.resolvedAt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(record.finalScore !== undefined || record.finalConclusion) && (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <h3 className="font-semibold mb-3 text-green-800">最终结论</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {record.finalScore !== undefined && (
                  <div>
                    <span className="text-gray-500">最终分数</span>
                    <p className={`font-bold text-xl ${record.finalScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                      {record.finalScore}
                    </p>
                  </div>
                )}
                {record.finalConclusion && (
                  <div>
                    <span className="text-gray-500">最终结论</span>
                    <p className="font-bold text-lg">
                      <span className={`px-2 py-0.5 rounded ${record.finalConclusion.includes('通过') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {record.finalConclusion}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">操作区</h3>
            <div className="space-y-3">
              {canPMReview && unresolvedConflicts.length === 0 && (
                <div className="space-y-2">
                  <button
                    onClick={handlePMConfirm}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    AI产品经理确认
                  </button>
                  {relatedRecords.length > 0 && (
                    <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      提示：同样本编号存在不同模型版本记录，确认后将自动转运营复核，不可自动归正常
                    </p>
                  )}
                  {!showRejectInput ? (
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      驳回
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        placeholder="请填写驳回理由"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handlePMReject}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          确认驳回
                        </button>
                        <button
                          onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                          className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canOperationReview && (
                <div className="space-y-2">
                  <p className="text-xs text-orange-700 bg-orange-50 p-2 rounded">
                    运营复核原因：样本编号 {record.sampleId} 存在多个模型版本记录，需确认当前记录（{record.interview.modelVersion}）的结论是否正确
                  </p>
                  <button
                    onClick={handleOperationApprove}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    运营复核通过
                  </button>
                  {!showRejectInput ? (
                    <button
                      onClick={() => setShowRejectInput(true)}
                      className="w-full px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      运营驳回
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        placeholder="请填写驳回理由"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleOperationReject}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          确认驳回
                        </button>
                        <button
                          onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                          className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canFinalize && (
                <button
                  onClick={handleFinalize}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  归档（更新至复盘页）
                </button>
              )}

              {record.status === 'finalized' && (
                <p className="text-center text-gray-500 text-sm py-4">
                  记录已归档，可在产品复盘页查看
                </p>
              )}

              {record.status === 'pm_rejected' && (
                <p className="text-center text-gray-500 text-sm py-4">
                  记录已被产品经理驳回
                </p>
              )}

              {record.status === 'operation_rejected' && (
                <p className="text-center text-gray-500 text-sm py-4">
                  记录已被运营复核驳回
                </p>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">操作历史</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {[...record.history].reverse().map((h, idx) => (
                <div key={h.historyId} className="relative pl-4 pb-3 border-l-2 border-gray-200 last:border-l-0">
                  {idx < record.history.length - 1 && (
                    <div className="absolute -left-1.5 top-0 w-3 h-3 bg-blue-500 rounded-full" />
                  )}
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{h.action}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        {getRoleName(h.role)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {h.operator} · {h.timestamp}
                    </p>
                    {h.remark && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-1.5 rounded">
                        {h.remark}
                      </p>
                    )}
                    {h.before && Object.keys(h.before).length > 0 && (
                      <div className="mt-1 text-xs text-red-500">
                        变更前：<code className="bg-red-50 px-1 rounded">{JSON.stringify(h.before)}</code>
                      </div>
                    )}
                    {h.after && Object.keys(h.after).length > 0 && (
                      <div className="mt-0.5 text-xs text-green-500">
                        变更后：<code className="bg-green-50 px-1 rounded">{JSON.stringify(h.after)}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewDetail;
