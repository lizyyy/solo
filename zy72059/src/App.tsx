import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { DataPanel } from '@/components/DataPanel/DataPanel';
import { DetailPanel } from '@/components/DetailPanel/DetailPanel';
import { Scene3D } from '@/components/Scene3D/Scene3D';
import { StatusBar } from '@/components/StatusBar/StatusBar';
import { ImportModal } from '@/components/Modals/ImportModal';
import { SaveModal } from '@/components/Modals/SaveModal';
import { SchemeListModal } from '@/components/Modals/SchemeListModal';
import { useFormationStore } from '@/store/formationStore';
import { useSchemeStore } from '@/store/schemeStore';
import { getInitialSchemeData } from '@/data/mockData';

function MainWorkspace() {
  const { drones, obstacles, setDrones, setObstacles } = useFormationStore();
  const { loadSchemes, getCurrentScheme, currentSchemeId } = useSchemeStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadSchemes();
  }, [loadSchemes]);

  useEffect(() => {
    if (!initialized) {
      const currentScheme = getCurrentScheme();
      if (currentScheme) {
        setDrones(JSON.parse(JSON.stringify(currentScheme.drones)));
        setObstacles(JSON.parse(JSON.stringify(currentScheme.obstacles)));
      } else {
        const initialData = getInitialSchemeData();
        setDrones(initialData.drones);
        setObstacles(initialData.obstacles);
      }
      setInitialized(true);
    }
  }, [initialized, getCurrentScheme, setDrones, setObstacles]);

  const currentScheme = getCurrentScheme();
  const currentSchemeName = currentScheme?.name || '初始样例数据';

  return (
    <div className="w-full h-full flex flex-col bg-[#0A1628] text-white">
      <Toolbar currentSchemeName={currentSchemeName} />
      
      <div className="flex-1 flex overflow-hidden">
        <DataPanel />
        
        <div className="flex-1 relative">
          <Scene3D />
        </div>
        
        <DetailPanel />
      </div>
      
      <StatusBar />

      <ImportModal />
      <SaveModal />
      <SchemeListModal />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainWorkspace />} />
      </Routes>
    </Router>
  );
}
