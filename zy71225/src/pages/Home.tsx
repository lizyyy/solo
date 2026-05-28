import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Settings, BookOpen, TrendingUp, Shield, Zap, Clock, FileText, GitCompare } from 'lucide-react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useGameStore } from '@/store/useGameStore';
import { formatNumber, formatCurrency } from '@/utils/format';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { materials, loadDefaultMaterials } = useMaterialStore();
  const { savedGames, clearCurrentGame } = useGameStore();

  useEffect(() => {
    loadDefaultMaterials();
  }, [loadDefaultMaterials]);

  const handleStartGame = (materialId: string) => {
    clearCurrentGame();
    navigate(`/game/${materialId}`);
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(46, 204, 113, 0.3) 39px, rgba(46, 204, 113, 0.3) 40px)',
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12 relative">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-trader-green to-highlight-blue rounded-xl flex items-center justify-center shadow-lg shadow-trader-green/20">
                <Shield size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  期权希腊字母防线
                </h1>
                <p className="text-bloomberg-muted text-sm">Option Greek Defense · 风险管理训练系统</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/materials')}
                className="flex items-center gap-2 px-4 py-2 bg-bloomberg-panel border border-bloomberg-border hover:border-bloomberg-muted/50 rounded-lg transition-all"
              >
                <Settings size={16} />
                材料管理
              </button>
              <button
                onClick={() => navigate('/materials/compare')}
                className="flex items-center gap-2 px-4 py-2 bg-bloomberg-panel border border-bloomberg-border hover:border-bloomberg-muted/50 rounded-lg transition-all"
              >
                <GitCompare size={16} />
                版本对比
              </button>
            </div>
          </div>

          <div className="bg-bloomberg-panel rounded-2xl border border-bloomberg-border p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-trader-green/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-highlight-blue/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-trader-green/10 text-trader-green rounded-full text-sm mb-4">
                    <Zap size={14} />
                    <span>培训师推荐 · 短跨式组合风险对冲训练</span>
                  </div>
                  <h2 className="text-4xl font-bold mb-4 leading-tight">
                    在行情突变中守住
                    <span className="text-trader-green"> Δ </span>
                    <span className="text-warning-orange"> Γ </span>
                    <span className="text-highlight-blue"> V </span>
                  </h2>
                  <p className="text-bloomberg-muted text-lg mb-6 leading-relaxed">
                    这不是简单的交易游戏。你需要在10个回合的市场波动中，
                    管理一个初始的短跨式期权组合，应对2次突发行情冲击，
                    在<span className="text-trader-green font-bold">Delta中性</span>、
                    <span className="text-warning-orange font-bold">Gamma风险</span>、
                    <span className="text-highlight-blue font-bold">Vega敞口</span>和
                    <span className="text-trader-red font-bold">保证金安全</span>之间做出艰难抉择。
                  </p>

                  <div className="flex flex-wrap gap-3 mb-8">
                    <div className="flex items-center gap-2 px-4 py-2 bg-bloomberg-bg/50 rounded-lg">
                      <Clock size={16} className="text-highlight-blue" />
                      <span className="text-sm">10 回合训练</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-bloomberg-bg/50 rounded-lg">
                      <Zap size={16} className="text-trader-red" />
                      <span className="text-sm">2 次突变行情</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-bloomberg-bg/50 rounded-lg">
                      <Shield size={16} className="text-warning-orange" />
                      <span className="text-sm">5 维风险监控</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-bloomberg-bg/50 rounded-lg">
                      <FileText size={16} className="text-trader-green" />
                      <span className="text-sm">完整复盘报告</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {materials.length > 0 && (
                      <button
                        onClick={() => handleStartGame(materials[0].id)}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-trader-green to-trader-green/80 hover:from-trader-green/90 hover:to-trader-green/70 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-trader-green/20 hover:shadow-trader-green/40 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Play size={24} fill="currentColor" />
                        开始训练
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/materials')}
                      className="flex items-center gap-3 px-6 py-4 bg-bloomberg-bg border border-bloomberg-border hover:border-bloomberg-muted/50 rounded-xl font-bold transition-all"
                    >
                      <BookOpen size={20} />
                      浏览全部材料
                    </button>
                  </div>
                </div>

                <div className="w-72 h-72 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-56 h-56 rounded-full border-4 border-bloomberg-border/30 flex items-center justify-center">
                      <div className="w-44 h-44 rounded-full border-4 border-bloomberg-border/40 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border-4 border-bloomberg-border/50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-3xl font-mono font-bold text-trader-green">Δ</div>
                            <div className="text-xs text-bloomberg-muted">中性</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 bg-bloomberg-panel px-3 py-1 rounded-lg border border-bloomberg-border shadow-lg">
                    <span className="text-warning-orange font-mono font-bold">Γ = -200</span>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 bg-bloomberg-panel px-3 py-1 rounded-lg border border-bloomberg-border shadow-lg">
                    <span className="text-highlight-blue font-mono font-bold">V = -300</span>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 bg-bloomberg-panel px-3 py-1 rounded-lg border border-bloomberg-border shadow-lg">
                    <span className="text-trader-red font-mono font-bold">Margin 65%</span>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 bg-bloomberg-panel px-3 py-1 rounded-lg border border-bloomberg-border shadow-lg">
                    <span className="text-trader-green font-mono font-bold">PnL +¥52K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-12">
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 hover:border-trader-green/30 transition-all group">
              <div className="w-12 h-12 bg-trader-green/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield size={24} className="text-trader-green" />
              </div>
              <h3 className="text-lg font-bold mb-2">风险就是教材</h3>
              <p className="text-sm text-bloomberg-muted">
                每次Gamma暴露过高、保证金不足、调仓费用漏算都会被标记出来。
                犯错不要紧，重要的是知道错在哪里。
              </p>
            </div>
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 hover:border-warning-orange/30 transition-all group">
              <div className="w-12 h-12 bg-warning-orange/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} className="text-warning-orange" />
              </div>
              <h3 className="text-lg font-bold mb-2">取舍才是交易</h3>
              <p className="text-sm text-bloomberg-muted">
                完美对冲不存在。你要在希腊值、费用、保证金之间找到平衡，
                感受每一次调仓的真实代价。
              </p>
            </div>
            <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 hover:border-highlight-blue/30 transition-all group">
              <div className="w-12 h-12 bg-highlight-blue/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText size={24} className="text-highlight-blue" />
              </div>
              <h3 className="text-lg font-bold mb-2">对比看见成长</h3>
              <p className="text-sm text-bloomberg-muted">
                修改原始材料重跑训练，参数变动前后的结果差异一目了然，
                让抽象的风险管理变得具体可感。
              </p>
            </div>
          </div>

          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">可用训练材料</h3>
              <button
                onClick={() => navigate('/materials')}
                className="text-sm text-highlight-blue hover:text-highlight-blue/80"
              >
                查看全部 →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {materials.slice(0, 4).map(material => (
                <div 
                  key={material.id}
                  className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6 hover:border-bloomberg-muted/50 transition-all group cursor-pointer"
                  onClick={() => handleStartGame(material.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-bold group-hover:text-trader-green transition-colors">{material.name}</h4>
                        {material.marketEvents.some(e => e.isShock) && (
                          <span className="px-2 py-0.5 bg-trader-red/20 text-trader-red text-xs rounded flex items-center gap-1">
                            <Zap size={10} />
                            含突变
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-bloomberg-muted line-clamp-2">{material.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-1">回合数</div>
                      <div className="font-mono font-bold">{material.marketEvents.length}</div>
                    </div>
                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-1">头寸数</div>
                      <div className="font-mono font-bold">
                        {material.initialPositions.filter(p => p.type !== 'underlying').length}
                      </div>
                    </div>
                    <div className="bg-bloomberg-bg/50 rounded-lg p-3">
                      <div className="text-xs text-bloomberg-muted mb-1">初始资金</div>
                      <div className="font-mono font-bold">{formatCurrency(material.initialCash)}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-bloomberg-border flex items-center justify-between">
                    <div className="flex gap-3 text-xs">
                      <span className="text-bloomberg-muted">
                        Δ [{material.greekTargets.delta.min}, {material.greekTargets.delta.max}]
                      </span>
                      <span className="text-bloomberg-muted">
                        Γ [{material.greekTargets.gamma.min}, {material.greekTargets.gamma.max}]
                      </span>
                      <span className="text-bloomberg-muted">
                        V [{material.greekTargets.vega.min}, {material.greekTargets.vega.max}]
                      </span>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-trader-green/10 text-trader-green rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={14} fill="currentColor" />
                      开始
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {savedGames.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-6">最近训练记录</h3>
              <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-bloomberg-border">
                      <th className="text-left p-4 text-sm text-bloomberg-muted font-normal">训练名称</th>
                      <th className="text-left p-4 text-sm text-bloomberg-muted font-normal">状态</th>
                      <th className="text-left p-4 text-sm text-bloomberg-muted font-normal">时间</th>
                      <th className="text-right p-4 text-sm text-bloomberg-muted font-normal">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedGames.slice(0, 5).map((game, idx) => (
                      <tr key={idx} className="border-b border-bloomberg-border/50 hover:bg-bloomberg-bg/30 transition-colors">
                        <td className="p-4">{game.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            game.status === '爆仓' 
                              ? 'bg-trader-red/20 text-trader-red' 
                              : 'bg-trader-green/20 text-trader-green'
                          }`}>
                            {game.status}
                          </span>
                        </td>
                        <td className="p-4 text-bloomberg-muted text-sm">
                          {new Date(game.date).toLocaleString('zh-CN')}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => navigate(`/review/${game.id}`)}
                            className="text-highlight-blue hover:text-highlight-blue/80 text-sm"
                          >
                            查看复盘
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-bloomberg-border">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-bloomberg-muted">
              <div className="flex items-center gap-6">
                <span>Black-Scholes 定价引擎</span>
                <span>·</span>
                <span>5 维希腊值实时计算</span>
                <span>·</span>
                <span>动态保证金监控</span>
              </div>
              <div className="font-handwritten text-lg text-highlight-yellow transform -rotate-1">
                "风险是最好的老师"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
