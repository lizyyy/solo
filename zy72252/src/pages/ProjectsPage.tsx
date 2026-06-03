import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, CheckCircle2, Clock, ArrowRight, Database } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { cn } from '../lib/utils';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, loadSampleData } = useProjectStore();

  useEffect(() => {
    loadSampleData();
  }, [loadSampleData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal':
        return <CheckCircle2 className="w-5 h-5 text-success-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      case 'pending_review':
        return <Clock className="w-5 h-5 text-primary-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      normal: '正常',
      warning: '存在问题',
      pending_review: '待客户复核'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      normal: 'bg-green-50 text-success-500 border-green-200',
      warning: 'bg-warning-50 text-warning-500 border-warning-200',
      pending_review: 'bg-primary-50 text-primary-600 border-primary-200'
    };
    return colors[status] || 'bg-industrial-50 text-industrial-400 border-industrial-200';
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      import: '数据导入',
      detection: '问题检测',
      review: '服务复核',
      completed: '已完成'
    };
    return labels[stage] || stage;
  };

  return (
    <div className="min-h-screen bg-industrial-50">
      <header className="bg-white border-b border-industrial-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-industrial-600">舞台吊点安全演示</h1>
              <p className="text-sm text-industrial-400 mt-1">补录路线检测 · 服务复核 · 智能报告导出</p>
            </div>
            <button
              onClick={() => navigate('/import')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              导入新项目
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-card border border-industrial-100">
            <p className="text-sm text-industrial-400">项目总数</p>
            <p className="text-3xl font-bold text-industrial-600 mt-2">{projects.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-card border border-industrial-100">
            <p className="text-sm text-industrial-400">待处理问题</p>
            <p className="text-3xl font-bold text-warning-500 mt-2">
              {projects.filter(p => p.status === 'warning').length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-card border border-industrial-100">
            <p className="text-sm text-industrial-400">待客户复核</p>
            <p className="text-3xl font-bold text-primary-600 mt-2">
              {projects.filter(p => p.status === 'pending_review').length}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-industrial-600">项目列表</h2>
          <div className="flex items-center gap-2 text-sm text-industrial-400">
            <Database className="w-4 h-4" />
            数据自动保存在浏览器本地
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="group bg-white rounded-xl shadow-card border border-industrial-100 overflow-hidden hover:shadow-industrial transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => navigate(`/project/${project.id}`)}
              style={{
                animationDelay: `${index * 100}ms`,
                animation: 'fadeInUp 0.5s ease-out forwards',
                opacity: 0
              }}
            >
              <div className="h-2 bg-gradient-to-r from-primary-500 to-primary-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-industrial-600 group-hover:text-primary-600 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-industrial-400 mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  </div>
                  {getStatusIcon(project.status)}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={cn('text-xs px-2 py-1 rounded-full border', getStatusColor(project.status))}>
                    {getStatusLabel(project.status)}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-industrial-50 text-industrial-400 border border-industrial-200">
                    {getStageLabel(project.stage)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-industrial-400">
                    更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="flex items-center gap-1 text-primary-600 group-hover:gap-2 transition-all">
                    查看详情
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-industrial-200">
            <Database className="w-16 h-16 text-industrial-200 mx-auto mb-4" />
            <p className="text-industrial-400 mb-4">暂无项目数据</p>
            <button
              onClick={() => navigate('/import')}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              导入第一个项目
            </button>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
