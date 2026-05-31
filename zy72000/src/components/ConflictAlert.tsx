import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { ConflictInfo } from '@/types';

interface ConflictAlertProps {
  conflicts: ConflictInfo[];
}

export default function ConflictAlert({ conflicts }: ConflictAlertProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-status-conflict-light border border-status-conflict rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-status-conflict flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-status-conflict-dark mb-3">
            发现数据冲突，请人工核对后处理
          </h4>
          <div className="space-y-4">
            {conflicts.map((conflict, index) => (
              <div key={index} className="bg-white rounded p-3 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                    {conflict.field}冲突
                  </span>
                  <span className="text-sm text-gray-500">差异：{conflict.diff}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">审批邮件说</p>
                    <p className="font-medium text-gray-900">{conflict.emailValue}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">导入数据说</p>
                    <p className="font-medium text-gray-900">{conflict.importValue}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600 bg-amber-50 p-2 rounded">
                  <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>{conflict.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
