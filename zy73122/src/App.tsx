import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Annotation from './pages/Annotation';
import DataManage from './pages/DataManage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/annotation" element={<Annotation />} />
          <Route path="/data" element={<DataManage />} />
        </Route>
      </Routes>
    </Router>
  );
}
