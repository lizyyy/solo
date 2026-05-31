import { Receipt, FileText, Mail, Database } from 'lucide-react';
import type { Material, MaterialType } from '@/types';
import { MATERIAL_TYPE_LABELS } from '@/data/constants';
import { formatCurrency, formatDate } from '@/utils';

const iconMap: Record<MaterialType, typeof Receipt> = {
  receipt: Receipt,
  refund: FileText,
  email: Mail,
  import: Database,
};

const borderColorMap: Record<MaterialType, string> = {
  receipt: 'border-green-200',
  refund: 'border-blue-200',
  email: 'border-amber-200',
  import: 'border-purple-200',
};

const bgColorMap: Record<MaterialType, string> = {
  receipt: 'bg-green-50',
  refund: 'bg-blue-50',
  email: 'bg-amber-50',
  import: 'bg-purple-50',
};

const iconColorMap: Record<MaterialType, string> = {
  receipt: 'text-green-600',
  refund: 'text-blue-600',
  email: 'text-amber-600',
  import: 'text-purple-600',
};

interface MaterialCardProps {
  material?: Material;
  type: MaterialType;
  hasConflict?: boolean;
}

export default function MaterialCard({ material, type, hasConflict }: MaterialCardProps) {
  const Icon = iconMap[type];
  const label = MATERIAL_TYPE_LABELS[type];

  if (!material) {
    return (
      <div className={`card p-4 ${bgColorMap[type]} border-l-4 ${borderColorMap[type]} opacity-60`}>
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-5 h-5 ${iconColorMap[type]}`} />
          <span className="font-medium text-gray-700">{label}</span>
        </div>
        <div className="text-sm text-gray-500 italic">
          暂无此材料
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-4 ${bgColorMap[type]} border-l-4 ${hasConflict ? 'border-red-400 ring-1 ring-red-200' : borderColorMap[type]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${iconColorMap[type]}`} />
        <span className="font-medium text-gray-700">{label}</span>
        {hasConflict && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
            有差异
          </span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">金额</span>
          <span className={`font-medium text-currency ${hasConflict ? 'text-red-600' : 'text-gray-900'}`}>
            {formatCurrency(material.amount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">日期</span>
          <span className={hasConflict ? 'text-red-600' : 'text-gray-900'}>
            {formatDate(material.date)}
          </span>
        </div>
        <div className="pt-2 border-t border-gray-200">
          <p className="text-gray-500 text-xs mb-1">来源：{material.source}</p>
          <p className="text-gray-600 text-xs leading-relaxed">{material.content}</p>
        </div>
      </div>
    </div>
  );
}
