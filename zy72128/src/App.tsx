import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import List from './pages/List';
import Detail from './pages/Detail';
import Form from './pages/Form';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<List />} />
        <Route path="/notification/:id" element={<Detail />} />
        <Route path="/new" element={<Form />} />
        <Route path="/edit/:id" element={<Form />} />
      </Routes>
    </Layout>
  );
}

export default App;
