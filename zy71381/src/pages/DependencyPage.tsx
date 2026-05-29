import React, { useEffect, useCallback, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useDependencyStore } from '../store/dependencyStore';
import { ProjectSelector } from '../components/ProjectSelector';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import {
  Upload,
  Play,
  Trash2,
  AlertTriangle,
  FileJson,
  Database,
  ChevronDown,
  ChevronRight,
  Wrench,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import type { Dependency } from '../types';
import { FILE_TYPE_LABELS, DIRTY_TYPE_LABELS } from '../types';

export function DependencyPage() {
  const { currentProject } = useProjectStore();
  const {
    dependencies,
    dependencyFiles,
    loading,
    parsing,
    loadDependencies,
    loadDependencyFiles,
    uploadFiles,
    parseFiles,
    fixDirtyData,
    deleteDependency,
    deleteFile,
  } = useDependencyStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [editingDirtyDep, setEditingDirtyDep] = useState<Dependency | null>(null);
  const [editLicense, setEditLicense] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'dirty'>('all');

  useEffect(() => {
    if (currentProject) {
      loadDependencies(currentProject.id);
      loadDependencyFiles(currentProject.id);
    }
  }, [currentProject, loadDependencies, loadDependencyFiles]);

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!currentProject) return;
      const fileArray = Array.from(files);
      await uploadFiles(currentProject.id, fileArray);
    },
    [currentProject, uploadFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  const handleParseAll = async () => {
    if (!currentProject) return;
    const unparsedFiles = dependencyFiles.filter((f) => f.parseStatus !== 'success');
    if (unparsedFiles.length > 0) {
      await parseFiles(
        currentProject.id,
        unparsedFiles.map((f) => f.id)
      );
    }
  };

  const handleParseSelected = async (fileId: string) => {
    if (!currentProject) return;
    await parseFiles(currentProject.id, [fileId]);
  };

  const toggleExpand = (depId: string) => {
    setExpandedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(depId)) {
        next.delete(depId);
      } else {
        next.add(depId);
      }
      return next;
    });
  };

  const openFixModal = (dep: Dependency) => {
    setEditingDirtyDep(dep);
    setEditLicense(Array.isArray(dep.license) ? dep.license[0] || '' : dep.license || '');
    setEditRepoUrl(dep.repoUrl || '');
    setEditNotes('');
  };

  const handleFixDirty = async () => {
    if (!editingDirtyDep) return;
    await fixDirtyData(
      editingDirtyDep.id,
      {
        license: editLicense || editingDirtyDep.license,
        repoUrl: editRepoUrl || editingDirtyDep.repoUrl,
      },
      editNotes
    );
    setEditingDirtyDep(null);
  };

  const filteredDeps =
    activeTab === 'dirty'
      ? dependencies.filter((d) => d.dirtyData && !d.dirtyData.fixed)
      : dependencies;

  const directDeps = filteredDeps.filter((d) => d.isDirect);
  const transitiveDeps = filteredDeps.filter((d) => !d.isDirect);

  const getCardClass = (dep: Dependency) => {
    if (dep.dirtyData && !dep.dirtyData.fixed) return 'card card-unknown';
    switch (dep.riskLevel) {
      case 'critical':
        return 'card card-danger';
      case 'warning':
        return 'card card-warning';
      case 'safe':
        return 'card card-safe';
      default:
        return 'card card-unknown';
    }
  };

  const renderDependencyRow = (dep: Dependency, isTransitive = false) => {
    const isExpanded = expandedDeps.has(dep.id);
    const transitiveChildren = dependencies.filter(
      (d) => d.parentId === dep.id || dep.transitiveDependencies.includes(d.id)
    );

    return (
      <React.Fragment key={dep.id}>
        <tr className={`hover:bg-slate-50 border-b border-slate-100 ${isTransitive ? 'bg-slate-50' : ''}`}>
          <td className="table-cell">
            <div className="flex items-center gap-2">
              {transitiveChildren.length > 0 && (
                <button
                  onClick={() => toggleExpand(dep.id)}
                  className="p-0.5 hover:bg-slate-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              )}
              {isTransitive && <GitBranch className="w-3 h-3 text-slate-400" />}
              <span className="font-mono text-sm">{dep.packageName}</span>
            </div>
          </td>
          <td className="table-cell font-mono text-sm">{dep.packageVersion}</td>
          <td className="table-cell">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">
                {Array.isArray(dep.license)
                  ? dep.license.join(' / ')
                  : dep.license || '—'}
              </span>
              {Array.isArray(dep.license) && dep.license.length > 1 && (
                <span className="badge badge-warning text-[10px]">双许可证</span>
              )}
            </div>
          </td>
          <td className="table-cell">
            {dep.repoUrl ? (
              <a
                href={dep.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                仓库
              </a>
            ) : (
              <span className="text-slate-400 text-xs">—</span>
            )}
          </td>
          <td className="table-cell">
            <RiskBadge level={dep.riskLevel} size="sm" />
          </td>
          <td className="table-cell">
            <StatusBadge status={dep.status} showIcon={false} />
          </td>
          <td className="table-cell">
            {dep.dirtyData && !dep.dirtyData.fixed && (
              <div className="flex items-center gap-2">
                <span className="badge badge-unknown text-[10px]">
                  {DIRTY_TYPE_LABELS[dep.dirtyData.dirtyType]}
                </span>
                <button
                  onClick={() => openFixModal(dep)}
                  className="p-1 hover:bg-amber-100 rounded text-amber-600"
                  title="修复脏数据"
                >
                  <Wrench className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </td>
          <td className="table-cell text-right">
            <button
              onClick={() => {
                if (confirm('确定删除该依赖？')) {
                  deleteDependency(dep.id);
                }
              }}
              className="p-1 hover:bg-red-100 rounded text-red-500"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
        {isExpanded &&
          transitiveChildren.map((child) => renderDependencyRow(child, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">
            依赖管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            批量上传依赖清单，自动解析并分离正常/脏数据
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
        </div>
      </div>

      {currentProject ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-300 bg-white hover:border-primary-400'
            }`}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              拖拽文件到此处，或
              <label className="text-primary-600 cursor-pointer hover:text-primary-700 ml-1">
                点击选择文件
                <input
                  type="file"
                  multiple
                  accept=".json,.xml,.txt,.mod"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && handleFileUpload(e.target.files)
                  }
                />
              </label>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              支持 package.json、pom.xml、requirements.txt、go.mod
            </p>
          </div>

          {dependencyFiles.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  上传的文件
                </h3>
                <button
                  onClick={handleParseAll}
                  disabled={parsing || dependencyFiles.every((f) => f.parseStatus === 'success')}
                  className="btn-primary flex items-center gap-2"
                >
                  {parsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      解析全部
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-2">
                {dependencyFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileJson className="w-5 h-5 text-primary-600" />
                      <div>
                        <p className="font-medium text-sm">{file.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {FILE_TYPE_LABELS[file.fileType]} ·{' '}
                          {new Date(file.uploadTime).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          file.parseStatus === 'success'
                            ? 'text-risk-safe'
                            : file.parseStatus === 'failed'
                            ? 'text-risk-critical'
                            : 'text-slate-500'
                        }`}
                      >
                        {file.parseStatus === 'success'
                          ? '已解析'
                          : file.parseStatus === 'failed'
                          ? '解析失败'
                          : '待解析'}
                      </span>
                      {file.parseStatus !== 'success' && (
                        <button
                          onClick={() => handleParseSelected(file.id)}
                          disabled={parsing}
                          className="p-1.5 hover:bg-primary-100 rounded text-primary-600"
                          title="解析"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('确定删除该文件？')) {
                            deleteFile(file.id);
                          }
                        }}
                        className="p-1.5 hover:bg-red-100 rounded text-red-500"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.length > 0 && (
            <div className="card">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-slate-700">
                    依赖清单
                  </h3>
                  <div className="flex bg-slate-100 rounded-md p-0.5">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        activeTab === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      全部 ({dependencies.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('dirty')}
                      className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-1 ${
                        activeTab === 'dirty'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      脏数据 ({dependencies.filter((d) => d.dirtyData && !d.dirtyData.fixed).length})
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  直接依赖: {directDeps.length} · 传递依赖: {transitiveDeps.length}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="table-cell text-left table-header">包名</th>
                      <th className="table-cell text-left table-header">版本</th>
                      <th className="table-cell text-left table-header">许可证</th>
                      <th className="table-cell text-left table-header">仓库</th>
                      <th className="table-cell text-left table-header">风险等级</th>
                      <th className="table-cell text-left table-header">状态</th>
                      <th className="table-cell text-left table-header">脏数据</th>
                      <th className="table-cell text-right table-header">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeps.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          {activeTab === 'dirty' ? '暂无脏数据' : '暂无依赖数据'}
                        </td>
                      </tr>
                    ) : (
                      directDeps.map((dep) => renderDependencyRow(dep))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card p-12 text-center">
          <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">
            请先创建或选择项目
          </h3>
          <p className="text-slate-500">
            使用右上角的项目选择器创建新项目
          </p>
        </div>
      )}

      {editingDirtyDep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              修复脏数据
            </h3>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-700">
                <strong>问题类型：</strong>
                {DIRTY_TYPE_LABELS[editingDirtyDep.dirtyData!.dirtyType]}
              </p>
              <p className="text-sm text-amber-600 mt-1">
                {editingDirtyDep.dirtyData!.description}
              </p>
              <p className="text-xs text-amber-500 mt-2">
                依赖：{editingDirtyDep.packageName}@{editingDirtyDep.packageVersion}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  许可证
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  value={editLicense}
                  onChange={(e) => setEditLicense(e.target.value)}
                  placeholder="例如: MIT, Apache-2.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  仓库地址
                </label>
                <input
                  type="url"
                  className="input font-mono"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  修复说明
                </label>
                <textarea
                  className="textarea h-20"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="描述修复内容和数据来源..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setEditingDirtyDep(null)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleFixDirty}
                  disabled={!editNotes.trim()}
                >
                  确认修复
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
