import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadTasks from './pages/UploadTasks';
import UploadTaskDetail from './pages/UploadTaskDetail';
import SecurityLogs from './pages/SecurityLogs';
import Organizations from './pages/Organizations';
import ScanRules from './pages/ScanRules';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="uploads" element={<UploadTasks />} />
            <Route path="uploads/:id" element={<UploadTaskDetail />} />
            <Route path="security-logs" element={<SecurityLogs />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="scan-rules" element={<ScanRules />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
