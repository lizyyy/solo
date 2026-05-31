import { Routes, Route } from 'react-router-dom';
import WarningList from './components/WarningList';
import WarningDetail from './components/WarningDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<WarningList />} />
      <Route path="/detail/:id" element={<WarningDetail />} />
    </Routes>
  );
}

export default App;
