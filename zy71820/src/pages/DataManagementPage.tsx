import { useState, useEffect } from 'react';
import { DataImport } from '@/components/data/DataImport';
import { DataReview } from '@/components/data/DataReview';
import { DataCorrect } from '@/components/data/DataCorrect';
import { FilterBar } from '@/components/common/FilterBar';
import { useDataStore } from '@/store/useDataStore';
import { useUIStore } from '@/store/useUIStore';
import { getScoresByFilters, getAllLevelConfigs, reviewScore, correctScore } from '@/services/DataService';
import { FriendlyError, getErrorMessage } from '@/utils/errorMessages';
import { saveViewState, loadViewState } from '@/utils/viewSync';
import type { PlayerScore } from '@/types/data';
import { Upload, CheckCircle, Edit3, Database } from 'lucide-react';

type TabType = 'import' | 'review' | 'correct';

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('review');
  const [selectedScore, setSelectedScore] = useState<PlayerScore | null>(null);

  const { scores, levels, isLoading, filters, setScores, setLevels, setIsLoading, setFilters } = useDataStore();
  const { showError, showSuccess } = useUIStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedView = await loadViewState('data-management');
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
    saveViewState('data-management', filters, {
      scrollTop: 0,
      scrollLeft: 0,
      selectedColumns: ['playerName', 'score', 'status', 'createdAt'],
    });
  }, [filters]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleImportComplete = () => {
    showSuccess('导入成功！数据已保存');
    fetchData();
  };

  const handleReview = async (scoreId: string, isApproved: boolean, note: string) => {
    try {
      const reviewer = '当前运营';
      await reviewScore(scoreId, isApproved, reviewer, note);
      showSuccess(isApproved ? '已通过复核' : '已驳回该分数');
      fetchData();
      setSelectedScore(null);
    } catch (error) {
      if (error instanceof FriendlyError) {
        showError(getErrorMessage(error.code));
      } else {
        showError(getErrorMessage('UNKNOWN_ERROR'));
      }
    }
  };

  const handleCorrect = async (scoreId: string, newScore: number, newSatisfaction: number, reason: string) => {
    try {
      const corrector = '当前运营';
      await correctScore(scoreId, newScore, newSatisfaction, corrector, reason);
      showSuccess('修正已保存，所有操作已留痕');
      fetchData();
      setSelectedScore(null);
    } catch (error) {
      if (error instanceof FriendlyError) {
        showError(getErrorMessage(error.code));
      } else {
        showError(getErrorMessage('UNKNOWN_ERROR'));
      }
    }
  };

  const pendingCount = scores.filter((s) => s.status === 'pending').length;

  const tabs = [
    { id: 'review' as TabType, label: '复核分数', icon: CheckCircle, badge: pendingCount },
    { id: 'import' as TabType, label: '导入数据', icon: Upload },
    { id: 'correct' as TabType, label: '修正数据', icon: Edit3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-purple via-neon-purple/30 to-deep-purple p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-8 h-8 text-neon-orange" />
          <div>
            <h1 className="font-title text-3xl md:text-4xl text-neon-orange drop-shadow-[0_0_10px_rgba(255,107,53,0.5)]">
              数据管理中心
            </h1>
            <p className="text-gray-300 font-body">导入、复核、修正玩家分数数据</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedScore(null);
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap font-body ${
                activeTab === tab.id
                  ? 'bg-neon-orange text-white shadow-neon-orange'
                  : 'bg-neon-purple/20 text-gray-300 hover:bg-neon-purple/40 border border-neon-purple/30'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-neon-pink text-white text-xs px-2 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'import' && (
          <div className="mb-6">
            <FilterBar
              filters={filters}
              levels={levels}
              onFilterChange={handleFilterChange}
              onRefresh={fetchData}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'import' && (
          <DataImport onImportComplete={handleImportComplete} />
        )}

        {activeTab === 'review' && (
          <DataReview
            scores={scores}
            levels={levels}
            isLoading={isLoading}
            selectedScore={selectedScore}
            onSelectScore={setSelectedScore}
            onReview={handleReview}
          />
        )}

        {activeTab === 'correct' && (
          <DataCorrect
            scores={scores}
            levels={levels}
            isLoading={isLoading}
            selectedScore={selectedScore}
            onSelectScore={setSelectedScore}
            onCorrect={handleCorrect}
          />
        )}
      </div>
    </div>
  );
}
