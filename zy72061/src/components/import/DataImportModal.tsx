import { useState, useRef } from 'react';
import { Upload, X, FileText, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useGaitStore } from '../../store/useGaitStore';
import { GaitFrame, SkeletonPoint, DataSource, BoneGroup } from '../../types';
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
  const { setFrames, setImportReport, setCurrentFrameIndex, setSelectedPointId } = useGaitStore();
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalPoints: number;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const parsePointsToFrames = (points: ParsedPoint[]): GaitFrame[] => {
    const skeletonPoints: SkeletonPoint[] = points
      .filter((p) => p.point_name)
      .map((point, index) => {
        const nameToBoneGroup: Record<string, BoneGroup> = {
          head: 'head',
          neck: 'head',
          shoulder: 'spine',
          elbow: 'leftArm',
          wrist: 'leftArm',
          hand: 'leftArm',
          spine: 'spine',
          hip: 'spine',
          knee: 'leftLeg',
          ankle: 'leftLeg',
          foot: 'leftLeg',
        };

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

        return {
          id: `${point.point_name}_frame0`,
          name: point.point_name || `point_${index}`,
          nameCn: point.point_name || `点位${index + 1}`,
          boneGroup,
          x: parseFloat(point.x as string) || 0,
          y: parseFloat(point.y as string) || 0,
          z: parseFloat(point.z as string) || 0,
          source: sourceMap[point.source?.toLowerCase() || ''] || 'cad_export',
          sourceRow: parseInt(point.source_row as string) || index + 2,
          sourceFile: 'imported.csv',
          isAnomaly: point.is_anomaly === '1' || point.is_anomaly === 1,
          anomalyType: point.anomaly_type as any,
          anomalyNote: '',
          notes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          processedBy: '当前用户',
        };
      });

    return [
      {
        frameId: 'frame_0',
        frameNumber: 0,
        timestamp: 0,
        points: skeletonPoints,
        source: 'imported',
      },
    ];
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

        const frames = parsePointsToFrames(parsedPoints);
        setFrames(frames);
        setCurrentFrameIndex(0);
        setSelectedPointId(null);
        setImportReport({
          fileName: file.name,
          importedAt: new Date().toISOString(),
          totalPoints: parsedPoints.length,
          warnings,
        });

        setImportResult({
          success: true,
          totalPoints: parsedPoints.length,
          warnings,
          errors: [],
        });
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
    setFrames(MOCK_FRAMES);
    setCurrentFrameIndex(0);
    setSelectedPointId(null);
    setImportReport({
      fileName: 'demo_data',
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
      <div className="bg-white rounded-xl w-[500px] shadow-xl overflow-hidden">
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

        <div className="p-6">
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
            <p className="text-xs text-gray-500">支持CSV格式的点位数据文件</p>
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
              <p className="text-sm text-blue-700">正在导入数据...</p>
            </div>
          )}

          {importResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              importResult.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {importResult.success ? (
                  <CheckCircle size={18} className="text-green-600" />
                ) : (
                  <AlertCircle size={18} className="text-red-600" />
                )}
                <span className={`font-medium ${
                  importResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {importResult.success ? '导入成功' : '导入失败'}
                </span>
              </div>
              {importResult.success && (
                <p className="text-sm text-green-700">共导入 {importResult.totalPoints} 个点位</p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-700 mb-1">错误：</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...还有 {importResult.errors.length - 5} 条错误</li>
                    )}
                  </ul>
                </div>
              )}
              {importResult.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-orange-700 mb-1 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    警告（{importResult.warnings.length}）：
                  </p>
                  <ul className="text-xs text-orange-600 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.warnings.slice(0, 10).map((warn, i) => (
                      <li key={i}>• {warn}</li>
                    ))}
                    {importResult.warnings.length > 10 && (
                      <li>...还有 {importResult.warnings.length - 10} 条警告</li>
                    )}
                  </ul>
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
              加载示例数据
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
