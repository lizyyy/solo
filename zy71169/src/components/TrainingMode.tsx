import React, { useState, useMemo } from 'react';
import { Settings, Play, Info } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { LEVELS } from '../game/levels';
import { useNavigate } from 'react-router-dom';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: SliderProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-sm font-semibold text-indigo-600">
        {value}{suffix}
      </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-indigo-500"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

function estimateDifficulty(orders: number, allergen: number, windows: number, minutes: number): { level: string; color: string; score: number } {
  const orderFactor = (orders - 10) / 90;
  const allergenFactor = allergen / 100;
  const windowFactor = (4 - windows) / 3;
  const timeFactor = (10 - minutes) / 9;
  const score = Math.min(100, Math.max(0, Math.round(orderFactor * 40 + allergenFactor * 30 + windowFactor * 15 + timeFactor * 15)));

  let level = '简单';
  let color = 'text-emerald-600 bg-emerald-50';
  if (score >= 75) {
    level = '困难';
    color = 'text-rose-600 bg-rose-50';
  } else if (score >= 45) {
    level = '中等';
    color = 'text-amber-600 bg-amber-50';
  }
  return { level, color, score };
}

function estimateTargetScore(orders: number, allergen: number, minutes: number): number {
  const base = orders * 10;
  const allergenPenalty = Math.round(orders * allergen * 0.3);
  const timeBonus = Math.round((minutes - 1) * 20);
  return Math.max(50, base + timeBonus - allergenPenalty);
}

export default function TrainingMode() {
  const navigate = useNavigate();
  const startGame = useGameStore((s) => s.startGame);

  const [orderCount, setOrderCount] = useState(30);
  const [allergenRatio, setAllergenRatio] = useState(20);
  const [windowCount, setWindowCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(3);

  const difficulty = useMemo(
    () => estimateDifficulty(orderCount, allergenRatio, windowCount, durationMinutes),
    [orderCount, allergenRatio, windowCount, durationMinutes]
  );
  const targetScore = useMemo(
    () => estimateTargetScore(orderCount, allergenRatio, durationMinutes),
    [orderCount, allergenRatio, durationMinutes]
  );

  const handleStart = () => {
    const trainingLevelId = `training_${Date.now()}`;
    const customLevel = {
      id: trainingLevelId,
      name: `自由训练 - ${orderCount}单`,
      difficulty: Math.max(1, Math.ceil(difficulty.score / 34)),
      orderCount,
      allergenRatio: allergenRatio / 100,
      windowCount,
      durationSeconds: durationMinutes * 60,
      targetScore,
      description: '自由训练模式',
    };

    const existingIndex = LEVELS.findIndex((l) => l.id === trainingLevelId);
    if (existingIndex === -1) {
      LEVELS.push(customLevel);
    } else {
      LEVELS[existingIndex] = customLevel;
    }

    startGame(trainingLevelId);
    navigate(`/game/${trainingLevelId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <Settings className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">自由训练</h1>
              <p className="text-sm text-slate-500">自定义训练参数，针对性提升备餐能力</p>
            </div>
          </div>

          <div className="space-y-8">
            <Slider
              label="订单数量"
              value={orderCount}
              min={10}
              max={100}
              onChange={setOrderCount}
            />
            <Slider
              label="过敏原比例"
              value={allergenRatio}
              min={0}
              max={100}
              suffix="%"
              onChange={setAllergenRatio}
            />
            <Slider
              label="取餐窗口数量"
              value={windowCount}
              min={1}
              max={4}
              onChange={setWindowCount}
            />
            <Slider
              label="回合时长"
              value={durationMinutes}
              min={1}
              max={10}
              suffix=" 分钟"
              onChange={setDurationMinutes}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-800">参数影响预览</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">预估难度</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${difficulty.color}`}>
                  {difficulty.level}
                </span>
                <span className="text-xs text-slate-400">{difficulty.score}/100</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all"
                  style={{ width: `${difficulty.score}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">预估得分目标</p>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{targetScore}</p>
              <p className="mt-1 text-xs text-slate-400">达到此分数视为通关</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">回合信息</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>订单数: <span className="font-semibold">{orderCount}</span></p>
                <p>窗口数: <span className="font-semibold">{windowCount}</span></p>
                <p>时长: <span className="font-semibold">{durationMinutes} 分钟</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleStart}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-indigo-700"
          >
            <Play className="h-5 w-5" />
            <span>开始训练</span>
          </button>
        </div>
      </div>
    </div>
  );
}
