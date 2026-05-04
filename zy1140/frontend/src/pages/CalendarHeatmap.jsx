import { useEffect, useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Activity,
  Footprints,
  Moon,
  Heart,
  TrendingUp
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Badge, Tag } from '../components/ui/Badge';
import { LoadingOverlay, EmptyState } from '../components/ui/Loading';
import { Modal } from '../components/ui/Modal';
import { Textarea, Input } from '../components/ui/Input';
import { cn } from '../utils/cn';
import { LineChart } from '../components/charts';

const heatmapMetrics = [
  { value: 'stepsTotal', label: '步数', icon: Footprints },
  { value: 'sleepMinutes', label: '睡眠', icon: Moon },
  { value: 'restingHR', label: '静息心率', icon: Heart },
  { value: 'energyBurned', label: '活动能量', icon: TrendingUp },
  { value: 'workoutMinutes', label: '运动时长', icon: Activity },
];

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarHeatmap = () => {
  const { 
    calendarHeatmap, 
    fetchCalendarHeatmap,
    notes,
    fetchNotes,
    saveNote,
  } = useStore();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedMetric, setSelectedMetric] = useState('stepsTotal');
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetailModal, setDayDetailModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadData();
  }, [currentMonth, selectedMetric]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      await Promise.all([
        fetchCalendarHeatmap(start, end, selectedMetric),
        fetchNotes(start, end),
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const paddedDays = [];
    for (let i = 0; i < startDay; i++) {
      paddedDays.push({ date: null, isPadding: true });
    }
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = calendarHeatmap?.find(d => d.date === dateStr);
      const dayNote = notes?.[dateStr];
      
      paddedDays.push({
        date: day,
        dateStr,
        isPadding: false,
        isCurrentMonth: isSameMonth(day, currentMonth),
        isToday: isSameDay(day, new Date()),
        value: dayData?.value || dayData?.[selectedMetric] || 0,
        dayOfWeek: getDay(day),
        data: dayData,
        note: dayNote,
      });
    });
    
    return paddedDays;
  }, [currentMonth, calendarHeatmap, notes, selectedMetric]);
  
  const getHeatmapColor = (value, maxValue) => {
    if (!value || value === 0) return 'bg-gray-100 dark:bg-gray-800';
    
    const ratio = maxValue > 0 ? value / maxValue : 0;
    
    if (selectedMetric === 'restingHR') {
      if (value < 60) return 'bg-green-200 dark:bg-green-900/40';
      if (value < 70) return 'bg-green-100 dark:bg-green-900/30';
      if (value < 80) return 'bg-yellow-200 dark:bg-yellow-900/40';
      return 'bg-red-200 dark:bg-red-900/40';
    }
    
    if (selectedMetric === 'sleepMinutes') {
      const hours = value / 60;
      if (hours >= 7) return 'bg-green-200 dark:bg-green-900/40';
      if (hours >= 6) return 'bg-yellow-200 dark:bg-yellow-900/40';
      if (hours >= 5) return 'bg-orange-200 dark:bg-orange-900/40';
      return 'bg-red-200 dark:bg-red-900/40';
    }
    
    if (ratio > 0.8) return 'bg-green-400 dark:bg-green-600';
    if (ratio > 0.6) return 'bg-green-300 dark:bg-green-700';
    if (ratio > 0.4) return 'bg-green-200 dark:bg-green-800';
    if (ratio > 0.2) return 'bg-green-100 dark:bg-green-900/50';
    return 'bg-gray-100 dark:bg-gray-800';
  };
  
  const maxValue = useMemo(() => {
    const values = calendarDays
      .filter(d => !d.isPadding && d.value > 0)
      .map(d => d.value);
    return values.length > 0 ? Math.max(...values) : 10000;
  }, [calendarDays]);
  
  const handleDayClick = (day) => {
    if (day.isPadding) return;
    setSelectedDate(day);
    setNoteText(day.note?.text || '');
    setNoteTags(day.note?.tags || []);
    setDayDetailModal(true);
  };
  
  const handleSaveNote = async () => {
    if (!selectedDate) return;
    try {
      await saveNote(selectedDate.dateStr, {
        text: noteText,
        tags: noteTags,
      });
      await loadData();
      setDayDetailModal(false);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };
  
  const tagOptions = [
    { label: '熬夜', value: 'stay_up', variant: 'sleep' },
    { label: '喝酒', value: 'alcohol', variant: 'alcohol' },
    { label: '出差', value: 'travel', variant: 'travel' },
    { label: '生病', value: 'sick', variant: 'sick' },
    { label: '压力大', value: 'stress', variant: 'stress' },
    { label: '咖啡', value: 'coffee', variant: 'coffee' },
  ];
  
  const toggleTag = (tagValue) => {
    setNoteTags(prev => 
      prev.includes(tagValue)
        ? prev.filter(t => t !== tagValue)
        : [...prev, tagValue]
    );
  };
  
  if (loading && !calendarHeatmap) {
    return <LoadingOverlay message="加载日历数据..." />;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">日历热力图</h1>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[120px] text-center">
                {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                今天
              </Button>
            </div>
            <Tabs
              tabs={heatmapMetrics.map(m => ({
                value: m.value,
                label: m.label,
                icon: <m.icon className="w-4 h-4" />,
              }))}
              activeTab={selectedMetric}
              onChange={setSelectedMetric}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDays.map(day => (
              <div 
                key={day} 
                className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
              >
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, index) => (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'aspect-square rounded-lg cursor-pointer transition-all',
                  'flex flex-col items-center justify-center gap-0.5',
                  day.isPadding
                    ? 'bg-transparent cursor-default'
                    : cn(
                        getHeatmapColor(day.value, maxValue),
                        'hover:ring-2 hover:ring-blue-500',
                        day.isToday && 'ring-2 ring-blue-500 ring-offset-2'
                      )
                )}
              >
                {!day.isPadding && (
                  <>
                    <span className={cn(
                      'text-xs font-medium',
                      day.isToday 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {format(day.date, 'd')}
                    </span>
                    {day.note && (
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-500">
            <span>少</span>
            {[0.2, 0.4, 0.6, 0.8, 1].map((ratio, i) => (
              <div
                key={i}
                className={cn(
                  'w-5 h-5 rounded',
                  ratio > 0.8 ? 'bg-green-400 dark:bg-green-600' :
                  ratio > 0.6 ? 'bg-green-300 dark:bg-green-700' :
                  ratio > 0.4 ? 'bg-green-200 dark:bg-green-800' :
                  ratio > 0.2 ? 'bg-green-100 dark:bg-green-900/50' :
                  'bg-gray-100 dark:bg-gray-800'
                )}
              />
            ))}
            <span>多</span>
          </div>
        </CardContent>
      </Card>
      
      {selectedDate && (
        <Modal
          isOpen={dayDetailModal}
          onClose={() => setDayDetailModal(false)}
          title={format(selectedDate.date, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDayDetailModal(false)}>
                取消
              </Button>
              <Button onClick={handleSaveNote}>
                保存备注
              </Button>
            </div>
          }
        >
          <div className="space-y-6 p-6">
            {selectedDate.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: '步数', value: selectedDate.data.stepsTotal || selectedDate.data.value, unit: '步' },
                  { label: '睡眠', value: selectedDate.data.sleepMinutes ? Math.round(selectedDate.data.sleepMinutes / 60 * 10) / 10 : 0, unit: 'h' },
                  { label: '静息心率', value: selectedDate.data.restingHR || 0, unit: 'bpm' },
                  { label: '活动能量', value: selectedDate.data.energyBurned || 0, unit: '千卡' },
                ].map((stat, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {stat.value} <span className="text-sm font-normal text-gray-500">{stat.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">每日备注</h3>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">标签</p>
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map(tag => (
                    <button
                      key={tag.value}
                      onClick={() => toggleTag(tag.value)}
                      className={cn(
                        'px-3 py-1 rounded-full text-sm transition-colors',
                        noteTags.includes(tag.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <Textarea
                label="备注内容"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="记录这一天的状态、感受或其他影响因素..."
                rows={4}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalendarHeatmap;
