import { useState, useEffect } from 'react';
import type { Certificate, CertificateType } from '../types';
import { useAppContext } from '../context';
import { validateCertificate } from '../utils';

interface Props {
  certificate?: Certificate;
  onCancel: () => void;
  mode: 'add' | 'edit';
}

export function CertificateForm({ certificate, onCancel, mode }: Props) {
  const { addCertificate, updateCertificate } = useAppContext();
  const [formData, setFormData] = useState({
    certificateNumber: '',
    type: 'store_license' as CertificateType,
    name: '',
    holder: '',
    issueDate: '',
    expiryDate: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (certificate && mode === 'edit') {
      setFormData({
        certificateNumber: certificate.certificateNumber,
        type: certificate.type,
        name: certificate.name,
        holder: certificate.holder,
        issueDate: certificate.issueDate,
        expiryDate: certificate.expiryDate,
      });
    }
  }, [certificate, mode]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) {
      const newErrors = validateCertificate({ ...formData, [field]: value });
      setErrors(newErrors);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateCertificate(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (mode === 'add') {
      const result = addCertificate(formData);
      if (result.length === 0) {
        onCancel();
      } else {
        setErrors(result);
      }
    } else if (certificate) {
      const success = updateCertificate(certificate.id, formData);
      if (success) {
        onCancel();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            {mode === 'add' ? '添加证照' : '编辑证照'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-700 font-medium text-sm mb-1">请修正以下错误：</p>
              <ul className="text-red-600 text-sm list-disc list-inside space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证照编号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.certificateNumber}
              onChange={(e) => handleChange('certificateNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入证照编号"
              disabled={mode === 'edit'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证照类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as CertificateType)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="store_license">门店许可证</option>
              <option value="health_certificate">员工健康证</option>
              <option value="supplier_qualification">供应商资质</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证照名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如：食品经营许可证"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              持证人/单位 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.holder}
              onChange={(e) => handleChange('holder', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="门店名称或员工姓名"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发证日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => handleChange('issueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                到期日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              {mode === 'add' ? '添加' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
