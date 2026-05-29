import HistoryList from '../components/history/HistoryList';

export default function History() {
  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream-100 tracking-tight">
          历史记录
        </h1>
        <p className="text-cream-400/70 mt-2">
          查看和恢复历史筛选会话，支持同事间无缝交接
        </p>
      </div>

      <HistoryList />
    </div>
  );
}
