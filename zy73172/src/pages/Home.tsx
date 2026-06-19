import TopBar from '@/components/TopBar';
import PathGraph from '@/components/PathGraph';
import RecordLedger from '@/components/RecordLedger';
import DetailDrawer from '@/components/DetailDrawer';
import { Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-6 space-y-6">
        <div className="bg-gradient-to-r from-ink-50 to-paper-100 border border-ink-200/60 rounded-lg px-5 py-4 flex items-start gap-3">
          <Sparkles size={18} className="text-ochre-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink-700 leading-relaxed">
            <p className="font-medium text-ink-800 mb-1">教研编辑使用说明</p>
            <p className="text-ink-600">
              点击路径图上的<span className="text-ink-800 font-medium">节点</span>可筛选下方台账记录；
              点击<span className="text-ink-800 font-medium">记录卡片</span>可展开明细抽屉查看学生作答与归因详情；
              所有操作自动保存到本地，刷新或重新打开浏览器不丢失进度。
            </p>
          </div>
        </div>

        <PathGraph />
        <RecordLedger />

        <footer className="text-center text-xs text-ink-400 pt-2 pb-4">
          <p>
            图论路径错题归因 · 教研工作台 · 数据持久化存储于本地浏览器
          </p>
        </footer>
      </main>

      <DetailDrawer />
    </div>
  );
}
