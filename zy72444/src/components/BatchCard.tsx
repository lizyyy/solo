import { Link } from 'react-router-dom';
import { Clock, Users, Ticket, AlertTriangle, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { Batch, ProcessStep } from '@/types';
import { formatDate, getTicketTypeLabel } from '@/utils';

interface BatchCardProps {
  batch: Batch;
  processStep?: ProcessStep;
}

export default function BatchCard({ batch, processStep }: BatchCardProps) {
  const statusConfig = {
    pending: { label: '待处理', color: 'bg-slate-100 text-slate-700', icon: Clock },
    reviewing: { label: '待复核', color: 'bg-accent-100 text-accent-700', icon: AlertTriangle },
    authorized: { label: '已授权', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    rejected: { label: '已退回', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const status = statusConfig[batch.status];
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/batch/${batch.id}`}
      className={`group glass rounded-2xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-slide-up ${
        batch.hasMixedType
          ? 'border-accent-300 gradient-border'
          : 'border-white/50 hover:border-primary-200'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary-900 group-hover:text-primary-700 transition-colors">
            {batch.name}
          </h3>
          <p className="text-sm text-primary-500 mt-1">{formatDate(batch.date)}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${status.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </span>
      </div>

      {batch.hasMixedType && (
        <div className="mb-4 px-3 py-2 bg-accent-50 rounded-lg border border-accent-200">
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            存在赠票与售票混批，需录音师复核
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-primary-50/80 rounded-lg">
          <Users className="w-4 h-4 text-primary-600 mx-auto mb-1" />
          <p className="text-lg font-semibold text-primary-800">{batch.totalCount}</p>
          <p className="text-xs text-primary-500">总人次</p>
        </div>
        <div className="text-center p-2 bg-sky-50/80 rounded-lg">
          <Ticket className="w-4 h-4 text-sky-600 mx-auto mb-1" />
          <p className="text-lg font-semibold text-sky-800">{batch.freeTicketCount}</p>
          <p className="text-xs text-sky-500">{getTicketTypeLabel('free')}</p>
        </div>
        <div className="text-center p-2 bg-emerald-50/80 rounded-lg">
          <Ticket className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <p className="text-lg font-semibold text-emerald-800">{batch.paidTicketCount}</p>
          <p className="text-xs text-emerald-500">{getTicketTypeLabel('paid')}</p>
        </div>
      </div>

      {processStep && (
        <div className="border-t border-primary-100 pt-4">
          <div className="flex items-center justify-between text-xs text-primary-600">
            <span>处理进度</span>
            <span>第 {processStep.currentStep} / 3 步</span>
          </div>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  step <= processStep.currentStep
                    ? step <= (processStep.step1Completed && 1) || step <= (processStep.step2Completed && 2) || step <= (processStep.step3Completed && 3)
                      ? 'bg-primary-500'
                      : 'bg-primary-300'
                    : 'bg-primary-100'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end text-primary-600 group-hover:text-primary-700">
        <span className="text-sm font-medium">查看详情</span>
        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
