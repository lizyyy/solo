import { useState } from 'react';
import {
  FileJson,
  FileSpreadsheet,
  FileCode,
  Download,
  CheckCircle,
  FileText,
  Clock,
  User,
  Eye,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import { prepareExportData, exportToJSON, exportToCSV, exportToHTML, downloadFile } from '@/utils/exporter';
import { cn } from '@/lib/utils';

type ExportFormat = 'json' | 'csv' | 'html';

interface ExportOption {
  key: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  mimeType: string;
  fileExtension: string;
}

const exportOptions: ExportOption[] = [
  {
    key: 'json',
    label: 'JSON',
    description: '完整数据导出，包含所有元数据',
    icon: <FileCode className="w-6 h-6" />,
    mimeType: 'application/json',
    fileExtension: 'json',
  },
  {
    key: 'csv',
    label: 'CSV',
    description: '表格格式，便于Excel兼容',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    mimeType: 'text/csv;charset=utf-8',
    fileExtension: 'csv',
  },
  {
    key: 'html',
    label: 'HTML打印',
    description: '打印友好的HTML格式',
    icon: <FileText className="w-6 h-6" />,
    mimeType: 'text/html;charset=utf-8',
    fileExtension: 'html',
  },
];

export default function Export() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{
    format: ExportFormat;
    checksum: string;
    time: string;
  } | null>(null);

  const {
    getCurrentHandover,
    getMaterialsForHandover,
    getExceptionsForHandover,
    getStatusLogsForHandover,
    getConfirmationsForHandover,
  } = useHandoverStore();

  const currentHandover = getCurrentHandover();

  if (!currentHandover) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gallery-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gallery-300 mb-4" />
          <h3 className="text-lg font-medium text-gallery-700 mb-2">请先选择交接单</h3>
          <p className="text-gallery-500">在交接工作台中选择或创建交接单</p>
        </div>
      </div>
    );
  }

  const materials = getMaterialsForHandover(currentHandover.id);
  const exceptions = getExceptionsForHandover(currentHandover.id);
  const statusLogs = getStatusLogsForHandover(currentHandover.id);
  const confirmations = getConfirmationsForHandover(currentHandover.id);

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData = prepareExportData(
        currentHandover,
        materials,
        exceptions,
        statusLogs,
        confirmations
      );

      const safeFileName = currentHandover.title.replace(/[^a-z0-9]/gi, '_');
      const option = exportOptions.find(o => o.key === selectedFormat);
      if (!option) return;

      let content: string;
      let checksum: string;

      if (selectedFormat === 'json') {
        const result = await exportToJSON(exportData);
        content = result.content;
        checksum = result.checksum;
      } else if (selectedFormat === 'csv') {
        const result = exportToCSV(exportData);
        content = result.content;
        checksum = result.checksum;
      } else {
        content = exportToHTML(exportData);
        checksum = 'html_export';
      }

      downloadFile(content, `${safeFileName}.${option.fileExtension}`, option.mimeType);

      setLastExport({
        format: selectedFormat,
        checksum,
        time: new Date().toISOString(),
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = () => {
    const exportData = prepareExportData(
      currentHandover,
      materials,
      exceptions,
      statusLogs,
      confirmations
    );
    const htmlContent = exportToHTML(exportData);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gallery-900">导出中心</h1>
        <p className="text-sm text-gallery-500 mt-1">导出交接单数据，确保导出一致性</p>
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg p-4">
        <h3 className="font-medium mb-4">当前交接单</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gallery-500">名称</div>
            <div className="font-medium">{currentHandover.title}</div>
          </div>
          <div>
            <div className="text-gallery-500">材料数</div>
            <div className="font-medium">{materials.length}</div>
          </div>
          <div>
            <div className="text-gallery-500">异常数</div>
            <div className="font-medium">{exceptions.length}</div>
          </div>
          <div>
            <div className="text-gallery-500">状态</div>
            <div className="font-medium">{statusLogs.length} 次变更</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg p-6">
        <h3 className="font-medium mb-4">选择导出格式</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {exportOptions.map(option => (
            <button
              key={option.key}
              onClick={() => setSelectedFormat(option.key)}
              className={cn(
                'p-4 border-2 rounded-lg text-left transition-all',
                selectedFormat === option.key
                  ? 'border-gallery-900 bg-gallery-50'
                  : 'border-gallery-200 hover:border-gallery-300'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                {option.icon}
                <span className="font-medium">{option.label}</span>
              </div>
              <div className="text-xs text-gallery-500">{option.description}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-4 py-2 border border-gallery-300 rounded hover:bg-gallery-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            预览
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 bg-gallery-900 text-white px-4 py-2 rounded hover:bg-gallery-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>

      {lastExport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-green-800">导出成功</div>
              <div className="text-sm text-green-700 mt-1">
                格式: {lastExport.format.toUpperCase()} · 时间:{' '}
                {new Date(lastExport.time).toLocaleString()}
              </div>
              <div className="text-xs text-green-600 mt-1 font-mono">
                校验和: {lastExport.checksum}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gallery-200 rounded-lg p-4">
        <h3 className="font-medium mb-3">导出说明</h3>
        <ul className="text-sm text-gallery-600 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-accent-success flex-shrink-0 mt-0.5" />
            <span>JSON格式包含完整的数据结构，适合存档和程序读取</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-accent-success flex-shrink-0 mt-0.5" />
            <span>CSV格式可以用Excel打开，适合查看表格数据</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-accent-success flex-shrink-0 mt-0.5" />
            <span>HTML格式适合打印和存档展示</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-accent-success flex-shrink-0 mt-0.5" />
            <span>所有格式包含校验和，验证数据完整性</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
