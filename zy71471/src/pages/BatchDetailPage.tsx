import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BatchTabs } from '@/components/forms/BatchTabs';
import { useBatchStore } from '@/store/useBatchStore';
import DataEntryPage from './DataEntryPage';
import AnalysisPage from './AnalysisPage';
import HistoryPage from './HistoryPage';
import ReportPage from './ReportPage';
import { Loader2 } from 'lucide-react';

type TabKey = 'data' | 'analysis' | 'history' | 'report';

export default function BatchDetailPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const setCurrentBatch = useBatchStore((state) => state.setCurrentBatch);
  const setActiveTab = useBatchStore((state) => state.setActiveTab);
  const activeTab = useBatchStore((state) => state.activeTab);
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const loading = useBatchStore((state) => state.loading);

  useEffect(() => {
    if (id) {
      setCurrentBatch(id);
    }
    return () => {
      setCurrentBatch(null);
    };
  }, [id, setCurrentBatch]);

  useEffect(() => {
    const validTabs: TabKey[] = ['data', 'analysis', 'history', 'report'];
    const currentTab: TabKey = tab && validTabs.includes(tab as TabKey) ? (tab as TabKey) : 'data';
    setActiveTab(currentTab);
  }, [tab, setActiveTab]);

  const handleTabChange = useCallback((newTab: string) => {
    if (id) {
      navigate(`/batches/${id}/${newTab}`);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (tab !== activeTab) {
      handleTabChange(activeTab);
    }
  }, [activeTab, tab, handleTabChange]);

  if (!currentBatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      );
    }

    switch (activeTab) {
      case 'data':
        return <DataEntryPage />;
      case 'analysis':
        return <AnalysisPage />;
      case 'history':
        return <HistoryPage />;
      case 'report':
        return <ReportPage />;
      default:
        return <DataEntryPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header
        title={currentBatch.batchNo}
        subtitle={currentBatch.studentName || '未设置学生姓名'}
        breadcrumbs={[
          { label: '批次管理', path: '/batches' },
          { label: currentBatch.batchNo },
        ]}
      />
      {id && <BatchTabs batchId={id} />}
      <main className="p-6">
        {renderContent()}
      </main>
    </div>
  );
}
