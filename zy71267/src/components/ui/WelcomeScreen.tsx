import { Activity, Eye, FileWarning, CheckCircle, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onLoadDemo: (type: 'normal' | 'anomaly') => Promise<void>;
  isLoading: boolean;
}

export function WelcomeScreen({ onLoadDemo, isLoading }: WelcomeScreenProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.1) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

      <div className="relative z-10 max-w-4xl w-full px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-2xl shadow-blue-500/30">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            音乐厅混响声场
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mt-2">
              可视化分析系统
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            为声学顾问打造的专业3D可视化工具，直观展示音乐厅座位区的混响特性和声波反射路径，
            让复杂的声学数据一目了然
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-12">
          <FeatureCard
            icon={<Eye className="w-6 h-6 text-blue-400" />}
            title="3D声场可视化"
            description="实时渲染混响时间、声压级、清晰度等参数的空间分布"
            color="blue"
          />
          <FeatureCard
            icon={<FileWarning className="w-6 h-6 text-amber-400" />}
            title="智能异常检测"
            description="自动识别材料缺失、路径过密、采样错误等数据问题"
            color="amber"
          />
          <FeatureCard
            icon={<CheckCircle className="w-6 h-6 text-emerald-400" />}
            title="一键报告导出"
            description="生成包含截图、参数统计、异常标注的专业PDF报告"
            color="emerald"
          />
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 text-center">
            选择演示数据开始体验
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              className="group p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-400/30 hover:border-emerald-400/50 hover:from-emerald-500/20 hover:to-emerald-600/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onLoadDemo('normal')}
              disabled={isLoading}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <h4 className="text-base font-semibold text-emerald-300 mb-1">标准演示流程</h4>
              <p className="text-sm text-slate-400">
                完整的音乐厅声学数据，无异常。体验从数据导入、参数切换到报告导出的完整工作流
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">192 座位</span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">800 射线</span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">无异常</span>
              </div>
            </button>

            <button
              className="group p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-400/30 hover:border-amber-400/50 hover:from-amber-500/20 hover:to-red-500/20 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onLoadDemo('anomaly')}
              disabled={isLoading}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <FileWarning className="w-6 h-6 text-amber-400" />
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <h4 className="text-base font-semibold text-amber-300 mb-1">异常检测演示</h4>
              <p className="text-sm text-slate-400">
                故意混入材料缺失、路径过密、采样错误等真实问题，验证系统的异常识别能力
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">材料缺失</span>
                <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">路径过密</span>
                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">采样错误</span>
              </div>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          支持导入自定义JSON格式声学数据 · 支持厅堂模型、声源、座位区、材料吸声率、反射路径、声场报告
        </p>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'amber' | 'emerald';
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/10 border-blue-400/20 hover:border-blue-400/40',
    amber: 'from-amber-500/10 to-amber-600/10 border-amber-400/20 hover:border-amber-400/40',
    emerald: 'from-emerald-500/10 to-emerald-600/10 border-emerald-400/20 hover:border-emerald-400/40',
  };

  const iconBgClasses = {
    blue: 'bg-blue-500/20',
    amber: 'bg-amber-500/20',
    emerald: 'bg-emerald-500/20',
  };

  const titleClasses = {
    blue: 'text-blue-300',
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
  };

  return (
    <div className={`p-5 rounded-xl bg-gradient-to-br ${colorClasses[color]} border transition-all hover:scale-[1.02]`}>
      <div className={`w-12 h-12 rounded-xl ${iconBgClasses[color]} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h4 className={`text-base font-semibold ${titleClasses[color]} mb-2`}>{title}</h4>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
