import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Calculator,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { DiscountCalculator } from '../services/DiscountCalculator';
import { formatCurrency, formatPercent } from '../utils/format';
import type { Supplier, Payable } from '../types';
import { SUPPLIER_LEVEL_LABELS } from '../types';

export function ApplicationForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const application = useAppStore((state) =>
    isEdit ? state.getApplicationById(id) : null
  );
  const suppliers = useAppStore((state) => state.suppliers);
  const payables = useAppStore((state) => state.payables);
  const createApplication = useAppStore((state) => state.createApplication);
  const updateApplication = useAppStore((state) => state.updateApplication);

  const [formData, setFormData] = useState({
    supplierId: '',
    payableId: '',
    payableAmount: 0,
    originalDueDate: '',
    proposedDueDate: '',
    discountRate: 0.06,
    remark: '',
  });

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const filteredPayables = useMemo(() => {
    if (!formData.supplierId) return [];
    return payables.filter((p) => p.supplierId === formData.supplierId);
  }, [formData.supplierId, payables]);

  const selectedPayable = useMemo(() => {
    return payables.find((p) => p.id === formData.payableId) || null;
  }, [formData.payableId, payables]);

  const calc = useMemo(() => {
    return DiscountCalculator.calculate(
      formData.payableAmount,
      formData.originalDueDate,
      formData.proposedDueDate,
      formData.discountRate
    );
  }, [
    formData.payableAmount,
    formData.originalDueDate,
    formData.proposedDueDate,
    formData.discountRate,
  ]);

  const isRateValid = useMemo(() => {
    if (!selectedSupplier) return true;
    return DiscountCalculator.validateDiscountRule(
      selectedSupplier.level,
      formData.discountRate
    );
  }, [selectedSupplier, formData.discountRate]);

  useEffect(() => {
    if (isEdit && application) {
      setFormData({
        supplierId: application.supplierId,
        payableId: application.payableId,
        payableAmount: application.payableAmount,
        originalDueDate: application.originalDueDate,
        proposedDueDate: application.proposedDueDate,
        discountRate: application.discountRate,
        remark: application.remark || '',
      });
      const supplier = suppliers.find((s) => s.id === application.supplierId);
      if (supplier) setSelectedSupplier(supplier);
    }
  }, [isEdit, application, suppliers]);

  useEffect(() => {
    if (selectedPayable) {
      setFormData((prev) => ({
        ...prev,
        payableAmount: selectedPayable.amount,
        originalDueDate: selectedPayable.dueDate,
      }));
    }
  }, [selectedPayable]);

  useEffect(() => {
    const supplier = suppliers.find((s) => s.id === formData.supplierId);
    if (supplier) setSelectedSupplier(supplier);
  }, [formData.supplierId, suppliers]);

  const handleSubmit = () => {
    if (!formData.supplierId || !formData.payableId) {
      alert('请选择供应商和应付账款');
      return;
    }

    if (isEdit) {
      updateApplication(id!, {
        supplierId: formData.supplierId,
        supplierName: selectedSupplier?.name || '',
        supplierLevel: selectedSupplier?.level || 'C',
        payableId: formData.payableId,
        payableAmount: formData.payableAmount,
        originalDueDate: formData.originalDueDate,
        proposedDueDate: formData.proposedDueDate,
        discountRate: formData.discountRate,
        remark: formData.remark,
      });
    } else {
      const newId = createApplication({
        supplierId: formData.supplierId,
        supplierName: selectedSupplier?.name || '',
        supplierLevel: selectedSupplier?.level || 'C',
        payableId: formData.payableId,
        payableAmount: formData.payableAmount,
        originalDueDate: formData.originalDueDate,
        proposedDueDate: formData.proposedDueDate,
        discountRate: formData.discountRate,
        remark: formData.remark,
      });
      navigate(`/application/${newId}`);
      return;
    }

    navigate(`/application/${id}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map((f) => f.name);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f !== fileName));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {isEdit ? '编辑折扣申请' : '新建折扣申请'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isEdit ? '修改申请信息' : '填写折扣申请信息'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-700 mb-4">业务线索归集</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  选择供应商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      supplierId: e.target.value,
                      payableId: '',
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({SUPPLIER_LEVEL_LABELS[s.level]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  选择应付账款 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.payableId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, payableId: e.target.value }))
                  }
                  disabled={!formData.supplierId}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">请选择应付账款</option>
                  {filteredPayables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} - {formatCurrency(p.amount)} ({p.invoiceNo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSupplier && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-primary-700 mb-2">
                  供应商关联信息
                </h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">等级</div>
                    <div className="font-medium">{SUPPLIER_LEVEL_LABELS[selectedSupplier.level]}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">信用评级</div>
                    <div className="font-medium">{selectedSupplier.creditRating} 分</div>
                  </div>
                  <div>
                    <div className="text-gray-500">历史折扣</div>
                    <div className="font-medium">{selectedSupplier.historicalDiscountCount} 次</div>
                  </div>
                  <div>
                    <div className="text-gray-500">最高折扣率</div>
                    <div className="font-medium">
                      {formatPercent(DiscountCalculator.getMaxDiscountRate(selectedSupplier.level))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-700 mb-4">折扣规则配置</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">应付金额</label>
                <input
                  type="number"
                  value={formData.payableAmount || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      payableAmount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">原到期日</label>
                <input
                  type="date"
                  value={formData.originalDueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, originalDueDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">拟付款日</label>
                <input
                  type="date"
                  value={formData.proposedDueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, proposedDueDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  年化折扣率 (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.discountRate * 100}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discountRate: parseFloat(e.target.value) / 100 || 0,
                    }))
                  }
                  className={`w-full px-3 py-2 border rounded text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    !isRateValid ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {!isRateValid && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    超过该供应商等级允许的最高折扣率
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">备注</label>
              <textarea
                value={formData.remark}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, remark: e.target.value }))
                }
                rows={3}
                placeholder="输入备注信息..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-700 mb-4">材料上传</h3>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-4">
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 mb-2">点击或拖拽文件到此处上传</p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 text-sm bg-primary-700 text-white rounded hover:bg-primary-800 cursor-pointer transition-colors"
              >
                选择文件
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((fileName, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-700">{fileName}</span>
                    <button
                      onClick={() => removeFile(fileName)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X size={14} className="text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={18} className="text-primary-600" />
              <h3 className="font-medium text-gray-700">实时试算</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">提前天数</span>
                <span className="font-mono font-medium text-primary-600">
                  {calc.daysEarly} 天
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">应付金额</span>
                <span className="font-mono">{formatCurrency(formData.payableAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">折扣金额</span>
                <span className="font-mono text-success-600">
                  -{formatCurrency(calc.discountAmount)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">实际付款</span>
                  <span className="text-xl font-bold font-mono text-primary-700">
                    {formatCurrency(calc.actualPayment)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">年化收益率</span>
                  <span className="font-mono text-amber-600">
                    {calc.annualizedReturn.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmit}
              disabled={!formData.supplierId || !formData.payableId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm bg-primary-700 text-white rounded hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {isEdit ? '保存修改' : '创建申请'}
            </button>
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              取消
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
