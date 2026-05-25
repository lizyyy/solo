import React, { useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { ShipyardScene } from '../components/Scene3D/ShipyardScene';
import { ControlPanel } from '../components/ControlPanel/ControlPanel';
import { Timeline } from '../components/Timeline/Timeline';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { generateReport, getReportData } from '../utils/reportExport';
import { samples } from '../data/samples';
import { SampleType } from '../types';

export default function Home() {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const { showComparison, comparisonSample, currentSample } = useAppStore();

  const comparisonSceneData = useMemo(() => {
    if (comparisonSample && samples[comparisonSample as SampleType]) {
      return samples[comparisonSample as SampleType];
    }
    return null;
  }, [comparisonSample]);

  useEffect(() => {
    const handleExport = () => {
      const state = useAppStore.getState();
      const reportData = getReportData(state);
      generateReport(sceneContainerRef.current, reportData);
    };

    window.addEventListener('exportReport', handleExport);
    return () => window.removeEventListener('exportReport', handleExport);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <ControlPanel />
        
        <div className="flex-1 flex flex-col">
          <div ref={sceneContainerRef} className="flex-1 relative">
            {showComparison && comparisonSceneData ? (
              <div className="h-full w-full flex gap-1">
                <div className="flex-1 relative">
                  <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    当前方案: {currentSample}
                  </div>
                  <ShipyardScene />
                </div>
                <div className="w-px bg-gray-600" />
                <div className="flex-1 relative">
                  <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    对比方案: {comparisonSample}
                  </div>
                  <ShipyardScene customSceneData={comparisonSceneData} readOnly />
                </div>
              </div>
            ) : (
              <ShipyardScene />
            )}
          </div>
        </div>
        
        <StatusBar />
      </div>
      
      <Timeline />
    </div>
  );
}

