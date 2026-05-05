import React, { useState } from 'react';
import type { DataValidationWarning } from '../types';

interface WarningAlertProps {
  warnings: DataValidationWarning[];
}

const WarningAlert: React.FC<WarningAlertProps> = ({ warnings }) => {
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null);

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'duplicate_order':
        return (
          <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'missing_booth':
        return (
          <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getWarningTitle = (type: string) => {
    switch (type) {
      case 'duplicate_order':
        return '重复订单号警告';
      case 'missing_booth':
        return '摊位数据缺失';
      default:
        return '数据警告';
    }
  };

  const getWarningBgColor = (type: string) => {
    switch (type) {
      case 'duplicate_order':
        return 'bg-warning/5 border-warning/20';
      case 'missing_booth':
        return 'bg-danger/5 border-danger/20';
      default:
        return 'bg-warning/5 border-warning/20';
    }
  };

  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => (
        <div
          key={index}
          className={`rounded-lg border p-4 ${getWarningBgColor(warning.type)}`}
        >
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedWarning(expandedWarning === warning.type ? null : warning.type)}
          >
            <div className="flex items-center gap-3">
              {getWarningIcon(warning.type)}
              <div>
                <h4 className="font-medium text-gray-800">{getWarningTitle(warning.type)}</h4>
                <p className="text-sm text-gray-600">{warning.message}</p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                expandedWarning === warning.type ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {expandedWarning === warning.type && warning.details.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">详情：</p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {warning.details.map((detail, idx) => (
                  <span key={idx} className="tag bg-white border border-gray-200 text-gray-600">
                    {detail}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WarningAlert;
