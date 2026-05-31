import { Receipt, FileText, Mail, PenTool, Clock } from 'lucide-react';
import { Material, MaterialType, MaterialTypeLabel } from '../../types';
import { formatCurrency } from '../../utils/exportUtil';

interface MaterialTimelineProps {
  materials: Material[];
}

const typeIcons: Record<MaterialType, React.ReactNode> = {
  [MaterialType.PAYMENT]: <Receipt className="w-5 h-5" />,
  [MaterialType.REFUND]: <FileText className="w-5 h-5" />,
  [MaterialType.APPROVAL]: <Mail className="w-5 h-5" />,
  [MaterialType.HANDWRITTEN]: <PenTool className="w-5 h-5" />,
};

const typeColors: Record<MaterialType, string> = {
  [MaterialType.PAYMENT]: 'bg-blue-100 text-blue-700',
  [MaterialType.REFUND]: 'bg-orange-100 text-orange-700',
  [MaterialType.APPROVAL]: 'bg-green-100 text-green-700',
  [MaterialType.HANDWRITTEN]: 'bg-purple-100 text-purple-700',
};

export default function MaterialTimeline({ materials }: MaterialTimelineProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">材料清单</h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="space-y-6">
          {materials.map((material) => (
            <div key={material.id} className="relative pl-14">
              <div
                className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${typeColors[material.type]}`}
              >
                {typeIcons[material.type]}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700 mr-2">
                      {MaterialTypeLabel[material.type]}
                    </span>
                    <span className="font-medium text-gray-900">{material.title}</span>
                  </div>
                  {material.amount && (
                    <span className="font-semibold text-primary-700">
                      {formatCurrency(material.amount)}
                    </span>
                  )}
                </div>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans mb-2">
                  {material.content}
                </pre>
                <div className="flex items-center text-xs text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{material.createdAt}</span>
                  <span className="mx-2">·</span>
                  <span>来源: {material.source}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
