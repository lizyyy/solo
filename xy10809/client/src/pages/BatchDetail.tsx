import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, Play, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { syncApi } from '../api';
import { SyncBatch, SyncRow, SyncStatus, RowStatus } from '../types';

const statusLabels: Record<string, string> = {
  pending: '待处理',
  validating: '验证中',
  validated: '已验证',
  processing: '同步中',
  partial_success: '部分成功',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
  valid: '有效',
  invalid: '无效',
  skipped: '已跳过',
};

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<SyncBatch | null>(null);
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [batchRes, rowsRes] = await Promise.all([
        syncApi.getBatch(id),
        syncApi.getBatchRows(id),
      ]);
      setBatch(batchRes);
      setRows(rowsRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const handleValidate = async () => {
    if (!id) return;
    try {
      await syncApi.validateBatch(id);
      await loadData();
    } catch (error) {
      console.error('Validate failed:', error);
    }
  };

  const handleProcess = async () => {
    if (!id) return;
    try {
      await syncApi.processBatch(id);
      await loadData();
    } catch (error) {
      console.error('Process failed:', error);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      const rowIds = selectedRows.length > 0 ? selectedRows : undefined;
      await syncApi.retryBatch(id, rowIds);
      setSelectedRows([]);
      await loadData();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleExport = () => {
    if (!id) return;
    syncApi.exportReport(id);
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows((prev) =>
      prev.includes(rowId) ? prev.filter((r) => r !== rowId) : [...prev, rowId]
    );
  };

  const toggleAllFailed = () => {
    const failedIds = rows.filter((r) => r.status === RowStatus.FAILED).map((r) => r.id);
    if (selectedRows.length === failedIds.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(failedIds);
    }
  };

  const filteredRows = rows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'failed') return row.status === RowStatus.FAILED;
    if (filter === 'invalid') return row.status === RowStatus.INVALID;
    if (filter === 'success') return row.status === RowStatus.SUCCESS;
    return true;
  });

  const failedRows = rows.filter((r) => r.status === RowStatus.FAILED);

  if (!batch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{batch.fileName}</h1>
            <p className="text-sm text-gray-500">
              创建于 {new Date(batch.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            导出报告
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-500">状态</p>
            <span className={`status-badge status-${batch.status} inline-block mt-1 text-sm`}>
              {statusLabels[batch.status] || batch.status}
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">总记录</p>
            <p className="text-2xl font-bold text-gray-900">{batch.totalRows}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">有效</p>
            <p className="text-2xl font-bold text-green-600">{batch.validRows}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">成功</p>
            <p className="text-2xl font-bold text-blue-600">{batch.successRows}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">失败</p>
            <p className="text-2xl font-bold text-red-600">{batch.failedRows}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {batch.status === SyncStatus.PENDING && (
            <button
              onClick={handleValidate}
              className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              验证数据
            </button>
          )}
          {batch.status === SyncStatus.VALIDATED && (
            <button
              onClick={handleProcess}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4 mr-2" />
              开始同步
            </button>
          )}
          {(batch.status === SyncStatus.FAILED ||
            batch.status === SyncStatus.PARTIAL_SUCCESS) &&
            failedRows.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === failedRows.length && failedRows.length > 0}
                    onChange={toggleAllFailed}
                    className="mr-2"
                  />
                  选择所有失败记录
                </label>
                <button
                  onClick={handleRetry}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重试 {selectedRows.length > 0 ? `(${selectedRows.length}条)` : '全部失败'}
                </button>
              </div>
            )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">记录详情</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'all'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'success'
                  ? 'bg-green-200 text-green-800'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              成功
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'failed'
                  ? 'bg-red-200 text-red-800'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              失败
            </button>
            <button
              onClick={() => setFilter('invalid')}
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'invalid'
                  ? 'bg-orange-200 text-orange-800'
                  : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
              }`}
            >
              验证失败
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  {(batch.status === SyncStatus.FAILED ||
                    batch.status === SyncStatus.PARTIAL_SUCCESS) && (
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.length ===
                        filteredRows.filter((r) => r.status === RowStatus.FAILED).length &&
                        filteredRows.filter((r) => r.status === RowStatus.FAILED).length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(
                            filteredRows.filter((r) => r.status === RowStatus.FAILED).map((r) => r.id)
                          );
                        } else {
                          setSelectedRows([]);
                        }
                      }}
                      className="rounded"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  行号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  原始数据
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  错误信息
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API 响应
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    {row.status === RowStatus.FAILED && (
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row.rowNumber}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`status-badge status-${row.status}`}>
                      {row.status === RowStatus.SUCCESS && (
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                      )}
                      {(row.status === RowStatus.FAILED || row.status === RowStatus.INVALID) && (
                        <XCircle className="h-3 w-3 inline mr-1" />
                      )}
                      {statusLabels[row.status] || row.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={JSON.stringify(row.rawData)}>
                      {Object.entries(row.rawData).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="truncate">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                      {Object.keys(row.rawData).length > 3 && (
                        <span className="text-gray-500">
                          +{Object.keys(row.rawData).length - 3} 更多字段
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-red-600 max-w-xs">
                    {row.validationErrors && row.validationErrors.length > 0 && (
                      <div className="space-y-1">
                        {row.validationErrors.map((err, idx) => (
                          <div key={idx} className="text-xs">
                            {err}
                          </div>
                        ))}
                      </div>
                    )}
                    {row.errorMessage && (
                      <div className="text-xs" title={row.errorMessage}>
                        {row.errorMessage.length > 50
                          ? row.errorMessage.slice(0, 50) + '...'
                          : row.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-xs">
                    {row.apiResponse && (
                      <pre
                        className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-20 overflow-y-auto"
                        title={JSON.stringify(row.apiResponse, null, 2)}
                      >
                        {JSON.stringify(row.apiResponse, null, 2).slice(0, 100)}...
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    暂无记录
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
