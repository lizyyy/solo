import { useState } from 'react';
import { NavBar } from '@/components/ui/NavBar';
import { UtilizationChart } from '@/components/charts/UtilizationChart';
import { useYardStore } from '@/store/useYardStore';
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  User,
  TrendingUp,
  AlertTriangle,
  Package,
  Truck,
  Activity,
  Info,
} from 'lucide-react';
import { mockDataSources } from '@/data/mockData';

export default function ReportsPage() {
  const { savedScenarios, getStatistics, loadScenario, deleteScenario } = useYardStore();
  const stats = getStatistics();
  const [activeTab, setActiveTab] = useState<'overview' | 'scenarios' | 'conflicts'>('overview');

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statCards = [
    {
      title: '堆场利用率',
      value: `${stats.utilizationRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      source: '箱位模型_20240115.xlsx',
    },
    {
      title: '冲突总数',
      value: stats.conflicts.total,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      source: '多源数据检测',
    },
    {
      title: '作业吊机',
      value: `${stats.activeCranes}/3`,
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      source: '吊机任务_20240115.csv',
    },
    {
      title: '活跃卡车',
      value: stats.activeTrucks,
      icon: Truck,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      source: '卡车路线_20240115.json',
    },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      <NavBar />
      <div className="pl-14 h-full flex flex-col">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">报告管理</h1>
              <p className="text-slate-400 text-sm">查看堆场统计数据、保存方案和导出报告</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>

        <div className="px-6">
          <div className="flex gap-2 border-b border-slate-700">
            {[
              { key: 'overview', label: '数据概览' },
              { key: 'scenarios', label: '保存方案' },
              { key: 'conflicts', label: '冲突清单' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'text-blue-400 border-blue-500'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {statCards.map((card, index) => (
                  <div
                    key={index}
                    className="bg-slate-900/50 rounded-xl p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">{card.title}</p>
                        <p className={`text-3xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                        <card.icon className={`w-6 h-6 ${card.color}`} />
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Info className="w-3 h-3" />
                        数据来源: {card.source}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <UtilizationChart />

                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h3 className="text-white font-medium mb-4">数据来源</h3>
                  <div className="space-y-3">
                    {mockDataSources.map((source, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{source.name}</p>
                            <p className="text-slate-500 text-xs">
                              最后导入: {formatDate(source.lastImport)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-mono text-sm">{source.recordCount}</p>
                          <p className="text-slate-500 text-xs">条记录</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scenarios' && (
            <div className="space-y-4">
              {savedScenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Package className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">暂无保存的方案</p>
                  <p className="text-sm mt-1">在3D堆场视图中点击"保存方案"来创建</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {savedScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="bg-slate-900/50 rounded-xl p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-medium">{scenario.name}</h3>
                          <p className="text-slate-400 text-sm mt-1">{scenario.description}</p>
                        </div>
                        <button
                          onClick={() => deleteScenario(scenario.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(scenario.createdAt)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => loadScenario(scenario.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                        >
                          加载方案
                        </button>
                        <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="bg-slate-900/50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">严重程度</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">类型</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">标题</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">受影响对象</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">检测时间</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {getStatistics().conflicts.total === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="font-medium text-slate-300">没有未解决的冲突</p>
                          <p className="text-sm mt-1">系统运行正常</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    useYardStore.getState().conflicts.filter(c => !c.resolved).map((conflict) => (
                      <tr key={conflict.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                              conflict.severity === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-orange-500/20 text-orange-400'
                            }`}
                          >
                            {conflict.severity === 'critical' ? '严重' : '警告'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {conflict.type === 'slot_overlap'
                            ? '箱位重叠'
                            : conflict.type === 'crane_collision'
                            ? '吊机冲突'
                            : conflict.type === 'route_blockage'
                            ? '路线堵塞'
                            : '压港风险'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{conflict.title}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {conflict.affectedObjectNames.slice(0, 2).map((name, i) => (
                              <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                {name}
                              </span>
                            ))}
                            {conflict.affectedObjectNames.length > 2 && (
                              <span className="text-xs text-slate-500">
                                +{conflict.affectedObjectNames.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(conflict.timestamp)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                            待处理
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
