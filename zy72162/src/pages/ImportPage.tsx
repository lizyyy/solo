import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Map,
  Users,
  Camera,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Database,
  Link2,
  BarChart3,
  Loader2,
  Trash2,
  X,
  Eye,
} from 'lucide-react';
import { SourceType, sourceTypeLabels, SourceData } from '@/types';
import { useAppStore } from '@/store';
import {
  extractRawCSV,
  extractRawExcel,
  parseGeoJSONFile,
  parseImageFile,
  applyMappingAndParse,
  ImportResult,
  RawPreview,
} from '@/utils/importExport';
import { generateShortId } from '@/utils/stringUtils';
import { cn } from '@/utils/cn';
import SourceBadge from '@/components/SourceBadge';

interface FieldMapping {
  [sourceField: string]: string;
}

interface ParsedFile {
  file: File;
  sourceType: SourceType;
  rawPreview: RawPreview | null;
  result: ImportResult | null;
  fieldMapping: FieldMapping;
  mappingApplied: boolean;
}

interface ImportStats {
  autoMerged: number;
  pendingReview: number;
  newPoints: number;
  total: number;
}

const sourceTypeIcons = {
  [SourceType.GIS]: Map,
  [SourceType.RESIDENT]: Users,
  [SourceType.INSPECTION]: Camera,
  [SourceType.STREET]: Building2,
};

const acceptedFileTypes: Record<SourceType, string[]> = {
  [SourceType.GIS]: ['.csv', '.geojson', '.json'],
  [SourceType.RESIDENT]: ['.csv', '.xlsx', '.xls'],
  [SourceType.INSPECTION]: ['.jpg', '.jpeg', '.png'],
  [SourceType.STREET]: ['.csv', '.xlsx', '.xls', '.txt'],
};

const systemFields = [
  { value: 'name', label: '点位名称 *', required: true },
  { value: 'lat', label: '纬度', required: false },
  { value: 'lng', label: '经度', required: false },
  { value: 'address', label: '地址', required: false },
  { value: 'street', label: '所属街道', required: false },
  { value: 'description', label: '描述', required: false },
  { value: 'contact', label: '联系人', required: false },
  { value: 'phone', label: '联系电话', required: false },
];

function getFieldAliases(field: string): string[] {
  const aliases: Record<string, string[]> = {
    name: ['名称', '点位名称', '投放点名称', 'title', '点位', '名字', '地点名称', '投放点'],
    lat: ['纬度', 'latitude', 'y', 'lat坐标'],
    lng: ['经度', 'longitude', 'lon', 'x', 'lng坐标'],
    address: ['地址', '位置', '详细地址', '住址', '地址详情'],
    street: ['街道', '所属街道', '街道办事处', '片区', '区域'],
    description: ['描述', '备注', '说明', '详情', '介绍'],
    contact: ['联系人', '负责人', '经办人', '联络人'],
    phone: ['联系电话', '电话', '手机号', '联系方式', '手机'],
  };
  return aliases[field] || [];
}

function autoMapFields(fileFields: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const lowerCasedFields = fileFields.map((f) => f.toLowerCase());

  systemFields.forEach((sysField) => {
    const candidates = [
      sysField.value,
      ...getFieldAliases(sysField.value),
    ].map((c) => c.toLowerCase());

    for (const candidate of candidates) {
      const idx = lowerCasedFields.indexOf(candidate);
      if (idx !== -1) {
        mapping[fileFields[idx]] = sysField.value;
        break;
      }
    }
  });

  return mapping;
}

function hasNameMapping(mapping: FieldMapping): boolean {
  return Object.values(mapping).includes('name');
}

