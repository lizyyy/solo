import { useState } from 'react';
import type { Stall, IssueType } from '../types';
import { useApp } from '../context/AppContext';
import {
  formatDate,
  getIssueTypeText,
  getIssueTypeColor,
  getSeverityText,
  getSeverityColor,
} from '../utils/helpers';

interface StallDetailProps {
  stall: Stall;
}

export const StallDetail = ({ stall }: StallDetailProps) => {
  const { addIssue, updateStallStatus, getIssuesByStall, getRectificationByIssue } = useApp();
  
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [newIssueType, setNewIssueType] = useState<IssueType>('oil');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [newIssueSeverity, setNewIssueSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  const issues = getIssuesByStall(stall.id);

  const handleAddIssue = () => {
    if (!newIssueDescription.trim()) return;
    
    addIssue({
      stallId: stall.id,
      type: newIssueType,
      description: newIssueDescription,
      severity: newIssueSeverity,
      discoveredAt: new Date().toISOString(),
      discoveredBy: '当前巡查员',
    });

    updateStallStatus(stall.id, 'has_issue');
    setShowAddIssue(false);
    setNewIssueDescription('');
    setNewIssueType('oil');
    setNewIssueSeverity('medium');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">摊位详情</h2>
      
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{stall.name}</h3>
            <p className="text-sm text-gray-600">摊主：{stall.owner}</p>
            <p className="text-sm text-gray-600">类别：{stall.category}</p>
            <p className="text-sm text-gray-600">位置：第{stall.row + 1}排 第{stall.col + 1}位</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">问题列表</h3>
          <button
            onClick={() => setShowAddIssue(!showAddIssue)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            {showAddIssue ? '取消' : '+ 标记问题'}
          </button>
        </div>

        {showAddIssue && (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">问题类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewIssueType('oil')}
                    className={`px-3 py-1 rounded text-sm ${
                      newIssueType === 'oil'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    油污
                  </button>
                  <button
                    onClick={() => setNewIssueType('fire')}
                    className={`px-3 py-1 rounded text-sm ${
                      newIssueType === 'fire'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    明火
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewIssueSeverity(s)}
                      className={`px-3 py-1 rounded text-sm ${
                        newIssueSeverity === s
                          ? s === 'low' ? 'bg-green-600 text-white' :
                            s === 'medium' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {getSeverityText(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">问题描述</label>
                <textarea
                  value={newIssueDescription}
                  onChange={(e) => setNewIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请详细描述问题..."
                />
              </div>

              <button
                onClick={handleAddIssue}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                确认标记问题
              </button>
            </div>
          </div>
        )}

        {issues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>该摊位暂无问题记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => {
              const rectification = getRectificationByIssue(issue.id);
              return (
                <div key={issue.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getIssueTypeColor(issue.type)}`}>
                        {getIssueTypeText(issue.type)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(issue.severity)}`}>
                        {getSeverityText(issue.severity)}严重
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(issue.discoveredAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{issue.description}</p>
                  <p className="text-xs text-gray-500 mt-1">发现人：{issue.discoveredBy}</p>
                  {rectification && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-600">
                        整改状态：<span className="font-medium">{rectification.status}</span>
                      </p>
                      {rectification.rectificationMethod && (
                        <p className="text-xs text-gray-600">
                          整改措施：{rectification.rectificationMethod}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
