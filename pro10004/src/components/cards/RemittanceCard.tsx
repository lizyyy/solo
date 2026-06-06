import React from 'react';
import { Remittance } from '../../types';
import { StatusBadge } from '../status/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { User, Building2, Calendar, FileText, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RemittanceCardProps {
  remittance: Remittance;
}

export const RemittanceCard: React.FC<RemittanceCardProps> = ({ remittance }) => {
  const navigate = useNavigate();
  const hasCrossSettlement = !!remittance.crossSettlementAnalysis;
  const hasMultipleNotes = remittance.manualNotes.length > 1;
  const hasConflictingNotes = hasMultipleNotes && remittance.manualNotes.some((n, i, arr) =>
    i > 0 && n.content !== arr[0].content
  );

  return (
    <div
      onClick={() => navigate(`/remittance/${remittance.id}`)}
      className="bg-white rounded-lg border border-slate-200 p-4 cursor-pointer transition-all hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-mono text-xs text-slate-500 font-medium">{remittance.transactionId}</p>
          <p className="text-base font-semibold text-slate-900 mt-0.5 group-hover:text-blue-600 transition-colors">
            {formatCurrency(remittance.amount, remittance.currency)}
          </p>
        </div>
        <StatusBadge status={remittance.status} size="sm" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate" title={remittance.payer}>{remittance.payer}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate" title={remittance.payee}>{remittance.payee}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{formatDate(remittance.transactionDate)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FileText className="w-3 h-3" />
          <span>{remittance.ruleHits.length} 条规则</span>
        </div>
        {hasCrossSettlement && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            跨清算日
          </span>
        )}
        {hasConflictingNotes && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            说明存疑
          </span>
        )}
      </div>
    </div>
  );
};
