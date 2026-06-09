import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Terminal, RotateCcw, Camera, Code, ChevronRight, ArrowLeft } from 'lucide-react';
import { fetchGuide, type GuideData } from '@/lib/api';
import Empty from '@/components/Empty';

const SECTIONS = [
  { id: 'start', title: '启动指引', icon: Terminal },
  { id: 'rerun', title: '重跑方式', icon: RotateCcw },
  { id: 'shots', title: '截图规范', icon: Camera },
  { id: 'api', title: '接口速览', icon: Code },
];

function extractCmd(line: string) {
  const idx = line.indexOf(':');
  if (idx === -1) return { label: '', cmd: line };
  return { label: line.slice(0, idx).trim(), cmd: line.slice(idx + 1).trim() };
}

function highlightCmd(cmd: string) {
  const parts: { t: string; c?: string }[] = [];
  const tokens = cmd.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.trim()) { parts.push({ t: tok }); continue; }
    if (i === 0 || /^(pnpm|npm|node|npx|tsc|vite|nodemon|concurrently)$/.test(tok)) {
      parts.push({ t: tok, c: 'text-orange-400' });
    } else if (/^(install|run|build|check|--noEmit|-p|dev|client:dev|server:dev|preview|lint)$/.test(tok) || tok.startsWith('-')) {
      parts.push({ t: tok, c: 'text-orange-300' });
    } else {
      parts.push({ t: tok });
    }
  }
  return parts;
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-bg-border bg-black/60 shadow-inner">
      <div className="flex items-center gap-1.5 border-b border-bg-border/60 bg-bg-elevated/50 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 font-mono text-xs text-slate-500">Terminal</span>
      </div>
      <div className="space-y-1 p-4 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          const { label, cmd } = extractCmd(line);
          const parts = highlightCmd(cmd);
          return (
            <div key={i} className="flex gap-3">
              <span className="w-5 shrink-0 text-right text-slate-600 select-none">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {label && <span className="mr-3 text-slate-500"># {label}</span>}
                <span className="text-brand-400">$ </span>
                {parts.map((p, j) => (
                  <span key={j} className={p.c || 'text-slate-300'}>{p.t}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GuidePage() {
  const [data, setData] = useState<GuideData | null>(null);
  const [active, setActive] = useState('start');

  useEffect(() => {
    fetchGuide().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => {
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= 120 && r.bottom >= 120) { setActive(s.id); break; }
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [data]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-bg-border bg-bg-soft/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3 text-sm">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"><ArrowLeft className="h-4 w-4" />返回首页</Link>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-slate-200 font-medium">上手文档</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6 lg:flex lg:gap-8">
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6 space-y-1">
            <div className="mb-3 flex items-center gap-2 px-3">
              <BookOpen className="h-4 w-4 text-brand-500" />
              <span className="font-display font-semibold text-white">文档目录</span>
            </div>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => scrollTo(s.id)} className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active === s.id ? 'bg-brand-600/20 text-brand-300 border-l-2 border-brand-500' : 'text-slate-400 hover:bg-bg-card hover:text-slate-200 border-l-2 border-transparent'}`}>
                  <Icon className="h-3.5 w-3.5" />{s.title}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1 max-w-3xl space-y-12">
          {!data ? (
            <Empty title="文档加载中..." />
          ) : (
            <>
              <section id="start" className="scroll-mt-20">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-md bg-brand-600/20 p-2"><Terminal className="h-5 w-5 text-brand-400" /></div>
                  <h2 className="font-display text-2xl font-bold text-white">启动指引</h2>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-slate-400">按顺序执行以下命令完成项目初始化与服务启动。首次运行建议使用 <code className="font-mono text-orange-400">pnpm</code> 以获得更快的安装速度。</p>
                <CodeBlock lines={data.启动命令} />
              </section>

              <section id="rerun" className="scroll-mt-20">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-md bg-orange-500/20 p-2"><RotateCcw className="h-5 w-5 text-orange-400" /></div>
                  <h2 className="font-display text-2xl font-bold text-white">重跑方式</h2>
                </div>
                <ol className="space-y-3 text-sm leading-relaxed text-slate-300">
                  {data.重跑方式.map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-xs font-bold text-slate-400 border border-bg-border">{i + 1}</span>
                      <span className="pt-0.5">{t}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 rounded-lg border border-brand-500/20 bg-brand-500/5 p-4">
                  <p className="text-xs text-brand-300"><b>小贴士：</b>补完备注后再次提交复核意见，系统会自动保留旧版本记录并生成新的 V(n+1) 历史，不会覆盖原有留痕。所有版本均可在「历史对比」页并排查看差异。</p>
                </div>
              </section>

              <section id="shots" className="scroll-mt-20">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-md bg-green-500/20 p-2"><Camera className="h-5 w-5 text-green-400" /></div>
                  <h2 className="font-display text-2xl font-bold text-white">截图说明规范</h2>
                </div>
                <div className="space-y-4 text-sm leading-relaxed text-slate-300">
                  <h3 className="font-display text-base font-semibold text-white">命名规则</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
                    {data.截图规范.slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  <h3 className="pt-2 font-display text-base font-semibold text-white">口径绑定逻辑</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
                    {data.截图规范.slice(2, 4).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  <h3 className="pt-2 font-display text-base font-semibold text-white">文件与页面对照</h3>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
                    {data.截图规范.slice(4).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                    <p className="text-xs text-green-300"><b>最佳实践：</b>建议在 CAD 截图时就对文件进行规范命名，如 <code className="font-mono text-orange-400">喷淋主管_A-3交5-6轴_碰撞.jpg</code>，后续批量上传时可直接匹配图层和规范编号，减少手动操作。</p>
                  </div>
                </div>
              </section>

              <section id="api" className="scroll-mt-20">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-md bg-purple-500/20 p-2"><Code className="h-5 w-5 text-purple-400" /></div>
                  <h2 className="font-display text-2xl font-bold text-white">接口速览</h2>
                </div>
                <div className="overflow-hidden rounded-lg border border-bg-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg-elevated text-slate-400">
                      <tr>
                        <th className="px-4 py-2.5 font-medium uppercase tracking-wider">方法</th>
                        <th className="px-4 py-2.5 font-medium uppercase tracking-wider">路径</th>
                        <th className="px-4 py-2.5 font-medium uppercase tracking-wider">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bg-border bg-bg-card">
                      {data.接口速览.map((line, i) => {
                        const [method, ...rest] = line.split(/\s+/);
                        const path = rest.shift() || '';
                        const desc = rest.join(' ');
                        const color = /^GET$/.test(method) ? 'text-green-400 bg-green-500/10' : /^POST$/.test(method) ? 'text-blue-400 bg-blue-500/10' : /^PUT$/.test(method) ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10';
                        return (
                          <tr key={i} className="hover:bg-bg-elevated/40 transition">
                            <td className="px-4 py-2.5"><span className={`inline-block w-14 rounded px-2 py-0.5 text-center font-mono text-[10px] font-bold ${color}`}>{method}</span></td>
                            <td className="px-4 py-2.5 font-mono text-slate-300">{path}</td>
                            <td className="px-4 py-2.5 text-slate-400">{desc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
