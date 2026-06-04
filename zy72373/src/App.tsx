import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { DataImport } from './pages/DataImport';
import { PhotoUpload } from './pages/PhotoUpload';
import { Review } from './pages/Review';
import { HandoverReport } from './pages/HandoverReport';
import { Replay } from './pages/Replay';
import { Demo } from './pages/Demo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="demo" element={<Demo />} />
          <Route path="diagnosis/:taskId">
            <Route index element={<Navigate to="import" replace />} />
            <Route path="import" element={<DataImport />} />
            <Route path="photos" element={<PhotoUpload />} />
            <Route path="review" element={<Review />} />
            <Route path="report" element={<HandoverReport />} />
            <Route path="replay" element={<Replay />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
