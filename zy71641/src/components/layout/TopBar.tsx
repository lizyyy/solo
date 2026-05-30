import { useState } from 'react';
import { Upload, Save, Camera, User, Calendar, Database, RefreshCw, CheckCircle } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { ImportResult } from '@/types';
import { ImportConflictModal } from '@/components/modals/ImportConflictModal';

export function TopBar() {
  const { 
    currentSession, 
    saveSession, 
    importData,
    detectAnomalies,
    exportReport,
  } = useSwingStore();
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  
  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await importData(null);
      setImportResult(result);
      setShowImportModal(true);
      
      if (result.resultType === 'new') {
        setShowSuccess('数据导入成功！');
        setTimeout(() => setShowSuccess(null), 3000);
      }
    } finally {
      setIsImporting(false);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSession();
      setShowSuccess('保存成功！');
      setTimeout(() => setShowSuccess(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      await detectAnomalies();
      setShowSuccess('异常检测完成！');
      setTimeout(() => setShowSuccess(null), 3000);
    } finally {
      setIsDetecting(false);
    }
  };
  
  const handleExportImage = async () => {
    try {
      await exportReport('png');
      setShowSuccess('截图已保存！');
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };
  
  return (
    <>
      <div className="h-14 bg-golf-bg-light border-b border-golf-border flex items-center px-4 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-golf-text">
            高尔夫挥杆力线舱
          </h1>
          {currentSession && (
            <div className="flex items-center gap-2 text-sm text-golf-text-muted">
              <span className="px-2 py-0.5 bg-golf-bg rounded text-xs">
                {currentSession.studentName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(currentSession.recordedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1" />
        
        {showSuccess && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-golf-green/10 border border-golf-green/30 rounded-lg text-golf-green text-sm animate-fade-in">
            <CheckCircle className="w-4 h-4" />
            {showSuccess}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-3 py-1.5 bg-golf-blue/20 text-golf-blue text-xs rounded hover:bg-golf-blue/30 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isImporting ? (
              <div className="w-3 h-3 border-2 border-golf-blue/30 border-t-golf-blue rounded-full animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            导入数据
          </button>
          
          <button
            onClick={handleDetect}
            disabled={isDetecting}
            className="px-3 py-1.5 bg-golf-orange/20 text-golf-orange text-xs rounded hover:bg-golf-orange/30 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isDetecting ? (
              <div className="w-3 h-3 border-2 border-golf-orange/30 border-t-golf-orange rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            检测异常
          </button>
          
          <button
            onClick={handleExportImage}
            className="px-3 py-1.5 bg-golf-purple/20 text-golf-purple text-xs rounded hover:bg-golf-purple/30 transition-colors flex items-center gap-1"
          >
            <Camera className="w-3 h-3" />
            截图
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-golf-green/20 text-golf-green text-xs rounded hover:bg-golf-green/30 transition-colors flex items-center gap-1 disabled:opacity-50 font-medium"
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-golf-green/30 border-t-golf-green rounded-full animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            保存
          </button>
        </div>
        
        {currentSession && (
          <div className="flex items-center gap-2 pl-4 border-l border-golf-border">
            <div className="w-8 h-8 rounded-full bg-golf-bg flex items-center justify-center">
              <User className="w-4 h-4 text-golf-text-muted" />
            </div>
            <div className="text-xs">
              <div className="text-golf-text font-medium">教练</div>
              <div className="text-golf-text-dim flex items-center gap-1">
                <Database className="w-3 h-3" />
                v{currentSession.versions.length}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <ImportConflictModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        importResult={importResult}
      />
    </>
  );
}
