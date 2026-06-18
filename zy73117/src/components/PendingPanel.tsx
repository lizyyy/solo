import { useState } from 'react';
import { Clock, ChevronUp, ChevronDown, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { getPendingMaterials } from '@/utils/traceEngine';

export function PendingPanel() {
  const materials = useStore((state) => state.materials);
  const records = useStore((state) => state.records);
  const selectMaterial = useStore((state) => state.selectMaterial);
  const selectedMaterialId = useStore((state) => state.selectedMaterialId);

  const [isExpanded, setIsExpanded] = useState(true);

  const pendingMaterials = getPendingMaterials(materials, records);

  if (pendingMaterials.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80">
      <div className="bg-industrial-800 border border-warning-700/50 rounded-lg shadow-xl overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between bg-warning-900/30 hover:bg-warning-900/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning-400 animate-pulse" />
            <span className="text-sm font-medium text-warning-200">
              待处理记录
            </span>
            <span className="badge bg-warning-900/50 text-warning-300">
              {pendingMaterials.length}条
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-warning-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-warning-400" />
          )}
        </button>

        {isExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {pendingMaterials.map((material) => (
              <div
                key={material.id}
                className={`p-3 border-b border-industrial-700 last:border-b-0 cursor-pointer transition-colors ${
                  selectedMaterialId === material.id
                    ? 'bg-primary-900/30'
                    : 'hover:bg-industrial-700/50'
                }`}
                onClick={() => selectMaterial(material.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-industrial-100 truncate">
                        {material.buildingNo} {material.materialType}
                      </span>
                    </div>
                    <p className="text-xs text-warning-300/80 mb-2 line-clamp-2">
                      {material.exceptionReason || '待处理事项'}
                    </p>
                    <div className="bg-industrial-900/50 rounded p-2 border border-industrial-700">
                      <p className="text-xs text-industrial-400 flex items-start gap-1.5">
                        <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary-400" />
                        <span className="line-clamp-2">{material.nextStep || '请查看详情处理'}</span>
                      </p>
                    </div>
                  </div>
                  <X
                    className="w-3.5 h-3.5 text-industrial-500 hover:text-industrial-300 transition-colors flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
