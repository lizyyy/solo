import React, { useState, useEffect } from 'react';
import { Plus, FileCode, Database } from 'lucide-react';
import { migrationAPI, generateIdempotencyKey } from '../services/api';

const Scripts = () => {
  const [scripts, setScripts] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScript, setNewScript] = useState({
    name: '',
    description: '',
    content: '',
    author: '',
    version: '',
    target_database_id: '',
    rollback_script: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scriptsRes, databasesRes] = await Promise.all([
        migrationAPI.getScripts(pagination.page, pagination.pageSize),
        migrationAPI.getDatabases()
      ]);
      setScripts(scriptsRes.data.data.list || []);
      setPagination(prev => ({ ...prev, total: scriptsRes.data.data.total || 0 }));
      setDatabases(databasesRes.data.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScript = async () => {
    try {
      generateIdempotencyKey();
      await migrationAPI.createScript(newScript);
      setShowCreateModal(false);
      setNewScript({
        name: '',
        description: '',
        content: '',
        author: '',
        version: '',
        target_database_id: '',
        rollback_script: ''
      });
      loadData();
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.error || error.message));
    }
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
          <h1 className="text-2xl font-bold text-gray-900">迁移脚本</h1>
          <p className="text-gray-500 mt-1">管理数据库迁移脚本</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          创建脚本
        </button>
      </div>

      <div className="card">
        {scripts.length === 0 ? (
          <div className="py-16 text-center">
            <FileCode size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">暂无迁移脚本</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-4 text-sm"
            >
              创建第一个脚本
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scripts.map(script => (
              <div key={script.id} className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{script.name}</h3>
                  {script.version && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      v{script.version}
                    </span>
                  )}
                </div>
                {script.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{script.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Database size={14} />
                  <span>
                    {databases.find(d => d.id === script.target_database_id)?.name || '未指定'}
                  </span>
                </div>
                {script.author && (
                  <p className="text-xs text-gray-500 mt-2">作者: {script.author}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(script.created_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 my-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">创建迁移脚本</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">脚本名称 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newScript.name}
                    onChange={(e) => setNewScript(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入脚本名称"
                  />
                </div>
                <div>
                  <label className="form-label">版本</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newScript.version}
                    onChange={(e) => setNewScript(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1.0.0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">作者</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newScript.author}
                    onChange={(e) => setNewScript(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="请输入作者"
                  />
                </div>
                <div>
                  <label className="form-label">目标数据库</label>
                  <select
                    className="form-input"
                    value={newScript.target_database_id}
                    onChange={(e) => setNewScript(prev => ({ ...prev, target_database_id: e.target.value }))}
                  >
                    <option value="">请选择</option>
                    {databases.map(db => (
                      <option key={db.id} value={db.id}>{db.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">描述</label>
                <input
                  type="text"
                  className="form-input"
                  value={newScript.description}
                  onChange={(e) => setNewScript(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="请输入脚本描述"
                />
              </div>
              <div>
                <label className="form-label">SQL 内容 *</label>
                <textarea
                  className="form-input font-mono text-sm"
                  value={newScript.content}
                  onChange={(e) => setNewScript(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="-- 请输入 SQL 语句"
                  rows={8}
                />
              </div>
              <div>
                <label className="form-label">回滚脚本</label>
                <textarea
                  className="form-input font-mono text-sm"
                  value={newScript.rollback_script}
                  onChange={(e) => setNewScript(prev => ({ ...prev, rollback_script: e.target.value }))}
                  placeholder="-- 请输入回滚 SQL 语句"
                  rows={4}
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
                onClick={handleCreateScript}
                disabled={!newScript.name || !newScript.content}
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

export default Scripts;
