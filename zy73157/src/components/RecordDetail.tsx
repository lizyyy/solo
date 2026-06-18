import { useState } from "react";
import { X, BookOpen, FileText, AlertOctagon, Gauge, Link2, Plus, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { StatusBadge, AnomalyBadge, ParameterValue } from "@/components/Badges";
import type { RecordStatus, SamplingParameter } from "@/types";
import { parameterConfig } from "@/components/Badges";

interface RecordDetailProps {
  onClose: () => void;
}

export function RecordDetail({ onClose }: RecordDetailProps) {
  const {
    selectedRecordId, getRecordById, getAnomaliesForRecord, getDriftsForRecord, getWithdrawalForRecord, updateRecordStatus, addEvidence } = useStore();
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceType, setEvidenceType] = useState("notebook");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");

  const record = selectedRecordId ? getRecordById(selectedRecordId) : null;
  if (!record) return null;

  const anomalies = getAnomaliesForRecord(record.id);
  const drifts = getDriftsForRecord(record.id);
  const withdrawal = getWithdrawalForRecord(record.id);

  const handleAddEvidence = () => {
    if (evidenceDesc && evidenceRef) {
      addEvidence(record.id, { type: evidenceType, description: evidenceDesc, reference: evidenceRef });
      setShowAddEvidence(false);
      setEvidenceDesc("");
      setEvidenceRef("");
    }
  };

  const statusActions: { value: RecordStatus; label: string; icon: any }[] = [
    { value: "resolved", label: "标记已处理", icon: CheckCircle2 },
    { value: "pending_evidence", label: "待补证据", icon: Clock },
    { value: "blocked", label: "标记卡住", icon: AlertTriangle },
  ];

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
      <div>
          <h2 className="text-lg font-semibold text-slate-800">采样记录详情</h2>
          <div className="text-xs text-slate-500 mt-0.5">{record.id}</div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold text-slate-800">
              {new Date(record.timestamp).toLocaleString("zh-CN", {
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {record.position.longitude.toFixed(5)}°E, {record.position.latitude.toFixed(5)}°N · 深度 {record.position.depth}m
            </div>
          </div>
          <StatusBadge status={record.status} />
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            采样参数
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(record.parameters) as SamplingParameter[]).map((param) => (
              <div key={param} className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">{parameterConfig[param].label}</div>
                <ParameterValue parameter={param} value={record.parameters[param]} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            船上记录本来源
          </h3>
          <div className="bg-white rounded-lg p-4 border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-amber-600 font-mono">
                {record.notebookSource.bookId} · 第{record.notebookSource.page}页 · 第{record.notebookSource.line}行
              </span>
              <span className="text-xs text-amber-500">
                记录人: {record.notebookSource.recordedBy}
              </span>
            </div>
            <div className="text-sm text-slate-700 bg-amber-50 p-3 rounded border border-amber-100 font-mono text-sm">
              "{record.notebookSource.originalText}
            </div>
            <div className="text-xs text-amber-500 mt-2">
              记录时间: {new Date(record.notebookSource.recordedAt).toLocaleString("zh-CN")}
            </div>
          </div>
        </div>

        {withdrawal && (
          <div className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" />
              撤回记录
            </h3>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{withdrawal.reason}</span>
                <span className="text-xs text-gray-500">
                  来源: 第{withdrawal.sourcePage}页 · 第{withdrawal.sourceLine}行
                </span>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
                {withdrawal.annotation}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  撤回人: {withdrawal.withdrawnBy} · {new Date(withdrawal.withdrawnAt).toLocaleString("zh-CN")}
                </div>
                {withdrawal.replacementRecordId && (
                  <button
                    onClick={() => useStore.getState().selectRecord(withdrawal.replacementRecordId!)}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    查看补采记录
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {anomalies.length > 0 && (
          <div className="mt-4 space-y-3">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={cn(
                  "rounded-lg p-4 border",
                  anomaly.type === "withdrawal"
                    ? "bg-gray-50 border-gray-200"
                    : anomaly.severity === "critical"
                    ? "bg-red-50 border-red-200"
                    : anomaly.severity === "high"
                    ? "bg-orange-50 border-orange-200"
                    : "bg-amber-50 border-amber-200"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                <AnomalyBadge type={anomaly.type} severity={anomaly.severity} showSeverity />
                <span className="text-xs text-slate-500">
                  发现于 {new Date(anomaly.detectedAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
                <div className="text-sm text-slate-700 mt-1">{anomaly.description}</div>
                {anomaly.parameter && (
                  <div className="text-xs text-slate-500 mt-1">
                  关联参数: {parameterConfig[anomaly.parameter].label}
                </div>
                )}
                {anomaly.handler && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500">
                      处理人: {anomaly.handler} · {new Date(anomaly.handledAt!).toLocaleString("zh-CN")}
                    </div>
                    {anomaly.resolution && (
                      <div className="text-sm text-emerald-700 mt-1">{anomaly.resolution}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {drifts.length > 0 && (
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              传感器漂移影响
            </h3>
            <div className="space-y-3">
              {drifts.map((drift) => (
                <div key={drift.id} className="bg-white rounded-lg p-4 border border-orange-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-slate-700">{drift.sensorId}</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      drift.driftDirection === "positive" ? "text-red-600" : "text-blue-600"
                    )}>
                      偏移 {drift.driftDirection === "positive" ? "+" : ""}{drift.driftValue}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2">
                    <div>影响范围: 索引 {drift.affectedStartIndex}-{drift.affectedEndIndex}</div>
                    <div>来源行: 第 {drift.sourceLine} 行</div>
                    <div>发现时间: {new Date(drift.detectedAt).toLocaleString("zh-CN")}</div>
                    <div>
                      状态:
                      {drift.corrected ? (
                        <span className="text-emerald-600">已校准</span>
                      ) : (
                        <span className="text-amber-600">待校准</span>
                      )}
                    </div>
                  </div>
                  {drift.correctionMethod && (
                    <div className="mt-2 pt-2 border-t border-orange-100 text-xs text-emerald-700">
                      校准方法: {drift.correctionMethod}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" />
              证据链
            </h3>
            <button
              onClick={() => setShowAddEvidence(!showAddEvidence)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加证据
            </button>
          </div>

          {showAddEvidence && (
            <div className="bg-white rounded-lg p-4 border border-blue-200 mb-3">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="text-sm border border-slate-200 rounded-md px-3 py-2"
                >
                  <option value="notebook">记录本</option>
                  <option value="sensor_log">传感器日志</option>
                  <option value="photo">现场照片</option>
                  <option value="calibration_record">校准记录</option>
                </select>
                <input
                  type="text"
                  placeholder="参考编号"
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                  className="text-sm border border-slate-200 rounded-md px-3 py-2"
                />
              </div>
              <input
                type="text"
                placeholder="证据描述"
                value={evidenceDesc}
                onChange={(e) => setEvidenceDesc(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 mb-3"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddEvidence(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
                >
                  取消
                </button>
                <button
                  onClick={handleAddEvidence}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  确认添加
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {record.evidence.map((ev) => (
              <div key={ev.id} className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 uppercase">{ev.type === "notebook" ? "📓 记录本" :
                        ev.type === "sensor_log" ? "📊 传感器日志" :
                        ev.type === "photo" ? "📷 照片" : "📐 校准记录"}
                </span>
                <span className="text-xs text-slate-400 font-mono">{ev.reference}</span>
              </div>
              <div className="text-sm text-slate-700 mt-1">{ev.description}</div>
              <div className="text-xs text-slate-400 mt-1">
                上传于 {new Date(ev.uploadedAt).toLocaleString("zh-CN")}
              </div>
            </div>
            ))}
          </div>
        </div>

        {record.notes && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-xs text-blue-600 font-medium mb-1">备注</div>
            <div className="text-sm text-blue-800">{record.notes}</div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500 mb-2">更新状态</div>
        <div className="grid grid-cols-3 gap-2">
          {statusActions.map((action) => {
            const Icon = action.icon;
            const isActive = record.status === action.value;
            return (
              <button
                key={action.value}
                onClick={() => updateRecordStatus(record.id, action.value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                )}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

