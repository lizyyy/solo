import { AlertTriangle, User, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { AuthorizationAlert } from '@/types';
import { formatDateTime, getRoleLabel } from '@/utils';
import { useAppStore } from '@/stores/useAppStore';

interface AlertCardProps {
  alert: AuthorizationAlert;
}

export default function AlertCard({ alert }: AlertCardProps) {
  const { resolveAlert, currentRole } = useAppStore();
  const canResolve = currentRole === alert.assignee && !alert.isResolved;

  return (
    <div
      className={`rounded-2xl p-5 border transition-all ${
        alert.isResolved
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gradient-to-br from-accent-50 to-amber-50 border-accent-200 shadow-sm'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-xl ${
            alert.isResolved ? 'bg-emerald-500 text-white' : 'bg-accent-500 text-white'
          }`}
        >
          {alert.isResolved ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4
                className={`font-semibold ${
                  alert.isResolved ? 'text-emerald-800' : 'text-accent-900'
                }`}
              >
                {alert.title}
              </h4>
              <p className="text-xs text-primary-500 mt-1">
                {formatDateTime(alert.createdAt)}
              </p>
            </div>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                alert.assignee === 'recorder'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-primary-100 text-primary-700'
              }`}
            >
              <User className="w-3 h-3" />
              {getRoleLabel(alert.assignee)}
            </span>
          </div>

          <p
            className={`text-sm mt-3 leading-relaxed ${
              alert.isResolved ? 'text-emerald-700' : 'text-accent-800'
            }`}
          >
            {alert.reason}
          </p>

          {alert.missingMaterials.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-accent-700 flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5" />
                还缺以下材料：
              </p>
              <ul className="space-y-1">
                {alert.missingMaterials.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-accent-700 flex items-center gap-2 pl-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-accent-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p
              className={`text-sm font-medium flex items-center gap-1.5 ${
                alert.isResolved ? 'text-emerald-700' : 'text-accent-700'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              下一步：{alert.nextStep}
            </p>
            {canResolve && (
              <button
                onClick={() => resolveAlert(alert.id)}
                className="px-4 py-2 bg-accent-500 text-white text-sm font-medium rounded-lg hover:bg-accent-600 transition-colors shadow-sm"
              >
                标记已处理
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
