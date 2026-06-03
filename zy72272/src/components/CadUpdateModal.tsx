import React, { useState } from 'react';
import { X, Layers, Save } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DEMO_CAD_LAYERS } from '../core/mockData';
import { ImportService } from '../core/ImportService';

interface CadUpdateModalProps {
  recordId: string | null;
  onClose: () => void;
}

export const CadUpdateModal: React.FC<CadUpdateModalProps> = ({ recordId, onClose }) => {
  const { records, updateCadLayerName } = useAppStore();

  const targetRecords = recordId
    ? records.filter((r) => r.id === recordId)
    : records.filter((r) => !r.cadLayerName && r.photoNo);

  const [cadValues, setCadValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    targetRecords.forEach((r) => {
      initial[r.id] = DEMO_CAD_LAYERS[r.id] || '';
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
    setCadValues((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    Object.entries(cadValues).forEach(([id, value]) => {
      if (!value.trim()) {
        newErrors[id] = 'CAD图层名不能为空';
      } else if (!ImportService.validateCadLayerName(value)) {
        newErrors[id] = '格式不正确，应为 LAYER-XXX-X 或 LAYER-XXX-X-OLD';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    Object.entries(cadValues).forEach(([id, value]) => {
      updateCadLayerName(id, value);
    });

    onClose();
  };

  const handleFillDemo = () => {
    const demoValues: Record<string, string> = {};
    targetRecords.forEach((r) => {
      demoValues[r.id] = DEMO_CAD_LAYERS[r.id] || '';
    });
    setCadValues(demoValues);
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-industrial-card rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-industrial-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-industrial-text">
                {recordId ? '补录CAD图层名' : '批量补录CAD图层名'}
              </h3>
              <p className="text-sm text-industrial-muted">
                操作人：老梁
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-industrial-border transition-colors"
          >
            <X className="w-5 h-5 text-industrial-muted" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
          {targetRecords.length === 0 ? (
            <div className="text-center py-8 text-industrial-muted">
              <p>没有需要补录的记录</p>
              <p className="text-sm mt-1">请先完成第一步：导入巡检照片编号</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-industrial-muted">
                  共 {targetRecords.length} 条记录需要补录
                </span>
                <button
                  onClick={handleFillDemo}
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  填入演示数据
                </button>
              </div>

              {targetRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-industrial-bg rounded-xl border border-industrial-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono font-semibold text-industrial-text">
                        {record.id}
                      </span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary-600/30 text-primary-300">
                        {record.photoNo}
                      </span>
                    </div>
                    {record.recordType === 'supplement_no_recalc' && (
                      <span className="text-xs text-status-pending">
                        ⚠️ 补录路线，长度不会自动重算
                      </span>
                    )}
                    {record.recordType === 'old_caliber_fill' && (
                      <span className="text-xs text-status-oldCaliber">
                        📜 含-OLD后缀将触发旧口径重算
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-industrial-muted mb-1">
                      CAD图层名
                    </label>
                    <input
                      type="text"
                      value={cadValues[record.id] || ''}
                      onChange={(e) => handleChange(record.id, e.target.value)}
                      placeholder="例如: LAYER-CHARGE-A 或 LAYER-CHARGE-C-OLD"
                      className={`w-full px-3 py-2 bg-industrial-card border rounded-lg font-mono text-sm text-industrial-text focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors[record.id]
                          ? 'border-red-500'
                          : 'border-industrial-border'
                      }`}
                    />
                    {errors[record.id] && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors[record.id]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-industrial-border bg-industrial-bg/50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={targetRecords.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存补录
          </button>
        </div>
      </div>
    </div>
  );
};
