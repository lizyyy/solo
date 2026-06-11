import { Package, AlertTriangle, CheckCircle, Clock, ArrowRight, FileText, Download } from 'lucide-react';
import type { MaterialChange, BimNote, CollisionPoint } from '../types';
import StatusBadge from './StatusBadge';

interface DashboardProps {
  materialChanges: MaterialChange[];
  bimNotes: BimNote[];
  collisions: CollisionPoint[];
  onViewChange: (view: string) => void;
}

export default function Dashboard({ materialChanges, bimNotes, collisions, onViewChange }: DashboardProps) {
  const stats = {
    total: materialChanges.filter(m => !m.isBadData).length,
    confirmed: materialChanges.filter(m => m.status === 'confirmed').length,
    pending: materialChanges.filter(m => m.status === 'pending').length,
    supplement: materialChanges.filter(m => m.status === 'supplement').length,
    returned: materialChanges.filter(m => m.status === 'returned').length,
    badData: materialChanges.filter(m => m.isBadData).length,
  };

  const totalValue = materialChanges
    .filter(m => !m.isBadData)
    .reduce((sum, m) => sum + m.materials.length, 0);

  const recentChanges = [...materialChanges]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const duplicateCollisions = collisions.filter(c => c.isDuplicate).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">项目经理看板</h2>
          <p className="text-sm text-slate-500 mt-1">快速了解施工变更整体情况</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('tracking')}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Package size={16} />
            查看全部材料
          </button>
          <button
            onClick={() => onViewChange('badData')}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            导出报表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Package}
          label="追踪总数"
          value={stats.total}
          color="slate"
        />
        <StatCard
          icon={CheckCircle}
          label="已确认"
          value={stats.confirmed}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="待确认"
          value={stats.pending}
          color="amber"
        />
        <StatCard
          icon={FileText}
          label="待补件"
          value={stats.supplement}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="已退回"
          value={stats.returned}
          color="red"
        />
        <StatCard
          icon={AlertTriangle}
          label="坏数据"
          value={stats.badData}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">最近更新</h3>
            <button
              onClick={() => onViewChange('tracking')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {recentChanges.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => onViewChange('tracking')}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    更新于 {new Date(item.updatedAt).toLocaleDateString('zh-CN')} · {item.author}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">{item.materials.length} 项材料</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">快捷入口</h3>
            <div className="space-y-2">
              <QuickAction
                icon={Package}
                label="材料库"
                desc="查看所有变更材料"
                onClick={() => onViewChange('tracking')}
              />
              <QuickAction
                icon={AlertTriangle}
                label="异常中心"
                desc={`${duplicateCollisions} 个重复碰撞待确认`}
                onClick={() => onViewChange('collisions')}
                alert
              />
              <QuickAction
                icon={Download}
                label="重新导出"
                desc="导出最新追踪报表"
                onClick={() => {}}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">数据概览</h3>
            <div className="space-y-3">
              <DataRow label="BIM备注总数" value={bimNotes.length} />
              <DataRow label="碰撞点总数" value={collisions.length} />
              <DataRow label="重复碰撞点" value={duplicateCollisions} alert />
              <DataRow label="涉及材料种类" value={totalValue} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[color] || colorMap.slate}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc, onClick, alert }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${alert ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-slate-400" />
    </button>
  );
}

function DataRow({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-medium ${alert ? 'text-amber-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}
