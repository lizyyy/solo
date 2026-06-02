import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import ToastContainer from './components/common/Toast';
import Workbench from './pages/Workbench';
import Import from './pages/Import';
import Report from './pages/Report';
import { useStore } from './store/useStore';

function App() {
  const initStore = useStore((state) => state.initStore);

  useEffect(() => {
    initStore();
  }, [initStore]);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/import" element={<Import />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
