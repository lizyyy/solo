import { motion } from 'framer-motion';
import { PlusCircle, Edit3, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ChangeRecord } from '@/types';

interface ChangeCardProps {
  change: ChangeRecord;
}

const typeConfig = {
  material: {
    icon: PlusCircle,
    bgColor: 'bg-material-light',
    borderColor: 'border-material/30',
    iconColor: 'text-material',
    label: '补材料',
    labelBg: 'bg-material/10 text-material-dark',
    description: '这是补充内容，不影响原有结论',
  },
  conclusion: {
    icon: Edit3,
    bgColor: 'bg-conclusion-light',
    borderColor: 'border-conclusion/30',
    iconColor: 'text-conclusion',
    label: '结论变更',
    labelBg: 'bg-conclusion/10 text-conclusion-dark',
    description: '请注意！这是重要的内容变更',
  },
};

const severityConfig = {
  low: { color: 'text-slate-500', label: '低' },
  medium: { color: 'text-amber-500', label: '中' },
  high: { color: 'text-red-500', label: '高' },
};

export default function ChangeCard({ change }: ChangeCardProps) {
  const config = typeConfig[change.type];
  const severity = severityConfig[change.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.iconColor} bg-white/50`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.labelBg}`}>
                {config.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/50 ${severity.color}`}>
                <AlertTriangle size={10} className="inline mr-1" />
                影响程度：{severity.label}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(change.timestamp).toLocaleString('zh-CN')}
              </span>
            </div>

            <h3 className="font-semibold text-slate-800 mb-2">{change.description}</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">变更前</p>
                <p className="text-sm text-slate-700 line-through decoration-red-400">
                  {change.oldValue || '(无)'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">变更后</p>
                <p className="text-sm text-slate-700 font-medium">
                  {change.newValue}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-white/60 rounded-lg">
              {change.type === 'material' ? (
                <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-conclusion mt-0.5 flex-shrink-0" />
              )}
              <p className="text-sm text-slate-600">{config.description}</p>
            </div>

            <p className="text-sm text-slate-600 mt-3 flex items-start gap-2">
              <span className="font-medium">💡 建议：</span>
              {change.suggestion}
            </p>

            <p className="text-xs text-slate-500 mt-2">
              📂 分类：{change.category} | 字段：{change.field}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
