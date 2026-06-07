import { FlaskConical, Download, CheckCircle2, AlertTriangle, Clock, Tag } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';

export default function Experiments() {
  const { experiments, importFromExperiment } = useAppStore();
  
  const handleImport = (expId: string) => {
    importFromExperiment(expId);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-stagger">
        <div>
          <h1 className="text-2xl font-bold text-white">线上实验桶</h1>
          <p className="text-slate-400 mt-1">查看历史实验数据，支持补录旧口径数据到当前校准</p>
        </div>
      </div>
      
      <div className="glass-card p-4 animate-stagger" style={{ animationDelay: '100ms' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <Tag className="text-primary-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-medium">关于口径版本</h3>
            <p className="text-sm text-slate-400 mt-1">
              不同的实验可能使用不同的统计口径。旧口径数据（v1.0）和新口径（v2.0+）的统计方式有差异，
              补录时会自动标记为"旧口径"类型的异常样本，需要注意区分。
            </p>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {experiments.map((exp, index) => (
          <div 
            key={exp.id}
            className={`glass-card-hover overflow-hidden animate-stagger ${
              exp.isOldCaliber ? 'border-l-4 border-primary-500' : ''
            }`}
            style={{ animationDelay: `${(index + 2) * 100}ms` }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    exp.isOldCaliber ? 'bg-primary-500/20' : 'bg-slate-700/50'
                  }`}>
                    <FlaskConical 
                      className={exp.isOldCaliber ? 'text-primary-400' : 'text-slate-400'} 
                      size={24} 
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold text-lg">{exp.experimentName}</h3>
                      {exp.isOldCaliber && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                          旧口径
                        </span>
                      )}
                      {exp.imported && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-success-500/20 text-success-400 border border-success-500/30">
                          已补录
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{exp.description}</p>
                    
                    <div className="flex items-center gap-6 mt-3">
                      <div>
                        <p className="text-xs text-slate-500">口径版本</p>
                        <p className="font-mono text-sm text-slate-200">{exp.caliberVersion}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">阈值</p>
                        <p className="font-mono text-sm text-slate-200">{exp.threshold}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">唤醒率</p>
                        <p className="font-mono text-sm text-success-400">{exp.wakeRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">误唤醒率</p>
                        <p className="font-mono text-sm text-slate-200">{exp.falseAlarmRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">创建时间</p>
                        <p className="text-sm text-slate-400">
                          {new Date(exp.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <button
                    onClick={() => handleImport(exp.id)}
                    disabled={exp.imported}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      exp.imported
                        ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {exp.imported ? (
                      <>
                        <CheckCircle2 size={16} />
                        已补录
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        补录到当前校准
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {exp.isOldCaliber && !exp.imported && (
              <div className="px-5 py-3 bg-primary-500/10 border-t border-primary-500/20">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="text-primary-400" size={16} />
                  <span className="text-primary-300">
                    这是旧口径（{exp.caliberVersion}）数据，补录后会自动标记为异常样本，需要注意口径差异
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="glass-card p-5 animate-stagger" style={{ animationDelay: '500ms' }}>
        <h3 className="text-white font-semibold mb-4">补录说明</h3>
        <div className="space-y-3 text-sm text-slate-400">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0 text-xs">1</span>
            <p>点击"补录到当前校准"按钮，可以将实验桶中的历史数据补充到当前校准任务中</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0 text-xs">2</span>
            <p>旧口径数据（v1.0）补录后，会自动在异常样本页生成一条"旧口径"类型的异常记录</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0 text-xs">3</span>
            <p>新口径数据补录后，如果没有其他问题，会直接标记为正常状态</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center flex-shrink-0 text-xs">4</span>
            <p>已经补录过的数据不能重复补录，避免数据重复</p>
          </div>
        </div>
      </div>
    </div>
  );
}
