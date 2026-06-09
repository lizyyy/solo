import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet, CheckSquare, Droplets, Cylinder, Waves, TrendingUp,
  AlertTriangle, X, MapPin, Package, User, Calendar, MessageSquarePlus,
  Eye, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import { useReviewStore } from "@/store/useReviewStore";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { DrawingPointType, Anomaly, DrawingPoint } from "@/types";

const TC: Record<DrawingPointType, string> = { 雨水斗: "#2563EB", 立管: "#059669", 天沟: "#D97706", 坡度: "#7C3AED" };
const TI: Record<DrawingPointType, React.ReactNode> = { 雨水斗: <Droplets className="w-4 h-4"/>, 立管: <Cylinder className="w-4 h-4"/>, 天沟: <Waves className="w-4 h-4"/>, 坡度: <TrendingUp className="w-4 h-4"/> };
const ZB = { A: "#DBEAFE", B: "#D1FAE5", C: "#FED7AA", D: "#E9D5FF" };

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[460px] max-w-[92vw] border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <h3 className="font-display font-semibold text-slate-800 text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function DrawingReview() {
  const nav = useNavigate();
  const s = useReviewStore();
  const { drawingPoints: dps, anomalies, materials, currentOperator: op, highlightedPointId: hid, selectedAnomalyId: aid,
    setHighlightedPoint: shp, setSelectedAnomaly: ssa, confirmAnomalyNormal: can, confirmAnomalyAbnormal: caa, addSupplementNote: asn } = s;

  const [hoid, setHoid] = useState<string | null>(null);
  const [nm, setNm] = useState<{ open: boolean; mid: string | null }>({ open: false, mid: null });
  const [nc, setNc] = useState("");
  const ic = "w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

  const pa = useMemo(() => anomalies.filter(a => a.status === "待确认" || a.status === "已确认异常"), [anomalies]);
  const gpa = (id: string) => pa.find(a => a.drawingPointId === id);
  const hpc = (dp: DrawingPoint) => { shp(dp.id); const a = gpa(dp.id); if (a) ssa(a.id); };
  const hacc = (a: Anomaly) => { ssa(a.id); shp(a.drawingPointId); };
  const sn = () => { if (!nm.mid || !nc.trim()) return; asn(nm.mid, nc.trim(), op); setNm({ open: false, mid: null }); setNc(""); };
  const ap = dps.find(d => d.id === hid);
  const aa = (aid && anomalies.find(a => a.id === aid)) || (ap && gpa(ap.id)) || null;
  const am = ap ? materials.find(m => m.id === ap.materialItemId) : null;

  const gl = useMemo(() => {
    const arr: React.ReactNode[] = [];
    for (let i = 0; i <= 900; i += 50) arr.push(<line key={`vx${i}`} x1={i} y1={0} x2={i} y2={500} stroke="rgba(30,64,175,0.1)" strokeWidth={0.5}/>);
    for (let j = 0; j <= 500; j += 50) arr.push(<line key={`hy${j}`} x1={0} y1={j} x2={900} y2={j} stroke="rgba(30,64,175,0.1)" strokeWidth={0.5}/>);
    return arr;
  }, []);

  const closeNm = () => { setNm({ open: false, mid: null }); setNc(""); };

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-[1600px] mx-auto">
        <div className="card px-5 py-3.5 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">图纸复核工作台<span className="text-brand-600">·</span><span className="text-brand-700">屋面排水</span></h1>
            <p className="text-xs text-slate-500 mt-0.5">空间位置 · 异常高亮 · 送审表来源关联</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:"#2563EB"}}/>A区雨水斗</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:"#059669"}}/>B区立管</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:"#D97706"}}/>C区天沟</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:"#7C3AED"}}/>D区坡度</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"/>异常点</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav("/material-review")} className="btn btn-primary"><FileSpreadsheet className="w-4 h-4"/>查看送审表</button>
            <button className="btn"><CheckSquare className="w-4 h-4"/>人工批量确认</button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="card p-4">
              <svg viewBox="0 0 900 500" className="w-full h-auto rounded-md bg-white" style={{border:"1px solid #E2E8F0"}}>
                {gl}
                <rect x="4" y="4" width="442" height="244" rx="4" fill={ZB.A} stroke="#93C5FD" strokeWidth="1"/>
                <rect x="454" y="4" width="442" height="244" rx="4" fill={ZB.C} stroke="#FDBA74" strokeWidth="1"/>
                <rect x="4" y="256" width="442" height="240" rx="4" fill={ZB.B} stroke="#6EE7B7" strokeWidth="1"/>
                <rect x="454" y="256" width="442" height="240" rx="4" fill={ZB.D} stroke="#C4B5FD" strokeWidth="1"/>
                <line x1="450" y1="4" x2="450" y2="496" stroke="#64748B" strokeWidth="1.5" strokeDasharray="8 5"/>
                <line x1="4" y1="252" x2="896" y2="252" stroke="#64748B" strokeWidth="1.5" strokeDasharray="8 5"/>
                <text x="24" y="32" fontSize="14" fontWeight="700" fill="#1E40AF">A 区</text>
                <text x="474" y="32" fontSize="14" fontWeight="700" fill="#92400E">C 区</text>
                <text x="24" y="284" fontSize="14" fontWeight="700" fill="#065F46">B 区</text>
                <text x="474" y="284" fontSize="14" fontWeight="700" fill="#6D28D9">D 区</text>
                <rect x="2" y="2" width="896" height="496" rx="6" fill="none" stroke="#1E293B" strokeWidth="2"/>
                <path d="M 500 60 Q 680 160 850 220" stroke="#D97706" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.85"/>
                <text x="620" y="120" fontSize="11" fill="#92400E" fontWeight="600">≡ 天沟主路径 ≡</text>
                <rect x="370" y="310" width="26" height="120" fill="none" stroke="#059669" strokeWidth="6" rx="2"/>
                <text x="360" y="298" fontSize="10" fill="#065F46" fontWeight="600">立管·模型</text>
                <rect x="433" y="310" width="26" height="120" fill="none" stroke="#DC2626" strokeWidth="5" strokeDasharray="6 4" rx="2"/>
                <text x="423" y="298" fontSize="10" fill="#991B1B" fontWeight="600">现场位置 ↷2.1m</text>
                <path d="M 396 370 L 433 370" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arr)"/>
                <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" fill="#DC2626"/></marker></defs>
                <rect x="610" y="120" width="110" height="70" fill="#FCA5A5" fillOpacity="0.55" stroke="#DC2626" strokeWidth="2" strokeDasharray="4 3" rx="3"/>
                <text x="665" y="160" fontSize="11" fill="#991B1B" fontWeight="700" textAnchor="middle">#3风机基础</text>
                <text x="665" y="176" fontSize="10" fill="#991B1B" fontWeight="600" textAnchor="middle">⚠ 碰撞区</text>

                {dps.map(dp => {
                  const cx = (dp.x / 100) * 900, cy = (dp.y / 100) * 500, anomaly = gpa(dp.id);
                  const isH = hid === dp.id, baseR = anomaly ? 10 : 8, sc = isH ? 1.3 : 1, color = TC[dp.type];
                  return (
                    <g key={dp.id} style={{cursor:"pointer"}} onClick={() => hpc(dp)} onMouseEnter={() => setHoid(dp.id)} onMouseLeave={() => setHoid(null)} transform={`translate(${cx},${cy}) scale(${sc})`}>
                      {anomaly && <circle className="animate-pulse-ring" r={baseR} fill="none" stroke="#DC2626" strokeWidth="3" style={{transformOrigin:"center"}}/>}
                      {isH && <circle r={baseR + 6} fill="none" stroke="#F59E0B" strokeWidth="2.5"/>}
                      <circle r={baseR} fill={anomaly ? "#DC2626" : color} stroke="#fff" strokeWidth="2"/>
                      {anomaly && <foreignObject x={-7} y={-7} width={14} height={14}><div className="w-full h-full flex items-center justify-center text-white"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5}/></div></foreignObject>}
                      <text x={0} y={baseR + 16} fontSize="10.5" fontWeight="600" textAnchor="middle" fill={anomaly ? "#991B1B" : "#1E293B"}>{dp.name.split(" ").slice(-1)[0]}</text>
                      {anomaly && (<>
                        <line x1={0} y1={baseR} x2={0} y2={baseR + 26} stroke="#DC2626" strokeWidth="1" strokeDasharray="2 2"/>
                        <g transform={`translate(0,${baseR + 28})`}>
                          <rect x={-52} y={0} width={104} height={16} rx={3} fill="#FEE2E2" stroke="#DC2626" strokeWidth="1"/>
                          <text x={0} y={11} fontSize="9" fill="#991B1B" fontWeight="600" textAnchor="middle">⚠ {anomaly.type}</text>
                        </g>
                      </>)}
                    </g>
                  );
                })}
                {hoid && (() => {
                  const dp = dps.find(p => p.id === hoid); if (!dp) return null;
                  const x = (dp.x / 100) * 900, y = (dp.y / 100) * 500;
                  return <foreignObject x={x + 14} y={y - 20} width={180} height={60}>
                    <div className="bg-slate-800 text-white text-[11px] rounded px-2 py-1.5 shadow-lg whitespace-normal leading-tight">
                      <div className="font-semibold mb-0.5">{dp.name}</div>
                      <div className="opacity-80">{dp.description}</div>
                    </div></foreignObject>;
                })()}
              </svg>
            </div>

            <div className="card mt-4 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600"/>异常快速列表<span className="badge badge-danger">{pa.length}</span></h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {pa.map(a => {
                  const dp = dps.find(p => p.id === a.drawingPointId);
                  const act = aid === a.id || hid === a.drawingPointId;
                  return (
                    <div key={a.id} onClick={() => hacc(a)} className={cn("flex-shrink-0 w-60 p-3 rounded-md border cursor-pointer transition-all", act ? "border-red-400 bg-red-50 shadow-md" : "border-slate-200 bg-white hover:border-red-300 hover:shadow-sm")}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono font-semibold text-red-700">{a.id}</span>
                        <StatusBadge type="severity" value={a.severity}/>
                      </div>
                      <div className="text-sm font-medium text-slate-800 mb-1">{a.type}</div>
                      <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3"/>{dp?.name || "未知点位"}</div>
                      <StatusBadge type="anomaly" value={a.status}/>
                    </div>
                  );
                })}
                {pa.length === 0 && <div className="text-sm text-slate-400 py-4 text-center w-full">✅ 当前无待确认异常</div>}
              </div>
            </div>
          </div>

          <div className="w-[380px] flex-shrink-0">
            <div className="card overflow-hidden" style={{height:"calc(100vh - 150px)"}}>
              <div className="h-full overflow-y-auto">
                {ap ? (<div className="p-4 space-y-4">
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{background: TC[ap.type]}}>{TI[ap.type]}</div>
                      <div><div className="font-semibold text-slate-800">{ap.name}</div><div className="text-xs text-slate-500">{ap.zone} 区 · 点位</div></div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">类型</span><span className="font-medium text-slate-700">{ap.type}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">分区</span><span className="font-medium text-slate-700">{ap.zone} 区</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">相对坐标</span><span className="font-mono text-xs text-slate-700">({ap.x}%, {ap.y}%)</span></div>
                      {ap.description && <div className="pt-2 border-t border-slate-200"><div className="text-slate-500 text-xs mb-1">点位说明</div><div className="text-slate-700 text-xs leading-relaxed">{ap.description}</div></div>}
                    </div>
                  </div>

                  {am && (<div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-brand-50 border-b border-brand-100 flex items-center gap-2"><Package className="w-4 h-4 text-brand-700"/><span className="text-sm font-semibold text-brand-800">关联送审表行</span></div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">编号</span><span className="font-mono text-xs text-slate-700">{am.code}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">名称</span><span className="font-medium text-slate-700">{am.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">规格</span><span className="text-slate-700">{am.spec}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">批次</span><span className="text-slate-700">{am.batch}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">供应商</span><span className="text-slate-700">{am.supplier}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">数量</span><span className="text-slate-700">{am.qty}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">状态</span><StatusBadge type="material" value={am.status}/></div>
                      <div className="flex justify-between"><span className="text-slate-500">行类型</span><span className={cn("badge text-xs", am.sourceRowType === "标准行" ? "badge-info" : "badge-warn")}>{am.sourceRowType}</span></div>
                      {am.remark && <div className="pt-2 border-t border-slate-200"><div className="text-slate-500 text-xs mb-1">备注</div><div className="text-slate-700 text-xs leading-relaxed">{am.remark}</div></div>}
                    </div>
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                      <button onClick={() => nav("/material-review")} className="btn btn-primary flex-1 !px-3 !py-1.5 text-xs"><Eye className="w-3.5 h-3.5"/>在送审表中查看</button>
                      <button onClick={() => setNm({ open: true, mid: am.id })} className="btn btn-warn !px-3 !py-1.5 text-xs"><MessageSquarePlus className="w-3.5 h-3.5"/>补录备注</button>
                    </div>
                  </div>)}

                  {aa && (<div className="card-anomaly rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-700"/><span className="text-sm font-semibold text-red-800">关联异常</span><span className="ml-auto font-mono text-xs text-red-700">{aa.id}</span></div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">类型</span><span className="font-medium text-red-700">{aa.type}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">严重程度</span><StatusBadge type="severity" value={aa.severity}/></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500">状态</span><StatusBadge type="anomaly" value={aa.status}/></div>
                      <div className="pt-2 border-t border-red-100"><div className="text-slate-500 text-xs mb-1">异常描述</div><div className="text-slate-700 text-xs leading-relaxed">{aa.description}</div></div>
                      {aa.confirmedBy && <div className="pt-2 border-t border-red-100 space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-slate-500 flex items-center gap-1"><User className="w-3 h-3"/>确认人</span><span className="text-slate-700">{aa.confirmedBy}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3"/>确认时间</span><span className="text-slate-700">{aa.confirmedAt}</span></div>
                      </div>}
                    </div>
                    <div className="px-4 py-3 bg-red-50/50 border-t border-red-200 flex items-center gap-2">
                      <button onClick={() => can(aa.id)} className="btn btn-success flex-1 !px-2 !py-1.5 text-xs"><CheckCircle2 className="w-3.5 h-3.5"/>确认正常</button>
                      <button onClick={() => caa(aa.id)} className="btn btn-danger flex-1 !px-2 !py-1.5 text-xs"><XCircle className="w-3.5 h-3.5"/>标记异常</button>
                      <button onClick={() => setNm({ open: true, mid: aa.materialItemId })} className="btn btn-warn !px-2 !py-1.5 text-xs" title="后补备注"><MessageSquarePlus className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>)}
                </div>) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 px-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><MapPin className="w-8 h-8 text-slate-400"/></div>
                    <div className="text-sm font-medium text-slate-500 mb-1">请选择图纸点位</div>
                    <div className="text-xs text-slate-400 text-center leading-relaxed">点击左侧 SVG 图上的任意点位<br/>查看详细信息与关联异常</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={nm.open} title="后补备注" onClose={closeNm}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1.5">备注内容</label>
            <textarea value={nc} onChange={e => setNc(e.target.value)} rows={5} placeholder="请输入需要补充的说明..." className={cn(ic, "resize-none")}/></div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeNm} className="btn">取消</button>
            <button onClick={sn} disabled={!nc.trim()} className="btn btn-warn disabled:opacity-50 disabled:cursor-not-allowed"><ExternalLink className="w-4 h-4"/>提交备注</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
