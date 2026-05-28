import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, FileText } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Timeline } from '../components/Timeline';
import { ControlPanel } from '../components/ControlPanel';
import { AlertPanel } from '../components/AlertPanel';
import { ReportPanel } from '../components/ReportPanel';
import { useGameLoop } from '../hooks/useGameLoop';
import { useGameStore } from '../store/gameStore';
import { useEventStore } from '../store/eventStore';
import { useScoreStore } from '../store/scoreStore';


export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { status, score, currentMission, visibilityWindows, dataPackets, commands, groundStations, scheduleBlocks } = useGameStore();
  const { events } = useEventStore();
  const { currentReport, generateReport, setCurrentReport } = useScoreStore();
  
  const { resetLoop } = useGameLoop();

  useEffect(() => {
    if (!currentMission) {
      navigate('/');
    }
  }, [currentMission, navigate]);

  useEffect(() => {
    return () => {
      resetLoop();
    };
  }, [resetLoop]);

  const handleGenerateReport = useCallback(() => {
    const gameState = useGameStore.getState();
    const report = generateReport(gameState, events);
    setCurrentReport(report);
  }, [events, generateReport, setCurrentReport]);

  useEffect(() => {
    if (status === 'completed' && !currentReport) {
      handleGenerateReport();
    }
  }, [status, currentReport, handleGenerateReport]);

  const handleBackToStart = () => {
    navigate('/');
  };

  const handleViewReport = () => {
    if (currentReport) {
      navigate(`/report/${currentReport.reportId}`);
    }
  };

  if (!currentMission) {
    return null;
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 pb-16"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gold-400 font-mono">
              {currentMission.name}
            </h2>
            <p className="text-xs text-deep-400">
              {currentMission.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToStart}
              className="flex items-center gap-2 px-3 py-1.5 bg-deep-800 hover:bg-deep-700 rounded text-xs font-mono transition-colors"
            >
              <Home className="w-3 h-3" />
              返回首页
            </button>
            {status === 'completed' && (
              <button
                onClick={handleViewReport}
                className="flex items-center gap-2 px-3 py-1.5 bg-gold-600 hover:bg-gold-500 rounded text-xs font-mono transition-colors"
              >
                <FileText className="w-3 h-3" />
                查看完整报告
              </button>
            )}
          </div>
        </div>

        <Timeline />

        <div className="grid grid-cols-2 gap-4">
          <ControlPanel 
            onGenerateReport={handleGenerateReport}
          />
          <AlertPanel />
        </div>

        <AnimatePresence>
          {status === 'completed' && currentReport && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ReportPanel report={currentReport} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
};
