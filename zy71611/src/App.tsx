import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import TracePanel from '@/components/TracePanel';
import Overview from '@/pages/Overview';
import QuotaAggregation from '@/pages/QuotaAggregation';
import HedgingMatch from '@/pages/HedgingMatch';
import BudgetAlert from '@/pages/BudgetAlert';
import ReportExport from '@/pages/ReportExport';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/quota" element={<QuotaAggregation />} />
          <Route path="/hedging" element={<HedgingMatch />} />
          <Route path="/budget" element={<BudgetAlert />} />
          <Route path="/report" element={<ReportExport />} />
        </Route>
      </Routes>
      <TracePanel />
    </Router>
  );
}
