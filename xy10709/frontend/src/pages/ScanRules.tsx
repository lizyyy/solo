import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getScanRules, createScanRule } from '../api';
import { ScanRule as ScanRuleType } from '../types';

export default function ScanRules() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    rule_type: 'content',
    pattern: '',
    description: '',
    severity: 'medium',
    action: 'isolate',
  });
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery<ScanRuleType[]>('scanRules', getScanRules);

  const createMutation = useMutation(() => createScanRule(newRule), {
    onSuccess: () => {
      queryClient.invalidateQueries('scanRules');
      setShowCreateModal(false);
      setNewRule({
        name: '',
        rule_type: 'content',
        pattern: '',
        description: '',
        severity: 'medium',
        action: 'isolate',
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      content: 'bg-blue-100 text-blue-800',
      filetype: 'bg-purple-100 text-purple-800',
      filename: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📋 扫描规则</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          新建规则
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">规则列表</h3>
        
        {isLoading ? (
          <div className="text-center py-8">加载中...</div>
        ) : (
          <div className="space-y-3">
            {rules?.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-medium text-gray-800">{rule.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getTypeColor(rule.rule_type)}`}>
                      {rule.rule_type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getSeverityColor(rule.severity)}`}>
                      {rule.severity}
                    </span>
                    {rule.is_active && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        已启用
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    创建于 {new Date(rule.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">匹配模式:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">{rule.pattern}</code>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">处理动作:</span>
                    <span className="text-sm font-medium">
                      {rule.action === 'isolate' ? '隔离文件' : rule.action === 'block' ? '阻止上传' : rule.action}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600">{rule.description}</p>
                  )}
                </div>
              </div>
            ))}
            {rules?.length === 0 && (
              <p className="text-center text-gray-500 py-8">暂无扫描规则</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ 规则拦截示例</h3>
        <p className="text-yellow-700 mb-2">以下操作会被现有规则拦截：</p>
        <ul className="list-disc list-inside text-yellow-700 space-y-1">
          <li><code>virus</code>, <code>trojan</code>, <code>malware</code> 等关键词出现在文件内容中</li>
          <li><code>&lt;script&gt;</code> 标签出现在文件内容中（XSS攻击防护）</li>
          <li>上传 <code>.exe</code>, <code>.bat</code>, <code>.cmd</code> 等可执行文件类型</li>
        </ul>
        <p className="text-yellow-700 mt-3 text-sm">被拦截的文件会被标记为 "quarantined" 状态并隔离处理，需要人工审核后才能放行。</p>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">新建扫描规则</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入规则名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">规则类型</label>
                  <select
                    value={newRule.rule_type}
                    onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="content">内容匹配</option>
                    <option value="filetype">文件类型</option>
                    <option value="filename">文件名匹配</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">严重级别</label>
                  <select
                    value={newRule.severity}
                    onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">严重</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">匹配模式</label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如: virus, .exe, <script>"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">处理动作</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="isolate">隔离文件</option>
                  <option value="block">阻止上传</option>
                  <option value="log">仅记录日志</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则描述</label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入规则描述"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newRule.name || !newRule.pattern || createMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {createMutation.isLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
