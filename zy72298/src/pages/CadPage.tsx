import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import { MATERIAL_LABELS, COORDINATE_TYPE_LABELS } from '@/types';
import { FileCode, Save, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CadPage() {
  const { records, updateCadLayer } = usePipelineStore();
  const step1Records = records.filter((r) => r.status === 'step1');
  const [cadInputs, setCadInputs] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleSave = (recordId: string) => {
    const cadLayer = cadInputs[recordId]?.trim();
    if (!cadLayer) return;
    updateCadLayer(recordId, cadLayer);
    setSavedIds((prev) => new Set(prev).add(recordId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className={cn('font-display', 'text-2xl font-bold flex items-center gap-2')}>
          <FileCode className="h-6 w-6" />
          CAD图层名补录
        </h1>
        <p className="text-muted-foreground mt-1">
          培训教官补看CAD图后录入图层名，与照片编号关联
        </p>
      </div>

      {step1Records.length === 0 ? (
        <div className={cn('card', 'p-8 text-center text-muted-foreground')}>
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">暂无待补录记录</p>
          <p className="text-sm mt-1">所有记录已完成CAD图层名补录</p>
        </div>
      ) : (
        <div className={cn('card', 'overflow-hidden')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">照片编号</th>
                <th className="px-4 py-3 text-left font-medium">材料类型</th>
                <th className="px-4 py-3 text-left font-medium">坐标类型</th>
                <th className="px-4 py-3 text-left font-medium">CAD图层名</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {step1Records.map((record) => {
                const isSaved = savedIds.has(record.id);
                return (
                  <tr key={record.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className={cn('px-4 py-3 font-mono-data')}>{record.photoNumber}</td>
                    <td className="px-4 py-3">{MATERIAL_LABELS[record.materialType]}</td>
                    <td className="px-4 py-3">{COORDINATE_TYPE_LABELS[record.coordinate.type]}</td>
                    <td className="px-4 py-3">
                      {isSaved ? (
                        <span className={cn('font-mono-data', 'text-green-600 flex items-center gap-1')}>
                          <CheckCircle className="h-4 w-4" />
                          {cadInputs[record.id]}
                        </span>
                      ) : (
                        <input
                          type="text"
                          className={cn('input-field', 'w-full max-w-xs')}
                          placeholder="输入CAD图层名"
                          value={cadInputs[record.id] || ''}
                          onChange={(e) =>
                            setCadInputs((prev) => ({ ...prev, [record.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave(record.id);
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSaved ? (
                        <span className="text-sm text-green-600">已保存</span>
                      ) : (
                        <button
                          className={cn('btn-success', 'flex items-center gap-1')}
                          disabled={!cadInputs[record.id]?.trim()}
                          onClick={() => handleSave(record.id)}
                        >
                          <Save className="h-4 w-4" />
                          保存
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
