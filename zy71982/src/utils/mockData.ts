import type {
  CompensationEvent,
  StatusChange,
  AuditLog,
  EventStatus,
  ExceptionType,
} from "@/types";

const CLIENT_IDS = [
  "payment-svc",
  "order-svc",
  "notify-svc",
  "inventory-svc",
  "user-svc",
  "report-svc",
];

const STATUSES: EventStatus[] = [
  "pending",
  "processing",
  "success",
  "failed",
  "pending_confirm_idempotency",
  "pending_confirm_audit_gap",
  "pending_confirm_param_corrupted",
  "revoked",
];

const EXCEPTION_MAP: Record<EventStatus, ExceptionType> = {
  pending: "none",
  processing: "none",
  success: "none",
  failed: "none",
  pending_confirm_idempotency: "idempotency_key_collision",
  pending_confirm_audit_gap: "audit_log_gap",
  pending_confirm_param_corrupted: "client_param_corrupted",
  revoked: "none",
};

const WEBHOOK_URLS = [
  "https://api.example.com/webhooks/payment",
  "https://api.example.com/webhooks/order",
  "https://api.example.com/webhooks/notify",
  "https://api.example.com/webhooks/inventory",
  "https://api.example.com/webhooks/user",
  "https://api.example.com/webhooks/report",
];

function makePayload(clientId: string, idx: number): string {
  const templates: Record<string, object> = {
    "payment-svc": {
      orderId: `ORD-${idx.toString().padStart(4, "0")}`,
      amount: (idx * 17.3).toFixed(2),
      currency: "CNY",
    },
    "order-svc": {
      orderId: `ORD-${idx.toString().padStart(4, "0")}`,
      action: idx % 3 === 0 ? "create" : "update",
      items: [{ sku: `SKU-${idx}`, qty: idx % 5 + 1 }],
    },
    "notify-svc": {
      templateId: `TPL-${idx % 10}`,
      recipient: `user-${idx}@example.com`,
      channel: idx % 2 === 0 ? "email" : "sms",
    },
    "inventory-svc": {
      sku: `SKU-${idx}`,
      warehouse: `WH-${idx % 3}`,
      delta: idx % 2 === 0 ? 10 : -5,
    },
    "user-svc": {
      userId: `USR-${idx.toString().padStart(4, "0")}`,
      event: idx % 2 === 0 ? "register" : "login",
    },
    "report-svc": {
      reportType: idx % 3 === 0 ? "daily" : "weekly",
      date: new Date(Date.now() - idx * 86400000).toISOString().slice(0, 10),
    },
  };
  return JSON.stringify(templates[clientId] || { data: idx });
}

function makeCorruptedPayload(clientId: string, idx: number): string {
  const payload = JSON.parse(makePayload(clientId, idx));
  if (idx % 3 === 0) {
    delete payload.orderId;
    delete payload.amount;
  } else if (idx % 3 === 1) {
    payload.amount = "NOT_A_NUMBER";
  } else {
    payload.items = null;
  }
  return JSON.stringify(payload);
}

let eventCounter = 0;
let changeCounter = 0;
let logCounter = 0;

function uid(prefix: string): string {
  const counter = prefix === "evt" ? eventCounter++ : prefix === "sc" ? changeCounter++ : logCounter++;
  return `${prefix}_${counter.toString().padStart(4, "0")}`;
}

