import { ForemanViewData } from '../../types';
import { AlertTriangle, Shield, Info } from 'lucide-react';

interface ReasonCardProps {
  data: ForemanViewData;
}

const riskConfig = {
  low: {
    label: '低风险',
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-700/50',
    icon: Shield,
  },
  medium: {
    label: '中风险',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-700/50',
    icon: AlertTriangle,
  },
  high: {
    label: '高风险',
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/50',
    icon: AlertTriangle,
  },
};

export default function ReasonCard({ data }: ReasonCardProps) {
  const config = riskConfig[data.riskLevel];
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-6 ${config.bg}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${config.bg}`}>
          <Icon className={`w-8 h-8 ${config.color}`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-bold text-white">{data.deviceName}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} border`}>
              {config.label}
            </span>
          </div>

          <div className="mb-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Info className="w-3 h-3" />
              <span>故障原因说明（供值班长参考）</span>
            </div>
            <p className="text-white text-base leading-relaxed">
              {data.plainReason}
            </p>
          </div>

          <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">温馨提示</p>
            <p className="text-sm text-gray-400">
              请按照下方"下一步操作"指引执行。如有疑问，可点击详情查看原始数据和技术判断依据。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
