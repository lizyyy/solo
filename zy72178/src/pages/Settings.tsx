import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitBranch,
  Gauge,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Settings as SettingsIcon,
  User,
  Shield,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { useModelVersionStore } from '../store/modelVersionStore';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../utils/date';
import { cn } from '../lib/utils';
import type { ModelVersion } from '../types';
import { exportDB, importDB, clearDatabase, initMockData } from '../db/mockData';
import { getDB } from '../db';

export default function Settings() {
  const navigate = useNavigate();
  const { versions, fetchVersions, setActiveVersion, addVersion, updateVersion, deleteVersion } = useModelVersionStore();
  const { sidebarOpen, currentUser, setCurrentUser } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ModelVersion | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [userName, setUserName] = useState(currentUser);

  useEffect(() => {
    fetchVersions();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('confidenceThreshold');
    if (saved) setThreshold(parseFloat(saved));
  }, []);

  const handleThresholdChange = (value: number) => {
    setThreshold(value);
    localStorage.setItem('confidenceThreshold', String(value));
  };

  const handleUserNameSave = () => {
    if (userName.trim()) {
      setCurrentUser(userName.trim());
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportDB();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rag-checkup-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('数据导出成功');
    } catch (error) {
      alert('导出失败: ' + (error as Error).message);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importDB(data);
      alert('数据导入成功');
      fetchVersions();
    } catch (error) {
      alert('导入失败: ' + (error as Error).message);
    }
    e.target.value = '';
  };

  const handleClearData = async () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return;
    try {
      await clearDatabase();
      await initMockData();
      alert('数据已重置为初始状态');
      fetchVersions();
    } catch (error) {
      alert('清空失败: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="系统设置"
          subtitle="管理模型版本、阈值配置和系统参数"
        />

        <main className="p-6">
          <div className="mb-4">
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回总览
            </button>
          </div>

          <div className="space-y-6 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800">
                      用户设置
                    </h3>
                    <p className="text-sm text-slate-500">配置当前操作用户名，用于记录操作日志</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="输入用户名"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                  <button
                    onClick={handleUserNameSave}
                    className="btn btn-primary gap-2"
                  >
                    <Check className="w-4 h-4" />
                    保存
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent-emerald-100 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-accent-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800">
                      置信度阈值
                    </h3>
                    <p className="text-sm text-slate-500">模型输出置信度低于此阈值时标记为需人工审核</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                    <span className="w-16 text-center font-mono font-bold text-slate-800">
                      {(threshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>10%</span>
                    <span className="text-primary-600 font-medium">
                      当前: {(threshold * 100).toFixed(0)}%
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-amber-100 flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-accent-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-slate-800">
                        模型版本管理
                      </h3>
                      <p className="text-sm text-slate-500">管理体检使用的模型版本</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    添加版本
                  </button>
                </div>

                <div className="space-y-3">
                  {versions.map((version, idx) => (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.02 * idx }}
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        version.isActive
                          ? "border-primary-300 bg-primary-50/50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            version.isActive ? "bg-primary-500" : "bg-slate-300"
                          )} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">
                                {version.name}
                              </span>
                              <span className="text-sm text-slate-500">
                                v{version.version}
                              </span>
                              {version.isActive && (
                                <span className="badge badge-primary text-xs">当前版本</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {version.description}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              创建于 {formatDateTime(version.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!version.isActive && (
                            <button
                              onClick={() => setActiveVersion(version.id)}
                              className="btn btn-secondary gap-1 text-xs py-1 px-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              设为当前
                            </button>
                          )}
                          <button
                            onClick={() => setEditingVersion(version)}
                            className="btn btn-secondary gap-1 text-xs py-1 px-2"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          {!version.isActive && (
                            <button
                              onClick={() => {
                                if (confirm('确定删除此版本？')) {
                                  deleteVersion(version.id);
                                }
                              }}
                              className="btn btn-ghost text-accent-rose-600 gap-1 text-xs py-1 px-2 hover:bg-accent-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800">
                      数据管理
                    </h3>
                    <p className="text-sm text-slate-500">导入导出本地数据库数据</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleExportData}
                    className="btn btn-secondary gap-2 justify-center"
                  >
                    <Download className="w-4 h-4" />
                    导出数据
                  </button>
                  <label className="btn btn-secondary gap-2 justify-center cursor-pointer">
                    <Upload className="w-4 h-4" />
                    导入数据
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={handleClearData}
                    className="btn btn-ghost text-accent-rose-600 border border-accent-rose-200 hover:bg-accent-rose-50 gap-2 justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                    重置数据
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center pt-4 pb-8"
            >
              <p className="text-xs text-slate-400">
                RAG知识库引用体检系统 v1.0.0 · 本地存储 · 数据保存在浏览器 IndexedDB 中
              </p>
            </motion.div>
          </div>
        </main>
      </div>

      {showAddModal && (
        <VersionModal
          onClose={() => setShowAddModal(false)}
          onSave={(data) => {
            addVersion(data);
            setShowAddModal(false);
          }}
        />
      )}

      {editingVersion && (
        <VersionModal
          version={editingVersion}
          onClose={() => setEditingVersion(null)}
          onSave={(data) => {
            updateVersion(editingVersion.id, data);
            setEditingVersion(null);
          }}
        />
      )}
    </div>
  );
}

function VersionModal({
  version,
  onClose,
  onSave,
}: {
  version?: ModelVersion;
  onClose: () => void;
  onSave: (data: Partial<ModelVersion>) => void;
}) {
  const [name, setName] = useState(version?.name || '');
  const [versionStr, setVersionStr] = useState(version?.version || '');
  const [description, setDescription] = useState(version?.description || '');
  const [config, setConfig] = useState(version?.config ? JSON.stringify(version.config, null, 2) : '{}');

  const handleSave = () => {
    try {
      const configObj = JSON.parse(config);
      onSave({
        name: name.trim(),
        version: versionStr.trim(),
        description: description.trim(),
        config: configObj,
      });
    } catch (e) {
      alert('配置必须是有效的JSON');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-serif font-bold text-slate-800">
            {version ? '编辑版本' : '添加版本'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">模型名称</label>
            <input
              className="input"
              placeholder="如：Qwen2.5-7B-Instruct"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">版本号</label>
            <input
              className="input"
              placeholder="如：1.0.0"
              value={versionStr}
              onChange={(e) => setVersionStr(e.target.value)}
            />
          </div>
          <div>
            <label className="label">描述</label>
            <input
              className="input"
              placeholder="版本说明，如：修复了召回率问题"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">配置 (JSON)</label>
            <textarea
              className="input min-h-[100px] font-mono text-xs"
              placeholder='{"temperature": 0.1, "top_p": 0.9}'
              value={config}
              onChange={(e) => setConfig(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="btn btn-secondary">取消</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !versionStr.trim()}
            className="btn btn-primary gap-2"
          >
            <Check className="w-4 h-4" />
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}
