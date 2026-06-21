import { useState, useRef } from 'react';
import { Upload, X, FileText, AlertTriangle, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { useGaitStore } from '../../store/useGaitStore';
import { GaitFrame, SkeletonPoint, DataSource, BoneGroup, SupplementDiff } from '../../types';
import { MOCK_FRAMES } from '../../data/mockData';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedPoint {
  point_id?: string;
  point_name?: string;
  x?: string | number;
  y?: string | number;
  z?: string | number;
  source?: string;
  source_row?: string | number;
  is_anomaly?: string | number;
  anomaly_type?: string;
}

export default function DataImportModal({ isOpen, onClose }: DataImportModalProps) {
  const {
    setFrames,
    supplementImport,
    setImportReport,
    setCurrentFrameIndex,
    setSelectedPointId,
    frames,
    importSessions,
  } = useGaitStore();

  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'initial' | 'supplement'>('initial');
  const [authorName, setAuthorName] = useState('阿乔');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalPoints: number;
    warnings: string[];
    errors: string[];
    diffs?: SupplementDiff[];
    fileName?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasExistingData = frames.length > 0;

  const validateData = (points: ParsedPoint[]): { warnings: string[]; errors: string[] } => {
    const warnings: string[] = [];
    const errors: string[] = [];

    points.forEach((point, index) => {
      const rowNum = index + 2;

      if (!point.point_name) {
        errors.push(`第${rowNum}行：缺少点位名称`);
        return;
      }

      const x = parseFloat(point.x as string);
      const y = parseFloat(point.y as string);
      const z = parseFloat(point.z as string);

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        warnings.push(`第${rowNum}行 (${point.point_name})：坐标数据不完整或格式错误`);
      }

      const expectedRange = 3;
      if (Math.abs(x) > expectedRange || Math.abs(y) > expectedRange || Math.abs(z) > expectedRange) {
        warnings.push(`第${rowNum}行 (${point.point_name})：坐标值超出预期范围，可能存在坐标系问题`);
      }

      if (point.is_anomaly === '1' && !point.anomaly_type) {
        warnings.push(`第${rowNum}行 (${point.point_name})：标记为异常但未指定异常类型`);
      }
    });

    const nameCounts: Record<string, number> = {};
    points.forEach((p) => {
      if (p.point_name) {
        nameCounts[p.point_name] = (nameCounts[p.point_name] || 0) + 1;
      }
    });
    Object.entries(nameCounts).forEach(([name, count]) => {
      if (count > 1) {
        warnings.push(`点位 ${name} 出现 ${count} 次，存在重复数据`);
      }
    });

    return { warnings, errors };
  };

  const parsePointsToFrame = (points: ParsedPoint[], frameNumber: number, realFileName: string): GaitFrame => {
    const skeletonPoints: SkeletonPoint[] = points
      .filter((p) => p.point_name)
      .map((point, index) => {
        let boneGroup: BoneGroup = 'spine';
        const name = point.point_name?.toLowerCase() || '';
        if (name.includes('head') || name.includes('neck')) boneGroup = 'head';
        else if (name.includes('shoulder') || name.includes('spine') || name.includes('hip')) boneGroup = 'spine';
        else if (name.includes('left') && (name.includes('arm') || name.includes('elbow') || name.includes('wrist') || name.includes('hand'))) boneGroup = 'leftArm';
        else if (name.includes('right') && (name.includes('arm') || name.includes('elbow') || name.includes('wrist') || name.includes('hand'))) boneGroup = 'rightArm';
        else if (name.includes('left') && (name.includes('leg') || name.includes('knee') || name.includes('ankle') || name.includes('foot'))) boneGroup = 'leftLeg';
        else if (name.includes('right') && (name.includes('leg') || name.includes('knee') || name.includes('ankle') || name.includes('foot'))) boneGroup = 'rightLeg';

        const sourceMap: Record<string, DataSource> = {
          cad: 'cad_export',
          cad_export: 'cad_export',
          manual: 'manual_edit',
          manual_edit: 'manual_edit',
          photo: 'photo_estimate',
          photo_estimate: 'photo_estimate',
        };

        const x = parseFloat(point.x as string) || 0;
        const y = parseFloat(point.y as string) || 0;
        const z = parseFloat(point.z as string) || 0;
        const source = sourceMap[point.source?.toLowerCase() || ''] || 'cad_export';
        const sourceRow = parseInt(point.source_row as string) || index + 2;

        return {
          id: `${point.point_name}_frame${frameNumber}`,
          name: point.point_name || `point_${index}`,
          nameCn: point.point_name || `点位${index + 1}`,
          boneGroup,
          x,
          y,
          z,
          source,
          sourceRow,
          sourceFile: realFileName,
          importSessionId: '',
          originalValues: { x, y, z, source, sourceRow, sourceFile: realFileName, importSessionId: '' },
          importHistory: [],
          isAnomaly: point.is_anomaly === '1' || point.is_anomaly === 1,
          anomalyType: point.anomaly_type as any,
          anomalyNote: '',
          notes: [],
          modificationStats: {
            totalChanges: 0,
            coordinateChanges: 0,
            anomalyStatusChanges: 0,
            noteAdditions: 0,
            sourceChanges: 0,
            lastModifiedAt: new Date().toISOString(),
            modifiedBy: [],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          processedBy: authorName,
        };
      });

    return {
      frameId: `frame_${frameNumber}`,
      frameNumber,
      timestamp: frameNumber * 0.1,
      points: skeletonPoints,
      source: 'imported',
    };
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportResult({
        success: false,
        totalPoints: 0,
        warnings: [],
        errors: ['请上传CSV格式的文件'],
      });
      return;
    }

    const realFileName = file.name;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedPoints = results.data as ParsedPoint[];
        const { warnings, errors } = validateData(parsedPoints);

        if (errors.length > 0) {
          setImportResult({
            success: false,
            totalPoints: parsedPoints.length,
            warnings,
            errors,
          });
          setImporting(false);
          return;
        }

        const newFrame = parsePointsToFrame(parsedPoints, 0, realFileName);
        const newFrames = [newFrame];

        if (importMode === 'initial' || !hasExistingData) {
          setFrames(newFrames, authorName, realFileName);
          setCurrentFrameIndex(0);
          setSelectedPointId(null);
          setImportReport({
            fileName: realFileName,
            importedAt: new Date().toISOString(),
            totalPoints: parsedPoints.length,
            warnings,
          });
          setImportResult({
            success: true,
            totalPoints: parsedPoints.length,
            warnings,
            errors: [],
            fileName: realFileName,
          });
        } else {
          const diffs = supplementImport(newFrames, realFileName, authorName);
          setImportReport({
            fileName: realFileName,
            importedAt: new Date().toISOString(),
            totalPoints: parsedPoints.length,
            warnings,
          });
          setImportResult({
            success: true,
            totalPoints: parsedPoints.length,
            warnings,
            errors: [],
            diffs,
            fileName: realFileName,
          });
        }

        setImporting(false);
      },
      error: (error) => {
        setImportResult({
          success: false,
          totalPoints: 0,
          warnings: [],
          errors: [`文件解析失败：${error.message}`],
        });
        setImporting(false);
      },
    });
  };

  const handleLoadDemoData = () => {
    setFrames(MOCK_FRAMES, authorName, 'gait_2024_06_15.csv');
    setCurrentFrameIndex(0);
    setSelectedPointId(null);
    setImportReport({
      fileName: 'gait_2024_06_15.csv',
      importedAt: new Date().toISOString(),
      totalPoints: MOCK_FRAMES[0].points.length,
      warnings: [],
    });
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[560px] max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
            导入数据
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {hasExistingData && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-3">
                当前已有 {frames.length} 帧数据，请选择导入模式：
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportMode('initial')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    importMode === 'initial'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  首次导入（覆盖）
                </button>
                <button
                  onClick={() => setImportMode('supplement')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    importMode === 'supplement'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  补录导入（合并差异）
                </button>
              </div>
              {importMode === 'supplement' && (
                <p className="text-xs text-orange-700 mt-2">
                  补录模式：新数据与现有数据逐点比对，仅更新有变化的点位，并记录坐标差异、来源变更等。
                </p>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">操作人</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="您的名字"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <Upload size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              拖拽CSV文件到此处或点击上传
            </p>
            <p className="text-xs text-gray-500">文件名将作为来源标识记录到每个点位</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
          </div>

          {importing && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-blue-700">
                {importMode === 'supplement' ? '正在比对差异...' : '正在导入数据...'}
              </p>
            </div>
          )}

          {importResult && (
            <div className={`mt-4 rounded-lg overflow-hidden ${
              importResult.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? (
                    <CheckCircle size={18} className="text-green-600" />
                  ) : (
                    <AlertCircle size={18} className="text-red-600" />
                  )}
                  <span className={`font-medium ${
                    importResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {importResult.success
                      ? (importMode === 'supplement' && hasExistingData ? '补录导入成功' : '首次导入成功')
                      : '导入失败'}
                  </span>
                </div>

                {importResult.success && importResult.fileName && (
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <p className="text-xs text-green-700">
                      <strong>来源文件：</strong>{importResult.fileName}
                    </p>
                    <p className="text-xs text-green-600">
                      共 {importResult.totalPoints} 个点位，此文件名已记录到每个点位的数据来源中
                    </p>
                  </div>
                )}

                {importResult.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-orange-700 mb-1 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      警告（{importResult.warnings.length}）
                    </p>
                    <ul className="text-xs text-orange-600 space-y-1 max-h-24 overflow-y-auto">
                      {importResult.warnings.slice(0, 5).map((warn, i) => (
                        <li key={i}>• {warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-700 mb-1">错误：</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {importResult.diffs && importResult.diffs.length > 0 && (
                <div className="border-t border-green-200 p-4 bg-white">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">
                    补录差异明细（{importResult.diffs.length} 个点位有变化）
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {importResult.diffs.map((diff, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800">
                            {diff.pointName}（帧 {diff.frameNumber}）
                          </span>
                        </div>
                        {diff.coordinateDistance > 0 && (
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-red-600">
                              ({diff.previousCoordinates.x.toFixed(3)}, {diff.previousCoordinates.y.toFixed(3)}, {diff.previousCoordinates.z.toFixed(3)})
                            </span>
                            <ArrowRight size={12} className="text-gray-400" />
                            <span className="text-green-600">
                              ({diff.newCoordinates.x.toFixed(3)}, {diff.newCoordinates.y.toFixed(3)}, {diff.newCoordinates.z.toFixed(3)})
                            </span>
                            <span className="text-gray-500">偏移: {diff.coordinateDistance.toFixed(4)}</span>
                          </div>
                        )}
                        {diff.previousAnomaly !== diff.newAnomaly && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500">异常：</span>
                            <span className={diff.previousAnomaly ? 'text-orange-600' : 'text-green-600'}>
                              {diff.previousAnomaly ? '异常' : '正常'}
                            </span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span className={diff.newAnomaly ? 'text-orange-600' : 'text-green-600'}>
                              {diff.newAnomaly ? '异常' : '正常'}
                            </span>
                          </div>
                        )}
                        {diff.previousSourceFile !== diff.newSourceFile && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500">来源：</span>
                            <span className="text-gray-600">{diff.previousSourceFile || '-'}</span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span className="text-blue-600 font-medium">{diff.newSourceFile}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.diffs && importResult.diffs.length === 0 && importResult.success && (
                <div className="border-t border-green-200 p-4 bg-white">
                  <p className="text-sm text-gray-600">
                    补录比对完成：所有点位数据与现有数据一致，无差异。
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">没有数据文件？</p>
            <button
              onClick={handleLoadDemoData}
              className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <FileText size={16} />
              加载示例数据（gait_2024_06_15.csv）
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 mb-2">CSV文件格式要求：</p>
            <code className="text-xs text-gray-600 block bg-white p-2 rounded border">
              point_id,point_name,x,y,z,source,source_row,is_anomaly,anomaly_type
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
