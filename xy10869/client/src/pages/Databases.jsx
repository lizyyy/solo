import React, { useState, useEffect } from 'react';
import { Plus, Database, Globe, Server, Tag } from 'lucide-react';
import { migrationAPI, generateIdempotencyKey } from '../services/api';

const Databases = () => {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDatabase, setNewDatabase] = useState({
    name: '',
    host: '',
    port: 3306,
    database_name: '',
    username: '',
    password: '',
    type: 'mysql',
    environment: 'production'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await migrationAPI.getDatabases();
      setDatabases(res.data.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDatabase = async () => {
    try {
      generateIdempotencyKey();
      await migrationAPI.createDatabase(newDatabase);
      setShowCreateModal(false);
      setNewDatabase({
        name: '',
        host: '',
        port: 3306,
        database_name: '',
        username: '',
        password: '',
        type: 'mysql',
        environment: 'production'
      });
      loadData();
    } catch (error) {
      alert('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const environmentColors = {
    production: 'bg-red-100 text-red-700',
    staging: 'bg-yellow-100 text-yellow-700',
    development: 'bg-green-100 text-green-700',
    test: 'bg-blue-100 text-blue-700'
  };

  const environmentLabels = {
    production: '生产环境',
    staging: '预发布环境',
    development: '开发环境',
    test: '测试环境'
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
          <h1 className="text-2xl font-bold text-gray-900">目标数据库</h1>
          <p className="text-gray-500 mt-1">管理迁移脚本目标数据库配置</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          添加数据库
        </button>
      </div>

      <div className="card">
        {databases.length === 0 ? (
          <div className="py-16 text-center">
            <Database size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">暂无数据库配置</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-4 text-sm"
            >
              添加第一个数据库
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {databases.map(db => (
              <div key={db.id} className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{db.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${environmentColors[db.environment] || 'bg-gray-100 text-gray-700'}`}>
                    {environmentLabels[db.environment] || db.environment}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Server size={14} />
                    <span className="font-mono">{db.host}:{db.port}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Database size={14} />
                    <span>{db.database_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Globe size={14} />
                    <span>{db.type.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Tag size={14} />
                    <span>{db.username}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  {new Date(db.created_at).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 my-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">添加目标数据库</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">数据库名称 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newDatabase.name}
                  onChange={(e) => setNewDatabase(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：用户中心数据库"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">数据库类型</label>
                  <select
                    className="form-input"
                    value={newDatabase.type}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">环境</label>
                  <select
                    className="form-input"
                    value={newDatabase.environment}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, environment: e.target.value }))}
                  >
                    {Object.entries(environmentLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">主机地址 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newDatabase.host}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <label className="form-label">端口 *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newDatabase.port}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">数据库名 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newDatabase.database_name}
                  onChange={(e) => setNewDatabase(prev => ({ ...prev, database_name: e.target.value }))}
                  placeholder="mydb"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">用户名 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newDatabase.username}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="root"
                  />
                </div>
                <div>
                  <label className="form-label">密码</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newDatabase.password}
                    onChange={(e) => setNewDatabase(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="******"
                  />
                </div>
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
                onClick={handleCreateDatabase}
                disabled={!newDatabase.name || !newDatabase.host || !newDatabase.database_name || !newDatabase.username}
                className="btn btn-primary"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Databases;
