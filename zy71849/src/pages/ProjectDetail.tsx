import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { FileText, PenTool, Eye, ClipboardList, AlertTriangle, CheckCircle2, Clock, ArrowRight, Calendar, User } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentProject,
    selectProject,
    sightRecords,
    inspectionItems,
    flipRecords,
    inspectionStats,
  } = useAppStore();

  useEffect(() => {
    if (id) {
      selectProject(id);
    }
  }, [id, selectProject]);

  if (!currentProject) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-96 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  const pendingCount = flipRecords.filter((f) => f.status === 'pending').length;
  const confirmedCount = sightRecords.filter((r) => r.status === 'confirmed').length;
  const manualCount = sightRecords.filter((r) => r.isManualModified).length;

  const quickActions = [
    {
      title: '设备备注',
      description: '管理设备坐标和备注信息',
      icon: FileText,
      path: `/projects/${id}/device-remarks`,
      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'CAD点位',
      description: '导入和管理CAD坐标点位',
      icon: PenTool,
      path: `/projects/${id}/cad-points`,
      color: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
      iconBg: 'bg-purple-500',
    },
    {
      title: '视线分析',
      description: '运行视线分析计算',
      icon: Eye,
      path: `/projects/${id}/sight-analysis`,
      color: 'bg-green-50 text-green-700 hover:bg-green-100',
      iconBg: 'bg-green-500',
      badge: sightRecords.length > 0 ? `${sightRecords.length} 条记录` : null,
    },
    {
      title: '巡检单',
      description: '生成和导出巡检报告',
      icon: ClipboardList,
      path: `/projects/${id}/inspection`,
      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
      iconBg: 'bg-amber-500',
      badge: inspectionItems.length > 0 ? `${inspectionItems.length} 条记录` : null,
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-slate-800">{currentProject.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>创建于 {new Date(currentProject.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>最后修改：{currentProject.lastModifier}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>更新于 {new Date(currentProject.updatedAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={currentProject.status} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">总记录数</p>
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-slate-800">{sightRecords.length}</p>
          </div>
        </div>

        <div className="card border-l-4 border-l-status-confirmed">
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">已确认</p>
              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-status-confirmed" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-status-confirmed">{confirmedCount}</p>
          </div>
        </div>

        <div className="card border-l-4 border-l-status-pending">
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">待处理</p>
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-status-pending" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-status-pending">{pendingCount}</p>
          </div>
        </div>

        <div className="card border-l-4 border-l-status-manual">
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-500">人工修改</p>
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-status-manual" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-status-manual">{manualCount}</p>
          </div>
        </div>
      </div>

      {inspectionStats && (
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="font-serif text-lg font-semibold text-slate-800">巡检单统计</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-semibold text-status-confirmed">{inspectionStats.confirmed}</p>
                <p className="text-sm text-slate-600 mt-1">已确认</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectionStats.confirmedCount}/{inspectionStats.confirmed} 已确认
                </p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-2xl font-semibold text-status-pending">{inspectionStats.pending}</p>
                <p className="text-sm text-slate-600 mt-1">待补充</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectionStats.pendingCount}/{inspectionStats.pending} 已确认
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-semibold text-status-manual">{inspectionStats.manual}</p>
                <p className="text-sm text-slate-600 mt-1">人工修改</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inspectionStats.manualCount}/{inspectionStats.manual} 已确认
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-serif text-lg font-semibold text-slate-800 mb-4">功能入口</h2>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                onClick={() => navigate(action.path)}
                className={`card p-5 cursor-pointer transition-all hover:shadow-md ${action.color}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${action.iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-800">{action.title}</h3>
                      {action.badge && (
                        <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{action.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-50" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="card border-amber-200 bg-amber-50/50">
          <div className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-status-pending flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">待处理事项</h3>
                <p className="text-sm text-amber-700 mt-1">
                  当前有 {pendingCount} 条坐标轴翻转记录待处理，请及时联系对应责任人处理。
                </p>
                <button
                  onClick={() => navigate(`/projects/${id}/cad-points`)}
                  className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1"
                >
                  前往处理 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
