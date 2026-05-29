import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import AnomalyBadge from "@/components/AnomalyBadge";
import { ANOMALY_TYPE_LABELS } from "../../shared/types";
import type { AnomalyType, Anomaly } from "../../shared/types";

export default function Reports() {
  const { restorations, artworks, anomalies, corrections, signatures, steps, materials, fetchRestorations, fetchArtworks, fetchSteps, fetchMaterials, fetchPhotos, fetchAnomalies, fetchSignatures, generateReport } = useStore();

  const [selectedRestoration, setSelectedRestoration] = useState("");
  const [includeAnomalies, setIncludeAnomalies] = useState(true);
  const [includeCorrections, setIncludeCorrections] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeRules, setIncludeRules] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchRestorations();
    fetchArtworks();
  }, [fetchRestorations, fetchArtworks]);

  useEffect(() => {
    if (selectedRestoration) {
      fetchSteps(selectedRestoration);
      fetchMaterials(selectedRestoration);
      fetchPhotos(selectedRestoration);
      fetchAnomalies(selectedRestoration);
      fetchSignatures(selectedRestoration);
    }
  }, [selectedRestoration, fetchSteps, fetchMaterials, fetchPhotos, fetchAnomalies, fetchSignatures]);

  const selectedRestorationData = restorations.find((r) => r.id === selectedRestoration);
  const selectedArtwork = selectedRestorationData
    ? artworks.find((a) => a.id === selectedRestorationData.artworkId)
    : null;

  const restorationAnomalies = anomalies.filter((a) => a.restorationId === selectedRestoration);
  const restorationCorrections = corrections.filter((c) =>
    restorationAnomalies.some((a) => a.id === c.anomalyId)
  );
  const restorationSignatures = signatures.filter((s) => s.restorationId === selectedRestoration);
  const restorationSteps = steps.filter((s) => s.restorationId === selectedRestoration);
  const restorationMaterials = materials.filter((m) =>
    restorationSteps.some((s) => s.id === m.stepId)
  );

  const groupedAnomalies = restorationAnomalies.reduce<Record<AnomalyType, Anomaly[]>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = [];
    acc[a.type].push(a);
    return acc;
  }, {} as Record<AnomalyType, Anomaly[]>);

  const handleExport = async () => {
    if (!selectedRestoration) return;
    setGenerating(true);
    try {
      const result = await generateReport(selectedRestoration, {
        includeAnomalies,
        includeCorrections,
        includeSignatures,
        includeRules,
      });

      const response = await fetch(`/api/reports/${result.id}`);
      const json = await response.json();
      const reportData = json.data || json;
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${selectedRestoration}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("报告导出失败:", e);
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl font-bold text-primary-800">报告导出</h2>

      <div className="card p-6">
        <h3 className="font-serif text-base font-semibold text-primary-800 mb-4">导出设置</h3>

        <div className="space-y-4">
          <div>
            <label className="label-field">选择修复记录</label>
            <select
              value={selectedRestoration}
              onChange={(e) => setSelectedRestoration(e.target.value)}
              className="input-field max-w-md"
            >
              <option value="">请选择修复记录</option>
              {restorations.map((r) => {
                const artwork = artworks.find((a) => a.id === r.artworkId);
                return (
                  <option key={r.id} value={r.id}>
                    {artwork?.name || "未知作品"} - {r.restorerName} ({new Date(r.startDate).toLocaleDateString("zh-CN")})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-primary-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAnomalies}
                onChange={(e) => setIncludeAnomalies(e.target.checked)}
                className="rounded border-primary-200 text-amber focus:ring-amber"
              />
              包含异常记录
            </label>
            <label className="flex items-center gap-2 text-sm text-primary-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCorrections}
                onChange={(e) => setIncludeCorrections(e.target.checked)}
                className="rounded border-primary-200 text-amber focus:ring-amber"
              />
              包含修正操作
            </label>
            <label className="flex items-center gap-2 text-sm text-primary-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="rounded border-primary-200 text-amber focus:ring-amber"
              />
              包含签名页
            </label>
            <label className="flex items-center gap-2 text-sm text-primary-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRules}
                onChange={(e) => setIncludeRules(e.target.checked)}
                className="rounded border-primary-200 text-amber focus:ring-amber"
              />
              包含规则附录
            </label>
          </div>

          <button
            onClick={handleExport}
            disabled={!selectedRestoration || generating}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={16} />
            {generating ? "生成中..." : "导出报告"}
          </button>
        </div>
      </div>

      {selectedRestoration && selectedRestorationData && (
        <div className="card p-6">
          <h3 className="font-serif text-base font-semibold text-primary-800 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-amber" />
            报告预览
          </h3>

          <div className="space-y-6">
            <div className="border border-primary-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-primary-800 mb-2">作品信息</h4>
              {selectedArtwork ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-primary-600">名称：{selectedArtwork.name}</p>
                  <p className="text-primary-600">年代：{selectedArtwork.era}</p>
                  <p className="text-primary-600">材质：{selectedArtwork.material}</p>
                  <p className="text-primary-600">编号：{selectedArtwork.accessionNumber}</p>
                </div>
              ) : (
                <p className="text-sm text-primary-300">未关联作品信息</p>
              )}
            </div>

            <div className="border border-primary-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-primary-800 mb-2">修复步骤（{restorationSteps.length} 步）</h4>
              {restorationSteps.length === 0 ? (
                <p className="text-sm text-primary-300">暂无步骤</p>
              ) : (
                <div className="space-y-1">
                  {restorationSteps
                    .sort((a, b) => a.stepOrder - b.stepOrder)
                    .map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 h-6 rounded-full bg-amber-50 text-amber flex items-center justify-center text-xs font-bold">
                          {s.stepOrder}
                        </span>
                        <span className="text-primary-700">{s.description}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="border border-primary-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-primary-800 mb-2">材料清单（{restorationMaterials.length} 项）</h4>
              {restorationMaterials.length === 0 ? (
                <p className="text-sm text-primary-300">暂无材料</p>
              ) : (
                <div className="space-y-1">
                  {restorationMaterials.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 text-sm">
                      <span className="font-mono text-primary-800">{m.batchNumber}</span>
                      <span className="text-primary-600">{m.name}</span>
                      <span className="text-primary-400">{m.supplier}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {includeAnomalies && (
              <div className="border border-anomaly-red-100 rounded-lg p-4 bg-anomaly-red-50/30">
                <h4 className="text-sm font-semibold text-anomaly-red mb-3">异常清单（按类型分组）</h4>
                {Object.keys(groupedAnomalies).length === 0 ? (
                  <p className="text-sm text-primary-300">暂无异常</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedAnomalies).map(([type, typeAnomalies]) => (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-2">
                          <AnomalyBadge type={type as AnomalyType} size="md" />
                          <span className="text-xs text-primary-400">({typeAnomalies.length})</span>
                        </div>
                        <div className="space-y-2 ml-2">
                          {typeAnomalies.map((a) => {
                            const corr = corrections.find((c) => c.anomalyId === a.id);
                            return (
                              <div key={a.id} className="text-sm border-l-2 border-anomaly-red-100 pl-3">
                                <p className="text-primary-800">{a.description}</p>
                                <p className="text-xs text-primary-400">
                                  发现时间：{new Date(a.detectedAt).toLocaleDateString("zh-CN")}
                                </p>
                                {includeCorrections && corr && (
                                  <div className="mt-1 text-xs text-primary-600">
                                    <p>修正操作：{corr.beforeValue} → {corr.afterValue}</p>
                                    <p>修正人：{corr.correctedBy}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {includeSignatures && (
              <div className="border border-primary-100 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary-800 mb-2">签名页</h4>
                {restorationSignatures.length === 0 ? (
                  <p className="text-sm text-primary-300">暂无签名</p>
                ) : (
                  <div className="space-y-2">
                    {restorationSignatures.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 text-sm">
                        <span className="text-primary-800 font-medium">{s.signerName}</span>
                        <span className="text-primary-400">({s.signerRole === "restorer" ? "修复师" : "审核员"})</span>
                        <span className="text-primary-300">{new Date(s.signedAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {includeRules && (
              <div className="border border-primary-100 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary-800 mb-2">规则附录</h4>
                <div className="text-xs text-primary-500 space-y-2">
                  <p>1. 修复状态流转：pending → in_progress → under_review → approved / rejected</p>
                  <p>2. 批号格式：大写字母+8位数字（如 AB20240001）</p>
                  <p>3. 每个步骤至少关联 1 张照片</p>
                  <p>4. 修复师签名 = 锁定步骤；审核员签名 = 确认闭环</p>
                  <p>5. 报告须包含异常清单（按类型分组）与修正记录</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
