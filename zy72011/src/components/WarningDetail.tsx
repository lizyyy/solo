import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WarningStatus, STATUS_LABELS, WARNING_TYPE_LABELS, MATERIAL_TYPE_LABELS, HISTORY_ACTION_LABELS } from '../types';
import { useWarningStore } from '../hooks/useWarningStore';
import MaterialCard from './MaterialCard';

const WarningDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, updateRecordStatus, updateRecordRemark, rollbackToHistory } = useWarningStore();
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [judgeStatus, setJudgeStatus] = useState<WarningStatus>('confirmed');
  const [judgeNote, setJudgeNote] = useState('');
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [editRemark, setEditRemark] = useState('');

  const record = id ? getRecordById(id) : undefined;

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">未找到该预警记录</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary-500 hover:text-primary-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const handleJudge = () => {
    if (id) {
      updateRecordStatus(id, judgeStatus, judgeNote);
      setShowJudgeModal(false);
      setJudgeNote('');
    }
  };

  const handleSaveRemark = () => {
    if (id) {
      updateRecordRemark(id, editRemark);
      setIsEditingRemark(false);
    }
  };

  const handleRollback = (historyIndex: number) => {
    if (id && window.confirm('确定要回退到此版本吗？')) {
      rollbackToHistory(id, historyIndex);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-500 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-white hover:text-primary-200"
            >
              ← 返回
            </button>
            <div>
              <h1 className="text-xl font-bold">预警详情</h1>
              <p className="text-sm text-primary-100">{record.supplierName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-500">供应商名称</label>
              <p className="font-medium text-gray-900">{record.supplierName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">票据金额</label>
              <p className="font-medium text-gray-900 font-mono">
                ¥{record.billAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">预警类型</label>
              <p className="font-medium text-gray-900">{WARNING_TYPE_LABELS[record.warningType]}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">当前状态</label>
              <p>
                <span className={`status-badge status-${record.status}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">数据来源</label>
              <p className="font-medium text-gray-900">{MATERIAL_TYPE_LABELS[record.source]}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">更新时间</label>
              <p className="font-medium text-gray-900">{record.updatedAt}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">备注信息</h2>
            {!isEditingRemark && (
              <button
                onClick={() => {
                  setEditRemark(record.currentRemark);
                  setIsEditingRemark(true);
                }}
                className="text-sm text-primary-500 hover:text-primary-700"
              >
                补充备注
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="text-sm text-gray-500 block mb-1">原始备注（不可修改）</label>
              <p className="text-gray-700">{record.originalRemark}</p>
            </div>
            {isEditingRemark ? (
              <div className="space-y-3">
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="输入补充备注..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveRemark}
                    className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setIsEditingRemark(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="text-sm text-blue-600 block mb-1">当前备注</label>
                <p className="text-gray-700">{record.currentRemark}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">处理建议</h2>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <p className="text-amber-800 leading-relaxed">{record.processingAdvice}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            相关材料
            <span className="ml-2 text-sm font-normal text-gray-500">
              （共 {record.materials.length} 个文件）
            </span>
          </h2>
          <div className="grid gap-4">
            {record.materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
            {record.materials.length === 0 && (
              <p className="text-gray-500 text-center py-8">暂无上传材料</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">操作历史</h2>
          <div className="space-y-4">
            {record.history.map((historyItem, index) => (
              <div key={historyItem.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  {index < record.history.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{historyItem.operator}</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {HISTORY_ACTION_LABELS[historyItem.action]}
                    </span>
                    <span className="text-sm text-gray-500">{historyItem.time}</span>
                    {historyItem.action === 'judge' && (
                      <button
                        onClick={() => handleRollback(index)}
                        className="text-xs text-primary-500 hover:text-primary-700 ml-auto"
                      >
                        回退到此版本
                      </button>
                    )}
                  </div>
                  {historyItem.note && (
                    <p className="text-sm text-gray-600 mt-1">{historyItem.note}</p>
                  )}
                  {historyItem.oldValue && historyItem.newValue && (
                    <div className="mt-2 text-sm">
                      <span className="diff-delete px-1">{STATUS_LABELS[historyItem.oldValue as WarningStatus]}</span>
                      <span className="mx-2">→</span>
                      <span className="diff-add px-1">{STATUS_LABELS[historyItem.newValue as WarningStatus]}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">改判操作</h2>
            <button
              onClick={() => setShowJudgeModal(true)}
              className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
            >
              改判状态
            </button>
          </div>
        </div>
      </main>

      {showJudgeModal && (
        <div className="modal-overlay" onClick={() => setShowJudgeModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">改判状态</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择新状态
                </label>
                <select
                  value={judgeStatus}
                  onChange={(e) => setJudgeStatus(e.target.value as WarningStatus)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  改判说明
                </label>
                <textarea
                  value={judgeNote}
                  onChange={(e) => setJudgeNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="请输入改判原因..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowJudgeModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleJudge}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
              >
                确认改判
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarningDetail;
