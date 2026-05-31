import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import ChangeCard from '@/components/ChangeCard';

const COLORS = ['#3b82f6', '#f97316'];

export default function ChangesAnalysis() {
  const { currentTask } = useAppStore();

  const pieData = useMemo(() => {
    if (!currentTask) return [];
    const materialCount = currentTask.changes.filter((c) => c.type === 'material').length;
    const conclusionCount = currentTask.changes.filter((c) => c.type === 'conclusion').length;
    return [
      { name: '补材料', value: materialCount, color: '#3b82f6' },
      { name: '结论变更', value: conclusionCount, color: '#f97316' },
    ];
  }, [currentTask]);

  const barData = useMemo(() => {
    if (!currentTask) return [];
    const severityCount = { low: 0, medium: 0, high: 0 };
    currentTask.changes.forEach((c) => {
      severityCount[c.severity]++;
    });
    return [
      { name: '低', count: severityCount.low },
      { name: '中', count: severityCount.medium },
      { name: '高', count: severityCount.high },
    ];
  }, [currentTask]);

  const conclusionChanges = currentTask?.changes.filter((c) => c.type === 'conclusion') || [];
  const materialChanges = currentTask?.changes.filter((c) => c.type === 'material') || [];

  if (!currentTask) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500">请先选择一个校对任务</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">变更分析</h2>
          <p className="text-slate-500">深入分析所有变更，区分补材料和真正的结论变更</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={20} className="text-primary-500" />
              <span className="text-xs text-slate-500">总变更数</span>
            </div>
            <p className="text-3xl font-bold text-slate-800">{currentTask.changes.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-material-light rounded-xl border border-material/30 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={20} className="text-material" />
              <span className="text-xs text-material-dark">补材料</span>
            </div>
            <p className="text-3xl font-bold text-material-dark">{materialChanges.length}</p>
            <p className="text-xs text-material mt-1">不影响原有结论</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-conclusion-light rounded-xl border border-conclusion/30 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle size={20} className="text-conclusion" />
              <span className="text-xs text-conclusion-dark">结论变更</span>
            </div>
            <p className="text-3xl font-bold text-conclusion-dark">{conclusionChanges.length}</p>
            <p className="text-xs text-conclusion mt-1">需要重点关注</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <Clock size={20} className="text-slate-500" />
              <span className="text-xs text-slate-500">最近更新</span>
            </div>
            <p className="text-lg font-bold text-slate-800">
              {new Date(currentTask.updatedAt).toLocaleDateString('zh-CN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(currentTask.updatedAt).toLocaleTimeString('zh-CN')}
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl border border-slate-200 p-6"
          >
            <h3 className="font-semibold text-slate-800 mb-4">变更类型分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl border border-slate-200 p-6"
          >
            <h3 className="font-semibold text-slate-800 mb-4">影响程度分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-conclusion" />
            <h3 className="text-lg font-semibold text-slate-800">结论变更（需要重点关注）</h3>
          </div>
          <div className="grid gap-4">
            {conclusionChanges.map((change) => (
              <ChangeCard key={change.id} change={change} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-material" />
            <h3 className="text-lg font-semibold text-slate-800">补材料（可快速确认）</h3>
          </div>
          <div className="grid gap-4">
            {materialChanges.map((change) => (
              <ChangeCard key={change.id} change={change} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
