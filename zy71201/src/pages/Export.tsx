import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Eye,
  Calendar,
  ChevronDown,
  FileCheck,
  Clock,
  User,
  AlertTriangle,
  Hash,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import type { Product, CustomerScript } from '../types';

const templates = [
  {
    id: 'standard',
    name: '标准周报',
    description: '包含净值走势、回撤分析、客户话术',
    fields: ['产品信息', '净值数据', '客户话术'],
  },
  {
    id: 'detailed',
    name: '详细周报',
    description: '包含所有字段、版本信息、异常记录',
    fields: ['产品信息', '净值数据', '客户话术', '版本追踪', '异常记录'],
  },
  {
    id: 'simple',
    name: '简约周报',
    description: '简洁明了，适合发送给投资人',
    fields: ['产品名称', '净值', '客户话术'],
  },
];

const weekOptions = [
  { label: '本周', value: 'this' },
  { label: '上周', value: 'last' },
  { label: '近两周', value: 'two' },
  { label: '近一月', value: 'month' },
];

interface ExportDataItem {
  产品名称: string;
  产品代码: string;
  基金经理: string;
  产品规模: string;
  最新净值: number;
  回撤率: string;
  预警线: number;
  止损线: number;
  产品状态: string;
  客户话术: string;
  话术类型: string;
  版本号: string;
  最后更新: string;
  导出时间: string;
  导出人: string;
  异常情况: string;
  数据口径: string;
}

