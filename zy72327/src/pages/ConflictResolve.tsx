import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, Calculator } from 'lucide-react';
import WorkflowStepper from '../components/WorkflowStepper';
import ConflictCard from '../components/ConflictCard';
import { useForecastStore } from '../store/forecastStore';

export default function ConflictResolve() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const {
    conflicts,
    workflowState,
    loading,
    fetchConflicts,
    fetchWorkflowStatus,
    resolveConflict,
    calculateForecast,
  } = useForecastStore();

  useEffect(() => {
    fetchConflicts();
    fetchWorkflowStatus();
  }, []);

  const totalCount = conflicts.length;
  const pendingCount = conflicts.filter(c => c.status === 'pending').length;
  const resolvedCount = conflicts.filter(c => c.status === 'resolved').length;

  const filteredConflicts = conflicts.filter(c => {
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'resolved') return c.status === 'resolved';
    return true;
  });

  const handleResolve = async (id: string, resolution: 'accept_example' | 'reject_example', reason: string) => {
    await resolveConflict(id, resolution, reason, '当前用户');
  };

  const handleCalculate = async () => {
    if (pendingCount > 0) return;
    await calculateForecast();
    navigate('/results');
  };

  const filters = [
    { key: 'all' as const, label: '全部', count: totalCount },
    { key: 'pending' as const, label: '待处理', count: pendingCount },
    { key: 'resolved' as const, label: '已解决', count: resolvedCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回工作台</span>
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">冲突处理中心</h1>
          <p className="text-gray-500">处理参数调试表与手算反例之间的冲突</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <WorkflowStepper workflowState={workflowState} loading={loading} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">总冲突数</p>
                <p className="text-3xl font-bold text-blue-700">{totalCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600 font-medium">待处理冲突</p>
                <p className="text-3xl font-bold text-amber-700">{pendingCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">已解决冲突</p>
                <p className="text-3xl font-bold text-green-700">{resolvedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-2 border-b border-gray-200 mb-6">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-3 font-medium transition-colors relative ${
                  filter === f.key
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100">
                  {f.count}
                </span>
                {filter === f.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredConflicts.length > 0 ? (
              filteredConflicts.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={handleResolve}
                  disabled={loading}
                />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>暂无{filter === 'pending' ? '待处理' : filter === 'resolved' ? '已解决' : ''}冲突</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-amber-700">请处理所有冲突后再执行计算</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleCalculate}
              disabled={pendingCount > 0 || loading}
              className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
                pendingCount > 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
              }`}
            >
              <Calculator className="w-5 h-5" />
              {pendingCount > 0 ? '请先处理所有冲突' : '执行预测计算'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
