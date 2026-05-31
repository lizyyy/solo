import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClassroomList } from '@/pages/ClassroomList';
import { RecordWorkspace } from '@/pages/RecordWorkspace';
import { VersionCompare } from '@/pages/VersionCompare';
import { ExportPreview } from '@/pages/ExportPreview';
import { useClassroomStore } from '@/store/useClassroomStore';

function App() {
  const initData = useClassroomStore((state) => state.initData);

  useEffect(() => {
    initData();
  }, [initData]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClassroomList />} />
        <Route path="/classroom/:id" element={<RecordWorkspace />} />
        <Route path="/classroom/:id/compare" element={<VersionCompare />} />
        <Route path="/classroom/:id/export" element={<ExportPreview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