function generatePDFContent(
  products: Product[],
  scripts: Record<string, CustomerScript>,
  versions: Record<string, string>,
  template: string
): string {
  const exportTime = new Date().toLocaleString('zh-CN');
  const exportUser = '客服-小王';

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>净值周报</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', 'SimHei', sans-serif; padding: 40px; font-size: 14px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0A2463; }
        .header h1 { font-size: 24px; color: #0A2463; margin-bottom: 10px; }
        .header .meta { color: #666; font-size: 12px; }
        .product { margin-bottom: 30px; page-break-inside: avoid; }
        .product-title { font-size: 16px; font-weight: bold; color: #0A2463; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
        .info-item { display: flex; }
        .info-label { color: #666; width: 80px; }
        .info-value { font-weight: 500; }
        .script { background: #F9FAFB; padding: 15px; border-radius: 6px; margin-top: 10px; }
        .script-label { font-size: 12px; color: #666; margin-bottom: 8px; }
        .script-content { line-height: 1.8; }
        .meta-info { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #E5E7EB; font-size: 12px; color: #999; }
        .anomaly { background: #FEF2F2; border-left: 3px solid #D62828; padding: 10px; margin-top: 10px; }
        .anomaly-title { font-weight: bold; color: #D62828; margin-bottom: 5px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>私募产品净值周报</h1>
        <div class="meta">
          导出时间：${exportTime} | 导出人：${exportUser} | 模板：${templates.find(t => t.id === template)?.name}
        </div>
      </div>
  `;

  products.forEach((product) => {
    const productScript = scripts[`${product.id}-${product.status === 'normal' ? 'normal' : product.status === 'warning' ? 'warning' : 'special'}`];
    const version = versions[product.id] || 'v1.0';
    const scriptType = product.status === 'normal' ? '普通话术' : product.status === 'warning' ? '警示话术' : '特殊话术';

    html += `
      <div class="product">
        <div class="product-title">${product.name}（${product.code}）</div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">基金经理：</span><span class="info-value">${product.manager}</span></div>
          <div class="info-item"><span class="info-label">产品规模：</span><span class="info-value">${(product.scale / 100000000).toFixed(2)}亿</span></div>
          <div class="info-item"><span class="info-label">最新净值：</span><span class="info-value">${product.latestNetValue.toFixed(4)}</span></div>
          <div class="info-item"><span class="info-label">回撤率：</span><span class="info-value" style="color: ${product.latestDrawdownRate < 0 ? '#D62828' : '#00A86B'}">${product.latestDrawdownRate > 0 ? '+' : ''}${product.latestDrawdownRate.toFixed(2)}%</span></div>
          <div class="info-item"><span class="info-label">预警线：</span><span class="info-value">${product.warningLine.toFixed(2)}</span></div>
          <div class="info-item"><span class="info-label">止损线：</span><span class="info-value">${product.stopLossLine.toFixed(2)}</span></div>
        </div>
    `;

    if (product.anomalies.length > 0) {
      html += `
        <div class="anomaly">
          <div class="anomaly-title">⚠ 异常提醒</div>
          <div>${product.anomalies.map(a => a.description).join('；')}</div>
        </div>
      `;
    }

    html += `
        <div class="script">
          <div class="script-label">客户话术（${scriptType}）</div>
          <div class="script-content">${productScript?.content || '暂无话术，请编辑后导出'}</div>
        </div>
        <div class="meta-info">
          <span>版本号：${version}</span>
          <span style="margin-left: 20px;">最后更新：${new Date(product.lastUpdated).toLocaleString('zh-CN')}</span>
          <span style="margin-left: 20px;">数据口径：系统导入 + 人工编辑</span>
        </div>
      </div>
    `;
  });

  html += `
      <div class="footer">
        <p>本报告由净值预警系统自动生成，数据仅供参考，具体以官方公告为准</p>
        <p style="margin-top: 5px;">版本核对校验：共 ${products.length} 个产品，导出时间 ${exportTime}</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export default function Export() {
  const {
    products,
    selectedProductIds,
    setSelectedProducts,
    recordVersion,
    getScript,
    getProductLatestVersion,
    scripts,
  } = useStore();
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [selectedWeek, setSelectedWeek] = useState('this');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLIFrameElement>(null);

  const warningProducts = useMemo(
    () => products.filter((p) => p.status === 'warning' || p.status === 'stop_loss'),
    [products]
  );

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
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

  const generateExportData = (): ExportDataItem[] => {
    const exportTime = new Date().toLocaleString('zh-CN');
    const exportUser = '客服-小王';

    return selectedProductIds
      .map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return null;

        const scriptType = product.status === 'normal' ? 'normal' : product.status === 'warning' ? 'warning' : 'special';
        const script = getScript(id, scriptType);
        const version = getProductLatestVersion(id);

        return {
          产品名称: product.name,
          产品代码: product.code,
          基金经理: product.manager,
          产品规模: `${(product.scale / 100000000).toFixed(2)}亿`,
          最新净值: product.latestNetValue,
          回撤率: `${product.latestDrawdownRate > 0 ? '+' : ''}${product.latestDrawdownRate.toFixed(2)}%`,
          预警线: product.warningLine,
          止损线: product.stopLossLine,
          产品状态: product.status === 'normal' ? '正常' : product.status === 'warning' ? '预警' : '止损',
          客户话术: script.content,
          话术类型: scriptType === 'normal' ? '普通话术' : scriptType === 'warning' ? '警示话术' : '特殊话术',
          版本号: version,
          最后更新: new Date(product.lastUpdated).toLocaleString('zh-CN'),
          导出时间: exportTime,
          导出人: exportUser,
          异常情况: product.anomalies.map((a) => a.description).join('；') || '无',
          数据口径: '系统导入 + 人工编辑',
        };
      })
      .filter(Boolean) as ExportDataItem[];
  };

  const handleExportExcel = () => {
    const exportData = generateExportData();
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 40 },
      { wch: 10 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '周报明细');

    const summaryData = [
      { 统计项: '导出产品数', 数值: selectedProductIds.length },
      { 统计项: '导出时间', 数值: new Date().toLocaleString('zh-CN') },
      { 统计项: '导出人', 数值: '客服-小王' },
      { 统计项: '模板', 数值: templates.find((t) => t.id === selectedTemplate)?.name },
      { 统计项: '格式', 数值: 'Excel' },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, '导出摘要');

    XLSX.writeFile(wb, `净值周报_${new Date().toLocaleDateString('zh-CN')}.xlsx`);

    selectedProductIds.forEach((id) => {
      const product = products.find((p) => p.id === id);
      recordVersion(
        id,
        'export',
        {},
        {
          format: 'xlsx',
          template: selectedTemplate,
          exportTime: new Date().toISOString(),
          productName: product?.name,
          netValue: product?.latestNetValue,
          version: getProductLatestVersion(id),
        },
        `导出Excel周报 - ${templates.find((t) => t.id === selectedTemplate)?.name}`
      );
    });
  };

  const handleExportPDF = () => {
    const htmlContent = generatePDFContent(
      selectedProducts,
      scripts,
      Object.fromEntries(
        selectedProductIds.map((id) => [id, getProductLatestVersion(id)])
      ),
      selectedTemplate
    );

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    selectedProductIds.forEach((id) => {
      const product = products.find((p) => p.id === id);
      recordVersion(
        id,
        'export',
        {},
        {
          format: 'pdf',
          template: selectedTemplate,
          exportTime: new Date().toISOString(),
          productName: product?.name,
          netValue: product?.latestNetValue,
          version: getProductLatestVersion(id),
        },
        `导出PDF周报 - ${templates.find((t) => t.id === selectedTemplate)?.name}`
      );
    });
  };

  const handleExport = () => {
    if (selectedProductIds.length === 0) {
      alert('请至少选择一个产品');
      return;
    }

    setIsExporting(true);

    setTimeout(() => {
      if (exportFormat === 'xlsx') {
        handleExportExcel();
      } else {
        handleExportPDF();
      }
      setIsExporting(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">周报导出</h1>
          <p className="text-sm text-gray-500 mt-1">
            选择产品和模板，批量导出投资人周报，包含完整口径和版本号
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
                导出{exportFormat === 'xlsx' ? 'Excel' : 'PDF'}
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
              {warningProducts.map((product) => {
                const version = getProductLatestVersion(product.id);
                const script = getScript(product.id, product.status === 'normal' ? 'normal' : product.status === 'warning' ? 'warning' : 'special');
                
                return (
                  <div
                    key={product.id}
                    className={cn(
                      'p-4 cursor-pointer transition-colors',
                      selectedProductIds.includes(product.id)
                        ? 'bg-navy-50'
                        : 'hover:bg-gray-50'
                    )}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <div className="flex items-center gap-4">
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
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {version}
                          </span>
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
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {script.modifiedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(product.lastUpdated).toLocaleDateString('zh-CN')}
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
                  </div>
                );
              })}
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

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileCheck className="w-4 h-4 text-success" />
                <span>导出内容包含完整版本号和数据口径，可与历史记录核对</span>
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
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.fields.map((field) => (
                      <span
                        key={field}
                        className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">导出预览</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-navy-600 hover:text-navy-800 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? '收起' : '查看'}
              </button>
            </div>
            {showPreview && selectedProducts.length > 0 && (
              <div className="p-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                  <div className="text-center mb-4 pb-3 border-b border-gray-200">
                    <h4 className="text-lg font-bold text-navy-800">私募产品净值周报</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date().toLocaleDateString('zh-CN')} | {templates.find((t) => t.id === selectedTemplate)?.name}
                    </p>
                  </div>
                  {selectedProducts.slice(0, 2).map((product) => {
                    const script = getScript(product.id, product.status === 'normal' ? 'normal' : 'warning');
                    return (
                      <div key={product.id} className="mb-4 pb-4 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0">
                        <p className="font-semibold text-gray-800 mb-2">{product.name}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                          <span>净值：{product.latestNetValue.toFixed(4)}</span>
                          <span>回撤：{product.latestDrawdownRate.toFixed(2)}%</span>
                        </div>
                        <p className="text-xs text-gray-500 bg-white p-2 rounded">
                          {script.content.substring(0, 80)}...
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          版本号：{getProductLatestVersion(product.id)} | 数据口径：系统导入 + 人工编辑
                        </p>
                      </div>
                    );
                  })}
                  {selectedProducts.length > 2 && (
                    <p className="text-xs text-gray-400 text-center">...还有 {selectedProducts.length - 2} 个产品</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">版本核对说明</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <Hash className="w-4 h-4 text-navy-500 mt-0.5" />
                <span>每个产品导出版本号与历史记录一致</span>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-navy-500 mt-0.5" />
                <span>导出时间戳记录在版本历史中</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-navy-500 mt-0.5" />
                <span>异常记录完整保留，不会遗漏</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
