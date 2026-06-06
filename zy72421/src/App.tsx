import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ToastContainer } from '@/components/ToastContainer';
import { Dashboard } from '@/pages/Dashboard';
import { BatchDetail } from '@/pages/BatchDetail';
import { History } from '@/pages/History';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen text-white">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/batch/:id" element={<BatchDetail />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
