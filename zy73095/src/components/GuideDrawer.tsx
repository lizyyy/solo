import { CircleHelp, X, Folder, Play, Eye, CheckCircle2, ExternalLink } from 'lucide-react';
import { useReviewStore } from '@/store/reviewStore';

const STEPS = [
  {
    no: 1,
    icon: Folder,
    title: '样例数据放哪',
    body: (
      <ul className="space-y-1.5 list-disc list-inside text-eng-dim text-xs leading-relaxed">
        <li>
          分区/版本/材料/历史 四份样例数据都在 <code className="font-mono bg-eng-bg px-1 border border-eng-border text-eng-line">src/data/mockData.ts</code>
        </li>
        <li>每个分区 id 对应对象的 <code className="font-mono bg-eng-bg px-1 border border-eng-border">materials</code> 数组就是关联材料</li>
        <li>
          <code className="font-mono bg-eng-bg px-1 border border-eng-border">VERSIONS</code> 里的 <code className="font-mono bg-eng-bg px-1 border border-eng-border">coordinateOffset</code> 非 0 即触发顶部偏移预警
        </li>
        <li>
          需要替换真实项目数据时，保持 <code className="font-mono bg-eng-bg px-1 border border-eng-border">types/index.ts</code> 的字段结构不变即可
        </li>
      </ul>
    ),
  },
  {
    no: 2,
    icon: Play,
    title: '怎么重跑复核',
    body: (
      <ol className="space-y-1.5 list-decimal list-inside text-eng-dim text-xs leading-relaxed">
        <li>
          <code className="font-mono bg-eng-bg px-1 border border-eng-border">pnpm install</code> 安装依赖（已完成可跳过）
        </li>
        <li>
          <code className="font-mono bg-eng-bg px-1 border border-eng-border">pnpm dev</code> 启动本地开发，浏览器打开 <span className="text-eng-line font-mono">http://localhost:5173</span>
        </li>
        <li>默认自动加载最新版，页面摘要右上角会显示当前版本与结论</li>
        <li>依次点击左侧时间轴的 5 个版本节点，观察哪些分区发生了变化</li>
        <li>关闭/打开左侧三类材料开关，对比摘要数字联动变化</li>
        <li>点选任意分区 → 右侧滑出详情 → "补录备注" → 填写后观察结论和底部历史</li>
      </ol>
    ),
  },
  {
    no: 3,
    icon: Eye,
    title: '页面摘要去哪看',
    body: (
      <ul className="space-y-1.5 list-disc list-inside text-eng-dim text-xs leading-relaxed">
        <li>右上角固定卡片 <span className="text-eng-warn">「页面摘要」</span>，任何操作后会立即刷新</li>
        <li>4 个关键数字：<span className="font-mono">总分区 / 已复核 / 待定 / 驳回</span>，下方显示整体结论</li>
        <li>
          「影响结论的关键材料来源」标签云直接告诉你：<span className="text-src-cad">CAD 旧版</span>/
          <span className="text-src-add">后补备注</span>/<span className="text-src-oral">口头备注</span> 三类各拉低了多少次结论
        </li>
        <li>顶部红色预警条出现时，说明当前版本坐标偏移，摘要结论旁会标注"仅供参考"</li>
        <li>
          点选分区后摘要卡片底部会多出「已选分区」行，点击 <span className="text-eng-line">追溯历史</span> 可查看该分区改判时间线
        </li>
      </ul>
    ),
  },
];

const BAD_PATTERN_CHECKS = [
  {
    q: '顶部出现红色坐标偏移条怎么办？',
    a: '点「补材清单」→ 按 1→2→3 顺序补材料 → 再切换到后续版本（如 v2024.05.08）看修正结果',
  },
  {
    q: '分不清是 CAD 旧版还是口头备注影响了结论？',
    a: '点选对应分区 → 展开右侧详情 → 最底部「结论影响链」分来源列出所有影响结论的材料',
  },
  {
    q: '补录备注后结论变了，去哪看改判前后的差异？',
    a: '摘要卡点「追溯历史」→ 底部面板按时间线列出，每条左右分栏：旧材料快照 vs 新备注，并写明改判原因',
  },
  {
    q: '某分区显示"未复核"是什么意思？',
    a: '当前筛选开关组合下，这个分区没有任何匹配的可见材料。打开对应的来源开关即可恢复。',
  },
];

export default function GuideDrawer() {
  const { showGuideDrawer, toggleGuideDrawer } = useReviewStore();

  return (
    <>
      <button
        onClick={() => toggleGuideDrawer(true)}
        className="fixed bottom-4 right-4 z-[60] w-12 h-12 rounded-full bg-eng-line border-2 border-blue-300 flex items-center justify-center text-white shadow-panel hover:bg-blue-600 transition-all"
        title="接手人操作指引（样例/重跑/摘要入口）"
      >
        <CircleHelp size={22} />
      </button>

      <div
        className={`fixed inset-0 z-[70] transition-opacity ${
          showGuideDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(2,6,23,0.7)' }}
        onClick={() => toggleGuideDrawer(false)}
      />

      <aside
        className={`fixed right-0 top-0 bottom-0 z-[80] w-[520px] max-w-full eng-panel overflow-hidden flex flex-col transition-transform ${
          showGuideDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="px-5 py-3 border-b border-eng-border flex items-center justify-between bg-eng-line/10">
          <div>
            <div className="text-base font-bold text-eng-text flex items-center gap-2">
              <CircleHelp size={18} className="text-eng-line" /> 接手人操作指引
            </div>
            <div className="text-[11px] text-eng-muted mt-0.5">
              「消防分区图纸复核」三分钟上手 · 仅 3 步即可照做
            </div>
          </div>
          <button onClick={() => toggleGuideDrawer(false)} className="eng-btn py-1 px-2">
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <section
                key={s.no}
                className="border-2 border-eng-border p-4 relative"
                style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}
              >
                <div className="absolute -left-3 -top-3 w-8 h-8 flex items-center justify-center bg-eng-line border-2 border-blue-300 text-white font-bold font-mono text-sm">
                  {s.no}
                </div>
                <div className="flex items-center gap-2 mb-3 ml-4">
                  <Icon size={16} className="text-eng-line" />
                  <h3 className="font-bold text-eng-text">{s.title}</h3>
                </div>
                {s.body}
              </section>
            );
          })}

          <section className="border-2 border-eng-warn/50 p-4 space-y-3 bg-eng-warn/5">
            <div className="flex items-center gap-2 text-eng-warn font-bold text-sm">
              <ExternalLink size={15} /> 坏材料来了怎么看（FAQ）
            </div>
            {BAD_PATTERN_CHECKS.map((c, i) => (
              <div key={i} className="border border-eng-border p-2.5 text-xs">
                <div className="text-eng-warn font-mono mb-1">Q{i + 1}. {c.q}</div>
                <div className="text-eng-dim leading-relaxed">
                  <CheckCircle2 size={11} className="inline mr-1 text-eng-pass" />
                  {c.a}
                </div>
              </div>
            ))}
          </section>
        </div>

        <footer className="px-5 py-3 border-t border-eng-border text-[10px] text-eng-muted font-mono flex items-center justify-between">
          <span>README.md 内附快速启动命令</span>
          <span>快捷键：右下 ? 随时打开本指引</span>
        </footer>
      </aside>
    </>
  );
}
