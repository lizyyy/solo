import React, { useState, useMemo } from 'react';
import { Download, FileText, FileJson, Eye } from 'lucide-react';
import { exportToJSON, exportToText, downloadFile } from '@/services/exportService';
import type { Classroom, Record, ScoreSheet, ExportOptions } from '@/types';

interface ExportPanelProps {
  classroom: Classroom;
  records: Record[];
  scoreSheets: ScoreSheet[];
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ classroom, records, scoreSheets }) => {
  const [options, setOptions] = useState<ExportOptions>({
    includeAnnotations: true,
    includeScoreSheets: true,
    includeSupplemental: true,
  });
  const [showPreview, setShowPreview] = useState(false);

  const previewText = useMemo(() => {
    return exportToText(classroom, records, scoreSheets, options);
  }, [classroom, records, scoreSheets, options]);

  const handleExportJSON = () => {
    const content = exportToJSON(classroom, records, scoreSheets);
    const filename = `课堂记录_${classroom.name}_${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(content, filename, 'application/json');
  };

  const handleExportText = () => {
    const content = exportToText(classroom, records, scoreSheets, options);
    const filename = `课堂记录_${classroom.name}_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadFile(content, filename, 'text/plain');
  };

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="border-2 border-lab-border bg-lab-card p-4 space-y-4">
      <h3 className="text-sm font-mono text-lab-accent mb-4">导出配置</h3>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={options.includeAnnotations}
            onChange={() => toggleOption('includeAnnotations')}
            className="w-4 h-4 accent-lab-accent"
          />
          <span className="text-sm text-lab-text group-hover:text-lab-accent transition-colors">
            包含异常标注解释
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={options.includeScoreSheets}
            onChange={() => toggleOption('includeScoreSheets')}
            className="w-4 h-4 accent-lab-accent"
          />
          <span className="text-sm text-lab-text group-hover:text-lab-accent transition-colors">
            包含评分表内容
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={options.includeSupplemental}
            onChange={() => toggleOption('includeSupplemental')}
            className="w-4 h-4 accent-lab-accent"
          />
          <span className="text-sm text-lab-text group-hover:text-lab-accent transition-colors">
            包含"补材料"记录
          </span>
          {!options.includeSupplemental && (
            <span className="text-xs text-lab-supplement">（仅显示改结论记录）</span>
          )}
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex-1 py-2 px-3 border-2 border-lab-border text-lab-text text-xs font-mono flex items-center justify-center gap-2 hover:bg-lab-border/20 transition-colors"
        >
          <Eye size={14} />
          {showPreview ? '隐藏预览' : '预览'}
        </button>

        <button
          onClick={handleExportText}
          className="flex-1 py-2 px-3 border-2 border-lab-accent text-lab-accent text-xs font-mono flex items-center justify-center gap-2 hover:bg-lab-accent/10 transition-colors"
        >
          <FileText size={14} />
          导出文本
        </button>

        <button
          onClick={handleExportJSON}
          className="flex-1 py-2 px-3 bg-lab-accent text-lab-bg text-xs font-mono flex items-center justify-center gap-2 hover:bg-lab-accent/90 transition-colors"
        >
          <FileJson size={14} />
          导出JSON
        </button>
      </div>

      {showPreview && (
        <div className="mt-4 border-2 border-lab-border animate-slide-in">
          <div className="p-2 bg-lab-border/30 border-b border-lab-border">
            <span className="text-xs font-mono text-lab-text-muted">预览 - 文本格式</span>
          </div>
          <pre className="p-4 max-h-64 overflow-auto text-xs font-mono text-lab-text bg-lab-bg whitespace-pre-wrap">
            {previewText}
          </pre>
        </div>
      )}
    </div>
  );
};
