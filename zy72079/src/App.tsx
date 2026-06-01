import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';
import Detail from './pages/Detail';

function App() {
  const initializeRecords = useStore(state => state.initializeRecords);

  useEffect(() => {
    initializeRecords();
  }, [initializeRecords]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/detail/:id" element={<Detail />} />
      </Routes>
    </div>
  );
}

export default App;
