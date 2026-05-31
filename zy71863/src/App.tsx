import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RecordList from './pages/RecordList';
import RecordDetail from './pages/RecordDetail';
import Guide from './pages/Guide';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RecordList />} />
        <Route path="/record/:id" element={<RecordDetail />} />
        <Route path="/guide" element={<Guide />} />
      </Routes>
    </Layout>
  );
}

export default App;
