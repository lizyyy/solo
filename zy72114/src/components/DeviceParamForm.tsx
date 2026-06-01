import { DeviceParam } from '@/types';
import { unitDefinitions } from '@/utils/units';

interface DeviceParamFormProps {
  params: DeviceParam[];
  onUpdate: (id: string, updates: Partial<DeviceParam>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function DeviceParamForm({
  params,
  onUpdate,
  onAdd,
  onRemove,
}: DeviceParamFormProps) {
  const allUnits = Object.values(unitDefinitions).flatMap((def) =>
    Object.keys(def.units)
  );

  const uniqueUnits = [...new Set(allUnits)];

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      structure: '结构',
      material: '材料',
      operation: '操作',
    };
    return labels[category] || category;
  };

  const groupedParams = params.reduce((acc, param) => {
    if (!acc[param.category]) {
      acc[param.category] = [];
    }
    acc[param.category].push(param);
    return acc;
  }, {} as Record<string, DeviceParam[]>);

  return (
    <div className="eng-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="eng-section-title mb-0">设备参数</h3>
        <button onClick={onAdd} className="eng-btn eng-btn-sm eng-btn-primary">
          + 添加参数
        </button>
      </div>

      {Object.entries(groupedParams).map(([category, categoryParams]) => (
        <div key={category} className="mb-6 last:mb-0">
          <h4 className="text-sm font-bold text-ink-600 mb-3 uppercase tracking-wider">
            {getCategoryLabel(category)}
          </h4>
          <div className="space-y-4">
            {categoryParams.map((param) => (
              <div
                key={param.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 bg-ink-50 border border-ink-200"
              >
                <div className="md:col-span-3">
                  <label className="eng-label">参数名称</label>
                  <input
                    type="text"
                    value={param.paramName}
                    onChange={(e) =>
                      onUpdate(param.id, { paramName: e.target.value })
                    }
                    className="eng-input"
                    placeholder="参数名称"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="eng-label">数值</label>
                  <input
                    type="number"
                    value={param.value ?? ''}
                    onChange={(e) =>
                      onUpdate(param.id, {
                        value: e.target.value === '' ? null : parseFloat(e.target.value),
                      })
                    }
                    className="eng-input font-mono"
                    placeholder="数值"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="eng-label">单位</label>
                  <select
                    value={param.unit}
                    onChange={(e) =>
                      onUpdate(param.id, { unit: e.target.value })
                    }
                    className="eng-input"
                  >
                    {uniqueUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="eng-label">描述</label>
                  <input
                    type="text"
                    value={param.description}
                    onChange={(e) =>
                      onUpdate(param.id, { description: e.target.value })
                    }
                    className="eng-input"
                    placeholder="参数描述"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    onClick={() => onRemove(param.id)}
                    className="eng-btn eng-btn-sm eng-btn-danger w-full"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {params.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          暂无参数，点击上方按钮添加
        </div>
      )}
    </div>
  );
}
