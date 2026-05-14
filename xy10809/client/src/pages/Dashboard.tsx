import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Play, RefreshCw, BarChart3, CheckCircle, XCircle, Clock } from 'lucide-react';
import { syncApi } from '../api';
import { SyncBatch, Stats, ApiMapping, SyncStatus } from '../types';

const statusLabels: Record<string, string> = {
  pending: '待处理',
  validating: '验证中',
  validated: '已验证',
  processing: '同步中',
  partial_success: '部分成功',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [batches, setBatches] = useState<SyncBatch[]>([]);
  const [mappings, setMappings] = useState<ApiMapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [statsRes, batchesRes, mappingsRes] = await Promise.all([
        syncApi.getStats(),
        syncApi.getBatches({ pageSize: 10 }),
        syncApi.getMappings(),
      ]);
      setStats(statsRes);
      setBatches(batchesRes.batches);
      setMappings(mappingsRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async () => {
    if (!selectedMapping || !selectedFile) return;

    setLoading(true);
    try {
      await syncApi.createBatch(selectedMapping, selectedFile);
      setSelectedFile(null);
      setSelectedMapping('');
      await loadData();
    } catch (error) {
      console.error('Upload failed:', error);
    }
    setLoading(false);
  };

  const handleValidate = async (batchId: string) => {
    try {
      await syncApi.validateBatch(batchId);
      await loadData();
    } catch (error) {
      console.error('Validate failed:', error);
    }
  };

  const handleProcess = async (batchId: string) => {
    try {
      await syncApi.processBatch(batchId);
      await loadData();
    } catch (error) {
      console.error('Process failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">同步控制台</h1>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">总批次</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBatches}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">总记录</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRows}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">成功</p>
                <p className="text-2xl font-bold text-gray-900">{stats.successRows}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">失败</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failedRows}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">上传 CSV</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择 API 映射
            </label>
            <select
              value={selectedMapping}
              onChange={(e) => setSelectedMapping(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择...</option>
              {mappings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              选择 CSV 文件
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedMapping || !selectedFile || loading}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4 mr-2" />
            {loading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">同步批次列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  总数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成功
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  失败
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/batch/${batch.id}`}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      {batch.fileName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-badge status-${batch.status}`}>
                      {statusLabels[batch.status] || batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.totalRows}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {batch.successRows}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {batch.failedRows}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(batch.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {batch.status === SyncStatus.PENDING && (
                      <button
                        onClick={() => handleValidate(batch.id)}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
                      >
                        验证
                      </button>
                    )}
                    {batch.status === SyncStatus.VALIDATED && (
                      <button
                        onClick={() => handleProcess(batch.id)}
                        className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        开始同步
                      </button>
                    )}
                    <Link
                      to={`/batch/${batch.id}`}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    暂无同步批次，请上传 CSV 文件开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
