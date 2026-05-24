import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { 
  getEsiColor, 
  getEsiBorderColor, 
  getWaitTimeRemaining, 
  getWaitTimePercentage,
  isWaitTimeCritical,
  formatTime
} from '../utils/gameUtils';
import { AlertTriangle, Clock, User, Heart } from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient }) => {
  const gameState = useGameStore(state => state.gameState);
  const selectedPatientId = useGameStore(state => state.selectedPatientId);
  const selectPatient = useGameStore(state => state.selectPatient);
  
  const isSelected = selectedPatientId === patient.id;
  const currentTime = gameState?.timeElapsed || 0;
  const waitTimeRemaining = getWaitTimeRemaining(patient, currentTime);
  const waitPercentage = getWaitTimePercentage(patient, currentTime);
  const isCritical = isWaitTimeCritical(patient, currentTime);
  const needsReassess = patient.status === 'reassess';

  const handleClick = () => {
    if (patient.status === 'waiting' || patient.status === 'reassess') {
      selectPatient(isSelected ? null : patient.id);
    }
  };

  const esiColors: Record<number, string> = {
    1: 'border-red-500 bg-red-50',
    2: 'border-orange-500 bg-orange-50',
    3: 'border-yellow-500 bg-yellow-50',
    4: 'border-cyan-500 bg-cyan-50',
    5: 'border-green-500 bg-green-50'
  };

  const esiBadgeColors: Record<number, string> = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-cyan-500',
    5: 'bg-green-500'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -50 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isSelected ? 1.02 : 1,
        boxShadow: isSelected ? '0 10px 25px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)'
      }}
      exit={{ opacity: 0, x: 50 }}
      whileHover={{ scale: (patient.status === 'waiting' || patient.status === 'reassess') ? 1.02 : 1 }}
      onClick={handleClick}
      className={`
        relative p-4 rounded-lg border-l-4 cursor-pointer transition-all
        ${esiColors[patient.currentEsi]}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
        ${(patient.status !== 'waiting' && patient.status !== 'reassess') ? 'opacity-60 cursor-not-allowed' : ''}
        min-w-[220px] max-w-[260px]
      `}
    >
      {needsReassess && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10"
        >
          <AlertTriangle size={12} />
          需复评
        </motion.div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <User size={16} className="text-gray-600" />
          <span className="font-semibold text-gray-800">{patient.name}</span>
          <span className="text-sm text-gray-500">{patient.age}岁</span>
        </div>
        <div className={`${esiBadgeColors[patient.currentEsi]} text-white text-xs font-bold px-2 py-1 rounded`}>
          ESI {patient.currentEsi}
        </div>
      </div>

      <div className="text-sm text-gray-700 mb-2 font-medium">
        {patient.chiefComplaint}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {patient.symptoms.slice(0, 3).map((symptom, idx) => (
          <span key={idx} className="text-xs bg-white/60 text-gray-600 px-2 py-0.5 rounded">
            {symptom}
          </span>
        ))}
        {patient.symptoms.length > 3 && (
          <span className="text-xs bg-white/60 text-gray-500 px-2 py-0.5 rounded">
            +{patient.symptoms.length - 3}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className={isCritical ? 'text-red-500' : 'text-gray-500'} />
          <span className={`text-sm font-mono ${isCritical ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
            {formatTime(waitTimeRemaining)}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${waitPercentage}%` }}
            className={`h-2 rounded-full ${
              waitPercentage > 50 ? 'bg-green-500' : 
              waitPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
          />
        </div>
      </div>

      {patient.triageDecision && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs">
            <Heart size={12} className="text-blue-500" />
            <span className="text-gray-600">已分诊: ESI {patient.triageDecision}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
