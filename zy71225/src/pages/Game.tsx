import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Download, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useMaterialStore } from '@/store/useMaterialStore';
import { GreekMonitorBoard } from '@/components/game/GreekCard';
import { MarketCard } from '@/components/game/MarketCard';
import { PositionPanel } from '@/components/game/PositionPanel';
import { MarginGauge } from '@/components/game/MarginGauge';
import { ActionPanel } from '@/components/game/ActionPanel';
import { formatCurrency, getPnLColor, getRatingLabel, getRatingColor } from '@/utils/format';
import type { Position } from '@/types';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { materialId } = useParams();
  const location = useLocation();
  const { currentGame, materials, reviewReport, startGame, loadMarketEvent, executeAction, nextRound, endGame, exportReview, clearCurrentGame } = useGameStore();
  const { materials: allMaterials, loadDefaultMaterials, setComparisonResult } = useMaterialStore();
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showBankruptOverlay, setShowBankruptOverlay] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const comparisonMode = searchParams.get('compare') as 'old' | 'new' | null;

  useEffect(() => {
    loadDefaultMaterials();
  }, [loadDefaultMaterials]);

  useEffect(() => {
    if (materialId && allMaterials.length > 0 && !currentGame) {
      const material = allMaterials.find(m => m.id === materialId) || allMaterials[0];
      if (material) {
        startGame(material);
      }
    }
  }, [materialId, allMaterials, currentGame, startGame]);

  useEffect(() => {
    if (currentGame && currentGame.status === 'idle') {
      setTimeout(() => {
        loadMarketEvent(1);
      }, 500);
    }
  }, [currentGame, loadMarketEvent]);

  useEffect(() => {
    if (currentGame?.status === 'bankrupt' && !showBankruptOverlay) {
      setScreenShake(true);
      setTimeout(() => {
        setScreenShake(false);
        setShowBankruptOverlay(true);
      }, 500);
    }
  }, [currentGame?.status, showBankruptOverlay]);

  useEffect(() => {
    if (currentGame?.status === 'ended' && reviewReport) {
      if (comparisonMode) {
        setComparisonResult(comparisonMode, reviewReport);
      }
      navigate(`/review/${currentGame.id}`);
    }
  }, [currentGame?.status, reviewReport, navigate, currentGame?.id, comparisonMode, setComparisonResult]);

  useEffect(() => {
    if (currentGame?.currentMarket?.isShock) {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 500);
    }
  }, [currentGame?.currentRound]);

  if (!currentGame || !materials) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-highlight-blue border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-bloomberg-muted">加载游戏中...</p>
        </div>
      </div>
    );
  }

  const handleExecuteAction = (
    actionType: 'adjust' | 'stopLoss' | 'hold',
    positionChanges: Array<{ positionId: string; changeQuantity: number }>
  ) => {
    return executeAction(actionType, positionChanges);
  };

  const handleNextRound = () => {
    if (currentGame.currentRound >= currentGame.totalRounds) {
      endGame();
    } else {
      nextRound();
    }
  };

  const handleExport = () => {
    const data = exportReview();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-review-${currentGame.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackToHome = () => {
    clearCurrentGame();
    navigate('/');
  };

  const isPlaying = currentGame.status === 'playing' && currentGame.currentMarket !== null;

  return (
    <div className={`min-h-screen p-6 ${screenShake ? 'screen-shake' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToHome}
              className="p-2 hover:bg-bloomberg-border/30 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{currentGame.materialName}</h1>
              <p className="text-sm text-bloomberg-muted">
                第 {currentGame.currentRound} / {currentGame.totalRounds} 回合
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-bloomberg-muted">总盈亏</div>
              <div className={`font-mono text-2xl font-bold ${getPnLColor(currentGame.totalPnL)}`}>
                {currentGame.totalPnL >= 0 ? '+' : ''}{formatCurrency(currentGame.totalPnL)}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-bloomberg-muted">已实现盈亏</div>
              <div className={`font-mono text-lg font-bold ${getPnLColor(currentGame.realizedPnL)}`}>
                {currentGame.realizedPnL >= 0 ? '+' : ''}{formatCurrency(currentGame.realizedPnL)}
              </div>
            </div>

            {currentGame.status === 'ended' && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg transition-colors"
              >
                <Download size={16} />
                导出报告
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <GreekMonitorBoard
            greeks={currentGame.currentGreeks}
            targets={materials.greekTargets}
          />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-6">
            {currentGame.currentMarket && (
              <MarketCard
                event={currentGame.currentMarket}
                round={currentGame.currentRound}
                totalRounds={currentGame.totalRounds}
              />
            )}
            
            <MarginGauge
              margin={currentGame.marginStatus}
              cash={currentGame.cash}
              maintenanceMarginRate={materials.marginConfig.maintenanceMarginRate}
            />
          </div>

          <div className="col-span-7 space-y-6">
            <PositionPanel
              positions={currentGame.positions}
              onSelectPosition={setSelectedPosition}
              selectedPositionId={selectedPosition?.id}
            />
            
            <ActionPanel
              positions={currentGame.positions}
              currentGreeks={currentGame.currentGreeks}
              currentPrice={currentGame.currentMarket?.underlyingPrice || materials.initialUnderlyingPrice}
              volatility={currentGame.currentMarket?.volatility || 20}
              feeConfig={materials.feeConfig}
              greekTargets={materials.greekTargets}
              cash={currentGame.cash}
              isPlaying={isPlaying}
              onExecuteAction={handleExecuteAction}
              onNextRound={handleNextRound}
            />
          </div>
        </div>

        {!currentGame.currentMarket && currentGame.status === 'playing' && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center">
              <Play size={64} className="text-highlight-blue mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">准备开始</h2>
              <p className="text-bloomberg-muted">点击开始游戏，迎接市场挑战</p>
              <button
                onClick={() => loadMarketEvent(1)}
                className="mt-6 px-8 py-3 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg font-bold text-lg transition-colors"
              >
                开始第一回合
              </button>
            </div>
          </div>
        )}

        {showBankruptOverlay && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="text-center max-w-lg mx-4">
              <div className="w-24 h-24 bg-trader-red/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <AlertTriangle size={48} className="text-trader-red" />
              </div>
              <h2 className="text-4xl font-bold text-trader-red mb-4">爆仓！</h2>
              <p className="text-xl text-bloomberg-text mb-2">{currentGame.bankruptReason}</p>
              <p className="text-bloomberg-muted mb-6">
                第 {currentGame.bankruptRound} 回合，保证金耗尽，所有头寸被强制平仓
              </p>
              
              <div className="bg-bloomberg-panel rounded-xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-bloomberg-muted">最终盈亏</div>
                    <div className={`text-2xl font-mono font-bold ${getPnLColor(currentGame.totalPnL)}`}>
                      {formatCurrency(currentGame.totalPnL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-bloomberg-muted">存活回合</div>
                    <div className="text-2xl font-mono font-bold text-bloomberg-text">
                      {currentGame.bankruptRound} / {currentGame.totalRounds}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleBackToHome}
                  className="px-6 py-3 bg-bloomberg-border hover:bg-bloomberg-border/50 rounded-lg font-bold transition-colors"
                >
                  返回首页
                </button>
                <button
                  onClick={() => {
                    setShowBankruptOverlay(false);
                    navigate(`/review/${currentGame.id}`);
                  }}
                  className="px-6 py-3 bg-highlight-blue hover:bg-highlight-blue/80 text-white rounded-lg font-bold transition-colors"
                >
                  查看复盘
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
