import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { SourceTypeBadge, AnomalyTypeBadge } from '@/components/common/Badges';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Minus,
  Plus,
  Rows3,
} from 'lucide-react';

interface DiffField {
  field: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
}

interface CompareResult {
  stationName: string;
  stationId: string;
  sourceRow: { left: number; right: number };
  fields: DiffField[];
  hasChanges: boolean;
}

export default function ComparePage() {
  const { materials, anomalies } = useAppStore();
  const [leftMaterialId, setLeftMaterialId] = useState<string>(materials[0]?.id || '');
  const [rightMaterialId, setRightMaterialId] = useState<string>(materials[2]?.id || '');
  const [selectedStation, setSelectedStation] = useState<string>('all');

  const leftMaterial = materials.find(m => m.id === leftMaterialId);
  const rightMaterial = materials.find(m => m.id === rightMaterialId);

  const leftRecords = leftMaterial?.parsedData || [];
  const rightRecords = rightMaterial?.parsedData || [];

  const fieldNames: Record<string, string> = {
    temperature: '水温',
    salinity: '盐度',
    tideLevel: '潮位',
    tideUnit: '潮位单位',
    dissolvedOxygen: '溶解氧',
    ph: 'pH值',
    sampleTime: '采样时间',
    resultTime: '结果时间',
  };

  const stationIds = [
    ...new Set([
      ...leftRecords.map(r => r.stationId),
      ...rightRecords.map(r => r.stationId),
    ]),
  ];

  const results: CompareResult[] = stationIds.map(stationId => {
    const leftRec = leftRecords.find(r => r.stationId === stationId);
    const rightRec = rightRecords.find(r => r.stationId === stationId);

    const fieldsToCompare = [
      'sampleTime',
      'resultTime',
      'temperature',
      'salinity',
      'tideLevel',
      'tideUnit',
      'dissolvedOxygen',
      'ph',
    ] as const;

    const fields = fieldsToCompare.map(field => {
      const leftVal = leftRec ? String(leftRec[field]) : '-';
      const rightVal = rightRec ? String(rightRec[field]) : '-';
      return {
        field,
        fieldName: fieldNames[field],
        oldValue: leftVal,
        newValue: rightVal,
        changed: leftVal !== rightVal,
      };
    });

    return {
      stationName: leftRec?.stationName || rightRec?.stationName || '',
      stationId,
      sourceRow: {
        left: leftRec?.sourceRow || 0,
        right: rightRec?.sourceRow || 0,
      },
      fields,
      hasChanges: fields.some(f => f.changed),
    };
  });

  const filteredResults = selectedStation === 'all'
    ? results
    : results.filter(r => r.stationId === selectedStation);

  const changedResults = filteredResults.filter(r => r.hasChanges);

  const relatedAnomalies = anomalies.filter(a =>
    a.materialIds.includes(leftMaterialId) || a.materialIds.includes(rightMaterialId)
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">版本对比</h2>
          <p className="text-sm text-ocean-500 mt-1">
            对比两份材料的数据差异，追踪口径变更来源
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ocean-500">
            发现 <span className="font-semibold text-alert-orange">{changedResults.length}</span> 处数据差异
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-base p-4">
          <label className="text-xs font-medium text-ocean-600 mb-2 block">旧版本</label>
          <select
            value={leftMaterialId}
            onChange={(e) => setLeftMaterialId(e.target.value)}
            className="w-full px-3 py-2 border border-ocean-200 rounded-md bg-white
                       focus:outline-none focus:border-ocean-400 text-sm"
          >
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} (v{m.version})
              </option>
            ))}
          </select>
          {leftMaterial && (
            <div className="mt-3 flex items-center gap-3">
              <SourceTypeBadge source={leftMaterial.source} />
              <span className="text-xs text-ocean-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {leftMaterial.uploadTime}
              </span>
            </div>
          )}
        </div>

        <div className="card-base p-4">
          <label className="text-xs font-medium text-ocean-600 mb-2 block">新版本</label>
          <select
            value={rightMaterialId}
            onChange={(e) => setRightMaterialId(e.target.value)}
            className="w-full px-3 py-2 border border-ocean-200 rounded-md bg-white
                       focus:outline-none focus:border-ocean-400 text-sm"
          >
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} (v{m.version})
              </option>
            ))}
          </select>
          {rightMaterial && (
            <div className="mt-3 flex items-center gap-3">
              <SourceTypeBadge source={rightMaterial.source} />
              <span className="text-xs text-ocean-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {rightMaterial.uploadTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {relatedAnomalies.length > 0 && (
        <div className="card-base p-4 border-l-4 border-alert-orange/50 bg-alert-orange/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-alert-orange" />
            <h3 className="font-medium text-ocean-800">相关异常</h3>
            <span className="badge bg-alert-orange/20 text-alert-orange border-0">
              {relatedAnomalies.length} 条
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {relatedAnomalies.map(a => (
              <div key={a.id} className="px-3 py-1.5 bg-white rounded-md border border-ocean-100 text-sm">
                <AnomalyTypeBadge type={a.type} />
                <span className="ml-2 text-ocean-700">{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-base p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Rows3 className="w-4 h-4 text-ocean-500" />
              <span className="text-sm font-medium text-ocean-700">对比详情</span>
            </div>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="px-3 py-1.5 text-sm border border-ocean-200 rounded-md bg-white
                         focus:outline-none focus:border-ocean-400"
            >
              <option value="all">全部点位</option>
              {results.map(r => (
                <option key={r.stationId} value={r.stationId}>{r.stationName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Minus className="w-3 h-3 text-red-400" />
              修改前
            </span>
            <span className="flex items-center gap-1">
              <Plus className="w-3 h-3 text-alert-green" />
              修改后
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {filteredResults.map((result) => (
            <div
              key={result.stationId}
              className={`border rounded-lg overflow-hidden ${
                result.hasChanges ? 'border-alert-orange/30' : 'border-ocean-100'
              }`}
            >
              <div className={`px-4 py-2.5 flex items-center justify-between ${
                result.hasChanges ? 'bg-alert-orange/5' : 'bg-ocean-50/50'
              }`}>
                <div className="flex items-center gap-3">
                  {result.hasChanges && (
                    <span className="w-2 h-2 rounded-full bg-alert-orange animate-pulse" />
                  )}
                  <span className="font-medium text-ocean-800 text-sm">
                    {result.stationName}
                  </span>
                  {result.hasChanges && (
                    <span className="text-xs text-alert-orange font-medium">
                      有 {result.fields.filter(f => f.changed).length} 项变更
                    </span>
                  )}
                </div>
                <div className="text-xs text-ocean-500">
                  行 {result.sourceRow.left} → 行 {result.sourceRow.right}
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-ocean-100">
                {result.fields.map(field => (
                  <div
                    key={field.field}
                    className={`contents ${field.changed ? 'bg-red-50/30' : ''}`}
                  >
                    <div className={`px-4 py-2 ${field.changed ? 'bg-red-50/50' : ''}`}>
                      <div className="text-xs text-ocean-500 mb-1">{field.fieldName}</div>
                      <div className={`text-sm ${
                        field.changed ? 'text-red-600 line-through' : 'text-ocean-700'
                      }`}>
                        {field.oldValue}
                      </div>
                    </div>
                    <div className={`px-4 py-2 ${field.changed ? 'bg-green-50/50' : ''}`}>
                      <div className="text-xs text-ocean-500 mb-1">{field.fieldName}</div>
                      <div className={`text-sm font-medium ${
                        field.changed ? 'text-alert-green' : 'text-ocean-700'
                      }`}>
                        {field.newValue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <div className="py-12 text-center">
            <CheckCircle className="w-10 h-10 text-alert-green mx-auto mb-3" />
            <p className="text-ocean-500">两份材料数据完全一致</p>
          </div>
        )}
      </div>
    </div>
  );
}
