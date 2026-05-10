import React from 'react';
import { AlertTriangle, Clock, Activity } from 'lucide-react';
import { Injury } from '../types';

interface RiskAlertProps {
  injuries: Injury[];
  remainingSessions: number;
  hasLowSessions: boolean;
}

const RiskAlert: React.FC<RiskAlertProps> = ({ injuries, remainingSessions, hasLowSessions }) => {
  const activeInjuries = injuries.filter(i => i.isActive);

  return (
    <div className="space-y-3">
      {activeInjuries.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800 mb-2">伤病风险提示</h4>
              <div className="space-y-2">
                {activeInjuries.map((injury) => (
                  <div key={injury.id} className="text-sm text-red-700">
                    <span className="font-medium">{injury.bodyPart}</span>
                    <span className="mx-1">-</span>
                    <span className="text-red-600">{injury.severity}</span>
                    {injury.description && (
                      <p className="text-xs text-red-600 mt-1">{injury.description}</p>
                    )}
                    {injury.restrictedActions.length > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        限制动作: {injury.restrictedActions.join('、')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2">
                <Activity className="w-3 h-3 inline mr-1" />
                系统将自动限制与伤病部位相关的训练动作
              </p>
            </div>
          </div>
        </div>
      )}

      {hasLowSessions && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-800">课时余额提醒</h4>
              <p className="text-sm text-yellow-700">
                剩余课时不足：<span className="font-bold text-yellow-600">{remainingSessions}</span> 节
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                请及时提醒会员续课，避免影响正常训练
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAlert;
