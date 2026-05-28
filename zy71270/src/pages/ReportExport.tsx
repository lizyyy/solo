import { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Table,
  Image,
  Download,
  Settings2,
  Eye,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import GlassPanel from '../components/common/GlassPanel';
import Badge from '../components/common/Badge';
import { useDataStore } from '../store/dataStore';
import { useFilterStore } from '../store/filterStore';
import { useModificationStore } from '../store/modificationStore';
import { exportToPDF, exportToExcel, captureScene } from '../utils/exporters';
import { formatTimestamp } from '../utils/format';
import type { Shelf } from '../types';

type ExportFormat = 'pdf' | 'excel' | 'image';
type ReportType = 'density' | 'congestion' | 'charging' | 'full';

interface ExportConfig {
  format: ExportFormat;
  reportType: ReportType;
  timeRange: { start: number; end: number };
  includeHeatmap: boolean;
  includePaths: boolean;
  includeQueue: boolean;
  includeModificationHistory: boolean;
}

interface ReportExportProps {
  noHeader?: boolean;
}

export default function ReportExport({ }: ReportExportProps) {
  const warehouse = useDataStore((s) => s.warehouse);
  const robots = useDataStore((s) => s.robots);
  const pathSegments = useDataStore((s) => s.pathSegments);
  const congestionReports = useDataStore((s) => s.congestionReports);
  const timeRange = useFilterStore((s) => s.timeRange);
  const modifications = useModificationStore((s) => s.modifications);

  const [config, setConfig] = useState<ExportConfig>({
    format: 'pdf',
    reportType: 'full',
    timeRange,
    includeHeatmap: true,
    includePaths: true,
    includeQueue: true,
    includeModificationHistory: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const topCongestedShelves = useMemo(() => {
    if (!warehouse) return [];
    const allShelves: Shelf[] = [];
    for (const floor of warehouse.floors) {
      allShelves.push(...floor.shelves);
    }
    return allShelves
      .filter((s) => s.congestionLevel !== undefined && s.congestionLevel > 0)
      .sort((a, b) => (b.congestionLevel ?? 0) - (a.congestionLevel ?? 0))
      .slice(0, 10)
      .map((s) => ({ id: s.id, level: s.congestionLevel ?? 0 }));
  }, [warehouse]);

  const chargingQueueCount = useMemo(() => {
    if (!warehouse) return 0;
    let count = 0;
    for (const floor of warehouse.floors) {
      for (const station of floor.chargingStations) {
        count += station.queue.length;
      }
    }
    return count;
  }, [warehouse]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const baseConfig = {
        warehouseName: warehouse?.name ?? '未知仓库',
        robotCount: robots.length,
        segmentCount: pathSegments.length,
        congestionCount: congestionReports.length,
        timeRange: config.timeRange,
        reportType: config.reportType,
        includeHeatmap: config.includeHeatmap,
        includePaths: config.includePaths,
        includeQueue: config.includeQueue,
        includeModificationHistory: config.includeModificationHistory,
        topCongestedShelves,
        chargingQueueCount,
        modifications: config.includeModificationHistory ? modifications : undefined,
      };

      if (config.format === 'pdf') {
        await exportToPDF(baseConfig, `仓储路径云图报告_${formatTimestamp(Date.now())}`);
      } else if (config.format === 'excel') {
        await exportToExcel(
          {
            ...baseConfig,
            pathSegments,
            congestionReports,
            robots,
          },
          `仓储数据_${formatTimestamp(Date.now())}`
        );
      } else {
        await captureScene(document.body, `仓储场景_${formatTimestamp(Date.now())}`);
      }
      setExportSuccess(true);
    } catch (err) {
      console.error('导出失败:', err);
    } finally {
      setIsExporting(false);
    }
  }, [config, warehouse, robots, pathSegments, congestionReports, topCongestedShelves, chargingQueueCount, modifications]);

  const formatOptions: { value: ExportFormat; label: string; icon: React.ElementType }[] = [
    { value: 'pdf', label: 'PDF 报告', icon: FileText },
    { value: 'excel', label: 'Excel 数据', icon: Table },
    { value: 'image', label: '场景截图', icon: Image },
  ];

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: 'full', label: '完整报告' },
    { value: 'density', label: '路径密度分析' },
    { value: 'congestion', label: '拥堵热力分析' },
    { value: 'charging', label: '充电排队分析' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-warehouse-bg">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold gradient-text mb-1">报告导出</h2>
          <p className="text-sm text-slate-500">选择导出格式和内容维度，生成分析报告</p>
        </div>

        <GlassPanel title="导出格式" icon={<Download className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-3">
            {formatOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setConfig({ ...config, format: opt.value })}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  config.format === opt.value
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-warehouse-border bg-warehouse-surface/50 text-slate-400 hover:border-slate-500'
                }`}
              >
                <opt.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="报告类型" icon={<Settings2 className="w-4 h-4" />}>
          <div className="space-y-2">
            {reportOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                  config.reportType === opt.value
                    ? 'border-accent-blue/50 bg-accent-blue/5'
                    : 'border-transparent hover:bg-warehouse-surface/50'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  value={opt.value}
                  checked={config.reportType === opt.value}
                  onChange={() => setConfig({ ...config, reportType: opt.value })}
                  className="accent-accent-blue"
                />
                <span className="text-sm text-slate-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="包含内容" icon={<Eye className="w-4 h-4" />}>
          <div className="space-y-3">
            {[
              { key: 'includeHeatmap' as const, label: '拥堵热力图' },
              { key: 'includePaths' as const, label: '路径密度云图' },
              { key: 'includeQueue' as const, label: '充电排队数据' },
              { key: 'includeModificationHistory' as const, label: '人工修改记录' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[item.key] as boolean}
                  onChange={(e) =>
                    setConfig({ ...config, [item.key]: e.target.checked })
                  }
                  className="rounded accent-accent-blue"
                />
                <span className="text-sm text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>
        </GlassPanel>

        <div className="flex items-center justify-between p-4 glass rounded-lg">
          <div className="flex items-center gap-3">
            {exportSuccess && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-green" />
                <span className="text-sm text-status-green">导出成功</span>
              </div>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`btn btn-primary flex items-center gap-2 ${
              isExporting ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isExporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出报告
              </>
            )}
          </button>
        </div>

        <GlassPanel title="数据概览" collapsible defaultCollapsed>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <div className="text-xs text-slate-500 mb-1">仓库</div>
              <div className="text-sm font-mono text-slate-200">{warehouse?.name ?? '-'}</div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500 mb-1">机器人</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-slate-200">{robots.length}</span>
                <Badge variant="info">{robots.filter((r) => r.status === 'working').length} 运行</Badge>
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500 mb-1">路径段</div>
              <span className="text-sm font-mono text-slate-200">{pathSegments.length}</span>
            </div>
            <div className="card">
              <div className="text-xs text-slate-500 mb-1">拥堵报告</div>
              <span className="text-sm font-mono text-slate-200">{congestionReports.length}</span>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
