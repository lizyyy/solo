import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/common';
import { useApp } from '@/context/AppContext';
import {
  calculateCycleDay,
  getCyclePhase,
  formatDate
} from '@/utils/date';
import { symptomInfo, cyclePhaseInfo, relaxationTexts } from '@/data/mockData';
import type { SymptomType, CyclePhase } from '@/types';

interface ForecastDay {
  day: number;
  date: string;
  phase: CyclePhase;
  phaseName: string;
  phaseIcon: string;
  symptoms: { type: SymptomType; name: string; icon: string; probability: number; severity: string }[];
  suggestions: string[];
  relaxationText: string;
}

const ForecastPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useApp();
  const { userProfile } = state;

  const forecasts = useMemo((): ForecastDay[] => {
    const today = new Date();
    const cycleDay = calculateCycleDay(
      userProfile.lastPeriodStart,
      userProfile.averageCycleLength
    );

    const forecasts: ForecastDay[] = [];

    for (let i = -2; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const day = (cycleDay + i + userProfile.averageCycleLength - 1) % userProfile.averageCycleLength + 1;
      const phase = getCyclePhase(day, userProfile.averageCycleLength, userProfile.averagePeriodLength);
      const phaseInfo = cyclePhaseInfo[phase];

      const symptoms = generateSymptoms(day, phase);
      const suggestions = generateSuggestions(phase);
      const relaxationText = relaxationTexts[Math.floor(Math.random() * relaxationTexts.length)];

      forecasts.push({
        day,
        date: formatDate(date),
        phase,
        phaseName: phaseInfo.name,
        phaseIcon: phaseInfo.icon,
        symptoms,
        suggestions,
        relaxationText
      });
    }

    return forecasts;
  }, [userProfile]);

  function generateSymptoms(day: number, phase: CyclePhase): ForecastDay['symptoms'] {
    const result: ForecastDay['symptoms'] = [];

    const phaseSymptoms: Record<CyclePhase, { type: SymptomType; baseProbability: number }[]> = {
      menstrual: [
        { type: 'cramps', baseProbability: 0.8 },
        { type: 'back_pain', baseProbability: 0.6 },
        { type: 'abdominal_bloating', baseProbability: 0.5 },
        { type: 'fatigue', baseProbability: 0.7 },
        { type: 'headache', baseProbability: 0.3 }
      ],
      follicular: [
        { type: 'fatigue', baseProbability: 0.3 }
      ],
      ovulatory: [
        { type: 'chest_pain', baseProbability: 0.4 },
        { type: 'abdominal_bloating', baseProbability: 0.3 }
      ],
      luteal: [
        { type: 'chest_pain', baseProbability: 0.7 },
        { type: 'abdominal_bloating', baseProbability: 0.6 },
        { type: 'acne', baseProbability: 0.5 },
        { type: 'irritable', baseProbability: 0.8 },
        { type: 'headache', baseProbability: 0.4 }
      ]
    };

    const dayFactor = phase === 'menstrual'
      ? Math.max(0.3, 1 - (day - 1) * 0.15)
      : phase === 'luteal'
        ? Math.min(1, (userProfile.averageCycleLength - day + 1) * 0.15)
        : 0.5;

    const symptoms = phaseSymptoms[phase];
    symptoms.forEach(({ type, baseProbability }) => {
      const probability = Math.min(1, baseProbability * dayFactor);
      if (probability > 0.2) {
        const info = symptomInfo[type];
        result.push({
          type,
          name: info.name,
          icon: info.icon,
          probability: Math.round(probability * 100),
          severity: probability > 0.6 ? 'severe' : probability > 0.4 ? 'moderate' : 'mild'
        });
      }
    });

    return result;
  }

  function generateSuggestions(phase: CyclePhase): string[] {
    const suggestions: Record<CyclePhase, string[]> = {
      menstrual: [
        '多休息，避免剧烈运动',
        '注意腹部保暖，可以使用暖水袋',
        '喝一些红糖水或姜茶',
        '避免生冷辛辣食物',
        '保持心情愉悦'
      ],
      follicular: [
        '身体逐渐恢复，可以适当运动',
        '补充营养，多吃蛋白质食物',
        '保持规律作息'
      ],
      ovulatory: [
        '精力旺盛期，可以安排重要工作',
        '注意个人卫生',
        '保持良好的生活习惯'
      ],
      luteal: [
        '注意情绪调节，避免过度紧张',
        '减少咖啡因摄入',
        '适当运动释放压力',
        '保证充足睡眠'
      ]
    };

    return suggestions[phase].slice(0, 3);
  }

  const todayIndex = 2;
  const todayForecast = forecasts[todayIndex];

  const severityColors = {
    mild: 'bg-green-100 text-green-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    severe: 'bg-red-100 text-red-700'
  };

  return (
    <div className="safe-area">
      <Header title="情绪身体预报" showBack onBack={() => navigate('/')} />
      
      <div className="screen-container">
        {/* 今日概览 */}
        <div className="card bg-gradient-to-br from-blue-50 to-purple-50 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">今天</p>
              <p className="text-lg font-bold text-gray-800">周期第 {todayForecast.day} 天</p>
            </div>
            <div className={`px-3 py-1 rounded-full ${cyclePhaseInfo[todayForecast.phase].color} text-sm font-medium`}>
              {todayForecast.phaseIcon} {todayForecast.phaseName}
            </div>
          </div>

          {todayForecast.symptoms.length > 0 ? (
            <div>
              <h3 className="font-medium text-gray-700 mb-2">可能出现的症状</h3>
              <div className="flex flex-wrap gap-2">
                {todayForecast.symptoms.map(symptom => (
                  <span
                    key={symptom.type}
                    className={`chip ${severityColors[symptom.severity as keyof typeof severityColors]} flex items-center gap-1`}
                  >
                    {symptom.icon} {symptom.name} ({symptom.probability}%)
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">今天状态良好，没有明显症状预警</p>
          )}
        </div>

        {/* 暖心建议 */}
        <div className="card mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>💡</span> 今日建议
          </h3>
          <ul className="space-y-2">
            {todayForecast.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-400 mt-0.5">✓</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>

        {/* 放松文案 */}
        {todayForecast.phase === 'menstrual' || todayForecast.phase === 'luteal' ? (
          <div className="card bg-gradient-to-br from-amber-50 to-pink-50 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💛</span>
              <div>
                <h3 className="font-medium text-amber-800 mb-1">暖心话语</h3>
                <p className="text-sm text-amber-700">{todayForecast.relaxationText}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* 未来几天预报 */}
        <div>
          <h2 className="section-title">未来几天预报</h2>
          <div className="space-y-3">
            {forecasts.map((forecast, index) => {
              const isToday = index === todayIndex;
              const isPast = index < todayIndex;

              return (
                <div
                  key={forecast.date}
                  className={`card ${isToday ? 'ring-2 ring-primary shadow-lg' : ''} ${isPast ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className="text-sm font-bold">{forecast.day}</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">
                          {isToday ? '今天' : isPast ? '已过' : '未来'}
                        </p>
                        <p className="font-medium text-gray-800">{forecast.date}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full ${cyclePhaseInfo[forecast.phase].color} text-xs`}>
                      {forecast.phaseIcon}
                    </div>
                  </div>

                  {forecast.symptoms.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {forecast.symptoms.map(symptom => (
                        <span
                          key={symptom.type}
                          className={`chip text-xs ${severityColors[symptom.severity as keyof typeof severityColors]}`}
                        >
                          {symptom.icon} {symptom.probability}%
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">状态平稳</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
