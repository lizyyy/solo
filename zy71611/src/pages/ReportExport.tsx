import { useState } from 'react';
import { Download, FileText, Link2 } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import type { ReportData } from '@/types/carbon';

const SECTION_OPTIONS = [
  { key: 'overview', label: '数据总览' },
  { key: 'quota', label: '配额归集' },
  { key: 'hedging', label: '锁价匹配' },
  { key: 'budget', label: '预算预警' },
];

export default function ReportExport() {
  const period = useCarbonStore((s) => s.period);
  const [sections, setSections] = useState<string[]>(['overview', 'quota', 'hedging', 'budget']);
  const [includeTrace, setIncludeTrace] = useState(true);
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/carbon/report?period=${period}&sections=${sections.join(',')}${includeTrace ? '&trace=true' : ''}`
      );
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const content = JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `碳配额履约报告_${period}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="mb-6 font-serif text-2xl text-forest-green">报告导出</h2>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">导出设置</h3>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">报告章节</p>
          <div className="flex flex-wrap gap-3">
            {SECTION_OPTIONS.map(({ key, label }) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                  sections.includes(key)
                    ? 'border-forest-green bg-forest-green-50 text-forest-green'
                    : 'border-gray-200 text-cool-gray'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.includes(key)}
                  onChange={() => toggleSection(key)}
                  className="accent-forest-green"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">包含数据追溯</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeTrace}
              onChange={(e) => setIncludeTrace(e.target.checked)}
              className="accent-forest-green"
            />
            在数值旁标注追溯标识
          </label>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">导出格式</p>
          <div className="flex gap-3">
            {(['excel', 'pdf'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-md border px-5 py-2 text-sm font-medium capitalize transition-colors ${
                  format === f
                    ? 'border-forest-green bg-forest-green text-white'
                    : 'border-gray-200 text-cool-gray hover:border-forest-green-200'
                }`}
              >
                {f === 'excel' ? 'Excel' : 'PDF'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateReport}
            disabled={generating || sections.length === 0}
            className="flex items-center gap-2 rounded-md bg-forest-green px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-green-600 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {generating ? '生成中...' : '生成预览'}
          </button>
          {report && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-md border border-forest-green bg-white px-5 py-2.5 text-sm font-medium text-forest-green transition-colors hover:bg-forest-green-50"
            >
              <Download className="h-4 w-4" />
              下载
            </button>
          )}
        </div>
      </div>

      {report && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-serif text-lg text-forest-green">报告预览</h3>
          <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-inner">
            <div className="mb-6 border-b pb-4 text-center">
              <h4 className="font-serif text-xl text-forest-green">碳配额履约资金报告</h4>
              <p className="mt-1 text-sm text-cool-gray">报告期: {period}</p>
              <p className="text-xs text-cool-gray">生成时间: {report.generatedAt}</p>
            </div>
            {report.sections.map((section, i) => (
              <div key={i} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <h5 className="font-serif text-base text-forest-green">{section.title}</h5>
                  {section.traceable && includeTrace && (
                    <span className="trace-badge">
                      <Link2 className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
