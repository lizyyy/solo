import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CheckList from './pages/CheckList';
import CheckDetail from './pages/CheckDetail';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<CheckList />} />
          <Route path="/checks/:id" element={<CheckDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
