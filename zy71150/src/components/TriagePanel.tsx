import React from 'react';
import { motion } from 'framer-motion';
import { EsiLevel } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { Stethoscope, AlertTriangle, Zap, Clock, UserCheck } from 'lucide-react';

export const TriagePanel: React.FC = () => {
  const selectedPatientId = useGameStore(state => state.selectedPatientId);
  const triagePatient = useGameStore(state => state.triagePatient);
  const selectedPatient = useGameStore(state => 
    state.gameState?.patients.find(p => p.id === state.selectedPatientId)
  );

  if (!selectedPatientId || !selectedPatient) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <Stethoscope className="mx-auto text-gray-400 mb-2" size={32} />
        <p className="text-gray-500 text-sm">选择一名患者进行分诊</p>
      </div>
    );
  }

  const esiLevels: { level: EsiLevel; name: string; desc: string; color: string; icon: React.ReactNode }[] = [
    { 
      level: 1, 
      name: '立即抢救', 
      desc: '生命垂危，立即干预', 
      color: 'bg-red-500 hover:bg-red-600',
      icon: <AlertTriangle size={20} />
    },
    { 
      level: 2, 
      name: '紧急', 
      desc: '病情危重，快速处理', 
      color: 'bg-orange-500 hover:bg-orange-600',
      icon: <Zap size={20} />
    },
    { 
      level: 3, 
      name: '紧急', 
      desc: '病情较重，及时处理', 
      color: 'bg-yellow-500 hover:bg-yellow-600',
      icon: <Clock size={20} />
    },
    { 
      level: 4, 
      name: '次紧急', 
      desc: '病情稳定，可以等待', 
      color: 'bg-cyan-500 hover:bg-cyan-600',
      icon: <UserCheck size={20} />
    },
    { 
      level: 5, 
      name: '非紧急', 
      desc: '病情轻微，择期处理', 
      color: 'bg-green-500 hover:bg-green-600',
      icon: <UserCheck size={20} />
    }
  ];

  const handleTriage = (level: EsiLevel) => {
    triagePatient(selectedPatientId, level);
  };

  const isCorrectlyTriaged = selectedPatient.triageDecision === selectedPatient.currentEsi;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Stethoscope className="text-blue-600" size={20} />
        <h3 className="font-semibold text-gray-800">分诊决策</h3>
        <span className="text-sm text-gray-500 ml-auto">{selectedPatient.name}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {esiLevels.map(({ level, name, desc, color, icon }) => (
          <motion.button
            key={level}
            whileHover={!isCorrectlyTriaged ? { scale: 1.05 } : {}}
            whileTap={!isCorrectlyTriaged ? { scale: 0.95 } : {}}
            onClick={() => !isCorrectlyTriaged && handleTriage(level)}
            disabled={isCorrectlyTriaged}
            className={`
              flex flex-col items-center justify-center p-3 rounded-lg text-white
              ${color} transition-colors
              ${selectedPatient.triageDecision === level ? 'ring-2 ring-white ring-offset-2' : ''}
              ${isCorrectlyTriaged ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {icon}
            <span className="text-xs font-bold mt-1">ESI {level}</span>
            <span className="text-[10px] opacity-80 mt-0.5">{name}</span>
          </motion.button>
        ))}
      </div>

      {selectedPatient.triageDecision && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 p-3 rounded-lg ${
            isCorrectlyTriaged ? 'bg-green-50' : 'bg-yellow-50'
          }`}
        >
          <p className={`text-sm ${isCorrectlyTriaged ? 'text-green-700' : 'text-yellow-700'}`}>
            {isCorrectlyTriaged ? (
              <>
                <span className="font-medium">✓ 已正确分诊为 ESI {selectedPatient.triageDecision}</span>
                <span className="text-green-500 ml-2">点击空闲诊室进行分配</span>
              </>
            ) : (
              <>
                <span className="font-medium">当前分诊: ESI {selectedPatient.triageDecision}</span>
                <span className="text-yellow-500 ml-2">可重新分诊或分配到诊室</span>
              </>
            )}
          </p>
        </motion.div>
      )}
    </div>
  );
};
