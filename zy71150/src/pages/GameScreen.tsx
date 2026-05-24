import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { GameHeader } from '../components/GameHeader';
import { PatientCard } from '../components/PatientCard';
import { RoomCard } from '../components/RoomCard';
import { TriagePanel } from '../components/TriagePanel';
import { PatientDetail } from '../components/PatientDetail';
import { Users, Bed } from 'lucide-react';

export const GameScreen: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const initGame = useGameStore(state => state.initGame);
  const gameState = useGameStore(state => state.gameState);
  const selectedPatientId = useGameStore(state => state.selectedPatientId);
  const saveGameRecord = useGameStore(state => state.saveGameRecord);

  useGameLoop();

  useEffect(() => {
    if (levelId) {
      initGame(levelId);
    }
  }, [levelId, initGame]);

  useEffect(() => {
    if (gameState && (gameState.status === 'won' || gameState.status === 'lost')) {
      saveGameRecord();
      setTimeout(() => {
        navigate(`/result/${gameState.id}`);
      }, 1500);
    }
  }, [gameState?.status, gameState?.id, navigate, saveGameRecord]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    );
  }

  const waitingPatients = gameState.patients.filter(
    p => p.status === 'waiting' || p.status === 'reassess'
  );
  const selectedPatient = gameState.patients.find(p => p.id === selectedPatientId);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <GameHeader />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-700">候诊队列</h2>
            <span className="text-sm text-gray-500">({waitingPatients.length}人)</span>
          </div>
          
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
            {waitingPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>暂无等待患者</p>
              </div>
            ) : (
              <div className="flex gap-4 pb-2">
                <AnimatePresence>
                  {waitingPatients.map(patient => (
                    <PatientCard key={patient.id} patient={patient} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Bed size={18} className="text-purple-600" />
              <h2 className="font-semibold text-gray-700">诊室资源</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {gameState.rooms.map(room => {
                const patient = gameState.patients.find(p => p.id === room.patientId);
                return <RoomCard key={room.id} room={room} patient={patient} />;
              })}
            </div>
          </div>

          <div className="space-y-4">
            <TriagePanel />
            
            <AnimatePresence>
              {selectedPatient && (
                <PatientDetail patient={selectedPatient} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
