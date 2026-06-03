import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { RowStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Download,
  Lock,
  Unlock,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import html2canvas from 'html2canvas';

const statusLabels: Record<RowStatus, string> = {
  pending: '待处理',
  modified: '已修改',
  review: '待复核',
  archived: '已归档',
};

export default function Export() {
  const { rows, archiveRow, unarchiveRow, currentUser } = useStore();
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [showArchivedSection, setShowArchivedSection] = useState(false);

  const filteredRows = showArchivedOnly
    ? rows.filter((r) => r.status !== 'archived')
    : rows;

  const archivedRows = rows.filter((r) => r.status === 'archived');
  const archivableRows = rows.filter(
    (r) => r.status === 'modified' || r.status === 'review' || r.status === 'archived'
  );

  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const modifiedCount = rows.filter((r) => r.status === 'modified').length;
  const reviewCount = rows.filter((r) => r.status === 'review').length;
  const archivedCount = archivedRows.length;

  const handleExportScreenshot = async () => {
    const element = document.getElementById('export-preview');
    if (!element) return;
    const canvas = await html2canvas(element, { backgroundColor: '#1a1a2e' });
    const link = document.createElement('a');
    link.download = `隧道照明暗区巡检_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleExportCSV = () => {
    const headers = [
      '原始行号',
      '隧道名称',
      '坐标原点',
      '安全半径',
      '长度',
      '计算长度',
      '备注',
      '状态',
    ];
    const csvRows = filteredRows.map((r) =>
      [
        r.originalRowNumber,
        r.tunnelName,
        r.coordinateOrigin,
        r.radius,
        r.length,
        r.calculatedLength,
        r.remark,
        r.status,
      ].join(',')
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `隧道照明暗区巡检_${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleArchive = (id: string) => {
    if (archiveConfirmId === id) {
      archiveRow(id);
      setArchiveConfirmId(null);
    } else {
      setArchiveConfirmId(id);
    }
  };

  return (
    <div className="min-h-screen bg-tunnel-bg p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tunnel-fg flex items-center gap-2">
          <Download className="w-6 h-6 text-tunnel-accent" />
          导出与归档
        </h1>
        <p className="text-tunnel-muted mt-1">截图导出 · 归档锁定 · 数据保全</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-tunnel-card border border-tunnel-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-tunnel-info text-sm">
            <AlertTriangle className="w-4 h-4" />
            待处理
          </div>
          <div className="text-2xl font-bold text-tunnel-fg mt-1">{pendingCount}</div>
        </div>
        <div className="bg-tunnel-card border border-tunnel-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-tunnel-accent text-sm">
            <FileText className="w-4 h-4" />
            已修改
          </div>
          <div className="text-2xl font-bold text-tunnel-fg mt-1">{modifiedCount}</div>
        </div>
        <div className="bg-tunnel-card border border-tunnel-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-tunnel-danger text-sm">
            <AlertTriangle className="w-4 h-4" />
            待复核
          </div>
          <div className="text-2xl font-bold text-tunnel-fg mt-1">{reviewCount}</div>
        </div>
        <div className="bg-tunnel-card border border-tunnel-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-tunnel-success text-sm">
            <CheckCircle2 className="w-4 h-4" />
            已归档
          </div>
          <div className="text-2xl font-bold text-tunnel-fg mt-1">{archivedCount}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-tunnel-fg flex items-center gap-2">
          <Camera className="w-5 h-5 text-tunnel-accent" />
          截图导出
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchivedOnly(!showArchivedOnly)}
            className="text-sm text-tunnel-muted hover:text-tunnel-fg transition-colors"
          >
            {showArchivedOnly ? '显示全部' : '仅显示未归档'}
          </button>
        </div>
        <div id="export-preview" className="bg-tunnel-card rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tunnel-border text-tunnel-muted">
                <th className="p-3 text-left">原始行号</th>
                <th className="p-3 text-left">隧道名称</th>
                <th className="p-3 text-left">坐标原点</th>
                <th className="p-3 text-left">安全半径</th>
                <th className="p-3 text-left">长度</th>
                <th className="p-3 text-left">计算长度</th>
                <th className="p-3 text-left">备注</th>
                <th className="p-3 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-tunnel-border/50 text-tunnel-fg"
                >
                  <td className="p-3">{row.originalRowNumber}</td>
                  <td className="p-3">{row.tunnelName}</td>
                  <td className="p-3">{row.coordinateOrigin}</td>
                  <td className="p-3">{row.radius}</td>
                  <td className="p-3">{row.length}</td>
                  <td className="p-3">{row.calculatedLength}</td>
                  <td className="p-3">{row.remark}</td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportScreenshot}
            className="flex items-center gap-2 px-4 py-2 bg-tunnel-accent text-tunnel-bg rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Camera className="w-4 h-4" />
            导出截图 (PNG)
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-tunnel-info text-tunnel-fg rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <FileText className="w-4 h-4" />
            导出 CSV
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-tunnel-fg flex items-center gap-2">
          <Lock className="w-5 h-5 text-tunnel-accent" />
          归档管理
        </h2>
        <div className="bg-tunnel-card border border-tunnel-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tunnel-border text-tunnel-muted">
                <th className="p-3 text-left">原始行号</th>
                <th className="p-3 text-left">隧道名称</th>
                <th className="p-3 text-left">状态</th>
                <th className="p-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {archivableRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-tunnel-border/50 text-tunnel-fg"
                >
                  <td className="p-3">{row.originalRowNumber}</td>
                  <td className="p-3">{row.tunnelName}</td>
                  <td className="p-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-3">
                    {row.status !== 'archived' ? (
                      <>
                        {archiveConfirmId === row.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-tunnel-danger">
                              确认归档？归档后需展陈客户确认才能解锁
                            </span>
                            <button
                              onClick={() => handleArchive(row.id)}
                              className="px-2 py-1 bg-tunnel-danger text-white rounded text-xs hover:opacity-90"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => setArchiveConfirmId(null)}
                              className="px-2 py-1 bg-tunnel-border text-tunnel-fg rounded text-xs hover:opacity-90"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleArchive(row.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-tunnel-accent/20 text-tunnel-accent rounded text-xs hover:bg-tunnel-accent/30 transition-colors"
                          >
                            <Lock className="w-3 h-3" />
                            归档
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => unarchiveRow(row.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-tunnel-success/20 text-tunnel-success rounded text-xs hover:bg-tunnel-success/30 transition-colors"
                      >
                        <Unlock className="w-3 h-3" />
                        取消归档
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setShowArchivedSection(!showArchivedSection)}
          className="flex items-center gap-2 text-lg font-semibold text-tunnel-fg"
        >
          <Eye className="w-5 h-5 text-tunnel-accent" />
          已归档记录
          <span className="text-sm text-tunnel-muted">({archivedCount})</span>
        </button>
        {showArchivedSection && (
          <div className="space-y-2">
            {archivedRows.map((row) => (
              <div
                key={row.id}
                className="bg-tunnel-card border border-tunnel-border rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-tunnel-fg">
                    行 {row.originalRowNumber} - {row.tunnelName}
                  </div>
                  <div className="text-xs text-tunnel-muted">
                    归档时间: {new Date(row.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                {currentUser.role === 'client' && (
                  <button
                    onClick={() => unarchiveRow(row.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-tunnel-success/20 text-tunnel-success rounded text-xs hover:bg-tunnel-success/30 transition-colors"
                  >
                    <Unlock className="w-3 h-3" />
                    解锁
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
