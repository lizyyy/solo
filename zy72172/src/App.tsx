import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import './index.css';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePageWithNav />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

function HomePageWithNav() {
  return (
    <div className="relative h-screen">
      <HomePage />
      <Link
        to="/report"
        className="absolute bottom-4 right-4 px-4 py-2 bg-municipal-800 text-white rounded-lg shadow-lg hover:bg-municipal-700 transition-colors text-sm font-medium z-50"
      >
        📊 数据中心
      </Link>
    </div>
  );
}

export default App;
