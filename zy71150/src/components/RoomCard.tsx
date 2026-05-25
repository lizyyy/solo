import React from 'react';
import { motion } from 'framer-motion';
import { Room, Patient, EsiLevel } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { getEsiBgColor } from '../utils/gameUtils';
import { Bed, Clock, User, CheckCircle, AlertCircle } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  patient?: Patient;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, patient }) => {
  const selectedPatientId = useGameStore(state => state.selectedPatientId);
  const assignToRoom = useGameStore(state => state.assignToRoom);
  const selectedPatient = useGameStore(state => 
    state.gameState?.patients.find(p => p.id === state.selectedPatientId)
  );

  const canAssign = selectedPatient && 
    (selectedPatient.status === 'waiting' || selectedPatient.status === 'reassess') && 
    room.status === 'idle' &&
    room.canHandleEsi.includes(selectedPatient.currentEsi);

  const handleClick = () => {
    if (canAssign && selectedPatientId) {
      assignToRoom(selectedPatientId, room.id);
    }
  };

  const statusConfig = {
    idle: {
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      text: 'text-gray-600',
      icon: CheckCircle,
      label: '空闲'
    },
    occupied: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      text: 'text-blue-700',
      icon: User,
      label: '处理中'
    },
    cleaning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      text: 'text-yellow-700',
      icon: Clock,
      label: '清洁中'
    }
  };

  const config = statusConfig[room.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      layout
      whileHover={canAssign ? { scale: 1.03, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' } : {}}
      onClick={handleClick}
      className={`
        relative p-4 rounded-xl border-2 transition-all
        ${config.bg} ${config.border}
        ${canAssign ? 'cursor-pointer ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${room.status === 'occupied' ? 'cursor-default' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bed size={18} className={config.text} />
          <span className="font-semibold text-gray-800">{room.name}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs ${config.text}`}>
          <StatusIcon size={14} />
          <span>{config.label}</span>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        <span className="text-xs text-gray-500">可处理:</span>
        {room.canHandleEsi.map((esi: EsiLevel) => (
          <span 
            key={esi} 
            className={`text-xs px-1.5 py-0.5 rounded text-white ${getEsiBgColor(esi)}`}
          >
            ESI {esi}
          </span>
        ))}
      </div>

      {room.status === 'occupied' && patient && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User size={14} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{patient.name}</span>
          </div>
          
          <div className="w-full">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>处理进度</span>
              <span>{Math.round(room.processingProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${room.processingProgress}%` }}
                className="h-2 bg-blue-500 rounded-full"
              />
            </div>
          </div>
        </div>
      )}

      {room.status === 'idle' && canAssign && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 rounded-xl border-2 border-blue-400 border-dashed pointer-events-none"
        />
      )}

      {room.status === 'idle' && !canAssign && selectedPatientId && (
        <div className="flex items-center gap-1 text-xs text-red-500 mt-2">
          <AlertCircle size={12} />
          <span>无法处理该患者</span>
        </div>
      )}
    </motion.div>
  );
};
