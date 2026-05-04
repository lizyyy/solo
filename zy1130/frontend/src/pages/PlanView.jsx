import React from 'react';
import { 
  Play, 
  RefreshCw, 
  Save, 
  Plus, 
  Download,
  Map,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  ChevronRight,
  Settings
} from 'lucide-react';

const PlanView = () => {
  const [plans, setPlans] = React.useState([]);
  const [currentPlan, setCurrentPlan] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('gantt');
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState(null);
  const [selectedJob, setSelectedJob] = React.useState(null);
  const [showAddJobModal, setShowAddJobModal] = React.useState(false);
  const [newJob, setNewJob] = React.useState({
    locationName: '',
    address: '',
    serviceType: '维修',
    timeWindowStart: '09:00',
    timeWindowEnd: '11:00',
    serviceDurationMinutes: 30,
    priority: 1,
    lat: 31.234,
    lng: 121.456
  });

  const loadPlans = React.useCallback(async () => {
    setLoading(true);
    try {
      const { plansApi } = await import('../utils/api');
      const res = await plansApi.getAll();
      const allPlans = res.data?.data || [];
      setPlans(allPlans);
      
      const active = allPlans.find(p => p.isActive);
      if (active) {
        const detailRes = await plansApi.getById(active.id);
        setCurrentPlan(detailRes.data?.data);
      }
    } catch (error) {
      console.error('加载方案失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { optimizeApi } = await import('../utils/api');
      const res = await optimizeApi.optimize({
        name: `方案 ${new Date().toLocaleDateString('zh-CN')}`,
        date: new Date().toISOString().split('T')[0]
      });
      
      if (res.data?.success) {
        const { plansApi } = await import('../utils/api');
        const detailRes = await plansApi.getById(res.data.data.id);
        setCurrentPlan(detailRes.data?.data);
        loadPlans();
      }
    } catch (error) {
      alert('生成方案失败: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const activatePlan = async (planId) => {
    try {
      const { plansApi } = await import('../utils/api');
      await plansApi.activate(planId);
      loadPlans();
    } catch (error) {
      alert('激活方案失败: ' + error.message);
    }
  };

  const addNewJob = async () => {
    if (!currentPlan) return;
    
    try {
      const { optimizeApi } = await import('../utils/api');
      const res = await optimizeApi.addJob({
        planId: currentPlan.id,
        jobData: newJob
      });
      
      if (res.data?.success) {
        const { plansApi } = await import('../utils/api');
        const detailRes = await plansApi.getById(currentPlan.id);
        setCurrentPlan(detailRes.data?.data);
        setShowAddJobModal(false);
        setNewJob({
          locationName: '',
          address: '',
          serviceType: '维修',
          timeWindowStart: '09:00',
          timeWindowEnd: '11:00',
          serviceDurationMinutes: 30,
          priority: 1,
          lat: 31.234,
          lng: 121.456
        });
      }
    } catch (error) {
      alert('添加任务失败: ' + error.message);
    }
  };

  const getServiceTypeColor = (type) => {
    switch (type) {
      case '维修': return 'bg-blue-500';
      case '保洁': return 'bg-green-500';
      case '洗衣': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getRiskBadge = (risks = []) => {
    if (!risks || risks.length === 0) return null;
    
    const hasLate = risks.some(r => r.type === 'late_arrival');
    const hasOvertime = risks.some(r => r.type === 'overtime');
    const hasSkill = risks.some(r => r.type === 'skill_mismatch');
    const hasRestriction = risks.some(r => r.type === 'restriction_violation');
    
    return (
      <div className="flex gap-1">
        {hasLate && (
          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">迟到</span>
        )}
        {hasOvertime && (
          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">超时</span>
        )}
        {hasSkill && (
          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded text-xs">技能</span>
        )}
        {hasRestriction && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">限行</span>
        )}
      </div>
    );
  };

  const renderGanttChart = () => {
    if (!currentPlan || !currentPlan.routes || currentPlan.routes.length === 0) {
      return (
        <div className="text-center py-16 text-gray-500">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>暂无路线数据</p>
          <p className="text-sm mt-2">请先生成派单方案</p>
        </div>
      );
    }

    const startTime = 8 * 60;
    const endTime = 20 * 60;
    const totalMinutes = endTime - startTime;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-3 h-3 bg-blue-100 rounded border border-blue-300"></div>
              <span>行程</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>服务中</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-3 h-3 bg-yellow-200 rounded"></div>
              <span>午休</span>
            </div>
          </div>
        </div>

        {currentPlan.routes.map((route, routeIndex) => (
          <div key={routeIndex} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{route.workerName}</p>
                  <p className="text-xs text-gray-500">
                    {route.workerSkills?.join('、') || ''} | {route.workerVehicleType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-gray-600">
                  <Clock className="w-4 h-4 inline mr-1" />
                  总耗时: {Math.floor(route.totalMinutes / 60)}时{route.totalMinutes % 60}分
                </div>
                <div className="text-gray-600">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  距离: {route.totalDistance?.toFixed(1) || 0}km
                </div>
                <div className="text-gray-600">
                  任务: {route.stops?.filter(s => s.type === 'job').length || 0}个
                </div>
                {route.risks && route.risks.length > 0 && getRiskBadge(route.risks)}
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex">
                <div className="w-24 flex-shrink-0"></div>
                <div className="flex-1 flex border-b border-gray-200">
                  {Array.from({ length: 13 }, (_, i) => (
                    <div key={i} className="flex-1 text-xs text-gray-500 text-center pb-1">
                      {startTime / 60 + i}:00
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center mt-2">
                <div className="w-24 flex-shrink-0 text-sm text-gray-600">路线</div>
                <div className="flex-1 h-10 bg-gray-100 rounded relative">
                  {route.stops?.map((stop, stopIndex) => {
                    if (stop.type === 'break') {
                      const breakStart = (stop.etaMinutes - startTime) / totalMinutes * 100;
                      const breakDuration = 60 / totalMinutes * 100;
                      return (
                        <div
                          key={`break-${stopIndex}`}
                          className="absolute top-1 bottom-1 bg-yellow-200 rounded border border-yellow-300 flex items-center justify-center"
                          style={{
                            left: `${Math.max(0, breakStart)}%`,
                            width: `${Math.min(100 - breakStart, breakDuration)}%`
                          }}
                        >
                          <span className="text-xs text-yellow-700">午休</span>
                        </div>
                      );
                    }

                    if (stop.type !== 'job' || !stop.etaMinutes || !stop.etdMinutes) {
                      return null;
                    }

                    const travelStart = stopIndex === 0 
                      ? startTime 
                      : (route.stops[stopIndex - 1]?.etdMinutes || startTime);
                    const travelEnd = stop.etaMinutes;
                    const serviceStart = stop.etaMinutes;
                    const serviceEnd = stop.etdMinutes;

                    const travelLeft = (travelStart - startTime) / totalMinutes * 100;
                    const travelWidth = (travelEnd - travelStart) / totalMinutes * 100;
                    const serviceLeft = (serviceStart - startTime) / totalMinutes * 100;
                    const serviceWidth = (serviceEnd - serviceStart) / totalMinutes * 100;

                    const hasRisk = stop.risks && stop.risks.length > 0;

                    return (
                      <React.Fragment key={stopIndex}>
                        {travelWidth > 0 && (
                          <div
                            className={`absolute top-3 bottom-3 rounded ${hasRisk ? 'bg-red-200' : 'bg-blue-100'}`}
                            style={{
                              left: `${Math.max(0, travelLeft)}%`,
                              width: `${Math.min(100 - travelLeft, Math.max(0.5, travelWidth))}%`
                            }}
                          />
                        )}
                        <div
                          className={`absolute top-0 bottom-0 rounded cursor-pointer transition-all hover:opacity-80 ${
                            hasRisk ? 'bg-red-500 border-2 border-red-600' : getServiceTypeColor(stop.serviceType)
                          }`}
                          style={{
                            left: `${Math.max(0, serviceLeft)}%`,
                            width: `${Math.min(100 - serviceLeft, Math.max(1, serviceWidth))}%`
                          }}
                          onClick={() => setSelectedJob({ ...stop, workerId: route.workerId, workerName: route.workerName })}
                        >
                          <div className="h-full flex items-center justify-center px-1 overflow-hidden">
                            <span className="text-white text-xs truncate">
                              {stop.locationName?.substring(0, 4)}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center mt-4">
                <div className="w-24 flex-shrink-0 text-sm text-gray-600">详情</div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {route.stops?.map((stop, stopIndex) => {
                      if (stop.type === 'break') {
                        return (
                          <div key={`break-${stopIndex}`} className="flex items-center gap-1 flex-shrink-0">
                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                              <Clock className="w-4 h-4 text-yellow-600" />
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        );
                      }

                      if (stop.type !== 'job') return null;

                      const hasRisk = stop.risks && stop.risks.length > 0;

                      return (
                        <div key={stopIndex} className="flex items-center gap-1 flex-shrink-0">
                          <div 
                            className={`w-8 h-8 ${getServiceTypeColor(stop.serviceType)} rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${hasRisk ? 'ring-2 ring-red-400' : ''}`}
                            onClick={() => setSelectedJob({ ...stop, workerId: route.workerId, workerName: route.workerName })}
                          >
                            <span className="text-white text-xs font-medium">
                              {stopIndex + 1}
                            </span>
                          </div>
                          {stopIndex < route.stops.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMapView = () => {
    if (!currentPlan || !currentPlan.routes) {
      return (
        <div className="text-center py-16 text-gray-500">
          <Map className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>暂无路线数据</p>
        </div>
      );
    }

    const workerColors = [
      { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
      { bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
      { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
      { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
      { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-300' }
    ];

    const allStops = [];
    currentPlan.routes.forEach((route, routeIndex) => {
      const color = workerColors[routeIndex % workerColors.length];
      
      if (route.startLocation) {
        allStops.push({
          ...route.startLocation,
          type: 'start',
          workerIndex: routeIndex,
          workerName: route.workerName,
          color
        });
      }
      
      route.stops?.forEach((stop, stopIndex) => {
        if (stop.type === 'job') {
          allStops.push({
            ...stop,
            type: 'job',
            workerIndex: routeIndex,
            workerName: route.workerName,
            stopIndex,
            color
          });
        }
      });
    });

    const lats = allStops.filter(s => s.lat).map(s => s.lat);
    const lngs = allStops.filter(s => s.lng).map(s => s.lng);
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;

    const mapToCanvas = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * 100;
      const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
      return { x, y };
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          {currentPlan.routes.map((route, routeIndex) => {
            const color = workerColors[routeIndex % workerColors.length];
            return (
              <div key={routeIndex} className="flex items-center gap-2">
                <div className={`w-4 h-4 ${color.bg} rounded-full`}></div>
                <span className="text-sm text-gray-700">{route.workerName}</span>
              </div>
            );
          })}
        </div>

        <div className="relative bg-gray-100 rounded-xl border-2 border-gray-200" style={{ height: '500px' }}>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {currentPlan.routes.map((route, routeIndex) => {
              const color = workerColors[routeIndex % workerColors.length];
              const jobStops = route.stops?.filter(s => s.type === 'job') || [];
              
              if (jobStops.length === 0) return null;

              const pathPoints = [];
              
              if (route.startLocation) {
                const start = mapToCanvas(route.startLocation.lat, route.startLocation.lng);
                pathPoints.push(`${start.x},${start.y}`);
              }
              
              jobStops.forEach(stop => {
                if (stop.lat && stop.lng) {
                  const pos = mapToCanvas(stop.lat, stop.lng);
                  pathPoints.push(`${pos.x},${pos.y}`);
                }
              });

              return (
                <g key={routeIndex}>
                  <polyline
                    points={pathPoints.join(' ')}
                    fill="none"
                    stroke={routeIndex === 0 ? '#3b82f6' : routeIndex === 1 ? '#22c55e' : routeIndex === 2 ? '#a855f7' : routeIndex === 3 ? '#f97316' : '#ec4899'}
                    strokeWidth="2"
                    strokeOpacity="0.6"
                    strokeDasharray="4,2"
                  />
                </g>
              );
            })}
          </svg>

          {allStops.map((stop, index) => {
            if (!stop.lat || !stop.lng) return null;
            const pos = mapToCanvas(stop.lat, stop.lng);
            const isStart = stop.type === 'start';
            const hasRisk = stop.risks && stop.risks.length > 0;

            return (
              <div
                key={index}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                onClick={() => !isStart && setSelectedJob(stop)}
              >
                <div className={`relative ${
                  isStart 
                    ? `w-6 h-6 ${stop.color.light} border-2 ${stop.color.border} rounded-full` 
                    : `w-8 h-8 ${stop.color.bg} rounded-full flex items-center justify-center shadow-lg ${hasRisk ? 'ring-2 ring-red-400 ring-offset-2' : ''}`
                }`}>
                  {!isStart && (
                    <span className="text-white text-xs font-bold">
                      {stop.stopIndex !== undefined ? stop.stopIndex + 1 : '?'}
                    </span>
                  )}
                  {isStart && (
                    <div className={`w-2 h-2 ${stop.color.bg} rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />
                  )}
                </div>
                
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {isStart ? `起点: ${stop.locationName}` : stop.locationName}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {currentPlan.routes.map((route, routeIndex) => {
            const color = workerColors[routeIndex % workerColors.length];
            const jobStops = route.stops?.filter(s => s.type === 'job') || [];
            
            return (
              <div key={routeIndex} className={`p-4 rounded-lg border-2 ${color.light} ${color.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 ${color.bg} rounded-full`}></div>
                  <span className="font-medium text-gray-800">{route.workerName}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>任务数: {jobStops.length}</p>
                  <p>总耗时: {Math.floor(route.totalMinutes / 60)}时{route.totalMinutes % 60}分</p>
                  <p>距离: {route.totalDistance?.toFixed(1) || 0}km</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentPlan?.id || ''}
              onChange={(e) => {
                const plan = plans.find(p => p.id === e.target.value);
                if (plan) {
                  setCurrentPlan(plan);
                }
              }}
            >
              <option value="">选择方案</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} {plan.isActive ? '(激活)' : ''}
                </option>
              ))}
            </select>

            {currentPlan && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => activatePlan(currentPlan.id)}
                  disabled={currentPlan.isActive}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPlan.isActive
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {currentPlan.isActive ? <CheckCircle className="w-4 h-4 inline mr-1" /> : null}
                  {currentPlan.isActive ? '已激活' : '激活方案'}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddJobModal(true)}
              disabled={!currentPlan}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              临时加单
            </button>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {generating ? '生成中...' : '生成方案'}
            </button>
          </div>
        </div>

        {currentPlan && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">总任务数</p>
              <p className="text-xl font-bold text-blue-600">
                {currentPlan.routes?.reduce((acc, r) => acc + (r.stops?.filter(s => s.type === 'job').length || 0), 0) || 0}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">分配师傅数</p>
              <p className="text-xl font-bold text-green-600">
                {currentPlan.routes?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-500">总距离</p>
              <p className="text-xl font-bold text-orange-600">
                {(currentPlan.routes?.reduce((acc, r) => acc + (r.totalDistance || 0), 0) || 0).toFixed(1)}km
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500">风险任务</p>
              <p className="text-xl font-bold text-red-600">
                {currentPlan.routes?.reduce((acc, r) => acc + (r.risks?.length || 0), 0) || 0}
              </p>
            </div>
          </div>
        )}
      </div>

      {currentPlan && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100">
            <div className="flex">
              <button
                onClick={() => setActiveTab('gantt')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'gantt'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                甘特图视图
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'map'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Map className="w-4 h-4 inline mr-2" />
                地图视图
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'gantt' && renderGanttChart()}
            {activeTab === 'map' && renderMapView()}
          </div>
        </div>
      )}

      {!currentPlan && !loading && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <Play className="w-16 h-16 mx-auto mb-4 text-blue-200" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">开始生成派单方案</h3>
          <p className="text-gray-500 mb-6">点击右上角的"生成方案"按钮，系统将自动为您优化路线</p>
          <button
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-5 h-5" />
            生成方案
          </button>
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">任务详情</h3>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">地点</p>
                <p className="font-medium text-gray-800">{selectedJob.locationName}</p>
                <p className="text-sm text-gray-500">{selectedJob.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">服务类型</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs mt-1 ${getServiceTypeColor(selectedJob.serviceType)} text-white`}>
                    {selectedJob.serviceType}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">服务时长</p>
                  <p className="font-medium text-gray-800">{selectedJob.serviceDurationMinutes}分钟</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">时间窗</p>
                  <p className="font-medium text-gray-800">{selectedJob.timeWindowStart} - {selectedJob.timeWindowEnd}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">分配师傅</p>
                  <p className="font-medium text-gray-800">{selectedJob.workerName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">预计到达</p>
                  <p className="font-medium text-gray-800">
                    {selectedJob.etaMinutes ? `${String(Math.floor(selectedJob.etaMinutes / 60)).padStart(2, '0')}:${String(selectedJob.etaMinutes % 60).padStart(2, '0')}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">预计离开</p>
                  <p className="font-medium text-gray-800">
                    {selectedJob.etdMinutes ? `${String(Math.floor(selectedJob.etdMinutes / 60)).padStart(2, '0')}:${String(selectedJob.etdMinutes % 60).padStart(2, '0')}` : '-'}
                  </p>
                </div>
              </div>

              {selectedJob.risks && selectedJob.risks.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    风险提示
                  </p>
                  <div className="space-y-1">
                    {selectedJob.risks.map((risk, i) => (
                      <p key={i} className="text-sm text-red-600">{risk.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddJobModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">临时加单</h3>
                <button
                  onClick={() => setShowAddJobModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地点名称</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newJob.locationName}
                  onChange={(e) => setNewJob({ ...newJob, locationName: e.target.value })}
                  placeholder="如：阳光花园2号楼302"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">详细地址</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newJob.address}
                  onChange={(e) => setNewJob({ ...newJob, address: e.target.value })}
                  placeholder="详细地址"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务类型</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newJob.serviceType}
                    onChange={(e) => setNewJob({ ...newJob, serviceType: e.target.value })}
                  >
                    <option value="维修">维修</option>
                    <option value="保洁">保洁</option>
                    <option value="洗衣">洗衣</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务时长(分钟)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newJob.serviceDurationMinutes}
                    onChange={(e) => setNewJob({ ...newJob, serviceDurationMinutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间窗开始</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newJob.timeWindowStart}
                    onChange={(e) => setNewJob({ ...newJob, timeWindowStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间窗结束</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newJob.timeWindowEnd}
                    onChange={(e) => setNewJob({ ...newJob, timeWindowEnd: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddJobModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={addNewJob}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加并重排
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanView;
