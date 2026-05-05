import React, { useState, useEffect, useCallback } from 'react';
import { Project, FileEntry, SensitiveHit, CATEGORY_LABELS } from './types';
import ProjectList from './components/ProjectList';
import FileList from './components/FileList';
import HitList from './components/HitList';
import DropZone from './components/DropZone';
import CreateProjectModal from './components/CreateProjectModal';
import Toast from './components/Toast';
import { formatFileSize } from './utils/format';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [hits, setHits] = useState<SensitiveHit[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingFolder, setPendingFolder] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = await window.electronAPI.getProjects();
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleDrop = async (folderPath: string) => {
    setPendingFolder(folderPath);
    setShowCreateModal(true);
  };

  const handleCreateProject = async (projectName: string) => {
    if (!pendingFolder) return;
    
    setIsLoading(true);
    try {
      const project = await window.electronAPI.createProject(pendingFolder, projectName);
      
      showToast('正在扫描文件夹...', 'info');
      const scannedFiles = await window.electronAPI.scanFolder(project.id, pendingFolder);
      
      setProjects(prev => [project, ...prev]);
      setSelectedProject(project);
      setFiles(scannedFiles);
      
      showToast(`项目创建成功，发现 ${scannedFiles.length} 个文件`, 'success');
    } catch (error) {
      showToast(`创建项目失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      setIsLoading(false);
      setShowCreateModal(false);
      setPendingFolder(null);
    }
  };

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    setSelectedFile(null);
    setHits([]);
    
    try {
      const projectFiles = await window.electronAPI.getFiles(project.id);
      setFiles(projectFiles);
    } catch (error) {
      showToast('加载文件列表失败', 'error');
    }
  };

  const handleSelectFile = async (file: FileEntry) => {
    setSelectedFile(file);
    
    try {
      const fileHits = await window.electronAPI.getSensitiveHits(file.id);
      setHits(fileHits);
    } catch (error) {
      showToast('加载敏感信息失败', 'error');
    }
  };

  const handleAnalyzeFile = async (fileId: string) => {
    setIsLoading(true);
    try {
      const newHits = await window.electronAPI.analyzeFile(fileId);
      setHits(newHits);
      
      const updatedFiles = await window.electronAPI.getFiles(selectedProject!.id);
      setFiles(updatedFiles);
      
      const updatedFile = updatedFiles.find(f => f.id === fileId);
      if (updatedFile) {
        setSelectedFile(updatedFile);
      }
      
      showToast(`检测完成，发现 ${newHits.length} 个敏感信息项`, 'success');
    } catch (error) {
      showToast(`分析失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHitStatus = async (hitId: string, status: 'confirmed' | 'ignored') => {
    try {
      await window.electronAPI.updateHitStatus(hitId, status);
      
      setHits(prev => prev.map(hit => 
        hit.id === hitId ? { ...hit, status } : hit
      ));
      
      if (selectedFile) {
        const updatedHits = hits.map(hit => 
          hit.id === hitId ? { ...hit, status } : hit
        );
        const confirmedCount = updatedHits.filter(h => h.status === 'confirmed').length;
        const ignoredCount = updatedHits.filter(h => h.status === 'ignored').length;
        
        setSelectedFile(prev => prev ? {
          ...prev,
          confirmedCount,
          ignoredCount,
        } : null);
      }
      
      showToast(status === 'confirmed' ? '已确认脱敏' : '已忽略此项', 'success');
    } catch (error) {
      showToast('操作失败', 'error');
    }
  };

  const handleProcessFile = async (fileId: string) => {
    setProcessingFiles(prev => new Set(prev).add(fileId));
    
    try {
      const result = await window.electronAPI.processFile(fileId);
      
      if (result.success) {
        const updatedFiles = await window.electronAPI.getFiles(selectedProject!.id);
        setFiles(updatedFiles);
        
        const updatedFile = updatedFiles.find(f => f.id === fileId);
        if (updatedFile) {
          setSelectedFile(updatedFile);
        }
        
        showToast(`处理完成，已替换 ${result.hitsProcessed} 个敏感项`, 'success');
      } else {
        showToast(`处理失败: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast('处理失败', 'error');
    } finally {
      setProcessingFiles(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    
    setIsLoading(true);
    try {
      const outputPath = await window.electronAPI.selectExportFolder();
      if (!outputPath) {
        setIsLoading(false);
        return;
      }
      
      const result = await window.electronAPI.exportProject(selectedProject.id, outputPath);
      
      const updatedProjects = await loadProjects();
      
      showToast(`导出成功！已保存到: ${result.outputPath}`, 'success');
    } catch (error) {
      showToast(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sampleProject = await window.electronAPI.loadSampleData();
      
      await loadProjects();
      
      showToast('示例项目已创建，快去体验吧！', 'success');
    } catch (error) {
      showToast(`创建示例失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await window.electronAPI.deleteProject(projectId);
      
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setSelectedFile(null);
        setFiles([]);
        setHits([]);
      }
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      showToast('项目已删除', 'success');
    } catch (error) {
      showToast('删除失败', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      pending: { label: '待处理', class: 'status-pending' },
      scanning: { label: '扫描中', class: 'status-scanning' },
      analyzing: { label: '分析中', class: 'status-analyzing' },
      completed: { label: '已完成', class: 'status-completed' },
    };
    return statusMap[status] || { label: status, class: 'status-pending' };
  };

  const getFileIcon = (fileType: string) => {
    const icons: Record<string, string> = {
      text: '📄',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      pdf: '📕',
      other: '📎',
    };
    return icons[fileType] || '📎';
  };

  const getCategoryClass = (category: string) => {
    const classes: Record<string, string> = {
      contact: 'cat-contact',
      identity: 'cat-identity',
      organization: 'cat-organization',
      finance: 'cat-finance',
      location: 'cat-location',
      other: 'cat-other',
    };
    return classes[category] || 'cat-other';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          🔒 DataMask Desktop
          <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8 }}>
            会议素材脱敏工具
          </span>
        </h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleLoadSample} disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : '📦'} 加载示例
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} disabled={isLoading}>
            ➕ 新建项目
          </button>
        </div>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>项目列表</h2>
            {projects.length > 0 && (
              <span className="panel-count">{projects.length} 个项目</span>
            )}
          </div>
          <div className="project-list">
            {projects.map(project => {
              const statusInfo = getStatusBadge(project.status);
              return (
                <div
                  key={project.id}
                  className={`project-item ${selectedProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="project-name">{project.name}</div>
                  <div className="project-path">{project.folderPath}</div>
                  <div className="project-meta">
                    <span className={`project-status ${statusInfo.class}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <div className="empty-title">暂无项目</div>
                <div className="empty-desc">拖入文件夹开始创建项目</div>
              </div>
            )}
          </div>
        </aside>

        <main className="main-content">
          {!selectedProject ? (
            <DropZone onDrop={handleDrop} onLoadSample={handleLoadSample} isLoading={isLoading} />
          ) : (
            <div className="project-detail">
              <div className="project-toolbar">
                <div className="toolbar-left">
                  <span className="project-title">{selectedProject.name}</span>
                  <span className={`project-status ${getStatusBadge(selectedProject.status).class}`}>
                    {getStatusBadge(selectedProject.status).label}
                  </span>
                </div>
                <div className="toolbar-right">
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setSelectedProject(null)}
                  >
                    ← 返回
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={handleExport}
                    disabled={isLoading || files.length === 0}
                  >
                    📦 导出交付包
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => handleDeleteProject(selectedProject.id)}
                    disabled={isLoading}
                  >
                    🗑️ 删除项目
                  </button>
                </div>
              </div>

              <div className="project-body">
                <div className="file-panel">
                  <div className="panel-header">
                    <span className="panel-title">文件列表</span>
                    <span className="panel-count">{files.length} 个文件</span>
                  </div>
                  <div className="file-list">
                    {files.map(file => (
                      <div
                        key={file.id}
                        className={`file-item ${selectedFile?.id === file.id ? 'active' : ''}`}
                        onClick={() => handleSelectFile(file)}
                      >
                        <div className="file-header">
                          <span className="file-icon">{getFileIcon(file.fileType)}</span>
                          <span className="file-name">{file.fileName}</span>
                          <span className={`file-status-badge status-${file.status}`}>
                            {file.status}
                          </span>
                        </div>
                        <div className="file-info">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>{file.mimeType || file.fileType}</span>
                        </div>
                        {file.sensitiveCount > 0 && (
                          <div className="file-sensitive">
                            <span className="sensitive-tag tag-pending">
                              检测到 {file.sensitiveCount} 项
                            </span>
                            {file.confirmedCount > 0 && (
                              <span className="sensitive-tag tag-confirmed">
                                确认 {file.confirmedCount} 项
                              </span>
                            )}
                            {file.ignoredCount > 0 && (
                              <span className="sensitive-tag tag-ignored">
                                忽略 {file.ignoredCount} 项
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {files.length === 0 && (
                      <div className="empty-state">
                        <div className="empty-icon">📄</div>
                        <div className="empty-title">暂无文件</div>
                        <div className="empty-desc">此项目尚未扫描任何文件</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="hit-panel">
                  {!selectedFile ? (
                    <div className="hit-empty">
                      <div className="empty-icon">🔍</div>
                      <div className="empty-title">选择文件</div>
                      <div className="empty-desc">点击左侧文件开始敏感信息检测</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div className="panel-header" style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="file-icon">{getFileIcon(selectedFile.fileType)}</span>
                          <span className="panel-title">{selectedFile.fileName}</span>
                          {selectedFile.sensitiveCount > 0 && (
                            <span className="sensitive-tag tag-pending">
                              {selectedFile.sensitiveCount} 个敏感项
                            </span>
                          )}
                        </div>
                        <div className="toolbar-right">
                          {selectedFile.status !== 'analyzed' && selectedFile.status !== 'processed' && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleAnalyzeFile(selectedFile.id)}
                              disabled={isLoading}
                            >
                              🔍 检测敏感信息
                            </button>
                          )}
                          {selectedFile.status === 'analyzed' && selectedFile.confirmedCount > 0 && (
                            <button
                              className="btn btn-success"
                              onClick={() => handleProcessFile(selectedFile.id)}
                              disabled={isLoading || processingFiles.has(selectedFile.id)}
                            >
                              {processingFiles.has(selectedFile.id) ? (
                                <><span className="spinner" style={{ marginRight: '6px' }} /> 处理中</>
                              ) : (
                                '✏️ 应用脱敏'
                              )}
                            </button>
                          )}
                          {selectedFile.status === 'processed' && (
                            <span className="file-status-badge status-completed" style={{ fontSize: '12px' }}>
                              ✅ 已脱敏
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hit-list">
                        {hits.length > 0 ? (
                          hits.map(hit => (
                            <div key={hit.id} className="hit-item">
                              <div className="hit-header">
                                <div className="hit-rule">
                                  <span className={`hit-category ${getCategoryClass(hit.category)}`}>
                                    {CATEGORY_LABELS[hit.category as keyof typeof CATEGORY_LABELS] || hit.category}
                                  </span>
                                  <span className="hit-name">{hit.ruleName}</span>
                                </div>
                                <div className="hit-actions">
                                  {hit.status === 'pending' && (
                                    <>
                                      <button
                                        className="btn btn-success"
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                        onClick={() => handleUpdateHitStatus(hit.id, 'confirmed')}
                                      >
                                        ✓ 确认脱敏
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                        onClick={() => handleUpdateHitStatus(hit.id, 'ignored')}
                                      >
                                        ✕ 忽略
                                      </button>
                                    </>
                                  )}
                                  {hit.status === 'confirmed' && (
                                    <span className="sensitive-tag tag-confirmed">已确认脱敏</span>
                                  )}
                                  {hit.status === 'ignored' && (
                                    <span className="sensitive-tag tag-ignored">已忽略</span>
                                  )}
                                  {hit.status === 'processed' && (
                                    <span className="file-status-badge status-completed" style={{ fontSize: '10px' }}>
                                      已处理
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="hit-content">
                                <div className="hit-matched">
                                  <span className="hit-label">检测到:</span>
                                  <span className="hit-text">{hit.matchedText}</span>
                                </div>
                                <div className="hit-replacement">
                                  <span className="hit-label">替换为:</span>
                                  <span className="hit-text" style={{ background: '#f6ffed', color: '#52c41a' }}>
                                    {hit.replacementText || '[敏感信息]'}
                                  </span>
                                </div>
                                {(hit.contextBefore || hit.contextAfter) && (
                                  <div className="hit-context">
                                    <div className="hit-context-text">
                                      {hit.contextBefore && <span>...{hit.contextBefore}</span>}
                                      <span className="hit-context-highlight">{hit.matchedText}</span>
                                      {hit.contextAfter && <span>{hit.contextAfter}...</span>}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="hit-footer">
                                {hit.lineNumber && (
                                  <span className="hit-line">行 {hit.lineNumber}</span>
                                )}
                                <div className="hit-confidence">
                                  <span>置信度:</span>
                                  <div className="confidence-bar">
                                    <div 
                                      className={`confidence-fill ${
                                        hit.confidence >= 0.9 ? 'confidence-high' :
                                        hit.confidence >= 0.5 ? 'confidence-medium' : 'confidence-low'
                                      }`}
                                      style={{ width: `${hit.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span>{(hit.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty-state">
                            <div className="empty-icon">✨</div>
                            <div className="empty-title">未检测到敏感信息</div>
                            <div className="empty-desc">
                              {selectedFile.status === 'analyzed' || selectedFile.status === 'processed'
                                ? '此文件未发现敏感信息，可以安全交付'
                                : '点击上方"检测敏感信息"按钮开始扫描'
                              }
                            </div>
                          </div>
                        )}
                      </div>

                      {hits.length > 0 && (
                        <div className="processing-panel">
                          <div className="bulk-actions">
                            <button
                              className="btn btn-success"
                              onClick={() => {
                                const pendingHits = hits.filter(h => h.status === 'pending');
                                pendingHits.forEach(h => handleUpdateHitStatus(h.id, 'confirmed'));
                              }}
                              disabled={hits.filter(h => h.status === 'pending').length === 0}
                            >
                              ✓ 全部确认脱敏
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                const pendingHits = hits.filter(h => h.status === 'pending');
                                pendingHits.forEach(h => handleUpdateHitStatus(h.id, 'ignored'));
                              }}
                              disabled={hits.filter(h => h.status === 'pending').length === 0}
                            >
                              ✕ 全部忽略
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          folderPath={pendingFolder}
          onCancel={() => {
            setShowCreateModal(false);
            setPendingFolder(null);
          }}
          onConfirm={handleCreateProject}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default App;
