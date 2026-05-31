import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import RecordList from './pages/RecordList';
import RecordDetail from './pages/RecordDetail';
import ExportPage from './pages/ExportPage';

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-museum-cream">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<RecordList />} />
            <Route path="/record/:id" element={<RecordDetail />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
