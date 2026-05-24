import React from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { formatTime } from '../utils/gameUtils';
import { 
  Trophy, 
  XCircle, 
  Home, 
  RotateCcw, 
  Clock, 
  Target,
  AlertTriangle,
  CheckCircle,
  X,
  Play,
  Users
} from 'lucide-react';

export const ResultScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const gameRecords = useGameStore(state => state.gameRecords);
  
  const record = gameRecords.find(r => r.id === gameId);

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">未找到游戏记录</div>
      </div>
    );
  }

  const isWin = record.status === 'won';

  const failTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    missed_critical: { 
      label: '危重漏分', 
      icon: <XCircle size={16} />, 
      color: 'text-red-600 bg-red-50 border-red-200' 
    },
    wait_timeout: { 
      label: '等待超时', 
      icon: <Clock size={16} />, 
      color: 'text-orange-600 bg-orange-50 border-orange-200' 
    },
    wrong_triage: { 
      label: '分诊错误', 
      icon: <X size={16} />, 
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200' 
    },
    resource_waste: { 
      label: '资源浪费', 
      icon: <AlertTriangle size={16} />, 
      color: 'text-blue-600 bg-blue-50 border-blue-200' 
    }
  };

  const actionTypeLabels: Record<string, { label: string; color: string }> = {
    patient_arrive: { label: '患者到达', color: 'text-blue-600' },
    triage: { label: '分诊', color: 'text-purple-600' },
    assign_room: { label: '分配诊室', color: 'text-green-600' },
    reassess: { label: '病情变化', color: 'text-orange-600' },
    patient_discharge: { label: '患者出院', color: 'text-gray-600' },
    patient_death: { label: '患者死亡', color: 'text-red-600' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
            isWin ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isWin ? (
              <Trophy className="text-green-500" size={40} />
            ) : (
              <XCircle className="text-red-500" size={40} />
            )}
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${
            isWin ? 'text-green-700' : 'text-red-700'
          }`}>
            {isWin ? '任务完成！' : '任务失败'}
          </h1>
          <p className="text-gray-600">{record.levelName}</p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-5 shadow text-center"
          >
            <Trophy className="mx-auto text-yellow-500 mb-2" size={28} />
            <div className="text-3xl font-bold text-gray-800">{record.score}</div>
            <div className="text-sm text-gray-500">最终得分</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-5 shadow text-center"
          >
            <Target className="mx-auto text-blue-500 mb-2" size={28} />
            <div className="text-3xl font-bold text-gray-800">
              {record.patientsProcessed}/{record.targetPatients}
            </div>
            <div className="text-sm text-gray-500">处理患者</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-5 shadow text-center"
          >
            <Clock className="mx-auto text-purple-500 mb-2" size={28} />
            <div className="text-3xl font-bold text-gray-800 font-mono">
              {formatTime(record.duration)}
            </div>
            <div className="text-sm text-gray-500">用时</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-5 shadow text-center"
          >
            <AlertTriangle className="mx-auto text-red-500 mb-2" size={28} />
            <div className="text-3xl font-bold text-gray-800">{record.failReasons.length}</div>
            <div className="text-sm text-gray-500">失误次数</div>
          </motion.div>
        </div>

        {record.failReasons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow p-5 mb-6"
          >
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              失误详情
            </h2>
            <div className="space-y-3">
              {record.failReasons.map((fail, index) => {
                const config = failTypeLabels[fail.type] || failTypeLabels.wrong_triage;
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${config.color}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <span className="text-xs text-gray-500 font-mono">
                          {formatTime(fail.timestamp)}
                        </span>
                        <span className="text-xs text-red-600 ml-auto">-{fail.penalty}分</span>
                      </div>
                      <p className="text-sm mt-1 opacity-80">{fail.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow p-5 mb-6"
        >
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="text-blue-500" size={20} />
            操作时间线
          </h2>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {record.actionHistory.map((action, index) => {
              const config = actionTypeLabels[action.type] || { label: action.type, color: 'text-gray-600' };
              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="text-xs text-gray-400 font-mono w-16 flex-shrink-0 pt-0.5">
                    {formatTime(action.timestamp)}
                  </div>
                  <div className={`text-xs font-medium w-20 flex-shrink-0 pt-0.5 ${config.color}`}>
                    {config.label}
                  </div>
                  <div className="text-sm text-gray-700 flex-1">
                    {action.details.patientName || action.details.name}
                    {action.type === 'triage' && (
                      <span className={`ml-2 text-xs ${
                        action.details.isCorrect ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {action.details.isCorrect ? '✓ 正确' : `✗ 错误(应为${action.details.correct})`}
                      </span>
                    )}
                    {action.type === 'assign_room' && (
                      <span className="ml-2 text-xs text-gray-500">
                        → {action.details.roomName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center gap-4"
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            <Home size={20} />
            返回主菜单
          </button>
          
          <button
            onClick={() => navigate(`/game/${record.levelId}`)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            <RotateCcw size={20} />
            再来一局
          </button>
        </motion.div>
      </div>
    </div>
  );
};
