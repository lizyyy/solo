import { useState, useEffect } from 'react';
import { DataExport } from '@/components/data/DataExport';
import { FilterBar } from '@/components/common/FilterBar';
import { useDataStore } from '@/store/useDataStore';
import { useUIStore } from '@/store/useUIStore';
import { getScoresByFilters, getAllLevelConfigs, exportReport } from '@/services/DataService';
import { FriendlyError, getErrorMessage } from '@/utils/errorMessages';
import { saveViewState, loadViewState, syncExportRange } from '@/utils/viewSync';
import { Download, FileJson, Eye } from 'lucide-react';

export default function ExportPage() {
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { scores, levels, filters, setScores, setLevels, setFilters } = useDataStore();
  const { showError, showSuccess } = useUIStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedView = await loadViewState('export');
        if (savedView?.filters) {
          setFilters(savedView.filters);
        }
      } catch (error) {
        console.error('Load view state failed:', error);
      }
    };
    loadData();
  }, [setFilters]);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [scoresData, levelsData] = await Promise.all([
        getScoresByFilters(filters),
        getAllLevelConfigs(),
      ]);
      setScores(scoresData);
      setLevels(levelsData);
      setPreviewData(scoresData.slice(0, 10));
    } catch (error) {
      if (error instanceof FriendlyError) {
        showError(getErrorMessage(error.code));
      } else {
        showError(getErrorMessage('UNKNOWN_ERROR'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    saveViewState('export', filters, {
      scrollTop: 0,
      scrollLeft: 0,
      selectedColumns: ['playerName', 'score', 'status', 'satisfaction', 'createdAt'],
    });
  }, [filters]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await syncExportRange('export');
      await exportReport('export', '当前运营');
      showSuccess(`导出成功！共导出 ${scores.length} 条记录`);
    } catch (error) {
      if (error instanceof FriendlyError) {
        showError(getErrorMessage(error.code));
      } else {
        showError(getErrorMessage('UNKNOWN_ERROR'));
      }
    } finally {
      setIsExporting(false);
    }
  };

  const scoresToExport = scores.length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;
  const maxScore = scores.length > 0
    ? Math.max(...scores.map(s => s.score))
    : 0;
  const pendingCount = scores.filter(s => s.status === 'pending').length;
  const anomalyCount = scores.filter(s => s.anomalyType).length;

  const stats = [
    { label: '总记录数', value: scoresToExport, icon: FileJson, color: 'text-neon-blue' },
    { label: '平均分', value: avgScore, icon: Eye, color: 'text-neon-green' },
    { label: '最高分', value: maxScore, icon: Eye, color: 'text-neon-orange' },
    { label: '待复核', value: pendingCount, icon: Eye, color: 'text-neon-yellow' },
    { label: '异常数', value: anomalyCount, icon: Eye, color: 'text-neon-pink' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-purple via-neon-purple/30 to-deep-purple p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Download className="w-8 h-8 text-neon-orange" />
          <div>
            <h1 className="font-title text-3xl md:text-4xl text-neon-orange drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]">
              活动复盘导出
            </h1>
            <p className="text-gray-300 font-body">导出当前筛选条件下的所有数据</p>
          </div>
        </div>

        <div className="bg-deep-purple/80 backdrop-blur border-2 border-neon-purple/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-neon-yellow" />
            <h3 className="font-body font-bold text-neon-yellow">导出范围说明</h3>
          </div>
          <p className="text-gray-300 text-sm font-body mb-4">
            导出的数据与当前屏幕显示的筛选结果完全一致。如果修改了筛选条件，导出内容也会相应更新。
            导出文件包含完整的元数据，包括筛选条件、导出时间、操作人等信息。
          </p>
          <div className="flex flex-wrap gap-3">
            {stats.map((stat, index) => (
              <div key={index} className="bg-neon-purple/10 rounded-xl px-4 py-3 flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <div className="text-gray-400 text-xs font-body">{stat.label}</div>
                  <div className={`font-bold text-lg ${stat.color}`}>{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <FilterBar
          filters={filters}
          levels={levels}
          onFilterChange={handleFilterChange}
          onRefresh={fetchData}
          isLoading={isLoading}
        />

        <div className="mt-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="text-gray-300 font-body">
            当前筛选条件下共有 <span className="text-neon-orange font-bold">{scoresToExport}</span> 条记录
            {pendingCount > 0 && (
              <span className="text-neon-yellow ml-2">
                （含 {pendingCount} 条待复核）
              </span>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting || scoresToExport === 0}
            className="w-full md:w-auto bg-neon-green text-deep-purple font-bold py-3 px-8 rounded-xl hover:shadow-neon-green transition-all flex items-center justify-center gap-2 font-body disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {isExporting ? '导出中...' : '导出活动复盘报告'}
          </button>
        </div>

        <div className="mt-6">
          <DataExport
            scores={scores}
            levels={levels}
            previewData={previewData}
            filters={filters}
            isLoading={isLoading}
            onExport={handleExport}
          />
        </div>

        <div className="mt-6 bg-neon-blue/10 border border-neon-blue/30 rounded-2xl p-6">
          <h4 className="text-neon-blue font-bold mb-4 font-body">📄 导出文件内容说明</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="text-white font-bold mb-2 font-body">文件包含：</h5>
              <ul className="text-gray-300 space-y-1 font-body">
                <li>• 导出时间和操作人</li>
                <li>• 当前筛选条件快照</li>
                <li>• 数据统计摘要（平均分、最高分等）</li>
                <li>• 完整的玩家分数记录</li>
                <li>• 屏幕视图快照（滚动位置、列配置）</li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-bold mb-2 font-body">使用场景：</h5>
              <ul className="text-gray-300 space-y-1 font-body">
                <li>• 活动复盘分析</li>
                <li>• 数据备份存档</li>
                <li>• 跨团队数据共享</li>
                <li>• 异常问题追溯</li>
                <li>• 报表生成素材</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
