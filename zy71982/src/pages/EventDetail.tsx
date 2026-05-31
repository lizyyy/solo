import { useParams, useNavigate } from "react-router-dom";
import { useQueueStore } from "@/store/useQueueStore";
import StatusTag from "@/components/StatusTag";
import StatusTimeline from "@/components/StatusTimeline";
import ExceptionPanel from "@/components/ExceptionPanel";
import RevokeForm from "@/components/RevokeForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatTimestamp, formatRelativeTime } from "@/utils/statusHelpers";
import { EXCEPTION_LABELS } from "@/types";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEventById, getStatusChanges, getAuditLogs } = useQueueStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "audit" | "payload">(
    "timeline"
  );

  const event = getEventById(id || "");
  const statusChanges = getStatusChanges(id || "");
  const auditLogs = getAuditLogs(id || "");

  if (!event) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            事件不存在
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-3 text-sm text-amber-600 dark:text-amber-400 hover:underline"
          >
            返回队列
          </button>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { key: "timeline" as const, label: "状态时间线" },
    { key: "audit" as const, label: `审计日志 (${auditLogs.length})` },
    { key: "payload" as const, label: "Payload" },
  ];

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="h-14 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            事件详情
          </h1>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {event.id}
          </span>
        </div>
        <StatusTag status={event.status} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="幂等键" value={event.idempotencyKey} mono copyable />
            <InfoItem label="接入方" value={event.clientId} />
            <InfoItem
              label="Webhook地址"
              value={event.webhookUrl}
              mono
              copyable
            />
            <InfoItem
              label="异常类型"
              value={
                event.exceptionType !== "none"
                  ? EXCEPTION_LABELS[event.exceptionType]
                  : "无"
              }
              highlight={event.exceptionType !== "none"}
            />
            <InfoItem
              label="创建时间"
              value={formatTimestamp(event.createdAt)}
              sub={formatRelativeTime(event.createdAt)}
            />
            <InfoItem
              label="最后更新"
              value={formatTimestamp(event.updatedAt)}
              sub={formatRelativeTime(event.updatedAt)}
            />
            <InfoItem label="数据版本" value={event.version} mono />
          </div>

          {event.exceptionType !== "none" && (
            <ExceptionPanel exceptionType={event.exceptionType} />
          )}

          <div className="flex items-center gap-3">
            <ConfirmDialog
              eventId={event.id}
              currentStatus={event.status}
              onDone={() => {}}
            />
            <RevokeForm eventId={event.id} onDone={() => {}} />
          </div>

          <div>
            <div className="flex border-b border-zinc-200 dark:border-zinc-700">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-amber-500 text-amber-700 dark:text-amber-300"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {activeTab === "timeline" && (
                <StatusTimeline eventId={event.id} />
              )}

              {activeTab === "audit" && (
                <div className="space-y-2">
                  {auditLogs.length === 0 && (
                    <div className="text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center">
                      暂无审计日志
                    </div>
                  )}
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {log.action}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {log.detail}
                      </div>
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        操作人: {log.operator}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "payload" && (
                <div className="relative">
                  <button
                    onClick={() => copyToClipboard(event.payload)}
                    className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        复制
                      </>
                    )}
                  </button>
                  <pre className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-x-auto text-xs font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {formatJson(event.payload)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  sub,
  mono,
  copyable,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  copyable?: boolean;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm ${mono ? "font-mono" : ""} ${
            highlight
              ? "text-amber-600 dark:text-amber-400 font-medium"
              : "text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {value}
        </span>
        {sub && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            ({sub})
          </span>
        )}
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
