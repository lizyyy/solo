import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { Calendar, User, ChevronRight, Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, loadProjects, loading, initialized } = useAppStore();

  useEffect(() => {
    if (initialized) {
      loadProjects();
    }
  }, [initialized, loadProjects]);

  const statusConfig = {
    active: { label: '进行中', color: 'bg-blue-100 text-blue-700', icon: Clock },
    completed: { label: '已完成', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    archived: { label: '已归档', color: 'bg-slate-100 text-slate-600', icon: CheckCircle2 },
  };

  if (loading && projects.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-slate-800">项目列表</h1>
        <p className="text-sm text-slate-500 mt-1">管理所有剧院座席视线分析项目</p>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => {
          const config = statusConfig[project.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="card hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-serif text-lg font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">
                      {project.name}
                    </h3>
                    <span className={`badge flex items-center gap-1 ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>创建于 {new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>最后修改：{project.lastModifier}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-md hover:bg-primary-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project.id}/sight-analysis`);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      视线分析
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project.id}/inspection`);
                      }}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      巡检单
                    </button>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">暂无项目</p>
          <p className="text-sm text-slate-400 mt-1">数据正在初始化中...</p>
        </div>
      )}
    </div>
  );
}
