import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { demoRecords, demoExplanations } from '@/data/demoData';
import { useInventoryStore } from '@/store/inventoryStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { DemoType } from '@/types';

const demoTypeConfig: Record<DemoType, {
  icon: React.ElementType;
  color: string;
  bgLight: string;
  borderColor: string;
}> = {
  smooth: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  missing_region: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  supplementary: {
    icon: RefreshCw,
    color: 'text-purple-600',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
};

export function DemoCenter() {
  const navigate = useNavigate();
  const { loadDemoData, records } = useInventoryStore();
  const [expandedCase, setExpandedCase] = useState<DemoType | null>(null);

  const handleLoadDemo = () => {
    loadDemoData();
  };

  const toggleCase = (type: DemoType) => {
    setExpandedCase(expandedCase === type ? null : type);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <PlayCircle className="w-8 h-8" />
              演示中心
            </h3>
            <p className="text-indigo-100 mb-4 max-w-xl">
              这里展示了艺人周边库存联动的三种典型场景。通过这些演示，新员工可以快速了解系统的处理流程和异常应对。
            </p>
            {records.length === 0 && (
              <button
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
              >
                <PlayCircle className="w-5 h-5" />
                加载演示数据
              </button>
            )}
          </div>
          <div className="hidden md:block">
            <Lightbulb className="w-32 h-32 text-white/20" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {(Object.keys(demoExplanations) as DemoType[]).map((type) => {
          const config = demoTypeConfig[type];
          const explanation = demoExplanations[type];
          const record = demoRecords.find(r => r.demoType === type);
          const Icon = config.icon;
          const isExpanded = expandedCase === type;

          return (
            <div 
              key={type}
              className={`bg-white rounded-xl border ${config.borderColor} shadow-sm overflow-hidden`}
            >
              <button
                onClick={() => toggleCase(type)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${config.bgLight} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-slate-800 text-lg">{explanation.title}</h4>
                    <p className="text-sm text-slate-500">{explanation.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {record && <StatusBadge status={record.status} />}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 border-t border-slate-100">
                  <div className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-slate-800 mb-4">处理流程</h5>
                      <div className="space-y-3">
                        {explanation.steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full ${config.bgLight} ${config.color} flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>
                              {index + 1}
                            </div>
                            <p className="text-sm text-slate-600">{step}</p>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-6 p-4 ${config.bgLight} rounded-lg border ${config.borderColor}`}>
                        <p className={`text-sm ${config.color} flex items-start gap-2`}>
                          <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span><strong>要点：</strong>{explanation.keyPoint}</span>
                        </p>
                      </div>
                    </div>

                    {record && (
                      <div>
                        <h5 className="font-medium text-slate-800 mb-4">演示数据</h5>
                        <div className={`p-4 rounded-lg border ${config.borderColor} ${config.bgLight}`}>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">艺人/活动</span>
                              <span className="font-medium text-slate-800">{record.artistName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">周边商品</span>
                              <span className="font-medium text-slate-800">{record.merchandise}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">数量</span>
                              <span className="font-medium text-slate-800">{record.quantity} 件</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-slate-500">授权地区</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {record.authorizedRegions.map((region, idx) => (
                                  <span 
                                    key={idx}
                                    className={`
                                      px-2 py-0.5 rounded text-xs
                                      ${region.isMissing 
                                        ? 'bg-red-100 text-red-700 line-through' 
                                        : 'bg-white text-slate-700 border border-slate-200'}
                                    `}
                                  >
                                    {region.city}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        {records.length > 0 && (
                          <button
                            onClick={() => navigate(`/records/${record.id}`)}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                          >
                            查看完整记录
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          给新人的流程讲解
        </h3>
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            <strong>第一步：调音师留言导入</strong> — 调音师把巡演周边的初始信息录入系统，包括艺人、商品、数量、授权地区等。
          </p>
          <p>
            <strong>第二步：系统自动校验</strong> — 系统会检查授权地区是否完整。标准巡演需要覆盖北京、上海、广州、深圳四城。
            如果少写了城市（比如深圳），系统会自动标记为"待店长复核"，不会让流程往下走。
          </p>
          <p>
            <strong>第三步：巡演统筹补看排练群接龙</strong> — 阿梅会对照排练群里的接龙信息，确认数量分配是否正确。
            如果发现接龙里有旧口径的数据没算进来，就需要标记"补录返工"。
          </p>
          <p>
            <strong>第四步：补录返工处理</strong> — 标记返工后，可以人工修正数量，然后点击"重跑校验"，系统会重新生成核销单。
            整个过程都会留痕，谁改了什么、什么时候改的，都能查到。
          </p>
          <p>
            <strong>第五步：生成课时核销单</strong> — 所有信息确认无误后，系统生成课时核销单，财务可以用来对账。
            如果核销单和历史记录对不上，系统会高亮显示差异。
          </p>
        </div>
      </div>
    </div>
  );
}
