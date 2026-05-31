import { useState, useMemo } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ExportCard } from './ExportCard';
import {
  buildExportManifest,
  exportToJSON,
  exportToCSV,
  validateBeforeExport,
  downloadFile,
  generateExportFilename,
} from '@/utils/export';
import { FileJson, FileSpreadsheet, CheckCircle, AlertTriangle, Download, ArrowLeft, RefreshCw, FileCheck } from 'lucide-react';
import { formatDateTimeFull } from '@/utils/time';
import { useNavigate } from 'react-router-dom';

const HANDLING_POLICIES = {
  confirmed: '【处理口径】素材完整、时间准确、审核通过，可直接上线。如无特殊说明，按原计划执行。',
  pending: '【处理口径】存在未解决问题，上线前必须补充完整素材或确认信息。建议标记后延后或单独处理。',
  manual: '【处理口径】经过人工修改，已记录原值和新值的变更轨迹，并由制作人复核。修改原因可追溯。',
};

export function ExportPreview() {
  const navigate = useNavigate();
  const [showValidation, setShowValidation] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(null);

  const records = useTimelineStore(state => state.records);
  const anomalies = useTimelineStore(state => state.anomalies);
  const corrections = useTimelineStore(state => state.corrections);
  const operator = useTimelineStore(state => state.operator);

  const manifest = useMemo(() => {
    return buildExportManifest(records, anomalies, corrections, operator);
  }, [records, anomalies, corrections, operator]);

  const validation = useMemo(() => {
    return validateBeforeExport(records, anomalies);
  }, [records, anomalies]);

  const handleExport = (format: 'json' | 'csv') => {
    setExportingFormat(format);
    setTimeout(() => {
      const content = format === 'json'
        ? exportToJSON(manifest)
        : exportToCSV(manifest);
      const filename = generateExportFilename(format);
      const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
      downloadFile(content, filename, mimeType);
      setExportingFormat(null);
    }, 500);
  };

  const summary = manifest.summary;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
            返回时间轴
          </Button>
          <h1 className="text-sm font-medium text-text-primary tracking-wider uppercase">
            上线清单预览
          </h1>
          <span className="code-text text-text-muted text-[10px]">
            导出时间: {formatDateTimeFull(manifest.exportTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted mr-2">操作人: {operator}</span>
          <Button
            variant={showValidation ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowValidation(!showValidation)}
          >
            <FileCheck className="w-4 h-4" />
            一键复核
          </Button>
          <div className="w-px h-5 bg-border-primary" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'json' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileJson className="w-4 h-4" />
            )}
            导出 JSON
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={exportingFormat !== null}
          >
            {exportingFormat === 'csv' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            导出 CSV
          </Button>
        </div>
      </div>

      {showValidation && (
        <div className={`px-4 py-3 border-b ${validation.valid ? 'border-status-confirmed/30 bg-status-confirmed/10' : 'border-status-anomaly/30 bg-status-anomaly/10'} animate-fade-in`}>
          <div className="flex items-start gap-3">
            {validation.valid ? (
              <CheckCircle className="w-5 h-5 text-status-confirmed flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-status-anomaly flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="text-sm font-medium text-text-primary mb-1">
                {validation.valid ? '复核通过' : '存在待处理问题'}
              </h4>
              {validation.issues.length > 0 ? (
                <ul className="space-y-1">
                  {validation.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                      <span className="text-status-anomaly">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">所有检查项均已通过，可安全导出上线</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowValidation(false)}>
              收起
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">总计</span>
            <Badge variant="default">{summary.total} 条</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">已确认</span>
            <Badge variant="confirmed">{summary.confirmedCount} 条</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">待补</span>
            <Badge variant="pending">{summary.pendingCount} 条</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">人工更正</span>
            <Badge variant="manual">{summary.manualCount} 条</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">未解决异常</span>
            <Badge variant={summary.unresolvedAnomalies > 0 ? 'anomaly' : 'confirmed'}>
              {summary.unresolvedAnomalies} 项
            </Badge>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-text-muted">总时长</span>
            <span className="font-mono text-text-primary">
              {Math.floor(summary.totalDuration / 60)}分{Math.floor(summary.totalDuration % 60)}秒
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-4 h-full min-h-0">
          <ExportCard
            items={manifest.confirmed}
            variant="confirmed"
            title="已确认"
            handlingNote={HANDLING_POLICIES.confirmed}
          />
          <ExportCard
            items={manifest.pending}
            variant="pending"
            title="待补"
            handlingNote={HANDLING_POLICIES.pending}
          />
          <ExportCard
            items={manifest.manual}
            variant="manual"
            title="人工更正"
            handlingNote={HANDLING_POLICIES.manual}
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <div>
            <span className="font-medium text-text-secondary">操作指南：</span>
            1. 点击"一键复核"检查完整性 → 2. 确认三类记录处理口径 → 3. 选择格式导出上线清单
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>导出文件包含完整处理口径和异常说明</span>
          </div>
        </div>
      </div>
    </div>
  );
}
