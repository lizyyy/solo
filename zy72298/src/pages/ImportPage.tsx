import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { MaterialType, CoordinateType, Coordinate } from '@/types';
import { MATERIAL_LABELS, COORDINATE_TYPE_LABELS } from '@/types';
import { Upload, FileText, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const MATERIAL_CONFIG: { type: MaterialType; icon: typeof Upload; border: string; bg: string }[] = [
  { type: 'normal', icon: FileText, border: 'border-l-blue-500', bg: 'bg-blue-50' },
  { type: 'wrong_caliber', icon: AlertCircle, border: 'border-l-red-500', bg: 'bg-red-50' },
  { type: 'supplementary', icon: Upload, border: 'border-l-amber-500', bg: 'bg-amber-50' },
];

export default function ImportPage() {
  const { addRecord, records } = usePipelineStore();
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [photoNumber, setPhotoNumber] = useState('');
  const [coordType, setCoordType] = useState<CoordinateType>('latlng');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [metricX, setMetricX] = useState('');
  const [metricY, setMetricY] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !photoNumber.trim()) return;

    const coordinate: Coordinate = { type: coordType };
    if (coordType === 'latlng') {
      coordinate.lat = lat ? Number(lat) : undefined;
      coordinate.lng = lng ? Number(lng) : undefined;
    } else {
      coordinate.metricX = metricX ? Number(metricX) : undefined;
      coordinate.metricY = metricY ? Number(metricY) : undefined;
    }

    addRecord({ photoNumber: photoNumber.trim(), materialType: selectedType, coordinate });
    setPhotoNumber('');
    setLat('');
    setLng('');
    setMetricX('');
    setMetricY('');
  };

  const filteredRecords = selectedType
    ? records.filter((r) => r.materialType === selectedType)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">数据导入</h1>
        <p className="text-muted-foreground mt-1">选择材料类型并录入巡检照片编号与坐标信息</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {MATERIAL_CONFIG.map(({ type, icon: Icon, border, bg }) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={cn(
              'card border-l-4 p-4 text-left transition-all hover:shadow-md',
              border,
              selectedType === type ? `${bg} ring-2 ring-primary` : 'bg-card'
            )}
          >
            <Icon className={cn(
              'h-6 w-6 mb-2',
              type === 'normal' && 'text-blue-500',
              type === 'wrong_caliber' && 'text-red-500',
              type === 'supplementary' && 'text-amber-500'
            )} />
            <div className="font-semibold">{MATERIAL_LABELS[type]}</div>
          </button>
        ))}
      </div>

      {selectedType && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold font-display">
            录入信息 — {MATERIAL_LABELS[selectedType]}
          </h2>

          <div className="space-y-1">
            <label className="text-sm font-medium">巡检照片编号</label>
            <input
              type="text"
              value={photoNumber}
              onChange={(e) => setPhotoNumber(e.target.value)}
              className="input-field"
              placeholder="请输入照片编号"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">坐标类型</label>
            <select
              value={coordType}
              onChange={(e) => setCoordType(e.target.value as CoordinateType)}
              className="select-field"
            >
              {Object.entries(COORDINATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {coordType === 'latlng' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">纬度 (lat)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="input-field font-mono-data"
                  placeholder="例: 31.2304"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">经度 (lng)</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="input-field font-mono-data"
                  placeholder="例: 121.4737"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">X坐标 (metricX)</label>
                <input
                  type="number"
                  step="any"
                  value={metricX}
                  onChange={(e) => setMetricX(e.target.value)}
                  className="input-field font-mono-data"
                  placeholder="例: 345678.12"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Y坐标 (metricY)</label>
                <input
                  type="number"
                  step="any"
                  value={metricY}
                  onChange={(e) => setMetricY(e.target.value)}
                  className="input-field font-mono-data"
                  placeholder="例: 3456789.34"
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            提交录入
          </button>
        </form>
      )}

      {selectedType && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold font-display mb-4">
            最近导入 — {MATERIAL_LABELS[selectedType]}
          </h2>
          {filteredRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">照片编号</th>
                    <th className="pb-2 pr-4">坐标类型</th>
                    <th className="pb-2 pr-4">坐标值</th>
                    <th className="pb-2 pr-4">状态</th>
                    <th className="pb-2">导入时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono-data">{r.photoNumber}</td>
                      <td className="py-2 pr-4">{COORDINATE_TYPE_LABELS[r.coordinate.type]}</td>
                      <td className="py-2 pr-4 font-mono-data">
                        {r.coordinate.type === 'latlng'
                          ? `${r.coordinate.lat ?? '-'}, ${r.coordinate.lng ?? '-'}`
                          : `${r.coordinate.metricX ?? '-'}, ${r.coordinate.metricY ?? '-'}`}
                      </td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
