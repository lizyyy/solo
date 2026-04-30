import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Gamepad2,
  Timer,
  Music,
  Bookmark,
  X,
  RotateCcw,
  Check,
  Copy,
  CheckCircle,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { socialScripts, socialTasks, relaxSounds } from '@/data/mockData';
import { SocialScript, SocialTask } from '@/types';
import Header from '@/components/Header';

type PracticeTab = 'scripts' | 'tasks' | 'wheel' | 'relax';
type ScriptCategory = 'all' | 'opening' | 'rescue' | 'reject';

const difficultyEmoji = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
const difficultyText = ['', '简单', '较易', '中等', '较难', '困难'];

const wheelOptions = socialTasks.map(task => ({ ...task, color: `hsl(${Math.random() * 360}, 70%, 60%)` }));

class WhiteNoiseGenerator {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;

  createNoiseBuffer(context: AudioContext, type: string): AudioBuffer {
    const bufferSize = 2 * context.sampleRate;
    const buffer = context.createBuffer(2, bufferSize, context.sampleRate);
    const dataL = buffer.getChannelData(0);
    const dataR = buffer.getChannelData(1);

    for (let i = 0; i < bufferSize; i++) {
      let value = 0;
      
      switch (type) {
        case 'rain':
          value = Math.random() * 0.5 - 0.25 + Math.sin(i * 0.1) * 0.1;
          break;
        case 'forest':
          value = (Math.random() * 0.4 - 0.2) + Math.sin(i * 0.05) * 0.15 + Math.sin(i * 0.02) * 0.1;
          break;
        case 'waves':
          value = Math.sin(i * 0.01) * 0.3 + Math.random() * 0.2 - 0.1;
          break;
        case 'wind':
          value = Math.sin(i * 0.005) * 0.2 + Math.random() * 0.3 - 0.15;
          break;
        case 'fire':
          value = Math.random() * 0.4 - 0.2 + Math.sin(i * 0.2) * 0.1;
          break;
        case 'white':
        default:
          value = Math.random() * 0.5 - 0.25;
          break;
      }
      
      dataL[i] = value * 0.3;
      dataR[i] = value * 0.3 + (Math.random() * 0.02 - 0.01);
    }

    return buffer;
  }

