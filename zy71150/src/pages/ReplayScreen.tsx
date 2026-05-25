import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { formatTime } from '../utils/gameUtils';
import { GameAction } from '../types/game';
import { 
  Home, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Bed,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Stethoscope
} from 'lucide-react';

export const ReplayScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const gameRecords = useGameStore(state => state.gameRecords);
  
  const record = gameRecords.find(r => r.id === gameId);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const actions = record?.actionHistory || [];

  useEffect(() => {
    if (isPlaying && currentStep < actions.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 1000 / playbackSpeed);
      return () => clearTimeout(timer);
    } else if (currentStep >= actions.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentStep, actions.length, playbackSpeed]);

  const displayedActions = actions.slice(0, currentStep + 1);

  const actionTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    patient_arrive: { label: '患者到达', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: <Users size={14} /> },
    triage: { label: '分诊', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: <Stethoscope size={14} /> },
    assign_room: { label: '分配诊室', color: 'bg-green-100 text-green-700 border-green-300', icon: <Bed size={14} /> },
    reassess: { label: '病情变化', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: <AlertTriangle size={14} /> },
    patient_discharge: { label: '患者出院', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: <CheckCircle size={14} /> },
    patient_death: { label: '患者死亡', color: 'bg-red-100 text-red-700 border-red-300', icon: <XCircle size={14} /> }
  };

  const currentAction = actions[currentStep];

  const getFailReasonsUpToStep = useCallback((step: number) => {
    if (!record) return [];
    const stepTimestamp = actions[step]?.timestamp || Infinity;
    return record.failReasons.filter(f => f.timestamp <= stepTimestamp);
  }, [record, actions]);

  const currentFails = getFailReasonsUpToStep(currentStep);

  const failTypeLabels: Record<string, { label: string; color: string }> = {
    missed_critical: { label: '危重漏分', color: 'text-red-600' },
    wait_timeout: { label: '等待超时', color: 'text-orange-600' },
    wrong_triage: { label: '分诊错误', color: 'text-yellow-600' },
    resource_waste: { label: '资源浪费', color: 'text-blue-600' }
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-600 mb-4">未找到游戏记录</div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  const handleStepChange = (newStep: number) => {
    setCurrentStep(Math.max(0, Math.min(actions.length - 1, newStep)));
  };

  const handleJumpToStep = (index: number) => {
    setCurrentStep(index);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-5 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Home size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">操作回放</h1>
                <p className="text-sm text-gray-500">{record.levelName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                步骤 <span className="font-bold text-gray-800">{currentStep + 1}</span> / {actions.length}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <Clock className="mx-auto text-blue-500 mb-1" size={24} />
            <div className="text-xl font-bold text-gray-800">
              {currentAction ? formatTime(currentAction.timestamp) : '00:00'}
            </div>
            <div className="text-xs text-gray-500">游戏时间</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <Users className="mx-auto text-green-500 mb-1" size={24} />
            <div className="text-xl font-bold text-gray-800">
              {displayedActions.filter(a => a.type === 'patient_discharge').length}
            </div>
            <div className="text-xs text-gray-500">已处理患者</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <AlertTriangle className="mx-auto text-red-500 mb-1" size={24} />
            <div className="text-xl font-bold text-gray-800">
              {currentFails.length}
            </div>
            <div className="text-xs text-gray-500">当前失误</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStepChange(0)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              disabled={currentStep === 0}
            >
              <SkipBack size={20} className="text-gray-600" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStepChange(currentStep - 1)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              disabled={currentStep === 0}
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-4 rounded-lg ${
                isPlaying 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStepChange(currentStep + 1)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              disabled={currentStep === actions.length - 1}
            >
              <ChevronRight size={20} className="text-gray-600" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStepChange(actions.length - 1)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              disabled={currentStep === actions.length - 1}
            >
              <SkipForward size={20} className="text-gray-600" />
            </motion.button>

            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="ml-4 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="h-3 bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / actions.length) * 100}%` }}
            />
          </div>
        </div>

        {currentAction && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-5 mb-4"
          >
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Clock size={18} className="text-gray-500" />
              当前步骤 - {formatTime(currentAction.timestamp)}
            </h3>
            
            <div className={`p-4 rounded-lg border-2 ${actionTypeLabels[currentAction.type]?.color || 'bg-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                {actionTypeLabels[currentAction.type]?.icon}
                <span className="font-semibold">{actionTypeLabels[currentAction.type]?.label || currentAction.type}</span>
              </div>
              
              <div className="text-lg font-medium">
                {currentAction.details.patientName || currentAction.details.name}
              </div>

              {currentAction.type === 'triage' && (
                <div className="mt-2 p-2 bg-white/50 rounded">
                  <span className={currentAction.details.isCorrect ? 'text-green-600' : 'text-red-600'}>
                    {currentAction.details.isCorrect ? '✓ 正确' : '✗ 错误'}
                    {!currentAction.details.isCorrect && ` (应为 ESI ${currentAction.details.correct})`}
                  </span>
                  <span className="ml-2 text-gray-600">→ ESI {currentAction.details.decision}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({currentAction.details.scoreChange > 0 ? '+' : ''}{currentAction.details.scoreChange}分)
                  </span>
                </div>
              )}

              {currentAction.type === 'assign_room' && (
                <div className="mt-2 p-2 bg-white/50 rounded">
                  <span className="text-gray-600">分配至: {currentAction.details.roomName}</span>
                </div>
              )}

              {currentAction.type === 'reassess' && (
                <div className="mt-2 p-2 bg-white/50 rounded">
                  <div className="text-sm text-orange-700">
                    新症状: {currentAction.details.newSymptoms?.join(', ')}
                  </div>
                  <div className="text-sm text-orange-700 mt-1">
                    ESI 等级变化: {currentAction.details.oldEsi} → {currentAction.details.newEsi}
                  </div>
                </div>
              )}

              {currentAction.type === 'patient_death' && (
                <div className="mt-2 p-2 bg-white/50 rounded">
                  <span className="text-red-600 font-medium">
                    {currentAction.details.isCritical ? '危重患者超时死亡' : '患者等待超时离开'}
                    {' '}({currentAction.details.penalty}分)
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            失误记录 (已发生 {currentFails.length} 项)
          </h3>
          
          {currentFails.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
              <p>暂无失误记录</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentFails.map((fail, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${failTypeLabels[fail.type]?.color || 'text-gray-600'} bg-gray-100`}>
                        {failTypeLabels[fail.type]?.label || fail.type}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(fail.timestamp)}
                      </span>
                    </div>
                    <span className="text-sm text-red-600 font-medium">-{fail.penalty}分</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{fail.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-5">
          <h3 className="font-bold text-gray-800 mb-3">完整操作时间线</h3>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {actions.map((action: GameAction, index: number) => (
              <div
                key={index}
                onClick={() => handleJumpToStep(index)}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                  ${index === currentStep 
                    ? 'bg-blue-100 border-2 border-blue-300' 
                    : index < currentStep 
                      ? 'bg-gray-50 hover:bg-gray-100' 
                      : 'bg-gray-50 opacity-50 hover:opacity-75'
                  }
                `}
              >
                <div className="w-16 text-xs font-mono text-gray-500 flex-shrink-0">
                  {formatTime(action.timestamp)}
                </div>
                <div className={`flex-shrink-0 ${actionTypeLabels[action.type]?.color.split(' ')[1] || 'text-gray-600'}`}>
                  {actionTypeLabels[action.type]?.icon}
                </div>
                <div className="flex-1 text-sm truncate">
                  <span className="font-medium">{action.details.patientName || action.details.name}</span>
                  {action.type === 'triage' && (
                    <span className={`ml-2 text-xs ${action.details.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {action.details.isCorrect ? '✓' : '✗'} ESI {action.details.decision}
                    </span>
                  )}
                </div>
                {index === currentStep && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
