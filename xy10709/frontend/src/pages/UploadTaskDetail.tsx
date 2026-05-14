import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getUploadTask, releaseTask, rollbackTask, scanTask } from '../api';
import { UploadTask } from '../types';

export default function UploadTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState('');
  const [operator, setOperator] = useState('admin');
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  const { data: task, isLoading } = useQuery<UploadTask>(
    ['uploadTask', id],
    () => getUploadTask(Number(id))
  );

  const releaseMutation = useMutation(
    () => releaseTask(Number(id), operator, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['uploadTask', id]);
        setShowReleaseModal(false);
        setReason('');
      },
    }
  );

  const rollbackMutation = useMutation(
    () => rollbackTask(Number(id), operator, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['uploadTask', id]);
        setShowRollbackModal(false);
        setReason('');
      },
    }
  );

  const scanMutation = useMutation(() => scanTask(Number(id)), {
    onSuccess: () => {
      queryClient.invalidateQueries(['uploadTask', id]);
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

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const parseJson = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  if (!task) {
    return <div className="text-center py-12">任务不存在</div>;
  }

  const scanResult = parseJson(task.scan_result);
  const rawInput = parseJson(task.raw_input);
  const processedResult = parseJson(task.processed_result);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/uploads')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← 返回列表
          </button>
          <h2 className="text-2xl font-bold text-gray-800">任务详情</h2>
        </div>
        <div className="flex space-x-2">
          {task.status === 'pending' && (
            <button
              onClick={() => scanMutation.mutate()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              执行扫描
            </button>
          )}
          {task.status === 'quarantined' && (
            <button
              onClick={() => setShowReleaseModal(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              人工放行
            </button>
          )}
          {task.status === 'released' && (
            <button
              onClick={() => setShowRollbackModal(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            >
              回滚隔离
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">基本信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">任务ID</span>
              <span className="font-mono text-blue-600">{task.task_id}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">文件名</span>
              <span className="font-medium">{task.original_filename}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">文件类型</span>
              <span>{task.file_type}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">文件大小</span>
              <span>{(task.file_size / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">状态</span>
              <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">威胁等级</span>
              <span className={`px-3 py-1 rounded-full text-sm ${getThreatColor(task.threat_level)}`}>
                {task.threat_level}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">上传人</span>
              <span>{task.uploaded_by}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">所属组织</span>
              <span>{task.organization?.name || '-'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">文件指纹</h3>
          <div className="space-y-3">
            <div className="py-2 border-b">
              <span className="text-gray-600 text-sm block mb-1">MD5</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                {task.file_hash_md5 || '-'}
              </code>
            </div>
            <div className="py-2">
              <span className="text-gray-600 text-sm block mb-1">SHA256</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                {task.file_hash_sha256 || '-'}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">原始输入</h3>
          {rawInput ? (
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(rawInput, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">无原始输入数据</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">处理结果</h3>
          {processedResult ? (
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(processedResult, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">未处理</p>
          )}
        </div>
      </div>

      {scanResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 扫描结果 - 错误明细</h3>
          <div className="mb-4">
            <span className="text-gray-600">扫描引擎: </span>
            <span className="font-medium">{scanResult.engine}</span>
          </div>
          {scanResult.threats_found && scanResult.threats_found.length > 0 ? (
            <div className="space-y-3">
              {scanResult.threats_found.map((threat: any, index: number) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-red-800">威胁类型: {threat.type}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getThreatColor(scanResult.threat_level)}`}>
                      {scanResult.threat_level}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{threat.description}</p>
                  <p className="text-gray-500 text-sm mt-1">匹配模式: <code>{threat.pattern}</code></p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">✓ 未检测到威胁，文件安全</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 关联安全日志</h3>
        {task.security_logs && task.security_logs.length > 0 ? (
          <div className="space-y-3">
            {task.security_logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-blue-600">{log.log_id}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                    <span className="text-sm font-medium">{log.event_type}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-700">{log.message}</p>
                {log.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 cursor-pointer">查看详情</summary>
                    <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                      {log.details}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">暂无关联日志</p>
        )}
      </div>

      {showReleaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">人工放行确认</h3>
            <p className="text-gray-600 mb-4">确定要放行文件 "{task.original_filename}" 吗？此操作会记录到安全日志。</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">放行原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请说明放行原因..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowReleaseModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => releaseMutation.mutate()}
                disabled={!reason || releaseMutation.isLoading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400"
              >
                {releaseMutation.isLoading ? '处理中...' : '确认放行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRollbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">回滚隔离确认</h3>
            <p className="text-gray-600 mb-4">确定要将文件 "{task.original_filename}" 回滚到隔离状态吗？此操作会记录到安全日志。</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">操作人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">回滚原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请说明回滚原因..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => rollbackMutation.mutate()}
                disabled={!reason || rollbackMutation.isLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
              >
                {rollbackMutation.isLoading ? '处理中...' : '确认回滚'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
