import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ReviewListPage } from './pages/ReviewListPage';
import { ReviewAnalysisPage } from './pages/ReviewAnalysisPage';
import { MonthlyBoardPage } from './pages/MonthlyBoardPage';
import { HistoryPage } from './pages/HistoryPage';

function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="mx-auto max-w-[1600px] px-8 py-8">
          <Routes>
            <Route path="/" element={<ReviewListPage />} />
            <Route path="/review/:id" element={<ReviewAnalysisPage />} />
            <Route path="/monthly-board" element={<MonthlyBoardPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
