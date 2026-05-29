import { useEffect, useRef, useState, useCallback } from "react";
import { Lock, ArrowRight, PenLine, RotateCcw, Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import AnomalyBadge from "@/components/AnomalyBadge";
import { ANOMALY_TYPE_LABELS } from "../../shared/types";
import type { Signature } from "../../shared/types";

interface Props {
  restorationId: string;
}

export default function SignaturePanel({ restorationId }: Props) {
  const {
    signatures,
    traceChain,
    anomalies,
    corrections,
    fetchSignatures,
    fetchTraceChain,
    fetchAnomalies,
    fetchCorrections,
    submitSignature,
  } = useStore();

  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState<Signature["signerRole"]>("restorer");
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const restorerSigned = signatures.some((s) => s.signerRole === "restorer");
  const reviewerSigned = signatures.some((s) => s.signerRole === "reviewer");

  useEffect(() => {
    fetchSignatures(restorationId);
    fetchTraceChain(restorationId);
    fetchAnomalies(restorationId);
  }, [restorationId, fetchSignatures, fetchTraceChain, fetchAnomalies]);

  useEffect(() => {
    anomalies.forEach((a) => {
      fetchCorrections(a.id);
    });
  }, [anomalies, fetchCorrections]);

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }, []);

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const ctx = getCanvasContext();
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      setIsDrawing(true);
    },
    [getCanvasContext]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const ctx = getCanvasContext();
      if (!ctx) return;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#3D2B0A";
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
    },
    [isDrawing, getCanvasContext]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirmSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signerName) return;
    const signatureData = canvas.toDataURL("image/png");
    try {
      await submitSignature(restorationId, {
        signerName,
        signerRole,
        signatureData,
      });
      clearCanvas();
      setSignerName("");
      await fetchSignatures(restorationId);
      await fetchTraceChain(restorationId);
    } catch {}
  };

  const getCorrection = (anomalyId: string) =>
    corrections.find((c) => c.anomalyId === anomalyId);

  const stageCardClass = "flex-1 card p-4 min-w-0";
  const arrowClass = "flex items-center text-primary-200";

  return (
    <div className="space-y-6">
      <h3 className="font-serif text-lg font-semibold text-primary-800">签名与确认</h3>

      <div className="card p-6">
        <h4 className="font-serif text-base font-semibold text-primary-800 mb-4">三段追溯链</h4>
        <div className="flex items-center gap-4 overflow-x-auto">
          <div className={stageCardClass}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-anomaly-red-50 flex items-center justify-center">
                <span className="text-anomaly-red font-bold text-xs">1</span>
              </div>
              <span className="text-sm font-medium text-anomaly-red">发现异常</span>
            </div>
            {anomalies.length === 0 ? (
              <p className="text-xs text-primary-300">暂无异常</p>
            ) : (
              <div className="space-y-2">
                {anomalies.map((a) => (
                  <div key={a.id}>
                    <AnomalyBadge anomaly={a} size="sm" />
                    <p className="text-xs text-primary-600 mt-1">{a.description}</p>
                    <p className="text-xs text-primary-300">
                      {new Date(a.detectedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={arrowClass}>
            <ArrowRight size={20} />
          </div>

          <div className={stageCardClass}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                <span className="text-amber font-bold text-xs">2</span>
              </div>
              <span className="text-sm font-medium text-amber">修正操作</span>
            </div>
            {corrections.length === 0 ? (
              <p className="text-xs text-primary-300">暂无修正</p>
            ) : (
              <div className="space-y-2">
                {corrections.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs text-primary-800 font-medium">{c.correctedBy}</p>
                    <p className="text-xs text-primary-600">
                      {c.beforeValue} → {c.afterValue}
                    </p>
                    <p className="text-xs text-primary-300">
                      {new Date(c.correctedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={arrowClass}>
            <ArrowRight size={20} />
          </div>

          <div className={stageCardClass}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                <span className="text-green-700 font-bold text-xs">3</span>
              </div>
              <span className="text-sm font-medium text-green-700">确认签批</span>
            </div>
            {signatures.length === 0 ? (
              <p className="text-xs text-primary-300">暂未签批</p>
            ) : (
              <div className="space-y-2">
                {signatures.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Lock size={12} className="text-green-600" />
                      <span className="text-xs font-medium text-primary-800">{s.signerName}</span>
                      <span className="text-xs text-primary-400">
                        ({s.signerRole === "restorer" ? "修复师" : "审核员"})
                      </span>
                    </div>
                    <p className="text-xs text-primary-300">
                      {new Date(s.signedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h4 className="font-serif text-base font-semibold text-primary-800 mb-4">签名区域</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              修复师签名
              {restorerSigned && <Lock size={14} className="text-green-600" />}
            </h5>
            {restorerSigned ? (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700 font-medium">已签名确认</p>
                <p className="text-xs text-green-600 mt-1">
                  {signatures.find((s) => s.signerRole === "restorer")?.signerName}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label-field">签名者姓名</label>
                  <input
                    type="text"
                    value={signerRole === "restorer" ? signerName : ""}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input-field"
                    placeholder="输入姓名"
                    onFocus={() => setSignerRole("restorer")}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <h5 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              审核员签名
              {reviewerSigned && <Lock size={14} className="text-green-600" />}
            </h5>
            {reviewerSigned ? (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700 font-medium">已签名确认</p>
                <p className="text-xs text-green-600 mt-1">
                  {signatures.find((s) => s.signerRole === "reviewer")?.signerName}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label-field">签名者姓名</label>
                  <input
                    type="text"
                    value={signerRole === "reviewer" ? signerName : ""}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input-field"
                    placeholder="输入姓名"
                    onFocus={() => setSignerRole("reviewer")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="label-field">手写签名</label>
          <div className="border border-primary-100 rounded-lg bg-white">
            <canvas
              ref={canvasRef}
              width={500}
              height={150}
              className="w-full cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={clearCanvas} className="btn-secondary flex items-center gap-1 text-xs">
              <RotateCcw size={12} />
              清除
            </button>
            <div className="flex items-center gap-3">
              <select
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value as Signature["signerRole"])}
                className="input-field w-32"
              >
                <option value="restorer">修复师</option>
                <option value="reviewer">审核员</option>
              </select>
              <button
                onClick={handleConfirmSignature}
                className="btn-primary flex items-center gap-1"
                disabled={!signerName}
              >
                <Check size={14} />
                确认签名
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
