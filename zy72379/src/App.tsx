import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import CleaningWorkbench from '@/pages/CleaningWorkbench';
import ConflictResolution from '@/pages/ConflictResolution';
import ThresholdReview from '@/pages/ThresholdReview';
import SampleShowcase from '@/pages/SampleShowcase';
import { ThemeProvider } from '@/hooks/useTheme';

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/workbench" replace />} />
            <Route path="workbench" element={<CleaningWorkbench />} />
            <Route path="conflicts" element={<ConflictResolution />} />
            <Route path="reviews" element={<ThresholdReview />} />
            <Route path="samples" element={<SampleShowcase />} />
            <Route path="*" element={<Navigate to="/workbench" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
