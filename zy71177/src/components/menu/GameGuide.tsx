import React, { useState } from 'react';
import { X, Droplets, FlaskConical, Timer, AlertTriangle, TrendingUp, Coins } from 'lucide-react';

interface GameGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GameGuide: React.FC<GameGuideProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { icon: FlaskConical, label: '基本操作' },
    { icon: TrendingUp, label: '水质指标' },
    { icon: AlertTriangle, label: '常见问题' },
    { icon: Coins, label: '评分规则' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">游戏说明</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === index
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/10'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          {activeTab === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <FlaskConical size={24} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">药剂投加</h3>
                  <p className="text-sm text-slate-400">通过滑块调整药剂投加量。投加量不足处理效果差，过量则会增加成本并可能导致指标反弹。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Timer size={24} className="text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">搅拌时间</h3>
                  <p className="text-sm text-slate-400">设置搅拌时间，确保药剂与污水充分反应。搅拌不足会降低处理效率，过长则增加运行成本。</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Droplets size={24} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">执行处理</h3>
                  <p className="text-sm text-slate-400">确认参数后点击执行按钮，观察水质变化。达标后进入下一回合，未达标可继续调整参数。</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-orange-400 mb-1">COD (化学需氧量)</h3>
                  <p className="text-sm text-slate-400">衡量水中有机物污染程度的指标。数值越高，污染越严重。</p>
                  <p className="text-xs text-slate-500 mt-2">达标阈值: ≤50 mg/L</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-blue-400 mb-1">NH₃-N (氨氮)</h3>
                  <p className="text-sm text-slate-400">水中以游离氨和铵离子形式存在的氮。过高会导致水体富营养化。</p>
                  <p className="text-xs text-slate-500 mt-2">达标阈值: ≤8 mg/L</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-green-400 mb-1">TP (总磷)</h3>
                  <p className="text-sm text-slate-400">水体中所有形态磷的总量。是造成水体富营养化的关键因素。</p>
                  <p className="text-xs text-slate-500 mt-2">达标阈值: ≤0.5 mg/L</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-purple-400 mb-1">pH值</h3>
                  <p className="text-sm text-slate-400">衡量水体酸碱度的指标。正常范围为6-9，超出范围会影响处理效果。</p>
                  <p className="text-xs text-slate-500 mt-2">达标范围: 6.0 - 9.0</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  投加过量
                </h3>
                <p className="text-sm text-slate-400">药剂投加量超过最优值1.5倍时，会被判定为严重超量。这不仅会大幅增加成本，在中高难度关卡还会导致下一回合水质指标反弹。</p>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h3 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <TrendingUp size={18} />
                  指标反弹
                </h3>
                <p className="text-sm text-slate-400">在中高难度关卡，过量投加药剂会使污染物暂时被包裹，但随后会重新释放到水中，造成指标反弹超标。</p>
              </div>
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <h3 className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                  <Timer size={18} />
                  搅拌不足
                </h3>
                <p className="text-sm text-slate-400">搅拌时间低于最低要求时，药剂无法充分溶解和反应，处理效果会大打折扣，同时还会被扣分。</p>
              </div>
            </div>
          )}

          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h3 className="font-semibold text-white mb-3">计分规则</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    基础分: 每个达标回合 +100分
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    成本扣分: (实际成本/最优成本) × 50分
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                    搅拌不足扣分: 每次 -20分
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    超量投加扣分: 每次 -30分
                  </li>
                </ul>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h3 className="font-semibold text-white mb-3">星级评价</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★★★</span>
                    <span className="text-slate-400">得分率 ≥ 80%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★★</span>
                    <span className="text-slate-400">得分率 ≥ 50%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    <span className="text-slate-400">得分率 ≥ 20%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
