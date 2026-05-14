import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { getUploadTasks, uploadFile, scanTask, getOrganizations } from '../api';
import { UploadTask as UploadTaskType, Organization } from '../types';

export default function UploadTasks() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<number>();
  const [uploadedBy, setUploadedBy] = useState('admin');
  const [statusFilter, setStatusFilter] = useState<string>();
  
  const queryClient = useQueryClient();

  const { data: tasks, isLoading: tasksLoading } = useQuery<UploadTaskType[]>(
    ['uploadTasks', statusFilter],
    () => getUploadTasks(statusFilter)
  );

  const { data: organizations } = useQuery<Organization[]>('organizations', getOrganizations);

  const uploadMutation = useMutation(
    () => uploadFile(selectedFile!, selectedOrg, uploadedBy),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('uploadTasks');
        setSelectedFile(null);
      },
    }
  );

  const scanMutation = useMutation(scanTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('uploadTasks');
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scanned: 'bg-green-100 text-green-800',
      quarantined: 'bg-red-100 text-red-800',
      released: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
      rolled_back: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getThreatColor = (threat: string) => {
    const colors: Record<string, string> = {
      safe: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[threat] || 'bg-gray-100 text-gray-800';
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📁 上传任务</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">上传新文件</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择文件</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所属组织</label>
            <select
              value={selectedOrg || ''}
              onChange={(e) => setSelectedOrg(Number(e.target.value) || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择组织</option>
              {organizations?.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">上传人</label>
            <input
              type="text"
              value={uploadedBy}
              onChange={(e) => setUploadedBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {uploadMutation.isLoading ? '上传中...' : '上传文件'}
          </button>
          {selectedFile && (
            <span className="text-sm text-gray-600">已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">任务列表</h3>
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || undefined)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="scanned">已扫描</option>
            <option value="quarantined">已隔离</option>
            <option value="released">已放行</option>
            <option value="rolled_back">已回滚</option>
          </select>
        </div>

        {tasksLoading ? (
          <div className="text-center py-8">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">任务ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">文件名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">威胁等级</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上传人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上传时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks?.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                      {task.task_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {task.original_filename}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getThreatColor(task.threat_level)}`}>
                        {task.threat_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {task.uploaded_by}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(task.uploaded_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => scanMutation.mutate(task.id)}
                          disabled={scanMutation.isLoading}
                          className="text-green-600 hover:text-green-800"
                        >
                          扫描
                        </button>
                      )}
                      <Link
                        to={`/uploads/${task.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
