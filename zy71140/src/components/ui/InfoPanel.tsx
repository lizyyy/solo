import { Package, Calendar, MapPin, Thermometer, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getDaysUntilExpiry, getExpiryColor, getExpiryStatus } from '../../utils/expiryChecker';

export function InfoPanel() {
  const { slots, skus, layers, selectedSlotId, setSelectedSlot, rightPanelOpen, toggleRightPanel } =
    useStore();

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);
  const slotSKUs = skus.filter((s) => s.slotId === selectedSlotId);
  const slotLayer = layers.find((l) => l.id === selectedSlot?.layerId);

  if (!rightPanelOpen) {
    return (
      <button
        onClick={toggleRightPanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 backdrop-blur-md border border-slate-600/50 border-r-0 rounded-l-lg p-2 text-slate-400 hover:text-white hover:bg-slate-700/90 transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-20 bottom-20 z-20 w-80 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h2 className="text-white font-semibold text-sm">货位详情</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleRightPanel}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedSlot ? (
          <div className="p-4 space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-mono text-lg">{selectedSlot.code}</span>
                </div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">状态</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      selectedSlot.status === 'normal'
                        ? 'bg-green-500/20 text-green-400'
                        : selectedSlot.status === 'misplaced'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {selectedSlot.status === 'normal'
                      ? '正常'
                      : selectedSlot.status === 'misplaced'
                        ? '温层错放'
                        : '货位冲突'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">占用状态</span>
                  <span className={selectedSlot.isOccupied ? 'text-cyan-400' : 'text-slate-500'}>
                    {selectedSlot.isOccupied ? '已占用' : '空闲'}
                  </span>
                </div>

                {slotLayer && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">所属温层</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: slotLayer.color }}
                      />
                      <span className="text-slate-300">{slotLayer.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {slotSKUs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-purple-400" />
                  <h3 className="text-slate-300 text-sm font-medium">SKU 列表</h3>
                  <span className="text-xs text-slate-500">({slotSKUs.length})</span>
                </div>

                <div className="space-y-3">
                  {slotSKUs.map((sku) => {
                    const expiryStatus = getExpiryStatus(sku.expiryDate);
                    const daysLeft = getDaysUntilExpiry(sku.expiryDate);
                    const skuLayer = layers.find((l) => l.id === sku.layerId);

                    return (
                      <div
                        key={sku.id}
                        className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white text-sm font-medium">{sku.name}</p>
                            <p className="text-slate-500 text-xs font-mono">{sku.code}</p>
                          </div>
                          <span className="text-slate-400 text-xs">×{sku.quantity}</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">批次:</span>
                            <span className="text-slate-300 font-mono">{sku.batchNo}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Thermometer className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">温层:</span>
                            <div className="flex items-center gap-1">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: skuLayer?.color }}
                              />
                              <span className="text-slate-300">{skuLayer?.name}</span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-700/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-400">效期</span>
                              <span
                                className="font-mono"
                                style={{ color: getExpiryColor(sku.expiryDate) }}
                              >
                                {daysLeft < 0
                                  ? `已过期 ${Math.abs(daysLeft)} 天`
                                  : `剩余 ${daysLeft} 天`}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, (daysLeft / 90) * 100))}%`,
                                  backgroundColor: getExpiryColor(sku.expiryDate),
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {slotSKUs.length === 0 && selectedSlot.isOccupied && (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无 SKU 数据</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
            <MapPin className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm text-center">点击 3D 场景中的货位<br />查看详细信息</p>
          </div>
        )}
      </div>
    </div>
  );
}
