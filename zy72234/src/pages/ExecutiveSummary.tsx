import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  HelpCircle,
  Package,
  User,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import { ROLE_LABELS } from '@shared/types';

export default function ExecutiveSummary() {
  const navigate = useNavigate();
  const { getExecutiveSummary, navigateToAdjustmentOrCustody } = useClearingStore();
  const summaryItems = getExecutiveSummary();

  if (summaryItems.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">负责人摘要</h1>
          <p className="text-carbon-500 mt-1">待确认事项汇总</p>
        </div>
        <div className="bg-white rounded-xl p-12 text-center shadow-card">
          <CheckCircle className="w-16 h-16 text-finance-green mx-auto mb-4 opacity-50" />
          <p className="text-carbon-500 text-lg">太棒了！没有需要关注的冲正记录～</p>
          <p className="text-carbon-400 mt-2">所有记录都已处理完毕</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_custody':
        return 'border-warning-orange';
      case 'pending_review':
        return 'border-risk-red';
      case 'needs_verification':
        return 'border-warning-orange';
      case 'reviewed_normal':
        return 'border-finance-green';
      default:
        return 'border-carbon-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_custody':
      case 'pending_review':
      case 'needs_verification':
        return <AlertTriangle className="w-5 h-5 text-warning-orange" />;
      case 'reviewed_normal':
        return <CheckCircle className="w-5 h-5 text-finance-green" />;
      default:
        return <Clock className="w-5 h-5 text-carbon-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">负责人摘要</h1>
          <p className="text-carbon-500 mt-1">
            共 {summaryItems.length} 条冲正记录需要关注
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-summary-gold-light/30 to-summary-gold-light rounded-xl p-6 border border-summary-gold/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-summary-gold-light rounded-lg flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-6 h-6 text-summary-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-carbon-800 mb-1">给负责人的话</h3>
            <p className="text-sm text-carbon-600">
              您好！这里汇总了所有金额为0但备注"已冲正"的记录。这些记录系统不敢自动归档，需要风控同事人工确认。
              每条记录都标注了"为什么留下"、"缺什么"、"找谁"，方便您快速了解情况并推进处理。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {summaryItems.map((item, index) => (
          <div
            key={item.adjustmentId}
            className={`bg-white rounded-xl shadow-card overflow-hidden border-l-4 ${getStatusColor(item.status)} animate-slide-up`}
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-carbon-800 font-mono text-lg">
                        {item.adjustmentNo}
                      </h3>
                      <StatusBadge
                        status={item.status}
                        amount={item.amount}
                        remark={item.remark}
                      />
                    </div>
                    <p className="text-sm text-carbon-500 mt-1">
                      交易日：{item.tradeDate} · 金额：<AmountDisplay amount={item.amount} /> · {item.remark}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-carbon-400">
                  <p>最后更新</p>
                  <p>{item.updatedAt}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-risk-red-light/30 rounded-lg p-4 border border-risk-red/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-risk-red-light rounded flex items-center justify-center">
                      <HelpCircle className="w-3.5 h-3.5 text-risk-red" />
                    </div>
                    <h4 className="font-semibold text-carbon-800 text-sm">为什么留下</h4>
                  </div>
                  <p className="text-sm text-carbon-600 leading-relaxed">{item.whyKept}</p>
                </div>

                <div className="bg-warning-orange-light/30 rounded-lg p-4 border border-warning-orange/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-warning-orange-light rounded flex items-center justify-center">
                      <Package className="w-3.5 h-3.5 text-warning-orange" />
                    </div>
                    <h4 className="font-semibold text-carbon-800 text-sm">缺什么</h4>
                  </div>
                  {item.missingMaterials.length > 0 ? (
                    <ul className="text-sm text-carbon-600 space-y-1">
                      {item.missingMaterials.map((m, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-warning-orange">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-finance-green">材料齐全，无需补充</p>
                  )}
                </div>

                <div className="bg-custody-blue-light/30 rounded-lg p-4 border border-custody-blue/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-custody-blue-light rounded flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-custody-blue" />
                    </div>
                    <h4 className="font-semibold text-carbon-800 text-sm">找谁</h4>
                  </div>
                  <p className="text-sm text-carbon-600 leading-relaxed mb-2">{item.nextStep}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-carbon-100 text-carbon-600 rounded">
                      联系人：{item.contactPerson}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-custody-blue-light text-custody-blue rounded">
                      {ROLE_LABELS[item.contactRole]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-carbon-100 flex items-center justify-between">
                {item.custody && (
                  <div className="text-sm text-carbon-500">
                    托管凭证：
                    <span className="text-custody-blue font-mono ml-1">{item.custody.voucherNo}</span>
                  </div>
                )}
                {!item.custody && item.status === 'pending_custody' && (
                  <div className="text-sm text-warning-orange flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    暂无托管凭证，需要小周补录
                  </div>
                )}
                <button
                  onClick={() => navigateToAdjustmentOrCustody(item.adjustmentId, navigate)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors text-sm font-medium"
                >
                  {item.custody ? '查看托管页' : '查看详情'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-card">
        <h3 className="font-semibold text-carbon-800 mb-3">📋 处理流程</h3>
        <div className="flex items-center justify-between relative">
          <div className="absolute top-4 left-8 right-8 h-0.5 bg-carbon-200" />
          {[
            { step: 1, title: '数据导入', desc: '小周导入清算数据' },
            { step: 2, title: '补托管页', desc: '补录托管凭证' },
            { step: 3, title: '风控复核', desc: '李工人工确认' },
            { step: 4, title: '归档完成', desc: '记录正常归档' },
          ].map((step, index) => (
            <div key={step.step} className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                index < summaryItems.filter(s => s.status === 'reviewed_normal').length
                  ? 'bg-finance-green'
                  : index === summaryItems.filter(s => s.status === 'reviewed_normal').length
                  ? 'bg-custody-blue shadow-lg shadow-custody-blue/30'
                  : 'bg-carbon-300'
              }`}>
                {step.step}
              </div>
              <p className="mt-2 text-sm font-medium text-carbon-800">{step.title}</p>
              <p className="text-xs text-carbon-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
