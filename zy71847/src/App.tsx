import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CableRecordsPage } from '@/pages/CableRecordsPage';
import { DataImportPage } from '@/pages/DataImportPage';
import { RecordDetailPage } from '@/pages/RecordDetailPage';
import { InspectionExportPage } from '@/pages/InspectionExportPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CableRecordsPage />} />
        <Route path="/import" element={<DataImportPage />} />
        <Route path="/record/:id" element={<RecordDetailPage />} />
        <Route path="/export" element={<InspectionExportPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
