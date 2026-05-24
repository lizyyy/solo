
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CrackLevel, RecheckStatus, ReportData } from '../types';

const levelLabels: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: '轻微',
  [CrackLevel.MODERATE]: '中等',
  [CrackLevel.SEVERE]: '严重',
};

const statusLabels: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: '待复检',
  [RecheckStatus.VERIFIED]: '已确认',
  [RecheckStatus.RESOLVED]: '已修复',
};

export function generateReportHTML(data: ReportData): string {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPosition = (pos: [number, number, number]) => {
    return `X: ${pos[0].toFixed(2)}, Y: ${pos[1].toFixed(2)}, Z: ${pos[2].toFixed(2)}`;
  };

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>风机叶片巡检报告 - ${data.bladeId}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f8fafc;
          padding: 40px;
          color: #1e293b;
        }
        .report-container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          padding: 32px;
        }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { opacity: 0.8; font-size: 14px; }
        .content { padding: 32px; }
        .section { margin-bottom: 32px; }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .info-item {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
        }
        .info-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
        }
        .annotation-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .annotation-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .annotation-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #f8fafc;
        }
        .annotation-level {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .level-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .level-severe { background: #ef4444; }
        .level-moderate { background: #f97316; }
        .level-light { background: #22c55e; }
        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-verified { background: #cffafe; color: #0e7490; }
        .status-resolved { background: #dcfce7; color: #166534; }
        .annotation-body {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 16px;
          padding: 16px;
        }
        .annotation-photo {
          width: 200px;
          height: 150px;
          object-fit: cover;
          border-radius: 8px;
        }
        .annotation-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .annotation-position {
          font-family: monospace;
          font-size: 13px;
          color: #06b6d4;
          background: #ecfeff;
          padding: 8px 12px;
          border-radius: 6px;
        }
        .annotation-desc {
          font-size: 14px;
          color: #475569;
          line-height: 1.6;
        }
        .annotation-time {
          font-size: 12px;
          color: #94a3b8;
          margin-top: auto;
        }
        .footer {
          padding: 24px 32px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #64748b;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="header">
          <h1>风机叶片巡检报告</h1>
          <p>Wind Turbine Blade Inspection Report</p>
        </div>
        <div class="content">
          <div class="section">
            <div class="section-title">基本信息</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">叶片编号</div>
                <div class="info-value">${data.bladeId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">导出时间</div>
                <div class="info-value">${formatTime(data.exportTime)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">相机位置</div>
                <div class="info-value">${formatPosition(data.cameraPosition)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">观察目标</div>
                <div class="info-value">${formatPosition(data.cameraTarget)}</div>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">裂纹标注 (${data.annotations.length} 条)</div>
            <div class="annotation-list">
              ${data.annotations.map((ann) => `
                <div class="annotation-card">
                  <div class="annotation-header">
                    <div class="annotation-level">
                      <span class="level-dot level-${ann.crackLevel}"></span>
                      <span style="font-weight: 600;">${levelLabels[ann.crackLevel]}裂纹</span>
                    </div>
                    <span class="status-badge status-${ann.recheckStatus}">
                      ${statusLabels[ann.recheckStatus]}
                    </span>
                  </div>
                  <div class="annotation-body">
                    <img src="${ann.photoUrl}" alt="裂纹照片" class="annotation-photo" />
                    <div class="annotation-details">
                      <div class="annotation-position">${formatPosition(ann.position)}</div>
                      <div class="annotation-desc">${ann.description}</div>
                      <div class="annotation-time">照片朝向: ${ann.photoOrientation}° | ${formatTime(ann.timestamp)}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="footer">
          本报告由风机叶片巡检标注系统自动生成 | 导出时筛选条件: ${data.filterLevel.map((l) => levelLabels[l]).join(', ')} | 状态: ${data.filterStatus.map((s) => statusLabels[s]).join(', ')}
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function exportAsPDF(data: ReportData): Promise<void> {
  const html = generateReportHTML(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
    };
  }
}

export async function exportAsHTML(data: ReportData): Promise<void> {
  const html = generateReportHTML(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection-report-${data.bladeId}-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
