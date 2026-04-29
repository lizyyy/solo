import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header, FeatureCard } from '@/components/common';
import {
  calculateCycleDay,
  getCyclePhase,
  getDaysUntilNextPeriod,
  isInPeriod,
  formatDate
} from '@/utils/date';
import { cyclePhaseInfo, relaxationTexts, checkInTypes, constitutionResults } from '@/data/mockData';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { state, addCycleRecord, toggleCheckIn } = useApp();
  const { userProfile, checkIns } = state;

  const today = formatDate(new Date());
  const cycleDay = calculateCycleDay(
    userProfile.lastPeriodStart,
    userProfile.averageCycleLength
  );
  const phase = getCyclePhase(
    cycleDay,
    userProfile.averageCycleLength,
    userProfile.averagePeriodLength
  );
  const daysUntilNext = getDaysUntilNextPeriod(
    userProfile.lastPeriodStart,
    userProfile.averageCycleLength
  );
  const inPeriod = isInPeriod(
    userProfile.lastPeriodStart,
    userProfile.averagePeriodLength,
    userProfile.averageCycleLength
  );

  const [showStartPeriod, setShowStartPeriod] = useState(false);
  const [selectedPeriodStartDate, setSelectedPeriodStartDate] = useState(today);
  const [relaxationText] = useState(() => {
    return relaxationTexts[Math.floor(Math.random() * relaxationTexts.length)];
  });

  const handleStartPeriod = () => {
    addCycleRecord(selectedPeriodStartDate);
    setShowStartPeriod(false);
    setSelectedPeriodStartDate(today);
  };

  const todayCheckIns = checkIns.filter(c => c.date === today);

  const features = [
    {
      title: '体质判定',
      description: '测试你的体质，获取专属养生方案',
      icon: userProfile.constitutionTestCompleted ? '✅' : '🔬',
      path: '/constitution',
      color: 'bg-pink-50'
    },
    {
      title: '饮食禁忌',
      description: '一键查询食物是否适合经期食用',
      icon: '🥗',
      path: '/food',
      color: 'bg-green-50'
    },
    {
      title: '情绪预报',
      description: '提前了解身体信号，做好心理准备',
      icon: '🧘',
      path: '/forecast',
      color: 'bg-blue-50'
    },
    {
      title: '养生打卡',
      description: '记录泡脚、热敷等暖养行动',
      icon: '📝',
      path: '/checkin',
      color: 'bg-purple-50'
    },
    {
      title: '穿搭建议',
      description: '根据气温和周期阶段推荐保暖穿搭',
      icon: '👗',
      path: '/outfit',
      color: 'bg-orange-50'
    },
    {
      title: '疼痛记录',
      description: '记录痛经程度，发现疼痛规律',
      icon: '📊',
      path: '/pain',
      color: 'bg-red-50'
    }
  ];

  return (
    <div className="safe-area">
      <Header title="经期养生" />
      
      <div className="screen-container">
        {/* 周期卡片 */}
        <div className="card bg-gradient-to-br from-pink-400 to-pink-500 text-white mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-4xl font-bold mb-1">
                {inPeriod ? `第${cycleDay}天` : `倒计时${daysUntilNext}天`}
              </div>
              <div className="text-pink-100 text-sm">
                {inPeriod ? '姨妈期进行中' : '距离下次姨妈'}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full ${cyclePhaseInfo[phase].color} text-xs font-medium`}>
              <span className="mr-1">{cyclePhaseInfo[phase].icon}</span>
              {cyclePhaseInfo[phase].name}
            </div>
          </div>

          <div className="flex gap-2">
            {!inPeriod ? (
              <button
                onClick={() => setShowStartPeriod(true)}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-sm font-medium transition-colors"
              >
                记录姨妈开始
              </button>
            ) : (
              <button
                onClick={() => navigate('/pain')}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-sm font-medium transition-colors"
              >
                记录疼痛
              </button>
            )}
            <button
              onClick={() => navigate('/diary/new')}
              className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-sm font-medium transition-colors"
            >
              写日记
            </button>
          </div>
        </div>

        {/* 体质信息 */}
        {userProfile.constitutionTestCompleted && userProfile.constitutionType !== 'unknown' && (
          <div className="card mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
                🌸
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">
                  {constitutionResults[userProfile.constitutionType]?.name || '未知体质'}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-1">
                  {constitutionResults[userProfile.constitutionType]?.description}
                </p>
              </div>
              <button
                onClick={() => navigate('/constitution/result')}
                className="text-primary text-sm font-medium"
              >
                查看详情
              </button>
            </div>
          </div>
        )}

        {/* 今日打卡 */}
        <div className="card mb-6">
          <h2 className="section-title mb-4">今日暖养打卡</h2>
          <div className="grid grid-cols-4 gap-3">
            {checkInTypes.map(type => {
              const checkedIn = todayCheckIns.find(c => c.type === type.value);
              return (
                <button
                  key={type.value}
                  onClick={() => toggleCheckIn(type.value, today)}
                  className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 ${
                    checkedIn?.completed
                      ? 'bg-pink-100 ring-2 ring-pink-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl mb-1">{type.icon}</span>
                  <span className={`text-xs font-medium ${
                    checkedIn?.completed ? 'text-pink-600' : 'text-gray-600'
                  }`}>
                    {type.name}
                  </span>
                  {checkedIn?.completed && (
                    <span className="text-xs text-green-500 mt-1">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 暖心语录 */}
        {inPeriod && (
          <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💛</span>
              <div>
                <h3 className="font-medium text-amber-800 mb-1">暖心提醒</h3>
                <p className="text-sm text-amber-700">{relaxationText}</p>
              </div>
            </div>
          </div>
        )}

        {/* 功能入口 */}
        <div className="space-y-3">
          <h2 className="section-title">更多功能</h2>
          {features.map(feature => (
            <FeatureCard
              key={feature.path}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              onClick={() => navigate(feature.path)}
              color={feature.color}
            />
          ))}
        </div>
      </div>

      {/* 开始经期弹窗 */}
      {showStartPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">记录姨妈开始</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">选择开始日期</label>
              <input
                type="date"
                value={selectedPeriodStartDate}
                onChange={e => setSelectedPeriodStartDate(e.target.value)}
                max={today}
                className="input-field"
              />
            </div>

            <p className="text-gray-500 text-sm mb-4">
              您选择的日期：<span className="font-medium text-gray-700">{selectedPeriodStartDate}</span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStartPeriod(false);
                  setSelectedPeriodStartDate(today);
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleStartPeriod}
                className="flex-1 py-2 rounded-xl bg-primary text-white font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
