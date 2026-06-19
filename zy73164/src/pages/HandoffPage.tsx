import { useNavigate, Link } from 'react-router-dom';
import { Boxes, AlertOctagon, Download, Route, KeyRound, FileCode2 } from 'lucide-react';
import { Card, SectionLabel, Tag, Divider } from '@/components/primitives';

export function HandoffPage() {
  const navigate = useNavigate();

  const zones = [
    {
      icon: Boxes,
      tone: 'accent' as const,
      title: '放材料',
      route: '/materials',
      body: '材料库 + 回放记录。历史答案里留了现场痕迹，空集合会标红。点某条 run 可改判、补说明、看追溯链。',
      cta: '去材料与历史',
    },
    {
      icon: AlertOctagon,
      tone: 'alert' as const,
      title: '看异常',
      route: '/anomalies',
      body: '空集合告警、除零边界（影响范围+来源行）、待复核、误差超阈。来源行汇总告诉你人眼该扫哪几行。',
      cta: '去看异常看板',
    },
    {
      icon: Download,
      tone: 'ok' as const,
      title: '重新导出',
      route: '/materials',
      body: '回放记录每行有「导出」按钮，或在控制台结果底部导出。CSV 含边界、改判理由、后补说明，token 与 runId 对应。',
      cta: '去导出 CSV',
    },
  ];

  const conventions = [
    { k: '材料', v: 'src/lib/seed.ts · 三条预设（含空集合异常、除零边界）' },
    { k: '分解引擎', v: 'src/lib/decompose.ts · LU/QR/Cholesky，边界打 // SRC 标记' },
    { k: '空集合判定', v: 'src/lib/validator.ts · emptySet=true → EMPTY_ANOMALY，不当正常输入' },
    { k: '幂等指纹', v: 'src/lib/fingerprint.ts · djb2(矩阵+方法+主元+容差)' },
    { k: '存储前缀', v: 'localStorage 键：mfpr.runs / results / overrides / notes / materials / idempotency' },
    { k: 'CSV token', v: 'run.csvToken，导出文件名 mfpr-<token>.csv' },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <SectionLabel hint="算法值班人接手即懂：哪里放材料、哪里看异常、哪里重新导出">值班交接</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {zones.map((z) => (
            <button
              key={z.title}
              type="button"
              onClick={() => navigate(z.route)}
              className="panel-hover group flex flex-col items-start gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-accent/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-accent">
                <z.icon className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-ink-100">{z.title}</span>
                <Tag tone={z.tone}>→</Tag>
              </div>
              <p className="text-xs leading-relaxed text-ink-300">{z.body}</p>
              <span className="mt-auto text-[11px] text-accent group-hover:underline">{z.cta}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel hint="讲给不看代码的人听：数字从哪来要有线索">复盘口径</SectionLabel>
        <ol className="space-y-3 text-sm text-ink-200">
          {[
            ['请求指纹', '由矩阵、分解方法、主元策略、容差四项算出。两次相同请求指纹一致 → 命中同一 run，不重复计数。'],
            ['历史答案', '区分三种：有答案可比对、正常空输入、空集合异常。空集合不再当正常输入通过。'],
            ['现场痕迹', '材料里每条都带痕迹芯片（如采样时间、设备、批次），复盘时可指认数字出处。'],
            ['来源行', '每个除零/近零边界都记 decompose.ts 的行号与影响范围（行列），替代人眼扫描。'],
            ['CSV 明细', '一个 run 对一个 csvToken；导出含因子、边界、改判理由、后补说明，重跑后不断线。'],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-[11px] text-accent">
                {i + 1}
              </span>
              <div>
                <span className="font-semibold text-ink-100">{t}</span>
                <span className="ml-2 text-ink-300">{d}</span>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <SectionLabel hint="不用问你也该知道的存放位置">约定速查</SectionLabel>
        <div className="space-y-2">
          {conventions.map((c) => (
            <div key={c.k} className="flex items-start gap-3 text-xs">
              <span className="mono mt-0.5 shrink-0 text-accent">
                <KeyRound className="inline h-3 w-3" /> {c.k}
              </span>
              <span className="text-ink-300">{c.v}</span>
            </div>
          ))}
        </div>
        <Divider className="my-4" />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Route className="h-3 w-3" />
            路由：
          </span>
          <Link to="/console" className="text-ink-300 hover:text-accent">/console</Link>
          <Link to="/materials" className="text-ink-300 hover:text-accent">/materials</Link>
          <Link to="/anomalies" className="text-ink-300 hover:text-accent">/anomalies</Link>
          <Link to="/handoff" className="text-ink-300 hover:text-accent">/handoff</Link>
          <span className="flex items-center gap-1">
            <FileCode2 className="h-3 w-3" /> 源码：src/lib/ 与 src/components/
          </span>
        </div>
      </Card>
    </div>
  );
}
