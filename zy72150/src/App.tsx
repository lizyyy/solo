import { Layout } from '@/components/Layout';
import { ImportPage } from '@/pages/ImportPage';
import { MergePage } from '@/pages/MergePage';
import { ReviewPage } from '@/pages/ReviewPage';
import { ExportPage } from '@/pages/ExportPage';
import { useAppStore } from '@/store';

export default function App() {
  const { currentStep } = useAppStore();

  return (
    <Layout>
      {currentStep === 'import' && <ImportPage />}
      {currentStep === 'merge' && <MergePage />}
      {currentStep === 'review' && <ReviewPage />}
      {currentStep === 'export' && <ExportPage />}
    </Layout>
  );
}
