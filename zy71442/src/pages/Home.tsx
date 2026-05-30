import { useState, useEffect, useCallback, useRef } from 'react';
import { Scene } from '../components/three/Scene';
import { Toolbar } from '../components/panels/Toolbar';
import { DataSourcePanel } from '../components/panels/DataSourcePanel';
import { DiagnosisPanel } from '../components/panels/DiagnosisPanel';
import { ControlBar } from '../components/panels/ControlBar';
import { ExportPanel } from '../components/panels/ExportPanel';
import { ReviewPanel } from '../components/panels/ReviewPanel';
import { useSurfaceStore } from '../stores/useSurfaceStore';
import { useViewStore } from '../stores/useViewStore';
import { useDiagnosisStore } from '../stores/useDiagnosisStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useFilterStore } from '../stores/useFilterStore';
import { useSurfaceInit } from '../hooks/useSurfaceInit';
import { useQualityCheck } from '../hooks/useQualityCheck';
import { parseJsonImport, parseCsvImport } from '../utils/parser/jsonParser';
import { exportData, downloadFile } from '../utils/export/exporter';
import type { DataMaterial, SliceParams, ProjectionPlane, ViewState } from '../types/surface';
import type { DiagnosisIssue } from '../types/diagnosis';
import { QUALITY_THRESHOLDS } from '../data/demoData';

