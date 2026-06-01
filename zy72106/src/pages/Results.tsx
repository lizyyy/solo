import { useAppStore } from '@/store/useAppStore';
import { formatCoordinate } from '@/utils/calculations/unitConversion';
import { AlertTriangle, MapPin, Clock, Activity, Target, TrendingUp } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

export function Results() {
  const { currentResult, sensorRecords } = useAppStore();

  if (!currentResult) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="card-body text-center py-16">
            <Target className="mx-auto text-slate-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">
              暂无定位结果
            </h3>
            <p className="text-slate-400">
              请先在计算工作台执行定位计算
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-primary-400';
      case 'fair':
        return 'text-amber-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getQualityBg = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'bg-green-900/30 border-green-800';
      case 'good':
        return 'bg-primary-900/30 border-primary-800';
      case 'fair':
        return 'bg-amber-900/30 border-amber-800';
      case 'poor':
        return 'bg-red-900/30 border-red-800';
      default:
        return 'bg-slate-800 border-slate-700';
    }
  };

  const residualsData = currentResult.residuals.map((r) => {
    const record = sensorRecords.find((s) => s.sensorId === r.sensorId);
    return {
      station: record?.stationName || r.sensorId,
      residual: Math.abs(r.residual),
      isExtreme: currentResult.extremeValues.includes(record?.id || ''),
    };
  });

  const stationsData = sensorRecords
    .filter((r) => r.latitude && r.longitude)
    .map((r) => ({
      name: r.stationName,
      longitude: r.longitude,
      latitude: r.latitude,
      isExtreme: currentResult.extremeValues.includes(r.id),
      needsReview: currentResult.needsReview.includes(r.id),
    }));

  const epicenterData = [
    {
      name: '震中',
      longitude: currentResult.longitude,
      latitude: currentResult.latitude,
      isEpicenter: true,
    },
  ];

  const extremeRecords = sensorRecords.filter((r) =>
    currentResult.extremeValues.includes(r.id)
  );
  const reviewRecords = sensorRecords.filter((r) =>
    currentResult.needsReview.includes(r.id)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-900/50 rounded-lg">
                <MapPin className="text-primary-400" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-400">震中位置</p>
                <p className="text-lg font-mono font-bold text-white">
                  {formatCoordinate(currentResult.latitude, currentResult.longitude)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-900/50 rounded-lg">
                <TrendingUp className="text-green-400" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-400">震级</p>
                <p className="text-lg font-mono font-bold text-white">
                  M {currentResult.magnitude.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-900/50 rounded-lg">
                <Clock className="text-amber-400" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-400">发震时刻</p>
                <p className="text-lg font-mono font-bold text-white">
                  {currentResult.originTime.toFixed(2)} s
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`card border ${getQualityBg(currentResult.quality)}`}>
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-800 rounded-lg">
                <Activity className={getQualityColor(currentResult.quality)} size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-400">结果质量</p>
                <p className={`text-lg font-bold ${getQualityColor(currentResult.quality)}`}>
                  {currentResult.quality === 'excellent'
                    ? '优秀'
                    : currentResult.quality === 'good'
                    ? '良好'
                    : currentResult.quality === 'fair'
                    ? '一般'
                    : '较差'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">台站分布与震中位置</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="longitude"
                    name="经度"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    dataKey="latitude"
                    name="纬度"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(4),
                      name,
                    ]}
                  />
                  <Scatter
                    name="台站"
                    data={stationsData}
                    fill="#06b6d4"
                  >
                    {stationsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isExtreme
                            ? '#ef4444'
                            : entry.needsReview
                            ? '#f59e0b'
                            : '#06b6d4'
                        }
                      />
                    ))}
                  </Scatter>
                  <Scatter
                    name="震中"
                    data={epicenterData}
                    fill="#22c55e"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary-500"></div>
                <span className="text-slate-400">正常台站</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-slate-400">待确认</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-slate-400">极端值</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-slate-400">震中</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">残差分析</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={residualsData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="station"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8' }}
                    label={{
                      value: '残差 (s)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#94a3b8',
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    formatter={(value: number) => [value.toFixed(4) + ' s', '残差']}
                  />
                  <Bar dataKey="residual" radius={[4, 4, 0, 0]}>
                    {residualsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isExtreme ? '#ef4444' : '#06b6d4'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {extremeRecords.length > 0 && (
          <div className="card border-red-800">
            <div className="card-header border-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={20} />
                <h3 className="font-semibold text-red-400">
                  极端值记录 ({extremeRecords.length}条)
                </h3>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {extremeRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-red-900/30 border border-red-800 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">
                        {record.stationName}
                      </span>
                      <span className="badge badge-danger">极端值</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">P波到时</p>
                        <p className="font-mono text-white">
                          {record.pWaveArrival?.toFixed(2)} s
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">S波到时</p>
                        <p className="font-mono text-white">
                          {record.sWaveArrival?.toFixed(2)} s
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">振幅</p>
                        <p className="font-mono text-white">
                          {record.amplitude?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {record.notes && (
                      <p className="mt-2 text-sm text-slate-400">
                        备注: {record.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reviewRecords.length > 0 && (
          <div className="card border-amber-800">
            <div className="card-header border-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-400" size={20} />
                <h3 className="font-semibold text-amber-400">
                  待人工确认 ({reviewRecords.length}条)
                </h3>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {reviewRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-amber-900/30 border border-amber-800 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">
                        {record.stationName}
                      </span>
                      <span className="badge badge-warning">待确认</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">P波到时</p>
                        <p className="font-mono text-white">
                          {record.pWaveArrival?.toFixed(2)} s
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">S波到时</p>
                        <p className="font-mono text-white">
                          {record.sWaveArrival?.toFixed(2)} s
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">数据来源</p>
                        <p className="text-white">
                          {record.source === 'sensor'
                            ? '传感器'
                            : record.source === 'manual'
                            ? '人工录入'
                            : '旧数据'}
                        </p>
                      </div>
                    </div>
                    {record.notes && (
                      <p className="mt-2 text-sm text-slate-400">
                        备注: {record.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-white">定位结果详情</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-3">基本信息</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">地震ID:</span>
                  <span className="font-mono text-white">{currentResult.earthquakeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">纬度:</span>
                  <span className="font-mono text-white">{currentResult.latitude.toFixed(6)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">经度:</span>
                  <span className="font-mono text-white">{currentResult.longitude.toFixed(6)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">深度:</span>
                  <span className="font-mono text-white">{currentResult.depth.toFixed(2)} km</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-3">不确定性</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">水平误差:</span>
                  <span className="font-mono text-white">±{currentResult.uncertainty.horizontal.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">垂直误差:</span>
                  <span className="font-mono text-white">±{currentResult.uncertainty.vertical.toFixed(2)} km</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-3">统计</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">使用台站数:</span>
                  <span className="font-mono text-white">{currentResult.residuals.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">极端值数:</span>
                  <span className="font-mono text-red-400">{currentResult.extremeValues.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">待确认数:</span>
                  <span className="font-mono text-amber-400">{currentResult.needsReview.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
