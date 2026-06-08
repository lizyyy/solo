import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Box, BarChart3, Download, AlertCircle, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { Stage3DScene } from '../components/Stage3DScene';
import { RouteChart } from '../components/RouteChart';
import { IssuePanel } from '../components/IssuePanel';
import { SketchUploadModal } from '../components/SketchUploadModal';
import { ReportExport } from '../components/ReportExport';
import { cn } from '../lib/utils';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    currentProjectId,
    projects,
    points,
    routes,
    obstacles,
    sketches,
    issues,
    viewMode,
    selectedIssueId,
    setCurrentProject,
    setViewMode,
    setSelectedIssue,
    resolveIssue,
    runDetection,
    loadSampleData,
  } = useProjectStore();

  const [showSketchModal, setShowSketchModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'report'>('view');

  useEffect(() => {
    if (projects.length === 0) {
      loadSampleData();
    }
  }, [projects.length, loadSampleData]);

  useEffect(() => {
    if (id && id !== currentProjectId && projects.length > 0) {
      setCurrentProject(id);
    }
  }, [id, currentProjectId, setCurrentProject, projects.length]);

  const project = projects.find(p => p.id === id);
  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-industrial-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
          <p className="text-industrial-600 mb-4">项目不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg"
          >
            返回项目列表
          </button>
        </div>
      </div>
    );
  }

  const handleAddSketch = () => {
    if (selectedIssue) {
      setShowSketchModal(true);
    }
  };

  const handlePointClick = (pointId: string) => {
    const relatedIssue = issues.find(i => {
      const route = routes.find(r => r.id === i.routeId);
      return route && (route.fromPoint === pointId || route.toPoint === pointId) && i.status !== 'resolved';
    });
    if (relatedIssue) {
      setSelectedIssue(relatedIssue.id);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-50 flex flex-col">
      <header className="bg-white border-b border-industrial-100 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-industrial-50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-industrial-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-industrial-600">{project.name}</h1>
                <p className="text-sm text-industrial-400">{project.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-industrial-50 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('view')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    activeTab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-industrial-400 hover:text-industrial-600'
                  )}
                >
                  <Box className="w-4 h-4" />
                  3D/图表视图
                </button>
                <button
                  onClick={() => setActiveTab('report')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    activeTab === 'report' ? 'bg-white text-primary-600 shadow-sm' : 'text-industrial-400 hover:text-industrial-600'
                  )}
                >
                  <Download className="w-4 h-4" />
                  报告导出
                </button>
              </div>

              <button
                onClick={runDetection}
                className="flex items-center gap-2 px-4 py-2 bg-industrial-100 text-industrial-600 rounded-lg hover:bg-industrial-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重新检测
              </button>

              <Link
                to={`/project/${id}/report`}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出报告
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'view' ? (
          <>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 p-3 bg-white border-b border-industrial-100">
                <button
                  onClick={() => setViewMode('3d')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    viewMode === '3d' ? 'bg-primary-500 text-white' : 'bg-industrial-50 text-industrial-600 hover:bg-industrial-100'
                  )}
                >
                  <Box className="w-4 h-4" />
                  3D 视图
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    viewMode === 'chart' ? 'bg-primary-500 text-white' : 'bg-industrial-50 text-industrial-600 hover:bg-industrial-100'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  图表视图
                </button>

                <div className="flex-1" />

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-industrial-400">
                    吊点: <span className="text-industrial-600 font-medium">{points.length}</span>
                  </span>
                  <span className="text-industrial-400">
                    路线: <span className="text-industrial-600 font-medium">{routes.length}</span>
                  </span>
                  <span className="text-industrial-400">
                    问题: <span className="text-error-500 font-medium">{issues.filter(i => i.status !== 'resolved').length}</span>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {viewMode === '3d' ? (
                  <Stage3DScene
                    points={points}
                    routes={routes}
                    issues={issues}
                    selectedIssueId={selectedIssueId}
                    onPointClick={handlePointClick}
                  />
                ) : (
                  <div className="h-full p-4 bg-white">
                    <RouteChart routes={routes} issues={issues} />
                  </div>
                )}
              </div>
            </div>

            <div className="w-96 bg-white border-l border-industrial-100 flex flex-col">
              <IssuePanel
                issues={issues}
                routes={routes}
                obstacles={obstacles}
                sketches={sketches}
                selectedIssueId={selectedIssueId}
                onSelectIssue={setSelectedIssue}
                onResolveIssue={resolveIssue}
                onAddSketch={handleAddSketch}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ReportExport
              project={project}
              issues={issues}
              routes={routes}
              obstacles={obstacles}
              sketches={sketches}
            />
          </div>
        )}
      </div>

      {selectedIssue && (
        <SketchUploadModal
          isOpen={showSketchModal}
          onClose={() => setShowSketchModal(false)}
          issueId={selectedIssue.id}
          routeId={selectedIssue.routeId}
        />
      )}
    </div>
  );
}
