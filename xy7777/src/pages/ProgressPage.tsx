import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Trophy, Flame, Star, Clock, CheckCircle, TrendingUp, 
  Award, Target, Calendar as CalendarIcon, Smile, Meh, Frown, 
  Laugh, ChevronRight, X, Edit3
} from 'lucide-react';
import { Header } from '../components/Layout';
import { getTasksByPosition, getTasksByWeek } from '../data/tasks';
import { getSkillsByPosition } from '../data/skills';
import { getPositionById } from '../data/positions';
import { useApp } from '../context/AppContext';
import { DailyCheckIn } from '../types';

const weekDayNames = ['日', '一', '二', '三', '四', '五', '六'];

const moodIcons: Record<string, React.ReactNode> = {
  great: <Laugh className="w-5 h-5" />,
  good: <Smile className="w-5 h-5" />,
  neutral: <Meh className="w-5 h-5" />,
  bad: <Frown className="w-5 h-5" />,
};

const moodColors: Record<string, string> = {
  great: 'text-green-500',
  good: 'text-blue-500',
  neutral: 'text-yellow-500',
  bad: 'text-red-500',
};

const moodLabels: Record<string, string> = {
  great: '很棒',
  good: '不错',
  neutral: '一般',
  bad: '不好',
};

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    selectedPosition, 
    isPositionSelected, 
    userProgress, 
    getOverallProgress,
    getWeeklyProgress,
    getTaskProgress,
    addDailyCheckIn
  } = useApp();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInMood, setCheckInMood] = useState<DailyCheckIn['mood']>('good');
  const [checkInMinutes, setCheckInMinutes] = useState(0);
  const [checkInNotes, setCheckInNotes] = useState('');

  if (!isPositionSelected || !selectedPosition) {
    navigate('/');
    return null;
  }

  const position = getPositionById(selectedPosition);
  const overallProgress = getOverallProgress();
  const allTasks = getTasksByPosition(selectedPosition);
  const allSkills = getSkillsByPosition(selectedPosition);

  const completedTasks = allTasks.filter(t => {
    const progress = getTaskProgress(t.id);
    return progress?.status === 'completed';
  }).length;

  const totalMinutes = userProgress?.dailyCheckIns.reduce((sum, c) => sum + (c.studyMinutes || 0), 0) || 0;

  const today = new Date();
  const currentWeek = userProgress?.currentWeek || 1;
  const weeklyProgress = getWeeklyProgress(currentWeek);

  const getTodayCheckIn = () => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return userProgress?.dailyCheckIns.find(c => c.date === todayStr);
  };

  const todayCheckIn = getTodayCheckIn();

  const handleSubmitCheckIn = () => {
    addDailyCheckIn({
      checkedIn: true,
      mood: checkInMood,
      studyMinutes: checkInMinutes,
      notes: checkInNotes,
      completedTaskIds: [],
    });
    setShowCheckIn(false);
    setCheckInNotes('');
  };

  const CheckInModal: React.FC = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-dark">今日打卡</h3>
          <button
            onClick={() => setShowCheckIn(false)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-3">今天学习状态如何？</p>
          <div className="flex justify-around">
            {(['great', 'good', 'neutral', 'bad'] as const).map((mood) => (
            <button
              key={mood}
              onClick={() => setCheckInMood(mood)}
              className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                checkInMood === mood
                  ? 'bg-primary/10 ring-2 ring-primary/30'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className={moodColors[mood]}>
                {moodIcons[mood]}
              </div>
              <span className="text-xs text-gray-600 mt-1">{moodLabels[mood]}</span>
            </button>
          ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">今天学习了多久？</p>
          <div className="flex gap-2">
            {[30, 60, 90, 120].map((mins) => (
            <button
              key={mins}
              onClick={() => setCheckInMinutes(mins)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                checkInMinutes === mins
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mins}分钟
            </button>
          ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">学习笔记（可选）</p>
          <textarea
            value={checkInNotes}
            onChange={(e) => setCheckInNotes(e.target.value)}
            placeholder="记录今天的学习收获..."
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            rows={3}
          />
        </div>

        <button
          onClick={handleSubmitCheckIn}
          className="w-full btn-primary"
        >
          完成打卡
        </button>
      </div>
    </div>
  );

  const StreakSection: React.FC = () => {
    const checkIns = userProgress?.dailyCheckIns || [];
    const checkedInDates = new Set(checkIns.filter(c => c.checkedIn).map(c => c.date));
    
    let streak = 0;
    const checkDate = new Date();
    
    for (let i = 0; i < 365; i++) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (checkedInDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return (
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center py-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-dark">{streak}</div>
          <div className="text-xs text-gray-500">连续打卡</div>
        </div>
        <div className="card text-center py-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-dark">{completedTasks}</div>
          <div className="text-xs text-gray-500">完成任务</div>
        </div>
        <div className="card text-center py-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-dark">{totalMinutes}</div>
          <div className="text-xs text-gray-500">学习分钟</div>
        </div>
      </div>
    );
  };

  const CalendarHeatmap: React.FC = () => {
    const checkIns = userProgress?.dailyCheckIns || [];
    const checkedInMap = new Map<string, DailyCheckIn>(
      checkIns
        .filter(c => c.checkedIn)
        .map(c => [c.date, c] as [string, DailyCheckIn])
    );

    const weeks: (Date | null)[][] = [];
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDay = startDate.getDay();
    
    for (let i = 0; i < startDay; i++) {
      if (weeks.length === 0) weeks.push([]);
      weeks[0].push(null);
    }

    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      const weekIndex = Math.floor((startDay + d - 1) / 7);
      if (!weeks[weekIndex]) weeks.push([]);
      weeks[weekIndex].push(date);
    }

    const getDateStr = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const isToday = (date: Date) => {
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    };

    return (
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-dark flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            学习日历
          </h3>
          <span className="text-sm text-gray-400">
            {today.getMonth() + 1}月
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDayNames.map((day) => (
            <div key={day} className="text-center text-xs text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((date, dayIndex) => {
              if (!date) {
                return <div key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square" />;
              }

              const dateStr = getDateStr(date);
              const checkIn = checkedInMap.get(dateStr);
              const checked = checkIn?.checkedIn;
              const todayFlag = isToday(date);

              return (
                <div
                  key={dateStr}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                    checked
                      ? 'bg-primary/20 text-primary'
                      : todayFlag
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  {date.getDate()}
                </div>
              );
            })}
          </div>
        ))}

        <div className="flex items-center justify-end gap-4 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-50" />
            <span>未学习</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary/20" />
            <span>已学习</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>今天</span>
          </div>
        </div>
      </div>
    );
  };

  const SkillsProgress: React.FC = () => {
    return (
      <div className="card mb-6">
        <h3 className="font-medium text-dark mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          技能进度
        </h3>

        <div className="space-y-4">
          {allSkills.slice(0, 5).map((skill, index) => {
            const tasks = getTasksByPosition(selectedPosition).filter(t => t.skillId === skill.id);
            const completedTasks = tasks.filter(t => {
              const progress = getTaskProgress(t.id);
              return progress?.status === 'completed';
            }).length;
            const percentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

            return (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{skill.name}</span>
                  <span className="text-xs text-gray-400">{completedTasks}/{tasks.length}</span>
                </div>
                <div className="progress-bar h-1.5">
                  <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="学习进度"
        subtitle={position?.name}
      />

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="card mb-6 bg-gradient-to-r from-primary to-secondary text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold mb-1">任务完成进度</h3>
              <p className="text-white/80 text-sm">{position?.name}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{overallProgress}%</div>
              <div className="text-white/80 text-xs">
                {completedTasks}/{allTasks.length} 任务
              </div>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-white/70 text-xs mt-2">
            💡 完成学习任务后进度会增加。去"任务"页面开始学习吧！
          </p>
        </div>

        {todayCheckIn ? (
          <div className="card mb-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-green-700">今日已打卡 ✨</h4>
                <p className="text-sm text-green-600">
                  学习了 {todayCheckIn.studyMinutes} 分钟，状态：{moodLabels[todayCheckIn.mood]}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-100">
              <p className="text-xs text-green-600">
                📝 打卡记录学习状态，不会直接影响任务进度。继续完成任务来提升进度吧！
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCheckIn(true)}
            className="w-full card mb-6 border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <div className="flex items-center justify-center gap-2 text-primary">
              <Edit3 className="w-5 h-5" />
              <span className="font-medium">今日打卡</span>
            </div>
            <p className="text-xs text-primary/60 mt-1">
              记录今天的学习状态
            </p>
          </button>
        )}

        <StreakSection />

        <CalendarHeatmap />

        <SkillsProgress />

        <div className="card bg-gradient-to-r from-accent/5 to-primary/5 border-accent/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-dark mb-1">💪 继续加油！</h4>
              <p className="text-sm text-gray-600">
                你已经完成了 {completedTasks} 个任务，
                还有 {allTasks.length - completedTasks} 个任务等待你去探索。
                坚持下去，你一定能成为优秀的运营人！
              </p>
            </div>
          </div>
        </div>
      </div>

      {showCheckIn && <CheckInModal />}
    </div>
  );
};
