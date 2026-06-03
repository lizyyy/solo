import React from 'react';
import { CheckCircle2, AlertTriangle, History, FileText } from 'lucide-react';

export const Legend: React.FC = () => {
  return (
    <div className="bg-industrial-card rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-industrial-text mb-3">记录类型说明</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-industrial-bg">
          <CheckCircle2 className="w-5 h-5 text-status-normal flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-industrial-text">正常 ✓</div>
            <div className="text-xs text-industrial-muted">
              数据完整，计算顺利，无异常
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-industrial-bg">
          <AlertTriangle className="w-5 h-5 text-status-pending flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-industrial-text">待复核 ⚠</div>
            <div className="text-xs text-industrial-muted">
              补录路线未重算长度，留待客户确认
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-industrial-bg">
          <History className="w-5 h-5 text-status-oldCaliber flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-industrial-text">旧口径 ✓</div>
            <div className="text-xs text-industrial-muted">
              从CAD图层名补入2023版旧口径数据
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-industrial-bg">
          <FileText className="w-5 h-5 text-industrial-muted flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-industrial-text">临时数据</div>
            <div className="text-xs text-industrial-muted">
              等待导入或补录，尚未处理
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
