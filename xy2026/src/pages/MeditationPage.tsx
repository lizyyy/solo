import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wind,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Timer,
  Heart,
  Users,
  RotateCcw
} from 'lucide-react';
import { mockMeditations } from '../data/mockData';

type MeditationCategory = 'breathing' | 'body-scan' | 'loving-kindness' | 'sleep';
type BreathingPhase = 'inhale' | 'exhale' | 'hold' | 'idle';

const categoryLabels: Record<MeditationCategory, { name: string; icon: string; color: string }> = {
  'breathing': { name: '呼吸冥想', icon: '🌬️', color: '#10B981' },
  'body-scan': { name: '身体扫描', icon: '🧘', color: '#3B82F6' },
  'loving-kindness': { name: '慈心禅', icon: '💖', color: '#EC4899' },
  'sleep': { name: '睡前冥想', icon: '🌙', color: '#8B5CF6' }
};

const phaseLabels: Record<BreathingPhase, { icon: string; text: string }> = {
  'inhale': { icon: '🌬️', text: '吸气...' },
  'hold': { icon: '🧘', text: '屏息...' },
  'exhale': { icon: '💨', text: '呼气...' },
  'idle': { icon: '🧘‍♀️', text: '准备开始' }
};

interface BreathingCycle {
  phases: { phase: BreathingPhase; duration: number }[];
}

const breathingCycles: Record<string, BreathingCycle> = {
  'meditation-1': {
    phases: [
      { phase: 'inhale', duration: 4 },
      { phase: 'hold', duration: 7 },
      { phase: 'exhale', duration: 8 }
    ]
  }
};

