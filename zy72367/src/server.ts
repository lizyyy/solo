import http, { type IncomingMessage, type ServerResponse } from "http";
import fs from "fs";
import path from "path";
import type { ProcessingStatus, TensionRecord, BeltThreshold } from "./types.js";
import type { ThresholdConfig } from "./core/processor.js";
import {
  resetWorkflow,
  getCurrentStep,
  advanceStep,
  runFirstImport,
  runTemperatureCalibrationReview,
  runUnitConversionUpdate,
} from "./workflow/index.js";
import {
  getResult,
  resetStore,
  setRecords,
  getRecords,
} from "./core/result-store.js";
import {
  attachSamplingNote,
  updateProcessingStatus,
} from "./core/evidence-trail.js";

const __dirname = path.resolve();
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3876;

let currentConfig: ThresholdConfig = {
  upperLimit: 100,
  lowerLimit: 20,
  unit: "N",
};

let beltThresholds: BeltThreshold[] = [];

type ParsedBody = Record<string, unknown>;

function parseBody(req: IncomingMessage): Promise<ParsedBody> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function recordsToCSV(records: TensionRecord[]): string {
  const headers = [
    "id",
    "originalLineNumber",
    "timestamp",
    "beltId",
    "tensionValue",
    "unit",
    "temperature",
    "temperatureCalibrationNote",
    "isOverThreshold",
    "thresholdValue",
    "processingStatus",
    "avgMasked",
    "dedupCategory",
    "samplingNote",
    "manualChange",
    "manualOverridesCount",
    "importBatchId",
    "importStep",
  ];

  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [headers.join(",")];
  for (const r of records) {
    const row = [
      r.id,
      r.originalLineNumber,
      r.timestamp,
      r.beltId,
      r.tensionValue,
      r.unit,
      r.temperature ?? "",
      r.temperatureCalibrationNote ?? "",
      r.isOverThreshold,
      r.thresholdValue,
      r.processingStatus,
      r.avgMasked,
      r.dedupCategory,
      r.samplingIntervalNote?.note ?? "",
      r.samplingIntervalNote?.manualChange ?? "",
      r.manualOverrides.length,
      r.importBatchId,
      r.importStep,
    ];
    lines.push(row.map(esc).join(","));
  }
  return lines.join("\n");
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (pathname === "/" && method === "GET") {
    const htmlPath = path.join(PUBLIC_DIR, "index.html");
    try {
      const content = fs.readFileSync(htmlPath, "utf-8");
      sendText(res, 200, content, "text/html");
    } catch (e) {
      sendText(res, 404, "Frontend file not found. Please ensure public/index.html exists.", "text/plain");
    }
    return;
  }

  if (pathname === "/api/reset" && method === "GET") {
    resetWorkflow();
    resetStore();
    beltThresholds = [];
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/config" && method === "POST") {
    try {
      const body = await parseBody(req);
      if (
        typeof body.upperLimit === "number" &&
        typeof body.lowerLimit === "number" &&
        typeof body.unit === "string"
      ) {
        currentConfig = {
          upperLimit: body.upperLimit,
          lowerLimit: body.lowerLimit,
          unit: body.unit,
        };
        if (Array.isArray(body.beltThresholds)) {
          beltThresholds = body.beltThresholds as BeltThreshold[];
        }
        sendJson(res, 200, { ok: true, config: currentConfig, beltThresholds });
      } else {
        sendError(res, 400, "Invalid config body. Need upperLimit(number), lowerLimit(number), unit(string)");
      }
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
    return;
  }

  if (pathname === "/api/config" && method === "GET") {
    sendJson(res, 200, { ...currentConfig, beltThresholds });
    return;
  }

  if (pathname === "/api/step" && method === "GET") {
    sendJson(res, 200, { step: getCurrentStep() });
    return;
  }

  if (pathname === "/api/advance-step" && method === "POST") {
    const next = advanceStep();
    sendJson(res, 200, { ok: true, step: getCurrentStep(), nextStep: next, currentStep: getCurrentStep() });
    return;
  }

  if (pathname === "/api/import/first" && method === "POST") {
    try {
      const body = await parseBody(req);
      const records = body.records;
      if (!Array.isArray(records)) {
        sendError(res, 400, "Missing records array in body");
        return;
      }
      const result = runFirstImport(records as any, currentConfig, beltThresholds);
      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
    return;
  }

  if (pathname === "/api/import/calibration" && method === "POST") {
    try {
      const body = await parseBody(req);
      const supplements = body.supplements;
      if (!Array.isArray(supplements)) {
        sendError(res, 400, "Missing supplements array in body");
        return;
      }
      const result = runTemperatureCalibrationReview(supplements as any, currentConfig, beltThresholds);
      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
    return;
  }

  if (pathname === "/api/import/unit" && method === "POST") {
    try {
      const body = await parseBody(req);
      const conversionMap = body.conversionMap;
      if (!Array.isArray(conversionMap)) {
        sendError(res, 400, "Missing conversionMap array in body");
        return;
      }
      for (const entry of conversionMap as any[]) {
        if (entry && entry.fromUnit && entry.toUnit && typeof entry.factor === "number") {
          if (currentConfig.unit === entry.fromUnit) {
            currentConfig = {
              upperLimit: currentConfig.upperLimit * entry.factor,
              lowerLimit: currentConfig.lowerLimit * entry.factor,
              unit: entry.toUnit,
            };
          }
          const existingBeltThresholds = beltThresholds.filter(
            (t) => t.beltId === entry.beltId && t.unit === entry.fromUnit
          );
          for (const old of existingBeltThresholds) {
            const alreadyExists = beltThresholds.some(
              (t) => t.beltId === entry.beltId && t.unit === entry.toUnit
            );
            if (!alreadyExists) {
              beltThresholds.push({
                beltId: entry.beltId,
                unit: entry.toUnit,
                upperLimit: old.upperLimit * entry.factor,
                lowerLimit: old.lowerLimit * entry.factor,
              });
            }
          }
        }
      }
      const result = runUnitConversionUpdate(conversionMap as any, currentConfig, beltThresholds);
      sendJson(res, 200, result);
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
    return;
  }

  if (pathname === "/api/result" && method === "GET") {
    sendJson(res, 200, getResult());
    return;
  }

  if (pathname === "/api/export/csv" && method === "GET") {
    const result = getResult();
    const csv = recordsToCSV(result.records);
    const filename = `tension-inspection-${Date.now()}.csv`;
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": Buffer.byteLength(csv),
    });
    res.end(csv);
    return;
  }

  if (pathname === "/api/evidence/update-status" && method === "POST") {
    try {
      const body = await parseBody(req);
      const recordId = body.recordId as string;
      const newStatus = body.newStatus as ProcessingStatus;
      const reason = (body.reason as string) || "manual update";

      if (!recordId || !newStatus) {
        sendError(res, 400, "Missing recordId or newStatus");
        return;
      }

      const validStatuses: ProcessingStatus[] = [
        "pending_review",
        "confirmed_normal",
        "confirmed_abnormal",
        "overridden_by_average",
      ];
      if (!validStatuses.includes(newStatus)) {
        sendError(res, 400, `Invalid newStatus. Must be one of: ${validStatuses.join(", ")}`);
        return;
      }

      const allRecords = getRecords();
      const idx = allRecords.findIndex((r) => r.id === recordId);
      if (idx === -1) {
        sendError(res, 404, `Record with id ${recordId} not found`);
        return;
      }

      let record = allRecords[idx];
      record = updateProcessingStatus(record, newStatus, reason);
      if (!record.samplingIntervalNote?.note) {
        record = attachSamplingNote(record, "status manually updated during final review", reason);
      }
      allRecords[idx] = record;
      setRecords(allRecords);

      sendJson(res, 200, getResult());
    } catch (e) {
      sendError(res, 400, (e as Error).message);
    }
    return;
  }

  sendError(res, 404, `Route ${method} ${pathname} not found`);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    console.error("Server error:", e);
    sendError(res, 500, (e as Error).message || "Internal server error");
  });
});

server.listen(PORT, () => {
  console.log(`传送带张力巡检 HTTP server running at http://localhost:${PORT}`);
});
