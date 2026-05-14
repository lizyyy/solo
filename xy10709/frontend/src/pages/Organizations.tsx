import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getOrganizations, createOrganization, batchImportOrganizations } from '../api';
import { Organization } from '../types';

export default function Organizations() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', code: '', description: '' });
  const [batchData, setBatchData] = useState('');
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery<Organization[]>('organizations', getOrganizations);

  const createMutation = useMutation(() => createOrganization(newOrg), {
    onSuccess: () => {
      queryClient.invalidateQueries('organizations');
      setShowCreateModal(false);
      setNewOrg({ name: '', code: '', description: '' });
    },
  });

  const batchMutation = useMutation(() => {
    const orgs = JSON.parse(batchData);
    return batchImportOrganizations(orgs);
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries('organizations');
      setShowBatchModal(false);
      setBatchData('');
    },
  });

  const sampleBatchData = [
    { name: '技术研发部', code: 'RND', description: '负责产品研发' },
    { name: '市场营销部', code: 'MKT', description: '负责市场推广' },
    { name: '客户服务部', code: 'CS', description: '负责客户支持' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">🏢 组织管理</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
          >
            批量导入
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            新建组织
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">组织列表</h3>
        
        {isLoading ? (
          <div className="text-center py-8">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations?.map((org) => (
              <div key={org.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-medium text-gray-800">{org.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${org.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {org.is_active ? '启用' : '停用'}
                  </span>
                </div>
                <p className="text-sm font-mono text-blue-600 mb-2">{org.code}</p>
                <p className="text-sm text-gray-600">{org.description || '暂无描述'}</p>
                <p className="text-xs text-gray-400 mt-2">创建于 {new Date(org.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">新建组织</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织名称</label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入组织名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">组织代码</label>
                <input
                  type="text"
                  value={newOrg.code}
                  onChange={(e) => setNewOrg({ ...newOrg, code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入组织代码"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={newOrg.description}
                  onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入组织描述"
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
                disabled={!newOrg.name || !newOrg.code || createMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {createMutation.isLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">批量导入组织</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">JSON 数据</label>
                <textarea
                  value={batchData}
                  onChange={(e) => setBatchData(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder='[\n  { "name": "组织名称", "code": "CODE", "description": "描述" }\n]'
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">示例数据：</p>
                <pre className="text-xs text-blue-700 font-mono">
                  {JSON.stringify(sampleBatchData, null, 2)}
                </pre>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => setBatchData(JSON.stringify(sampleBatchData, null, 2))}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
              >
                填充示例
              </button>
              <button
                onClick={() => batchMutation.mutate()}
                disabled={!batchData || batchMutation.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {batchMutation.isLoading ? '导入中...' : '批量导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
