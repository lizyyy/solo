import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { ArrowRight, AlertTriangle, Home } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { checkRoyaltyRateConflicts } from '../utils/conflictDetector';
import { DraggableArtwork } from '../components/DraggableArtwork';
import { DroppableBooth } from '../components/DroppableBooth';
import type { Artwork } from '../types';

export default function Curation() {
  const navigate = useNavigate();
  const { artworks, booths, assignArtworkToBooth, removeArtworkFromBooth, setReservePrice, setRoyaltyRate, gameState, initGame } = useGameStore();
  const [selectedBooth, setSelectedBooth] = useState<string | null>(null);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);

  useEffect(() => {
    if (artworks.length === 0 || booths.length === 0) {
      initGame();
    }
  }, [artworks.length, booths.length, initGame]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const artwork = artworks.find(a => a.id === active.id);
    if (artwork) {
      setActiveArtwork(artwork);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveArtwork(null);
    
    if (over && active.id !== over.id) {
      const artworkId = active.id as string;
      const boothId = over.id as string;
      if (boothId.startsWith('booth-')) {
        assignArtworkToBooth(artworkId, boothId);
      }
    }
  };

  const unassignedArtworks = artworks.filter(a => !booths.some(b => b.artworkId === a.id));

  const getBoothWarnings = (boothId: string) => {
    const booth = booths.find(b => b.id === boothId);
    const artwork = artworks.find(a => a.id === booth?.artworkId);
    if (!booth || !artwork) return [];
    return checkRoyaltyRateConflicts(artwork, booth.royaltyRate);
  };

  const assignedCount = booths.filter(b => b.artworkId).length;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif text-amber-100 mb-2">策展布局</h1>
            <p className="text-slate-400">第 {gameState.currentRound} 回合 · 拖拽作品到展位，设置底价和版税</p>
          </div>
          <button
            onClick={() => navigate('/auction')}
            disabled={assignedCount === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              assignedCount > 0
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:shadow-lg hover:shadow-amber-500/20'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            开始拍卖 ({assignedCount}/{booths.length})
            <ArrowRight size={18} />
          </button>
        </div>

        {assignedCount === 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="text-amber-400" size={20} />
            <span className="text-amber-200 text-sm">请至少将一件作品拖拽到展位后再开始拍卖</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-serif text-amber-100 mb-4">展位布局</h2>
            <div className="grid grid-cols-3 gap-4">
              {booths.map(booth => {
                const artwork = artworks.find(a => a.id === booth.artworkId);
                const warnings = getBoothWarnings(booth.id);
                const isSelected = selectedBooth === booth.id;

                return (
                  <DroppableBooth
                    key={booth.id}
                    booth={booth}
                    artwork={artwork}
                    warnings={warnings}
                    isSelected={isSelected}
                    onSelect={() => artwork && setSelectedBooth(isSelected ? null : booth.id)}
                    onRemove={() => removeArtworkFromBooth(booth.id)}
                  />
                );
              })}
            </div>

            {selectedBooth && (
              <div className="mt-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-lg font-medium text-amber-100 mb-4">拍卖参数设置</h3>
                {(() => {
                  const booth = booths.find(b => b.id === selectedBooth);
                  const artwork = artworks.find(a => a.id === booth?.artworkId);
                  if (!booth || !artwork) return null;
                  const warnings = getBoothWarnings(selectedBooth);

                  return (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">起拍底价</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400">¥</span>
                          <input
                            type="number"
                            value={booth.reservePrice}
                            onChange={e => setReservePrice(selectedBooth, Number(e.target.value))}
                            className="w-full pl-8 pr-4 py-3 bg-slate-700 rounded-lg text-amber-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          建议范围: ¥{Math.floor(artwork.estimatedValue * 0.6).toLocaleString()} - ¥{Math.floor(artwork.estimatedValue * 1.2).toLocaleString()}
                        </div>
                        {booth.reservePrice > artwork.estimatedValue * 1.5 && (
                          <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            底价过高，可能导致流拍
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">版税率</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={booth.royaltyRate}
                            onChange={e => setRoyaltyRate(selectedBooth, Number(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-700 rounded-lg text-amber-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          艺术家要求: {artwork.baseRoyaltyRate}%
                        </div>
                        {warnings.map((w, i) => (
                          <div key={i} className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            {w.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-serif text-amber-100 mb-4">待分配作品</h2>
            <div className="space-y-3">
              {unassignedArtworks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-800/30 rounded-xl">
                  所有作品已分配
                </div>
              ) : (
                unassignedArtworks.map(artwork => (
                  <DraggableArtwork key={artwork.id} artwork={artwork} />
                ))
              )}
            </div>

            <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-amber-100 mb-3">策展提示</h3>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>🔥 高热度展位能提升藏家出价意愿</li>
                <li>💰 底价设置过高可能导致流拍</li>
                <li>📜 版税率过低可能引发纠纷</li>
                <li>🎯 匹配藏家偏好的作品更易成交</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-amber-100 mb-2">操作说明</h3>
              <p className="text-xs text-slate-400">
                从左侧拖拽作品到展位上，点击展位卡片可设置底价和版税率。
                每个展位有不同热度等级，影响最终成交价格。
              </p>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeArtwork ? (
          <div className="p-3 bg-slate-800 rounded-lg border-2 border-amber-400 shadow-2xl shadow-amber-500/30 opacity-90">
            <div className="flex items-center gap-3">
              <img 
                src={activeArtwork.imageUrl} 
                alt={activeArtwork.title} 
                className="w-12 h-12 rounded object-cover" 
              />
              <div>
                <div className="font-medium text-amber-100 text-sm">{activeArtwork.title}</div>
                <div className="text-xs text-slate-400">¥{activeArtwork.estimatedValue.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
