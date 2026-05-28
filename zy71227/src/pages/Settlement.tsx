import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coins, Percent, Flame, ChevronDown, ChevronUp, Play, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { scenarioLabels } from '../data/mockData';

export default function Settlement() {
  const navigate = useNavigate();
  const { artworks, booths, collectors, auctionRecords, replayScenes, gameState, nextRound, initGame } = useGameStore();
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  useEffect(() => {
    if (artworks.length === 0 || booths.length === 0) {
      initGame();
    }
  }, [artworks.length, booths.length, initGame]);

  const roundRecords = auctionRecords.filter(r => r.roundNumber === gameState.currentRound);
  const roundScenes = replayScenes.filter(s => s.round === gameState.currentRound);

  const soldCount = roundRecords.filter(r => r.status === 'sold').length;
  const unsoldCount = roundRecords.filter(r => r.status === 'unsold').length;
  const roundRevenue = roundRecords
    .filter(r => r.status === 'sold')
    .reduce((sum, r) => sum + r.finalPrice, 0);
  const roundRoyalties = roundRecords
    .filter(r => r.status === 'sold')
    .reduce((sum, r) => {
      const booth = booths.find(b => b.id === r.boothId);
      return sum + r.finalPrice * ((booth?.royaltyRate || 0) / 100);
    }, 0);

  const handleNextRound = () => {
    const isLastRound = gameState.currentRound >= gameState.totalRounds;
    nextRound();
    if (isLastRound) {
      navigate('/report');
    } else {
      navigate('/curation');
    }
  };

  return (
    <div className="container mx-auto px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-amber-100 mb-2">结算复盘</h1>
          <p className="text-slate-400">第 {gameState.currentRound} 回合结算 · 分析决策影响</p>
        </div>
        <button
          onClick={handleNextRound}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all"
        >
          {gameState.currentRound < gameState.totalRounds ? '下一回合' : '查看完整报告'}
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Coins className="text-emerald-400" size={20} />
            </div>
            <span className="text-slate-400">本回合收入</span>
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400">
            ¥{roundRevenue.toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Percent className="text-amber-400" size={20} />
            </div>
            <span className="text-slate-400">版税总额</span>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-400">
            ¥{Math.floor(roundRoyalties).toLocaleString()}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-emerald-400" size={20} />
            </div>
            <span className="text-slate-400">成交/流拍</span>
          </div>
          <div className="text-3xl font-mono font-bold">
            <span className="text-emerald-400">{soldCount}</span>
            <span className="text-slate-600"> / </span>
            <span className="text-red-400">{unsoldCount}</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Flame className="text-orange-400" size={20} />
            </div>
            <span className="text-slate-400">画廊热度</span>
          </div>
          <div className="text-3xl font-mono font-bold text-orange-400">
            {(booths.reduce((sum, b) => sum + b.heatLevel, 0) / booths.length).toFixed(1)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-serif text-amber-100 mb-4">场景复盘</h2>
          <div className="space-y-4">
            {roundScenes.length === 0 ? (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
                暂无场景记录
              </div>
            ) : (
              roundScenes.map(scene => {
                const artwork = artworks.find(a => a.id === scene.artworkId);
                const isExpanded = expandedScene === scene.id;

                return (
                  <div
                    key={scene.id}
                    className={`bg-slate-800/50 rounded-xl border overflow-hidden transition-all duration-300 ${
                      scene.type === 'normal' ? 'border-emerald-500/30' : 'border-red-500/30'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-700/30"
                      onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            scene.type === 'normal' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          }`}>
                            {scene.type === 'normal' ? (
                              <Play className="text-emerald-400" size={18} />
                            ) : (
                              <AlertTriangle className="text-red-400" size={18} />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-amber-100">
                              {artwork?.title || '未知作品'}
                            </div>
                            <div className={`text-sm ${
                              scene.type === 'normal' ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {scenarioLabels[scene.type]}
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="text-slate-400" size={20} />
                        ) : (
                          <ChevronDown className="text-slate-400" size={20} />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-700">
                        <div className="pt-4 space-y-4">
                          <div>
                            <div className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                              <Clock size={14} />
                              决策时点
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">底价设置</div>
                                <div className="font-mono text-amber-400">
                                  ¥{scene.decisionPoint.reservePrice.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">作品估值</div>
                                <div className="font-mono text-slate-300">
                                  ¥{scene.decisionPoint.estimatedValue.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">版税率</div>
                                <div className="font-mono text-amber-400">
                                  {scene.decisionPoint.royaltyRate}%
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">展位热度</div>
                                <div className="font-mono text-orange-400">
                                  Lv.{scene.decisionPoint.boothHeat}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm text-slate-500 mb-2">决策结果</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">最终状态</div>
                                <div className={`font-mono ${
                                  scene.outcome.status === 'sold' ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {scene.outcome.status === 'sold' ? '成交' : '流拍'}
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">成交价</div>
                                <div className="font-mono text-emerald-400">
                                  ¥{scene.outcome.finalPrice.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">热度变化</div>
                                <div className={`font-mono ${
                                  scene.outcome.heatChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {scene.outcome.heatChange >= 0 ? '+' : ''}{scene.outcome.heatChange}
                                </div>
                              </div>
                              <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="text-xs text-slate-500">满意度影响</div>
                                <div className={`font-mono ${
                                  scene.outcome.collectorSatisfaction >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {scene.outcome.collectorSatisfaction >= 0 ? '+' : ''}{scene.outcome.collectorSatisfaction}%
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm text-slate-500 mb-2">复盘启示</div>
                            <ul className="space-y-1">
                              {scene.learnings.map((learning, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                                  <span className="text-amber-400">•</span>
                                  {learning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-serif text-amber-100 mb-4">藏家状态</h2>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">藏家</th>
                  <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">剩余预算</th>
                  <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">满意度</th>
                  <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">竞拍次数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {collectors.map(collector => (
                  <tr key={collector.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{collector.avatar}</span>
                        <span className="text-amber-100">{collector.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      ¥{collector.budget.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              collector.satisfaction >= 80 ? 'bg-emerald-500' :
                              collector.satisfaction >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${collector.satisfaction}%` }}
                          />
                        </div>
                        <span className={`font-mono text-sm ${
                          collector.satisfaction >= 80 ? 'text-emerald-400' :
                          collector.satisfaction >= 60 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {collector.satisfaction}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {collector.bidCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-5 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="font-medium text-amber-100 mb-3">累计统计</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">总收益</div>
                <div className="text-2xl font-mono font-bold text-emerald-400">
                  ¥{gameState.totalRevenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">总版税</div>
                <div className="text-2xl font-mono font-bold text-amber-400">
                  ¥{Math.floor(gameState.totalRoyalties).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
