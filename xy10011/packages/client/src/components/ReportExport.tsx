import { useState } from 'react';
import { api } from '../api/client';

interface Props {
  groupId: string;
}

export function ReportExport({ groupId }: Props) {
  const [format, setFormat] = useState<'excel' | 'markdown' | 'pdf'>('excel');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeAuditLog, setIncludeAuditLog] = useState(false);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const buffer = await api.reports.export({
        format,
        groupId,
        startDate: dateRange.start ? new Date(dateRange.start).getTime() : undefined,
        endDate: dateRange.end ? new Date(dateRange.end).getTime() : undefined,
        includeDetails,
        includeAuditLog,
      });

      const blob = new Blob([buffer], {
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : format === 'pdf' 
          ? 'application/pdf' 
          : 'text/markdown',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bill-report-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败: ' + (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="report-export">
      <h3>导出报告</h3>
      
      <div className="export-form">
        <div className="form-group">
          <label>导出格式</label>
          <div className="format-options">
            <label>
              <input
                type="radio"
                name="format"
                value="excel"
                checked={format === 'excel'}
                onChange={() => setFormat('excel')}
              />
              Excel (.xlsx)
            </label>
            <label>
              <input
                type="radio"
                name="format"
                value="markdown"
                checked={format === 'markdown'}
                onChange={() => setFormat('markdown')}
              />
              Markdown (.md)
            </label>
            <label>
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={format === 'pdf'}
                onChange={() => setFormat('pdf')}
              />
              PDF (.pdf)
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>日期范围 (可选)</label>
          <div className="date-range">
            <input
              type="date"
              value={dateRange.start || ''}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              placeholder="开始日期"
            />
            <span>至</span>
            <input
              type="date"
              value={dateRange.end || ''}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              placeholder="结束日期"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
            />
            包含详细信息
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={includeAuditLog}
              onChange={(e) => setIncludeAuditLog(e.target.checked)}
            />
            包含操作日志
          </label>
        </div>

        <button
          className="primary-button"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? '导出中...' : '导出报告'}
        </button>
      </div>
    </div>
  );
}
