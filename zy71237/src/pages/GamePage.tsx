import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ArtworkDisplay } from '../components/game/ArtworkDisplay';
import { StatusDashboard } from '../components/game/StatusDashboard';
import { ActionPanel } from '../components/game/ActionPanel';
import { HistoryTimeline } from '../components/game/HistoryTimeline';
import { DataGapIndicator } from '../components/game/DataGapIndicator';

export function GamePage() {
  const navigate = useNavigate();
  const { selectedArtwork, currentPhase, resetGame } = useGameStore();

  useEffect(() => {
    if (!selectedArtwork) {
      navigate('/');
    }
  }, [selectedArtwork, navigate]);

  useEffect(() => {
    if (currentPhase === 'result') {
      navigate('/result');
    }
  }, [currentPhase, navigate]);

  if (!selectedArtwork) return null;

  const handleBack = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-museum-bg bg-noise">
      <header className="border-b border-museum-bronze/20 bg-museum-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-museum-paper/70 hover:text-museum-paper transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回选择</span>
          </button>

          <h1 className="text-xl font-serif font-bold text-museum-paper">
            {selectedArtwork.name}
          </h1>

          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-museum-paper/70 hover:text-museum-paper transition-colors"
          >
            <Home size={18} />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 space-y-4"
          >
            <StatusDashboard />
            <DataGapIndicator />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-5"
          >
            <ArtworkDisplay />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-4"
          >
            <ActionPanel />
            <HistoryTimeline />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
