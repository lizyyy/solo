import { useStore } from './store/useStore';
import Header from './components/Header';
import Notification from './components/Notification';
import HomePage from './pages/HomePage';
import PickupPage from './pages/PickupPage';
import ReprintPage from './pages/ReprintPage';
import AdminPage from './pages/AdminPage';
import HistoryPage from './pages/HistoryPage';
import StatisticsPage from './pages/StatisticsPage';

function App() {
  const store = useStore();
  const { state, navigate } = store;

  const renderPage = () => {
    switch (state.currentPage) {
      case 'home':
        return <HomePage store={store} />;
      case 'pickup':
        return <PickupPage store={store} />;
      case 'reprint':
        return <ReprintPage store={store} />;
      case 'admin':
        return <AdminPage store={store} />;
      case 'history':
        return <HistoryPage store={store} />;
      case 'statistics':
        return <StatisticsPage store={store} />;
      default:
        return <HomePage store={store} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header store={store} />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {renderPage()}
      </main>
      {state.notification && (
        <Notification 
          type={state.notification.type} 
          message={state.notification.message} 
        />
      )}
    </div>
  );
}

export default App;
