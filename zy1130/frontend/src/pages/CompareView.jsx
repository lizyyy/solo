import React from 'react';
import { 
  GitCompare, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  User
} from 'lucide-react';

const CompareView = () => {
  const [plans, setPlans] = React.useState([]);
  const [selectedPlans, setSelectedPlans] = React.useState([]);
  const [comparison, setComparison] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [comparing, setComparing] = React.useState(false);

  React.useEffect(() => {
    const loadPlans = async () => {
      try {
        const { plansApi } = await import('../utils/api');
        const res = await plansApi.getAll();
        setPlans(res.data?.data || []);
      } catch (error) {
        console.error('加载方案失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  const togglePlanSelection = (planId) => {
    if (selectedPlans.includes(planId)) {
      setSelectedPlans(selectedPlans.filter(id => id !== planId));
    } else if (selectedPlans.length < 3) {
      setSelectedPlans([...selectedPlans, planId]);
    }
  };

  const handleCompare = async () => {
    if (selectedPlans.length < 2) {
      alert('请至少选择两个方案进行对比');
      return;
    }

    setComparing(true);
    try {
      const { plansApi } = await import('../utils/api');
      const res = await plansApi.compare(selectedPlans);
      setComparison(res.data?.data);
    } catch (error) {
      alert('对比失败: ' + error.message);
    } finally {
      setComparing(false);
    }
  };

  const getTotalJobs = (plan) => {
    return plan.routes?.reduce((acc, r) => acc + (r.stops?.filter(s => s.type === 'job').length || 0), 0) || 0;
  };

  const getTotalDistance = (plan) => {
    return plan.routes?.reduce((acc, r) => acc + (r.totalDistance || 0), 0) || 0;
  };

  const getTotalMinutes = (plan) => {
    return plan.routes?.reduce((acc, r) => acc + (r.totalMinutes || 0), 0) || 0;
  };

  const getRiskCount = (plan) => {
    return plan.routes?.reduce((acc, r) => acc + (r.risks?.length || 0), 0) || 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">选择方案进行对比</h2>
          <button
            onClick={handleCompare}
            disabled={selectedPlans.length < 2 || comparing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {comparing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <GitCompare className="w-4 h-4" />
            )}
            {comparing ? '对比中...' : '开始对比'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitCompare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无方案可对比</p>
            <p className="text-sm mt-1">请先在"路线规划"页面生成方案</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isSelected = selectedPlans.includes(plan.id);
              const totalJobs = getTotalJobs(plan);
              const totalDistance = getTotalDistance(plan);
              const risks = getRiskCount(plan);

              return (
                <div
                  key={plan.id}
                  onClick={() => togglePlanSelection(plan.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">{plan.name}</h3>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 mb-3">
                    {new Date(plan.createdAt).toLocaleString('zh-CN')}
                    {plan.isActive && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        已激活
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <p className="text-gray-500">任务</p>
                      <p className="font-medium text-gray-800">{totalJobs}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">距离</p>
                      <p className="font-medium text-gray-800">{totalDistance.toFixed(1)}km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">风险</p>
                      <p className={`font-medium ${risks > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                        {risks}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedPlans.length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">
              已选择 {selectedPlans.length} 个方案进行对比
              {selectedPlans.length < 2 && ' (至少需要选择 2 个)'}
              {selectedPlans.length >= 3 && ' (最多选择 3 个)'}
            </p>
          </div>
        )}
      </div>

      {comparison && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">对比结果</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">指标</th>
                  {comparison.plans?.map((plan, i) => (
                    <th key={i} className="text-center py-3 px-4 text-gray-800 font-medium">
                      {plan.name}
                      {plan.isActive && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">总任务数</td>
                  {comparison.plans?.map((plan, i) => {
                    const value = getTotalJobs(plan);
                    const maxValue = Math.max(...comparison.plans?.map(p => getTotalJobs(p)) || [0]);
                    return (
                      <td key={i} className={`text-center py-3 px-4 font-medium ${
                        value === maxValue && maxValue > 0 ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {value}
                      </td>
                    );
                  })}
                </tr>

                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    总距离
                  </td>
                  {comparison.plans?.map((plan, i) => {
                    const value = getTotalDistance(plan);
                    const minValue = Math.min(...comparison.plans?.map(p => getTotalDistance(p)).filter(v => v > 0) || [0]);
                    return (
                      <td key={i} className={`text-center py-3 px-4 font-medium ${
                        value === minValue && minValue > 0 ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {value.toFixed(1)}km
                        {value === minValue && minValue > 0 && (
                          <span className="ml-1 text-green-600">最优</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">
                    <Clock className="w-4 h-4 inline mr-1" />
                    总耗时
                  </td>
                  {comparison.plans?.map((plan, i) => {
                    const value = getTotalMinutes(plan);
                    const hours = Math.floor(value / 60);
                    const minutes = value % 60;
                    const minValue = Math.min(...comparison.plans?.map(p => getTotalMinutes(p)).filter(v => v > 0) || [0]);
                    return (
                      <td key={i} className={`text-center py-3 px-4 font-medium ${
                        value === minValue && minValue > 0 ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {hours}时{minutes}分
                      </td>
                    );
                  })}
                </tr>

                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">
                    <User className="w-4 h-4 inline mr-1" />
                    师傅数量
                  </td>
                  {comparison.plans?.map((plan, i) => (
                    <td key={i} className="text-center py-3 px-4 font-medium text-gray-800">
                      {plan.routes?.length || 0}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    风险数量
                  </td>
                  {comparison.plans?.map((plan, i) => {
                    const value = getRiskCount(plan);
                    const minValue = Math.min(...comparison.plans?.map(p => getRiskCount(p)) || [0]);
                    return (
                      <td key={i} className={`text-center py-3 px-4 font-medium ${
                        value === 0 ? 'text-green-600' : value === minValue ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {value}
                        {value === 0 && <span className="ml-1 text-green-600">无风险</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="font-medium text-gray-800 mb-4">各方案路线详情</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {comparison.plans?.map((plan, planIndex) => (
                <div key={planIndex} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">{plan.name}</h4>
                  <div className="space-y-2">
                    {plan.routes?.map((route, routeIndex) => {
                      const jobCount = route.stops?.filter(s => s.type === 'job').length || 0;
                      return (
                        <div key={routeIndex} className="p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-800">{route.workerName}</span>
                            <span className="text-gray-500">{jobCount} 个任务</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.floor(route.totalMinutes / 60)}时{route.totalMinutes % 60}分
                            <span className="mx-2">|</span>
                            {(route.totalDistance || 0).toFixed(1)}km
                            {route.risks && route.risks.length > 0 && (
                              <>
                                <span className="mx-2">|</span>
                                <span className="text-red-500">{route.risks.length} 风险</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareView;
