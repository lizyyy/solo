import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  FileText,
  FlaskConical,
  AlertOctagon,
  ArrowRight,
  Play
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';

const steps = [
  { step: 1, title: '导入阈值调参笔记', description: '小孟导入调参记录，系统自动检测时间窗穿越', icon: FileText },
  { step: 2, title: '查看线上实验桶', description: '补看历史实验数据，补录旧口径数据', icon: FlaskConical },
  { step: 3, title: '更新异常样本页', description: '异常样本自动更新，时间窗虚高标记待复核', icon: AlertOctagon },
];

const sampleTypes = [
  {
    type: 'normal',
    title: '顺利记录',
    description: '正常统计窗口内的数据，效果指标真实可靠',
    icon: CheckCircle2,
    color: 'success',
    borderColor: 'border-success-500/50',
    bgColor: 'bg-success-500/10',
  },
  {
    type: 'time_window',
    title: '时间窗穿越虚高',
    description: '跨统计周期的数据，唤醒率和误唤醒率可能失真',
    icon: AlertTriangle,
    color: 'warning',
    borderColor: 'border-warning-500/50',
    bgColor: 'bg-warning-500/10',
  },
  {
    type: 'old_caliber',
    title: '旧口径补录数据',
    description: '从线上实验桶补录的历史数据，口径版本不同',
    icon: Clock,
    color: 'primary',
    borderColor: 'border-primary-500/50',
    bgColor: 'bg-primary-500/10',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { thresholdNotes, anomalies, currentStep, importDemoData, experiments } = useAppStore();
  
  const stats = {
    total: thresholdNotes.length,
    normal: thresholdNotes.filter(n => n.status === 'normal').length,
    pending: anomalies.filter(a => a.status === 'pending_review').length,
    reviewed: anomalies.filter(a => a.status === 'reviewed').length,
  };
  
  return (
    <div className="space-y-8">
      <div className="animate-stagger">
        <h1 className="text-2xl font-bold text-white">语音唤醒阈值校准</h1>
        <p className="text-slate-400 mt-1">演示系统 - 完整展示阈值校准的三种典型处理流程</p>
      </div>
      
      <div className="grid grid-cols-4 gap-4 animate-stagger" style={{ animationDelay: '100ms' }}>
        {[
          { label: '总记录数', value: stats.total, color: 'text-primary-400' },
          { label: '正常记录', value: stats.normal, color: 'text-success-400' },
          { label: '待复核', value: stats.pending, color: 'text-warning-400' },
          { label: '已复核', value: stats.reviewed, color: 'text-slate-400' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-slate-400 text-sm">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      
      <div className="glass-card p-6 animate-stagger" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">校准流程三步法</h2>
          <span className="text-sm text-slate-400">当前进度：第 {Math.min(currentStep + 1, 3)} 步</span>
        </div>
        
        <div className="relative">
          <div className="absolute top-6 left-8 right-8 h-0.5 bg-slate-700">
            <div 
              className="h-full bg-primary-500 transition-all duration-500"
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4 relative z-10">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              
              return (
                <div 
                  key={i}
                  className={`flex flex-col items-center text-center p-4 rounded-xl transition-all ${
                    isCurrent ? 'bg-primary-500/10 ring-2 ring-primary-500/50' : ''
                  }`}
                >
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all ${
                      isCompleted 
                        ? 'bg-success-500 text-white' 
                        : isCurrent 
                          ? 'bg-primary-500 text-white animate-pulse-soft' 
                          : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                  </div>
                  <h3 className="font-medium text-white">{s.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">{s.description}</p>
                  <span className="mt-2 text-xs font-medium px-2 py-1 rounded-full bg-slate-700/50 text-slate-400">
                    第 {i + 1} 步
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="animate-stagger" style={{ animationDelay: '300ms' }}>
        <h2 className="text-lg font-semibold text-white mb-4">三种样本类型</h2>
        <div className="grid grid-cols-3 gap-4">
          {sampleTypes.map((sample, i) => {
            const Icon = sample.icon;
            return (
              <div 
                key={i}
                className={`glass-card-hover p-5 border-l-4 ${sample.borderColor} ${sample.bgColor}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sample.bgColor}`}>
                    <Icon className={`text-${sample.color}-400`} size={20} />
                  </div>
                  <StatusBadge status={sample.type === 'time_window' ? 'time_window' : sample.type as any} />
                </div>
                <h3 className="text-white font-semibold mt-4">{sample.title}</h3>
                <p className="text-sm text-slate-400 mt-2">{sample.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <button 
                    onClick={() => navigate('/anomalies')}
                    className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    查看详情 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 animate-stagger" style={{ animationDelay: '400ms' }}>
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4">快速开始</h3>
          <p className="text-sm text-slate-400 mb-4">
            点击下方按钮，一键导入演示数据，体验完整的校准流程
          </p>
          <button
            onClick={importDemoData}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Play size={18} />
            导入演示数据（正常+时间窗虚高）
          </button>
        </div>
        
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4">下一步操作</h3>
          <div className="space-y-2">
            {[
              { text: '去阈值调参笔记查看数据', path: '/notes' },
              { text: '去线上实验桶补录旧口径', path: '/experiments' },
              { text: '去异常样本页处理异常', path: '/anomalies' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg text-sm text-slate-300 transition-colors"
              >
                {item.text}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
