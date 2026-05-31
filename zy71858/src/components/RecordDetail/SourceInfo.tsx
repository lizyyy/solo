import { FileText, User, Calendar, Tag } from 'lucide-react';
import { SunshineRecord } from '@/types';
import { formatDate } from '@/utils/statusUtils';

interface SourceInfoProps {
  record: SunshineRecord;
}

export function SourceInfo({ record }: SourceInfoProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary-600" />
        来源信息
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Tag className="w-4 h-4" />
            来源
          </div>
          <div className="font-medium text-slate-800">{record.source}</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <User className="w-4 h-4" />
            导入人
          </div>
          <div className="font-medium text-slate-800">{record.importer}</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            导入时间
          </div>
          <div className="font-medium text-slate-800">
            {formatDate(record.importTime)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Tag className="w-4 h-4" />
            导入方式
          </div>
          <div className="font-medium text-slate-800">
            {record.sourceType === 'import' ? '批量导入' : '手动添加'}
          </div>
        </div>
      </div>

      {record.remark && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-sm text-slate-500 mb-1">备注</div>
          <div className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">
            {record.remark}
          </div>
        </div>
      )}
    </div>
  );
}
