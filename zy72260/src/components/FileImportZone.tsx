import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, AlertTriangle, Check, X, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parsePointCloudLog, parseSafetyRadiusTable } from '@/utils/fileParser';
import { useAppStore } from '@/store';
import { db } from '@/db';
import { createRouteFromWaypoints } from '@/utils/routeCalculator';
import { detectConflicts, saveConflicts } from '@/utils/conflictDetector';
import { createInitialSelfChecks, runDuplicateImportCheck } from '@/utils/selfCheckEngine';
import md5 from 'blueimp-md5';

interface FileImportZoneProps {
  type: 'point_cloud' | 'safety_radius';
  onImportComplete?: () => void;
}

export default function FileImportZone({ type, onImportComplete }: FileImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    isDuplicate?: boolean;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);

  const operator = useAppStore((s) => s.operator);
  const setPointCloudLog = useAppStore((s) => s.setPointCloudLog);
  const setSafetyRadiusTable = useAppStore((s) => s.setSafetyRadiusTable);
  const setRoutes = useAppStore((s) => s.setRoutes);
  const addRoute = useAppStore((s) => s.addRoute);
  const setConflicts = useAppStore((s) => s.setConflicts);
  const completeStep = useAppStore((s) => s.completeStep);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const setSelfChecks = useAppStore((s) => s.setSelfChecks);
  const setWorkflow = useAppStore((s) => s.setWorkflow);
  const pointCloudLog = useAppStore((s) => s.pointCloudLog);
  const safetyRadiusTable = useAppStore((s) => s.safetyRadiusTable);

  const isPointCloud = type === 'point_cloud';
  const acceptedFiles = isPointCloud 
    ? '.txt,.csv,.json' 
    : '.csv,.xlsx,.xls,.txt';
  const fileTypeLabel = isPointCloud ? '点云抽稀日志' : '安全半径表';
  const Icon = isPointCloud ? FileText : FileSpreadsheet;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File, forceImport: boolean = false) => {
    try {
      if (isPointCloud) {
        const result = await parsePointCloudLog(file, operator);
        
        if (result.isDuplicate && !forceImport) {
          setDuplicateInfo(result);
          setShowDuplicateWarning(true);
          pendingFile.current = file;
          return;
        }

        setPointCloudLog(result.log);
        
        const initialRoute = createRouteFromWaypoints(result.log.route);
        await db.routes.put(initialRoute);
        setRoutes([initialRoute]);
        
        const checks = createInitialSelfChecks();
        const duplicateCheck = await runDuplicateImportCheck(
          result.log.fileHash,
          'point_cloud',
          result.log.filename
        );
        checks[0] = duplicateCheck;
        setSelfChecks(checks);
        
        setWorkflow({
          pointCloudLogId: result.log.id,
          lastRouteCalcTime: initialRoute.recalcTime,
        });

        setImportResult({
          success: true,
          message: `成功导入 ${result.log.exhibits.length} 个展柜，${result.log.route.length} 个路径点`,
          isDuplicate: result.isDuplicate,
        });

        completeStep('import_point_cloud');
        setTimeout(() => setCurrentStep('import_safety_radius'), 500);
      } else {
        const result = await parseSafetyRadiusTable(file, operator);
        
        if (result.isDuplicate && !forceImport) {
          setDuplicateInfo(result);
          setShowDuplicateWarning(true);
          pendingFile.current = file;
          return;
        }

        setSafetyRadiusTable(result.table);
        
        if (pointCloudLog) {
          const conflicts = detectConflicts(pointCloudLog, result.table);
          await saveConflicts(conflicts);
          setConflicts(conflicts);

          const updatedExhibits = pointCloudLog.exhibits.map((exhibit) => {
            const safetyEntry = result.table.exhibits.find(
              (e) => e.exhibitId === exhibit.exhibitId
            );
            const pendingConflict = conflicts.find(
              (c) => c.exhibitId === exhibit.exhibitId && c.status === 'pending'
            );
            return {
              ...exhibit,
              safetyRadius: safetyEntry?.safetyRadius,
              radiusSource: pendingConflict ? undefined : 'safety_table' as const,
            };
          });
          
          setPointCloudLog({
            ...pointCloudLog,
            exhibits: updatedExhibits,
          });
        }

        const checks = createInitialSelfChecks();
        const duplicateCheck = await runDuplicateImportCheck(
          md5(result.table.rawContent),
          'safety_radius',
          result.table.filename
        );
        checks[1] = duplicateCheck;
        setSelfChecks(checks);

        setWorkflow({
          safetyRadiusTableId: result.table.id,
        });

        setImportResult({
          success: true,
          message: `成功导入 ${result.table.exhibits.length} 个展柜的安全半径数据`,
          isDuplicate: result.isDuplicate,
        });

        completeStep('import_safety_radius');
        setTimeout(() => setCurrentStep('export'), 500);
      }

      onImportComplete?.();
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : '导入失败，请检查文件格式',
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [isPointCloud, operator]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (pendingFile.current) {
      await processFile(pendingFile.current, true);
      pendingFile.current = null;
    }
    setShowDuplicateWarning(false);
  };

  const handleCancelDuplicate = () => {
    pendingFile.current = null;
    setShowDuplicateWarning(false);
  };

  const existingData = isPointCloud ? pointCloudLog : safetyRadiusTable;

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showDuplicateWarning && duplicateInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-warning-50 border-2 border-warning-300 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-warning-800 mb-1">
                  检测到重复导入
                </h4>
                <p className="text-sm text-warning-700 mb-3">
                  该文件之前已导入过 {duplicateInfo.duplicateHistory?.length || 0} 次：
                </p>
                <ul className="text-xs text-warning-600 space-y-1 mb-3 bg-white/50 p-2 rounded">
                  {duplicateInfo.duplicateHistory?.map((h: any, idx: number) => (
                    <li key={idx}>
                      • {new Date(h.importTime).toLocaleString('zh-CN')} · {h.operator}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-warning-700 mb-3">
                  确认要重复导入吗？这将覆盖当前数据。
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-warning text-sm py-1 px-3"
                    onClick={handleConfirmDuplicate}
                  >
                    确认重复导入
                  </button>
                  <button
                    className="btn-secondary text-sm py-1 px-3"
                    onClick={handleCancelDuplicate}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'border-2 rounded-lg p-4 flex items-start gap-3',
              importResult.success
                ? 'bg-success-50 border-success-300'
                : 'bg-danger-50 border-danger-300'
            )}
          >
            {importResult.success ? (
              <Check className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
            ) : (
              <X className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={cn(
                'text-sm font-medium',
                importResult.success ? 'text-success-800' : 'text-danger-800'
              )}>
                {importResult.message}
              </p>
              {importResult.isDuplicate && (
                <p className="text-xs text-warning-600 mt-1">
                  注：此为重复导入，已覆盖原有数据
                </p>
              )}
            </div>
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setImportResult(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {existingData && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-success-600" />
            <span className="text-sm font-medium text-success-800">
              已导入 {fileTypeLabel}
            </span>
          </div>
          <div className="text-xs text-success-600 space-y-1">
            <p>文件名：{existingData.filename}</p>
            <p>导入时间：{new Date(existingData.importTime).toLocaleString('zh-CN')}</p>
            <p>操作人：{existingData.operator}</p>
            {'exhibits' in existingData && (
              <p>展柜数量：{existingData.exhibits.length} 个</p>
            )}
            {'version' in existingData && (
              <p>版本号：{existingData.version}</p>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'drop-zone',
          isDragging && 'drop-zone-active'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFiles}
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-survey-100 flex items-center justify-center">
            <Icon className="w-8 h-8 text-survey-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              拖拽 {fileTypeLabel} 到这里
            </p>
            <p className="text-xs text-gray-500 mt-1">
              或点击选择文件 · 支持 {acceptedFiles}
            </p>
          </div>
          <Upload className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
