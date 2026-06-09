import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workorder/:id" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
