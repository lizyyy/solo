import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatDate,
  getIssueTypeText,
  getIssueTypeColor,
  getRectificationStatusText,
  getRectificationStatusColor,
  getSeverityText,
  getSeverityColor,
} from '../utils/helpers';
import type { RectificationStatus } from '../types';

export const RectificationManagement = () => {
  const { 
    state, 
    addRectification, 
    updateRectification, 
    updateStallStatus,
    getRectificationByIssue
  } = useApp();
  const { issues, stalls } = state;

  const [editingRect, setEditingRect] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  const startRectification = (issueId: string, stallId: string) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);
    
    addRectification({
      issueId,
      stallId,
      status: 'in_progress',
      deadline: deadline.toISOString(),
    });
    
    updateStallStatus(stallId, 'pending_rectification');
  };

  const handleEditRectification = (rectId: string, rectification: any) => {
    setEditingRect(rectId);
    setEditMethod(rectification.rectificationMethod || '');
    setEditNotes(rectification.notes || '');
    setEditDeadline(rectification.deadline ? new Date(rectification.deadline).toISOString().split('T')[0] : '');
  };

  const handleSaveEdit = (rectId: string) => {
    updateRectification(rectId, {
      rectificationMethod: editMethod,
      notes: editNotes,
      deadline: editDeadline ? new Date(editDeadline).toISOString() : undefined,
    });
    setEditingRect(null);
    setEditMethod('');
    setEditNotes('');
    setEditDeadline('');
  };

  const updateRectStatus = (rectId: string, stallId: string, newStatus: RectificationStatus) => {
    const updates: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
    } else if (newStatus === 'verified') {
      updates.verifiedAt = new Date().toISOString();
      updateStallStatus(stallId, 'rectified');
    }
    
    updateRectification(rectId, updates);
  };

  const issuesWithOptionalRect = issues.map(issue => ({
    issue,
    rectification: getRectificationByIssue(issue.id),
    stall: stalls.find(s => s.id === issue.stallId),
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">整改管理</h2>
      
      {issuesWithOptionalRect.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>暂无问题需要整改</p>
        </div>
      ) : (
        <div className="space-y-4">
          {issuesWithOptionalRect.map(({ issue, rectification, stall }) => (
            <div key={issue.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{stall?.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getIssueTypeColor(issue.type)}`}>
                      {getIssueTypeText(issue.type)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(issue.severity)}`}>
                      {getSeverityText(issue.severity)}严重
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{issue.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    发现时间：{formatDate(issue.discoveredAt)}
                  </p>
                </div>
              </div>

              {rectification ? (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">整改情况</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getRectificationStatusColor(rectification.status)}`}>
                      {getRectificationStatusText(rectification.status)}
                    </span>
                  </div>

                  {editingRect === rectification.id ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">整改措施</label>
                        <input
                          type="text"
                          value={editMethod}
                          onChange={(e) => setEditMethod(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="请描述整改措施"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">截止日期</label>
                        <input
                          type="date"
                          value={editDeadline}
                          onChange={(e) => setEditDeadline(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">备注</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          rows={2}
                          placeholder="备注信息"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(rectification.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingRect(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">截止日期：</span>
                          <span>{formatDate(rectification.deadline)}</span>
                        </div>
                        {rectification.completedAt && (
                          <div>
                            <span className="text-gray-600">完成日期：</span>
                            <span>{formatDate(rectification.completedAt)}</span>
                          </div>
                        )}
                        {rectification.verifiedAt && (
                          <div>
                            <span className="text-gray-600">验证日期：</span>
                            <span>{formatDate(rectification.verifiedAt)}</span>
                          </div>
                        )}
                      </div>
                      {rectification.rectificationMethod && (
                        <p className="text-sm text-gray-700 mt-2">
                          <span className="text-gray-600">整改措施：</span>
                          {rectification.rectificationMethod}
                        </p>
                      )}
                      {rectification.notes && (
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="text-gray-600">备注：</span>
                          {rectification.notes}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => handleEditRectification(rectification.id, rectification)}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                        >
                          编辑
                        </button>
                        
                        {rectification.status === 'pending' && (
                          <button
                            onClick={() => updateRectStatus(rectification.id, issue.stallId, 'in_progress')}
                            className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded hover:bg-yellow-200"
                          >
                            开始整改
                          </button>
                        )}
                        
                        {rectification.status === 'in_progress' && (
                          <button
                            onClick={() => updateRectStatus(rectification.id, issue.stallId, 'completed')}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                          >
                            标记完成
                          </button>
                        )}
                        
                        {rectification.status === 'completed' && (
                          <button
                            onClick={() => updateRectStatus(rectification.id, issue.stallId, 'verified')}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                          >
                            验证通过
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    onClick={() => startRectification(issue.id, issue.stallId)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    启动整改流程
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
