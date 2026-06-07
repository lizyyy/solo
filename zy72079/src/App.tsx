import { Routes, Route } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';
import Detail from './pages/Detail';

function App() {
  const { records, initializeRecords } = useStore(state => ({
    records: state.records,
    initializeRecords: state.initializeRecords,
  }));
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && records.length === 0) {
      initialized.current = true;
      initializeRecords();
    }
  }, [records.length, initializeRecords]);

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