export default function ImportPage() {
  const { importSourceDataBatch, addSourceData, savePhoto } = useAppStore();

  const [selectedSourceType, setSelectedSourceType] = useState<SourceType | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceTypeSelect = (type: SourceType) => {
    setSelectedSourceType(type);
    setParsedFiles([]);
    setImportStats(null);
    setShowSuccess(false);
  };

  const getAcceptedExtensions = () => {
    if (!selectedSourceType) return '';
    return acceptedFileTypes[selectedSourceType].join(',');
  };

  const validateFileType = (file: File): boolean => {
    if (!selectedSourceType) return false;
    const fileName = file.name.toLowerCase();
    return acceptedFileTypes[selectedSourceType].some((ext) => fileName.endsWith(ext));
  };

  const extractRawFromFile = async (file: File, sourceType: SourceType): Promise<ParsedFile> => {
    const fileName = file.name.toLowerCase();

    if (sourceType === SourceType.INSPECTION) {
      const result: ImportResult = { success: true, data: [], errors: [], warnings: [] };
      try {
        const { dataUrl } = await parseImageFile(file);
        const photoId = generateShortId();
        await savePhoto(photoId, dataUrl);
        result.data.push({
          id: generateShortId(),
          pointId: '',
          sourceType,
          sourceName: file.name.replace(/\.[^/.]+$/, ''),
          rawData: { fileName: file.name, fileSize: file.size, fileType: file.type, photoId },
          photoUrl: photoId,
          operator: '系统导入',
          importedAt: new Date(),
          confidence: 0.8,
        });
      } catch (error: any) {
        result.errors.push(`解析图片失败: ${error.message}`);
        result.success = false;
      }
      return { file, sourceType, rawPreview: null, result, fieldMapping: {}, mappingApplied: true };
    }

    if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
      const result = await parseGeoJSONFile(file, sourceType);
      return { file, sourceType, rawPreview: null, result, fieldMapping: {}, mappingApplied: true };
    }

    if (fileName.endsWith('.txt')) {
      const result: ImportResult = { success: true, data: [], errors: [], warnings: [] };
      try {
        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim());
        lines.forEach((line, index) => {
          result.data.push({
            id: generateShortId(),
            pointId: '',
            sourceType,
            sourceName: line.trim(),
            rawData: { content: line.trim(), lineNumber: index + 1 },
            operator: '系统导入',
            importedAt: new Date(),
            confidence: 0.7,
          });
        });
        if (result.data.length === 0) {
          result.errors.push('文件内容为空');
          result.success = false;
        }
      } catch (error: any) {
        result.errors.push(`解析TXT文件失败: ${error.message}`);
        result.success = false;
      }
      return { file, sourceType, rawPreview: null, result, fieldMapping: {}, mappingApplied: true };
    }

    let rawPreview: RawPreview;
    if (fileName.endsWith('.csv')) {
      rawPreview = await extractRawCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      rawPreview = await extractRawExcel(file);
    } else {
      return {
        file, sourceType, rawPreview: null,
        result: { success: false, data: [], errors: ['不支持的文件类型'], warnings: [] },
        fieldMapping: {}, mappingApplied: true,
      };
    }

    const fieldMapping = autoMapFields(rawPreview.headers);
    const mappingApplied = hasNameMapping(fieldMapping);

    let result: ImportResult | null = null;
    if (mappingApplied) {
      result = applyMappingAndParse(rawPreview.rows, fieldMapping, sourceType);
    }

    return { file, sourceType, rawPreview, result, fieldMapping, mappingApplied };
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!selectedSourceType) return;

      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(validateFileType);
      const invalidFiles = fileArray.filter((f) => !validateFileType(f));
      if (invalidFiles.length > 0) {
        alert(`以下文件类型不支持: ${invalidFiles.map((f) => f.name).join(', ')}`);
      }

      for (const file of validFiles) {
        try {
          const pf = await extractRawFromFile(file, selectedSourceType);
          setParsedFiles((prev) => [...prev, pf]);
        } catch (error: any) {
          setParsedFiles((prev) => [
            ...prev,
            {
              file, sourceType: selectedSourceType, rawPreview: null,
              result: { success: false, data: [], errors: [`文件读取失败: ${error.message}`], warnings: [] },
              fieldMapping: {}, mappingApplied: true,
            },
          ]);
        }
      }
    },
    [selectedSourceType]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const triggerFileInput = () => fileInputRef.current?.click();

  const removeFile = (index: number) => {
    setParsedFiles((prev) => prev.filter((_, i) => i !== index));
    if (parsedFiles.length === 1) {
      setImportStats(null);
      setShowSuccess(false);
    }
  };

  const updateFieldMapping = (fileIndex: number, sourceField: string, targetField: string) => {
    setParsedFiles((prev) =>
      prev.map((pf, idx) => {
        if (idx !== fileIndex) return pf;
        const newMapping = { ...pf.fieldMapping };
        if (targetField) {
          newMapping[sourceField] = targetField;
        } else {
          delete newMapping[sourceField];
        }
        return { ...pf, fieldMapping: newMapping, mappingApplied: false, result: null };
      })
    );
  };

  const applyMapping = async (fileIndex: number) => {
    const pf = parsedFiles[fileIndex];
    if (!pf.rawPreview) return;

    if (!hasNameMapping(pf.fieldMapping)) {
      alert('请至少将一个字段映射到"点位名称"，否则无法导入。');
      return;
    }

    const result = applyMappingAndParse(pf.rawPreview.rows, pf.fieldMapping, pf.sourceType);
    setParsedFiles((prev) =>
      prev.map((p, i) => (i === fileIndex ? { ...p, result, mappingApplied: true } : p))
    );
  };

  const applyAllMappings = async () => {
    for (let i = 0; i < parsedFiles.length; i++) {
      const pf = parsedFiles[i];
      if (!pf.mappingApplied && pf.rawPreview) {
        if (!hasNameMapping(pf.fieldMapping)) continue;
        const result = applyMappingAndParse(pf.rawPreview.rows, pf.fieldMapping, pf.sourceType);
        setParsedFiles((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, result, mappingApplied: true } : p))
        );
      }
    }
  };

  const handleImport = async () => {
    const filesReady = parsedFiles.filter((pf) => pf.result && pf.result.data.length > 0);
    if (filesReady.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setShowSuccess(false);
    setImportStats(null);

    try {
      let totalAutoMerged = 0;
      let totalPendingReview = 0;
      let totalNewPoints = 0;
      let totalProcessed = 0;

      const allData: SourceData[] = [];
      filesReady.forEach((pf) => {
        pf.result!.data.forEach((item) => allData.push(item));
      });

      const totalItems = allData.length;
      if (totalItems === 0) throw new Error('没有可导入的数据');

      if (totalItems === 1) {
        const res = await addSourceData(allData[0]);
        if (res.candidate) {
          const { mergeEngine } = await import('@/utils/mergeEngine');
          if (mergeEngine.shouldAutoMerge(res.candidate)) totalAutoMerged++;
          else totalPendingReview++;
        } else {
          totalNewPoints++;
        }
        totalProcessed = 1;
        setImportProgress(100);
      } else {
        const batchSize = Math.ceil(totalItems / 100);
        const batches: SourceData[][] = [];
        for (let i = 0; i < totalItems; i += batchSize) batches.push(allData.slice(i, i + batchSize));

        for (let i = 0; i < batches.length; i++) {
          const stats = await importSourceDataBatch(batches[i]);
          totalAutoMerged += stats.autoMerged;
          totalPendingReview += stats.pendingReview;
          totalNewPoints += stats.newPoints;
          totalProcessed += batches[i].length;
          setImportProgress(Math.round(((i + 1) / batches.length) * 100));
        }
      }

      setImportStats({ autoMerged: totalAutoMerged, pendingReview: totalPendingReview, newPoints: totalNewPoints, total: totalProcessed });
      setShowSuccess(true);
    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setParsedFiles([]);
    setSelectedSourceType(null);
    setImportStats(null);
    setShowSuccess(false);
    setImportProgress(0);
  };

  const getTotalStats = () => {
    let totalRecords = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    parsedFiles.forEach((pf) => {
      if (pf.result) {
        totalRecords += pf.result.data.length;
        totalErrors += pf.result.errors.length;
        totalWarnings += pf.result.warnings.length;
      } else if (pf.rawPreview) {
        totalErrors += 1;
      }
    });
    return { totalRecords, totalErrors, totalWarnings };
  };

  const hasUnmappedFiles = parsedFiles.some((pf) => !pf.mappingApplied && pf.rawPreview);
  const hasReadyData = parsedFiles.some((pf) => pf.result && pf.result.data.length > 0);
  const { totalRecords, totalErrors, totalWarnings } = getTotalStats();

  if (!selectedSourceType) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">数据导入</h1>
          <p className="text-neutral-500">选择数据来源类型，开始导入多源异构的垃圾分类投放点位数据</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.values(SourceType) as SourceType[]).map((type) => {
            const Icon = sourceTypeIcons[type];
            return (
              <button
                key={type}
                onClick={() => handleSourceTypeSelect(type)}
                className="card p-6 hover:shadow-card-hover transition-all duration-300 text-left group"
              >
                <div className="w-12 h-12 bg-primary-50 rounded-sm flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
                  <Icon size={24} className="text-primary-500" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">{sourceTypeLabels[type]}</h3>
                <p className="text-sm text-neutral-500 mb-3">
                  {type === SourceType.GIS && '支持CSV、GeoJSON、JSON格式的空间点位数据'}
                  {type === SourceType.RESIDENT && '支持CSV、Excel格式的居民反馈记录'}
                  {type === SourceType.INSPECTION && '支持JPG、PNG格式的巡检照片，支持批量上传'}
                  {type === SourceType.STREET && '支持CSV、Excel、TXT格式的街道备注信息'}
                </p>
                <div className="flex items-center text-primary-500 text-sm font-medium group-hover:text-primary-600">
                  开始导入
                  <ArrowRight size={16} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const Icon = sourceTypeIcons[selectedSourceType];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handleReset} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <RefreshCw size={20} />
          </button>
          <div className="w-8 h-8 bg-primary-50 rounded-sm flex items-center justify-center">
            <Icon size={18} className="text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-800">导入{sourceTypeLabels[selectedSourceType]}</h1>
        </div>
        <p className="text-neutral-500 ml-11">支持格式：{acceptedFileTypes[selectedSourceType].join('、')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div
            className={cn(
              'card p-8 border-2 border-dashed transition-all duration-300 cursor-pointer',
              isDragging ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={getAcceptedExtensions()}
              multiple={selectedSourceType === SourceType.INSPECTION}
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-center">
              <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', isDragging ? 'bg-primary-100' : 'bg-neutral-100')}>
                <Upload size={32} className={cn(isDragging ? 'text-primary-500' : 'text-neutral-400')} />
              </div>
              <p className="text-lg font-medium text-neutral-700 mb-1">{isDragging ? '释放文件以上传' : '拖拽文件到此处'}</p>
              <p className="text-sm text-neutral-500 mb-3">或<span className="text-primary-500 font-medium mx-1">点击选择文件</span></p>
              <p className="text-xs text-neutral-400">
                {selectedSourceType === SourceType.INSPECTION ? '支持批量上传多张照片' : '单次上传一个文件'}
              </p>
            </div>
          </div>

          {parsedFiles.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-primary-500" />
                  <h2 className="font-semibold text-neutral-800">已解析文件</h2>
                  <span className="text-sm text-neutral-500">({parsedFiles.length}个文件)</span>
                </div>
                {hasUnmappedFiles && (
                  <button
                    onClick={applyAllMappings}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-sm hover:bg-primary-600 transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    应用所有映射
                  </button>
                )}
              </div>

              <div className="divide-y divide-neutral-200">
                {parsedFiles.map((pf, fileIdx) => (
                  <div key={fileIdx} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <SourceBadge type={pf.sourceType} />
                        <span className="font-medium text-neutral-800">{pf.file.name}</span>
                        <span className="text-sm text-neutral-500">({(pf.file.size / 1024).toFixed(1)} KB)</span>
                        {pf.mappingApplied && pf.result && pf.result.data.length > 0 && (
                          <span className="text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-sm">映射完成</span>
                        )}
                        {!pf.mappingApplied && pf.rawPreview && (
                          <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded-sm">待映射</span>
                        )}
                      </div>
                      <button onClick={() => removeFile(fileIdx)} className="text-neutral-400 hover:text-danger-500 transition-colors">
                        <X size={18} />
                      </button>
                    </div>

                    {pf.rawPreview && !pf.mappingApplied && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Link2 size={16} className="text-warning-500" />
                          <h4 className="text-sm font-semibold text-warning-700">
                            文件表头无法自动识别，请手动映射字段
                          </h4>
                        </div>
                        <p className="text-xs text-neutral-500 mb-3">
                          将左侧文件列名映射到右侧系统字段，其中"点位名称"为必填项。映射完成后点击"确认映射"。
                        </p>

                        <div className="space-y-2 mb-4">
                          {pf.rawPreview.headers.map((header) => (
                            <div key={header} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-neutral-700 truncate">{header}</div>
                                <div className="text-xs text-neutral-400 mt-0.5 truncate">
                                  示例：{String(pf.rawPreview!.rows[0]?.[header] ?? '').slice(0, 40)}
                                </div>
                              </div>
                              <ArrowRight size={18} className="text-neutral-300 flex-shrink-0" />
                              <div className="w-56 flex-shrink-0">
                                <select
                                  value={pf.fieldMapping[header] || ''}
                                  onChange={(e) => updateFieldMapping(fileIdx, header, e.target.value)}
                                  className="select text-sm"
                                >
                                  <option value="">不映射</option>
                                  {systemFields.map((sf) => (
                                    <option key={sf.value} value={sf.value}>{sf.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        {!hasNameMapping(pf.fieldMapping) && (
                          <div className="p-3 bg-warning-50 border border-warning-200 rounded-sm mb-3 flex items-center gap-2">
                            <AlertCircle size={16} className="text-warning-500 flex-shrink-0" />
                            <span className="text-sm text-warning-700">请至少将一个字段映射到"点位名称"，否则无法导入</span>
                          </div>
                        )}

                        <button
                          onClick={() => applyMapping(fileIdx)}
                          disabled={!hasNameMapping(pf.fieldMapping)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 text-sm rounded-sm transition-colors',
                            hasNameMapping(pf.fieldMapping)
                              ? 'bg-primary-500 text-white hover:bg-primary-600'
                              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                          )}
                        >
                          <Eye size={16} />
                          确认映射并预览
                        </button>
                      </div>
                    )}

                    {pf.rawPreview && pf.mappingApplied && pf.result && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 size={14} className="text-primary-500" />
                          <span className="text-xs text-neutral-500">字段映射（可修改后重新确认）</span>
                        </div>
                        <div className="space-y-1 mb-3">
                          {Object.entries(pf.fieldMapping).map(([src, tgt]) => {
                            const sysField = systemFields.find((s) => s.value === tgt);
                            return (
                              <div key={src} className="flex items-center gap-2 text-xs">
                                <span className="text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">{src}</span>
                                <ArrowRight size={12} className="text-neutral-300" />
                                <span className="text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{sysField?.label || tgt}</span>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setParsedFiles((prev) => prev.map((p, i) => (i === fileIdx ? { ...p, mappingApplied: false, result: null } : p)))}
                          className="text-xs text-primary-500 hover:text-primary-600 underline"
                        >
                          修改映射
                        </button>
                      </div>
                    )}

                    {pf.result && pf.result.data.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-neutral-700 mb-2">数据预览（前3条）</h4>
                        <div className="overflow-x-auto border border-neutral-200 rounded-sm">
                          <table className="w-full text-sm">
                            <thead className="bg-neutral-50">
                              <tr>
                                <th className="table-header w-12">#</th>
                                <th className="table-header">名称</th>
                                <th className="table-header">地址</th>
                                <th className="table-header">街道</th>
                                <th className="table-header">坐标</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pf.result.data.slice(0, 3).map((item, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-neutral-50">
                                  <td className="table-cell text-neutral-500">{rowIdx + 1}</td>
                                  <td className="table-cell">{item.sourceName}</td>
                                  <td className="table-cell">{String(item.rawData.address ?? '')}</td>
                                  <td className="table-cell">{String(item.rawData.street ?? '')}</td>
                                  <td className="table-cell text-neutral-500 text-xs">
                                    {item.rawData.lat && item.rawData.lng
                                      ? `${Number(item.rawData.lat).toFixed(4)}, ${Number(item.rawData.lng).toFixed(4)}`
                                      : '无'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2 flex gap-3 text-xs text-neutral-500">
                          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-success-500" />有效 {pf.result.data.length} 条</span>
                          {pf.result.errors.length > 0 && <span className="flex items-center gap-1"><XCircle size={12} className="text-danger-500" />错误 {pf.result.errors.length} 条</span>}
                          {pf.result.warnings.length > 0 && <span className="flex items-center gap-1"><AlertCircle size={12} className="text-warning-500" />警告 {pf.result.warnings.length} 条</span>}
                        </div>
                      </div>
                    )}

                    {pf.result && pf.result.errors.length > 0 && (
                      <div className="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-sm">
                        <h4 className="text-sm font-medium text-danger-700 mb-2 flex items-center gap-2"><XCircle size={16} />错误信息</h4>
                        <ul className="text-sm text-danger-600 space-y-1 max-h-32 overflow-auto">
                          {pf.result.errors.slice(0, 10).map((err, idx) => (
                            <li key={idx} className="flex items-start gap-2"><span className="text-danger-400">•</span>{err}</li>
                          ))}
                          {pf.result.errors.length > 10 && <li className="text-danger-500">...还有 {pf.result.errors.length - 10} 条错误</li>}
                        </ul>
                      </div>
                    )}

                    {pf.result && pf.result.warnings.length > 0 && (
                      <div className="p-4 bg-warning-50 border border-warning-200 rounded-sm">
                        <h4 className="text-sm font-medium text-warning-700 mb-2 flex items-center gap-2"><AlertCircle size={16} />警告信息</h4>
                        <ul className="text-sm text-warning-600 space-y-1 max-h-32 overflow-auto">
                          {pf.result.warnings.slice(0, 10).map((warn, idx) => (
                            <li key={idx} className="flex items-start gap-2"><span className="text-warning-400">•</span>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-primary-500" />数据统计
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-success-500 rounded-full" /><span className="text-sm text-neutral-700">有效数据</span></div>
                <span className="font-semibold text-success-600">{totalRecords} 条</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-danger-500 rounded-full" /><span className="text-sm text-neutral-700">错误数据</span></div>
                <span className="font-semibold text-danger-600">{totalErrors} 条</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-warning-500 rounded-full" /><span className="text-sm text-neutral-700">警告数据</span></div>
                <span className="font-semibold text-warning-600">{totalWarnings} 条</span>
              </div>
              {hasUnmappedFiles && (
                <div className="flex items-center justify-between p-3 bg-warning-50 rounded-sm border border-warning-200">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-warning-500 rounded-full" /><span className="text-sm text-warning-700">待映射</span></div>
                  <span className="font-semibold text-warning-600">
                    {parsedFiles.filter((pf) => !pf.mappingApplied && pf.rawPreview).length} 个文件
                  </span>
                </div>
              )}
              <div className="divider" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">总计</span>
                <span className="font-bold text-neutral-800">{totalRecords + totalErrors} 条</span>
              </div>
            </div>
          </div>

          {isImporting && (
            <div className="card p-6">
              <h3 className="font-semibold text-neutral-800 mb-4">导入进度</h3>
              <div className="space-y-3">
                <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">正在导入...</span>
                  <span className="font-medium text-primary-600">{importProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {showSuccess && importStats && (
            <div className="card p-6 border-success-300 bg-success-50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-success-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-white" />
                </div>
                <h3 className="font-semibold text-success-800">导入完成</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-sm border border-success-200">
                  <div className="flex items-center gap-2"><Database size={16} className="text-success-500" /><span className="text-sm text-neutral-700">处理总数</span></div>
                  <span className="font-semibold text-neutral-800">{importStats.total} 条</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-sm border border-success-200">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary-500" /><span className="text-sm text-neutral-700">自动归并</span></div>
                  <span className="font-semibold text-primary-600">{importStats.autoMerged} 条</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-sm border border-success-200">
                  <div className="flex items-center gap-2"><AlertCircle size={16} className="text-warning-500" /><span className="text-sm text-neutral-700">待复核</span></div>
                  <span className="font-semibold text-warning-600">{importStats.pendingReview} 条</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-sm border border-success-200">
                  <div className="flex items-center gap-2"><FileText size={16} className="text-success-500" /><span className="text-sm text-neutral-700">新点位</span></div>
                  <span className="font-semibold text-success-600">{importStats.newPoints} 条</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleImport}
              disabled={!hasReadyData || isImporting || hasUnmappedFiles}
              className={cn(
                'w-full btn-primary flex items-center justify-center gap-2 py-3',
                (!hasReadyData || isImporting || hasUnmappedFiles) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isImporting ? (
                <><Loader2 size={18} className="animate-spin" />导入中...</>
              ) : (
                <><Database size={18} />开始导入 ({totalRecords} 条)</>
              )}
            </button>
            {hasUnmappedFiles && (
              <p className="text-xs text-warning-600 text-center">请先完成所有文件的字段映射</p>
            )}
            <button onClick={handleReset} disabled={isImporting} className="w-full btn-default flex items-center justify-center gap-2 py-3">
              <Trash2 size={18} />清空并重新选择
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
