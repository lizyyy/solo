import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDisclosureStore } from '@/store/disclosureStore';
import { validateImportData } from '@/lib/validation';
import {
  Upload,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Home,
  PackageOpen,
  FileJson,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

export default function ImportPage() {
  const navigate = useNavigate();
  const importQuickstart = useDisclosureStore((s) => s.importQuickstart);
  const importFromJSON = useDisclosureStore((s) => s.importFromJSON);

  const [step, setStep] = React.useState<Step>(1);
  const [method, setMethod] = React.useState<'quickstart' | 'file' | null>(null);
  const [previewData, setPreviewData] = React.useState<unknown | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [errors, setErrors] = React.useState<string[]>([]);
  const [importCount, setImportCount] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);

  const handleQuickstart = () => {
    setMethod('quickstart');
    setPreviewData({ quickstart: true });
    setErrors([]);
    setStep(2);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = validateImportData(parsed);
      if (result.success) {
        setPreviewData(parsed);
        setErrors([]);
        setMethod('file');
        setStep(2);
      } else {
        setErrors(result.error.issues.map((i) => i.message));
      }
    } catch (e) {
      setErrors([`文件解析失败：${(e as Error).message}`]);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const doImport = () => {
    if (method === 'quickstart') {
      const r = importQuickstart();
      setImportCount(r.count);
    } else if (method === 'file' && previewData) {
      const r = importFromJSON(JSON.stringify(previewData));
      setImportCount(r.count);
      if (r.errors) setErrors(r.errors);
    }
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setMethod(null);
    setPreviewData(null);
    setFileName('');
    setErrors([]);
    setImportCount(0);
  };

  const stepsConfig = [
    { n: 1, label: '选择方式' },
    { n: 2, label: '预览确认' },
    { n: 3, label: '入库完成' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">材料导入</h1>
          <p className="mt-1 text-sm text-slate-500">
            导入的数据会写入统一本地数据源，主页摘要、详情确认、月底复核实时同步
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Home className="h-3.5 w-3.5" strokeWidth={2} />
          返回清单
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepsConfig.map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ring-4 transition-all',
                    step >= s.n
                      ? 'bg-orange-600 text-white ring-orange-100'
                      : 'bg-white text-slate-400 ring-slate-100'
                  )}
                >
                  {step > s.n ? <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={3} /> : s.n}
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold transition',
                    step >= s.n ? 'text-slate-900' : 'text-slate-400'
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < stepsConfig.length - 1 && (
                <ChevronRight
                  className={cn(
                    'h-5 w-5 flex-none',
                    step > s.n ? 'text-orange-500' : 'text-slate-200'
                  )}
                  strokeWidth={2.2}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {step === 1 && (
          <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <button
              onClick={handleQuickstart}
              className="group block w-full overflow-hidden rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-100/60"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
                  <Sparkles className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">小包材料试手（推荐首次体验）</h3>
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-600 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                      <PackageOpen className="h-2.5 w-2.5" strokeWidth={2.5} />
                      内置5条
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
                    会议纪要原文 → 施工经理阿乔人工改判 → 后来补上的设计院确认说明，
                    含23mm模型坐标偏移触发异常告警场景，覆盖全部功能演示。
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 flex-none text-orange-500 transition-transform group-hover:translate-x-1" strokeWidth={2.2} />
              </div>
            </button>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-6 transition-all',
                dragOver
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-slate-200 bg-slate-50/40 hover:border-blue-400 hover:bg-blue-50/40'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-md">
                  <Upload className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">上传JSON格式会议纪要</h3>
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
                      <FileJson className="h-2.5 w-2.5" strokeWidth={2.5} />
                      .json
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
                    点击选择或拖拽文件到此处，系统将按 Schema 校验字段完整性，不合法会给出详细提示。
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 flex-none text-blue-500 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" strokeWidth={2.2} />
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4" strokeWidth={2.2} />
                  数据校验错误（{errors.length} 条）
                </div>
                <ul className="ml-6 list-disc space-y-0.5 text-[12.5px] text-rose-600">
                  {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {errors.length > 5 && <li>以及其他 {errors.length - 5} 条错误...</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <FileCheck2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                导入预览
              </div>
              {method === 'quickstart' ? (
                <div className="space-y-2 text-[13.5px] leading-relaxed">
                  <p>即将导入 <span className="font-bold text-orange-700">5 条</span> 小包测试数据，涵盖以下类型：</p>
                  <ul className="ml-6 mt-2 list-disc space-y-1 text-slate-700">
                    <li>2 条待确认（含 23mm 坐标偏移的卷帘门交底 + 8mm 低偏移接合器）</li>
                    <li>1 条已确认（防火墙砌筑，含完整差异对比）</li>
                    <li>1 条待补件（防火封堵阻火圈合格证，含联系人信息）</li>
                    <li>1 条已退回（疏散指示标志，含完整撤回原因）</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2 text-[13.5px] leading-relaxed">
                  <p>文件名：<span className="font-mono font-bold text-blue-700">{fileName}</span></p>
                  <p>
                    解析记录数：
                    <span className="font-bold text-emerald-700">
                      {previewData && typeof previewData === 'object' && 'items' in previewData
                        ? `${(previewData as { items: unknown[] }).items.length} 条`
                        : '—'}
                    </span>
                  </p>
                  <p className="text-slate-500">数据格式校验通过，可入库到同一份本地数据。</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                上一步
              </button>
              <button
                onClick={doImport}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
              >
                <Upload className="h-4 w-4" strokeWidth={2.2} />
                确认入库
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-6 text-center animate-[fadeIn_0.3s_ease-out]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">导入完成</h3>
            <p className="mt-2 text-[14px] text-slate-600">
              已入库 <span className="font-bold text-orange-700">{importCount}</span> 条交底记录，
              接入同一份本地数据源。
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                再导入一批
              </button>
              <button
                onClick={() => navigate('/')}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
              >
                查看交底清单
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
