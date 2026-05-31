import { useState, useEffect } from 'react';
import { DataHistory } from '@/components/data/DataHistory';
import { FilterBar } from '@/components/common/FilterBar';
import { useDataStore } from '@/store/useDataStore';
import { useUIStore } from '@/store/useUIStore';
import { getOperationHistory, getAllLevelConfigs, getDataVersions } from '@/services/DataService';
import { FriendlyError, getErrorMessage } from '@/utils/errorMessages';
import { saveViewState, loadViewState } from '@/utils/viewSync';
import type { OperationHistory, DataVersion } from '@/types/data';
import { History, Clock } from 'lucide-react';

export default function HistoryPage() {
  const [operationHistory, setOperationHistory] = useState<OperationHistory[]>([]);
  const [dataVersions, setDataVersions] = useState<Record<string, DataVersion[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [targetType, setTargetType] = useState<'all' | 'score' | 'level'>('all');

  const { levels, filters, setLevels, setFilters } = useDataStore();
  const { showError } = useUIStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedView = await loadViewState('history');
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
  }, [targetType]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [history, levelsData] = await Promise.all([
        targetType === 'all' 
          ? getOperationHistory() 
          : getOperationHistory(targetType),
        getAllLevelConfigs(),
      ]);
      setOperationHistory(history);
      setLevels(levelsData);

      const versionMap: Record<string, DataVersion[]> = {};
      const uniqueScoreIds = [...new Set(history.filter(h => h.targetType === 'score').map(h => h.targetId))];
      for (const id of uniqueScoreIds.slice(0, 10)) {
        versionMap[id] = await getDataVersions('player_score', id);
      }
      setDataVersions(versionMap);
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
    saveViewState('history', filters, {
      scrollTop: 0,
      scrollLeft: 0,
      selectedColumns: ['operationType', 'targetType', 'operator', 'createdAt'],
    });
  }, [filters]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const operationTypeLabels: Record<string, { label: string; color: string }> = {
    import: { label: '导入', color: 'bg-neon-blue' },
    review: { label: '复核', color: 'bg-neon-green' },
    correct: { label: '修正', color: 'bg-neon-yellow' },
    export: { label: '导出', color: 'bg-neon-purple' },
  };

  const targetTypeLabels: Record<string, string> = {
    score: '分数',
    level: '关卡',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-purple via-neon-purple/30 to-deep-purple p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <History className="w-8 h-8 text-neon-orange" />
          <div>
            <h1 className="font-title text-3xl md:text-4xl text-neon-orange drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]">
              操作历史
            </h1>
            <p className="text-gray-300 font-body">查看所有数据操作的完整记录</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { id: 'all', label: '全部' },
            { id: 'score', label: '分数操作' },
            { id: 'level', label: '关卡操作' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTargetType(tab.id as typeof targetType)}
              className={`px-4 py-2 rounded-xl font-bold transition-all font-body ${
                targetType === tab.id
                  ? 'bg-neon-orange text-white'
                  : 'bg-neon-purple/20 text-gray-300 hover:bg-neon-purple/40 border border-neon-purple/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <FilterBar
          filters={filters}
          levels={levels}
          onFilterChange={handleFilterChange}
          onRefresh={fetchData}
          isLoading={isLoading}
          showStatusFilter={false}
        />

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <DataHistory
              history={operationHistory}
              isLoading={isLoading}
              operationTypeLabels={operationTypeLabels}
              targetTypeLabels={targetTypeLabels}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-deep-purple/80 backdrop-blur border border-neon-purple/30 rounded-2xl p-6">
              <h3 className="font-title text-xl text-neon-orange mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                数据统计
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-body">总操作数</span>
                  <span className="text-white font-bold text-xl">{operationHistory.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-body">导入操作</span>
                  <span className="text-neon-blue font-bold">
                    {operationHistory.filter(h => h.operationType === 'import').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-body">复核操作</span>
                  <span className="text-neon-green font-bold">
                    {operationHistory.filter(h => h.operationType === 'review').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-body">修正操作</span>
                  <span className="text-neon-yellow font-bold">
                    {operationHistory.filter(h => h.operationType === 'correct').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-body">导出操作</span>
                  <span className="text-neon-purple font-bold">
                    {operationHistory.filter(h => h.operationType === 'export').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-neon-green/10 border border-neon-green/30 rounded-2xl p-4">
              <h4 className="text-neon-green font-bold mb-2 font-body">💡 小提示</h4>
              <ul className="text-gray-300 text-sm space-y-1 font-body">
                <li>• 所有数据修改都会记录操作历史</li>
                <li>• 每次修改都会创建版本快照</li>
                <li>• 可以随时回滚到任意历史版本</li>
                <li>• 操作人、时间、原因一目了然</li>
              </ul>
            </div>

            {Object.keys(dataVersions).length > 0 && (
              <div className="bg-deep-purple/80 backdrop-blur border border-neon-purple/30 rounded-2xl p-4">
                <h4 className="text-neon-orange font-bold mb-3 font-body">📋 最近版本记录</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(dataVersions).slice(0, 5).map(([scoreId, versions]) => (
                    <div key={scoreId} className="text-sm">
                      <div className="text-gray-400 font-body truncate">分数ID: {scoreId.slice(0, 12)}...</div>
                      <div className="text-neon-yellow font-body">共 {versions.length} 个版本</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
