import React from 'react';
import { MaterialItem, MATERIAL_TYPE_LABELS } from '../types';

interface MaterialCardProps {
  material: MaterialItem;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bank_receipt':
        return '💳';
      case 'business_ledger':
        return '📊';
      case 'screenshot':
        return '📸';
      case 'contract_scan':
        return '📄';
      case 'supplement':
        return '📝';
      default:
        return '📎';
    }
  };

  return (
    <div className="material-card bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getTypeIcon(material.type)}</span>
          <div>
            <p className="font-medium text-gray-900">{material.name}</p>
            <p className="text-sm text-gray-500">
              {MATERIAL_TYPE_LABELS[material.type]} · {material.uploadTime}
            </p>
          </div>
        </div>
        {material.isDirty && (
          <span className="px-2 py-1 bg-warning text-white text-xs rounded">
            脏数据
          </span>
        )}
      </div>
      {material.formatNote && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          ⚠️ {material.formatNote}
        </div>
      )}
    </div>
  );
};

export default MaterialCard;
