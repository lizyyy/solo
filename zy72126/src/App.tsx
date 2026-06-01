import { Layout } from '@/components/Layout';
import { ImportPage } from '@/pages/ImportPage';
import { TracksPage } from '@/pages/TracksPage';
import { AnnotationsPage } from '@/pages/AnnotationsPage';
import { ConflictsPage } from '@/pages/ConflictsPage';
import { ExportPage } from '@/pages/ExportPage';
import { useAppStore } from '@/store';

const pages: Record<string, React.ReactNode> = {
  import: <ImportPage />,
  tracks: <TracksPage />,
  annotations: <AnnotationsPage />,
  conflicts: <ConflictsPage />,
  export: <ExportPage />,
};

export default function App() {
  const { currentPage } = useAppStore();

  return <Layout>{pages[currentPage] || pages.import}</Layout>;
}
