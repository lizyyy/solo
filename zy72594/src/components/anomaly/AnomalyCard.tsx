import { AlertCircle, Package, User, ArrowRight, Clock } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import type { AnomalySample } from '../../types';

interface AnomalyCardProps {
  anomaly: AnomalySample;
  sampleContent: string;
}

export function AnomalyCard({ anomaly, sampleContent }: AnomalyCardProps) {
  const isPlatformOwner = anomaly.nextOwner.includes('实验平台');

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isPlatformOwner ? 'bg-amber-100' : 'bg-rose-100'
            }`}>
              <AlertCircle size={20} className={isPlatformOwner ? 'text-amber-600' : 'text-rose-600'} />
            </div>
            <div>
              <h4 className="font-medium text-slate-800">异常样本分析</h4>
              <p className="text-xs text-slate-500">{anomaly.createTime}</p>
            </div>
          </div>
          <StatusBadge status={anomaly.status} type="anomaly" />
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">样本内容</p>
            <p className="text-sm text-slate-700">{sampleContent}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> 为什么被留下
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{anomaly.reason}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <Package size={12} /> 还缺什么材料
            </p>
            <p className="text-sm text-slate-700">{anomaly.missingMaterials}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">下一步找谁</p>
                <p className={`text-sm font-medium ${
                  isPlatformOwner ? 'text-amber-700' : 'text-sky-700'
                }`}>
                  {anomaly.nextOwner}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight size={14} className="text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">下一步做什么</p>
                <p className="text-sm text-slate-700">{anomaly.nextAction}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {anomaly.sampleId === 'neg-003' && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
          <Clock size={14} className="text-amber-600" />
          <span className="text-xs text-amber-700 font-medium">
            时间窗穿越问题，已留给实验平台负责人复核，暂不归为正常
          </span>
        </div>
      )}
    </div>
  );
}
