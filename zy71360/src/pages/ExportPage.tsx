import { useState } from 'react';
import { useShotStore } from '@/store/useShotStore';
import { FilmBorder } from '@/components/common/FilmBorder';
import { AuditLogList } from '@/components/audit/AuditLogList';
import {
  Download,
  Calendar,
  FileText,
  Table,
  Code,
  BarChart3,
  Clock,
  Edit3,
  RotateCcw,
  Lock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { generateMonthlyStats } from '@/utils/audit';
import { exportToMarkdown, exportToCSV } from '@/utils/export';
import { formatDate } from '@/utils/version';

type ExportFormat = 'markdown' | 'csv' | 'json';

export function ExportPage() {
  const { shots, auditLogs, currentUser, generateMonthlyReport } = useShotStore();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();
  const [includeChanges, setIncludeChanges] = useState(true);
  const [includeRollbacks, setIncludeRollbacks] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');

  const stats = generateMonthlyStats(auditLogs, selectedMonth, selectedShotId, shots);
  const selectedShot = selectedShotId
    ? shots.find((s) => s.id === selectedShotId)
    : undefined;

  const filteredLogs = auditLogs.filter((log) => {
    const logDate = new Date(log.timestamp);
    const logMonth = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
    if (logMonth !== selectedMonth) return false;
    if (selectedShotId && log.shotId !== selectedShotId) return false;
    if (!includeChanges && log.action === 'edit') return false;
    if (!includeRollbacks && log.action === 'rollback') return false;
    return true;
  });

  const handleExport = () => {
    const report = generateMonthlyReport(selectedMonth, selectedShotId);

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (selectedFormat) {
      case 'csv':
        content = exportToCSV(report);
        filename = `分镜变更报告-${selectedMonth}.csv`;
        mimeType = 'text/csv;charset=utf-8';
        break;
      case 'json':
        content = JSON.stringify(report, null, 2);
        filename = `分镜变更报告-${selectedMonth}.json`;
        mimeType = 'application/json;charset=utf-8';
        break;
      default:
        content = exportToMarkdown(report);
        filename = `分镜变更报告-${selectedMonth}.md`;
        mimeType = 'text/markdown;charset=utf-8';
    }

    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatOptions = [
    { key: 'markdown', label: 'Markdown', icon: FileText, desc: '适合文档预览' },
    { key: 'csv', label: 'CSV', icon: Table, desc: '适合Excel导入' },
    { key: 'json', label: 'JSON', icon: Code, desc: '适合程序处理' },
  ];

  return (
    <div className="min-h-screen">
      <FilmBorder>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-film-primary/20 rounded-lg">
                <Download className="w-5 h-5 text-film-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-film-text-primary">变更报告导出</h2>
                <p className="text-sm text-film-text-secondary">
                  月度复盘 · 变更统计 · 审计追溯
                </p>
              </div>
            </div>
            <div className="text-sm text-film-text-secondary">
              {currentUser.name} · {formatDate(new Date().toISOString())}
            </div>
          </div>
        </div>
      </FilmBorder>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-film-text-primary mb-4">筛选条件</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-film-text-secondary mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  统计月份
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-film-panel border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-film-text-secondary mb-2">
                  筛选镜头（可选）
                </label>
                <select
                  value={selectedShotId || ''}
                  onChange={(e) =>
                    setSelectedShotId(e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 bg-film-panel border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary"
                >
                  <option value="">全部镜头</option>
                  {shots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shotNumber} - {s.versions[0]?.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeChanges}
                    onChange={(e) => setIncludeChanges(e.target.checked)}
                    className="w-4 h-4 rounded border-film-border bg-film-panel text-film-primary focus:ring-film-primary"
                  />
                  <span className="text-sm text-film-text-primary">包含编辑修改</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRollbacks}
                    onChange={(e) => setIncludeRollbacks(e.target.checked)}
                    className="w-4 h-4 rounded border-film-border bg-film-panel text-film-primary focus:ring-film-primary"
                  />
                  <span className="text-sm text-film-text-primary">包含回滚操作</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-film-text-primary mb-4">导出格式</h3>
            <div className="space-y-2">
              {formatOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === opt.key
                        ? 'bg-film-primary/20 border border-film-primary'
                        : 'bg-film-panel border border-transparent hover:border-film-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={opt.key}
                      checked={selectedFormat === opt.key}
                      onChange={(e) =>
                        setSelectedFormat(e.target.value as ExportFormat)
                      }
                      className="hidden"
                    />
                    <Icon
                      className={`w-5 h-5 ${
                        selectedFormat === opt.key ? 'text-film-primary' : 'text-film-text-muted'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-film-text-primary">{opt.label}</p>
                      <p className="text-xs text-film-text-muted">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-film-primary hover:bg-film-primary/80 disabled:bg-film-border disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 {filteredLogs.length} 条记录
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-film-card border border-film-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-film-text-muted text-sm mb-2">
                <Clock className="w-4 h-4" />
                总操作数
              </div>
              <p className="text-3xl font-bold text-film-text-primary">{stats.total}</p>
            </div>
            <div className="bg-film-card border border-film-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-film-primary text-sm mb-2">
                <Edit3 className="w-4 h-4" />
                编辑修改
              </div>
              <p className="text-3xl font-bold text-film-primary">{stats.updates}</p>
            </div>
            <div className="bg-film-card border border-film-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-film-danger text-sm mb-2">
                <RotateCcw className="w-4 h-4" />
                回滚操作
              </div>
              <p className="text-3xl font-bold text-film-danger">{stats.rollbacks}</p>
            </div>
            <div className="bg-film-card border border-film-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-film-warning text-sm mb-2">
                <Lock className="w-4 h-4" />
                锁定变更
              </div>
              <p className="text-3xl font-bold text-film-warning">{stats.locks + stats.unlocks}</p>
            </div>
          </div>

          {stats.rollbacks > 0 && (
            <div className="p-4 bg-film-danger/10 border border-film-danger/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-film-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-film-danger mb-1">
                    本月检测到 {stats.rollbacks} 次回滚操作
                  </p>
                  <p className="text-sm text-film-text-secondary">
                    回滚操作已单独标记，建议在复盘时重点关注，避免误判为正常修改结论。
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.rollbacks === 0 && stats.total > 0 && (
            <div className="p-4 bg-film-success/10 border border-film-success/30 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-film-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-film-success mb-1">本月无回滚操作</p>
                  <p className="text-sm text-film-text-secondary">
                    所有修改均保持稳定，未发生版本回退情况。
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.mostActiveUser && (
            <div className="bg-film-card border border-film-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">月度活跃统计</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-film-panel rounded-lg">
                  <p className="text-sm text-film-text-muted mb-1">最活跃用户</p>
                  <p className="text-lg font-semibold text-film-text-primary">
                    {stats.mostActiveUser.name}
                  </p>
                  <p className="text-xs text-film-text-muted">
                    {stats.userStats[stats.mostActiveUser.id] || 0} 次操作
                  </p>
                </div>
                <div className="p-4 bg-film-panel rounded-lg">
                  <p className="text-sm text-film-text-muted mb-1">字段修改总数</p>
                  <p className="text-lg font-semibold text-film-text-primary">
                    {stats.fieldChangesTotal} 处
                  </p>
                  <p className="text-xs text-film-text-muted">
                    分布在 {stats.shotsAffected} 个镜头中
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-film-card border border-film-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-film-primary" />
                <h3 className="text-lg font-semibold text-film-text-primary">
                  审计日志
                  <span className="text-sm font-normal text-film-text-muted ml-2">
                    ({filteredLogs.length} 条记录)
                  </span>
                </h3>
              </div>
            </div>

            {selectedShot && (
              <div className="mb-4 p-3 bg-film-secondary/30 rounded-lg text-sm text-film-text-primary">
                正在筛选: <span className="font-mono text-film-primary">{selectedShot.shotNumber}</span>
                <button
                  onClick={() => setSelectedShotId(undefined)}
                  className="ml-2 text-film-text-muted hover:text-film-text-primary"
                >
                  清除筛选
                </button>
              </div>
            )}

            <AuditLogList logs={filteredLogs} />
          </div>
        </div>
      </div>
    </div>
  );
}