export default function MeditationPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<MeditationCategory | null>(null);
  const [currentMeditation, setCurrentMeditation] = useState<typeof mockMeditations[0] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<BreathingPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);

  const filteredMeditations = selectedCategory
    ? mockMeditations.filter(m => m.category === selectedCategory)
    : mockMeditations;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseInfo = useCallback((meditationId: string, elapsedTime: number, totalDuration: number) => {
    const cycle = breathingCycles[meditationId];
    
    if (cycle && cycle.phases.length > 0) {
      const cycleDuration = cycle.phases.reduce((sum, p) => sum + p.duration, 0);
      const firstThreeStepsDuration = 4 + 7 + 8;
      
      if (elapsedTime < firstThreeStepsDuration) {
        let timeInSteps = elapsedTime;
        for (let i = 0; i < 3; i++) {
          if (timeInSteps < cycle.phases[i].duration) {
            return {
              phase: cycle.phases[i].phase,
              stepIndex: i,
              progress: timeInSteps / cycle.phases[i].duration,
              cycleCount: 0
            };
          }
          timeInSteps -= cycle.phases[i].duration;
        }
      }
      
      const remainingTime = elapsedTime - firstThreeStepsDuration;
      const cycles = Math.floor(remainingTime / cycleDuration);
      const timeInCycle = remainingTime % cycleDuration;
      
      let timeInPhase = timeInCycle;
      for (let i = 0; i < cycle.phases.length; i++) {
        if (timeInPhase < cycle.phases[i].duration) {
          return {
            phase: cycle.phases[i].phase,
            stepIndex: 3,
            progress: timeInPhase / cycle.phases[i].duration,
            cycleCount: cycles + 1
          };
        }
        timeInPhase -= cycle.phases[i].duration;
      }
    }
    
    return {
      phase: 'idle' as BreathingPhase,
      stepIndex: 0,
      progress: 0,
      cycleCount: 0
    };
  }, []);

  const getStepForTime = useCallback((meditation: typeof mockMeditations[0], elapsedTime: number) => {
    let elapsed = 0;
    for (let i = 0; i < meditation.steps.length; i++) {
      const step = meditation.steps[i];
      if (elapsedTime >= elapsed && elapsedTime < elapsed + step.duration) {
        return { stepIndex: i, step };
      }
      elapsed += step.duration;
    }
    return { stepIndex: meditation.steps.length - 1, step: meditation.steps[meditation.steps.length - 1] };
  }, []);

  const startMeditation = (meditation: typeof mockMeditations[0]) => {
    setCurrentMeditation(meditation);
    setIsPlaying(true);
    setCurrentTime(0);
    setCurrentStep(0);
    setBreathingPhase('idle');
    setCycleCount(0);
    setPhaseProgress(0);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (!isPlaying || !currentMeditation) return;

    const timer = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= currentMeditation.duration) {
          setIsPlaying(false);
          return currentMeditation.duration;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, currentMeditation]);

  useEffect(() => {
    if (!isPlaying || !currentMeditation) return;

    const { stepIndex } = getStepForTime(currentMeditation, currentTime);
    setCurrentStep(stepIndex);

    const cycle = breathingCycles[currentMeditation.id];
    if (cycle) {
      const phaseInfo = getPhaseInfo(currentMeditation.id, currentTime, currentMeditation.duration);
      setBreathingPhase(phaseInfo.phase);
      setCycleCount(phaseInfo.cycleCount);
      setPhaseProgress(phaseInfo.progress);
    } else {
      const { step } = getStepForTime(currentMeditation, currentTime);
      if (step.breathingHint) {
        setBreathingPhase(step.breathingHint as BreathingPhase);
      }
    }
  }, [currentTime, currentMeditation, isPlaying, getStepForTime, getPhaseInfo]);

  const skipBack = () => {
    if (currentMeditation) {
      setCurrentTime(Math.max(0, currentTime - 30));
    }
  };

  const skipForward = () => {
    if (currentMeditation) {
      setCurrentTime(Math.min(currentMeditation.duration, currentTime + 30));
    }
  };

  const stopMeditation = () => {
    setCurrentMeditation(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentStep(0);
    setBreathingPhase('idle');
    setCycleCount(0);
    setPhaseProgress(0);
  };

  const getPhaseDuration = () => {
    if (!currentMeditation) return 0;
    const cycle = breathingCycles[currentMeditation.id];
    if (cycle && cycle.phases.length > 0) {
      const phaseInfo = getPhaseInfo(currentMeditation.id, currentTime, currentMeditation.duration);
      const phase = cycle.phases.find(p => p.phase === phaseInfo.phase);
      return phase?.duration || 0;
    }
    return 0;
  };

  if (currentMeditation) {
    const phaseDuration = getPhaseDuration();
    const cycle = breathingCycles[currentMeditation.id];
    const isBreathingMeditation = !!cycle;

    return (
      <div className="fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={stopMeditation}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <SkipBack size={24} />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{currentMeditation.title}</h1>
            {isBreathingMeditation && cycleCount > 0 && (
              <p className="text-sm text-gray-500">已完成 {cycleCount} 个循环</p>
            )}
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div className="relative">
            <div
              className={`w-52 h-52 rounded-full flex items-center justify-center transition-all ${
                breathingPhase === 'inhale' ? 'scale-110' :
                breathingPhase === 'exhale' ? 'scale-90' : 'scale-100'
              }`}
              style={{
                background: breathingPhase === 'inhale'
                  ? 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.1) 100%)'
                  : breathingPhase === 'exhale'
                  ? 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)'
                  : breathingPhase === 'hold'
                  ? 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.08) 100%)'
                  : 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)',
                transitionDuration: breathingPhase === 'inhale' ? '4000ms' : 
                                 breathingPhase === 'hold' ? '7000ms' : '8000ms'
              }}
            >
              <div
                className="absolute inset-4 rounded-full border-4 border-dashed transition-all"
                style={{
                  borderColor: breathingPhase === 'inhale' ? 'rgba(16,185,129,0.5)' :
                              breathingPhase === 'hold' ? 'rgba(139,92,246,0.5)' :
                              breathingPhase === 'exhale' ? 'rgba(59,130,246,0.5)' :
                              'rgba(245,158,11,0.3)',
                  opacity: isPlaying ? 1 : 0.5
                }}
              />
              <div className="text-center relative z-10">
                <div className="text-5xl mb-3">
                  {phaseLabels[breathingPhase].icon}
                </div>
                <p className="text-xl font-semibold text-gray-700 mb-1">
                  {phaseLabels[breathingPhase].text}
                </p>
                {isBreathingMeditation && phaseDuration > 0 && (
                  <div className="text-sm text-gray-500">
                    {phaseDuration} 秒
                  </div>
                )}
              </div>
            </div>
            {isBreathingMeditation && isPlaying && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-40">
                <div className="flex justify-center items-center gap-1 text-xs text-gray-500">
                  <RotateCcw size={14} className="animate-spin" style={{ animationDuration: '3s' }} />
                  <span>循环中</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {isBreathingMeditation && (
          <div className="card mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">呼吸循环</h4>
            <div className="flex items-center justify-between gap-2">
              {cycle?.phases.map((p, index) => (
                <div 
                  key={index}
                  className={`flex-1 text-center p-3 rounded-xl transition-all ${
                    breathingPhase === p.phase
                      ? 'bg-amber-50 ring-2 ring-amber-400'
                      : 'bg-gray-50'
                  }`}
                >
                  <p className="text-2xl mb-1">
                    {phaseLabels[p.phase].icon}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {p.phase === 'inhale' ? '吸气' :
                     p.phase === 'hold' ? '屏息' : '呼气'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.duration}秒</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card mb-6">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-gray-700">
              步骤 {currentStep + 1} / {currentMeditation.steps.length}
            </h4>
            <span className="text-xs text-gray-400">
              {formatTime(currentTime)} / {formatTime(currentMeditation.duration)}
            </span>
          </div>
          <p className="text-gray-600 leading-relaxed">
            {currentMeditation.steps[currentStep]?.instruction || currentMeditation.steps[0]?.instruction}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(currentMeditation.duration)}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
              style={{ width: `${(currentTime / currentMeditation.duration) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={skipBack}
            className="p-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-all hover:scale-105"
          >
            <SkipBack size={24} className="text-gray-600" />
          </button>

          <button
            onClick={togglePlay}
            className="w-18 h-18 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 flex items-center justify-center text-white shadow-lg transition-all hover:scale-105"
            style={{ width: '72px', height: '72px' }}
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>

          <button
            onClick={skipForward}
            className="p-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-all hover:scale-105"
          >
            <SkipForward size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (Number(e.target.value) > 0) setIsMuted(false);
            }}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${isMuted ? 0 : volume}%, #E5E7EB ${isMuted ? 0 : volume}%, #E5E7EB 100%)`
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">冥想 🧘</h1>

      <p className="text-gray-500 text-sm mb-6">
        选择适合你的冥想方式，让心灵在平静中获得疗愈
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {(Object.entries(categoryLabels) as [MeditationCategory, typeof categoryLabels[MeditationCategory]][]).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
            className={`card p-4 transition-all hover-lift ${
              selectedCategory === key ? 'ring-2 ring-offset-2' : ''
            }`}
            style={{
              boxShadow: selectedCategory === key ? `0 0 0 2px ${value.color}` : undefined
            }}
          >
            <div className="text-3xl mb-2">{value.icon}</div>
            <h4 className="font-semibold text-gray-800">{value.name}</h4>
            <p className="text-xs text-gray-500 mt-1">
              {mockMeditations.filter(m => m.category === key).length} 个练习
            </p>
          </button>
        ))}
      </div>

      <h3 className="section-title">
        {selectedCategory
          ? `${categoryLabels[selectedCategory].name}练习`
          : '推荐冥想'}
      </h3>

      <div className="space-y-4">
        {filteredMeditations.map(meditation => (
          <div
            key={meditation.id}
            className="card cursor-pointer hover:shadow-lg transition-all hover-lift"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${categoryLabels[meditation.category].color} 0%, ${categoryLabels[meditation.category].color}99 100%)`
                }}
              >
                {categoryLabels[meditation.category].icon}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-gray-800">{meditation.title}</h4>
                  <button
                    onClick={() => startMeditation(meditation)}
                    className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white hover:shadow-lg transition-all hover:scale-105"
                  >
                    <Play size={18} className="ml-0.5" />
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{meditation.description}</p>

                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Timer size={14} />
                    <span>{Math.floor(meditation.duration / 60)} 分钟</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Heart size={14} />
                    <span>{meditation.steps.length} 个步骤</span>
                  </div>
                  {meditation.id === 'meditation-1' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                      循环呼吸
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">练习步骤：</p>
              <div className="space-y-1">
                {meditation.steps.slice(0, 3).map((step, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-xs font-medium text-amber-500">{index + 1}.</span>
                    <span className="text-xs text-gray-600 line-clamp-1">{step.instruction}</span>
                  </div>
                ))}
                {meditation.steps.length > 3 && (
                  <p className="text-xs text-gray-400 ml-4">
                    ...还有 {meditation.steps.length - 3} 个步骤
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <span className="text-lg">💡</span>
          冥想小贴士
        </h4>
        <ul className="space-y-2 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>找一个安静、舒适的环境进行冥想</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>可以使用耳机获得更好的体验</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>不需要强迫自己清空思绪，只需观察它们</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">•</span>
            <span>坚持每天冥想，效果会逐渐显现</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
