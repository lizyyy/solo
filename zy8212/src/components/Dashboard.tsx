import React, { useState, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import dayjs from 'dayjs';
import { RiskType } from '../types';
import type { RiskEvent, FilterState, ParsedData } from '../types';
import { DataParser } from '../modules/dataParser';
import { RuleEngine } from '../modules/ruleEngine';
import { Exporter } from '../modules/exporter';

const riskTypeColors: Record<RiskType, string> = {
  [RiskType.LOW_DO_SUSTAINED]: '#f59e0b',
  [RiskType.DO_DROP_AFTER_FEEDING]: '#ef4444',
  [RiskType.AERATOR_RESPONSE_DELAY]: '#8b5cf6',
  [RiskType.SENSOR_DRIFT]: '#06b6d4',
  [RiskType.UNEXPLAINED_MORTALITY]: '#dc2626',
};

const severityColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const riskTypeNames: Record<RiskType, string> = {
  [RiskType.LOW_DO_SUSTAINED]: '低溶氧持续',
  [RiskType.DO_DROP_AFTER_FEEDING]: '投喂后溶氧下坠',
  [RiskType.AERATOR_RESPONSE_DELAY]: '增氧机响应延迟',
  [RiskType.SENSOR_DRIFT]: '传感器漂移',
  [RiskType.UNEXPLAINED_MORTALITY]: '不明原因死亡',
};

const severityNames: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

export const Dashboard: React.FC = () => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    pondIds: [],
    startDate: null,
    endDate: null,
  });
  const [loading, setLoading] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState({
    sensor: false,
    feeding: false,
    aerator: false,
    mortality: false,
  });

  const [rawFiles, setRawFiles] = useState({
    sensor: '',
    feeding: '',
    aerator: '',
    mortality: '',
  });

  const ruleEngine = useMemo(() => new RuleEngine(), []);

  const availablePonds = useMemo(() => {
    if (!parsedData) return [];
    const ponds = new Set<string>();
    parsedData.sensorReadings.forEach(r => ponds.add(r.pondId));
    parsedData.feedingEvents.forEach(e => ponds.add(e.pondId));
    parsedData.aeratorLogs.forEach(l => ponds.add(l.pondId));
    parsedData.mortalityRecords.forEach(m => ponds.add(m.pondId));
    return Array.from(ponds).sort();
  }, [parsedData]);

  const dateRange = useMemo(() => {
    if (!parsedData) return { min: null, max: null };
    const allDates: dayjs.Dayjs[] = [];
    parsedData.sensorReadings.forEach(r => allDates.push(r.timestamp));
    parsedData.feedingEvents.forEach(e => allDates.push(e.timestamp));
    parsedData.aeratorLogs.forEach(l => allDates.push(l.timestamp));
    parsedData.mortalityRecords.forEach(m => allDates.push(m.timestamp));
    
    if (allDates.length === 0) return { min: null, max: null };
    allDates.sort((a, b) => a.valueOf() - b.valueOf());
    return { min: allDates[0], max: allDates[allDates.length - 1] };
  }, [parsedData]);

  const filteredData = useMemo(() => {
    if (!parsedData) return null;
    
    const pondFilter = filters.pondIds.length > 0 ? filters.pondIds : availablePonds;
    
    const filterByPondAndDate = <T extends { pondId: string; timestamp: dayjs.Dayjs }>(items: T[]): T[] => {
      return items.filter(item => {
        const pondMatch = pondFilter.includes(item.pondId);
        const dateMatch = 
          (!filters.startDate || item.timestamp.isAfter(filters.startDate.subtract(1, 'second'))) &&
          (!filters.endDate || item.timestamp.isBefore(filters.endDate.add(1, 'day')));
        return pondMatch && dateMatch;
      });
    };

    return {
      sensorReadings: filterByPondAndDate(parsedData.sensorReadings),
      feedingEvents: filterByPondAndDate(parsedData.feedingEvents),
      aeratorLogs: filterByPondAndDate(parsedData.aeratorLogs),
      mortalityRecords: filterByPondAndDate(parsedData.mortalityRecords),
    };
  }, [parsedData, filters, availablePonds]);

  const filteredRisks = useMemo(() => {
    if (!risks.length) return [];
    const pondFilter = filters.pondIds.length > 0 ? filters.pondIds : availablePonds;
    
    return risks.filter(risk => {
      const pondMatch = pondFilter.includes(risk.pondId);
      const dateMatch = 
        (!filters.startDate || risk.timestamp.isAfter(filters.startDate.subtract(1, 'second'))) &&
        (!filters.endDate || risk.timestamp.isBefore(filters.endDate.add(1, 'day')));
      return pondMatch && dateMatch;
    });
  }, [risks, filters, availablePonds]);

  const doChartData = useMemo(() => {
    if (!filteredData) return [];
    
    const readings = [...filteredData.sensorReadings].sort(
      (a, b) => a.timestamp.valueOf() - b.timestamp.valueOf()
    );
    
    const grouped: Record<string, Record<string, number | string>> = {};
    
    readings.forEach(reading => {
      const timeKey = reading.timestamp.format('YYYY-MM-DD HH:mm');
      if (!grouped[timeKey]) {
        grouped[timeKey] = { time: timeKey };
      }
      grouped[timeKey][`pond_${reading.pondId}`] = reading.dissolvedOxygen;
    });
    
    return Object.values(grouped).sort((a, b) => {
      const aTime = dayjs(a.time as string, 'YYYY-MM-DD HH:mm');
      const bTime = dayjs(b.time as string, 'YYYY-MM-DD HH:mm');
      return aTime.valueOf() - bTime.valueOf();
    });
  }, [filteredData]);

  const riskSummary = useMemo(() => {
    const summary: Record<string, { count: number; ponds: Set<string> }> = {};
    
    filteredRisks.forEach(risk => {
      const type = risk.type;
      if (!summary[type]) {
        summary[type] = { count: 0, ponds: new Set() };
      }
      summary[type].count++;
      summary[type].ponds.add(risk.pondId);
    });
    
    return Object.entries(summary).map(([type, data]) => ({
      type: riskTypeNames[type as RiskType] || type,
      type_enum: type,
      count: data.count,
      ponds: Array.from(data.ponds).join(', '),
      color: riskTypeColors[type as RiskType] || '#9ca3af',
    }));
  }, [filteredRisks]);

  const handleFileUpload = useCallback((type: 'sensor' | 'feeding' | 'aerator' | 'mortality') => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setRawFiles(prev => ({ ...prev, [type]: content }));
        setFilesLoaded(prev => ({ ...prev, [type]: true }));
      };
      reader.readAsText(file);
    };
  }, []);

  const processData = useCallback(() => {
    setLoading(true);
    
    try {
      const data = DataParser.parseAll(
        rawFiles.sensor,
        rawFiles.feeding,
        rawFiles.aerator,
        rawFiles.mortality
      );
      
      setParsedData(data);
      
      const detectedRisks = ruleEngine.detectAllRisks(
        data.sensorReadings,
        data.feedingEvents,
        data.aeratorLogs,
        data.mortalityRecords
      );
      setRisks(detectedRisks);
      
      setFilters({
        pondIds: [],
        startDate: null,
        endDate: null,
      });
    } catch (error) {
      console.error('Error processing data:', error);
    } finally {
      setLoading(false);
    }
  }, [rawFiles, ruleEngine]);

  const loadSampleData = useCallback(() => {
    setLoading(true);
    
    fetch('/sample-data/sensor.csv')
      .then(res => res.text())
      .then(sensorData => {
        setRawFiles(prev => ({ ...prev, sensor: sensorData }));
        setFilesLoaded(prev => ({ ...prev, sensor: true }));
      });
    
    fetch('/sample-data/feeding.jsonl')
      .then(res => res.text())
      .then(feedingData => {
        setRawFiles(prev => ({ ...prev, feeding: feedingData }));
        setFilesLoaded(prev => ({ ...prev, feeding: true }));
      });
    
    fetch('/sample-data/aerator.yaml')
      .then(res => res.text())
      .then(aeratorData => {
        setRawFiles(prev => ({ ...prev, aerator: aeratorData }));
        setFilesLoaded(prev => ({ ...prev, aerator: true }));
      });
    
    fetch('/sample-data/mortality.csv')
      .then(res => res.text())
      .then(mortalityData => {
        setRawFiles(prev => ({ ...prev, mortality: mortalityData }));
        setFilesLoaded(prev => ({ ...prev, mortality: true }));
      });
    
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const exportRiskCSV = useCallback(() => {
    if (!filteredRisks.length) return;
    const csv = Exporter.exportRiskEventsCSV(filteredRisks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `risk_events_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredRisks]);

  const exportReportMD = useCallback(() => {
    if (!parsedData) return;
    const md = Exporter.exportReviewReportMD(filteredRisks, {
      ...parsedData,
      sensorReadings: filteredData?.sensorReadings || [],
      feedingEvents: filteredData?.feedingEvents || [],
      aeratorLogs: filteredData?.aeratorLogs || [],
      mortalityRecords: filteredData?.mortalityRecords || [],
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review_report_${dayjs().format('YYYYMMDD_HHmmss')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }, [parsedData, filteredRisks, filteredData]);

  const totalFilesLoaded = Object.values(filesLoaded).filter(Boolean).length;
  const isReadyToProcess = totalFilesLoaded >= 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                水产养殖溶氧-投喂异常复盘看板
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                离线分析池塘传感器数据、投喂事件、增氧机台账和死亡巡检记录
              </p>
            </div>
            <div className="flex gap-2">
              {parsedData && (
                <>
                  <button
                    onClick={exportRiskCSV}
                    disabled={!filteredRisks.length}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    导出风险CSV
                  </button>
                  <button
                    onClick={exportReportMD}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    导出复盘报告
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {!parsedData ? (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                导入数据文件
              </h2>
              <button
                onClick={loadSampleData}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
              >
                加载示例数据（包含异常样例）
              </button>
              <p className="text-sm text-gray-500 mt-2">或手动上传以下文件</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${filesLoaded.sensor ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-medium text-gray-900 mb-1">池塘传感器 CSV</h3>
                <p className="text-xs text-gray-500 mb-4">溶氧、温度、pH 等实时数据</p>
                <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filesLoaded.sensor ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {filesLoaded.sensor ? '已加载 ✓' : '选择文件'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload('sensor')}
                  />
                </label>
              </div>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${filesLoaded.feeding ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                <div className="text-3xl mb-2">🐟</div>
                <h3 className="font-medium text-gray-900 mb-1">投喂机事件 JSONL</h3>
                <p className="text-xs text-gray-500 mb-4">投喂时间、饲料类型、投喂量</p>
                <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filesLoaded.feeding ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {filesLoaded.feeding ? '已加载 ✓' : '选择文件'}
                  <input
                    type="file"
                    accept=".jsonl,.json"
                    className="hidden"
                    onChange={handleFileUpload('feeding')}
                  />
                </label>
              </div>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${filesLoaded.aerator ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                <div className="text-3xl mb-2">💨</div>
                <h3 className="font-medium text-gray-900 mb-1">增氧机台账 YAML</h3>
                <p className="text-xs text-gray-500 mb-4">增氧机启停时间、功率</p>
                <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filesLoaded.aerator ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {filesLoaded.aerator ? '已加载 ✓' : '选择文件'}
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    className="hidden"
                    onChange={handleFileUpload('aerator')}
                  />
                </label>
              </div>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${filesLoaded.mortality ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                <div className="text-3xl mb-2">📋</div>
                <h3 className="font-medium text-gray-900 mb-1">死亡巡检 CSV</h3>
                <p className="text-xs text-gray-500 mb-4">死亡数量、原因、备注</p>
                <label className={`cursor-pointer inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filesLoaded.mortality ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {filesLoaded.mortality ? '已加载 ✓' : '选择文件'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload('mortality')}
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={processData}
                disabled={!isReadyToProcess || loading}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium transition-colors"
              >
                {loading ? '处理中...' : '开始分析数据'}
              </button>
              {totalFilesLoaded > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  已加载 {totalFilesLoaded}/4 个文件
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    池塘筛选
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilters(f => ({ ...f, pondIds: [] }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.pondIds.length === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      全部
                    </button>
                    {availablePonds.map(pond => (
                      <button
                        key={pond}
                        onClick={() => {
                          setFilters(f => {
                            const isSelected = f.pondIds.includes(pond);
                            if (isSelected) {
                              return { ...f, pondIds: f.pondIds.filter(id => id !== pond) };
                            } else {
                              return { ...f, pondIds: [...f.pondIds, pond] };
                            }
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.pondIds.includes(pond) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        池塘 {pond}
                      </button>
                    ))}
                  </div>
                </div>

                {dateRange.min && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        开始日期
                      </label>
                      <input
                        type="date"
                        value={filters.startDate?.format('YYYY-MM-DD') || ''}
                        min={dateRange.min.format('YYYY-MM-DD')}
                        max={dateRange.max?.format('YYYY-MM-DD')}
                        onChange={(e) => {
                          const date = e.target.value ? dayjs(e.target.value) : null;
                          setFilters(f => ({ ...f, startDate: date }));
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        结束日期
                      </label>
                      <input
                        type="date"
                        value={filters.endDate?.format('YYYY-MM-DD') || ''}
                        min={dateRange.min.format('YYYY-MM-DD')}
                        max={dateRange.max?.format('YYYY-MM-DD')}
                        onChange={(e) => {
                          const date = e.target.value ? dayjs(e.target.value) : null;
                          setFilters(f => ({ ...f, endDate: date }));
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">传感器读数</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {filteredData?.sensorReadings.length || 0}
                    </p>
                  </div>
                  <div className="text-3xl">📊</div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">投喂事件</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {filteredData?.feedingEvents.length || 0}
                    </p>
                  </div>
                  <div className="text-3xl">🐟</div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">增氧机操作</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {filteredData?.aeratorLogs.length || 0}
                    </p>
                  </div>
                  <div className="text-3xl">💨</div>
                </div>
              </div>

              <div className={`rounded-xl shadow-sm p-4 ${filteredRisks.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${filteredRisks.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      风险事件
                    </p>
                    <p className={`text-2xl font-bold ${filteredRisks.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {filteredRisks.length}
                    </p>
                  </div>
                  <div className="text-3xl">
                    {filteredRisks.length > 0 ? '⚠️' : '✅'}
                  </div>
                </div>
              </div>
            </div>

            {filteredRisks.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">风险事件统计</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={riskSummary}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="事件数">
                          {riskSummary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {riskSummary.map(item => (
                      <div
                        key={item.type_enum}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-gray-900">{item.type}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-lg">{item.count}</span>
                          <span className="text-gray-500 text-sm ml-1">次</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">溶氧时间线</h3>
              {doChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={doChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={Math.floor(doChartData.length / 6)}
                    />
                    <YAxis
                      label={{ value: '溶氧 (mg/L)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '安全阈值', position: 'top' }} />
                    {availablePonds.map((pond, index) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                      return (
                        <Line
                          key={pond}
                          type="monotone"
                          dataKey={`pond_${pond}`}
                          name={`池塘 ${pond}`}
                          stroke={colors[index % colors.length]}
                          dot={false}
                          strokeWidth={2}
                        />
                      );
                    })}
                    {filteredData?.feedingEvents.slice(0, 5).map((event) => {
                      const timeKey = event.timestamp.format('YYYY-MM-DD HH:mm');
                      return (
                        <ReferenceLine
                          key={timeKey}
                          x={timeKey}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  暂无溶氧数据
                </div>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-0.5 bg-red-500" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
                  <span>安全阈值 (4mg/L)</span>
                </div>
                {filteredData?.feedingEvents.length ? (
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-green-500" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
                    <span>投喂事件</span>
                  </div>
                ) : null}
              </div>
            </div>

            {filteredRisks.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">风险事件详情</h3>
                <div className="space-y-3">
                  {filteredRisks.map((risk) => (
                    <div
                      key={risk.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: severityColors[risk.severity] }}
                            >
                              {severityNames[risk.severity]}
                            </span>
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ 
                                backgroundColor: `${riskTypeColors[risk.type]}20`,
                                color: riskTypeColors[risk.type]
                              }}
                            >
                              {riskTypeNames[risk.type]}
                            </span>
                            <span className="text-gray-500 text-sm">
                              池塘 {risk.pondId}
                            </span>
                          </div>
                          <p className="text-gray-900 text-sm">{risk.description}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            时间: {risk.timestamp.format('YYYY-MM-DD HH:mm')}
                            {risk.endTimestamp && ` 至 ${risk.endTimestamp.format('YYYY-MM-DD HH:mm')}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(filteredData?.feedingEvents.length || 0) > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">投喂事件</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">池塘</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">饲料类型</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">投喂量(kg)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">时长(分钟)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData?.feedingEvents
                        .sort((a, b) => b.timestamp.valueOf() - a.timestamp.valueOf())
                        .slice(0, 20)
                        .map((event, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{event.pondId}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {event.timestamp.format('YYYY-MM-DD HH:mm')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">{event.feedType}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{event.feedAmount}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{event.feedingDuration}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(filteredData?.mortalityRecords.length || 0) > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">死亡巡检记录</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">池塘</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">死亡数量</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">原因</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData?.mortalityRecords
                        .sort((a, b) => b.timestamp.valueOf() - a.timestamp.valueOf())
                        .map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{record.pondId}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {record.timestamp.format('YYYY-MM-DD HH:mm')}
                            </td>
                            <td className="px-4 py-2 text-sm text-red-600 font-medium">{record.count}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {record.cause || '未记录'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {record.notes || '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
