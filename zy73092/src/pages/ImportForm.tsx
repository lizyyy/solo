import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileJson,
  FileUp,
  Check,
  AlertTriangle,
  Sparkles,
  Trash2,
  Loader2,
  CornerDownRight,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTrackerStore } from '@/store/useTrackerStore';
import { fetcher } from '@/utils/fetcher';
import type { ImportItem, Specialty } from '@/shared/types';

const specialtyLabels: Record<Specialty, string> = {
  HVAC: '暖通',
  ELECTRICAL: '电气',
  PLUMBING: '给排水',
  FIRE: '消防',
};

const boundarySampleData: ImportItem[] = [
  {
    code: 'MEP-PL-003',
    name: 'PPR 给水管道',
    spec: 'De25, PN2.0',
    specialty: 'PLUMBING',
    submissionNo: 'SS-2024-003',
    sourceForm: '送审表-03给排水',
    handoverOpinion: '',
    submissionOpinion: '管道品牌「日丰」，PN2.0 级，出厂检测编号 RI-20240102-015。',
    oldOpinionMissing: true,
    batches: [
      { batchNo: 'B001-20240108', inspectReport: true, qualityCert: true, isMissing: false },
      { batchNo: 'B002-20240115', inspectReport: false, qualityCert: false, isMissing: true, missingReason: '供应商物流延迟' },
    ],
    isBoundarySample: true,
  },
  {
    code: 'MEP-FR-004',
    name: '喷淋头',
    spec: 'ZSTX-15, 68°C 下垂型',
    specialty: 'FIRE',
    submissionNo: 'SS-2024-004',
    sourceForm: '送审表-04消防',
    handoverOpinion: '喷淋头需提供消防产品认证，动作温度 68°C，玻璃球式。',
    submissionOpinion: '厂家「闽山消防」，CCCF 认证齐全，批次号 MS-2401-FR04。',
    oldOpinionMissing: false,
    batches: [
      { batchNo: 'B001-20240118', inspectReport: false, qualityCert: false, isMissing: true, missingReason: '质检报告缺失' },
    ],
    isBoundarySample: true,
  },
];

const boundaryNotes: Record<string, string> = {
  'MEP-PL-003': '⚠ 边界样本：交底清单意见为空（oldOpinionMissing=true），同时存在缺失批次，测试旧意见丢失检测与批次挂起的并行触发',
  'MEP-FR-004': '⚠ 边界样本：唯一批次全部缺失（isMissing=true），测试单批次缺失材料的自动挂起流程',
};

