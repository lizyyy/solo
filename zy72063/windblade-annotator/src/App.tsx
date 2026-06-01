import { useState } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { LeftPanel } from './components/layout/LeftPanel';
import { RightPanel } from './components/layout/RightPanel';
import { DiffPanel } from './components/layout/DiffPanel';
import { Scene } from './components/three/Scene';
import { ImportDialog } from './components/dialogs/ImportDialog';
import { SaveSchemeDialog } from './components/dialogs/SaveSchemeDialog';
import { useAppStore, useSelectedRecord } from './store/useAppStore';
import { StatusBadge } from './components/common/StatusBadge';
import { SourceIcon } from './components/common/SourceIcon';
import { RiskIndicator } from './components/common/RiskIndicator';
import { LOCATION_LABELS, CRACK_TYPE_LABELS } from './types';

function App() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const selectedRecord = useSelectedRecord();
  const { leftPanelCollapsed, rightPanelCollapsed } = useAppStore();

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 overflow-hidden">
      <Toolbar
        onImportClick={() => setShowImportDialog(true)}
        onSaveSchemeClick={() => setShowSaveDialog(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <LeftPanel />

        <div
          id="main-canvas"
          className="flex-1 relative"
          style={{
            marginLeft: leftPanelCollapsed ? '-1px' : '0',
            marginRight: rightPanelCollapsed ? '-1px' : '0'
          }}
        >
          <Scene />

          {selectedRecord && (
            <div className="absolute top-4 left-4 right-4 glass rounded-lg p-4 max-w-md">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-white">
                    {selectedRecord.code}
                  </span>
                  {selectedRecord.isOldCaliber && (
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/30">
                      旧口径
                    </span>
                  )}
                </div>
                <StatusBadge status={selectedRecord.status} />
              </div>
              <div className="flex items-center gap-4 mb-2">
                <SourceIcon source={selectedRecord.source} showLabel />
                <RiskIndicator level={selectedRecord.riskLevel} showLabel />
                <span className="text-xs text-gray-500">
                  {LOCATION_LABELS[selectedRecord.location]} ·{' '}
                  {CRACK_TYPE_LABELS[selectedRecord.crackType]}
                </span>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2">
                {selectedRecord.description}
              </p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-4 text-xs text-gray-400 pointer-events-auto">
              <span>鼠标左键：旋转</span>
              <span>右键：平移</span>
              <span>滚轮：缩放</span>
              <span>双击标记：聚焦</span>
            </div>
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-3 pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning-500" />
                <span className="text-xs text-gray-400">待处理</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary-500" />
                <span className="text-xs text-gray-400">处理中</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success-500" />
                <span className="text-xs text-gray-400">已处理</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-dark-500" />
                <span className="text-xs text-gray-400">已确认</span>
              </div>
            </div>
          </div>
        </div>

        <RightPanel />
      </div>

      <DiffPanel />

      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />

      <SaveSchemeDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      />
    </div>
  );
}

export default App;
