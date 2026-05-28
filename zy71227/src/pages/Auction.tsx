import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gavel, Users, TrendingUp, AlertTriangle, CheckCircle, XCircle, Play } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { scenarioLabels } from '../data/mockData';

export default function Auction() {
  const navigate = useNavigate();
  const {
    artworks,
    booths,
    collectors,
    auctionRecords,
    currentAuctionIndex,
    isAuctionRunning,
    gameState,
    startAuctionRound,
    processNextAuction,
    calculateSettlement,
    initGame
  } = useGameStore();

  useEffect(() => {
    if (artworks.length === 0 || booths.length === 0) {
      initGame();
    }
  }, [artworks.length, booths.length, initGame]);

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const activeBooths = booths.filter(b => b.artworkId);
  const currentBooth = activeBooths[currentAuctionIndex];
  const currentArtwork = artworks.find(a => a.id === currentBooth?.artworkId);
  const currentRecord = auctionRecords.find(
    r => r.roundNumber === gameState.currentRound && r.artworkId === currentArtwork?.id
  );

  useEffect(() => {
    if (!isAuctionRunning) return;

    const currentRecordExists = auctionRecords.some(
      r => r.roundNumber === gameState.currentRound && r.artworkId === currentArtwork?.id
    );

    if (!currentRecordExists && currentArtwork && currentBooth) {
      const timer = setTimeout(() => {
        processNextAuction();
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (currentAuctionIndex >= activeBooths.length) {
      setIsAutoPlaying(false);
      calculateSettlement();
      navigate('/settlement');
    }
  }, [isAuctionRunning, currentAuctionIndex, activeBooths.length, auctionRecords, gameState.currentRound, currentArtwork?.id, currentBooth, processNextAuction, calculateSettlement, navigate]);

  const handleStart = () => {
    startAuctionRound();
    setIsAutoPlaying(true);
  };

  const handleNext = () => {
    if (currentAuctionIndex < activeBooths.length) {
      processNextAuction();
    } else {
      calculateSettlement();
      navigate('/settlement');
    }
  };

  const getLatestBid = () => {
    if (!currentRecord) return null;
    return currentRecord.bidHistory[currentRecord.bidHistory.length - 1];
  };

  const latestBid = getLatestBid();
  const bidder = latestBid ? collectors.find(c => c.id === latestBid.collectorId) : null;

  return (
    <div className="container mx-auto px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-amber-100 mb-2">拍卖进行中</h1>
          <p className="text-slate-400">第 {gameState.currentRound} 回合 · {currentAuctionIndex + 1} / {activeBooths.length}</p>
        </div>
        <div className="flex items-center gap-4">
          {!isAuctionRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all"
            >
              <Play size={18} />
              开始拍卖
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 rounded-lg font-semibold hover:bg-slate-600 transition-all"
            >
              下一件
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {currentArtwork && currentBooth ? (
            <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700">
              <div className="relative">
                <img
                  src={currentArtwork.imageUrl}
                  alt={currentArtwork.title}
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded-full text-sm text-amber-300">
                  {currentArtwork.title}
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 rounded-full text-sm text-slate-300">
                  展位热度 {currentBooth.heatLevel}
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">当前出价</div>
                    <div className={`text-4xl font-mono font-bold ${currentRecord?.status === 'sold' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {currentRecord ? (
                        currentRecord.status === 'sold' ? (
                          `¥${currentRecord.finalPrice.toLocaleString()}`
                        ) : currentRecord.status === 'unsold' ? (
                          '流拍'
                        ) : (
                          `¥${latestBid?.amount.toLocaleString() || currentBooth.reservePrice.toLocaleString()}`
                        )
                      ) : (
                        `¥${currentBooth.reservePrice.toLocaleString()}`
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400 mb-1">版税率</div>
                    <div className="text-2xl font-mono text-slate-300">{currentBooth.royaltyRate}%</div>
                  </div>
                </div>

                {currentRecord && (
                  <div className={`p-4 rounded-xl mb-6 ${
                    currentRecord.scenarioType === 'normal'
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      {currentRecord.scenarioType === 'normal' ? (
                        <CheckCircle className="text-emerald-400 mt-0.5" size={20} />
                      ) : (
                        <AlertTriangle className="text-red-400 mt-0.5" size={20} />
                      )}
                      <div>
                        <div className={`font-medium ${currentRecord.scenarioType === 'normal' ? 'text-emerald-300' : 'text-red-300'}`}>
                          {scenarioLabels[currentRecord.scenarioType]}
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                          {currentRecord.scenarioDetails}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {bidder && (
                  <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-xl">
                    <div className="text-3xl">{bidder.avatar}</div>
                    <div>
                      <div className="font-medium text-amber-100">{bidder.name}</div>
                      <div className="text-sm text-slate-400">最高出价者</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-sm text-slate-400">满意度</div>
                      <div className="font-mono text-amber-400">{bidder.satisfaction}%</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-12 text-center">
              <Gavel size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">请先在策展页面分配作品</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h3 className="flex items-center gap-2 text-lg font-medium text-amber-100 mb-4">
              <Users size={20} />
              藏家列表
            </h3>
            <div className="space-y-3">
              {collectors.map(collector => (
                <div key={collector.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl">{collector.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-amber-100 truncate">{collector.name}</div>
                    <div className="text-xs text-slate-500">预算: ¥{collector.budget.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">满意度</div>
                    <div className={`font-mono text-sm ${collector.satisfaction >= 80 ? 'text-emerald-400' : collector.satisfaction >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {collector.satisfaction}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h3 className="flex items-center gap-2 text-lg font-medium text-amber-100 mb-4">
              <TrendingUp size={20} />
              拍卖进度
            </h3>
            <div className="space-y-2">
              {activeBooths.map((booth, idx) => {
                const artwork = artworks.find(a => a.id === booth.artworkId);
                const record = auctionRecords.find(
                  r => r.roundNumber === gameState.currentRound && r.artworkId === booth.artworkId
                );

                return (
                  <div
                    key={booth.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      idx === currentAuctionIndex ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-transparent'
                    }`}
                  >
                    {record ? (
                      record.status === 'sold' ? (
                        <CheckCircle size={16} className="text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                    )}
                    <span className="text-sm text-slate-300 flex-1 truncate">
                      {artwork?.title || '未知作品'}
                    </span>
                    {record && (
                      <span className={`text-xs font-mono ${
                        record.status === 'sold' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {record.status === 'sold' ? `¥${record.finalPrice.toLocaleString()}` : '流拍'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
