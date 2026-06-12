import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Shield, FileText, Clock, Hash } from "lucide-react";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import type { SelfCheckReport } from "@shared/types";

export default function SelfCheckPage() {
  const { setLoading, setError, selfCheckReport, setSelfCheckReport } = useAppStore();
  const [running, setRunning] = useState(false);

  const runSelfCheck = async () => {
    setRunning(true);
    setLoading(true);
    try {
      const res = await api.selfCheck.run();
      setSelfCheckReport(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
      setLoading(false);
    }
  };

  const loadSelfCheck = async () => {
    setLoading(true);
    try {
      const res = await api.selfCheck.get();
      setSelfCheckReport(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelfCheck();
  }, []);

  const checkItems = selfCheckReport
    ? [
        {
          key: "checkDuplicateImport",
          title: "重复导入检测",
          icon: <Hash size={20} />,
          description: "检测是否存在重复导入的记录，区分本次重复和历史重复",
          passed: selfCheckReport.checkDuplicateImport.passed,
          details: selfCheckReport.checkDuplicateImport.details,
        },
        {
          key: "checkTemporarySubstitute",
          title: "临时替补检测",
          icon: <AlertTriangle size={20} />,
          description: "检测临时替补记录是否都标记为待复核，未遗漏或错误标记",
          passed: selfCheckReport.checkTemporarySubstitute.passed,
          details: selfCheckReport.checkTemporarySubstitute.details,
        },
        {
          key: "checkRecalculationAfterSupplement",
          title: "补录后重算检测",
          icon: <RefreshCw size={20} />,
          description: "检测补录修改后是否正确触发分账金额重算",
          passed: selfCheckReport.checkRecalculationAfterSupplement.passed,
          details: selfCheckReport.checkRecalculationAfterSupplement.details,
        },
        {
          key: "checkExportConsistency",
          title: "导出一致性检测",
          icon: <FileText size={20} />,
          description: "检测导出CSV、页面展示、API返回三处数据是否完全一致（MD5校验）",
          passed: selfCheckReport.checkExportConsistency.passed,
          details: selfCheckReport.checkExportConsistency.details,
        },
      ]
    : [];

  const renderDetails = (key: string, details: any[]) => {
    if (details.length === 0) {
      return <p className="text-sm text-gray-500">无异常</p>;
    }

    switch (key) {
      case "checkDuplicateImport":
        return (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                <p>
                  批次 <span className="font-mono">{d.batchId}</span>：
                  <span className={d.duplicateCount > 0 ? "text-warning-600" : "text-success-600"}>
                    {d.message}
                  </span>
                </p>
                {d.duplicateCount > 0 && (
                  <p className="text-xs text-gray-500 mt-1">重复数量：{d.duplicateCount}</p>
                )}
              </div>
            ))}
          </div>
        );

      case "checkTemporarySubstitute":
        return (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                <p>
                  记录 <span className="font-mono">{d.recordId}</span>：
                  <span className={d.status === "ok" ? "text-success-600" : "text-danger-600"}>
                    {d.message}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">当前状态：{d.status}</p>
              </div>
            ))}
          </div>
        );

      case "checkRecalculationAfterSupplement":
        return (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                <p>
                  记录 <span className="font-mono">{d.recordId}</span>：
                  <span className={d.recalculated ? "text-success-600" : "text-danger-600"}>
                    {d.message}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  是否已重算：{d.recalculated ? "是" : "否"}
                </p>
              </div>
            ))}
          </div>
        );

      case "checkExportConsistency":
        return (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                <div className="grid grid-cols-3 gap-4 text-xs mb-2">
                  <div>
                    <p className="text-gray-500">导出 Hash</p>
                    <p className="font-mono text-gray-800">{d.exportHash.slice(0, 16)}...</p>
                  </div>
                  <div>
                    <p className="text-gray-500">页面 Hash</p>
                    <p className="font-mono text-gray-800">{d.pageHash.slice(0, 16)}...</p>
                  </div>
                  <div>
                    <p className="text-gray-500">API Hash</p>
                    <p className="font-mono text-gray-800">{d.apiHash.slice(0, 16)}...</p>
                  </div>
                </div>
                <p className={d.consistent ? "text-success-600" : "text-danger-600"}>
                  {d.consistent ? "✓ 三处数据完全一致" : "✗ 数据不一致，请检查"}
                </p>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-6 border-l-4 border-l-primary-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <Shield size={24} className="text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">系统自检报告</h3>
              <p className="text-sm text-gray-500">
                四项核心检测确保数据质量和业务规则一致性
              </p>
            </div>
          </div>
          <button
            onClick={runSelfCheck}
            disabled={running || useAppStore.getState().loading}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={16} className={running ? "animate-spin" : ""} />
            {running ? "检测中..." : "立即检测"}
          </button>
        </div>
      </div>

      {selfCheckReport && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            {selfCheckReport.overallPassed ? (
              <CheckCircle size={24} className="text-success-500" />
            ) : (
              <XCircle size={24} className="text-danger-500" />
            )}
            <div>
              <h4 className="text-lg font-semibold text-gray-800">
                总体结果：
                {selfCheckReport.overallPassed ? (
                  <span className="text-success-600">全部通过</span>
                ) : (
                  <span className="text-danger-600">存在问题</span>
                )}
              </h4>
              <p className="text-sm text-gray-500">
                <Clock size={14} className="inline mr-1" />
                检测时间：{new Date(selfCheckReport.checkedAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {checkItems.map((item) => (
              <div
                key={item.key}
                className={`card p-4 ${
                  item.passed
                    ? "border-l-4 border-l-success-500"
                    : "border-l-4 border-l-danger-500"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <span className="font-medium text-gray-800">{item.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.passed ? (
                    <span className="text-success-600 text-sm">✓ 通过</span>
                  ) : (
                    <span className="text-danger-600 text-sm">✗ 未通过</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {checkItems.map((item) => (
              <div
                key={item.key}
                className={`card p-4 ${
                  item.passed ? "bg-success-50/50" : "bg-danger-50/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.passed ? "bg-success-100" : "bg-danger-100"
                      }`}
                    >
                      {item.passed ? (
                        <CheckCircle size={20} className="text-success-600" />
                      ) : (
                        <XCircle size={20} className="text-danger-600" />
                      )}
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800">{item.title}</h5>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      item.passed
                        ? "bg-success-100 text-success-700"
                        : "bg-danger-100 text-danger-700"
                    }`}
                  >
                    {item.passed ? "通过" : "未通过"}
                  </span>
                </div>
                <div className="ml-13">
                  {renderDetails(item.key, item.details)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 bg-blue-50 border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">📋 四项自检说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>重复导入检测：</strong>基于 audio_file_id 识别重复，防止同一记录被多次计入
          </li>
          <li>
            <strong>临时替补检测：</strong>含"只在群里说了一句"的记录必须标记为待复核，防止漏审
          </li>
          <li>
            <strong>补录后重算检测：</strong>金额、时长等字段修改后，分账金额必须自动重算
          </li>
          <li>
            <strong>导出一致性检测：</strong>导出CSV、页面展示、API返回必须读取同一数据源，MD5校验一致
          </li>
        </ul>
      </div>
    </div>
  );
}
