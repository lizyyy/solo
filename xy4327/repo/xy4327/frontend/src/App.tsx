import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  Project,
  ProjectDetail,
  Subtitle,
  DetectionResult,
  Term,
  Speaker,
  ProofreadRecord,
  TabType,
  IssueGroup
} from './types';
import {
  projectApi,
  importApi,
  subtitleApi,
  detectionApi,
  exportApi,
  recordApi
} from './services/api';

const TYPE_NAMES: Record<string, string> = {
  time_overlap: '时间轴重叠',
  sensitive_name: '敏感姓名',
  sensitive_speaker: '敏感说话人',
  term_inconsistency: '术语不一致',
  empty_subtitle: '空字幕',
  incomplete_sentence: '语句不完整',
  short_subtitle: '字幕过短',
  fast_reading: '阅读速度过快',
  other: '其他问题'
};

const LoadingSpinner: React.FC<{ size?: string }> = ({ size = 'w-5 h-5' }) => (
  <div className={`loading-spinner ${size}`}></div>
);

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-accent-500' : type === 'error' ? 'bg-danger-500' : 'bg-primary-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in`}>
      {message}
    </div>
  );
};

const ProjectsPage: React.FC<{ onSelectProject: (project: Project) => void }> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectApi.getAll();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setToast({ message: '加载项目列表失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setToast({ message: '请输入项目名称', type: 'error' });
      return;
    }

    try {
      const newProject = await projectApi.create(newProjectName.trim(), newProjectDesc.trim());
      setProjects(prev => [newProject, ...prev]);
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setToast({ message: '项目创建成功', type: 'success' });
    } catch (error) {
      console.error('Failed to create project:', error);
      setToast({ message: '创建项目失败', type: 'error' });
    }
  };

  const handleDeleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除此项目吗？此操作不可撤销。')) {
      return;
    }

    try {
      await projectApi.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setToast({ message: '项目已删除', type: 'success' });
    } catch (error) {
      console.error('Failed to delete project:', error);
      setToast({ message: '删除项目失败', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">无障碍字幕校对台</h1>
                <p className="text-sm text-gray-500">快速校对短视频字幕，提升无障碍体验</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>新建项目</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="w-12 h-12" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无项目</h3>
            <p className="text-gray-500 mb-6">点击上方按钮创建您的第一个字幕校对项目</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              立即开始
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="card cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-danger-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center text-xs text-gray-400">
                  <span>创建于 {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full fade-in">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">新建项目</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">项目名称 *</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="input-field"
                    placeholder="例如：无障碍视频字幕校对"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">项目描述</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="text-area h-24"
                    placeholder="可选：添加项目描述..."
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                className="btn-primary"
              >
                创建项目
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectDetailPage: React.FC<{
  project: Project;
  onBack: () => void;
}> = ({ project, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
  const [records, setRecords] = useState<ProofreadRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [editingText, setEditingText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'srt' | 'terms' | 'speakers'>('srt');

  const [unsavedChanges, setUnsavedChanges] = useLocalStorage<Record<number, { current_text: string }>>(
    `subtitle-proofreader-unsaved-${project.id}`,
    {}
  );

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectApi.getById(project.id);
      setSubtitles(data.subtitles);
      setTerms(data.terms);
      setSpeakers(data.speakers);

      if (data.subtitles.length > 0) {
        const firstSub = data.subtitles[0];
        setEditingText(unsavedChanges[firstSub.id]?.current_text || firstSub.current_text || firstSub.original_text || '');
      }

      const results = await detectionApi.getResults(project.id);
      setDetectionResults(results);

      const recs = await recordApi.getByProject(project.id);
      setRecords(recs);
    } catch (error) {
      console.error('Failed to load project data:', error);
      setToast({ message: '加载项目数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [project.id, unsavedChanges]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  useEffect(() => {
    if (subtitles[selectedSubtitleIndex]) {
      const sub = subtitles[selectedSubtitleIndex];
      setEditingText(unsavedChanges[sub.id]?.current_text || sub.current_text || sub.original_text || '');
    }
  }, [selectedSubtitleIndex, subtitles, unsavedChanges]);

  const handleFileImport = async (file: File) => {
    try {
      let result;
      switch (importType) {
        case 'srt':
          result = await importApi.importSRT(project.id, file);
          break;
        case 'terms':
          result = await importApi.importTerms(project.id, file);
          break;
        case 'speakers':
          result = await importApi.importSpeakers(project.id, file);
          break;
      }

      setToast({ message: `成功导入 ${result.count} 条数据`, type: 'success' });
      setShowImportModal(false);
      loadProjectData();
    } catch (error) {
      console.error('Import failed:', error);
      setToast({ message: '导入失败', type: 'error' });
    }
  };

  const handleTextChange = (text: string) => {
    setEditingText(text);
    const currentSub = subtitles[selectedSubtitleIndex];
    if (currentSub) {
      setUnsavedChanges(prev => ({
        ...prev,
        [currentSub.id]: { current_text: text }
      }));
    }
  };

  const handleSaveSubtitle = async () => {
    const currentSub = subtitles[selectedSubtitleIndex];
    if (!currentSub) return;

    try {
      await subtitleApi.update(currentSub.id, {
        current_text: editingText
      });

      setSubtitles(prev => prev.map((sub, idx) => 
        idx === selectedSubtitleIndex 
          ? { ...sub, current_text: editingText } 
          : sub
      ));

      setUnsavedChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[currentSub.id];
        return newChanges;
      });

      setToast({ message: '保存成功', type: 'success' });
    } catch (error) {
      console.error('Save failed:', error);
      setToast({ message: '保存失败', type: 'error' });
    }
  };

  const handleToggleReviewed = async () => {
    const currentSub = subtitles[selectedSubtitleIndex];
    if (!currentSub) return;

    const newValue = !(currentSub.is_reviewed === 1 || currentSub.is_reviewed === true);

    try {
      await subtitleApi.update(currentSub.id, {
        is_reviewed: newValue
      });

      setSubtitles(prev => prev.map((sub, idx) => 
        idx === selectedSubtitleIndex 
          ? { ...sub, is_reviewed: newValue ? 1 : 0 } 
          : sub
      ));

      setToast({ message: newValue ? '已标记为已复核' : '已取消复核标记', type: 'success' });
    } catch (error) {
      console.error('Toggle review failed:', error);
      setToast({ message: '操作失败', type: 'error' });
    }
  };

  const handleRunDetection = async () => {
    try {
      const result = await detectionApi.detect(project.id);
      setDetectionResults(result.results);
      setToast({ message: `检测完成，发现 ${result.count} 个问题`, type: 'info' });
      setActiveTab('issues');
    } catch (error) {
      console.error('Detection failed:', error);
      setToast({ message: '检测失败', type: 'error' });
    }
  };

  const handleResolveIssue = async (resultId: number) => {
    try {
      await detectionApi.resolve(resultId);
      setDetectionResults(prev => prev.map(r => 
        r.id === resultId ? { ...r, is_resolved: 1 } : r
      ));
      setToast({ message: '问题已标记为已解决', type: 'success' });
    } catch (error) {
      console.error('Resolve failed:', error);
      setToast({ message: '操作失败', type: 'error' });
    }
  };

  const handleExport = (type: 'srt' | 'markdown' | 'json') => {
    let url;
    switch (type) {
      case 'srt':
        url = exportApi.exportSRT(project.id);
        break;
      case 'markdown':
        url = exportApi.exportMarkdown(project.id);
        break;
      case 'json':
        url = exportApi.exportJSON(project.id);
        break;
    }
    window.open(url, '_blank');
  };

  const handleNextSubtitle = () => {
    if (selectedSubtitleIndex < subtitles.length - 1) {
      setSelectedSubtitleIndex(prev => prev + 1);
    }
  };

  const handlePrevSubtitle = () => {
    if (selectedSubtitleIndex > 0) {
      setSelectedSubtitleIndex(prev => prev - 1);
    }
  };

  const groupDetectionResults = (): IssueGroup[] => {
    const groups: Record<string, DetectionResult[]> = {};
    
    detectionResults.forEach(result => {
      const type = result.issue_type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(result);
    });

    return Object.entries(groups).map(([type, results]) => ({
      type,
      typeName: TYPE_NAMES[type] || type,
      results: results.sort((a, b) => {
        const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
        return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
      })
    }));
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <span className="badge-error">错误</span>;
      case 'warning':
        return <span className="badge-warning">警告</span>;
      default:
        return <span className="badge-info">信息</span>;
    }
  };

  const reviewedCount = subtitles.filter(s => s.is_reviewed === 1 || s.is_reviewed === true).length;
  const progressPercent = subtitles.length > 0 ? Math.round((reviewedCount / subtitles.length) * 100) : 0;

  const errorCount = detectionResults.filter(r => r.severity === 'error' && !r.is_resolved).length;
  const warningCount = detectionResults.filter(r => r.severity === 'warning' && !r.is_resolved).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="w-12 h-12" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{subtitles.length} 条字幕</span>
                  <span>已复核 {reviewedCount}/{subtitles.length} ({progressPercent}%)</span>
                  {errorCount > 0 && <span className="text-danger-600">{errorCount} 个错误</span>}
                  {warningCount > 0 && <span className="text-warning-600">{warningCount} 个警告</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>导入</span>
              </button>
              <button
                onClick={handleRunDetection}
                className="btn-primary flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>规则检测</span>
              </button>
              <div className="relative group">
                <button className="btn-success flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>导出</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <button
                    onClick={() => handleExport('srt')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg"
                  >
                    导出 SRT 字幕
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    导出 Markdown 报告
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 last:rounded-b-lg"
                  >
                    导出 JSON 审计包
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex space-x-1">
              {[
                { key: 'editor' as TabType, label: '字幕编辑' },
                { key: 'issues' as TabType, label: `问题检测 (${detectionResults.filter(r => !r.is_resolved).length})` },
                { key: 'terms' as TabType, label: `术语表 (${terms.length})` },
                { key: 'speakers' as TabType, label: `说话人 (${speakers.length})` },
                { key: 'records' as TabType, label: `校对记录 (${records.length})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white text-primary-600 border-t border-l border-r'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'editor' && subtitles.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无字幕</h3>
              <p className="text-gray-500 mb-6">点击上方"导入"按钮添加 SRT 字幕文件</p>
              <button
                onClick={() => { setImportType('srt'); setShowImportModal(true); }}
                className="btn-primary"
              >
                导入 SRT
              </button>
            </div>
          </div>
        )}

        {activeTab === 'editor' && subtitles.length > 0 && (
          <div className="flex h-full">
            <div className="w-80 bg-white border-r overflow-y-auto flex-shrink-0">
              <div className="p-3 border-b">
                <div className="relative">
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索字幕..."
                    className="input-field pl-10 text-sm"
                  />
                </div>
              </div>
              <div className="divide-y">
                {subtitles.map((sub, index) => {
                  const subIssues = detectionResults.filter(r => r.subtitle_id === sub.id && !r.is_resolved);
                  const hasIssues = subIssues.length > 0;
                  const hasError = subIssues.some(r => r.severity === 'error');
                  const isActive = index === selectedSubtitleIndex;
                  const isReviewed = sub.is_reviewed === 1 || sub.is_reviewed === true;
                  const hasUnsaved = !!unsavedChanges[sub.id];

                  let className = 'p-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ';
                  if (isActive) {
                    className += 'border-primary-500 bg-primary-50';
                  } else if (isReviewed) {
                    className += 'border-accent-500 bg-accent-50';
                  } else if (hasError) {
                    className += 'border-danger-500 bg-danger-50';
                  } else if (hasIssues) {
                    className += 'border-warning-500 bg-warning-50';
                  } else {
                    className += 'border-transparent';
                  }

                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubtitleIndex(index)}
                      className={className}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-500">#{sub.sequence}</span>
                          {hasUnsaved && <span className="text-xs text-warning-600">● 未保存</span>}
                          {isReviewed && <span className="text-xs text-accent-600">✓ 已复核</span>}
                        </div>
                        {hasIssues && (
                          <div className="flex items-center space-x-1">
                            {hasError && <span className="badge-error">错误</span>}
                            {!hasError && subIssues.some(r => r.severity === 'warning') && <span className="badge-warning">警告</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mb-1">
                        {sub.start_time} → {sub.end_time}
                        {sub.speaker && <span className="ml-2">【{sub.speaker}】</span>}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {unsavedChanges[sub.id]?.current_text || sub.current_text || sub.original_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {subtitles[selectedSubtitleIndex] && (
                <>
                  <div className="bg-white border-b p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl font-bold text-gray-900">#{subtitles[selectedSubtitleIndex].sequence}</span>
                        <span className="text-sm text-gray-500">
                          {subtitles[selectedSubtitleIndex].start_time} → {subtitles[selectedSubtitleIndex].end_time}
                        </span>
                        {subtitles[selectedSubtitleIndex].speaker && (
                          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                            {subtitles[selectedSubtitleIndex].speaker}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handlePrevSubtitle}
                          disabled={selectedSubtitleIndex === 0}
                          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={handleNextSubtitle}
                          disabled={selectedSubtitleIndex === subtitles.length - 1}
                          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                          isPlaying ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                            <span>暂停</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span>播放</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleToggleReviewed}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                          subtitles[selectedSubtitleIndex].is_reviewed === 1 || subtitles[selectedSubtitleIndex].is_reviewed === true
                            ? 'bg-accent-100 text-accent-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                          {subtitles[selectedSubtitleIndex].is_reviewed === 1 || subtitles[selectedSubtitleIndex].is_reviewed === true
                            ? '已复核'
                            : '标记已复核'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">原始文本</label>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border text-gray-600">
                          {subtitles[selectedSubtitleIndex].original_text || '(空)'}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            当前文本
                            {unsavedChanges[subtitles[selectedSubtitleIndex].id] && (
                              <span className="ml-2 text-warning-600 text-xs">(未保存)</span>
                            )}
                          </label>
                        </div>
                        <textarea
                          value={editingText}
                          onChange={(e) => handleTextChange(e.target.value)}
                          className="text-area h-32 text-lg"
                          placeholder="输入字幕内容..."
                          autoFocus
                        />
                      </div>

                      {detectionResults.filter(r => 
                        r.subtitle_id === subtitles[selectedSubtitleIndex].id && !r.is_resolved
                      ).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">检测到的问题</h4>
                          <div className="space-y-2">
                            {detectionResults
                              .filter(r => r.subtitle_id === subtitles[selectedSubtitleIndex].id && !r.is_resolved)
                              .map(result => (
                                <div
                                  key={result.id}
                                  className={`p-3 rounded-lg border ${
                                    result.severity === 'error'
                                      ? 'bg-danger-50 border-danger-200'
                                      : 'bg-warning-50 border-warning-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      {getSeverityBadge(result.severity)}
                                      <span className="text-sm font-medium">{result.message}</span>
                                    </div>
                                    <button
                                      onClick={() => handleResolveIssue(result.id)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      标记已解决
                                    </button>
                                  </div>
                                  {result.details && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {(() => {
                                        try {
                                          const details = JSON.parse(result.details as string);
                                          return details.suggestion || '';
                                        } catch {
                                          return '';
                                        }
                                      })()}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border-t p-4">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            const sub = subtitles[selectedSubtitleIndex];
                            setEditingText(sub.original_text || '');
                            setUnsavedChanges(prev => ({
                              ...prev,
                              [sub.id]: { current_text: sub.original_text || '' }
                            }));
                          }}
                          className="btn-secondary"
                        >
                          恢复原始
                        </button>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            handleSaveSubtitle();
                            handleNextSubtitle();
                          }}
                          className="btn-secondary"
                        >
                          保存并下一条
                        </button>
                        <button
                          onClick={handleSaveSubtitle}
                          className="btn-primary"
                        >
                          保存修改
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {detectionResults.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无检测结果</h3>
                  <p className="text-gray-500 mb-6">点击"规则检测"按钮开始检测字幕问题</p>
                  <button onClick={handleRunDetection} className="btn-primary">
                    开始检测
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupDetectionResults().map(group => (
                    <div key={group.type} className="card">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {group.typeName}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({group.results.filter(r => !r.is_resolved).length} 个未解决)
                        </span>
                      </h3>
                      <div className="space-y-3">
                        {group.results.map(result => (
                          <div
                            key={result.id}
                            className={`p-4 rounded-lg border ${
                              result.is_resolved
                                ? 'bg-gray-50 border-gray-200 opacity-60'
                                : result.severity === 'error'
                                ? 'bg-danger-50 border-danger-200'
                                : result.severity === 'warning'
                                ? 'bg-warning-50 border-warning-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  {getSeverityBadge(result.severity)}
                                  <span className="font-medium">{result.message}</span>
                                  {result.is_resolved && <span className="text-xs text-gray-500">(已解决)</span>}
                                </div>
                                {result.sequence !== undefined && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    第 {result.sequence} 段: {result.current_text}
                                  </p>
                                )}
                                {result.details && (
                                  <p className="text-xs text-gray-500">
                                    {(() => {
                                      try {
                                        const details = JSON.parse(result.details as string);
                                        return details.suggestion || JSON.stringify(details);
                                      } catch {
                                        return result.details;
                                      }
                                    })()}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                {result.sequence !== undefined && (
                                  <button
                                    onClick={() => {
                                      const idx = subtitles.findIndex(s => s.sequence === result.sequence);
                                      if (idx >= 0) {
                                        setSelectedSubtitleIndex(idx);
                                        setActiveTab('editor');
                                      }
                                    }}
                                    className="text-primary-600 hover:text-primary-700 text-sm"
                                  >
                                    查看
                                  </button>
                                )}
                                {!result.is_resolved && (
                                  <button
                                    onClick={() => handleResolveIssue(result.id)}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                  >
                                    标记已解决
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {terms.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无术语</h3>
                  <p className="text-gray-500 mb-6">点击"导入"按钮添加术语表文件</p>
                  <button
                    onClick={() => { setImportType('terms'); setShowImportModal(true); }}
                    className="btn-primary"
                  >
                    导入术语表
                  </button>
                </div>
              ) : (
                <div className="card">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">术语</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">替换词</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">分类</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">标记</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {terms.map(term => (
                          <tr key={term.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{term.term}</td>
                            <td className="py-3 px-4 text-gray-600">{term.replacement || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                {term.category || '通用'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {term.is_sensitive === 1 || term.is_sensitive === true ? (
                                <span className="badge-error">敏感</span>
                              ) : (
                                <span className="badge-info">普通</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'speakers' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {speakers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无说话人</h3>
                  <p className="text-gray-500 mb-6">点击"导入"按钮添加说话人名单</p>
                  <button
                    onClick={() => { setImportType('speakers'); setShowImportModal(true); }}
                    className="btn-primary"
                  >
                    导入说话人
                  </button>
                </div>
              ) : (
                <div className="card">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">姓名</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">别名</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">标记</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {speakers.map(speaker => (
                          <tr key={speaker.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{speaker.name}</td>
                            <td className="py-3 px-4 text-gray-600">{speaker.alias || '-'}</td>
                            <td className="py-3 px-4">
                              {speaker.is_sensitive === 1 || speaker.is_sensitive === true ? (
                                <span className="badge-error">敏感人物</span>
                              ) : (
                                <span className="badge-info">普通</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {records.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无校对记录</h3>
                  <p className="text-gray-500">开始校对字幕后，这里将显示您的操作记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map(record => (
                    <div key={record.id} className="card">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                              {record.action === 'text_update' ? '文本修改' : record.action === 'review_toggle' ? '复核状态' : record.action}
                            </span>
                            {record.sequence !== undefined && (
                              <span className="text-sm text-gray-600">第 {record.sequence} 段</span>
                            )}
                          </div>
                          {record.action === 'text_update' && (
                            <div className="space-y-1">
                              {record.old_value && (
                                <div className="flex items-start space-x-2">
                                  <span className="text-xs text-gray-500 w-12 flex-shrink-0">修改前:</span>
                                  <span className="text-sm text-danger-600 line-through">{record.old_value}</span>
                                </div>
                              )}
                              {record.new_value && (
                                <div className="flex items-start space-x-2">
                                  <span className="text-xs text-gray-500 w-12 flex-shrink-0">修改后:</span>
                                  <span className="text-sm text-accent-600">{record.new_value}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {record.action === 'review_toggle' && (
                            <p className="text-sm text-gray-600">
                              复核状态: {record.old_value} → {record.new_value}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full fade-in">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">导入数据</h2>
              
              <div className="flex space-x-2 mb-6">
                {[
                  { key: 'srt' as const, label: 'SRT 字幕' },
                  { key: 'terms' as const, label: '术语表' },
                  { key: 'speakers' as const, label: '说话人' }
                ].map(type => (
                  <button
                    key={type.key}
                    onClick={() => setImportType(type.key)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      importType === type.key
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept={importType === 'srt' ? '.srt' : '.txt,.csv,.json'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileImport(file);
                  }}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-1">
                    点击选择文件或拖拽文件到此处
                  </p>
                  <p className="text-xs text-gray-400">
                    {importType === 'srt' 
                      ? '支持 .srt 格式' 
                      : importType === 'terms' 
                      ? '支持 .txt, .csv, .json 格式' 
                      : '支持 .txt, .csv, .json 格式'}
                  </p>
                </label>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
                <p className="font-medium text-gray-700 mb-1">文件格式说明:</p>
                {importType === 'srt' && (
                  <p>标准 SRT 字幕格式</p>
                )}
                {importType === 'terms' && (
                  <p>每行一个术语，格式：术语,替换词,分类,是否敏感<br />
                  例如：无障碍,Accessibility,专业术语,false</p>
                )}
                {importType === 'speakers' && (
                  <p>每行一个说话人，格式：姓名,别名,是否敏感<br />
                  例如：张三,张老师,true</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [lastProjectId, setLastProjectId] = useLocalStorage<number | null>(
    'subtitle-proofreader-last-project',
    null
  );

  useEffect(() => {
    if (selectedProject) {
      setLastProjectId(selectedProject.id);
    }
  }, [selectedProject, setLastProjectId]);

  useEffect(() => {
    if (lastProjectId && !selectedProject) {
      const checkProject = async () => {
        try {
          const projects = await projectApi.getAll();
          const project = projects.find(p => p.id === lastProjectId);
          if (project) {
            setSelectedProject(project);
          }
        } catch (error) {
          console.error('Failed to check last project:', error);
        }
      };
      checkProject();
    }
  }, [lastProjectId, selectedProject]);

  if (selectedProject) {
    return (
      <ProjectDetailPage
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  return (
    <ProjectsPage onSelectProject={setSelectedProject} />
  );
};

export default App;