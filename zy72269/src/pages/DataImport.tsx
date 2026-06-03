import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, AlertTriangle, CheckCircle2, ArrowRight, Database } from 'lucide-react';
import type { MaterialType, ImportPreviewResult, SelfCheckReport } from '@/types';
import { useAppStore } from '@/store';
import { parseInspectionFile, validateBeforeImport, canImport } from '@/services/importService';
import { runAllChecks } from '@/services/selfCheckService';
import { detectZAxisAbnormalitiesInMarks } from '@/services/zAxisDetectionService';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import MarkTable from '@/components/features/MarkTable';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';
import { getMaterialTypeLabel } from '@/utils/fileParser';

export default function DataImport() {
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const createTask = useAppStore((state) => state.createTask);
  const setCurrentTask = useAppStore((state) => state.setCurrentTask);
  const addMarks = useAppStore((state) => state.addMarks);
  const addAbnormality = useAppStore((state) => state.addAbnormality);
  const addSelfCheckReport = useAppStore((state) => state.addSelfCheckReport);
  const updateTask = useAppStore((state) => state.updateTask);
  const setIsLoading = useAppStore((state) => state.setIsLoading);
  const importPreview = useAppStore((state) => state.importPreview);
  const setImportPreview = useAppStore((state) => state.setImportPreview);
  const selectMark = useAppStore((state) => state.selectMark);
  const selectedMarkId = useAppStore((state) => state.selectedMarkId);

  const [materialType, setMaterialType] = useState<MaterialType>('normal');
  const [validationReports, setValidationReports] = useState<SelfCheckReport[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'validate' | 'complete'>('upload');

  const materialTypes: { value: MaterialType; label: string; description: string; color: string }[] = [
    { value: 'normal', label: '正常材料', description: '标准巡检数据，无特殊标记', color: 'border-accent-success text-accent-success' },
    { value: 'wrong_diameter', label: '错口径材料', description: '管径可能存在错误的数据', color: 'border-accent-warning text-accent-warning' },
    { value: 'supplementary', label: '补录材料', description: '后续补充录入的数据', color: 'border-accent-info text-accent-info' }
  ];

  const handleFileUpload = useCallback(async (file: File) => {
    if (!currentTask) {
      const task = createTask({
        taskNo: `TASK-${Date.now().toString().slice(-6)}`,
        projectName: file.name.replace(/\.[^/.]+$/, ''),
        inspector: '许工'
      });
      setCurrentTask(task.id);
    }

    setIsLoading(true);
    setUploadedFileName(file.name);

    try {
      const result = await parseInspectionFile(file, materialType, currentTask?.id || '');

      setImportPreview({
        marks: result.marks,
        rawNotes: result.rawNotes,
        rawContent: result.rawContent,
        warnings: result.warnings
      });

      if (currentTask) {
        updateTask(currentTask.id, {
          rawMaterials: [...currentTask.rawMaterials, result.rawMaterial]
        });
      }

      setStep('preview');
    } catch (error) {
      console.error('File parsing error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTask, materialType, createTask, setCurrentTask, setImportPreview, updateTask, setIsLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleValidate = async () => {
    if (!importPreview || !currentTask) return;

    setIsLoading(true);
    setStep('validate');

    try {
      const importValidation = await validateBeforeImport(importPreview.marks, currentTask.marks);
      const selfCheckReports = await runAllChecks(currentTask, {
        checkExportConsistency: false
      });

      const allReports = [...importValidation, ...selfCheckReports];
      setValidationReports(allReports);

      importValidation.forEach(r => addSelfCheckReport(currentTask.id, { ...r, taskId: currentTask.id }));
      selfCheckReports.forEach(r => addSelfCheckReport(currentTask.id, r));

      if (canImport(importValidation)) {
        const abnormalities = detectZAxisAbnormalitiesInMarks(importPreview.marks);
        abnormalities.forEach(a => addAbnormality(currentTask.id, a));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview || !currentTask) return;

    const importValidation = validationReports.filter(r => r.checkType === 'duplicate_import');
    if (!canImport(importValidation)) return;

    addMarks(currentTask.id, importPreview.marks);
    setStep('complete');
  };

  const handleReset = () => {
    setImportPreview(null);
    setValidationReports([]);
    setUploadedFileName('');
    setStep('upload');
  };

  if (!currentTask && step === 'upload') {
    return (
      <div className="space-y-6">
        <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">数据导入</h1>
        <Card className="text-center py-12">
          <Database size={48} className="mx-auto text-primary-500 mb-4" />
          <p className="text-primary-300 mb-4">请先创建或选择一个巡检任务</p>
          <Link to="/">
            <Button variant="primary">返回首页创建任务</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">数据导入</h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            第 {step === 'upload' ? 1 : step === 'preview' ? 2 : step === 'validate' ? 3 : 4} 步，共 4 步
          </p>
        </div>
        {currentTask && (
          <Badge variant="default">
            {currentTask.taskNo} - {currentTask.projectName}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 mb-8">
        {['upload', 'preview', 'validate', 'complete'].map((s, idx) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-10 h-10 border-2 font-mono ${
              step === s ? 'bg-primary-500 border-primary-400 text-white' :
              ['upload', 'preview', 'validate', 'complete'].indexOf(step) > idx ?
              'bg-accent-success/20 border-accent-success text-accent-success' :
              'border-primary-600 text-primary-500'
            }`}>
              {['upload', 'preview', 'validate', 'complete'].indexOf(step) > idx ? <CheckCircle2 size={18} /> : idx + 1}
            </div>
            <span className={`ml-2 font-mono text-sm ${
              step === s ? 'text-primary-200' : 'text-primary-500'
            }`}>
              {{ upload: '选择材料', preview: '预览数据', validate: '执行自检', complete: '完成导入' }[s]}
            </span>
            {idx < 3 && <div className="flex-1 h-0.5 mx-4 bg-primary-700" />}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <Card title="选择材料类型">
            <div className="grid grid-cols-3 gap-4">
              {materialTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setMaterialType(type.value)}
                  className={`p-4 border-2 cursor-pointer transition-all ${
                    materialType === type.value
                      ? `${type.color} bg-primary-700/30 shadow-glow`
                      : 'border-primary-700 text-primary-400 hover:border-primary-500'
                  }`}
                >
                  <h4 className="font-mono text-sm font-semibold mb-1">{type.label}</h4>
                  <p className="text-xs">{type.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="上传文件">
            <div
              className={`border-2 border-dashed p-12 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-primary-400 bg-primary-700/30'
                  : 'border-primary-600 hover:border-primary-500 hover:bg-primary-800/30'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <Upload size={48} className={`mx-auto mb-4 ${isDragging ? 'text-primary-300' : 'text-primary-500'}`} />
              <p className="text-primary-200 mb-2">拖拽文件到此处，或点击选择文件</p>
              <p className="text-sm text-primary-400">支持 CSV、Excel、JSON 格式</p>
              <input
                id="fileInput"
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            {uploadedFileName && (
              <div className="mt-4 p-3 bg-primary-800/50 border border-primary-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-primary-400" />
                  <span className="font-mono text-sm text-primary-200">{uploadedFileName}</span>
                  <Badge variant={
                    materialType === 'normal' ? 'success' :
                    materialType === 'wrong_diameter' ? 'warning' : 'info'
                  }>
                    {getMaterialTypeLabel(materialType)}
                  </Badge>
                </div>
                <Button variant="primary" onClick={(e) => { e.stopPropagation(); document.getElementById('fileInput')?.click(); }}>
                  重新选择
                </Button>
              </div>
            )}
          </Card>

          {importPreview && (
            <div className="flex justify-end gap-4">
              <Button variant="secondary" onClick={handleReset}>取消</Button>
              <Button variant="primary" onClick={() => setStep('preview')}>
                下一步 <ArrowRight size={16} className="ml-2 inline" />
              </Button>
            </div>
          )}
        </div>
      )}

      {(step === 'preview' || step === 'validate' || step === 'complete') && importPreview && (
        <div className="space-y-6">
          <Card title="导入预览">
            {importPreview.warnings.length > 0 && (
              <div className="mb-4 p-4 bg-accent-warning/10 border border-accent-warning/30">
                <h5 className="font-mono text-sm text-accent-warning mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> 导入警告
                </h5>
                <ul className="text-sm text-primary-300 space-y-1">
                  {importPreview.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-primary-800/30 p-4 text-center border border-primary-700">
                <p className="font-mono text-2xl font-bold text-primary-200">{importPreview.marks.length}</p>
                <p className="text-xs text-primary-400">巡检标记</p>
              </div>
              <div className="bg-primary-800/30 p-4 text-center border border-primary-700">
                <p className="font-mono text-2xl font-bold text-primary-200">
                  {importPreview.marks.filter(m => m.isObstacle).length}
                </p>
                <p className="text-xs text-primary-400">障碍物</p>
              </div>
              <div className="bg-primary-800/30 p-4 text-center border border-primary-700">
                <p className="font-mono text-2xl font-bold text-primary-200">{importPreview.rawNotes.length}</p>
                <p className="text-xs text-primary-400">原始备注</p>
              </div>
              <div className="bg-primary-800/30 p-4 text-center border border-primary-700">
                <p className="font-mono text-2xl font-bold text-accent-warning">
                  {importPreview.rawNotes.filter(n => n.isAmbiguous).length}
                </p>
                <p className="text-xs text-primary-400">存疑备注</p>
              </div>
            </div>

            <MarkTable
              marks={importPreview.marks}
              selectedMarkId={selectedMarkId}
              onSelectMark={selectMark}
            />

            {importPreview.rawNotes.length > 0 && (
              <div className="mt-6">
                <h5 className="font-mono text-sm font-semibold text-primary-300 mb-3">原始备注汇总</h5>
                <OriginalNoteDisplay notes={importPreview.rawNotes.slice(0, 5)} />
                {importPreview.rawNotes.length > 5 && (
                  <p className="text-sm text-primary-400 mt-2">还有 {importPreview.rawNotes.length - 5} 条备注...</p>
                )}
              </div>
            )}
          </Card>

          {step === 'preview' && (
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep('upload')}>返回</Button>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={handleReset}>取消</Button>
                <Button variant="primary" onClick={handleValidate}>
                  执行自检并导入 <ArrowRight size={16} className="ml-2 inline" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(step === 'validate' || step === 'complete') && validationReports.length > 0 && (
        <Card title="自检结果">
          <div className="space-y-4">
            {validationReports.map((report, idx) => (
              <div
                key={idx}
                className={`p-4 border-2 ${
                  report.result === 'pass' ? 'border-accent-success/30 bg-accent-success/10' :
                  report.result === 'warning' ? 'border-accent-warning/30 bg-accent-warning/10' :
                  'border-accent-warning/50 bg-accent-warning/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {report.result === 'pass' ? (
                      <CheckCircle2 className="text-accent-success" size={20} />
                    ) : (
                      <AlertTriangle className="text-accent-warning" size={20} />
                    )}
                    <span className="font-mono text-sm text-primary-200">
                      {{
                        duplicate_import: '重复导入检查',
                        z_axis_check: 'Z轴方向检查',
                        recalculation: '补录后重算',
                        export_consistency: '导出一致性检查'
                      }[report.checkType]}
                    </span>
                  </div>
                  <Badge variant={
                    report.result === 'pass' ? 'success' : 'warning'
                  }>
                    {report.result === 'pass' ? '通过' : report.result === 'warning' ? '警告' : '失败'}
                  </Badge>
                </div>
                <p className="text-sm text-primary-300">{report.details}</p>
              </div>
            ))}
          </div>

          {step === 'validate' && (
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" onClick={() => setStep('preview')}>返回预览</Button>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={handleReset}>取消</Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmImport}
                  disabled={!canImport(validationReports.filter(r => r.checkType === 'duplicate_import'))}
                >
                  确认导入 <ArrowRight size={16} className="ml-2 inline" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 'complete' && (
        <Card className="text-center py-12">
          <CheckCircle2 size={64} className="mx-auto text-accent-success mb-4" />
          <h3 className="font-mono text-xl text-primary-100 mb-2">导入成功</h3>
          <p className="text-primary-300 mb-6">
            成功导入 {importPreview?.marks.length || 0} 条巡检标记，
            保留 {importPreview?.rawNotes.length || 0} 条原始备注
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="secondary" onClick={handleReset}>继续导入</Button>
            <Link to="/replay">
              <Button variant="primary">
                查看路径回放 <ArrowRight size={16} className="ml-2 inline" />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
