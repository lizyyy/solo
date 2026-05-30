import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Scene3D from '@/pages/Scene3D';
import Parameters from '@/pages/Parameters';
import Analysis from '@/pages/Analysis';
import DataManager from '@/pages/DataManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Scene3D />} />
          <Route path="/parameters" element={<Parameters />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/data-manager" element={<DataManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
