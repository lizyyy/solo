import { useState, useEffect, useCallback } from 'react';
import { api, Statistics, MatchItem, MatchDetail, PipelineStatus, ChangeLog } from './api';
import { PipelineStatus as PipelineStatusComp } from './components/PipelineStatus';
import { StatsPanel } from './components/StatsPanel';
import { DataImportPanel } from './components/DataImportPanel';
import { MatchList } from './components/MatchList';
import { MatchDetailPanel } from './components/MatchDetailPanel';
import { HistoryPanel } from './components/HistoryPanel';

type TabType = 'import' | 'review' | 'history';

const SAMPLE_LOST = [
  { description: '今天上午8点半在1号线人民广场站丢了一个黑色的苹果手机，外壳是蓝色的' },
  { description: '昨天下午在2号线虹桥火车站丢失黑色皮质钱包，里面有身份证和银行卡' },
  { description: '昨天10点在3号线中山公园站丢失一个灰色的双肩背包，里面有笔记本电脑' }
];

const SAMPLE_FOUND = [
  { description: '今天早上在1号线人民广场站发现一部黑色苹果手机，蓝色保护壳', finder: '张师傅' },
  { description: '昨天在2号线虹桥站捡到一个黑色钱包，内有身份证件', finder: '李阿姨' },
  { description: '今天在3号线中山公园捡到灰色双肩包一个，内有电脑', finder: '王同学' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [stats, setStats] = useState<Statistics | null>(null);
  const [pipeline, setPipeline] = useState<{ current: PipelineStatus | null; history: PipelineStatus[] }>({ current: null, history: [] });
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsData, pipelineData, matchesData, logsData] = await Promise.all([
        api.getStats(),
        api.getPipelineStatus(),
        api.getPendingMatches(50),
        api.getChangeLogs(30)
      ]);
      
      setStats(statsData);
      setPipeline(pipelineData);
      setMatches(matchesData);
      setChangeLogs(logsData);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRunPipeline = async (lostItems: any[], foundItems: any[]) => {
    setLoading(true);
    setError(null);
    try {
      await api.runPipeline(lostItems, foundItems);
      await loadData();
      setActiveTab('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async () => {
    await handleRunPipeline(SAMPLE_LOST, SAMPLE_FOUND);
  };

  const handleSelectMatch = async (id: string) => {
    try {
      const detail = await api.getMatchDetail(id);
      setSelectedMatch(detail);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFeedback = async (matchId: string, feedbackType: string, note: string, operator: string) => {
    try {
      await api.submitFeedback(matchId, feedbackType, note, operator);
      setSelectedMatch(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🚇 地铁失物招领匹配器</h1>
        <p>智能匹配失物描述与招领信息，提升人工匹配效率</p>
      </header>

      <main className="container">
        {error && (
          <div style={{ 
            padding: '1rem', 
            background: '#fee2e2', 
            color: '#dc2626', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            {error}
            <button 
              onClick={() => setError(null)} 
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
            >
              ✕
            </button>
          </div>
        )}

        {stats && <StatsPanel stats={stats} />}

        {pipeline.current && (
          <PipelineStatusComp 
            pipeline={pipeline.current} 
            onRefresh={loadData}
          />
        )}

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            数据导入
          </button>
          <button 
            className={`tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            人工审核
            {stats && stats.matches.pending_review > 0 && (
              <span style={{ 
                marginLeft: '0.5rem', 
                padding: '0.125rem 0.5rem', 
                background: '#fee2e2', 
                color: '#dc2626', 
                borderRadius: '10px',
                fontSize: '0.75rem'
              }}>
                {stats.matches.pending_review}
              </span>
            )}
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            历史记录
          </button>
        </div>

        {activeTab === 'import' && (
          <DataImportPanel 
            onRun={handleRunPipeline}
            onLoadSample={handleLoadSample}
            loading={loading}
          />
        )}

        {activeTab === 'review' && (
          <MatchList 
            matches={matches}
            onSelect={handleSelectMatch}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPanel 
            pipelineHistory={pipeline.history}
            changeLogs={changeLogs}
          />
        )}
      </main>

      {selectedMatch && (
        <>
          <div className="overlay" onClick={() => setSelectedMatch(null)} />
          <MatchDetailPanel 
            detail={selectedMatch}
            onClose={() => setSelectedMatch(null)}
            onFeedback={handleFeedback}
          />
        </>
      )}
    </div>
  );
}
