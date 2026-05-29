import { useState } from 'react';
import { Download, Image, FileText, FileSpreadsheet, FileJson, ChevronDown, ChevronUp } from 'lucide-react';
import type { ExportOptions, ExportFormat, Experiment } from '../../types';
import { exportManager } from '../../utils/export';

interface ExportPanelProps {
  experiment: Experiment;
  targetRef: React.RefObject<HTMLElement>;
}

export function ExportPanel({ experiment, targetRef }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'png',
    includeSpectrum: true,
    includePeaks: true,
    includeMetadata: true,
  });

  const handleExport = async () => {
    if (!targetRef.current) return;

    setIsExporting(true);
    try {
      await exportManager.export(targetRef.current, experiment, options);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formats: { value: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { value: 'png', label: 'PNG 图片', icon: <Image className="w-4 h-4" /> },
    { value: 'pdf', label: 'PDF 报告', icon: <FileText className="w-4 h-4" /> },
    { value: 'csv', label: 'CSV 数据', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { value: 'json', label: 'JSON 数据', icon: <FileJson className="w-4 h-4" /> },
  ];

  return (
    <div className="glass rounded-lg overflow-hidden mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-medium text-dark-100">导出数据</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-dark-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-dark-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="text-xs text-dark-300 mb-2 block">导出格式</label>
            <div className="grid grid-cols-2 gap-2">
              {formats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setOptions({ ...options, format: format.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-all ${
                    options.format === format.value
                      ? 'bg-primary-500 text-dark-900'
                      : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                  }`}
                >
                  {format.icon}
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          {(options.format === 'png' || options.format === 'pdf') && (
            <div className="space-y-2">
              <label className="text-xs text-dark-300 block">包含内容</label>
              {[
                { key: 'includeSpectrum', label: '频谱图' },
                { key: 'includePeaks', label: '峰值数据' },
                { key: 'includeMetadata', label: '实验元数据' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-xs text-dark-200">
                  <input
                    type="checkbox"
                    checked={options[item.key as keyof ExportOptions] as boolean}
                    onChange={(e) =>
                      setOptions({ ...options, [item.key]: e.target.checked })
                    }
                    className="rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
