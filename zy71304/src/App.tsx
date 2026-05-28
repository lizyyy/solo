import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import ParameterInput from '@/pages/ParameterInput';
import StressAnalysis from '@/pages/StressAnalysis';
import IssueTracking from '@/pages/IssueTracking';
import ParameterCompare from '@/pages/ParameterCompare';
import ReportExport from '@/pages/ReportExport';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ParameterInput />} />
          <Route path="analysis" element={<StressAnalysis />} />
          <Route path="tracking" element={<IssueTracking />} />
          <Route path="compare" element={<ParameterCompare />} />
          <Route path="report" element={<ReportExport />} />
        </Route>
      </Routes>
    </Router>
  );
}
