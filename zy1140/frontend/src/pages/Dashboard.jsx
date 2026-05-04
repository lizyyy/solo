import { useEffect, useState, useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { 
  Heart, 
  Footprints, 
  Moon, 
  Activity, 
  Flame, 
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Upload
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingOverlay, EmptyState } from '../components/ui/Loading';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/common/StatCard';
import { LineChart, AreaChart, BarChart, DoughnutChart } from '../components/charts';
import { DateRangePicker } from '../components/ui/DatePicker';

const Dashboard = () => {
  const {
    dateRange,
    summaryData,
    summaryLoading,
    anomalies,
    notes,
    setDateRange,
    fetchSummary,
    fetchAnomalies,
    fetchNotes,
    runAnomalyDetection,
  } = useStore();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);
  
  const loadData = async () => {
    try {
      await Promise.all([
        fetchSummary(startDate, endDate),
        fetchAnomalies(startDate, endDate),
        fetchNotes(startDate, endDate),
      ]);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };
  
  const handleRefresh = async () => {
    await runAnomalyDetection(startDate, endDate);
    await loadData();
  };
  
  const stats = useMemo(() => {
    if (!summaryData || !summaryData.overview) return null;
    const { overview, dailySummaries } = summaryData;
    const summaries = dailySummaries || [];
    
    const last7Days = summaries.slice(-7);
    const prev7Days = summaries.slice(-14, -7);
    
    const avgSteps = overview.stepsTotal > 0 && overview.daysWithData > 0 
      ? Math.round(overview.stepsTotal / overview.daysWithData) 
      : 0;
    const avgSleep = overview.totalSleepMinutes > 0 && overview.daysWithSleep > 0 
      ? Math.round(overview.totalSleepMinutes / overview.daysWithSleep) 
      : 0;
    const avgRestingHR = overview.avgRestingHR || 0;
    const avgHRV = overview.avgHRV || 0;
    const avgEnergy = overview.totalEnergyBurned > 0 && overview.daysWithData > 0 
      ? Math.round(overview.totalEnergyBurned / overview.daysWithData) 
      : 0;
    const workoutCount = overview.workoutCount || 0;
    const totalSleepDebt = overview.totalSleepDebt || 0;
    
    return {
      avgSteps,
      avgSleep,
      avgRestingHR,
      avgHRV,
      avgEnergy,
      workoutCount,
      totalSleepDebt,
      sleepTrend: prev7Days.length > 0 
        ? (last7Days.reduce((a, b) => a + (b.sleepMinutes || 0), 0) / last7Days.length) -
          (prev7Days.reduce((a, b) => a + (b.sleepMinutes || 0), 0) / prev7Days.length)
        : 0,
    };
  }, [summaryData]);
  
  const activeAnomalies = useMemo(() => {
    return (anomalies || []).filter(a => !a.dismissed);
  }, [anomalies]);
  
  if (summaryLoading) {
    return <LoadingOverlay message="加载数据中..." />;
  }
  
  if (!summaryData || !summaryData.overview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">健康数据总览</h1>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </div>
        <EmptyState
          icon={Upload}
          title="暂无数据"
          description="请先导入 Apple Health 数据，支持 XML、GPX、CSV 和 JSON 格式"
          action={
            <Button onClick={() => window.location.href = '/import'}>
              <Plus className="w-4 h-4 mr-2" />
              导入数据
            </Button>
          }
        />
      </div>
    );
  }
  
  const dailySummaries = summaryData.dailySummaries || [];
  
  const sleepData = dailySummaries
    .filter(d => d.sleepMinutes > 0)
    .map(d => ({
      date: d.date,
      睡眠时长: Math.round(d.sleepMinutes / 60 * 10) / 10,
      目标: 8,
    }));
  
  const hrData = dailySummaries
    .filter(d => d.restingHR > 0)
    .map(d => ({
      date: d.date,
      静息心率: d.restingHR,
      正常上限: 70,
    }));
  
  const hrvData = dailySummaries
    .filter(d => d.hrvSdnn > 0)
    .map(d => ({
      date: d.date,
      心率变异性: d.hrvSdnn,
    }));
  
  const stepsData = dailySummaries
    .filter(d => d.stepsTotal > 0)
    .map(d => ({
      date: d.date,
      步数: d.stepsTotal,
    }));
  
  const energyData = dailySummaries
    .filter(d => d.energyBurned > 0)
    .map(d => ({
      date: d.date,
      活动能量: d.energyBurned,
    }));
  
  const hrZoneData = summaryData.heartRateZones?.length > 0 
    ? summaryData.heartRateZones.map(z => ({
        label: z.zone || z.name || `区间 ${z.level || 1}`,
        value: z.count || z.duration || 0,
      }))
    : [
        { label: '静息', value: 35 },
        { label: '低强度', value: 25 },
        { label: '脂肪燃烧', value: 20 },
        { label: '有氧', value: 12 },
        { label: '无氧', value: 8 },
      ];
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">健康数据总览</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新数据
          </Button>
        </div>
      </div>
      
      {activeAnomalies.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    检测到 {activeAnomalies.length} 个异常
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-300">
                    包括: {activeAnomalies.slice(0, 3).map(a => a.description || a.type).join('、')}
                    {activeAnomalies.length > 3 && '...'}
                  </p>
                </div>
              </div>
              <Button variant="default" onClick={() => window.location.href = '/anomalies'}>
                查看详情
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="日均步数"
          value={stats?.avgSteps?.toLocaleString() || 0}
          unit="步"
          icon={Footprints}
          color="blue"
        />
        <StatCard
          title="日均睡眠"
          value={Math.floor((stats?.avgSleep || 0) / 60)}
          unit={`h ${(stats?.avgSleep || 0) % 60}m`}
          icon={Moon}
          color="purple"
          trend={stats?.sleepTrend < 0 ? 'down' : stats?.sleepTrend > 0 ? 'up' : 'stable'}
          trendValue={stats?.sleepTrend ? Math.round(stats.sleepTrend) : 0}
        />
        <StatCard
          title="静息心率"
          value={stats?.avgRestingHR || 0}
          unit="bpm"
          icon={Heart}
          color="red"
        />
        <StatCard
          title="心率变异性"
          value={stats?.avgHRV || 0}
          unit="ms"
          icon={Activity}
          color="green"
        />
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="日均活动能量"
          value={stats?.avgEnergy?.toLocaleString() || 0}
          unit="千卡"
          icon={Flame}
          color="orange"
        />
        <StatCard
          title="运动次数"
          value={stats?.workoutCount || 0}
          unit="次"
          icon={Activity}
          color="teal"
        />
        <StatCard
          title="睡眠债累计"
          value={Math.floor((stats?.totalSleepDebt || 0) / 60)}
          unit="小时"
          icon={Clock}
          color={stats?.totalSleepDebt > 60 ? 'red' : 'purple'}
        />
        <StatCard
          title="异常记录"
          value={activeAnomalies.length}
          unit="个"
          icon={AlertTriangle}
          color={activeAnomalies.length > 0 ? 'orange' : 'blue'}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">睡眠趋势</h3>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={sleepData}
              yKeys={['睡眠时长', '目标']}
              colors={[
                { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.15)' },
                { stroke: '#e5e7eb', fill: 'transparent' },
              ]}
              height={250}
              yAxisLabel="小时"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">静息心率趋势</h3>
          </CardHeader>
          <CardContent>
            <LineChart
              data={hrData}
              yKeys={['静息心率', '正常上限']}
              colors={['#ef4444', '#fca5a5']}
              height={250}
              yAxisLabel="bpm"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">心率变异性</h3>
          </CardHeader>
          <CardContent>
            <LineChart
              data={hrvData}
              yKeys={['心率变异性']}
              colors={['#10b981']}
              height={250}
              yAxisLabel="ms"
              fill
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">每日步数</h3>
          </CardHeader>
          <CardContent>
            <BarChart
              data={stepsData}
              yKeys={['步数']}
              colors={['#3b82f6']}
              height={250}
              yAxisLabel="步"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">活动能量</h3>
          </CardHeader>
          <CardContent>
            <BarChart
              data={energyData}
              yKeys={['活动能量']}
              colors={['#f59e0b']}
              height={250}
              yAxisLabel="千卡"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">心率区间分布</h3>
          </CardHeader>
          <CardContent>
            <DoughnutChart
              data={hrZoneData}
              height={250}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
