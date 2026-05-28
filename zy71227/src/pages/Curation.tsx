import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { ArrowRight, Flame, X, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { heatLevelColors } from '../data/mockData';
import { checkRoyaltyRateConflicts } from '../utils/conflictDetector';

export default function Curation() {
  const navigate = useNavigate();
  const { artworks, booths, assignArtworkToBooth, removeArtworkFromBooth, setReservePrice, setRoyaltyRate } = useGameStore();
  const [selectedBooth, setSelectedBooth] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif text-amber-100 mb-2">策展布局</h1>
            <p className="text-slate-400">拖拽作品到展位，设置底价和版税</p>
          </div>
          <button
            onClick={() => navigate('/auction')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            开始拍卖
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-serif text-amber-100 mb-4">展位布局</h2>
            <div className="grid grid-cols-3 gap-4">
              {booths.map(booth => {
                const artwork = artworks.find(a => a.id === booth.artworkId);
                const warnings = getBoothWarnings(booth.id);
                const isSelected = selectedBooth === booth.id;

                return (
                  <div
                    key={booth.id}
                    data-id={booth.id}
                    className={`
                      relative rounded-xl border-2 border-dashed overflow-hidden transition-all duration-300
                      ${artwork ? 'border-solid border-amber-500/50' : 'border-slate-600 hover:border-amber-500/30'}
                      ${isSelected ? 'ring-2 ring-amber-400' : ''}
                    `}
                    onClick={() => artwork && setSelectedBooth(isSelected ? null : booth.id)}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${heatLevelColors[booth.heatLevel]} to-transparent`} />
                    
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/50 rounded-full text-xs">
                      <Flame size={12} className={booth.heatLevel >= 4 ? 'text-orange-400' : 'text-slate-400'} />
                      <span className="text-slate-300">热度 {booth.heatLevel}</span>
                    </div>

                    {warnings.length > 0 && (
                      <div className="absolute top-2 right-2">
                        <div className="p-1 bg-red-500 rounded-full animate-pulse">
                          <AlertTriangle size={12} className="text-white" />
                        </div>
                      </div>
                    )}

                    {artwork ? (
                      <div className="cursor-pointer">
                        <img src={artwork.imageUrl} alt={artwork.title} className="w-full aspect-square object-cover" />
                        <div className="p-3 bg-slate-800/90">
                          <div className="font-medium text-amber-100 text-sm truncate">{artwork.title}</div>
                          <div className="text-xs text-slate-400">{artwork.artist}</div>
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className="text-amber-400 font-mono">¥{booth.reservePrice.toLocaleString()}</span>
                            <span className="text-slate-400">{booth.royaltyRate}%</span>
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); removeArtworkFromBooth(booth.id); }}
                          className="absolute top-10 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-square flex flex-col items-center justify-center bg-slate-800/30 text-slate-500">
                        <div className="text-4xl mb-2">🎨</div>
                        <div className="text-sm">拖放作品</div>
                        <div className="text-xs text-slate-600">加成 x{booth.heatBonus.toFixed(1)}</div>
                      </div>
                    )}
                  </div>
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
                  <div
                    key={artwork.id}
                    draggable
                    className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 cursor-grab active:cursor-grabbing hover:border-amber-500/50 transition-colors"
                  >
                    <img src={artwork.imageUrl} alt={artwork.title} className="w-12 h-12 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-amber-100 text-sm truncate">{artwork.title}</div>
                      <div className="text-xs text-slate-500">¥{artwork.estimatedValue.toLocaleString()}</div>
                    </div>
                    {artwork.conflictStatus === 'flagged' && (
                      <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                    )}
                  </div>
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
          </div>
        </div>
      </div>
    </DndContext>
  );
}
