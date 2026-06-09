import { useRef, useState } from "react";
import {
  Upload,
  FileDown,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useReconcileStore } from "@/store/useReconcileStore";
import { parseScheduleCsv, buildSampleCsvContent } from "@/utils/csvParser";
import type { Schedule } from "@/types";

export default function ImportCenter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { importCsvSchedules, addMedicalRecord } = useReconcileStore();

  const [csvResult, setCsvResult] = useState<{
    fileName: string;
    rows: {
      petName: string;
      courseName: string;
      courseDate: string;
      durationMin: number;
      trainer: string;
      sourceRow: string;
    }[];
    warnings: string[];
  } | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const [medical, setMedical] = useState({
    petName: "",
    visitDate: new Date(2026, 5, 5).toISOString().slice(0, 10),
    diagnosis: "",
    treatment: "",
    veterinarian: "",
    includeSample: true,
  });
  const [medicalFeedback, setMedicalFeedback] = useState<string | null>(null);

  const onPickFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { schedules, warnings } = parseScheduleCsv(text);
      setCsvResult({
        fileName: f.name,
        rows: schedules as unknown as typeof csvResult extends infer T
          ? T extends { rows: infer R }
            ? R
            : never
          : never,
        warnings,
      });
      setCsvFeedback(null);
    };
    reader.readAsText(f);
  };

  const onConfirmImport = () => {
    if (!csvResult) return;
    const { added, skipped } = importCsvSchedules({
      fileName: csvResult.fileName,
      rows: csvResult.rows,
    });
    setCsvFeedback(`已完成：新增 ${added} 条${skipped ? `，重复跳过 ${skipped} 条` : ""}`);
  };

  const onDownloadSample = () => {
    const blob = new Blob([buildSampleCsvContent()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "训练课排程-样例.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSubmitMedical = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medical.petName.trim()) {
      setMedicalFeedback("请填写病历上的宠物名");
      return;
    }
    if (!medical.diagnosis.trim()) {
      setMedicalFeedback("请填写诊断内容");
      return;
    }
    const { medicalId, sampleScheduleId } = addMedicalRecord({
      petName: medical.petName.trim(),
      visitDate: medical.visitDate,
      diagnosis: medical.diagnosis.trim(),
      treatment: medical.treatment.trim(),
      veterinarian: medical.veterinarian.trim() || "未填写",
      includeSampleNormal: medical.includeSample,
    });
    setMedicalFeedback(
      medical.includeSample
        ? `已录入病历 #${medicalId.slice(-4)}，并附带一条正常记录 ${
            sampleScheduleId ? `#${sampleScheduleId.slice(-4)}` : ""
          } 用于对照确认逻辑`
        : `已录入病历 #${medicalId.slice(-4)}`
    );
    setMedical({
      petName: "",
      visitDate: medical.visitDate,
      diagnosis: "",
      treatment: "",
      veterinarian: "",
      includeSample: true,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="card p-6 space-y-4">
        <SectionHeader
          title="导入训练课CSV明细"
          desc="表头建议：宠物名 / 课程名称 / 上课日期 / 时长(分钟) / 训导师"
          icon={Upload}
          tone="brand"
        />

        <div
          className="card-dashed flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = "";
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-sm font-medium text-warm-800 mb-1">
            点击或拖拽 CSV 文件到这里
          </div>
          <div className="text-xs text-warm-500 mb-3">
            解析在本地浏览器完成，不上传到服务器
          </div>
          <button type="button" className="btn-secondary" onClick={onDownloadSample}>
            <FileDown className="w-4 h-4" />
            下载样例CSV
          </button>
        </div>

        {csvResult && (
          <div className="space-y-3 animate-fadeUp">
            {csvResult.warnings.length > 0 && (
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 text-xs text-brand-800 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> 解析提示
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {csvResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-warm-500">
                文件：<b className="text-warm-800">{csvResult.fileName}</b> ·
                解析出 <b className="text-brand-700">{csvResult.rows.length}</b> 条
              </span>
              <button
                className="btn-primary !py-1.5 !px-3 text-xs"
                onClick={onConfirmImport}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                确认导入
              </button>
            </div>

            <div className="rounded-xl border border-warm-200 overflow-hidden">
              <div className="max-h-64 overflow-y-auto scroll-thin">
                <table className="w-full text-xs">
                  <thead className="bg-warm-50 sticky top-0">
                    <tr>
                      <th className="table-head px-3 py-2">宠物名</th>
                      <th className="table-head px-3 py-2">课程</th>
                      <th className="table-head px-3 py-2">日期</th>
                      <th className="table-head px-3 py-2 text-right">时长</th>
                      <th className="table-head px-3 py-2">训导师</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100">
                    {csvResult.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-warm-50">
                        <td className="px-3 py-2 font-medium text-warm-800">
                          {r.petName}
                        </td>
                        <td className="px-3 py-2">{r.courseName}</td>
                        <td className="px-3 py-2">{r.courseDate}</td>
                        <td className="px-3 py-2 text-right">{r.durationMin}m</td>
                        <td className="px-3 py-2">{r.trainer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {csvFeedback && (
          <div className="rounded-xl bg-success-50 border border-success-200 p-3 text-xs text-success-700 flex items-center gap-2 animate-fadeUp">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {csvFeedback} · 去
            <a className="underline" href="#/schedules">
              排程明细
            </a>
            查看
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4" id="medical">
        <SectionHeader
          title="录入手写病历单"
          desc="少量录入即可，会自动附带一条正常排程样例方便看确认逻辑"
          icon={FileText}
          tone="success"
        />

        <form onSubmit={onSubmitMedical} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="病历上的宠物名 *" required>
              <input
                className="form-input"
                placeholder="例如：黄黄 / 黑妞"
                value={medical.petName}
                onChange={(e) => setMedical({ ...medical, petName: e.target.value })}
              />
            </Field>
            <Field label="就诊日期 *">
              <input
                type="date"
                className="form-input"
                value={medical.visitDate}
                onChange={(e) => setMedical({ ...medical, visitDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="诊断 *">
            <textarea
              className="form-input min-h-[64px]"
              placeholder="例如：皮肤常规检查，少量皮屑"
              value={medical.diagnosis}
              onChange={(e) => setMedical({ ...medical, diagnosis: e.target.value })}
            />
          </Field>
          <Field label="处置/治疗">
            <textarea
              className="form-input min-h-[56px]"
              placeholder="例如：外用抗真菌喷剂，每周2次"
              value={medical.treatment}
              onChange={(e) => setMedical({ ...medical, treatment: e.target.value })}
            />
          </Field>
          <Field label="接诊医生">
            <input
              className="form-input"
              placeholder="例如：陈医生"
              value={medical.veterinarian}
              onChange={(e) => setMedical({ ...medical, veterinarian: e.target.value })}
            />
          </Field>

          <label className="flex items-start gap-2 rounded-xl bg-brand-50 border border-brand-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-600"
              checked={medical.includeSample}
              onChange={(e) => setMedical({ ...medical, includeSample: e.target.checked })}
            />
            <div className="text-xs space-y-0.5">
              <div className="font-medium text-brand-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                附带一条正常训练课记录
              </div>
              <div className="text-brand-700 leading-relaxed">
                建议保留勾选，这样在「排程明细」里能立刻看到一条关联了当前病历的待确认排程，方便接班人体会确认逻辑。
              </div>
            </div>
          </label>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-warm-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              如果病历里写了别名，系统会自动识别并放到异常区。
            </div>
            <button type="submit" className="btn-success">
              <FileText className="w-4 h-4" />
              确认录入
            </button>
          </div>
        </form>

        {medicalFeedback && (
          <div className="rounded-xl bg-success-50 border border-success-200 p-3 text-xs text-success-700 flex items-center gap-2 animate-fadeUp">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {medicalFeedback}
          </div>
        )}
      </section>

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 10px;
          border: 1px solid #e7e5e4;
          background: white;
          font-size: 0.875rem;
          color: #44403c;
          outline: none;
          transition: border-color .15s;
        }
        .form-input:focus { border-color: #d97706; }
      `}</style>
    </div>
  );
}

function SectionHeader({
  title,
  desc,
  icon: Icon,
  tone,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "success";
}) {
  const toneMap = {
    brand: "bg-brand-100 text-brand-700",
    success: "bg-success-100 text-success-700",
  };
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${toneMap[tone]}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="font-serif text-lg font-semibold text-warm-800">{title}</h2>
        <p className="text-xs text-warm-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs text-warm-600 mb-1.5">
        {label}
        {required && <span className="text-danger-600 ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
