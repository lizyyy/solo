import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { ArrowLeft, Palette, Check, XCircle, AlertTriangle, Info } from 'lucide-react';

function HueBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full rounded-full" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}>
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border border-bg-primary shadow-md" style={{ left: `${(value / 360) * 100}%` }} />
    </div>
  );
}

function SaturationBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full rounded-full" style={{ background: 'linear-gradient(to right, #808080, #ff0000)' }}>
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border border-bg-primary shadow-md" style={{ left: `${value}%` }} />
    </div>
  );
}

function LightnessBar({ value }: { value: number }) {
  return (
    <div className="relative h-3 w-full rounded-full" style={{ background: 'linear-gradient(to right, #000000, #ffffff)' }}>
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-accent-warm rounded-full border border-bg-primary shadow-md" style={{ left: `${value}%` }} />
    </div>
  );
}

function DistanceBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 bg-bg-primary rounded-full flex-1">
        <div className="h-2 rounded-full bg-accent-warm" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-secondary w-10 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  if (severity === 'critical') return <XCircle className="w-5 h-5 text-critical" />;
  if (severity === 'warning') return <AlertTriangle className="w-5 h-5 text-warning" />;
  return <Info className="w-5 h-5 text-info" />;
}

function deltaEColor(de: number) {
  if (de < 10) return 'text-accent-green';
  if (de < 20) return 'text-warning';
  return 'text-critical';
}

export default function WorkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { works, swatches, distances, dirtyAlerts, resolveAlert } = useStore();
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const work = works.find(w => w.id === id);
  const workSwatches = swatches.filter(s => s.workId === id);
  const colorSwatches = workSwatches.filter(s => !s.isBackground);
  const bgSwatch = workSwatches.find(s => s.isBackground);

  const workDistances = distances
    .filter(d => d.workAId === id || d.workBId === id)
    .map(d => {
      const otherId = d.workAId === id ? d.workBId : d.workAId;
      const otherWork = works.find(w => w.id === otherId);
      return { ...d, otherId, otherWork };
    })
    .sort((a, b) => a.ciede2000 - b.ciede2000)
    .slice(0, 8);

  const alerts = dirtyAlerts.filter(a => a.workId === id && !a.resolved);

  if (!work) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary font-body">未找到该作品</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary font-body text-text-primary p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-card transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">{work.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-text-secondary text-sm">{work.studentName}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-bg-card text-accent-warm border border-border-custom">
                {work.themeTag}
              </span>
              {bgSwatch && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: bgSwatch.hex }} />
                  背景: {bgSwatch.colorName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-bg-secondary rounded-xl border border-border-custom p-4 space-y-4">
            {work.imageUrl ? (
              <img src={work.imageUrl} alt={work.title} className="w-full rounded-lg object-cover max-h-96" />
            ) : (
              <div className="w-full h-64 rounded-lg bg-bg-card flex flex-col items-center justify-center gap-2">
                <Palette className="w-10 h-10 text-text-secondary" />
                <p className="text-text-secondary text-sm">缺少图片</p>
                {work.status === 'incomplete' && (
                  <span className="px-2 py-0.5 rounded text-xs bg-warning/20 text-warning">待补录</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {workSwatches.map(s => (
                <div key={s.id} className="group relative">
                  <div
                    className="w-9 h-9 rounded-full border-2 border-border-custom cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: s.hex }}
                    title={`${s.colorName} (${s.hex})`}
                  />
                  {s.isBackground && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-warm rounded-full" title="背景色" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-secondary rounded-xl border border-border-custom p-4 space-y-4">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <Palette className="w-5 h-5 text-accent-warm" />
              HSL 色彩分解
            </h2>
            {colorSwatches.length === 0 ? (
              <p className="text-text-secondary text-sm">无色彩数据</p>
            ) : (
              <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
                {colorSwatches.map(s => (
                  <div key={s.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md border border-border-custom" style={{ backgroundColor: s.hex }} />
                      <span className="font-medium text-sm">{s.colorName}</span>
                      <span className="text-xs text-text-secondary">{s.hex}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary w-6">H</span>
                        <div className="flex-1"><HueBar value={s.hue} /></div>
                        <span className="text-xs text-text-secondary w-12 text-right">{s.hue.toFixed(1)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary w-6">S</span>
                        <div className="flex-1"><SaturationBar value={s.saturation} /></div>
                        <span className="text-xs text-text-secondary w-12 text-right">{s.saturation.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary w-6">L</span>
                        <div className="flex-1"><LightnessBar value={s.lightness} /></div>
                        <span className="text-xs text-text-secondary w-12 text-right">{s.lightness.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-secondary rounded-xl border border-border-custom p-4 space-y-4">
          <h2 className="text-lg font-display font-semibold">色差对比 — 最近 8 组</h2>
          {workDistances.length === 0 ? (
            <p className="text-text-secondary text-sm">无距离数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary border-b border-border-custom">
                    <th className="text-left py-2 px-3">作品</th>
                    <th className="text-left py-2 px-3">学生</th>
                    <th className="text-center py-2 px-3">ΔE</th>
                    <th className="py-2 px-3 w-32">ΔH</th>
                    <th className="py-2 px-3 w-32">ΔL</th>
                    <th className="py-2 px-3 w-32">ΔS</th>
                  </tr>
                </thead>
                <tbody>
                  {workDistances.map(d => (
                    <tr key={d.id} className="border-b border-border-custom/50 hover:bg-bg-card/30 transition-colors">
                      <td className="py-2 px-3">
                        <button onClick={() => navigate(`/work/${d.otherId}`)} className="text-accent-warm hover:underline">
                          {d.otherWork?.title ?? '—'}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{d.otherWork?.studentName ?? '—'}</td>
                      <td className={`py-2 px-3 text-center font-semibold ${deltaEColor(d.ciede2000)}`}>
                        {d.ciede2000.toFixed(2)}
                      </td>
                      <td className="py-2 px-3"><DistanceBar value={d.hueDistance} max={180} /></td>
                      <td className="py-2 px-3"><DistanceBar value={d.lightnessDistance} max={100} /></td>
                      <td className="py-2 px-3"><DistanceBar value={d.saturationDistance} max={100} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="bg-bg-secondary rounded-xl border border-border-custom p-4 space-y-3">
            <h2 className="text-lg font-display font-semibold">脏数据告警</h2>
            <div className="space-y-3">
              {alerts.map(a => (
                <div key={a.id} className="bg-bg-card/50 rounded-lg border border-border-custom overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-bg-card/80 transition-colors"
                    onClick={() => setExpandedAlert(expandedAlert === a.id ? null : a.id)}
                  >
                    <SeverityIcon severity={a.severity} />
                    <span className="flex-1 font-medium text-sm">{
                      a.issueType === 'same_color_different_name' ? '同色不同名' :
                      a.issueType === 'background_contamination' ? '背景色混入' :
                      '距离尺度错'
                    }</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.severity === 'critical' ? 'bg-critical/20 text-critical' :
                      a.severity === 'warning' ? 'bg-warning/20 text-warning' :
                      'bg-info/20 text-info'
                    }`}>
                      {a.severity}
                    </span>
                  </button>
                  {expandedAlert === a.id && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border-custom/50 pt-2">
                      <p className="text-sm text-text-secondary">{a.description}</p>
                      <p className="text-sm text-accent-warm">{a.suggestion}</p>
                      <button
                        onClick={() => resolveAlert(a.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/20 text-accent-green text-sm hover:bg-accent-green/30 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        标记已处理
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
