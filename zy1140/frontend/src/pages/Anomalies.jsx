import { useEffect, useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  AlertTriangle, 
  Moon, 
  Heart, 
  Activity, 
  CheckCircle,
  X,
  RefreshCw,
  Filter,
  Info
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingOverlay, EmptyState } from '../components/ui/Loading';
import { DateRangePicker } from '../components/ui/DatePicker';
import { Tabs } from '../components/ui/Tabs';
import { Modal } from '../components/ui/Modal';
import { cn } from '../utils/cn';

const severityLabels = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

const typeDescriptions = {
  sleep_deficit: '睡眠不足',
  resting_hr_high: '静息心率偏高',
  resting_hr_low: '静息心率偏低',
  hrv_low: '心率变异性偏低',
  workout_spike: '运动量突增',
  data_missing: '数据缺失',
  steps_low: '活动量过低',
  sleep_debt_accumulated: '睡眠债累积',
  recovery_insufficient: '恢复不足警告',
};

const typeIcons = {
  sleep_deficit: Moon,
  resting_hr_high: Heart,
  resting_hr_low: Heart,
  hrv_low: Heart,
  workout_spike: Activity,
  data_missing: AlertTriangle,
  steps_low: Activity,
  sleep_debt_accumulated: Moon,
  recovery_insufficient: Heart,
};

const typeColors = {
  sleep_deficit: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  resting_hr_high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  resting_hr_low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  hrv_low: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  workout_spike: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  data_missing: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  steps_low: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  sleep_debt_accumulated: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  recovery_insufficient: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const filterTabs = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '活跃' },
  { value: 'dismissed', label: '已忽略' },
];

