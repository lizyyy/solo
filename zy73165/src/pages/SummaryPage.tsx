import SummaryCard from "@/components/summary/SummaryCard";

export default function SummaryPage() {
  return (
    <div className="min-h-screen bg-paper py-8 px-4">
      <SummaryCard />
      <p className="text-center text-[11px] text-ink-400 mt-6">
        本页面采用打印友好布局，可直接使用浏览器打印 / 导出 PDF，用于教练间交接沟通。
      </p>
    </div>
  );
}
