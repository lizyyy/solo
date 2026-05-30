import { useGameStore } from '../store/gameStore';
import WelcomeScreen from '../components/WelcomeScreen';
import ArtworkCard from '../components/ArtworkCard';
import CollectorProfiles from '../components/CollectorProfiles';
import BiddingPanel from '../components/BiddingPanel';
import BidHistory from '../components/BidHistory';
import BudgetBar from '../components/BudgetBar';
import GameControls from '../components/GameControls';
import ConflictAlert from '../components/ConflictAlert';
import AnomalyBadge from '../components/AnomalyBadge';
import RoundResult from '../components/RoundResult';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const store = useGameStore();
  const navigate = useNavigate();

  if (store.status === 'idle') {
    return <WelcomeScreen />;
  }

  if (store.status === 'settled') {
    navigate('/review');
    return null;
  }

  const round = store.rounds[store.currentRoundIndex];
  if (!round) return null;

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#c9a84c]/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏛️</span>
          <div>
            <h1 className="text-lg font-bold text-[#f5f0e8] font-display">艺术品拍卖心理战</h1>
            <p className="text-xs text-[#f5f0e8]/40">
              拍品 {store.currentRoundIndex + 1} / {store.rounds.length}
              {store.status === 'paused' && ' · 已暂停'}
            </p>
          </div>
        </div>
        <div className="w-64">
          <BudgetBar />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          <div className="col-span-4 overflow-y-auto space-y-4 pr-2">
            <ArtworkCard
              artwork={round.artwork}
              valuation={round.valuation}
              conflictCount={round.conflictLogs.length}
            />
            <ConflictAlert conflicts={round.conflictLogs} />
            <AnomalyBadge anomalies={round.anomalyEvents} />
          </div>

          <div className="col-span-5 flex flex-col gap-4">
            <BiddingPanel />

            {store.status === 'info_review' && (
              <div className="flex justify-center">
                <button
                  onClick={store.startBidding}
                  className="flex items-center gap-2 px-8 py-3 bg-[#c9a84c] text-[#1a1a2e] rounded-xl font-bold text-sm hover:bg-[#d4b65c] transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.4)]"
                >
                  <Play className="w-4 h-4" />
                  开始竞价
                </button>
              </div>
            )}

            {store.status === 'paused' && (
              <div className="flex justify-center">
                <button
                  onClick={store.resumeGame}
                  className="flex items-center gap-2 px-8 py-3 bg-[#2d5a3d] text-[#f5f0e8] rounded-xl font-bold text-sm hover:bg-[#3a7a50] transition-all"
                >
                  <Play className="w-4 h-4" />
                  继续拍卖
                </button>
              </div>
            )}

            <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-3">出价记录</h3>
              <BidHistory bids={round.bidRecords} />
            </div>
          </div>

          <div className="col-span-3 overflow-y-auto">
            <CollectorProfiles
              collectors={round.activeCollectors}
              artworkCategory={round.artwork.category}
            />
          </div>
        </div>
      </main>

      {store.status === 'round_end' && <RoundResult />}

      <GameControls />
    </div>
  );
}