const Anomalies = () => {
  const { 
    anomalies, 
    anomaliesLoading, 
    anomalyTypes,
    fetchAnomalies,
    fetchAnomalyTypes,
    runAnomalyDetection,
    dismissAnomaly,
  } = useStore();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [filter, setFilter] = useState('active');
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);
  
  const loadData = async () => {
    await Promise.all([
      fetchAnomalies(startDate, endDate, true),
      fetchAnomalyTypes(),
    ]);
  };
  
  const filteredAnomalies = useMemo(() => {
    let list = anomalies || [];
    
    if (filter === 'active') {
      list = list.filter(a => !a.dismissed);
    } else if (filter === 'dismissed') {
      list = list.filter(a => a.dismissed);
    }
    
    return list.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    });
  }, [anomalies, filter]);
  
  const stats = useMemo(() => {
    const list = anomalies || [];
    return {
      total: list.length,
      critical: list.filter(a => a.severity === 'critical' && !a.dismissed).length,
      high: list.filter(a => a.severity === 'high' && !a.dismissed).length,
      medium: list.filter(a => a.severity === 'medium' && !a.dismissed).length,
      low: list.filter(a => a.severity === 'low' && !a.dismissed).length,
    };
  }, [anomalies]);
  
  const handleRunDetection = async () => {
    await runAnomalyDetection(startDate, endDate);
  };
  
  const handleDismiss = async (id) => {
    await dismissAnomaly(id);
  };
  
  const handleAnomalyClick = (anomaly) => {
    setSelectedAnomaly(anomaly);
    setDetailModal(true);
  };
  
  if (anomaliesLoading && (!anomalies || anomalies.length === 0)) {
    return <LoadingOverlay message="加载异常数据..." />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">异常检测</h1>
        <div className="flex items-center gap-3">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <Button onClick={handleRunDetection}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重新检测
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: '总异常', value: stats.total, variant: 'default' },
          { label: '严重', value: stats.critical, variant: 'critical' },
          { label: '高', value: stats.high, variant: 'high' },
          { label: '中', value: stats.medium, variant: 'medium' },
          { label: '低', value: stats.low, variant: 'low' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="text-center">
                <Badge variant={stat.variant} showDot className="mb-2">
                  {stat.label}
                </Badge>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">异常列表</h2>
            <Tabs
              tabs={filterTabs}
              activeTab={filter}
              onChange={setFilter}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredAnomalies.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="暂无异常"
              description={
                filter === 'active' 
                  ? '在所选时间范围内未检测到活跃异常，状态良好！' 
                  : filter === 'dismissed'
                    ? '暂无已忽略的异常记录'
                    : '在所选时间范围内未检测到任何异常'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredAnomalies.map((anomaly) => {
                const Icon = typeIcons[anomaly.type] || AlertTriangle;
                const date = anomaly.date || anomaly.createdAt;
                
                return (
                  <div
                    key={anomaly.id}
                    onClick={() => handleAnomalyClick(anomaly)}
                    className={cn(
                      'flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-colors',
                      anomaly.dismissed
                        ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                    )}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={cn(
                        'p-2 rounded-lg flex-shrink-0',
                        typeColors[anomaly.type] || 'bg-gray-100 text-gray-700'
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {anomaly.description || typeDescriptions[anomaly.type] || anomaly.type}
                          </h3>
                          <Badge variant={anomaly.severity} showDot>
                            {severityLabels[anomaly.severity] || anomaly.severity}
                          </Badge>
                          {anomaly.dismissed && (
                            <Badge variant="default">已忽略</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {anomaly.explanation || anomaly.message || '点击查看详情'}
                        </p>
                        {date && (
                          <p className="text-xs text-gray-400 mt-1">
                            {format(parseISO(date), 'yyyy年MM月dd日')}
                          </p>
                        )}
                      </div>
                    </div>
                    {!anomaly.dismissed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(anomaly.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title="忽略此异常"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">异常类型说明</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(typeDescriptions).map(([type, desc]) => {
              const Icon = typeIcons[type] || AlertTriangle;
              const typeInfo = (anomalyTypes || []).find(t => t.type === type) || {};
              
              return (
                <div 
                  key={type} 
                  className={cn(
                    'p-4 rounded-lg border',
                    'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      typeColors[type] || 'bg-gray-100 text-gray-700'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {typeInfo.name || desc}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {typeInfo.description || `检测类型: ${type}`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {selectedAnomaly && (
        <Modal
          isOpen={detailModal}
          onClose={() => setDetailModal(false)}
          title="异常详情"
          size="default"
          footer={
            <div className="flex justify-end gap-2">
              {!selectedAnomaly.dismissed && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleDismiss(selectedAnomaly.id);
                    setDetailModal(false);
                  }}
                >
                  忽略此异常
                </Button>
              )}
              <Button onClick={() => setDetailModal(false)}>
                关闭
              </Button>
            </div>
          }
        >
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-3 rounded-xl',
                typeColors[selectedAnomaly.type] || 'bg-gray-100 text-gray-700'
              )}>
                {(typeIcons[selectedAnomaly.type] || AlertTriangle)({ className: 'w-6 h-6' })}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {selectedAnomaly.description || typeDescriptions[selectedAnomaly.type]}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedAnomaly.severity} showDot>
                    {severityLabels[selectedAnomaly.severity] || selectedAnomaly.severity}
                  </Badge>
                  {selectedAnomaly.date && (
                    <span className="text-sm text-gray-500">
                      {format(parseISO(selectedAnomaly.date), 'yyyy年MM月dd日')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {selectedAnomaly.explanation && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">说明</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedAnomaly.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">关联数据</h4>
              <div className="grid grid-cols-2 gap-3">
                {selectedAnomaly.value !== undefined && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">检测值</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedAnomaly.value}
                      {selectedAnomaly.unit && <span className="text-sm font-normal text-gray-500"> {selectedAnomaly.unit}</span>}
                    </p>
                  </div>
                )}
                {selectedAnomaly.threshold !== undefined && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">阈值</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedAnomaly.threshold}
                      {selectedAnomaly.unit && <span className="text-sm font-normal text-gray-500"> {selectedAnomaly.unit}</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {selectedAnomaly.relatedDays && selectedAnomaly.relatedDays.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">关联日期</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAnomaly.relatedDays.map((day, i) => (
                    <Badge key={i} variant="default">
                      {day}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p>类型代码: {selectedAnomaly.type}</p>
              {selectedAnomaly.source && <p>数据源: {selectedAnomaly.source}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Anomalies;
