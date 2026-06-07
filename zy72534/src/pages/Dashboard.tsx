import { Link } from 'react-router-dom';
import { Layers, AlertTriangle, Clock, CheckCircle, ArrowRight, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../store/useAppStore';

export default function Dashboard() {
  const { batches, samples, getAnomalySamples } = useAppStore();
  const anomalySamples = getAnomalySamples();
  const pendingReview = samples.filter(s => s.status === 'pending_review');
  const confirmed = samples.filter(s => s.status === 'confirmed_normal');

  const chartData = [
    { name: '待复核', value: pendingReview.length, color: '#E07B39' },
    { name: '已确认', value: confirmed.length, color: '#5A8F69' },
    { name: '需关注', value: samples.filter(s => s.status === 'needs_attention').length, color: '#C44536' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">小看板</h1>
          <p className="text-stone-500 mt-1">素材标签冷启动 · 运营复核工作台</p>
        </div>
        <Link
          to="/batch/import"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
        >
          导入灰度批次
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="导入批次"
          value={batches.length}
          icon={Layers}
          color="slate"
        />
        <StatCard
          title="样本总数"
          value={samples.length}
          icon={Layers}
          color="slate"
        />
        <StatCard
          title="异常样本"
          value={anomalySamples.length}
          icon={AlertTriangle}
          color="amber"
          trend="模型版本换了但样本编号没变"
        />
        <StatCard
          title="待运营复核"
          value={pendingReview.length}
          icon={Clock}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-stone-800">异常样本 · 待复核</h2>
            <span className="text-sm text-stone-500">共 {anomalySamples.length} 条</span>
          </div>

          <div className="space-y-3">
            {anomalySamples.slice(0, 4).map((sample) => (
              <div
                key={sample.id}
                className="flex items-center justify-between p-4 rounded-lg border-l-4 border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="font-medium text-stone-800">{sample.sampleNo}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      模型版本：{sample.versions.map(v => v.modelVersion).join(' → ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={sample.status} isAnomaly={sample.isAnomaly} />
                  <Link
                    to={`/sample/${sample.id}`}
                    className="p-2 rounded-lg bg-white border border-stone-200 hover:border-amber-300 hover:text-amber-600 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800 mb-5">状态分布</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-stone-600">{item.name}</span>
                </div>
                <span className="font-medium text-stone-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-stone-800">最近批次</h2>
          <Link to="/batch/list" className="text-sm text-amber-600 hover:text-amber-700 font-medium">
            查看全部 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">批次名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">模型版本</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">样本数</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">异常数</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-3 px-4 font-medium text-stone-800">{batch.name}</td>
                  <td className="py-3 px-4 text-sm text-stone-600">{batch.modelVersion}</td>
                  <td className="py-3 px-4 text-sm text-stone-600">{batch.totalSamples}</td>
                  <td className="py-3 px-4">
                    {batch.anomalyCount > 0 ? (
                      <span className="text-sm font-medium text-amber-600">{batch.anomalyCount}</span>
                    ) : (
                      <span className="text-sm text-stone-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/batch/list`}
                      className="text-sm text-amber-600 hover:text-amber-700"
                    >
                      查看样本
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
