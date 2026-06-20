import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CollisionListPage from '@/pages/CollisionListPage';
import CollisionDetailPage from '@/pages/CollisionDetailPage';
import { Toast } from '@/components/Toast';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/collisions" replace />} />
        <Route path="/collisions" element={<CollisionListPage />} />
        <Route path="/collisions/:id" element={<CollisionDetailPage />} />
        <Route path="*" element={<Navigate to="/collisions" replace />} />
      </Routes>
      <Toast />
    </BrowserRouter>
  );
}
