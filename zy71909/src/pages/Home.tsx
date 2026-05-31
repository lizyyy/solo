import { Header } from '../components/Layout/Header';
import { Timeline } from '../components/Layout/Timeline';
import { Sidebar } from '../components/Layout/Sidebar';
import { StatCards } from '../components/Dashboard/StatCards';
import { TrendChart } from '../components/Dashboard/TrendChart';
import { Heatmap } from '../components/Dashboard/Heatmap';
import { DetailModal } from '../components/DeviationDetail/DetailModal';
import { EntryPanel } from '../components/DataEntry/EntryPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <Header />
      
      <div className="flex h-[calc(100vh-80px)]">
        <Timeline />
        
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-5xl mx-auto">
            <StatCards />
            <TrendChart />
            <Heatmap />
            
            <div className="mt-8 p-6 bg-white/60 rounded-2xl border border-cream-200">
              <h3 className="font-serif text-lg font-semibold text-primary mb-4">使用说明</h3>
              <div className="grid grid-cols-2 gap-6 text-sm text-primary-600">
                <div>
                  <h4 className="font-medium text-primary mb-2">📊 查看数据</h4>
                  <ul className="space-y-1 text-primary-500">
                    <li>• 左侧时间线可快速切换排练批次</li>
                    <li>• 点击热力图单元格查看偏差详情</li>
                    <li>• 趋势图可查看各声部历史表现</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-primary mb-2">⚠️ 异常标记</h4>
                  <ul className="space-y-1 text-primary-500">
                    <li>• 转调批次数据不参与平均值计算</li>
                    <li>• 学生换声部后3次排练标记为适应期</li>
                    <li>• 录音缺失的小节会自动标记为异常</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-primary mb-2">🏷️ 偏差分类</h4>
                  <ul className="space-y-1 text-primary-500">
                    <li>• <span className="text-deviation-severe">持续跑偏</span>：连续3次偏差＞50音分</li>
                    <li>• <span className="text-deviation-mild">偶发失误</span>：单次偏差＞50音分</li>
                    <li>• <span className="text-deviation-unreviewed">未复核</span>：偏差＞30音分待确认</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-primary mb-2">💾 导出报告</h4>
                  <ul className="space-y-1 text-primary-500">
                    <li>• 支持导出PDF格式小报</li>
                    <li>• 支持导出文本格式报告</li>
                    <li>• 数据自动保存在浏览器本地</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <DetailModal />
      <Sidebar />
      <EntryPanel />
    </div>
  );
}
