import { AppProvider, useAppStore } from './store/AppStore';
import { Sidebar } from './components/Sidebar';
import { AudioRemarksPage } from './pages/AudioRemarksPage';
import { AuthorizationPage } from './pages/AuthorizationPage';
import { ComplianceCheckPage } from './pages/ComplianceCheckPage';
import { SettlementPage } from './pages/SettlementPage';
import { SubstituteReviewPage } from './pages/SubstituteReviewPage';
import { ComplianceChartPage } from './pages/ComplianceChartPage';

const PageRenderer = () => {
  const { currentPage } = useAppStore();

  switch (currentPage) {
    case 'audio_remarks':
      return <AudioRemarksPage />;
    case 'authorization':
      return <AuthorizationPage />;
    case 'compliance_check':
      return <ComplianceCheckPage />;
    case 'settlement':
      return <SettlementPage />;
    case 'substitute_review':
      return <SubstituteReviewPage />;
    case 'compliance_chart':
      return <ComplianceChartPage />;
    default:
      return <AudioRemarksPage />;
  }
};

function App() {
  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <PageRenderer />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
