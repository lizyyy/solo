import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { RequestsListPage } from './pages/RequestsListPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { CreateRequestPage } from './pages/CreateRequestPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { DocsPage } from './pages/DocsPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/requests" element={<RequestsListPage />} />
        <Route path="/requests/new" element={<CreateRequestPage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/docs" element={<DocsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
