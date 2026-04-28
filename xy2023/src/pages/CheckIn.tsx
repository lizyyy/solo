import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header, EmptyState } from '@/components/common';
import { checkInTypes, painLevelDescriptions } from '@/data/mockData';
import { formatDate } from '@/utils/date';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';

const CheckInPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, toggleCheckIn } = useApp();
  const { checkIns } = state;

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const todayCheckIns = checkIns.filter(c => c.date === selectedDate);

  const chartData = useMemo(() => {
    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      const dayCheckIns = checkIns.filter(c => c.date === dateStr && c.completed);
      
      last14Days.push({
        date: dateStr.slice(5),
        泡脚: dayCheckIns.filter(c => c.type === 'foot_bath').length > 0 ? 1 : 0,
        热敷: dayCheckIns.filter(c => c.type === 'hot_compress').length > 0 ? 1 : 0,
        早睡: dayCheckIns.filter(c => c.type === 'early_sleep').length > 0 ? 1 : 0,
        红糖: dayCheckIns.filter(c => c.type === 'brown_sugar').length > 0 ? 1 : 0,
      });
    }
    return last14Days;
  }, [checkIns]);

  const totalCompletions = checkIns.filter(c => c.completed).length;
  const streakDays = calculateStreak(checkIns);

  function calculateStreak(records: typeof checkIns): number {
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    
    const todayHasCheckIn = records.some(r => r.date === today && r.completed);
    const yesterdayHasCheckIn = records.some(r => r.date === yesterday && r.completed);

    if (!todayHasCheckIn && !yesterdayHasCheckIn) return 0;

    let streak = todayHasCheckIn ? 1 : 0;
    let currentDate = new Date(todayHasCheckIn ? today : yesterday);

    for (let i = 1; i < 30; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = formatDate(prevDate);
      
      const hasCheckIn = records.some(r => r.date === prevDateStr && r.completed);
      if (!hasCheckIn) break;
      
      streak++;
      currentDate = prevDate;
    }

    return streak;
  }

  return (
    <div className="safe-area">
      <Header title="暖养打卡" showBack onBack={() => navigate('/')} />
      
      <div className="screen-container">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card bg-gradient-to-br from-pink-50 to-pink-100 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{streakDays}</div>
            <div className="text-sm text-gray-500">连续打卡天数</div>
          </div>
          <div className="card bg-gradient-to-br from-amber-50 to-amber-100 text-center">
            <div className="text-3xl font-bold text-amber-600 mb-1">{totalCompletions}</div>
            <div className="text-sm text-gray-500">累计完成次数</div>
          </div>
        </div>

        {/* 日期选择 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={18} />
              {selectedDate === formatDate(new Date()) ? '今天' : selectedDate}
            </h3>
          </div>
          
          {/* 简单的日期选择器 - 近7天 */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - 3 + i);
              const dateStr = formatDate(date);
              const isSelected = dateStr === selectedDate;
              const dayName = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
              const isToday = dateStr === formatDate(new Date());

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 w-14 py-2 rounded-xl text-center transition-all ${
                    isSelected
                      ? 'bg-primary text-white shadow-md'
                      : isToday
                        ? 'bg-pink-50 text-primary ring-1 ring-primary'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs">周{dayName}</div>
                  <div className="font-bold">{date.getDate()}</div>
                </button>
              );
            })}
          </div>

          {/* 打卡项 */}
          <div className="grid grid-cols-2 gap-3">
            {checkInTypes.map(type => {
              const checkedIn = todayCheckIns.find(c => c.type === type.value);
              return (
                <button
                  key={type.value}
                  onClick={() => toggleCheckIn(type.value, selectedDate)}
                  className={`p-4 rounded-xl text-center transition-all duration-200 ${
                    checkedIn?.completed
                      ? 'bg-pink-100 ring-2 ring-pink-300 shadow-md'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-3xl mb-2">{type.icon}</div>
                  <div className={`font-medium ${
                    checkedIn?.completed ? 'text-primary' : 'text-gray-700'
                  }`}>
                    {type.name}
                  </div>
                  {checkedIn?.completed && (
                    <div className="text-xs text-green-500 mt-1">✓ 已完成</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 趋势图表 */}
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} />
            最近14天打卡趋势
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} ticks={[0, 1]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="stepAfter" dataKey="泡脚" stroke="#FF6B8A" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="stepAfter" dataKey="热敷" stroke="#FF9AA2" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="stepAfter" dataKey="早睡" stroke="#9B59B6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="stepAfter" dataKey="红糖" stroke="#F39C12" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const PainRecordPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, addPainRecord } = useApp();
  const { painRecords } = state;

  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [selectedType, setSelectedType] = useState<string>('lower_abdomen');
  const [notes, setNotes] = useState('');

  const today = formatDate(new Date());

  const handleSave = () => {
    addPainRecord({
      date: today,
      level: selectedLevel,
      type: selectedType as any,
      notes
    });
    setNotes('');
    setSelectedLevel(0);
    alert('记录已保存');
  };

  const chartData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      const dayRecords = painRecords.filter(r => r.date === dateStr);
      
      const avgLevel = dayRecords.length > 0
        ? Math.round(dayRecords.reduce((sum, r) => sum + r.level, 0) / dayRecords.length)
        : 0;

      last7Days.push({
        date: dateStr.slice(5),
        疼痛等级: avgLevel,
        记录次数: dayRecords.length
      });
    }
    return last7Days;
  }, [painRecords]);

  const painTypes = [
    { value: 'lower_abdomen', name: '小腹坠痛', icon: '🩹' },
    { value: 'back', name: '腰酸背痛', icon: '💆' },
    { value: 'head', name: '头痛', icon: '🤕' },
    { value: 'chest', name: '胸痛', icon: '💔' }
  ];

  return (
    <div className="safe-area">
      <Header title="疼痛记录" showBack onBack={() => navigate('/')} />
      
      <div className="screen-container">
        {/* 记录表单 */}
        <div className="card mb-6">
          <h3 className="font-bold text-gray-800 mb-4">记录今日疼痛</h3>
          
          {/* 疼痛等级 */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">选择疼痛等级</p>
            <div className="flex gap-2">
              {painLevelDescriptions.map(item => (
                <button
                  key={item.level}
                  onClick={() => setSelectedLevel(item.level)}
                  className={`flex-1 py-3 rounded-xl text-center transition-all ${
                    selectedLevel === item.level
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-lg font-bold">{item.level}</div>
                  <div className="text-xs">{item.name}</div>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {painLevelDescriptions[selectedLevel].description}
            </p>
          </div>

          {/* 疼痛类型 */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">选择疼痛部位</p>
            <div className="grid grid-cols-2 gap-2">
              {painTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    selectedType === type.value
                      ? 'bg-pink-100 ring-2 ring-pink-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <div className={`text-sm mt-1 ${
                    selectedType === type.value ? 'text-primary font-medium' : 'text-gray-600'
                  }`}>
                    {type.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">备注（可选）</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="记录疼痛的具体感受..."
              className="input-field min-h-[80px] resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full btn-primary"
          >
            保存记录
          </button>
        </div>

        {/* 趋势图 */}
        {painRecords.length > 0 ? (
          <div className="card mb-6">
            <h3 className="font-bold text-gray-800 mb-4">最近7天疼痛趋势</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="疼痛等级"
                    stroke="#FF6B8A"
                    strokeWidth={2}
                    dot={{ r: 5, fill: '#FF6B8A' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* 历史记录 */}
        <div>
          <h3 className="section-title">历史记录</h3>
          {painRecords.length === 0 ? (
            <EmptyState
              icon="📝"
              title="还没有疼痛记录"
              description="开始记录你的疼痛情况"
            />
          ) : (
            <div className="space-y-3">
              {[...painRecords].reverse().slice(0, 10).map(record => {
                const painType = painTypes.find(t => t.value === record.type);
                const levelInfo = painLevelDescriptions[record.level];

                return (
                  <div key={record.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{painType?.icon}</span>
                        <span className="font-medium text-gray-800">{painType?.name}</span>
                      </div>
                      <span className="text-sm text-gray-400">{record.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`chip ${
                        record.level >= 3 ? 'bg-red-100 text-red-700' :
                        record.level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {levelInfo.name} ({record.level}级)
                      </span>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-gray-500 mt-2">{record.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { CheckInPage, PainRecordPage };
