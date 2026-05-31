import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, Map, ClipboardCheck, Activity,
  ChevronDown, ChevronUp, CheckCircle, XCircle, Clock,
  AlertTriangle, X,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { AnomalyTag, Confirmation, ConfirmationStatus, EvidenceType, InspectionPhoto, KmlRoute, FlightReview } from "@/types";
import {
  MapContainer, TileLayer, Polyline, Circle, Popup,
} from "react-leaflet";
import L from "leaflet";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, ResponsiveContainer,
} from "recharts";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" });

const ANOMALY_LABEL: Record<AnomalyTag, string> = {
  battery_cycle_error: "电池循环错算",
  nofly_zone_edge: "禁飞区擦边",
  rth_point_lost: "返航点丢失",
  other: "其他",
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: "正常", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  pending: { label: "待确认", color: "text-amber-400", bg: "bg-amber-500/15" },
  abnormal: { label: "异常", color: "text-red-400", bg: "bg-red-500/15" },
};

function Panel({ title, icon: Icon, children, defaultOpen = true, id }: {
  title: string; icon: typeof Camera; children: React.ReactNode; defaultOpen?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="rounded-lg border border-white/5 bg-[#16213e]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <Icon className="h-4 w-4 text-amber-400" />{title}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {open && <div className="border-t border-white/5 px-4 py-3">{children}</div>}
    </div>
  );
}

function PhotoPanel({ photos }: { photos: InspectionPhoto[] }) {
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  if (photos.length === 0) return <p className="text-center text-sm text-gray-500 py-6">暂无巡检照片</p>;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className="group cursor-pointer" onClick={() => setModalIdx(i)}>
            <div className="aspect-video overflow-hidden rounded-md bg-gray-800">
              <img src={p.thumbnailUrl} alt={p.fileName} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
            </div>
            <p className="mt-1 truncate font-mono text-xs text-gray-500">{p.fileName}</p>
          </div>
        ))}
      </div>

      {modalIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setModalIdx(null)}>
          <div className="relative max-h-[85vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModalIdx(null)} className="absolute -right-2 -top-2 z-10 rounded-full bg-[#16213e] p-1.5 text-gray-300 hover:text-white"><X className="h-5 w-5" /></button>
            {modalIdx > 0 && <button onClick={() => setModalIdx(modalIdx - 1)} className="absolute left-[-40px] top-1/2 -translate-y-1/2 rounded-full bg-[#16213e] p-2 text-gray-300 hover:text-white">‹</button>}
            {modalIdx < photos.length - 1 && <button onClick={() => setModalIdx(modalIdx + 1)} className="absolute right-[-40px] top-1/2 -translate-y-1/2 rounded-full bg-[#16213e] p-2 text-gray-300 hover:text-white">›</button>}
            <img src={photos[modalIdx].fullImageUrl} alt={photos[modalIdx].fileName} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain" />
            <p className="mt-2 text-center font-mono text-xs text-gray-400">{photos[modalIdx].fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KmlPanel({ kmlRoute }: { kmlRoute: KmlRoute | undefined }) {
  if (!kmlRoute) return <p className="text-center text-sm text-gray-500 py-6">暂无航线数据</p>;

  const center: [number, number] = kmlRoute.coordinates.length > 0
    ? [kmlRoute.coordinates[0][0], kmlRoute.coordinates[0][1]]
    : [31.23, 121.47];

  return (
    <div>
      <div className="h-80 overflow-hidden rounded-md">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          <Polyline positions={kmlRoute.coordinates as [number, number][]} color="#10b981" weight={3} />
          {kmlRoute.swapPoints.map((sp) => (
            <Circle key={sp.id} center={[sp.lat, sp.lng]} radius={20} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.6 }}>
              <Popup>
                <div className="text-xs">
                  <p>换电点</p>
                  <p>海拔: {sp.altitude}m</p>
                  <p>时间: {new Date(sp.timestamp).toLocaleString("zh-CN")}</p>
                </div>
              </Popup>
            </Circle>
          ))}
          {kmlRoute.noflyZones.map((nz) => (
            <Circle key={nz.id} center={[nz.centerLat, nz.centerLng]} radius={nz.radiusMeters} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.12, weight: 2, dashArray: "6" }}>
              <Popup>
                <div className="text-xs">
                  <p>禁飞区</p>
                  <p>最近距离: {nz.minDistance}m</p>
                </div>
              </Popup>
            </Circle>
          ))}
          {kmlRoute.rthPoint && (
            <Circle center={[kmlRoute.rthPoint.lat, kmlRoute.rthPoint.lng]} radius={15} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.7 }}>
              <Popup><div className="text-xs"><p>返航点</p></div></Popup>
            </Circle>
          )}
        </MapContainer>
      </div>
      {!kmlRoute.rthPoint && (
        <div className="mt-2 flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> 返航点丢失
        </div>
      )}
      <p className="mt-2 font-mono text-xs text-gray-500">{kmlRoute.fileName}</p>
    </div>
  );
}