function Home() {
  const [showExport, setShowExport] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(true);
  const [showDiagnosisPanel, setShowDiagnosisPanel] = useState(true);
  const [visibleMaterialIds, setVisibleMaterialIds] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    materials,
    vertices,
    normals,
    uvs,
    indices,
    boundaryPoints,
    samplePoints,
    addMaterial,
    updateMaterial,
    removeMaterial,
    setSurfaceData,
  } = useSurfaceStore();

  const {
    showSurface,
    showNormals,
    showBoundary,
    showSamples,
    showProjection,
    projectionPlane,
    normalLength,
    normalDensity,
    sliceParams,
    highlightReversedNormals,
    cameraPosition,
    cameraTarget,
    filterRange,
    setShowSurface,
    setShowNormals,
    setShowBoundary,
    setShowSamples,
    setShowProjection,
    setProjectionPlane,
    setNormalLength,
    setNormalDensity,
    setSliceParams,
    setHighlightReversedNormals,
    resetView,
  } = useViewStore();

  const {
    issues,
    isChecking,
    resolveIssue,
    getIssuesByMaterial,
  } = useDiagnosisStore();

  const { locked, setLocked, filterRange: storeFilterRange } = useFilterStore();

  const {
    flipNormals,
    closeBoundary,
    densifySamples,
    isLoaded,
  } = useSurfaceInit({ loadDemo: true, createSession: true });

  const { runFullCheck } = useQualityCheck(QUALITY_THRESHOLDS);

  const viewState: ViewState = {
    showSurface,
    showNormals,
    showBoundary,
    showSamples,
    showProjection,
    projectionPlane,
    normalLength,
    normalDensity,
    sliceParams,
    highlightReversedNormals,
  };

  useEffect(() => {
    if (isLoaded && materials.length > 0) {
      setVisibleMaterialIds(materials.map((m) => m.id));
    }
  }, [isLoaded, materials]);

  useEffect(() => {
    if (isLoaded && vertices.length > 0) {
      const timer = setTimeout(() => {
        runFullCheck();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, vertices.length, runFullCheck]);

  const handleImportJson = useCallback((data: any) => {
    try {
      const imported = parseJsonImport(JSON.stringify(data));
      imported.materials.forEach((m) => addMaterial(m));
      if (imported.surfacePoints || imported.boundaryPoints || imported.samplePoints) {
        setSurfaceData({
          boundaryPoints: imported.boundaryPoints,
          samplePoints: imported.samplePoints,
        });
      }
      setTimeout(() => runFullCheck(), 300);
    } catch (e) {
      console.error('Import error:', e);
    }
  }, [addMaterial, setSurfaceData, runFullCheck]);

  const handleImportCsv = useCallback((content: string) => {
    try {
      const imported = parseCsvImport(content, 'surface');
      imported.materials.forEach((m) => addMaterial(m));
      setTimeout(() => runFullCheck(), 300);
    } catch (e) {
      console.error('CSV Import error:', e);
    }
  }, [addMaterial, runFullCheck]);

  const handleViewStateChange = useCallback((changes: Partial<ViewState>) => {
    if (changes.showSurface !== undefined) setShowSurface(changes.showSurface);
    if (changes.showNormals !== undefined) setShowNormals(changes.showNormals);
    if (changes.showBoundary !== undefined) setShowBoundary(changes.showBoundary);
    if (changes.showSamples !== undefined) setShowSamples(changes.showSamples);
    if (changes.showProjection !== undefined) setShowProjection(changes.showProjection);
    if (changes.highlightReversedNormals !== undefined) setHighlightReversedNormals(changes.highlightReversedNormals);
  }, [setShowSurface, setShowNormals, setShowBoundary, setShowSamples, setShowProjection, setHighlightReversedNormals]);

  const handleSliceParamsChange = useCallback((params: SliceParams) => {
    setSliceParams(params);
  }, [setSliceParams]);

  const handleProjectionPlaneChange = useCallback((plane: ProjectionPlane) => {
    setProjectionPlane(plane);
  }, [setProjectionPlane]);

  const handleLocateIssue = useCallback((issue: DiagnosisIssue) => {
    if (issue.location.position) {
      const { x, y, z } = issue.location.position;
      const newPos = {
        x: x + 2,
        y: y + 2,
        z: z + 2,
      };
      useViewStore.getState().setCameraPosition(newPos);
      useViewStore.getState().setCameraTarget({ x, y, z });
    }
  }, []);

  const handleApplyFix = useCallback((issue: DiagnosisIssue) => {
    switch (issue.type) {
      case 'normal_reversed':
        flipNormals(issue.location.vertexIndices);
        resolveIssue(issue.id);
        break;
      case 'boundary_gap':
        closeBoundary();
        resolveIssue(issue.id);
        break;
      case 'sample_sparse':
        densifySamples(QUALITY_THRESHOLDS.minSampleDensity);
        resolveIssue(issue.id);
        break;
    }
    setTimeout(() => runFullCheck(), 500);
  }, [flipNormals, closeBoundary, densifySamples, resolveIssue, runFullCheck]);

  const handleExport = useCallback(() => {
    const exportOptions = {
      format: 'json' as const,
      includeMaterials: true,
      includeNormals: true,
      includeUVs: true,
      includeDiagnosis: true,
      precision: 6,
      filterRange: storeFilterRange,
      lockedToScreen: locked,
      screenViewport: { width: window.innerWidth, height: window.innerHeight },
    };

    const result = exportData(
      {
        vertices,
        normals,
        uvs,
        indices,
        boundaryPoints,
        samplePoints,
        materials,
        diagnosisIssues: issues,
        exportOptions,
      },
      exportOptions
    );

    downloadFile(result.content, result.filename, result.mimeType);
  }, [vertices, normals, uvs, indices, boundaryPoints, samplePoints, materials, issues, storeFilterRange, locked]);

  const handleToggleMaterialVisibility = useCallback((id: string) => {
    setVisibleMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }, []);

  const handleDeleteMaterial = useCallback((id: string) => {
    removeMaterial(id);
    setVisibleMaterialIds((prev) => prev.filter((m) => m !== id));
  }, [removeMaterial]);

  const handleResetCamera = useCallback(() => {
    resetView();
  }, [resetView]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const unresolvedByMaterial = materials.reduce((acc, m) => {
    acc[m.id] = getIssuesByMaterial(m.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      <Toolbar
        viewState={viewState}
        onImport={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
        onExport={() => setShowExport(true)}
        onReview={() => setShowReview(true)}
        onViewStateChange={handleViewStateChange}
        onResetCamera={handleResetCamera}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <div className="flex-1 flex overflow-hidden">
        {showDataPanel && (
          <div className="w-72 flex-shrink-0">
            <DataSourcePanel
              materials={materials}
              visibleMaterialIds={visibleMaterialIds}
              onToggleVisibility={handleToggleMaterialVisibility}
              onDeleteMaterial={handleDeleteMaterial}
              onImportJson={handleImportJson}
              onImportCsv={handleImportCsv}
            />
          </div>
        )}

        <div className="flex-1 relative">
          <Scene className="w-full h-full" />

          <button
            onClick={() => setShowDataPanel(!showDataPanel)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-r flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition-all"
            title={showDataPanel ? '隐藏数据面板' : '显示数据面板'}
          >
            <span className="text-xs">{showDataPanel ? '◀' : '▶'}</span>
          </button>

          <button
            onClick={() => setShowDiagnosisPanel(!showDiagnosisPanel)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-l flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition-all"
            title={showDiagnosisPanel ? '隐藏诊断面板' : '显示诊断面板'}
          >
            <span className="text-xs">{showDiagnosisPanel ? '▶' : '◀'}</span>
          </button>

          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-300 text-sm">加载演示数据中...</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-md text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>顶点: {vertices.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-md text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>法向量: {normals.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-md text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-pink-400" />
              <span>边界点: {boundaryPoints.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-md text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>采样点: {samplePoints.length}</span>
            </div>
          </div>
        </div>

        {showDiagnosisPanel && (
          <div className="w-80 flex-shrink-0">
            <DiagnosisPanel
              issues={issues}
              isScanning={isChecking}
              onScan={runFullCheck}
              onResolve={resolveIssue}
              onLocate={handleLocateIssue}
              onApplyFix={handleApplyFix}
            />
          </div>
        )}
      </div>

      <ControlBar
        viewState={viewState}
        onSliceParamsChange={handleSliceParamsChange}
        onNormalLengthChange={setNormalLength}
        onNormalDensityChange={setNormalDensity}
        onProjectionPlaneChange={handleProjectionPlaneChange}
        onShowNormalsChange={setShowNormals}
        onShowProjectionChange={setShowProjection}
        onReset={resetView}
      />

      {showExport && (
        <ExportPanel
          onClose={() => setShowExport(false)}
          onExport={handleExport}
        />
      )}

      {showReview && (
        <ReviewPanel
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}

export default Home;
