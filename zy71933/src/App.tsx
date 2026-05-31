import { Routes, Route } from 'react-router-dom';
import { MaterialList } from './pages/MaterialList';
import { MaterialDetail } from './pages/MaterialDetail';
import { MaterialForm } from './pages/MaterialForm';

function App() {
  return (
    <div className="App">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <h1>📋 品牌物料审稿系统</h1>
          </div>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<MaterialList />} />
          <Route path="/new" element={<MaterialForm />} />
          <Route path="/material/:id" element={<MaterialDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
