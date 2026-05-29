import { useNavigate } from 'react-router-dom';
import { Waves, Gauge, FileText, TrendingUp, ArrowRight, Zap, Shield, GitBranch, Download } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';

const features = [
  {
    icon: Zap,
    title: '能量估算',
    desc: '基于潮差、流速、叶轮面积、效率的势能与动能计算',
    color: 'text-tech-400',
    bgColor: 'bg-tech-500/10',
  },
  {
    icon: Gauge,
    title: '周期积分',
    desc: '梯形法积分潮汐周期分段，精确计算日/年发电量',
    color: 'text-ocean-300',
    bgColor: 'bg-ocean-500/10',
  },
  {
    icon: Shield,
    title: '设备约束',
    desc: '额定功率、最大流速、潮差范围自动校验拦截',
    color: 'text-success-400',
    bgColor: 'bg-success-500/10',
  },
  {
    icon: TrendingUp,
    title: '情景对比',
    desc: '最多4个情景并排对比，差异热力图一目了然',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: GitBranch,
    title: '可复算ID',
    desc: '相同输入产生相同ID，确保结果可追溯可复现',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  {
    icon: Download,
    title: '报告导出',
    desc: '一键导出PDF估算报告，包含完整参数和校验说明',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { loadSampleData } = useEstimationStore();

  const handleQuickStart = () => {
    loadSampleData();
    navigate('/estimate');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] animate-fade-in">
      <div className="text-center max-w-4xl mx-auto mb-16 pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tech-500/10 border border-tech-500/30 mb-6">
          <Waves className="w-4 h-4 text-tech-400" />
          <span className="text-sm text-tech-400 font-medium">海洋工程课程 · 教学工具</span>
        </div>
        
        <h1 className="text-5xl font-display font-bold gradient-text mb-6">
          潮汐能发电估算
        </h1>
        
        <p className="text-xl text-ocean-300 mb-8 max-w-2xl mx-auto leading-relaxed">
          输入潮差、流速、设备参数，自动计算发电量、校验设备约束、生成可复算报告。
          支持周期积分、多情景对比、错误透明化拦截。
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={handleQuickStart}
            className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-lg"
          >
            <Zap className="w-5 h-5" />
            快速开始（载入样例）
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/estimate')}
            className="btn-secondary inline-flex items-center gap-2 px-8 py-3.5 text-lg"
          >
            手动输入参数
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div
              key={idx}
              className="bg-ocean-700/30 backdrop-blur-sm rounded-2xl border border-ocean-600/50 p-6 hover:border-tech-500/50 hover:bg-ocean-700/50 transition-all duration-300 group animate-slide-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-ocean-400 leading-relaxed">{feature.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="bg-ocean-700/30 backdrop-blur-sm rounded-2xl border border-ocean-600/50 p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <FileText className="w-6 h-6 text-tech-400" />
            快速上手指南
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-tech-500/20 text-tech-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">输入参数</h4>
                <p className="text-sm text-ocean-400">填写潮差、流速、叶轮面积、效率，以及潮汐周期分段数据</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-tech-500/20 text-tech-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">查看校验</h4>
                <p className="text-sm text-ocean-400">实时校验面板会标出效率超标、周期缺段、单位混用等问题</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-tech-500/20 text-tech-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">执行计算</h4>
                <p className="text-sm text-ocean-400">点击"开始计算"获得势能、动能、日/年发电量结果</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-tech-500/20 text-tech-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">保存与对比</h4>
                <p className="text-sm text-ocean-400">保存记录获得可复算ID，添加到对比面板进行多情景分析</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-ocean-600/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-ocean-400">想看会失败的例子？</p>
                <p className="text-xs text-ocean-500">在估算页点击"载入无效样例"体验错误拦截</p>
              </div>
              <button
                onClick={() => navigate('/records')}
                className="btn-secondary text-sm"
              >
                <FileText className="w-4 h-4" />
                查看历史记录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}