  start(soundType: string): void {
    if (this.isPlaying) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.3;
      
      const buffer = this.createNoiseBuffer(this.audioContext, soundType);
      
      this.bufferSource = this.audioContext.createBufferSource();
      this.bufferSource.buffer = buffer;
      this.bufferSource.loop = true;
      this.bufferSource.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      this.bufferSource.start();
      
      this.isPlaying = true;
    } catch (e) {
      console.error('Error playing white noise:', e);
    }
  }

  stop(): void {
    if (!this.isPlaying) return;

    try {
      if (this.bufferSource) {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
        this.bufferSource = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      this.isPlaying = false;
    } catch (e) {
      console.error('Error stopping white noise:', e);
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

const noiseGenerator = new WhiteNoiseGenerator();

export default function PracticePage() {
  const navigate = useNavigate();
  const { savedScripts, toggleScriptSave, selectedTasks, selectTask, completeTask, completedTasks } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<PracticeTab>('scripts');
  const [scriptCategory, setScriptCategory] = useState<ScriptCategory>('all');
  const [selectedScript, setSelectedScript] = useState<SocialScript | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SocialTask | null>(null);
  const [showWheelResult, setShowWheelResult] = useState(false);
  
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const filteredScripts = scriptCategory === 'all' 
    ? socialScripts 
    : socialScripts.filter(s => s.category === scriptCategory);

  const handleCopyScript = (script: SocialScript) => {
    navigator.clipboard.writeText(script.content).then(() => {
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSpinWheel = () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setShowWheelResult(false);
    
    const spins = 5 + Math.random() * 3;
    const segmentAngle = 360 / wheelOptions.length;
    const randomIndex = Math.floor(Math.random() * wheelOptions.length);
    const targetAngle = randomIndex * segmentAngle + segmentAngle / 2;
    const totalRotation = wheelRotation + spins * 360 + (360 - targetAngle - wheelRotation % 360);
    
    setWheelRotation(totalRotation);
    
    setTimeout(() => {
      setIsSpinning(false);
      setSelectedTask(wheelOptions[randomIndex]);
      setShowWheelResult(true);
    }, 4000);
  };

  const handleAcceptTask = () => {
    if (selectedTask) {
      selectTask(selectedTask);
      setActiveTab('tasks');
      setShowWheelResult(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    if (!timerActive) {
      setTimerActive(true);
      setTimerPaused(false);
    } else {
      setTimerPaused(!timerPaused);
    }
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimerPaused(false);
    setTimerSeconds(300);
  };

  const toggleSound = useCallback((soundId: string) => {
    if (soundPlaying && selectedSound === soundId) {
      noiseGenerator.stop();
      setSoundPlaying(false);
      setSelectedSound(null);
    } else {
      if (soundPlaying) {
        noiseGenerator.stop();
      }
      noiseGenerator.start(soundId);
      setSelectedSound(soundId);
      setSoundPlaying(true);
      setAudioInitialized(true);
    }
  }, [soundPlaying, selectedSound]);

  useEffect(() => {
    let interval: number | undefined;
    if (timerActive && !timerPaused && timerSeconds > 0) {
      interval = window.setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [timerActive, timerPaused, timerSeconds]);

  useEffect(() => {
    return () => {
      noiseGenerator.stop();
    };
  }, []);

  const categoryLabels: Record<ScriptCategory, string> = {
    all: '全部',
    opening: '开场白',
    rescue: '解围',
    reject: '拒绝',
  };

  const tabItems = [
    { id: 'scripts' as PracticeTab, label: '话术库', icon: MessageCircle },
    { id: 'tasks' as PracticeTab, label: '任务', icon: Gamepad2 },
    { id: 'wheel' as PracticeTab, label: '转盘', icon: Star },
    { id: 'relax' as PracticeTab, label: '放松', icon: Music },
  ];

  return (
    <div className="min-h-screen pb-24">
      <Header title="练习工具" />
      
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100">
        <div className="flex overflow-x-auto px-2 py-2 no-scrollbar">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-i-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'scripts' && (
            <motion.div
              key="scripts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex overflow-x-auto mb-4 no-scrollbar">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setScriptCategory(key as ScriptCategory)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap mr-2 transition-colors ${
                      scriptCategory === key
                        ? 'bg-i-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredScripts.map((script) => (
                  <motion.div
                    key={script.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card cursor-pointer"
                    onClick={() => setSelectedScript(script)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">{script.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{script.content}</p>
                        <div className="flex flex-wrap gap-1">
                          {script.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-i-50 text-i-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleScriptSave(script.id);
                        }}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <Bookmark
                          className={`w-5 h-5 ${
                            savedScripts.includes(script.id)
                              ? 'fill-i-500 text-i-500'
                              : 'text-gray-400'
                          }`}
                        />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {selectedTasks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">今日挑战</h3>
                  <div className="space-y-3">
                    {selectedTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card card-green"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <h3 className="font-semibold text-gray-800 mr-2">{task.title}</h3>
                              <span className="text-xs text-e-600 font-medium">
                                {difficultyEmoji[task.difficulty]} {difficultyText[task.difficulty]}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                            <span className="text-xs text-e-600 bg-e-50 px-2 py-0.5 rounded-full">
                              +{task.reward} 社交步数
                            </span>
                          </div>
                          <button
                            onClick={() => completeTask(task.id)}
                            className="p-2 rounded-full bg-e-500 text-white hover:bg-e-600 transition-colors"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <h3 className="text-lg font-semibold text-gray-800 mb-3">任务库</h3>
              <div className="space-y-3">
                {socialTasks.map((task) => {
                  const isCompleted = completedTasks.includes(task.id);
                  const isSelected = selectedTasks.some(t => t.id === task.id);
                  
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`card ${
                        isCompleted 
                          ? 'opacity-60' 
                          : isSelected 
                            ? 'ring-2 ring-i-400' 
                            : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-1">
                            <h3 className="font-semibold text-gray-800 mr-2">
                              {isCompleted ? <s>{task.title}</s> : task.title}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {difficultyEmoji[task.difficulty]}
                            </span>
                            {isCompleted && (
                              <CheckCircle className="w-4 h-4 text-e-500 ml-2" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {isCompleted ? <s>{task.description}</s> : task.description}
                          </p>
                          <div className="flex items-center space-x-3">
                            <span className="text-xs text-gray-500">
                              {difficultyText[task.difficulty]}
                            </span>
                            <span className="text-xs text-i-600 bg-i-50 px-2 py-0.5 rounded-full">
                              +{task.reward} 社交步数
                            </span>
                          </div>
                        </div>
                        {!isCompleted && !isSelected && (
                          <button
                            onClick={() => selectTask(task)}
                            className="p-2 rounded-full bg-i-100 text-i-600 hover:bg-i-200 transition-colors"
                          >
                            <Star className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'wheel' && (
            <motion.div
              key="wheel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-2">勇气抽签转盘</h3>
              <p className="text-sm text-gray-500 mb-8">转动转盘，随机获取今天的社交挑战！</p>
              
              <div className="relative w-72 h-72 mx-auto mb-8">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-16 border-l-transparent border-r-transparent border-t-i-500" 
                       style={{ borderTopWidth: '24px' }} />
                </div>
                
                <motion.div
                  className="w-full h-full rounded-full overflow-hidden"
                  style={{
                    background: `conic-gradient(${
                      wheelOptions.map((opt, i) => 
                        `${opt.color} ${(360 / wheelOptions.length) * i}deg ${(360 / wheelOptions.length) * (i + 1)}deg`
                      ).join(', ')
                    })`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                  animate={{ rotate: wheelRotation }}
                  transition={{ duration: 4, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 rounded-full border-8 border-white" />
                </motion.div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center z-10">
                  <div className="w-10 h-10 bg-gradient-to-br from-i-400 to-e-400 rounded-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSpinWheel}
                disabled={isSpinning}
                className={`btn-primary btn-purple text-lg px-8 py-4 rounded-2xl ${
                  isSpinning ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSpinning ? '转动中...' : '开始转动'}
              </button>

              <AnimatePresence>
                {showWheelResult && selectedTask && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowWheelResult(false)}
                  >
                    <div
                      className="card max-w-sm w-full text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-4xl mb-4">🎯</div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">你的挑战是</h3>
                      <h4 className="text-lg font-semibold text-i-600 mb-2">{selectedTask.title}</h4>
                      <p className="text-gray-600 mb-4">{selectedTask.description}</p>
                      <div className="flex items-center justify-center space-x-4 mb-6">
                        <span className="text-sm text-gray-500">
                          {difficultyEmoji[selectedTask.difficulty]} {difficultyText[selectedTask.difficulty]}
                        </span>
                        <span className="text-sm text-i-600 bg-i-50 px-3 py-1 rounded-full">
                          +{selectedTask.reward} 社交步数
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setShowWheelResult(false)}
                          className="btn-primary btn-outline"
                        >
                          再试一次
                        </button>
                        <button
                          onClick={handleAcceptTask}
                          className="btn-primary btn-purple"
                        >
                          接受挑战
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'relax' && (
            <motion.div
              key="relax"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="card text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {formatTime(timerSeconds)}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {timerActive ? (timerPaused ? '已暂停' : '专注中...') : '准备开始'}
                </p>
                
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={553}
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ 
                        strokeDashoffset: timerActive 
                          ? 553 * (1 - timerSeconds / 300) 
                          : 0 
                      }}
                      transition={{ duration: 1 }}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {timerActive && !timerPaused ? (
                      <div className="text-5xl animate-pulse-slow">🧘</div>
                    ) : (
                      <Timer className="w-16 h-16 text-i-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={resetTimer}
                    className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <RotateCcw className="w-6 h-6 text-gray-600" />
                  </button>
                  <button
                    onClick={toggleTimer}
                    className={`p-4 rounded-full ${
                      timerActive && !timerPaused
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-i-500 hover:bg-i-600'
                    } text-white transition-colors`}
                  >
                    {timerActive && !timerPaused ? (
                      <div className="w-6 h-6 flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-sm" />
                      </div>
                    ) : (
                      <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" 
                           style={{ borderTopWidth: '8px', borderBottomWidth: '8px' }} />
                    )}
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                解压白噪音
                {soundPlaying && (
                  <span className="ml-2 text-sm text-i-500 flex items-center">
                    <Volume2 className="w-4 h-4 mr-1" />
                    播放中
                  </span>
                )}
              </h3>
              {!audioInitialized && (
                <p className="text-sm text-gray-500 mb-3">点击任意白噪音卡片开始播放</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {relaxSounds.map((sound) => (
                  <button
                    key={sound.id}
                    onClick={() => toggleSound(sound.id)}
                    className={`card flex flex-col items-center justify-center p-4 transition-all ${
                      selectedSound === sound.id && soundPlaying
                        ? 'ring-2 ring-i-500 bg-i-50 shadow-lg scale-105'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <span className="text-3xl mb-2 transition-transform">
                      {selectedSound === sound.id && soundPlaying ? (
                        <motion.span
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          {sound.icon}
                        </motion.span>
                      ) : (
                        sound.icon
                      )}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{sound.name}</span>
                    {selectedSound === sound.id && soundPlaying && (
                      <div className="flex items-center mt-1">
                        <span className="w-1 h-3 bg-i-500 rounded-full mx-0.5 animate-pulse" />
                        <span className="w-1 h-5 bg-i-500 rounded-full mx-0.5 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-1 h-4 bg-i-500 rounded-full mx-0.5 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="w-1 h-3 bg-i-500 rounded-full mx-0.5 animate-pulse" style={{ animationDelay: '0.15s' }} />
                      </div>
                    )}
                    {selectedSound === sound.id && !soundPlaying && (
                      <VolumeX className="w-4 h-4 text-gray-400 mt-1" />
                    )}
                  </button>
                ))}
              </div>
              
              {soundPlaying && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSound(selectedSound!)}
                    className="w-full btn-primary btn-outline flex items-center justify-center"
                  >
                    <VolumeX className="w-5 h-5 mr-2" />
                    停止播放
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedScript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex flex-col z-50"
            onClick={() => setSelectedScript(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="mt-auto bg-white rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white p-4 border-b border-gray-100 z-10">
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">{selectedScript.title}</h3>
                  <button
                    onClick={() => setSelectedScript(null)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 pb-36">
                <div className="card card-purple mb-4">
                  <p className="text-gray-800 text-lg leading-relaxed">{selectedScript.content}</p>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedScript.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-i-50 text-i-600 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">使用场景</h4>
                  <p className="text-sm text-gray-600">{selectedScript.usage}</p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 pb-10">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      toggleScriptSave(selectedScript.id);
                    }}
                    className={`btn-primary ${
                      savedScripts.includes(selectedScript.id)
                        ? 'btn-purple'
                        : 'btn-outline'
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 mr-2 ${
                      savedScripts.includes(selectedScript.id) ? 'fill-white' : ''
                    }`} />
                    {savedScripts.includes(selectedScript.id) ? '已收藏' : '收藏'}
                  </button>
                  <button
                    onClick={() => handleCopyScript(selectedScript)}
                    className="btn-primary btn-green"
                  >
                    {copiedId === selectedScript.id ? (
                      <CheckCircle className="w-5 h-5 mr-2" />
                    ) : (
                      <Copy className="w-5 h-5 mr-2" />
                    )}
                    {copiedId === selectedScript.id ? '已复制' : '复制话术'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
