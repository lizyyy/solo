import React, { useEffect, useState } from 'react';
import { db, seedLicenseDefinitions } from '../db';
import { LicenseDefinition } from '../types';
import { LICENSE_CATEGORY_LABELS, RISK_LEVEL_LABELS } from '../types';
import { Settings, Shield, Database, Download, Upload, Trash2, Plus, Edit2, Check, X } from 'lucide-react';

export function ConfigPage() {
  const [licenses, setLicenses] = useState<LicenseDefinition[]>([]);
  const [editingLicense, setEditingLicense] = useState<LicenseDefinition | null>(null);
  const [showNewLicense, setShowNewLicense] = useState(false);
  const [newLicense, setNewLicense] = useState({
    spdxId: '',
    name: '',
    fullName: '',
    shortName: '',
    category: 'permissive' as LicenseDefinition['category'],
    riskLevel: 'safe' as LicenseDefinition['riskLevel'],
    url: '',
    description: '',
    obligations: [] as string[],
    conditions: [] as string[],
    permissions: [] as string[],
    restrictions: [] as string[],
    forbidden: [] as string[],
    isCopyleft: false,
  });
  const [editCondition, setEditCondition] = useState('');
  const [editForbidden, setEditForbidden] = useState('');

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    const data = await db.licenseDefinitions.orderBy('spdxId').toArray();
    setLicenses(data);
  };

  const handleSeedLicenses = async () => {
    if (confirm('确定要重置许可证定义？这将重新加载内置的20种许可证定义。')) {
      await seedLicenseDefinitions();
      await loadLicenses();
    }
  };

  const handleAddLicense = async () => {
    if (!newLicense.spdxId.trim() || !newLicense.name.trim()) return;
    
    const exists = await db.licenseDefinitions.where('spdxId').equals(newLicense.spdxId).first();
    if (exists) {
      alert('该SPDX ID已存在');
      return;
    }

    const id = crypto.randomUUID();
    const fullName = newLicense.fullName || newLicense.name;
    const shortName = newLicense.shortName || newLicense.spdxId;
    
    await db.licenseDefinitions.add({
      ...newLicense,
      id,
      fullName,
      shortName,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await loadLicenses();
    setShowNewLicense(false);
    setNewLicense({
      spdxId: '',
      name: '',
      fullName: '',
      shortName: '',
      category: 'permissive',
      riskLevel: 'safe',
      url: '',
      description: '',
      obligations: [],
      conditions: [],
      permissions: [],
      restrictions: [],
      forbidden: [],
      isCopyleft: false,
    });
    setEditCondition('');
    setEditForbidden('');
  };

  const handleUpdateLicense = async () => {
    if (!editingLicense) return;
    await db.licenseDefinitions.update(editingLicense.id, {
      ...editingLicense,
      updatedAt: Date.now(),
    });
    await loadLicenses();
    setEditingLicense(null);
  };

  const handleDeleteLicense = async (id: string, spdxId: string) => {
    if (confirm(`确定删除许可证 ${spdxId}？`)) {
      await db.licenseDefinitions.delete(id);
      await loadLicenses();
    }
  };

  const handleExportData = async () => {
    const [projects, deps, waivers, reports, licenseDefs] = await Promise.all([
      db.projects.toArray(),
      db.dependencies.toArray(),
      db.waivers.toArray(),
      db.reports.toArray(),
      db.licenseDefinitions.toArray(),
    ]);

    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      projects,
      dependencies: deps,
      waivers,
      reports,
      licenseDefinitions: licenseDefs.filter((l) => l.isCustom),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-wall-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data.projects || !data.dependencies) {
        throw new Error('无效的数据格式');
      }

      if (!confirm('导入将合并现有数据，确定继续？')) {
        e.target.value = '';
        return;
      }

      await db.transaction('rw', [
        db.projects,
        db.dependencies,
        db.waivers,
        db.reports,
        db.licenseDefinitions,
      ], async () => {
        if (data.projects?.length) {
          for (const p of data.projects) {
            await db.projects.put(p);
          }
        }
        if (data.dependencies?.length) {
          for (const d of data.dependencies) {
            await db.dependencies.put(d);
          }
        }
        if (data.waivers?.length) {
          for (const w of data.waivers) {
            await db.waivers.put(w);
          }
        }
        if (data.reports?.length) {
          for (const r of data.reports) {
            await db.reports.put(r);
          }
        }
        if (data.licenseDefinitions?.length) {
          for (const l of data.licenseDefinitions) {
            await db.licenseDefinitions.put(l);
          }
        }
      });

      alert('导入成功');
      e.target.value = '';
    } catch (err) {
      alert('导入失败: ' + (err as Error).message);
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('确定清空所有数据？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有项目、依赖、豁免、报告数据都将被永久删除？')) return;

    await db.transaction('rw', [
      db.projects,
      db.dependencies,
      db.dependencyFiles,
      db.waivers,
      db.reports,
      db.statusLogs,
      db.auditLogs,
    ], async () => {
      await db.projects.clear();
      await db.dependencies.clear();
      await db.dependencyFiles.clear();
      await db.waivers.clear();
      await db.reports.clear();
      await db.statusLogs.clear();
      await db.auditLogs.clear();
    });

    alert('数据已清空');
    window.location.reload();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'permissive':
        return 'bg-emerald-100 text-emerald-700';
      case 'copyleft':
        return 'bg-amber-100 text-amber-700';
      case 'agpl':
        return 'bg-red-100 text-red-700';
      case 'proprietary':
        return 'bg-purple-100 text-purple-700';
      case 'public_domain':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">
            系统配置
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            管理许可证定义和系统数据
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              许可证定义
              <span className="text-xs text-slate-500 font-normal">
                共 {licenses.length} 种
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewLicense(true)}
                className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                新增
              </button>
              <button
                onClick={handleSeedLicenses}
                className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                title="重置为默认"
              >
                <Database className="w-3 h-3" />
                重置默认
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              {licenses.map((lic) => (
                <div
                  key={lic.id}
                  className="p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors"
                >
                  {editingLicense?.id === lic.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">SPDX ID</label>
                          <input
                            type="text"
                            className="input py-1.5 text-sm font-mono"
                            value={editingLicense.spdxId}
                            onChange={(e) => setEditingLicense({ ...editingLicense, spdxId: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">名称</label>
                          <input
                            type="text"
                            className="input py-1.5 text-sm"
                            value={editingLicense.name}
                            onChange={(e) => setEditingLicense({ ...editingLicense, name: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">分类</label>
                          <select
                            className="input py-1.5 text-sm"
                            value={editingLicense.category}
                            onChange={(e) => setEditingLicense({ ...editingLicense, category: e.target.value as any })}
                          >
                            <option value="permissive">宽松型</option>
                            <option value="copyleft">弱Copyleft</option>
                            <option value="agpl">强Copyleft</option>
                            <option value="proprietary">专有</option>
                            <option value="public_domain">公有领域</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">风险等级</label>
                          <select
                            className="input py-1.5 text-sm"
                            value={editingLicense.riskLevel}
                            onChange={(e) => setEditingLicense({ ...editingLicense, riskLevel: e.target.value as any })}
                          >
                            <option value="safe">低风险</option>
                            <option value="warning">中风险</option>
                            <option value="critical">高风险</option>
                            <option value="unknown">未知</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">官方URL</label>
                        <input
                          type="url"
                          className="input py-1.5 text-sm"
                          value={editingLicense.url || ''}
                          onChange={(e) => setEditingLicense({ ...editingLicense, url: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">描述</label>
                        <textarea
                          className="textarea py-1.5 text-sm h-16"
                          value={editingLicense.description || ''}
                          onChange={(e) => setEditingLicense({ ...editingLicense, description: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingLicense(null)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          onClick={handleUpdateLicense}
                          className="p-1 hover:bg-emerald-100 rounded"
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-semibold text-sm">{lic.spdxId}</span>
                          <span className={`badge text-[10px] ${getCategoryColor(lic.category)}`}>
                            {LICENSE_CATEGORY_LABELS[lic.category]}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {lic.name}
                          </span>
                          {lic.isCustom && (
                            <span className="badge bg-purple-100 text-purple-600 text-[10px]">
                              自定义
                            </span>
                          )}
                        </div>
                        {lic.description && (
                          <p className="text-xs text-slate-500 mb-1">{lic.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`text-${lic.riskLevel === 'critical' ? 'red' : lic.riskLevel === 'warning' ? 'amber' : lic.riskLevel === 'safe' ? 'emerald' : 'slate'}-600`}>
                            {RISK_LEVEL_LABELS[lic.riskLevel]}
                          </span>
                          {lic.url && (
                            <a
                              href={lic.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700"
                            >
                              查看原文
                            </a>
                          )}
                          {lic.conditions && lic.conditions.length > 0 && (
                            <span className="text-slate-500">
                              义务: {lic.conditions.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => setEditingLicense(lic)}
                          className="p-1 hover:bg-slate-200 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        {lic.isCustom && (
                          <button
                            onClick={() => handleDeleteLicense(lic.id, lic.spdxId)}
                            className="p-1 hover:bg-red-100 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Database className="w-4 h-4" />
                数据管理
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-sm font-medium text-slate-700 mb-2">导出数据</p>
                <p className="text-xs text-slate-500 mb-3">
                  将所有项目、依赖、豁免、报告数据导出为JSON文件，便于备份或迁移
                </p>
                <button
                  onClick={handleExportData}
                  className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出全部数据
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-sm font-medium text-slate-700 mb-2">导入数据</p>
                <p className="text-xs text-slate-500 mb-3">
                  从JSON文件导入数据，将与现有数据合并
                </p>
                <label className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2 cursor-pointer inline-flex">
                  <Upload className="w-4 h-4" />
                  导入数据
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-risk-critical mb-2">危险操作</p>
                <p className="text-xs text-red-600 mb-3">
                  清空所有项目数据，包括项目、依赖、豁免、报告等所有记录。此操作不可恢复！
                </p>
                <button
                  onClick={handleClearAllData}
                  className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-2 text-risk-critical border-risk-critical"
                >
                  <Trash2 className="w-4 h-4" />
                  清空所有数据
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                关于
              </h3>
            </div>
            <div className="p-4 text-sm text-slate-600 space-y-2">
              <p>
                <strong>开源依赖许可证墙</strong> v1.0
              </p>
              <p className="text-xs text-slate-500">
                用于法务和研发团队在软件发版前对项目依赖的开源组件进行许可证合规性审查。
              </p>
              <div className="pt-2 space-y-1 text-xs text-slate-500">
                <p>技术栈：React + TypeScript + Vite</p>
                <p>数据存储：IndexedDB (Dexie.js)</p>
                <p>状态管理：Zustand</p>
                <p>数据完全存储在本地浏览器，无需后端服务</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewLicense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[550px] shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4">
              新增许可证定义
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    SPDX ID *
                  </label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={newLicense.spdxId}
                    onChange={(e) => setNewLicense({ ...newLicense, spdxId: e.target.value })}
                    placeholder="例如: MIT, Apache-2.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    名称 *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newLicense.name}
                    onChange={(e) => setNewLicense({ ...newLicense, name: e.target.value })}
                    placeholder="许可证全称"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    分类
                  </label>
                  <select
                    className="input"
                    value={newLicense.category}
                    onChange={(e) => setNewLicense({ ...newLicense, category: e.target.value as any })}
                  >
                    <option value="permissive">宽松型 (Permissive)</option>
                    <option value="copyleft">弱Copyleft</option>
                    <option value="agpl">强Copyleft (AGPL)</option>
                    <option value="proprietary">专有</option>
                    <option value="public_domain">公有领域</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    风险等级
                  </label>
                  <select
                    className="input"
                    value={newLicense.riskLevel}
                    onChange={(e) => setNewLicense({ ...newLicense, riskLevel: e.target.value as any })}
                  >
                    <option value="safe">低风险</option>
                    <option value="warning">中风险</option>
                    <option value="critical">高风险</option>
                    <option value="unknown">未知</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  官方URL
                </label>
                <input
                  type="url"
                  className="input"
                  value={newLicense.url}
                  onChange={(e) => setNewLicense({ ...newLicense, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  描述
                </label>
                <textarea
                  className="textarea h-20"
                  value={newLicense.description}
                  onChange={(e) => setNewLicense({ ...newLicense, description: e.target.value })}
                  placeholder="许可证简要说明..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    使用义务
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input text-sm py-1.5"
                      value={editCondition}
                      onChange={(e) => setEditCondition(e.target.value)}
                      placeholder="例如: 署名"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editCondition.trim()) {
                          setNewLicense({
                            ...newLicense,
                            conditions: [...newLicense.conditions, editCondition.trim()],
                          });
                          setEditCondition('');
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newLicense.conditions.map((c, idx) => (
                      <span
                        key={idx}
                        className="badge bg-blue-100 text-blue-600 text-[10px] flex items-center gap-1"
                      >
                        {c}
                        <button
                          onClick={() => {
                            setNewLicense({
                              ...newLicense,
                              conditions: newLicense.conditions.filter((_, i) => i !== idx),
                            });
                          }}
                          className="hover:text-blue-800"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    禁止条款
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input text-sm py-1.5"
                      value={editForbidden}
                      onChange={(e) => setEditForbidden(e.target.value)}
                      placeholder="例如: 商业使用"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editForbidden.trim()) {
                          setNewLicense({
                            ...newLicense,
                            forbidden: [...newLicense.forbidden, editForbidden.trim()],
                          });
                          setEditForbidden('');
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newLicense.forbidden.map((f, idx) => (
                      <span
                        key={idx}
                        className="badge bg-red-100 text-red-600 text-[10px] flex items-center gap-1"
                      >
                        {f}
                        <button
                          onClick={() => {
                            setNewLicense({
                              ...newLicense,
                              forbidden: newLicense.forbidden.filter((_, i) => i !== idx),
                            });
                          }}
                          className="hover:text-red-800"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowNewLicense(false);
                    setEditCondition('');
                    setEditForbidden('');
                  }}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAddLicense}
                  disabled={!newLicense.spdxId.trim() || !newLicense.name.trim()}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
