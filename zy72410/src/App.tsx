import Layout from './components/Layout';
import { useStore } from './store/useStore';
import ImportPage from './pages/ImportPage';
import MessageSupplement from './pages/MessageSupplement';
import MaterialList from './pages/MaterialList';
import RehearsalChanges from './pages/RehearsalChanges';
import SelfCheckPage from './pages/SelfCheckPage';
import ReportPage from './pages/ReportPage';

export default function App() {
  const { activeTab } = useStore();

  const renderPage = () => {
    switch (activeTab) {
      case 'import':
        return <ImportPage />;
      case 'messages':
        return <MessageSupplement />;
      case 'materials':
        return <MaterialList />;
      case 'changes':
        return <RehearsalChanges />;
      case 'selfcheck':
        return <SelfCheckPage />;
      case 'report':
        return <ReportPage />;
      default:
        return <ImportPage />;
    }
  };

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
}
