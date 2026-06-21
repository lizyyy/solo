import { useState, useEffect } from 'react';
import { 
  X, Upload, FileJson, FileSpreadsheet, Map, Tablet, Image, AlertCircle, 
  Check, Settings, Eye, FileText, ArrowRight 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { CrackRecord } from '../../types';
import { 
  parseCSV, detectFileType, autoMapFields, mapRowToRecord,
  CSV_TARGET_FIELDS, type FieldMapping, type CSVParseResult
} from '../../utils/csv';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const IMPORT_SOURCES = [
  { type: 'gis', icon: Map, label: 'GIS扫描数据', color: 'text-blue-400', desc: '.json 或 .csv 格式' },
  { type: 'tablet', icon: Tablet, label: '巡检平板记录', color: 'text-green-400', desc: '.json 或 .csv 格式' },
  { type: 'excel', icon: FileSpreadsheet, label: 'Excel台账', color: 'text-emerald-400', desc: '.csv 格式导出文件' },
  { type: 'screenshot', icon: Image, label: '周会截图补录', color: 'text-amber-400', desc: '手动录入或CSV导入' }
] as const;

const DEMO_DATA: Record<string, Omit<CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>> = {
  gis: {
    code: 'YP-DEMO-GIS',
    location: 'tip',
    position3D: { x: 0.1, y: 4.5, z: 0 },
    crackType: 'suspected',
    riskLevel: 'high',
    status: 'pending',
    source: 'gis',
    description: '叶尖前缘GIS扫描异常信号，疑似前缘 erosion 或涂层脱落',
    suggestion: '建议无人机航拍确认前缘状况，如确认为前缘 erosion 需评估是否需要前缘保护修复',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-gis',
      sourceType: 'gis',
      sourceRef: 'GIS扫描报告 DEMO-W02，异常点编号A-023',
      originalData: '{"grid":"W02","point":"A-023","signalStrength":"1.8x","depth":"未知"}'
    }
  },
  tablet: {
    code: 'YP-DEMO-TAB',
    location: 'middle',
    position3D: { x: -0.1, y: 3, z: 0.1 },
    crackType: 'longitudinal',
    riskLevel: 'medium',
    status: 'pending',
    source: 'tablet',
    description: '叶中背风面纵向微裂纹，长约10cm，宽度约0.2mm',
    suggestion: '建议纳入下次定检计划，打磨后做表面修复，后续跟踪观察',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-tab',
      sourceType: 'tablet',
      sourceRef: '平板记录 DEMO，照片IMG_DEMO_089',
      originalData: '{"position":"叶中","length":"10cm","width":"0.2mm","photo":"IMG_DEMO_089"}'
    }
  },
  excel: {
    code: 'YP-DEMO-EXL',
    location: 'root',
    position3D: { x: 0.15, y: 0.8, z: -0.05 },
    crackType: 'mesh',
    riskLevel: 'high',
    status: 'pending',
    source: 'excel',
    description: '叶根法兰连接区域网状微裂纹，需超声波探伤确认内部情况',
    suggestion: '高优先级处理，建议尽快安排搭架检查，做超声波探伤确认内部是否有分层或裂纹扩展',
    remark: '',
    isOldCaliber: false,
    sourceInfo: {
      id: 'demo-exl',
      sourceType: 'excel',
      sourceRef: 'Excel台账 2024-Q2，第12行记录',
      originalData: '{"row":"12","sheet":"缺陷台账","reporter":"王巡检"}'
    }
  },
  screenshot: {
    code: 'YP-DEMO-OLD',
    location: 'middle',
    position3D: { x: 0.05, y: 2, z: -0.1 },
    crackType: 'transverse',
    riskLevel: 'low',
    status: 'confirmed',
    source: 'screenshot',
    description: '周会截图中旧记录，2022年发现的横向微裂纹，已跟踪观察2年',
    suggestion: '按旧口径为"观察类"，按新标准需复核。如确无明显扩展，可继续观察；如确认裂纹有变，需评估是否需要处理',
    remark: '从周会截图补录，原记录2022-03-15，原处理人：赵工',
    isOldCaliber: true,
    sourceInfo: {
      id: 'demo-scr',
      sourceType: 'screenshot',
      sourceRef: '周会截图 2024-06-10，第5页第5行',
      originalData: '{"oldCode":"OLD-2022-033","oldCategory":"观察类","oldStatus":"跟踪中","date":"2022-03-15"}'
    }
  }
};

