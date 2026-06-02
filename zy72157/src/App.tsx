import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { DataImportPage } from './pages/DataImportPage';
import { PointMergePage } from './pages/PointMergePage';
import { ManualReviewPage } from './pages/ManualReviewPage';
import { PublicExportPage } from './pages/PublicExportPage';

function AppContent() {
  const { currentStep } = useApp();

  const renderPage = () => {
    switch (currentStep) {
      case 'import':
        return <DataImportPage />;
      case 'merge':
        return <PointMergePage />;
      case 'review':
        return <ManualReviewPage />;
      case 'export':
        return <PublicExportPage />;
      default:
        return <DataImportPage />;
    }
  };

  return (
    <Layout>{renderPage()}</Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
