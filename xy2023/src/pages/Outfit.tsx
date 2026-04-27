import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { outfitSuggestions } from '@/data/mockData';
import { calculateCycleDay, getCyclePhase } from '@/utils/date';
import type { CyclePhase } from '@/types';
import { Thermometer, Sun, Cloud, CloudRain } from 'lucide-react';

const OutfitPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useApp();
  const { userProfile } = state;

  const [temperature, setTemperature] = useState(20);
  const [weatherCondition, setWeatherCondition] = useState<'sunny' | 'cloudy' | 'rainy'>('sunny');

  const cycleDay = useMemo(() => calculateCycleDay(
    userProfile.lastPeriodStart,
    userProfile.averageCycleLength
  ), [userProfile.lastPeriodStart, userProfile.averageCycleLength]);

  const phase = useMemo(() => getCyclePhase(
    cycleDay,
    userProfile.averageCycleLength,
    userProfile.averagePeriodLength
  ), [cycleDay, userProfile.averageCycleLength, userProfile.averagePeriodLength]);

  const displaySuggestion = useMemo(() => {
    const phaseSuggestions = outfitSuggestions.filter(s => s.phase === phase);
    
    let suggestion = phaseSuggestions.find(s => 
      temperature >= s.tempRange[0] && temperature < s.tempRange[1]
    );

    if (!suggestion && phaseSuggestions.length > 0) {
      if (temperature < phaseSuggestions[0].tempRange[0]) {
        suggestion = phaseSuggestions[0];
      } else if (temperature >= phaseSuggestions[phaseSuggestions.length - 1].tempRange[1]) {
        suggestion = phaseSuggestions[phaseSuggestions.length - 1];
      }
    }

    return suggestion;
  }, [phase, temperature]);

  const weatherIcons = {
    sunny: { icon: <Sun size={24} />, text: '晴天', color: 'text-yellow-500' },
    cloudy: { icon: <Cloud size={24} />, text: '多云', color: 'text-gray-500' },
    rainy: { icon: <CloudRain size={24} />, text: '雨天', color: 'text-blue-500' }
  };

  const phaseInfo: Record<CyclePhase, { name: string; tip: string; icon: string }> = {
    menstrual: {
      name: '月经期',
      tip: '重点保暖腹部、腰部、脚部，避免受凉',
      icon: '🩸'
    },
    follicular: {
      name: '卵泡期',
      tip: '身体逐渐恢复，可适当增减衣物',
      icon: '🌱'
    },
    ovulatory: {
      name: '排卵期',
      tip: '状态最佳，可穿自己喜欢的衣服',
      icon: '🥚'
    },
    luteal: {
      name: '黄体期',
      tip: '经前期，开始注意保暖，避免紧身衣物',
      icon: '🌕'
    }
  };

  return (
    <div className="safe-area">
      <Header title="穿搭建议" showBack onBack={() => navigate('/')} />
      
      <div className="screen-container">
        <div className="card mb-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Thermometer size={18} />
            设置今日气温
          </h3>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setTemperature(t => Math.max(-10, t - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              -
            </button>
            <div className="text-center">
              <span className="text-5xl font-bold text-primary">{temperature}</span>
              <span className="text-2xl text-gray-400">°C</span>
              {displaySuggestion && (
                <p className="text-xs text-gray-500 mt-1">
                  温度范围：{displaySuggestion.tempRange[0]}°C ~ {displaySuggestion.tempRange[1]}°C
                </p>
              )}
            </div>
            <button
              onClick={() => setTemperature(t => Math.min(45, t + 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              +
            </button>
          </div>

          <div className="flex gap-2">
            {(['sunny', 'cloudy', 'rainy'] as const).map(condition => {
              const info = weatherIcons[condition];
              return (
                <button
                  key={condition}
                  onClick={() => setWeatherCondition(condition)}
                  className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                    weatherCondition === condition
                      ? 'bg-blue-50 ring-2 ring-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className={info.color}>{info.icon}</span>
                  <span className={`text-sm ${
                    weatherCondition === condition ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}>
                    {info.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-pink-50 to-pink-100 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{phaseInfo[phase].icon}</span>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 mb-1">
                当前周期：{phaseInfo[phase].name}（第{cycleDay}天）
              </h3>
              <p className="text-sm text-gray-600">{phaseInfo[phase].tip}</p>
            </div>
          </div>
        </div>

        {displaySuggestion && (
          <>
            <div className="card mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>👔</span> 推荐穿搭
                <span className="text-xs font-normal text-gray-500">
                  （{temperature}°C / {phaseInfo[phase].name}）
                </span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">上装：</p>
                  <div className="flex flex-wrap gap-2">
                    {displaySuggestion.tops.map((top, index) => (
                      <span key={index} className="chip bg-pink-100 text-pink-700">
                        {top}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">下装：</p>
                  <div className="flex flex-wrap gap-2">
                    {displaySuggestion.bottoms.map((bottom, index) => (
                      <span key={index} className="chip bg-blue-100 text-blue-700">
                        {bottom}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">外套：</p>
                  <div className="flex flex-wrap gap-2">
                    {displaySuggestion.outerwear.map((outer, index) => (
                      <span key={index} className="chip bg-gray-100 text-gray-700">
                        {outer}
                      </span>
                    ))}
                  </div>
                </div>

                {displaySuggestion.accessories.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">配饰：</p>
                    <div className="flex flex-wrap gap-2">
                      {displaySuggestion.accessories.map((acc, index) => (
                        <span key={index} className="chip bg-amber-100 text-amber-700">
                          {acc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {displaySuggestion.warnings.length > 0 && (
              <div className="card bg-red-50 border-red-200">
                <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span>⚠️</span> 注意事项
                </h3>
                <ul className="space-y-2">
                  {displaySuggestion.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="text-red-400 mt-0.5">•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="mt-6">
          <h3 className="section-title">快速选择</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { temp: -5, label: '寒冷', icon: '❄️' },
              { temp: 15, label: '凉爽', icon: '🍂' },
              { temp: 35, label: '炎热', icon: '🔥' }
            ].map(item => (
              <button
                key={item.temp}
                onClick={() => setTemperature(item.temp)}
                className={`card text-center p-3 transition-all ${
                  temperature === item.temp ? 'ring-2 ring-primary bg-pink-50' : ''
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm font-medium text-gray-700 mt-1">{item.label}</p>
                <p className="text-xs text-gray-400">{item.temp}°C</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutfitPage;