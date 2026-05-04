import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  Download, 
  FileJson, 
  FileSpreadsheet,
  FileCode,
  Globe,
  CheckCircle,
  AlertTriangle,
  Info,
  Moon,
  Heart,
  Footprints,
  Activity
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
import { LineChart, BarChart, DoughnutChart } from '../components/charts';

const formats = [
  { value: 'json', label: 'JSON', icon: FileJson, desc: '完整数据导出，适合二次开发' },
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, desc: '表格格式，可用 Excel 打开' },
  { value: 'markdown', label: 'Markdown', icon: FileText, desc: '纯文本格式，便于分享' },
  { value: 'html', label: 'HTML', icon: Globe, desc: '网页格式，含图表展示' },
];

const includeOptions = [
  { value: 'summary', label: '数据摘要', icon: Info, defaultChecked: true },
  { value: 'metrics', label: '指标趋势', icon: TrendingUp, defaultChecked: true },
  { value: 'anomalies', label: '异常检测', icon: AlertTriangle, defaultChecked: true },
  { value: 'workouts', label: '运动记录', icon: Activity, defaultChecked: true },
  { value: 'notes', label: '每日备注', icon: FileText, defaultChecked: true },
];

const Report = () => {
  const { 
    summaryData, 
    anomalies, 
    workouts,
    notes,
    summaryLoading,
    fetchSummary,
    fetchAnomalies,
    fetchWorkouts,
    fetchNotes,
    downloadReport,
    showNotification,
  } = useStore();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [includeItems, setIncludeItems] = useState(
    includeOptions.filter(o => o.defaultChecked).map(o => o.value)
  );
  const [generating, setGenerating] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  const handleToggleInclude = (value) => {
    setIncludeItems(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };
  
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetchSummary(startDate, endDate);
      await fetchAnomalies(startDate, endDate);
      await fetchWorkouts(startDate, endDate);
      await fetchNotes(startDate, endDate);
      showNotification('报告数据已生成', 'success');
    } finally {
      setGenerating(false);
    }
  };
  
  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadReport(startDate, endDate, selectedFormat);
    } finally {
      setGenerating(false);
    }
  };
  
  const handlePreview = async () => {
    setGenerating(true);
    try {
      await fetchSummary(startDate, endDate);
      await fetchAnomalies(startDate, endDate);
      await fetchWorkouts(startDate, endDate);
      await fetchNotes(startDate, endDate);
      setPreviewModal(true);
    } finally {
      setGenerating(false);
    }
  };
  
  const activeAnomalies = useMemo(() => 
    (anomalies || []).filter(a => !a.dismissed),
    [anomalies]
  );
  
  const reportStats = useMemo(() => {
    const overview = summaryData?.overview || {};
    const summaries = summaryData?.dailySummaries || [];
    
    return {
      totalDays: overview.daysWithData || 0,
      daysWithSleep: overview.daysWithSleep || 0,
      avgSteps: overview.stepsTotal > 0 && overview.daysWithData > 0 
        ? Math.round(overview.stepsTotal / overview.daysWithData) 
        : 0,
      avgSleepHours: overview.totalSleepMinutes > 0 && overview.daysWithSleep > 0 
        ? Math.round(overview.totalSleepMinutes / overview.daysWithSleep / 60 * 10) / 10
        : 0,
      avgRestingHR: overview.avgRestingHR || 0,
      avgHRV: overview.avgHRV || 0,
      totalEnergy: overview.totalEnergyBurned || 0,
      workoutCount: overview.workoutCount || 0,
      anomaliesCount: activeAnomalies.length,
      criticalAnomalies: activeAnomalies.filter(a => a.severity === 'critical').length,
      notesCount: Object.keys(notes || {}).length,
    };
  }, [summaryData, activeAnomalies, notes]);
  
  const trendData = useMemo(() => {
    const summaries = summaryData?.dailySummaries || [];
    return summaries
      .filter(d => d.date)
      .slice(-14)
      .map(d => ({
        date: d.date,
        睡眠时长: d.sleepMinutes ? Math.round(d.sleepMinutes / 60 * 10) / 10 : 0,
        静息心率: d.restingHR || 0,
        步数: d.stepsTotal || 0,
      }));
  }, [summaryData]);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">报告导出</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">报告范围</h2>
            </CardHeader>
            <CardContent>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
              />
              
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  包含内容
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {includeOptions.map((option) => {
                    const Icon = option.icon;
                    const isChecked = includeItems.includes(option.value);
                    
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleToggleInclude(option.value)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg border text-left transition-colors',
                          isChecked
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <Icon className={cn(
                          'w-4 h-4 flex-shrink-0',
                          isChecked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                        )} />
                        <span className={cn(
                          'text-sm font-medium',
                          isChecked ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                        )}>
                          {option.label}
                        </span>
                        {isChecked && (
                          <CheckCircle className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">报告预览</h2>
                <Button variant="outline" size="sm" onClick={handlePreview} loading={generating}>
                  刷新预览
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <LoadingOverlay message="加载报告数据..." />
              ) : !summaryData ? (
                <EmptyState
                  icon={FileText}
                  title="暂无预览数据"
                  description="选择日期范围并点击'刷新预览'加载报告数据"
                />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: '统计天数', value: reportStats.totalDays, icon: Info },
                      { label: '平均睡眠', value: `${reportStats.avgSleepHours}h`, icon: Moon },
                      { label: '异常数量', value: reportStats.anomaliesCount, icon: AlertTriangle, variant: reportStats.criticalAnomalies > 0 ? 'critical' : 'default' },
                      { label: '运动次数', value: reportStats.workoutCount, icon: Activity },
                    ].map((stat, i) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <stat.icon className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">{stat.label}</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {trendData.length > 0 && includeItems.includes('metrics') && (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3">睡眠趋势（近14天）</h3>
                      <div className="h-48">
                        <LineChart
                          data={trendData}
                          yKeys={['睡眠时长']}
                          colors={['#8b5cf6']}
                          height={192}
                          smooth
                          fill
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeAnomalies.length > 0 && includeItems.includes('anomalies') && (
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3">活跃异常</h3>
                      <div className="space-y-2">
                        {activeAnomalies.slice(0, 5).map((anomaly, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {anomaly.description || anomaly.type}
                                </p>
                                <p className="text-xs text-gray-500">{anomaly.date}</p>
                              </div>
                            </div>
                            <Badge variant={anomaly.severity} showDot>
                              {anomaly.severity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">导出格式</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {formats.map((format) => {
                  const Icon = format.icon;
                  const isSelected = selectedFormat === format.value;
                  
                  return (
                    <button
                      key={format.value}
                      onClick={() => setSelectedFormat(format.value)}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-opacity-50'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-800'
                          : 'bg-gray-100 dark:bg-gray-700'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                        )} />
                      </div>
                      <div className="flex-1">
                        <h4 className={cn(
                          'font-medium',
                          isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                        )}>
                          {format.label}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {format.desc}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={handleDownload}
                  loading={generating}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出报告
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handlePreview}
                  loading={generating}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  预览完整报告
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="font-medium text-gray-900 dark:text-white">报告信息</h3>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">时间范围</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {startDate} ~ {endDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">导出格式</span>
                <span className="text-gray-900 dark:text-white font-medium uppercase">
                  {selectedFormat}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">包含模块</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {includeItems.length} 个
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {previewModal && (
        <Modal
          isOpen={previewModal}
          onClose={() => setPreviewModal(false)}
          title={`健康报告 - ${startDate} 至 ${endDate}`}
          size="xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewModal(false)}>
                关闭
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                下载报告
              </Button>
            </div>
          }
        >
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="text-center mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                健康数据复盘报告
              </h1>
              <p className="text-gray-500">
                {startDate} 至 {endDate}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                生成时间: {format(new Date(), 'yyyy年MM月dd日 HH:mm')}
              </p>
            </div>
            
            <div className="space-y-8">
              {includeItems.includes('summary') && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    一、数据摘要
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: '统计天数', value: reportStats.totalDays, unit: '天' },
                      { label: '有睡眠记录', value: reportStats.daysWithSleep, unit: '天' },
                      { label: '日均步数', value: reportStats.avgSteps.toLocaleString(), unit: '步' },
                      { label: '日均睡眠', value: reportStats.avgSleepHours, unit: '小时' },
                      { label: '平均静息心率', value: reportStats.avgRestingHR, unit: 'bpm' },
                      { label: '平均 HRV', value: reportStats.avgHRV, unit: 'ms' },
                      { label: '总活动能量', value: reportStats.totalEnergy.toLocaleString(), unit: '千卡' },
                      { label: '运动次数', value: reportStats.workoutCount, unit: '次' },
                    ].map((item, i) => (
                      <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm text-gray-500">{item.label}</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {item.value}
                          <span className="text-sm font-normal text-gray-500 ml-1">{item.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              {includeItems.includes('anomalies') && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    二、异常检测
                  </h2>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="critical" showDot>
                      严重: {reportStats.criticalAnomalies}
                    </Badge>
                    <Badge variant="high" showDot>
                      高: {activeAnomalies.filter(a => a.severity === 'high').length}
                    </Badge>
                    <Badge variant="medium" showDot>
                      中: {activeAnomalies.filter(a => a.severity === 'medium').length}
                    </Badge>
                    <Badge variant="low" showDot>
                      低: {activeAnomalies.filter(a => a.severity === 'low').length}
                    </Badge>
                  </div>
                  
                  {activeAnomalies.length === 0 ? (
                    <div className="p-8 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700 dark:text-green-300 font-medium">
                        在此时间段内未检测到活跃异常
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeAnomalies.map((anomaly, i) => (
                        <div key={i} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {anomaly.description || anomaly.type}
                                </h4>
                                <Badge variant={anomaly.severity} showDot>
                                  {anomaly.severity}
                                </Badge>
                              </div>
                              {anomaly.explanation && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {anomaly.explanation}
                                </p>
                              )}
                            </div>
                            <span className="text-sm text-gray-500 whitespace-nowrap">
                              {anomaly.date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              
              {includeItems.includes('workouts') && (workouts || []).length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    三、运动记录
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">日期</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">类型</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">时长</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">距离</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-500">能量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(workouts || []).slice(0, 10).map((workout, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {workout.startDate ? format(new Date(workout.startDate), 'yyyy-MM-dd') : '-'}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {workout.type || workout.workoutActivityType || '运动'}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {workout.duration ? `${Math.round(workout.duration / 60)}m` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {workout.distance ? `${workout.distance.toFixed(2)} km` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                              {workout.energyBurned ? `${Math.round(workout.energyBurned)} kcal` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(workouts || []).length > 10 && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        ... 还有 {(workouts || []).length - 10} 条运动记录
                      </p>
                    )}
                  </div>
                </section>
              )}
              
              {includeItems.includes('notes') && Object.keys(notes || {}).length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    四、每日备注
                  </h2>
                  <div className="space-y-3">
                    {Object.entries(notes || {}).slice(0, 10).map(([date, note]) => (
                      <div key={date} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">{date}</span>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex gap-1">
                              {note.tags.map((tag, i) => (
                                <Badge key={i} variant="default">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {note.text && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{note.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  此报告由 Apple Health 健康复盘工具生成 • 仅供数据复盘参考，非医疗诊断
                </p>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Report;
