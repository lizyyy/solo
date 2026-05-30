import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { 
  Calculator, 
  BarChart3, 
  History, 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  FileText,
  Thermometer,
  Zap,
  ArrowRight
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { records, loadAllRecords } = useAppStore();

  const features = [
    {
      icon: Shield,
      title: '可复算性保证',
      description: '相同输入永远产生相同结果，输入哈希校验确保数据完整性',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      icon: AlertTriangle,
      title: '智能异常检测',
      description: '自动检测7类异常参数，提供专业解释、影响分析和修复建议',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      icon: Clock,
      title: '时序证据链',
      description: '按处理顺序和时间戳双重排序，多源证据互相印证',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    {
      icon: FileText,
      title: '视图导出一致',
      description: '屏幕所见即导出所得，包含完整视图状态快照',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
  ];

  const stats = [
    { label: '已保存记录', value: records.length, icon: FileText },
    { label: '物理公式', value: 2, icon: Thermometer },
    { label: '异常类型', value: 7, icon: AlertTriangle },
    { label: '证据来源', value: 5, icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            科普馆声速实验专用工具
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
            声速温度校准表
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-8">
            可复算的声速校准计算工具，支持多维度异常检测、证据链追踪、
            视图导出一致性，让实验数据更可信、复盘更清晰
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/calculator')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
            >
              <Calculator className="w-5 h-5" />
              开始校准计算
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/charts')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all border border-slate-700"
            >
              <BarChart3 className="w-5 h-5" />
              查看数据图表
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 text-center"
            >
              <stat.icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-10">核心特性</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`${feature.bgColor} rounded-2xl p-6 border ${feature.borderColor} hover:scale-[1.02] transition-transform`}
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10 rounded-2xl p-8 border border-blue-500/20 mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">使用流程</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: 1, title: '录入参数', desc: '填写温度、测距、时间差等实验参数' },
              { step: 2, title: '执行计算', desc: '系统自动计算理论值与测量值并对比' },
              { step: 3, title: '查看证据', desc: '检查异常解释、证据链和计算步骤' },
              { step: 4, title: '保存导出', desc: '保存记录，导出报告或CSV数据' },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-6 left-1/2 w-full h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">物理公式参考</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">温度法理论声速</h3>
                  <p className="text-xs text-slate-500">基于理想气体模型</p>
                </div>
              </div>
              <code className="block text-white font-mono bg-slate-800 px-4 py-3 rounded-lg text-center">
                v = 331.45 × √(1 + T/273.15)
              </code>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <p><span className="text-slate-400">v</span> — 声速 (m/s)</p>
                <p><span className="text-slate-400">T</span> — 环境温度 (℃)</p>
                <p><span className="text-slate-400">331.45</span> — 0℃时的声速 (m/s)</p>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">测距法测量声速</h3>
                  <p className="text-xs text-slate-500">基于距离与时间差</p>
                </div>
              </div>
              <code className="block text-white font-mono bg-slate-800 px-4 py-3 rounded-lg text-center">
                v = distance / time
              </code>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <p><span className="text-slate-400">v</span> — 声速 (m/s)</p>
                <p><span className="text-slate-400">distance</span> — 传播距离 (m)</p>
                <p><span className="text-slate-400">time</span> — 传播时间 (s)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm">
            声速温度校准表 v1.0 · 可复算性计算工具 · 科普馆实验专用
          </p>
        </div>
      </div>
    </div>
  );
}