export default function ImportForm() {
  const navigate = useNavigate();
  const importPreview = useTrackerStore((s) => s.importPreview);
  const setImportPreview = useTrackerStore((s) => s.setImportPreview);
  const clearImportPreview = useTrackerStore((s) => s.clearImportPreview);

  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      clearImportPreview();
    };
  }, [clearImportPreview]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const parseFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const items: ImportItem[] = Array.isArray(json) ? json : json.items || [];
        setImportPreview(items);
        setSubmitResult(null);
      } catch (err) {
        setSubmitResult({ success: false, message: 'JSON 解析失败，请检查文件格式' });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      parseFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      parseFile(files[0]);
    }
  };

  const handleLoadSample = () => {
    setImportPreview(boundarySampleData);
    setFileName('边界样本预览（2 条）');
    setSubmitResult(null);
  };

  const handleSubmit = async () => {
    if (importPreview.length === 0) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    const res = await fetcher.post<{ imported: number; boundarySamples: number }>('/api/materials/import', {
      items: importPreview,
    });

    if (res.success) {
      const { imported, boundarySamples } = res.data || { imported: importPreview.length, boundarySamples: 0 };
      setSubmitResult({
        success: true,
        message: `导入成功！${imported} 条记录已导入${boundarySamples > 0 ? `，含 ${boundarySamples} 条边界样本` : ''}`,
      });
      setTimeout(() => {
        clearImportPreview();
        navigate('/');
      }, 800);
    } else {
      setSubmitResult({ success: false, message: res.error || `导入失败` });
    }
    setIsSubmitting(false);
  };

  const boundaryCount = importPreview.filter((i) => i.isBoundarySample).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">送审表导入</h1>
          <p className="text-sm text-slate-500 mt-1">支持 JSON 格式的送审表批量导入，自动识别边界样本并高亮</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-10 transition-all duration-200 text-center',
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors',
                dragActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
              )}
            >
              <Upload className="w-8 h-8" />
            </div>

            <div className="text-lg font-semibold text-slate-800 mb-1">
              拖拽 JSON 文件到此处，或
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 underline underline-offset-2 mx-1"
              >
                点击选择文件
              </button>
            </div>
            <div className="text-sm text-slate-500 mb-5">
              支持单文件 JSON，数组格式，字段见技术文档
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleLoadSample}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:shadow-md hover:shadow-amber-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                一键填入边界样本预览
              </button>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                内置 2 条边界样本：漏旧意见 + 批次缺失
              </div>
            </div>

            {fileName && (
              <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm">
                <FileJson className="w-4 h-4 text-blue-500" />
                <span className="font-mono text-xs">{fileName}</span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-600 font-medium">{importPreview.length} 条</span>
              </div>
            )}
          </div>
        </div>

        {submitResult && (
          <div
            className={cn(
              'mt-4 rounded-lg p-4 flex items-start gap-3',
              submitResult.success
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-rose-50 border border-rose-200'
            )}
          >
            {submitResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <span
              className={cn(
                'text-sm',
                submitResult.success ? 'text-emerald-800' : 'text-rose-800'
              )}
            >
              {submitResult.message}
            </span>
          </div>
        )}
      </div>

      {importPreview.length > 0 && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-slate-500" />
                  导入预览
                </h2>
                <span className="text-xs text-slate-500">
                  共 <span className="font-semibold text-slate-700">{importPreview.length}</span> 条记录
                </span>
                {boundaryCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <CornerDownRight className="w-3 h-3" />
                    含 {boundaryCount} 条边界样本
                  </span>
                )}
              </div>
              <button
                onClick={clearImportPreview}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition-colors px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空预览
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="text-left font-semibold px-5 py-3 text-xs">材料编号</th>
                    <th className="text-left font-semibold px-5 py-3 text-xs">名称/规格</th>
                    <th className="text-left font-semibold px-5 py-3 text-xs">专业</th>
                    <th className="text-left font-semibold px-5 py-3 text-xs">送审编号</th>
                    <th className="text-center font-semibold px-5 py-3 text-xs">批次</th>
                    <th className="text-center font-semibold px-5 py-3 text-xs">缺批次</th>
                    <th className="text-center font-semibold px-5 py-3 text-xs">旧意见缺失</th>
                    <th className="text-left font-semibold px-5 py-3 text-xs">标记</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((item, idx) => {
                    const missingBatchCount = item.batches.filter((b) => b.isMissing).length;
                    const isBoundary = !!item.isBoundarySample;
                    return (
                      <tr
                        key={item.code}
                        className={cn(
                          'border-b border-slate-100 last:border-0',
                          idx % 2 === 1 && !isBoundary && 'bg-slate-50/30',
                          isBoundary &&
                            'border-dashed border-2 border-amber-300 bg-amber-50 border-l-4 border-l-amber-500'
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <code className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">
                            {item.code}
                          </code>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900 text-xs">{item.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.spec}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {specialtyLabels[item.specialty]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-slate-600 font-mono">{item.submissionNo}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-xs text-slate-700 font-medium">{item.batches.length}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {missingBatchCount > 0 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-700">
                              {missingBatchCount}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {item.oldOpinionMissing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              缺失
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isBoundary ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
                                边界样本
                              </span>
                              {boundaryNotes[item.code] && (
                                <div className="text-[10px] text-amber-800 leading-relaxed pt-1">
                                  {boundaryNotes[item.code]}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">常规</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                clearImportPreview();
                setFileName(null);
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || importPreview.length === 0}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm',
                isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-600/20'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  确认导入 ({importPreview.length} 条)
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