type ImportStep = 'select-source' | 'upload-file' | 'preview-mapping' | 'confirm';

export const ImportDialog = ({ isOpen, onClose }: ImportDialogProps) => {
  const [step, setStep] = useState<ImportStep>('select-source');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'json' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [previewRecords, setPreviewRecords] = useState<Omit<CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>[]>([]);
  const [operator, setOperator] = useState('何工');

  const { addRecord, importRecords } = useAppStore();

  useEffect(() => {
    if (isOpen) {
      setStep('select-source');
      setSelectedSource(null);
      setFileContent('');
      setFileName('');
      setFileType(null);
      setError(null);
      setCsvResult(null);
      setMappings([]);
      setPreviewRecords([]);
      setOperator('何工');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setFileContent(content);
        
        const detectedType = detectFileType(content);
        setFileType(detectedType);

        if (detectedType === 'csv') {
          try {
            const result = parseCSV(content);
            setCsvResult(result);
            const autoMappings = autoMapFields(result.headers);
            setMappings(autoMappings);
            updatePreviewRecords(result, autoMappings);
            setStep('preview-mapping');
          } catch (csvErr) {
            setError((csvErr as Error).message);
          }
        } else {
          try {
            JSON.parse(content);
            setStep('preview-mapping');
          } catch (jsonErr) {
            setError('JSON 格式解析失败，请检查文件内容');
          }
        }
      } catch (err) {
        setError('文件读取失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  const updatePreviewRecords = (result: CSVParseResult, currentMappings: FieldMapping[]) => {
    if (!selectedSource) return;
    
    const records = result.rows.map((row, idx) => 
      mapRowToRecord(
        row, 
        currentMappings, 
        selectedSource, 
        fileName, 
        parseInt(row.__rowNumber) || idx + 2
      )
    );
    setPreviewRecords(records);
  };

  const updateMapping = (sourceField: string, targetField: string) => {
    if (!csvResult) return;

    const newMappings = mappings.filter(m => m.sourceField !== sourceField);
    if (targetField) {
      newMappings.push({ sourceField, targetField, isCustom: true });
    }
    setMappings(newMappings);
    updatePreviewRecords(csvResult, newMappings);
  };

  const handleImportDemo = () => {
    if (!selectedSource) return;
    
    const demoRecord = DEMO_DATA[selectedSource as keyof typeof DEMO_DATA];
    if (demoRecord) {
      const recordWithSource = {
        ...demoRecord,
        sourceInfo: {
          ...demoRecord.sourceInfo,
          importTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          importOperator: operator
        }
      };
      addRecord(recordWithSource);
      onClose();
    }
  };

  const handleImportFile = () => {
    if (!fileContent || !selectedSource) {
      setError('请先选择数据来源和文件');
      return;
    }

    try {
      if (fileType === 'json') {
        const data = JSON.parse(fileContent);
        const records = (Array.isArray(data) ? data : [data]).map((r: any) => ({
          ...r,
          source: selectedSource,
          sourceInfo: {
            ...r.sourceInfo,
            sourceType: selectedSource,
            sourceFile: fileName,
            importTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            importOperator: operator
          }
        }));
        importRecords(records);
      } else if (fileType === 'csv' && csvResult) {
        const records = previewRecords.map(r => ({
          ...r,
          sourceInfo: {
            ...r.sourceInfo,
            importTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
            importOperator: operator
          }
        }));
        importRecords(records);
      }
      onClose();
    } catch (err) {
      setError('导入失败，请检查数据格式');
    }
  };

  const steps = [
    { id: 'select-source', label: '选择来源' },
    { id: 'upload-file', label: '上传文件' },
    { id: 'preview-mapping', label: '预览映射' },
    { id: 'confirm', label: '确认导入' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">导入数据</h3>
            {selectedSource && (
              <p className="text-sm text-gray-400 mt-0.5">
                来源：{IMPORT_SOURCES.find(s => s.type === selectedSource)?.label}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  idx <= currentStepIndex 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-dark-700 text-gray-500'
                }`}>
                  {idx < currentStepIndex ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  idx <= currentStepIndex ? 'text-white' : 'text-gray-500'
                }`}>{s.label}</span>
                {idx < steps.length - 1 && (
                  <ArrowRight className={`w-4 h-4 mx-4 ${
                    idx < currentStepIndex ? 'text-primary-500' : 'text-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'select-source' && (
            <div>
              <p className="text-sm text-gray-400 mb-4">
                选择数据来源类型，支持导入 JSON/CSV 格式文件，或使用演示数据快速体验
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {IMPORT_SOURCES.map(source => (
                  <button
                    key={source.type}
                    onClick={() => {
                      setSelectedSource(source.type);
                      setStep('upload-file');
                    }}
                    className={`p-4 rounded-lg text-left transition-all border-2 ${
                      selectedSource === source.type
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-transparent bg-dark-800/50 hover:bg-dark-700/50'
                    }`}
                  >
                    <source.icon className={`w-6 h-6 mb-2 ${source.color}`} />
                    <p className="text-sm font-medium text-white">{source.label}</p>
                    <p className="text-xs text-gray-500">{source.desc}</p>
                  </button>
                ))}
              </div>

              <div className="relative flex items-center justify-center py-2 mb-4">
                <div className="absolute inset-x-0 top-1/2 border-t border-dark-600" />
                <span className="relative bg-dark-800/90 px-3 text-xs text-gray-500">或者</span>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-2">操作人</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 mb-3"
                  placeholder="请输入操作人姓名"
                />
              </div>
            </div>
          )}

          {step === 'upload-file' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2">上传文件</label>
                <label className="flex flex-col items-center justify-center gap-3 w-full py-8 px-4 border-2 border-dashed border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm text-white font-medium">
                      {fileName ? fileName : '点击选择文件'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      支持 {selectedSource === 'excel' ? '.csv' : '.json, .csv'} 格式
                    </p>
                  </div>
                  <input
                    type="file"
                    accept={selectedSource === 'excel' ? '.csv' : '.json,.csv'}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                {fileContent && (
                  <p className="text-xs text-success-400 mt-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    已选择文件，大小: {fileContent.length} 字节，类型: {fileType?.toUpperCase()}
                  </p>
                )}
              </div>

              {fileType === 'csv' && csvResult && (
                <div className="bg-dark-800/50 rounded-lg p-3">
                  <p className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary-400" />
                    CSV 预览（共 {csvResult.rowCount} 行数据）
                  </p>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          {csvResult.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1 text-left text-gray-400 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvResult.rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-b border-white/5">
                            {csvResult.headers.map((h, hi) => (
                              <td key={hi} className="px-2 py-1 text-gray-300">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-x-0 top-1/2 border-t border-dark-600" />
                <span className="relative bg-dark-800/90 px-3 text-xs text-gray-500">或者</span>
              </div>

              <button
                onClick={() => setShowDemoConfirm(true)}
                className="w-full py-2 px-4 bg-warning-600 hover:bg-warning-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                导入演示数据（快速体验）
              </button>
            </div>
          )}

          {step === 'preview-mapping' && csvResult && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary-400" />
                    字段映射（已自动匹配，可手动调整）
                  </p>
                  <span className="text-xs text-gray-500">
                    共 {csvResult.rowCount} 条数据
                  </span>
                </div>

                <div className="bg-dark-800/50 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-dark-700/50 text-xs text-gray-400 font-medium">
                    <div className="col-span-5">CSV 表头</div>
                    <div className="col-span-1 text-center">→</div>
                    <div className="col-span-5">目标字段</div>
                    <div className="col-span-1 text-center">状态</div>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {csvResult.headers.map((header, idx) => {
                      const mapping = mappings.find(m => m.sourceField === header);
                      const matched = !!mapping;
                      const isRequired = CSV_TARGET_FIELDS.some(f => 
                        f.field === mapping?.targetField && f.required
                      );

                      return (
                        <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-white/5 items-center hover:bg-white/5">
                          <div className="col-span-5 text-sm text-white">
                            {header}
                          </div>
                          <div className="col-span-1 text-center">
                            <ArrowRight className={`w-4 h-4 mx-auto ${matched ? 'text-primary-400' : 'text-gray-600'}`} />
                          </div>
                          <div className="col-span-5">
                            <select
                              value={mapping?.targetField || ''}
                              onChange={(e) => updateMapping(header, e.target.value)}
                              className="w-full px-2 py-1 bg-dark-700 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-primary-500"
                            >
                              <option value="">-- 不映射 --</option>
                              {CSV_TARGET_FIELDS.map(field => (
                                <option key={field.field} value={field.field}>
                                  {field.label} {field.required && '*'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-1 text-center">
                            {matched ? (
                              <Check className={`w-4 h-4 mx-auto ${
                                isRequired ? 'text-success-400' : 'text-primary-400'
                              }`} />
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary-400" />
                  映射后数据预览
                </p>
                <div className="bg-dark-800/50 rounded-lg overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-dark-700/50">
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">编号</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">部位</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">类型</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">风险</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">坐标</th>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">来源行</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRecords.slice(0, 5).map((r, ri) => (
                        <tr key={ri} className="border-b border-white/5">
                          <td className="px-3 py-2 text-white font-mono">{r.code}</td>
                          <td className="px-3 py-2 text-gray-300">
                            {{ root: '叶根', middle: '叶中', tip: '叶尖' }[r.location]}
                          </td>
                          <td className="px-3 py-2 text-gray-300">
                            {{ transverse: '横向', longitudinal: '纵向', mesh: '网状', suspected: '疑似' }[r.crackType]}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              r.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                              r.riskLevel === 'medium' ? 'bg-warning-500/20 text-warning-400' :
                              'bg-success-500/20 text-success-400'
                            }`}>
                              {{ high: '高', medium: '中', low: '低' }[r.riskLevel]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-300 font-mono text-xs">
                            {r.position3D.x.toFixed(1)}, {r.position3D.y.toFixed(1)}, {r.position3D.z.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">
                            {r.sourceInfo.sourceRow}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewRecords.length > 5 && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      ... 还有 {previewRecords.length - 5} 条
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview-mapping' && fileType === 'json' && (
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-primary-400" />
                  JSON 数据预览
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  文件包含 {(() => {
                    try {
                      const data = JSON.parse(fileContent);
                      return Array.isArray(data) ? `${data.length} 条记录` : '1 条记录';
                    } catch {
                      return '解析中...';
                    }
                  })()}
                </p>
                <pre className="text-xs text-gray-300 bg-dark-900/50 p-3 rounded overflow-x-auto max-h-60">
                  {fileContent.slice(0, 500)}
                  {fileContent.length > 500 && '...'}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex gap-3 justify-between items-center">
          <div>
            {step !== 'select-source' && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-400">操作人:</span>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-24 px-2 py-1 bg-dark-800 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-primary-500"
                />
              </label>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (step === 'select-source') {
                  onClose();
                } else if (step === 'upload-file') {
                  setStep('select-source');
                } else if (step === 'preview-mapping') {
                  setStep('upload-file');
                }
              }}
              className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
            >
              {step === 'select-source' ? '取消' : '上一步'}
            </button>
            
            {step === 'upload-file' && fileContent && (
              <button
                onClick={() => setStep('preview-mapping')}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
              >
                下一步
              </button>
            )}
            
            {(step === 'preview-mapping' || (step === 'upload-file' && fileType === 'json' && fileContent)) && (
              <button
                onClick={handleImportFile}
                className="px-4 py-2 rounded-lg bg-success-600 hover:bg-success-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                导入 {previewRecords.length > 0 ? `${previewRecords.length} 条` : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {showDemoConfirm && selectedSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="glass rounded-xl p-6 max-w-sm w-full mx-4">
            <h4 className="text-base font-semibold text-white mb-2">确认导入演示数据</h4>
            <p className="text-sm text-gray-300 mb-4">
              将导入一条
              <span className="text-warning-400 font-medium mx-1">
                {IMPORT_SOURCES.find(s => s.type === selectedSource)?.label}
              </span>
              类型的演示记录，用于快速体验功能。确定要继续吗？
            </p>
            <p className="text-xs text-gray-500 mb-4">
              操作人: <span className="text-white">{operator}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDemoConfirm(false)}
                className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImportDemo}
                className="px-4 py-2 rounded-lg bg-warning-600 hover:bg-warning-500 text-white text-sm font-medium transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
