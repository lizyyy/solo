import { useEffect, useMemo } from 'react';
import { Plus, Eye, PlayCircle, LayoutGrid, Users, Link2, Type, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import type { Project } from '../types';
import type { LucideIcon } from 'lucide-react';

const auditStatusConfig: Record<Project['auditStatus'], { label: string; color: string; icon: LucideIcon }> = {
  pending: { label: '待审计', color: 'bg-amber-500/15 text-amber-500 border-amber-500', icon: Clock },
  audited: { label: '已审计', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500', icon: CheckCircle2 },
  risk_found: { label: '发现风险', color: 'bg-red-500/15 text-red-500 border-red-500', icon: AlertTriangle }
};

function AuditStatusBadge({ status }: { status: Project['auditStatus'] }) {
  const config = auditStatusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-md border ${config.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: LucideIcon; color: string }) {
  return (
    <Card hover>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color} bg-opacity-10`}>
          <Icon className="w-8 h-8 text-white opacity-90" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Projects() {
  const { projects, loadProjects } = useStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const stats = useMemo(() => ({
    total: projects.length,
    audited: projects.filter(p => p.auditStatus === 'audited').length,
    riskFound: projects.filter(p => p.auditStatus === 'risk_found').length
  }), [projects]);

  const sortedProjects = useMemo(() =>
    [...projects].sort((a, b) => b.createDate.localeCompare(a.createDate)),
    [projects]
  );

  const handleViewDetail = (id: string) => {
    console.log('View project detail:', id);
  };

  const handleStartAudit = (id: string) => {
    console.log('Start audit for project:', id);
  };

  const handleAddProject = () => {
    console.log('Add new project');
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">项目管理</h1>
            <p className="text-slate-400">管理所有审计项目及其合规状态</p>
          </div>
          <Button onClick={handleAddProject}>
            <Plus className="w-4 h-4" />
            新增项目
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="总项目数" value={stats.total} icon={LayoutGrid} color="from-cyan-400 to-blue-500" />
          <StatCard title="已审计" value={stats.audited} icon={CheckCircle2} color="from-emerald-400 to-emerald-600" />
          <StatCard title="发现风险" value={stats.riskFound} icon={AlertTriangle} color="from-red-400 to-red-600" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <LayoutGrid className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">项目列表</h3>
              </div>
              <span className="text-sm text-slate-400">共 {projects.length} 个项目</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">项目名称</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">客户名称</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">关联渠道</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">关联字体</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">创建日期</th>
                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-400">审计状态</th>
                    <th className="text-right py-3 px-6 text-sm font-medium text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedProjects.map((project: Project) => (
                    <tr key={project.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-white">{project.name}</div>
                        <StatusBadge status={project.status} size="sm" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          {project.clientName}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Link2 className="w-3.5 h-3.5 text-slate-500" />
                          {project.channelNames.length > 0 ? (
                            <span className="truncate max-w-28" title={project.channelNames.join(', ')}>
                              {project.channelNames.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Type className="w-3.5 h-3.5 text-slate-500" />
                          {project.fontNames.length > 0 ? (
                            <span className="truncate max-w-28" title={project.fontNames.join(', ')}>
                              {project.fontNames.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {project.createDate}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <AuditStatusBadge status={project.auditStatus} />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(project.id)}
                          >
                            <Eye className="w-4 h-4" />
                            详情
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStartAudit(project.id)}
                          >
                            <PlayCircle className="w-4 h-4" />
                            审计
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          {projects.length === 0 && (
            <CardFooter className="justify-center py-12 text-slate-400">
              <LayoutGrid className="w-8 h-8 mr-2 opacity-50" />
              暂无项目数据
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
