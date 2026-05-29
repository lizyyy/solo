import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Disc } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import type { RecordFormData, InventoryRecord, ConditionGrade } from '@/types';
import { CONDITION_GRADES, REQUIRED_FIELDS } from '@/types';
import { getMissingFields } from '@/utils/stateMachine';

interface RecordFormProps {
  record?: InventoryRecord;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RecordForm({ record, onClose, onSuccess }: RecordFormProps) {
  const addRecord = useRecordStore((s) => s.addRecord);
  const updateRecord = useRecordStore((s) => s.updateRecord);
  const checkDuplicate = useRecordStore((s) => s.checkDuplicate);
  const getDuplicateRecord = useRecordStore((s) => s.getDuplicateRecord);
  const findAlbumMatches = useRecordStore((s) => {
    const records = s.records;
    return (albumName: string, catalogNumber: string) =>
      records.filter((r) => {
        if (record && r.id === record.id) return false;
        if (r.catalogNumber === catalogNumber) return false;
        return (
          r.albumName.toLowerCase().trim() === albumName.toLowerCase().trim()
        );
      });
  });

  const [formData, setFormData] = useState<Partial<RecordFormData>>({
    catalogNumber: record?.catalogNumber || '',
    albumName: record?.albumName || '',
    artist: record?.artist || '',
    pressYear: record?.pressYear || '',
    condition: record?.condition || 'VG',
    consignor: record?.consignor || '',
    price: record?.price || undefined,
    shelfLocation: record?.shelfLocation || '',
    verificationReport: record?.verificationReport || '',
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [albumMatches, setAlbumMatches] = useState<InventoryRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const missingFields = getMissingFields(formData);

  useEffect(() => {
    if (formData.catalogNumber && touched.catalogNumber) {
      const isDup = checkDuplicate(formData.catalogNumber, record?.id);
      if (isDup) {
        const dup = getDuplicateRecord(formData.catalogNumber, record?.id);
        setDuplicateWarning(
          `版号已存在: ${dup?.albumName} - ${dup?.artist}`
        );
      } else {
        setDuplicateWarning(null);
      }
    }
  }, [formData.catalogNumber, touched.catalogNumber, checkDuplicate, getDuplicateRecord, record?.id]);

  useEffect(() => {
    if (formData.albumName && formData.catalogNumber) {
      const matches = findAlbumMatches(formData.albumName, formData.catalogNumber);
      setAlbumMatches(matches);
    } else {
      setAlbumMatches([]);
    }
  }, [formData.albumName, formData.catalogNumber, findAlbumMatches]);

  const handleChange = (field: keyof RecordFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field: keyof RecordFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    Object.keys(formData).forEach((key) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const submitData = {
      ...formData,
      price: formData.price ? Number(formData.price) : undefined,
    };

    let result;
    if (record) {
      result = updateRecord(record.id, submitData, '表单更新');
    } else {
      result = addRecord(submitData);
    }

    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrors(result.errors || ['提交失败']);
    }

    setIsSubmitting(false);
  };

  const isFieldMissing = (field: keyof RecordFormData) => {
    return touched[field] && missingFields.includes(field);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream-100 rounded-sm shadow-vinyl-lg w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-in">
        <div className="bg-vinyl-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc className="w-5 h-5" />
            <h2 className="font-display text-lg font-semibold">
              {record ? '编辑唱片记录' : '录入唱片记录'}
            </h2>
          </div>
          <button
            className="text-white/70 hover:text-white transition-colors p-1"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-alert-500/10 border border-alert-500/30 rounded-sm">
              {errors.map((err, i) => (
                <p key={i} className="text-alert-500 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {duplicateWarning && (
            <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-sm">
              <p className="text-orange-600 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {duplicateWarning}
              </p>
            </div>
          )}

          {albumMatches.length > 0 && (
            <div className="mb-4 p-3 bg-caramel-400/20 border border-caramel-400/30 rounded-sm">
              <p className="text-caramel-500 text-sm font-medium mb-2 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                检测到同专辑其他版本 ({albumMatches.length} 个):
              </p>
              <ul className="text-sm text-vinyl-700 space-y-1">
                {albumMatches.map((m) => (
                  <li key={m.id}>
                    • {m.catalogNumber} - {m.artist} ({m.pressYear})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field label-required">版号</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('catalogNumber') ? 'input-field-error' : ''}`}
                value={formData.catalogNumber}
                onChange={(e) => handleChange('catalogNumber', e.target.value)}
                onBlur={() => handleBlur('catalogNumber')}
                placeholder="例如: RLP-001"
              />
              {isFieldMissing('catalogNumber') && (
                <p className="text-alert-500 text-xs mt-1">版号必填</p>
              )}
            </div>

            <div>
              <label className="label-field label-required">发行年份</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('pressYear') ? 'input-field-error' : ''}`}
                value={formData.pressYear}
                onChange={(e) => handleChange('pressYear', e.target.value)}
                onBlur={() => handleBlur('pressYear')}
                placeholder="例如: 1977"
              />
              {isFieldMissing('pressYear') && (
                <p className="text-alert-500 text-xs mt-1">发行年份必填</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label-field label-required">专辑名</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('albumName') ? 'input-field-error' : ''}`}
                value={formData.albumName}
                onChange={(e) => handleChange('albumName', e.target.value)}
                onBlur={() => handleBlur('albumName')}
                placeholder="例如: The Dark Side of the Moon"
              />
              {isFieldMissing('albumName') && (
                <p className="text-alert-500 text-xs mt-1">专辑名必填</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label-field label-required">艺人</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('artist') ? 'input-field-error' : ''}`}
                value={formData.artist}
                onChange={(e) => handleChange('artist', e.target.value)}
                onBlur={() => handleBlur('artist')}
                placeholder="例如: Pink Floyd"
              />
              {isFieldMissing('artist') && (
                <p className="text-alert-500 text-xs mt-1">艺人必填</p>
              )}
            </div>

            <div>
              <label className="label-field label-required">品相</label>
              <select
                className={`input-field ${isFieldMissing('condition') ? 'input-field-error' : ''}`}
                value={formData.condition}
                onChange={(e) => handleChange('condition', e.target.value as ConditionGrade)}
                onBlur={() => handleBlur('condition')}
              >
                <option value="">请选择品相</option>
                {CONDITION_GRADES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {isFieldMissing('condition') && (
                <p className="text-alert-500 text-xs mt-1">品相必填</p>
              )}
            </div>

            <div>
              <label className="label-field label-required">寄售价格 (元)</label>
              <input
                type="number"
                className={`input-field ${isFieldMissing('price') ? 'input-field-error' : ''}`}
                value={formData.price ?? ''}
                onChange={(e) => handleChange('price', e.target.value)}
                onBlur={() => handleBlur('price')}
                placeholder="例如: 280"
                step="0.01"
                min="0"
              />
              {isFieldMissing('price') && (
                <p className="text-alert-500 text-xs mt-1">价格必填</p>
              )}
            </div>

            <div>
              <label className="label-field label-required">寄售人</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('consignor') ? 'input-field-error' : ''}`}
                value={formData.consignor}
                onChange={(e) => handleChange('consignor', e.target.value)}
                onBlur={() => handleBlur('consignor')}
                placeholder="例如: 张三"
              />
              {isFieldMissing('consignor') && (
                <p className="text-alert-500 text-xs mt-1">寄售人必填</p>
              )}
            </div>

            <div>
              <label className="label-field label-required">上架位置</label>
              <input
                type="text"
                className={`input-field ${isFieldMissing('shelfLocation') ? 'input-field-error' : ''}`}
                value={formData.shelfLocation}
                onChange={(e) => handleChange('shelfLocation', e.target.value)}
                onBlur={() => handleBlur('shelfLocation')}
                placeholder="例如: A-03-12"
              />
              {isFieldMissing('shelfLocation') && (
                <p className="text-alert-500 text-xs mt-1">上架位置必填</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label-field label-required">核对报告</label>
              <textarea
                className={`input-field min-h-[80px] ${isFieldMissing('verificationReport') ? 'input-field-error' : ''}`}
                value={formData.verificationReport}
                onChange={(e) => handleChange('verificationReport', e.target.value)}
                onBlur={() => handleBlur('verificationReport')}
                placeholder="版号核对结果、品相说明、注意事项等"
              />
              {isFieldMissing('verificationReport') && (
                <p className="text-alert-500 text-xs mt-1">核对报告必填</p>
              )}
            </div>
          </div>

          {missingFields.length > 0 && (
            <div className="mt-4 p-3 bg-alert-500/10 border border-alert-500/20 rounded-sm">
              <p className="text-alert-500 text-sm font-medium">
                以下字段缺失，记录将保存为草稿状态:
              </p>
              <ul className="text-alert-500 text-sm mt-1">
                {missingFields.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-vinyl-700/10">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !!duplicateWarning}
            >
              {isSubmitting ? '保存中...' : record ? '保存修改' : '提交录入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
