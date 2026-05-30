import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Workstation from '@/pages/Workstation';
import Detail from '@/pages/Detail';
import Compare from '@/pages/Compare';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workstation />} />
        <Route path="/detail" element={<Detail />} />
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </Router>
  );
}
