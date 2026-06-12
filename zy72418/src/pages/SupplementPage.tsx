import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, ArrowLeft, AlertTriangle, History, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import StatusBadge from "@/components/StatusBadge";
import type { AudioRecord, AuditLog, UpdateRecordRequest } from "@shared/types";

export default function SupplementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, setLoading, setError, setRecords } = useAppStore();
  const [record, setRecord] = useState<AudioRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [formData, setFormData] = useState({
    remark: "",
    courseName: "",
    therapistName: "",
    sessionDate: "",
    duration: "",
    amount: "",
    authorizationExpiryDate: "",
    errorNote: "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadRecord = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [recordRes, auditRes] = await Promise.all([
        api.records.get(id),
        api.audit.list(id),
      ]);
      const rec = recordRes.data;
      setRecord(rec);
      setAuditLogs(auditRes.data);
      setFormData({
        remark: rec.remark || "",
        courseName: rec.courseName || "",
        therapistName: rec.therapistName || "",
        sessionDate: rec.sessionDate || "",
        duration: rec.duration?.toString() || "",
        amount: rec.amount?.toString() || "",
        authorizationExpiryDate: rec.authorizationExpiryDate || "",
        errorNote: rec.errorNote || "",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [id]);

  const detectChanges = (): Partial<UpdateRecordRequest> => {
    if (!record) return {};
    const changes: Partial<UpdateRecordRequest> = {};

    if (formData.remark !== record.remark) changes.remark = formData.remark;
    if (formData.courseName !== record.courseName) changes.courseName = formData.courseName;
    if (formData.therapistName !== record.therapistName)
      changes.therapistName = formData.therapistName;
    if (formData.sessionDate !== record.sessionDate)
      changes.sessionDate = formData.sessionDate;
    if (formData.duration !== record.duration?.toString())
      changes.duration = parseInt(formData.duration);
    if (formData.amount !== record.amount?.toString())
      changes.amount = parseFloat(formData.amount);
    if (formData.authorizationExpiryDate !== record.authorizationExpiryDate)
      changes.authorizationExpiryDate = formData.authorizationExpiryDate;
    if (formData.errorNote !== record.errorNote) changes.errorNote = formData.errorNote;

    return changes;
  };

  const handleSave = async () => {
    if (!id || !record) return;

    const changes = detectChanges();
    if (Object.keys(changes).length === 0) {
      setError("未检测到任何修改");
      return;
    }

    if (!reason.trim()) {
      setError("请填写修改理由");
      return;
    }

    setSaving(true);
    try {
      const updateData: UpdateRecordRequest = {
        ...changes,
        operator: currentUser.name,
        operatorRole: currentUser.role,
        reason: reason.trim(),
      };

      await api.records.update(id, updateData);

      const res = await api.records.list();
      setRecords(res.data, res.dataHash);

      navigate("/results");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const calculateSettlement = () => {
    const amount = parseFloat(formData.amount) || 0;
    const duration = parseInt(formData.duration) || 0;
    const baseRate = 0.7;
    const tempSubDiscount = record?.isTemporarySubstitute ? 0.05 : 0;
    const rate = baseRate - tempSubDiscount;
    return (amount * rate).toFixed(2);
  };

  const changes = detectChanges();
  const changeCount = Object.keys(changes).length;

  if (!record) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/results")}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          返回结果页
        </button>
        <h3 className="text-xl font-semibold text-gray-800">信息补录</h3>
        <StatusBadge status={record.status} />
        {record.isTemporarySubstitute && (
          <span className="px-3 py-1 bg-warning-100 text-warning-700 rounded-full text-sm flex items-center gap-1">
            <AlertTriangle size={14} />
            临时替补
          </span>
        )}
      </div>

      {changeCount > 0 && (
        <div className="card p-4 bg-primary-50 border-l-4 border-l-primary-500">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="text-primary-600" />
            <div>
              <p className="font-medium text-primary-800">
                检测到 {changeCount} 处修改，保存后将自动重算分账金额
              </p>
              <p className="text-sm text-primary-600">
                预估分账金额：¥{calculateSettlement()}
                {record.isTemporarySubstitute && (
                  <span className="ml-2 text-xs">（临时替补已下调5%）</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-6">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <History size={18} className="text-primary-500" />
            基本信息
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                音频文件ID
              </label>
              <input
                type="text"
                value={record.audioFileId}
                disabled
                className="input-field bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                音频文件名
              </label>
              <input
                type="text"
                value={record.audioFileName}
                disabled
                className="input-field bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                课程名称 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={formData.courseName}
                onChange={(e) =>
                  setFormData({ ...formData, courseName: e.target.value })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                治疗师姓名 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={formData.therapistName}
                onChange={(e) =>
                  setFormData({ ...formData, therapistName: e.target.value })
                }
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  上课日期 <span className="text-danger-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.sessionDate}
                  onChange={(e) =>
                    setFormData({ ...formData, sessionDate: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  时长（分钟） <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  原始金额（元） <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  授权到期日 <span className="text-danger-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.authorizationExpiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, authorizationExpiryDate: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning-500" />
              备注与误差说明
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  音频文件备注
                </label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="请输入音频文件备注..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  误差说明
                </label>
                <textarea
                  value={formData.errorNote}
                  onChange={(e) => setFormData({ ...formData, errorNote: e.target.value })}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="如有金额或时长误差，请在此说明..."
                />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h4 className="font-semibold text-gray-800 mb-4">分账信息</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">原始金额</p>
                <p className="text-2xl font-bold text-gray-800">
                  ¥{(parseFloat(formData.amount) || 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-600 mb-1">预估分账金额</p>
                <p className="text-2xl font-bold text-primary-700">¥{calculateSettlement()}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              <p>分账规则：基础费率 70%</p>
              {record.isTemporarySubstitute && (
                <p className="text-warning-600">临时替补：下调 5% → 实际费率 65%</p>
              )}
            </div>
          </div>

          <div className="card p-6 bg-warning-50 border border-warning-200">
            <h4 className="font-semibold text-warning-800 mb-2">
              修改理由 <span className="text-danger-500">*</span>
            </h4>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="input-field resize-none"
              placeholder="请详细说明修改理由，将记录到审计日志..."
            />
            <p className="text-xs text-warning-600 mt-2">
              所有修改将记录审计日志，包括：操作人、修改字段、旧值→新值、理由、影响的结果ID
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <History size={18} className="text-primary-500" />
            修改历史
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              {showHistory ? "收起" : `展开（${auditLogs.length}条）`}
            </button>
          </h4>
        </div>

        {showHistory && (
          <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-gray-50 rounded-lg border-l-3 border-l-primary-300"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-gray-800">{log.operator}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600">{log.action}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                {log.fieldName && (
                  <p className="text-sm text-gray-600 mt-1">
                    {log.fieldName}：
                    <span className="line-through text-gray-400">{log.oldValue}</span>
                    <span className="mx-1">→</span>
                    <span className="text-primary-600">{log.newValue}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">理由：{log.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={() => navigate("/results")}
          className="btn-secondary"
          disabled={saving}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving || changeCount === 0 || !reason.trim()}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? "保存中..." : "保存并更新分账"}
        </button>
      </div>
    </div>
  );
}
