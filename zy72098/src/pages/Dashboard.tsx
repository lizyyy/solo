import { Play, FileText, TrendingUp, AlertTriangle, CheckCircle, Clock, Database, FileWarning } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();
  const { getCurrentBatch, getCurrentRecords, isLoading, runCalculation } = useAppStore();
  const batch = getCurrentBatch();
  const records = getCurrentRecords();

  const stats = [
    {
      label: '总样本数',
      value: batch?.totalSamples || 0,
      icon: Database,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: '顺利完成',
      value: batch?.successCount || 0,
      icon: CheckCircle,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      label: '待人工确认',
      value: batch?.pendingCount || 0,
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-500',
    },
    {
      label: '历史口径补录',
      value: batch?.legacyCount || 0,
      icon: FileText,
      color: 'from-slate-500 to-gray-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">概览仪表盘</h1>
          <p className="text-slate-500 mt-1">监控图神经网络社区解释计算状态</p>
        </div>
        <button
          onClick={() => runCalculation()}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          <Play className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '计算中...' : '运行计算'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">快捷操作</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/calculation')}
              className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-cyan-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">查看计算流程</span>
            </button>
            <button
              onClick={() => navigate('/samples')}
              className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileWarning className="w-6 h-6 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">管理样本</span>
            </button>
            <button
              onClick={() => navigate('/params')}
              className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">参数管理</span>
            </button>
            <button
              onClick={() => navigate('/report')}
              className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">生成报告</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">最近计算记录</h3>
          <div className="space-y-3">
            {records.slice(0, 4).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => navigate('/calculation')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      record.type === 'success'
                        ? 'bg-emerald-100'
                        : record.type === 'pending'
                        ? 'bg-amber-100'
                        : 'bg-slate-200'
                    }`}
                  >
                    {record.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : record.type === 'pending' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{record.sampleName}</p>
                    <p className="text-xs text-slate-500">模块度: {record.outputData.modularity}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    record.type === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : record.type === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {record.type === 'success' ? '顺利' : record.type === 'pending' ? '待确认' : '旧口径'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">图神经网络社区解释算法参与情况</h3>
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 border border-cyan-100">
          <p className="text-slate-700 leading-relaxed">
            本批次所有 <span className="font-bold text-cyan-700">{records.length}</span> 条记录均由
            <span className="font-bold text-blue-700"> 图神经网络社区解释算法 </span>
            参与判断。计算过程已完整保留每一步骤，包括：
          </p>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-slate-600">节点度数计算</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-slate-600">边权重标准化</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-slate-600">社区初始划分</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-slate-600">模块度计算</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
