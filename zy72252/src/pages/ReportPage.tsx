import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { ReportExport } from '../components/ReportExport';

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    currentProjectId,
    projects,
    routes,
    obstacles,
    sketches,
    issues,
    setCurrentProject,
  } = useProjectStore();

  useEffect(() => {
    if (id && id !== currentProjectId) {
      setCurrentProject(id);
    }
  }, [id, currentProjectId, setCurrentProject]);

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-industrial-50">
        <p>项目不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-industrial-50 flex flex-col">
      <header className="bg-white border-b border-industrial-100 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/project/${id}`)}
              className="p-2 hover:bg-industrial-50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-industrial-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-industrial-600">报告导出 - {project.name}</h1>
              <p className="text-sm text-industrial-400">生成带完整说明的安全检测报告</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ReportExport
          project={project}
          issues={issues}
          routes={routes}
          obstacles={obstacles}
          sketches={sketches}
        />
      </div>
    </div>
  );
}
