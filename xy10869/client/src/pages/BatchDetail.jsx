import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Check, X, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { migrationAPI, generateIdempotencyKey } from '../services/api';

const BatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCompensationModal, setShowCompensationModal] = useState(false);
  const [newCompensation, setNewCompensation] = useState({
    action_type: 'manual_fix',
    action_content: '',
    remarks: ''
  });

  useEffect(() => {
    loadDetails();
  }, [id]);

  const loadDetails = async () => {
    try {
      const response = await migrationAPI.getBatchDetails(id);
      setDetails(response.data.data);
    } catch (error) {
      console.error('加载批次详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirm('确定要执行这个预演批次吗？')) return;
    try {
      generateIdempotencyKey();
      await migrationAPI.executeBatch(id);
      loadDetails();
    } catch (error) {
      alert('执行失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    const statusLabels = {
      confirmed: '确认通过',
      rollback_required: '需要回滚',
      compensated: '已补偿'
    };
    if (!confirm(`确定要将状态更新为「${statusLabels[newStatus]}」吗？`)) return;
    
    try {
      generateIdempotencyKey();
      await migrationAPI.updateBatchStatus(id, newStatus, '当前用户', '');
      loadDetails();
    } catch (error) {
      alert('更新状态失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateCompensation = async () => {
    try {
      generateIdempotencyKey();
      await migrationAPI.createCompensationAction(id, newCompensation);
      setShowCompensationModal(false);
      setNewCompensation({
        action_type: 'manual_fix',
        action_content: '',
        remarks: ''
      });
      loadDetails();
    } catch (error) {
      alert('创建补偿操作失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExecuteCompensation = async (actionId) => {
    if (!confirm('确定要执行这个补偿操作吗？')) return;
    try {
      generateIdempotencyKey();
      await migrationAPI.executeCompensation(actionId, {
        executed_by: '当前用户',
        result: '执行完成'
      });
      loadDetails();
    } catch (error) {
      alert('执行补偿失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const statusLabels = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    waiting_confirmation: '待确认',
    confirmed: '已确认',
    rollback_required: '需回滚',
    rolled_back: '已回滚',
    compensated: '已补偿'
  };

  const actionTypeLabels = {
    manual_fix: '手动修复',
    rollback_script: '回滚脚本',
    data_restore: '数据恢复',
    skip_and_continue: '跳过继续',
    other: '其他'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const batch = details?.batch;
  if (!batch) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">批次不存在</div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'affected', label: '影响表' },
    { id: 'slow', label: '慢查询' },
    { id: 'rollback', label: '回滚校验' },
    { id: 'compensation', label: '补偿操作' }
  ];

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/batches')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            批次 #{batch.batch_number}
          </h1>
          <p className="text-gray-500 mt-1">
            {batch.migration_script_name} - {batch.target_database_name}
          </p>
        </div>
        <span className={`status-badge status-${batch.status} ml-auto`}>
          {statusLabels[batch.status] || batch.status}
        </span>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">批次 ID</span>
                <span className="font-mono text-sm text-gray-700">{batch.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">迁移脚本</span>
                <span className="text-gray-700">{batch.migration_script_name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">目标数据库</span>
                <span className="text-gray-700">{batch.target_database_name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">操作人</span>
                <span className="text-gray-700">{batch.operator || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-700">{batch.created_at || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">执行耗时</span>
                <span className="text-gray-700">
                  {batch.execution_duration ? `${batch.execution_duration} 秒` : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">备注</span>
                <span className="text-gray-700">{batch.remarks || '-'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">执行统计</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">影响表数量</p>
                <p className="text-2xl font-bold text-gray-900">
                  {batch.affected_tables_count || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">影响行数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {batch.affected_rows_count?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">慢查询数量</p>
                <p className="text-2xl font-bold text-gray-900">
                  {batch.slow_queries_count || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">补偿操作数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {details?.compensationActions?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {batch.status === 'failed' && batch.error_message && (
            <div className="card lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-500" size={24} />
                <h2 className="text-lg font-semibold text-gray-900">错误信息</h2>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-red-700 font-medium">{batch.error_message}</p>
                {batch.error_stack && (
                  <pre className="mt-3 text-sm text-red-600 overflow-x-auto">
                    {batch.error_stack}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="card lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">操作</h2>
            <div className="flex flex-wrap gap-3">
              {batch.status === 'pending' && (
                <button
                  onClick={handleExecute}
                  className="btn btn-success flex items-center gap-2"
                >
                  <Play size={20} />
                  执行预演
                </button>
              )}
              {batch.status === 'waiting_confirmation' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('confirmed')}
                    className="btn btn-success flex items-center gap-2"
                  >
                    <Check size={20} />
                    确认通过
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('rollback_required')}
                    className="btn btn-danger flex items-center gap-2"
                  >
                    <X size={20} />
                    需要回滚
                  </button>
                </>
              )}
              {['failed', 'rollback_required'].includes(batch.status) && (
                <button
                  onClick={() => setShowCompensationModal(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus size={20} />
                  创建补偿操作
                </button>
              )}
              <button
                onClick={loadDetails}
                className="btn btn-secondary flex items-center gap-2"
              >
                <RefreshCw size={20} />
                刷新
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'affected' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">影响表列表</h2>
          {details?.affectedTables?.length === 0 ? (
            <div className="py-8 text-center text-gray-500">暂无影响表数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">表名</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">操作类型</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">影响行数</th>
                  </tr>
                </thead>
                <tbody>
                  {details.affectedTables.map(table => (
                    <tr key={table.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">{table.table_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {table.operation_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{table.affected_rows?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'slow' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">慢查询列表</h2>
          {details?.slowQueries?.length === 0 ? (
            <div className="py-8 text-center text-gray-500">暂无慢查询数据</div>
          ) : (
            <div className="space-y-4">
              {details.slowQueries.map(query => (
                <div key={query.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">
                        {query.execution_time_ms} ms
                      </span>
                      <span className="text-sm text-gray-500">
                        扫描行数: {query.rows_examined?.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        影响行数: {query.rows_affected?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <pre className="p-3 bg-gray-800 text-green-400 rounded text-sm overflow-x-auto">
                    {query.query_text}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rollback' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">回滚校验记录</h2>
          {details?.rollbackValidations?.length === 0 ? (
            <div className="py-8 text-center text-gray-500">暂无回滚校验记录</div>
          ) : (
            <div className="space-y-4">
              {details.rollbackValidations.map(validation => (
                <div key={validation.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`status-badge status-${validation.status}`}>
                      {validation.status === 'passed' ? '通过' : validation.status === 'failed' ? '失败' : '待处理'}
                    </span>
                    <span className="text-sm text-gray-500">
                      校验人: {validation.validated_by || '-'}
                    </span>
                  </div>
                  <p className="text-gray-700">{validation.validation_result}</p>
                  {validation.remarks && (
                    <p className="mt-2 text-sm text-gray-500">备注: {validation.remarks}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'compensation' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">补偿操作记录</h2>
            {['failed', 'rollback_required'].includes(batch.status) && (
              <button
                onClick={() => setShowCompensationModal(true)}
                className="btn btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={18} />
                创建补偿
              </button>
            )}
          </div>
          {details?.compensationActions?.length === 0 ? (
            <div className="py-8 text-center text-gray-500">暂无补偿操作记录</div>
          ) : (
            <div className="space-y-4">
              {details.compensationActions.map(action => (
                <div key={action.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                        {actionTypeLabels[action.action_type] || action.action_type}
                      </span>
                      <span className={`status-badge status-${action.status === 'executed' ? 'completed' : 'pending'}`}>
                        {action.status === 'executed' ? '已执行' : '待执行'}
                      </span>
                    </div>
                    {action.status !== 'executed' && (
                      <button
                        onClick={() => handleExecuteCompensation(action.id)}
                        className="btn btn-success text-sm"
                      >
                        执行
                      </button>
                    )}
                  </div>
                  <p className="text-gray-700">{action.action_content}</p>
                  {action.result && (
                    <p className="mt-2 text-sm text-green-600">执行结果: {action.result}</p>
                  )}
                  {action.remarks && (
                    <p className="mt-2 text-sm text-gray-500">备注: {action.remarks}</p>
                  )}
                  {action.executed_by && (
                    <p className="mt-2 text-sm text-gray-500">
                      执行人: {action.executed_by} - {action.executed_at}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCompensationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">创建补偿操作</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">操作类型 *</label>
                <select
                  className="form-input"
                  value={newCompensation.action_type}
                  onChange={(e) => setNewCompensation(prev => ({ ...prev, action_type: e.target.value }))}
                >
                  {Object.entries(actionTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">操作内容 *</label>
                <textarea
                  className="form-input"
                  value={newCompensation.action_content}
                  onChange={(e) => setNewCompensation(prev => ({ ...prev, action_content: e.target.value }))}
                  placeholder="请详细描述补偿操作的内容"
                  rows={4}
                />
              </div>
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  value={newCompensation.remarks}
                  onChange={(e) => setNewCompensation(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="请输入备注信息"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCompensationModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateCompensation}
                disabled={!newCompensation.action_content}
                className="btn btn-primary"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetail;
