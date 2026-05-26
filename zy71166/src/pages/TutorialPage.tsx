import { useNavigate } from 'react-router-dom';
import {
  Thermometer,
  Fan,
  Zap,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  Home,
  ThermometerSnowflake,
  Flame,
  Wind,
} from 'lucide-react';

export default function TutorialPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: '温度管理',
      icon: Thermometer,
      items: [
        { icon: Thermometer, text: '机柜正常温度范围：18°C - 32°C' },
        { icon: AlertTriangle, text: '警告阈值：32°C - 38°C，机柜降额运行' },
        { icon: Flame, text: '危险阈值：38°C - 42°C，机柜保护停机' },
        { icon: AlertTriangle, text: '故障阈值：超过42°C，游戏失败！' },
      ],
    },
    {
      title: '空调控制',
      icon: Fan,
      items: [
        { icon: Wind, text: '空调设定温度越低，制冷量越大，但耗电越高' },
        { icon: Zap, text: '空调COP（能效比）随环境温度变化，高温时效率下降' },
        { icon: Fan, text: '多台空调协同工作，避免单台过载' },
        { icon: DollarSign, text: '长时间开启空调会增加电费支出' },
      ],
    },
    {
      title: '负载迁移',
      icon: ArrowRightLeft,
      items: [
        { icon: Zap, text: '机柜负载越高，产热越多，温度上升越快' },
        { icon: ArrowRightLeft, text: '将高负载机柜的任务迁移到低负载机柜' },
        { icon: AlertTriangle, text: '迁移有8%失败概率，失败会造成负载抖动' },
        { icon: ThermometerSnowflake, text: '合理分配负载，避免局部热点' },
      ],
    },
    {
      title: '电价策略',
      icon: DollarSign,
      items: [
        { icon: DollarSign, text: '谷时（23:00-07:00）：0.2元/kWh，建议开足空调' },
        { icon: DollarSign, text: '平时（07:00-10:00, 15:00-19:00）：0.5元/kWh' },
        { icon: DollarSign, text: '峰时（10:00-15:00, 19:00-23:00）：0.8元/kWh，需节能' },
        { icon: AlertTriangle, text: '总电费不得超过预算，否则游戏失败！' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-cyan-400">玩法说明</h1>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Home size={18} />
            返回主菜单
          </button>
        </div>

        <div className="space-y-8">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <h2 className="text-xl font-bold text-cyan-300 flex items-center gap-2">
                  <section.icon size={24} />
                  {section.title}
                </h2>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg">
                    <div className="text-cyan-400 mt-0.5">
                      <item.icon size={18} />
                    </div>
                    <p className="text-slate-300 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
              <h2 className="text-xl font-bold text-cyan-300">评分规则</h2>
            </div>
            <div className="p-4 space-y-3">
              {[
                '生存奖励：每回合 +100 分',
                '温度奖励：机柜温度每低于目标温度1°C，+50分',
                '电费扣减：实际电费占预算比例越高，扣分越多',
                '负载均衡：机柜负载越均衡，额外加分越多',
                '告警惩罚：有过热告警会扣分',
                '最终评级：S/A/B/C/D，根据总分和回合数评定',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <span className="text-cyan-400">•</span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20 p-6">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">操作流程</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: 1, title: '观察状态', desc: '查看机柜温度、负载和空调运行情况' },
                { step: 2, title: '执行操作', desc: '开关空调、调整设定温度、迁移负载' },
                { step: 3, title: '推进回合', desc: '点击"下一回合"，系统计算温度变化和事件' },
              ].map((s) => (
                <div key={s.step} className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-900 flex items-center justify-center text-sm font-bold">
                      {s.step}
                    </span>
                    <span className="text-cyan-300 font-medium">{s.title}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