export function generateMockData(): {
  events: CompensationEvent[];
  statusChanges: StatusChange[];
  auditLogs: AuditLog[];
} {
  eventCounter = 0;
  changeCounter = 0;
  logCounter = 0;

  const events: CompensationEvent[] = [];
  const statusChanges: StatusChange[] = [];
  const auditLogs: AuditLog[] = [];
  const now = Date.now();

  const distribution: { status: EventStatus; count: number }[] = [
    { status: "pending", count: 8 },
    { status: "processing", count: 4 },
    { status: "success", count: 15 },
    { status: "failed", count: 6 },
    { status: "pending_confirm_idempotency", count: 5 },
    { status: "pending_confirm_audit_gap", count: 4 },
    { status: "pending_confirm_param_corrupted", count: 3 },
    { status: "revoked", count: 3 },
  ];

  for (const { status, count } of distribution) {
    for (let i = 0; i < count; i++) {
      const clientId = CLIENT_IDS[(eventCounter) % CLIENT_IDS.length];
      const isCorrupted = status === "pending_confirm_param_corrupted";
      const payload = isCorrupted
        ? makeCorruptedPayload(clientId, eventCounter)
        : makePayload(clientId, eventCounter);

      const createdAt = now - Math.floor(Math.random() * 7 * 86400000);
      const updatedAt = createdAt + Math.floor(Math.random() * 3600000);

      const evt: CompensationEvent = {
        id: uid("evt"),
        idempotencyKey: `idk_${clientId}_${eventCounter.toString().padStart(4, "0")}`,
        status,
        exceptionType: EXCEPTION_MAP[status],
        clientId,
        webhookUrl: WEBHOOK_URLS[(eventCounter) % WEBHOOK_URLS.length],
        payload,
        createdAt,
        updatedAt,
        version: "1.0",
      };
      events.push(evt);

      statusChanges.push({
        id: uid("sc"),
        eventId: evt.id,
        fromStatus: "",
        toStatus: "pending",
        reason: "事件入队",
        operator: "system",
        timestamp: createdAt,
      });

      if (status !== "pending") {
        const processingTime = createdAt + Math.floor(Math.random() * 60000);
        statusChanges.push({
          id: uid("sc"),
          eventId: evt.id,
          fromStatus: "pending",
          toStatus: "processing",
          reason: "开始处理",
          operator: "system",
          timestamp: processingTime,
        });

        if (status !== "processing") {
          const resultTime = processingTime + Math.floor(Math.random() * 120000);
          const isException = status.startsWith("pending_confirm");

          statusChanges.push({
            id: uid("sc"),
            eventId: evt.id,
            fromStatus: "processing",
            toStatus: status,
            reason: isException
              ? `检测到异常：${EXCEPTION_MAP[status] === "idempotency_key_collision" ? "幂等键冲突" : EXCEPTION_MAP[status] === "audit_log_gap" ? "审计日志缺口" : "客户端参数异常"}`
              : status === "success"
                ? "处理成功"
                : status === "failed"
                  ? "处理失败：目标服务返回错误"
                  : "用户撤回",
            operator: isException ? "system" : status === "revoked" ? "admin" : "system",
            timestamp: resultTime,
          });

          if (status === "pending_confirm_audit_gap" && i % 2 === 0) {
            const gapStart = processingTime + 30000;
            const gapEnd = gapStart + 420000;
            statusChanges.push({
              id: uid("sc"),
              eventId: evt.id,
              fromStatus: "processing",
              toStatus: "processing",
              reason: "[日志缺口] 处理中间状态丢失",
              operator: "system",
              timestamp: gapStart,
            });
            auditLogs.push({
              id: uid("log"),
              eventId: evt.id,
              action: "gap_detected",
              detail: `检测到审计日志缺口：${new Date(gapStart).toISOString()} 至 ${new Date(gapEnd).toISOString()}，间隔 ${Math.round((gapEnd - gapStart) / 60000)} 分钟`,
              operator: "system",
              timestamp: gapEnd,
            });
          }
        }
      }

      auditLogs.push({
        id: uid("log"),
        eventId: evt.id,
        action: "created",
        detail: `事件创建，幂等键=${evt.idempotencyKey}`,
        operator: "system",
        timestamp: createdAt,
      });

      if (status === "success" || status === "failed") {
        auditLogs.push({
          id: uid("log"),
          eventId: evt.id,
          action: "completed",
          detail: `事件处理${status === "success" ? "成功" : "失败"}`,
          operator: "system",
          timestamp: updatedAt,
        });
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const dupIdx = i + events.length - 20;
    if (dupIdx >= 0 && dupIdx < events.length) {
      const orig = events[dupIdx];
      events.push({
        ...orig,
        id: uid("evt"),
        createdAt: orig.createdAt + 5000,
        updatedAt: orig.updatedAt + 5000,
        status: "pending_confirm_idempotency",
        exceptionType: "idempotency_key_collision",
      });
    }
  }

  return { events, statusChanges, auditLogs };
}
