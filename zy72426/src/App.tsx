import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ImportPage } from '@/pages/ImportPage';
import { LabelsPage } from '@/pages/LabelsPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { SelfCheckPage } from '@/pages/SelfCheckPage';
import { WeeklyReportPage } from '@/pages/WeeklyReportPage';
import { useEffect } from 'react';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { buildUnifiedView, verifyDataConsistency } from '@/utils/unifiedDataApi';
import { getDataHash } from '@/utils/exporter';

declare global {
  interface Window {
    EmotionLabelAPI?: {
      getState: typeof useEmotionLabelStore.getState;
      getUnifiedView: typeof buildUnifiedView;
      verifyConsistency: typeof verifyDataConsistency;
      getDataHash: typeof getDataHash;
      runVerification: () => { pageHash: string; exportHash: string; reportHash: string; allMatch: boolean; recordCount: number; groupCount: number };
      loadSample: () => void;
      clearAll: () => void;
      changeLog: () => { id: string; action: string; description: string; time: string; dataHash: string }[];
    };
  }
}

function AppContent() {
  const { loadSampleData, records, runSelfCheck, runConsistencyCheck, clearAllData } = useEmotionLabelStore();

  useEffect(() => {
    if (records.length === 0) {
      loadSampleData();
    } else {
      runSelfCheck();
    }
    runConsistencyCheck();

    window.EmotionLabelAPI = {
      getState: useEmotionLabelStore.getState,
      getUnifiedView: buildUnifiedView,
      verifyConsistency: verifyDataConsistency,
      getDataHash,
      runVerification: () => {
        const state = useEmotionLabelStore.getState();
        const pageView = buildUnifiedView(state.records, state.groups, 'page');
        const exportView = buildUnifiedView(state.records, state.groups, 'export');
        const reportView = buildUnifiedView(state.records, state.groups, 'report');
        const allMatch = pageView.dataHash === exportView.dataHash && exportView.dataHash === reportView.dataHash;
        return {
          pageHash: pageView.dataHash,
          exportHash: exportView.dataHash,
          reportHash: reportView.dataHash,
          allMatch,
          recordCount: state.records.length,
          groupCount: state.groups.length,
        };
      },
      loadSample: () => useEmotionLabelStore.getState().loadSampleData(),
      clearAll: () => useEmotionLabelStore.getState().clearAllData(),
      changeLog: () => {
        return useEmotionLabelStore.getState().changeLog.map((log) => ({
          id: log.id,
          action: log.action,
          description: log.description,
          time: new Date(log.timestamp).toLocaleString('zh-CN'),
          dataHash: log.dataHashAfter,
        }));
      },
    };
    console.log('%c🎵 EmotionLabelAPI 已挂载到 window', 'color: #1e3a5f; font-weight: bold; font-size: 12px;');
    console.log('%c可用方法：', 'color: #666;',
      '\n  EmotionLabelAPI.runVerification()   - 运行三方一致性校验',
      '\n  EmotionLabelAPI.changeLog()          - 查看改动日志',
      '\n  EmotionLabelAPI.getDataHash()         - 获取当前数据哈希',
      '\n  EmotionLabelAPI.getState()            - 获取完整状态',
      '\n  EmotionLabelAPI.loadSample()          - 加载样例数据',
      '\n  EmotionLabelAPI.clearAll()            - 清空所有数据'
    );
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<ImportPage />} />
            <Route path="/labels" element={<LabelsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/self-check" element={<SelfCheckPage />} />
            <Route path="/weekly-report" element={<WeeklyReportPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
