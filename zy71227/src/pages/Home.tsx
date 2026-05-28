import { useNavigate } from 'react-router-dom';
import { Gavel, Sparkles, BarChart3, Users } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export default function Home() {
  const navigate = useNavigate();
  const initGame = useGameStore(state => state.initGame);

  const handleStartGame = () => {
    initGame();
    navigate('/artworks');
  };

  const features = [
    { icon: Gavel, title: '策略竞拍', desc: '设置底价与版税，把握拍卖节奏' },
    { icon: Sparkles, title: '展位热度', desc: '合理分配展位，最大化作品价值' },
    { icon: Users, title: '藏家博弈', desc: '匹配藏家偏好，提升成交率' },
    { icon: BarChart3, title: '深度复盘', desc: '每个决策都有迹可循' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-amber-300 text-sm">数字艺术社群经营模拟</span>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 font-serif">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400">
              NFT 策展拍卖局
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            扮演策展人，策略性安排作品展位、设定底价与版税，
            在多轮拍卖中达成经营目标。每一个决策都至关重要。
          </p>

          <button
            onClick={handleStartGame}
            className="group relative px-12 py-4 bg-gradient-to-r from-amber-500 to-rose-500 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
          >
            <span className="relative z-10 flex items-center gap-3">
              <Gavel size={24} />
              开始策展
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="p-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl hover:border-amber-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-rose-500/20 rounded-xl flex items-center justify-center mb-4">
                <feature.icon size={24} className="text-amber-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-amber-100">{feature.title}</h3>
              <p className="text-slate-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-serif text-center text-amber-100 mb-8">游戏流程</h2>
          <div className="flex items-center justify-between">
            {['作品管理', '策展布局', '拍卖进行', '结算复盘', '报告导出'].map((step, idx) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 font-bold mb-2">
                  {idx + 1}
                </div>
                <span className="text-sm text-slate-400">{step}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-5">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="w-16 h-0.5 bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
