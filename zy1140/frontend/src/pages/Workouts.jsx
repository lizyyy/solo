import { useEffect, useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Activity, 
  MapPin, 
  Clock, 
  Flame, 
  TrendingUp,
  Heart,
  Footprints,
  ChevronRight,
  Filter
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Tag } from '../components/ui/Badge';
import { LoadingOverlay, EmptyState } from '../components/ui/Loading';
import { Modal } from '../components/ui/Modal';
import { DateRangePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Input';
import { LineChart } from '../components/charts';
import { cn } from '../utils/cn';

const workoutTypeNames = {
  'running': '跑步',
  'cycling': '骑行',
  'walking': '步行',
  'swimming': '游泳',
  'hiking': '徒步',
  'yoga': '瑜伽',
  'strengthTraining': '力量训练',
  'other': '其他',
};

const workoutTypeColors = {
  'running': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'cycling': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'walking': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'swimming': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'hiking': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'yoga': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'strengthTraining': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'other': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const workoutTypeIcons = {
  'running': Activity,
  'cycling': Activity,
  'walking': Footprints,
  'swimming': Activity,
  'hiking': MapPin,
  'yoga': Activity,
  'strengthTraining': Activity,
  'other': Activity,
};

const Workouts = () => {
  const { 
    workouts, 
    workoutsLoading, 
    fetchWorkouts,
  } = useStore();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [workoutType, setWorkoutType] = useState('all');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  
  useEffect(() => {
    fetchWorkouts(startDate, endDate, workoutType === 'all' ? null : workoutType);
  }, [startDate, endDate, workoutType]);
  
  const workoutStats = useMemo(() => {
    const list = workouts || [];
    const totalDuration = list.reduce((sum, w) => sum + (w.duration || w.totalDuration || 0), 0);
    const totalDistance = list.reduce((sum, w) => sum + (w.distance || w.totalDistance || 0), 0);
    const totalEnergy = list.reduce((sum, w) => sum + (w.energyBurned || w.totalEnergyBurned || 0), 0);
    
    return {
      count: list.length,
      totalDuration: Math.round(totalDuration / 60),
      totalDistance: Math.round(totalDistance),
      totalEnergy: Math.round(totalEnergy),
      avgDuration: list.length > 0 ? Math.round(totalDuration / list.length / 60) : 0,
    };
  }, [workouts]);
  
  const typeOptions = [
    { value: 'all', label: '全部类型' },
    ...Object.entries(workoutTypeNames).map(([value, label]) => ({ value, label })),
  ];
  
  const formatDuration = (minutes) => {
    if (!minutes) return '0分钟';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
  const handleWorkoutClick = (workout) => {
    setSelectedWorkout(workout);
    setDetailModal(true);
  };
  
  const getWorkoutType = (workout) => {
    const type = workout.type || workout.workoutActivityType || 'other';
    return workoutTypeNames[type] || type;
  };
  
  const getWorkoutTypeColor = (workout) => {
    const type = workout.type || workout.workoutActivityType || 'other';
    return workoutTypeColors[type] || workoutTypeColors['other'];
  };
  
  if (workoutsLoading && (!workouts || workouts.length === 0)) {
    return <LoadingOverlay message="加载运动数据..." />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">运动详情</h1>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: '运动次数', value: workoutStats.count, unit: '次', icon: Activity, color: 'blue' },
          { label: '总时长', value: formatDuration(workoutStats.totalDuration), icon: Clock, color: 'green' },
          { label: '总距离', value: workoutStats.totalDistance, unit: 'km', icon: TrendingUp, color: 'purple' },
          { label: '总能量', value: workoutStats.totalEnergy, unit: '千卡', icon: Flame, color: 'orange' },
          { label: '平均时长', value: formatDuration(workoutStats.avgDuration), icon: Clock, color: 'teal' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <stat.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stat.value}
                    {stat.unit && <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">运动列表</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={workoutType}
                onChange={setWorkoutType}
                options={typeOptions}
                className="w-40"
              />
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
                quickRanges={false}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(!workouts || workouts.length === 0) ? (
            <EmptyState
              icon={Activity}
              title="暂无运动数据"
              description="导入 Apple Health 数据后可查看运动记录详情"
            />
          ) : (
            <div className="space-y-3">
              {workouts.map((workout, index) => {
                const Icon = workoutTypeIcons[workout.type] || Activity;
                const date = workout.startDate || workout.createdAt;
                const parsedDate = date ? parseISO(date) : new Date();
                
                return (
                  <div
                    key={workout.id || index}
                    onClick={() => handleWorkoutClick(workout)}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('p-3 rounded-xl', getWorkoutTypeColor(workout))}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {getWorkoutType(workout)}
                          </h3>
                          <Badge className={getWorkoutTypeColor(workout)}>
                            {getWorkoutType(workout)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(parsedDate, 'yyyy年MM月dd日 HH:mm')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:flex items-center gap-4">
                        {workout.duration > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatDuration(workout.duration / 60)}
                            </p>
                            <p className="text-xs text-gray-500">时长</p>
                          </div>
                        )}
                        {workout.distance > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {workout.distance.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">km</p>
                          </div>
                        )}
                        {workout.energyBurned > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {Math.round(workout.energyBurned)}
                            </p>
                            <p className="text-xs text-gray-500">千卡</p>
                          </div>
                        )}
                        {workout.avgHeartRate > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {Math.round(workout.avgHeartRate)}
                            </p>
                            <p className="text-xs text-gray-500">bpm</p>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedWorkout && (
        <Modal
          isOpen={detailModal}
          onClose={() => setDetailModal(false)}
          title="运动详情"
          size="lg"
        >
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '时长', value: formatDuration((selectedWorkout.duration || 0) / 60), icon: Clock },
                { label: '距离', value: selectedWorkout.distance ? `${selectedWorkout.distance.toFixed(2)} km` : '-', icon: TrendingUp },
                { label: '能量消耗', value: selectedWorkout.energyBurned ? `${Math.round(selectedWorkout.energyBurned)} 千卡` : '-', icon: Flame },
                { label: '平均心率', value: selectedWorkout.avgHeartRate ? `${Math.round(selectedWorkout.avgHeartRate)} bpm` : '-', icon: Heart },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <stat.icon className="w-5 h-5 text-gray-400 mb-2" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
            
            {selectedWorkout.maxHeartRate > 0 || selectedWorkout.avgPace > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {selectedWorkout.maxHeartRate > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">最高心率</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {Math.round(selectedWorkout.maxHeartRate)} <span className="text-sm font-normal">bpm</span>
                    </p>
                  </div>
                )}
                {selectedWorkout.avgPace > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">平均配速</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedWorkout.avgPace.toFixed(2)} <span className="text-sm font-normal">min/km</span>
                    </p>
                  </div>
                )}
              </div>
            ) : null}
            
            {selectedWorkout.routePoints && selectedWorkout.routePoints.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-medium text-gray-900 dark:text-white">路线数据</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">记录点数量</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedWorkout.routePoints.length} 个
                        </p>
                      </div>
                      {selectedWorkout.totalElevationGain > 0 && (
                        <div>
                          <p className="text-gray-500">累计爬升</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedWorkout.totalElevationGain.toFixed(1)} m
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {selectedWorkout.heartRateSamples && selectedWorkout.heartRateSamples.length > 1 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">心率变化</p>
                        <div className="h-40">
                          <LineChart
                            data={selectedWorkout.heartRateSamples.map((hr, i) => ({
                              index: i,
                              心率: hr,
                            }))}
                            xKey="index"
                            yKeys={['心率']}
                            colors={['#ef4444']}
                            height={160}
                            smooth
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="text-sm text-gray-500">
              <p>开始时间: {selectedWorkout.startDate ? format(parseISO(selectedWorkout.startDate), 'yyyy年MM月dd日 HH:mm:ss') : '-'}</p>
              <p>结束时间: {selectedWorkout.endDate ? format(parseISO(selectedWorkout.endDate), 'yyyy年MM月dd日 HH:mm:ss') : '-'}</p>
              {selectedWorkout.device && <p>设备: {selectedWorkout.device}</p>}
              {selectedWorkout.sourceName && <p>来源: {selectedWorkout.sourceName}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Workouts;
