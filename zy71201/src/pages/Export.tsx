import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Eye,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

const templates = [
  {
    id: 'standard',
    name: '标准周报',
    description: '包含净值走势、回撤分析、持仓概况',
    preview: '标准模板预览',
  },
  {
    id: 'detailed',
    name: '详细周报',
    description: '包含所有字段，适合风控审阅',
    preview: '详细模板预览',
  },
  {
    id: 'simple',
    name: '简约周报',
    description: '简洁明了，适合发送给投资人',
    preview: '简约模板预览',
  },
];

const weekOptions = [
  { label: '本周', value: 'this' },
  { label: '上周', value: 'last' },
  { label: '近两周', value: 'two' },
  { label: '近一月', value: 'month' },
];

export default function Export() {
  const { products, selectedProductIds, setSelectedProducts, recordVersion } = useStore();
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [selectedWeek, setSelectedWeek] = useState('this');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const warningProducts = useMemo(
    () => products.filter((p) => p.status === 'warning' || p.status === 'stop_loss'),
    [products]
  );

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProducts(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProducts([...selectedProductIds, productId]);
    }
  };

  const selectAllWarning = () => {
    setSelectedProducts(warningProducts.map((p) => p.id));
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const handleExport = () => {
    if (selectedProductIds.length === 0) {
      alert('请至少选择一个产品');
      return;
    }

    setIsExporting(true);

    setTimeout(() => {
      const exportData = selectedProductIds.map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return null;
        return {
          产品名称: product.name,
          产品代码: product.code,
          基金经理: product.manager,
          最新净值: product.latestNetValue,
          回撤率: `${product.latestDrawdownRate.toFixed(2)}%`,
          预警线: product.warningLine,
          止损线: product.stopLossLine,
          状态: product.status === 'normal' ? '正常' : product.status === 'warning' ? '预警' : '止损',
          异常情况: product.anomalies.map((a) => a.description).join('; ') || '无',
        };
      }).filter(Boolean);

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '周报');
      XLSX.writeFile(wb, `净值周报_${new Date().toLocaleDateString('zh-CN')}.xlsx`);

      selectedProductIds.forEach((id) => {
        recordVersion(
          id,
          'export',
          {},
          { format: exportFormat, template: selectedTemplate },
          `导出周报成功`
        );
      });

      setIsExporting(false);
      alert('导出成功！');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">周报导出</h1>
          <p className="text-sm text-gray-500 mt-1">
            选择产品和模板，批量导出投资人周报
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            已选择 {selectedProductIds.length} 个产品
          </span>
          <button
            onClick={handleExport}
            disabled={selectedProductIds.length === 0 || isExporting}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors',
              selectedProductIds.length > 0 && !isExporting
                ? 'bg-navy-600 text-white hover:bg-navy-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出周报
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">选择产品</h3>
                <p className="text-sm text-gray-500 mt-1">
                  以下为预警状态产品，也可手动选择其他产品
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllWarning}
                  className="text-sm text-navy-600 hover:text-navy-800"
                >
                  全选预警
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {warningProducts.map((product) => (
                <div
                  key={product.id}
                  className={cn(
                    'p-4 flex items-center gap-4 cursor-pointer transition-colors',
                    selectedProductIds.includes(product.id)
                      ? 'bg-navy-50'
                      : 'hover:bg-gray-50'
                  )}
                  onClick={() => toggleProduct(product.id)}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      selectedProductIds.includes(product.id)
                        ? 'bg-navy-600 border-navy-600'
                        : 'border-gray-300'
                    )}
                  >
                    {selectedProductIds.includes(product.id) && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{product.name}</span>
                      <span className="text-xs text-gray-500">{product.code}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>净值: {product.latestNetValue.toFixed(4)}</span>
                      <span
                        className={cn(
                          product.latestDrawdownRate < 0 ? 'text-danger' : 'text-success'
                        )}
                      >
                        回撤: {product.latestDrawdownRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.anomalies.slice(0, 2).map((a, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-danger/10 text-danger rounded"
                      >
                        {a.type === 'date_mismatch'
                          ? '日期错位'
                          : a.type === 'warning_line_changed'
                          ? '预警线变更'
                          : '暂停赎回'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">导出设置</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  统计周期
                </label>
                <div className="relative">
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    {weekOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  导出格式
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExportFormat('xlsx')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors',
                      exportFormat === 'xlsx'
                        ? 'border-navy-500 bg-navy-50 text-navy-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </button>
                  <button
                    onClick={() => setExportFormat('pdf')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors',
                      exportFormat === 'pdf'
                        ? 'border-navy-500 bg-navy-50 text-navy-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">选择模板</h3>
            </div>
            <div className="p-4 space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    'p-4 rounded-lg border-2 cursor-pointer transition-all',
                    selectedTemplate === template.id
                      ? 'border-navy-500 bg-navy-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{template.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    </div>
                    {selectedTemplate === template.id && (
                      <CheckCircle2 className="w-5 h-5 text-navy-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">模板预览</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-navy-600 hover:text-navy-800 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? '收起' : '查看'}
              </button>
            </div>
            {showPreview && (
              <div className="p-4">
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold text-gray-800">产品净值周报</h4>
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" />
                      2026年5月第4周
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">产品名称</span>
                      <span className="font-medium">稳盈精选1号</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最新净值</span>
                      <span className="font-medium">0.9500</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">本周回撤</span>
                      <span className="text-danger font-medium">-2.35%</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-gray-500 mb-2">客服话术：</p>
                      <p className="text-gray-600">尊敬的投资者：您好！本周产品净值出现正常波动...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
