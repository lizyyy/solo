import ReportPreview from '../components/export/ReportPreview';

export default function Export() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream-100 tracking-tight">
          报告导出
        </h1>
        <p className="text-cream-400/70 mt-2">
          生成人类可读摘要和结构化明细，支持多种格式导出，便于存档和同事交接
        </p>
      </div>

      <ReportPreview />
    </div>
  );
}
