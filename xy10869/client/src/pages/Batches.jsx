import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Eye, Download, Filter, RefreshCw } from 'lucide-react';
import { migrationAPI, generateIdempotencyKey } from '../services/api';

const Batches = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    migration_script_id: '',
    target_database_id: ''
  });
  const [newBatch, setNewBatch] = useState({
    migration_script_id: '',
    target_database_id: '',
    operator: '',
    remarks: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });

  useEffect(() => {
    loadData();
  }, [filters, pagination.page]);

  const loadData = async () => {
    try {
      const [batchesRes, scriptsRes, databasesRes] = await Promise.all([
        migrationAPI.getBatches({
          page: pagination.page,
          page_size: pagination.pageSize,
          ...filters
        }),
        migrationAPI.getScripts(1, 100),
        migrationAPI.getDatabases()
      ]);
      setBatches(batchesRes.data.data.list || []);
      setPagination(prev => ({ ...prev, total: batchesRes.data.data.total || 0 }));
      setScripts(scriptsRes.data.data.list || []);
      setDatabases(databasesRes.data.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    try {
      generateIdempotencyKey();
      await migrationAPI.createBatch(newBatch);
      setShowCreateModal(false);
      setNewBatch({
        migration_script_id: '',
        target_database_id: '',
        operator: '',
        remarks: ''
      });
      loadData();
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExecute = async (id) => {
    if (!confirm('确定要执行这个预演批次吗？')) return;
    try {
      generateIdempotencyKey();
      await migrationAPI.executeBatch(id);
      loadData();
    } catch (error) {
      alert('执行失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleExport = async (id) => {
    try {
      const response = await migrationAPI.exportBatch(id);
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-${id}.json`;
      a.click();
    } catch (error) {
      alert('导出失败: ' + error.message);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">预演批次</h1>
          <p className="text-gray-500 mt-1">管理和执行数据库迁移预演</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          创建批次
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter size={20} className="text-gray-500" />
          <span className="font-medium text-gray-700">筛选条件</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">状态</label>
            <select
              className="form-input"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">全部</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">迁移脚本</label>
            <select
              className="form-input"
              value={filters.migration_script_id}
              onChange={(e) => setFilters(prev => ({ ...prev, migration_script_id: e.target.value }))}
            >
              <option value="">全部</option>
              {scripts.map(script => (
                <option key={script.id} value={script.id}>{script.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">目标数据库</label>
            <select
              className="form-input"
              value={filters.target_database_id}
              onChange={(e) => setFilters(prev => ({ ...prev, target_database_id: e.target.value }))}
            >
              <option value="">全部</option>
              {databases.map(db => (
                <option key={db.id} value={db.id}>{db.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">批次号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">迁移脚本</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">目标数据库</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">影响行数</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">慢查询</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">操作人</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                batches.map(batch => (
                  <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      #{batch.batch_number}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {batch.migration_script_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {batch.target_database_name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`status-badge status-${batch.status}`}>
                        {statusLabels[batch.status] || batch.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {batch.affected_rows_count?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {batch.slow_queries_count || 0}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {batch.operator || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/batches/${batch.id}`)}
                          className="p-1 text-gray-500 hover:text-primary-600"
                          title="查看详情"
                        >
                          <Eye size={18} />
                        </button>
                        {batch.status === 'pending' && (
                          <button
                            onClick={() => handleExecute(batch.id)}
                            className="p-1 text-gray-500 hover:text-green-600"
                            title="执行预演"
                          >
                            <Play size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleExport(batch.id)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="导出数据"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            共 {pagination.total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="btn btn-secondary text-sm"
            >
              上一页
            </button>
            <span className="text-sm text-gray-600">
              第 {pagination.page} 页
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={batches.length < pagination.pageSize}
              className="btn btn-secondary text-sm"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6">创建预演批次</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">迁移脚本 *</label>
                <select
                  className="form-input"
                  value={newBatch.migration_script_id}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, migration_script_id: e.target.value }))}
                >
                  <option value="">请选择</option>
                  {scripts.map(script => (
                    <option key={script.id} value={script.id}>{script.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">目标数据库 *</label>
                <select
                  className="form-input"
                  value={newBatch.target_database_id}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, target_database_id: e.target.value }))}
                >
                  <option value="">请选择</option>
                  {databases.map(db => (
                    <option key={db.id} value={db.id}>{db.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">操作人</label>
                <input
                  type="text"
                  className="form-input"
                  value={newBatch.operator}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, operator: e.target.value }))}
                  placeholder="请输入操作人姓名"
                />
              </div>
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  value={newBatch.remarks}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="请输入备注信息"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateBatch}
                disabled={!newBatch.migration_script_id || !newBatch.target_database_id}
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

export default Batches;
