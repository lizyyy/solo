import { useNavigate } from 'react-router-dom';
import {
  Waves,
  MapPin,
  AlertTriangle,
  Clock,
  ChevronRight,
  CheckCircle,
  XCircle,
  Upload,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { getTrendData } from '../data/mockData';
import { formatDateTime, getSeverityColor } from '../utils/anomalyUtils';
import { useState } from 'react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { buoyLogs, spatialMarks, anomalies, changeLogs, setSelectedLogId, setShowLogDetail } =
    useAppStore();
  const [trendData] = useState(getTrendData());

  const confirmedLogs = buoyLogs.filter((l) => l.isConfirmed).length;
  const pendingLogs = buoyLogs.filter((l) => !l.isConfirmed).length;
  const unresolvedAnomalies = anomalies.filter((a) => !a.isResolved).length;
  const normalMarks = spatialMarks.filter((m) => m.status === 'normal').length;

  const recentChanges = changeLogs.slice(0, 5);

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.isAnomaly && data?.activePayload?.[0]?.payload?.logId) {
      const logId = data.activePayload[0].payload.logId;
      setSelectedLogId(logId);
      setShowLogDetail(true);
      navigate('/buoy-logs');
    }
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isAnomaly) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={12} fill="rgba(249, 115, 22, 0.2)" className="animate-pulse" />
          <circle cx={cx} cy={cy} r={7} fill="#f97316" stroke="white" strokeWidth={2} />
        </g>
      );
    }
    return <Dot cx={cx} cy={cy} r={4} fill="#0ea5e9" />;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'confirm':
        return <CheckCircle className="w-4 h-4 text-seagrass-500" />;
      case 'import':
        return <Upload className="w-4 h-4 text-ocean-500" />;
      case 'resolve':
        return <CheckCircle className="w-4 h-4 text-seagrass-500" />;
      case 'create':
        return <MapPin className="w-4 h-4 text-ocean-500" />;
      case 'update':
        return <Clock className="w-4 h-4 text-sand-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      confirm: '人工确认',
      import: '批量导入',
      resolve: '异常处理',
      create: '新增记录',
      update: '更新记录',
      mark_abnormal: '标记异常',
    };
    return labels[action] || action;
  };

  const statCards = [
    {
      label: '浮标日志',
      value: buoyLogs.length,
      subValue: `已确认 ${confirmedLogs} / 待确认 ${pendingLogs}`,
      icon: Waves,
      color: 'from-ocean-500 to-ocean-700',
      bgColor: 'bg-ocean-50',
      textColor: 'text-ocean-600',
      path: '/buoy-logs',
    },
    {
      label: '空间标注',
      value: spatialMarks.length,
      subValue: `正常 ${normalMarks} / 异常 ${spatialMarks.length - normalMarks}`,
      icon: MapPin,
      color: 'from-seagrass-500 to-seagrass-700',
      bgColor: 'bg-seagrass-50',
      textColor: 'text-seagrass-600',
      path: '/spatial-marking',
    },
    {
      label: '待处理异常',
      value: unresolvedAnomalies,
      subValue: `共 ${anomalies.length} 条异常记录`,
      icon: AlertTriangle,
      color: 'from-coral-500 to-coral-700',
      bgColor: 'bg-coral-50',
      textColor: 'text-coral-600',
      path: '/anomalies',
    },
    {
      label: '变更记录',
      value: changeLogs.length,
      subValue: '最近7天操作日志',
      icon: Clock,
      color: 'from-sand-500 to-sand-700',
      bgColor: 'bg-sand-50',
      textColor: 'text-sand-600',
      path: '/audit',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ocean-900">总览仪表盘</h2>
        <p className="text-ocean-600 mt-1 text-sm">海草床调查空间标注数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer group animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{card.value}</p>
                  <p className={`text-xs mt-2 ${card.textColor}`}>{card.subValue}</p>
                </div>
                <div className={`${card.bgColor} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">海草生长趋势</h3>
              <p className="text-xs text-gray-500 mt-0.5">最近7天覆盖度和生物量变化</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-ocean-500"></span>
                <span className="text-gray-600">覆盖度 (%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-seagrass-500"></span>
                <span className="text-gray-600">生物量 (g/m²)</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBiomass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'coverage' ? '覆盖度' : '生物量',
                  ]}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="coverage"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCoverage)"
                  dot={<CustomDot />}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="biomass"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBiomass)"
                  dot={{ r: 3, fill: '#22c55e' }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-coral-600">
              <AlertTriangle className="w-4 h-4" />
              <span>橙色圆点为异常数据，点击可查看对应浮标日志详情</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">最近变更</h3>
              <p className="text-xs text-gray-500 mt-0.5">最新操作记录</p>
            </div>
            <button
              onClick={() => navigate('/audit')}
              className="text-xs text-ocean-600 hover:text-ocean-800 flex items-center gap-0.5"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {recentChanges.map((change, index) => (
              <div
                key={change.id}
                className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="mt-0.5">{getActionIcon(change.action)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {getActionLabel(change.action)}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        change.sourceType === 'buoy_log'
                          ? 'bg-ocean-50 text-ocean-600'
                          : change.sourceType === 'spatial_mark'
                          ? 'bg-seagrass-50 text-seagrass-600'
                          : 'bg-coral-50 text-coral-600'
                      }`}
                    >
                      {change.sourceType === 'buoy_log'
                        ? '浮标日志'
                        : change.sourceType === 'spatial_mark'
                        ? '空间标注'
                        : '异常'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{change.remark}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(change.createdAt)} · {change.operator}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gradient-to-r from-ocean-50 to-seagrass-50 rounded-xl p-5 border border-ocean-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-coral-500" />
          </div>
          <div>
            <h3 className="font-semibold text-ocean-900">待处理提醒</h3>
            <p className="text-sm text-ocean-700 mt-1">
              您有 <span className="font-bold text-coral-600">{unresolvedAnomalies}</span> 条待处理异常，
              <span className="font-bold text-sand-600">{pendingLogs}</span> 条待确认记录。
              请及时处理以确保数据准确性。
            </p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => navigate('/anomalies')}
                className="px-4 py-2 bg-coral-500 text-white text-sm rounded-lg hover:bg-coral-600 transition-colors shadow-sm"
              >
                处理异常
              </button>
              <button
                onClick={() => navigate('/buoy-logs')}
                className="px-4 py-2 bg-white text-ocean-700 text-sm rounded-lg hover:bg-ocean-50 transition-colors border border-ocean-200"
              >
                确认记录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
