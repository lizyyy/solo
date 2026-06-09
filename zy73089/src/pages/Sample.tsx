import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DatabaseZap,
  HardHat,
  LayoutDashboard,
  History,
  Loader2,
  ArrowRight,
  FileText,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import type { SampleData } from '@/shared/types';

export function Sample() {
  const nav = useNavigate();
  const loadSampleData = useChecklistStore((s) => s.loadSampleData);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SampleData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/mock/sampleData.json')
      .then((r) => r.json())
      .then((d: SampleData) => setData(d))
      .catch(() => {});
  }, []);

  const handleLoad = () => {
    if (!data) return;
    setLoading(true);
    setTimeout(() => {
      const { batchId } = loadSampleData(data);
      setLoaded(true);
      setLastBatchId(batchId);
      setLoading(false);
      setTimeout(() => nav(`/checklist/${batchId}`), 500);
    }, 650);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <header className="border-b border-emerald-200 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                结构加固交底清单 · 样例演示
              </div>
              <div className="text-[10.5px] text-emerald-200">
                一包"像现场会收到的材料"：签证单涂改、批号磨损、坐标偏移、层数对不上
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-[12px] text-emerald-100">
            <Link to="/" className="rounded-md px-3 py-1.5 hover:bg-white/10">
              <LayoutDashboard className="inline h-3.5 w-3.5 mr-1" /> 工作台
            </Link>
            <Link to="/sample" className="rounded-md bg-white/10 px-3 py-1.5 font-bold border border-white/20">
              <DatabaseZap className="inline h-3.5 w-3.5 mr-1" /> 样例
            </Link>
            <Link to="/history" className="rounded-md px-3 py-1.5 hover:bg-white/10">
              <History className="inline h-3.5 w-3.5 mr-1" /> 历史时间线
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                一键载入样例数据包
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
                样例包模拟现场真实情况：<b>签证单编号有涂改</b>、<b>材料批号钢印磨损</b>、
                <b>构件坐标手写量错</b>、<b>碳纤维层数3层 vs 2层对不上</b>、
                <b>签证单缺签字</b> 等典型问题。系统 <b>不清洗这些脏数据</b>，原样保留，
                并把 <b>疑点 + 来源 + 暂缓原因</b> 放到同一处，阻止进入最终报告。
              </p>
            </div>
            <button
              onClick={handleLoad}
              disabled={loading || !data}
              className="flex items-center gap-2 rounded-xl border-2 border-emerald-700 bg-gradient-to-b from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-emerald-700 hover:-translate-y-0.5 active:translate-y-px disabled:from-slate-400 disabled:to-slate-500 disabled:border-slate-500 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" /> 正在跑清单…
                </>
              ) : (
                <>
                  <DatabaseZap className="h-4.5 w-4.5" />
                  载入样例并跑清单
                </>
              )}
            </button>
          </div>

          {loaded && lastBatchId && (
            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="inline h-4 w-4 mr-1" />
              已成功载入，批次 <b className="font-mono">{lastBatchId}</b>。正在跳转交底清单…
              <Link
                to={`/checklist/${lastBatchId}`}
                className="ml-2 inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700"
              >
                手动打开 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                现场签证单 · {data?.visaForms.length ?? 0} 份
              </h2>
            </div>
            <ul className="space-y-2 text-[11.5px]">
              {data?.visaForms.slice(0, 4).map((v) => (
                <li
                  key={v.visaFormId}
                  className="rounded-md border border-blue-100 bg-blue-50/50 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono font-bold text-slate-700">{v.visaNo}</div>
                    {/涂改|缺失|模糊|潦草|疑似|磨损|空/.test(v.visaNo + v.rawContent) && (
                      <span className="whitespace-nowrap rounded bg-red-100 px-1.5 py-0.5 text-[9.5px] font-bold text-red-700">
                        脏数据
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    构件 {v.componentId} · 签发 {v.issueDate}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-600 font-mono">
                    {v.rawContent.slice(0, 80)}…
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                材料送审单 · {data?.materialSubmissions.length ?? 0} 份
              </h2>
            </div>
            <ul className="space-y-2 text-[11.5px]">
              {data?.materialSubmissions.slice(0, 4).map((m) => (
                <li
                  key={m.materialId}
                  className="rounded-md border border-emerald-100 bg-emerald-50/50 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-mono font-bold text-slate-700">{m.batchNo}</div>
                    {/磨损|不清|不符|待确认/.test(m.batchNo + m.specification + m.rawContent) && (
                      <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">
                        待核对
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {m.materialName} · {m.specification}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    构件 {m.componentId} · 送审 {m.submitDate}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                模型构件 · {data?.modelComponents.length ?? 0} 个
              </h2>
            </div>
            <ul className="space-y-1.5 text-[11.5px]">
              {data?.modelComponents.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50/40 px-2 py-1.5"
                >
                  <div>
                    <MapPin className="inline h-3 w-3 mr-1 text-amber-600" />
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <span className="ml-1 text-[10px] font-mono text-slate-500">{c.id}</span>
                  </div>
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-amber-700">
                    {c.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              样例预设的关系（载入后会自动变成疑点）
            </h2>
          </div>
          <ol className="space-y-2 list-decimal list-inside text-[12px] text-slate-700">
            {(data?.expectedIssues ?? []).map((issue, i) => (
              <li
                key={i}
                className="rounded-md border border-orange-200/70 bg-white px-3 py-2 shadow-sm"
              >
                {issue}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-[12px] text-slate-600 leading-relaxed shadow-sm">
          <div className="font-bold text-slate-800 mb-1">阿乔，样例看明白这 3 件事就够用：</div>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              <b>样例</b>：点上方绿色按钮，系统会跑一个现成的批次，展示「签证单→材料送审→施工口径→模型坐标」四者关系。
            </li>
            <li>
              <b>重跑</b>：进入交底清单后，在右下备注框里写"已与监理复核"之类的话，点"补备注重跑"，会生成一个<b>新批次号</b>。
            </li>
            <li>
              <b>历史时间线</b>：跳转到历史时间线，刚才的"首次跑"和"补备注重跑"会按时间顺序排好，选择两个批次还能并排对照差异。
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
