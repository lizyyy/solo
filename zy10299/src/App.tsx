import { useStore } from './store/useStore';
import Layout from './components/Layout';
import LedgerPage from './pages/LedgerPage';
import ReissuePage from './pages/ReissuePage';
import RecordsPage from './pages/RecordsPage';

function App() {
  const { activeTab } = useStore();

  return (
    <Layout>
      {activeTab === 'ledger' && <LedgerPage />}
      {activeTab === 'reissue' && <ReissuePage />}
      {activeTab === 'records' && <RecordsPage />}
    </Layout>
  );
}

export default App;