const CONF_STATUS_ICON: Record<ConfirmationStatus, typeof CheckCircle> = {
  confirmed: CheckCircle, rejected: XCircle, pending: Clock,
};
const CONF_STATUS_COLOR: Record<ConfirmationStatus, string> = {
  confirmed: "text-green-400", rejected: "text-red-400", pending: "text-amber-400",
};
const CONF_STATUS_LABEL: Record<ConfirmationStatus, string> = {
  confirmed: "已确认", rejected: "已驳回", pending: "待确认",
};

function ConfirmationPanel({ confirmations, sortieId, onAdd }: { confirmations: Confirmation[]; sortieId: string; onAdd: (c: Confirmation) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [formStatus, setFormStatus] = useState<ConfirmationStatus>("confirmed");
  const [formEvType, setFormEvType] = useState<EvidenceType>("photo");
  const [formEvId, setFormEvId] = useState("");
  const [formNote, setFormNote] = useState("");

  const handleSubmit = async () => {
    if (!formEvId.trim()) return;
    const c: Confirmation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      sortieId,
      status: formStatus,
      evidenceType: formEvType,
      evidenceId: formEvId.trim(),
      operator: "外场队长",
      timestamp: Date.now(),
      note: formNote.trim(),
    };
    await onAdd(c);
    setShowForm(false);
    setFormEvId("");
    setFormNote("");
  };

  return (
    <div>
      {confirmations.length === 0 && !showForm && (
        <p className="text-center text-sm text-gray-500 py-4">暂无确认记录</p>
      )}
      <div className="space-y-3">
        {confirmations.map((c) => {
          const Icon = CONF_STATUS_ICON[c.status];
          return (
            <div key={c.id} className="flex items-start gap-3 rounded-lg bg-[#0f0f23] p-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${CONF_STATUS_COLOR[c.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className={CONF_STATUS_COLOR[c.status]}>{CONF_STATUS_LABEL[c.status]}</span>
                  <span className="text-gray-500">{c.operator}</span>
                  <span className="text-gray-600">{new Date(c.timestamp).toLocaleString("zh-CN")}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{c.note}</p>
                <p className="mt-1 font-mono text-xs text-gray-600">
                  证据: {c.evidenceType === "photo" ? "照片" : "KML航段"} {c.evidenceId.slice(0, 12)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="mt-3 space-y-2 rounded-lg bg-[#0f0f23] p-3">
          <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as ConfirmationStatus)} className="w-full rounded border border-white/10 bg-[#16213e] px-2 py-1.5 text-sm text-gray-200">
            <option value="confirmed">确认</option>
            <option value="rejected">驳回</option>
            <option value="pending">待确认</option>
          </select>
          <div className="flex gap-2">
            <select value={formEvType} onChange={(e) => setFormEvType(e.target.value as EvidenceType)} className="rounded border border-white/10 bg-[#16213e] px-2 py-1.5 text-sm text-gray-200">
              <option value="photo">照片</option>
              <option value="kml_segment">KML航段</option>
            </select>
            <input value={formEvId} onChange={(e) => setFormEvId(e.target.value)} placeholder="证据ID" className="flex-1 rounded border border-white/10 bg-[#16213e] px-2 py-1.5 text-sm text-gray-200" />
          </div>
          <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="备注" rows={2} className="w-full rounded border border-white/10 bg-[#16213e] px-2 py-1.5 text-sm text-gray-200 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="rounded bg-amber-400 px-3 py-1.5 text-xs font-medium text-[#1a1a2e] hover:bg-amber-300">提交</button>
            <button onClick={() => setShowForm(false)} className="rounded bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10">取消</button>
          </div>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-medium text-amber-400 hover:text-amber-300">+ 新增确认</button>
      )}
    </div>
  );
}

function ReviewPanel({ flightReview }: { flightReview: FlightReview | undefined }) {
  if (!flightReview) return <p className="text-center text-sm text-gray-500 py-6">暂无复盘数据</p>;

  const chartData = flightReview.dataPoints.map((dp) => ({
    time: new Date(dp.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    电压: Number(dp.voltage.toFixed(1)),
    高度: Number(dp.altitude.toFixed(1)),
    速度: Number(dp.speed.toFixed(1)),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#9ca3af" }} />
          {flightReview.anomalyRanges.map((ar) => (
            <ReferenceArea key={ar.id} yAxisId="left" x1={new Date(ar.startTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} x2={new Date(ar.endTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} fill="#ef4444" fillOpacity={0.15} onClick={() => {
              if (ar.linkedPhotoId) {
                const el = document.getElementById("panel-photos");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }} />
          ))}
          <Line yAxisId="left" type="monotone" dataKey="电压" stroke="#f59e0b" dot={false} strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="高度" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
          <Line yAxisId="right" type="monotone" dataKey="速度" stroke="#10b981" dot={false} strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
      {flightReview.anomalyRanges.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {flightReview.anomalyRanges.map((ar) => (
            <div key={ar.id} className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-300 cursor-pointer hover:bg-red-500/20" onClick={() => {
              const el = ar.linkedPhotoId ? document.getElementById("panel-photos") : document.getElementById("panel-kml");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{ANOMALY_LABEL[ar.type]}</span>
              <span className="ml-auto text-gray-500">
                {new Date(ar.startTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} - {new Date(ar.endTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {ar.linkedPhotoId && <span className="text-amber-400">→照片</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EvidenceDetail() {
  const { sortieId } = useParams<{ sortieId: string }>();
  const navigate = useNavigate();
  const store = useAppStore();

  const sortie = useMemo(() => store.sorties.find((s) => s.id === sortieId), [store.sorties, sortieId]);
  const photos = useMemo(() => store.photos.filter((p) => p.sortieId === sortieId), [store.photos, sortieId]);
  const kmlRoute = useMemo(() => store.kmlRoutes.find((k) => k.sortieId === sortieId), [store.kmlRoutes, sortieId]);
  const confirmations = useMemo(() => store.confirmations.filter((c) => c.sortieId === sortieId), [store.confirmations, sortieId]);
  const flightReview = useMemo(() => store.flightReviews.find((r) => r.sortieId === sortieId), [store.flightReviews, sortieId]);

  if (store.sorties.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f23]">
        <div className="text-gray-400">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!sortie) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f23]">
        <p className="text-gray-500">未找到架次数据</p>
        <button onClick={() => navigate("/")} className="mt-4 text-amber-400 hover:text-amber-300">返回总览</button>
      </div>
    );
  }

  const ss = STATUS_STYLE[sortie.status];

  const handleAddConfirmation = async (c: Confirmation) => {
    await store.addConfirmation(c);
    await store.addAuditLog({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      action: "confirm",
      operator: "外场队长",
      timestamp: Date.now(),
      detail: `${CONF_STATUS_LABEL[c.status]}架次证据 (${c.evidenceType}: ${c.evidenceId.slice(0, 12)})`,
      sortieId: c.sortieId,
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f23]">
      <div className="mb-6">
        <button onClick={() => navigate("/")} className="mb-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> 返回总览
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-100">{sortie.sortieNo}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ss.bg} ${ss.color}`}>{ss.label}</span>
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
          <span>电池: <span className="font-mono text-gray-300">{sortie.batteryId}</span></span>
          <span>{new Date(sortie.timestamp).toLocaleString("zh-CN")}</span>
        </div>
        {sortie.anomalyTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sortie.anomalyTags.map((tag) => (
              <span key={tag} className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-xs text-red-400">
                {ANOMALY_LABEL[tag]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="巡检照片" icon={Camera} id="panel-photos">
          <PhotoPanel photos={photos} />
        </Panel>
        <Panel title="航线KML" icon={Map} id="panel-kml">
          <KmlPanel kmlRoute={kmlRoute} />
        </Panel>
        <Panel title="人工确认" icon={ClipboardCheck}>
          <ConfirmationPanel confirmations={confirmations} sortieId={sortie.id} onAdd={handleAddConfirmation} />
        </Panel>
        <Panel title="飞行复盘" icon={Activity}>
          <ReviewPanel flightReview={flightReview} />
        </Panel>
      </div>
    </div>
  );
}
