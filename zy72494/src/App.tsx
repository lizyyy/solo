import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import RedlineList from './pages/RedlineList';
import RedlineDetail from './pages/RedlineDetail';
import InspectionList from './pages/InspectionList';
import InspectionDetail from './pages/InspectionDetail';
import ComplaintList from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';
import Visualization from './pages/Visualization';
import ReportList from './pages/ReportList';
import ReportDetail from './pages/ReportDetail';
import CalculationPanel from './pages/CalculationPanel';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="redline" element={<RedlineList />} />
        <Route path="redline/:id" element={<RedlineDetail />} />
        <Route path="inspection" element={<InspectionList />} />
        <Route path="inspection/:id" element={<InspectionDetail />} />
        <Route path="complaints" element={<ComplaintList />} />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="visualization" element={<Visualization />} />
        <Route path="reports" element={<ReportList />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="calculation" element={<CalculationPanel />} />
      </Route>
    </Routes>
  );
}

export default App;
