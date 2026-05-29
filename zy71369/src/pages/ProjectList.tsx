import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageStore } from '../store/pageStore';
import { useBubbleStore } from '../store/bubbleStore';
import { useIssueStore } from '../store/issueStore';
import { initMockData } from '../data/mockData';
import { formatDateTime } from '../utils/helpers';
import { BookOpen, FileText, AlertTriangle, Clock, Plus, Database } from 'lucide-react';

export function ProjectList() {
  const navigate = useNavigate();
  const { pages, loadPages } = usePageStore();
  const { bubbles, loadBubbles } = useBubbleStore();
  const { issues, loadIssues } = useIssueStore();

  useEffect(() => {
    loadPages();
    loadBubbles();
    loadIssues();
  }, [loadPages, loadBubbles, loadIssues]);

  const handleInitDemo = () => {
    initMockData();
    loadPages();
    loadBubbles();
    loadIssues();
  };

  const handleClearData = () => {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      localStorage.clear();
      loadPages();
      loadBubbles();
      loadIssues();
    }
  };

  const getPageStats = (pageId: string) => {
    const pageBubbles = bubbles.filter(b => b.pageId === pageId);
    const bubbleIds = pageBubbles.map(b => b.id);
    const pageIssues = issues.filter(i => bubbleIds.includes(i.bubbleId) && i.status === 'OPEN');
    const conflicts = pageBubbles.filter(b => b.hasConflict).length;
    return {
      bubbleCount: pageBubbles.length,
      issueCount: pageIssues.length,
      conflictCount: conflicts,
    };
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="text-stone-800" size={28} />
              <div>
                <h1 className="text-xl font-bold text-stone-800">漫画对白气泡检查工具</h1>
                <p className="text-sm text-stone-500">专业校稿 · 问题追溯 · 版本管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInitDemo}
                className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Database size={16} />
                加载演示数据
              </button>
              <button
                onClick={handleClearData}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                清空数据
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white py-16 text-center">
            <FileText size={48} className="mb-4 text-stone-300" />
            <h3 className="mb-2 text-lg font-medium text-stone-700">暂无漫画页面</h3>
            <p className="mb-6 text-sm text-stone-500">
              点击「加载演示数据」体验完整功能，包含重复编号、气泡重叠、台词溢出、顺序错误等测试场景
            </p>
            <button
              onClick={handleInitDemo}
              className="flex items-center gap-2 rounded-lg bg-stone-800 px-6 py-3 text-sm text-white hover:bg-stone-700 transition-colors"
            >
              <Plus size={16} />
              加载演示数据
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => {
              const stats = getPageStats(page.id);
              return (
                <div
                  key={page.id}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-stone-200 bg-white transition-all hover:shadow-lg hover:border-stone-300"
                  onClick={() => navigate(`/workbench/${page.id}`)}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                    <img
                      src={page.imageUrl}
                      alt={page.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-stone-800">第 {page.pageNumber} 页</h3>
                        <p className="text-sm text-stone-500">{page.title}</p>
                      </div>
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                        {stats.bubbleCount} 个气泡
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-sm">
                      {stats.issueCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle size={14} />
                          {stats.issueCount} 个问题
                        </span>
                      )}
                      {stats.conflictCount > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle size={14} />
                          {stats.conflictCount} 个冲突
                        </span>
                      )}
                      {stats.issueCount === 0 && stats.conflictCount === 0 && (
                        <span className="text-emerald-600">✓ 无问题</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1 text-xs text-stone-400">
                      <Clock size={12} />
                      <span>更新于 {formatDateTime(page.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-stone-800">功能说明</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h4 className="mb-2 font-medium text-stone-700">🔍 版面检测</h4>
              <p className="text-sm text-stone-500">
                自动检测气泡重叠（交叠面积 ＞ 10%），红色虚线描边高亮显示
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h4 className="mb-2 font-medium text-stone-700">📏 长度提示</h4>
              <p className="text-sm text-stone-500">
                实时估算气泡容量，台词过长时红色预警，确保排版美观
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h4 className="mb-2 font-medium text-stone-700">🔄 版本管理</h4>
              <p className="text-sm text-stone-500">
                重复编号材料自动创建新版本，绝不静默覆盖，保留完整历史追溯
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
