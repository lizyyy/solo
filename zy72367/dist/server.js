"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("./workflow/index.js");
const result_store_js_1 = require("./core/result-store.js");
const evidence_trail_js_1 = require("./core/evidence-trail.js");
const __dirname = path_1.default.resolve();
const PUBLIC_DIR = path_1.default.join(__dirname, "public");
const PORT = 3876;
let currentConfig = {
    upperLimit: 100,
    lowerLimit: 20,
    unit: "N",
};
function parseBody(req) {
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
            }
            catch (e) {
                reject(new Error("Invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}
function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
}
function sendText(res, status, body, contentType) {
    res.writeHead(status, {
        "Content-Type": `${contentType}; charset=utf-8`,
        "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
}
function sendError(res, status, message) {
    sendJson(res, status, { error: message });
}
function recordsToCSV(records) {
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
    const esc = (v) => {
        if (v === null || v === undefined)
            return "";
        const s = String(v);
        if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };
    const lines = [headers.join(",")];
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
async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method || "GET";
    const pathname = url.pathname;
    if (pathname === "/" && method === "GET") {
        const htmlPath = path_1.default.join(PUBLIC_DIR, "index.html");
        try {
            const content = fs_1.default.readFileSync(htmlPath, "utf-8");
            sendText(res, 200, content, "text/html");
        }
        catch (e) {
            sendText(res, 404, "Frontend file not found. Please ensure public/index.html exists.", "text/plain");
        }
        return;
    }
    if (pathname === "/api/reset" && method === "GET") {
        (0, index_js_1.resetWorkflow)();
        (0, result_store_js_1.resetStore)();
        sendJson(res, 200, { ok: true });
        return;
    }
    if (pathname === "/api/config" && method === "POST") {
        try {
            const body = await parseBody(req);
            if (typeof body.upperLimit === "number" &&
                typeof body.lowerLimit === "number" &&
                typeof body.unit === "string") {
                currentConfig = {
                    upperLimit: body.upperLimit,
                    lowerLimit: body.lowerLimit,
                    unit: body.unit,
                };
                sendJson(res, 200, { ok: true, config: currentConfig });
            }
            else {
                sendError(res, 400, "Invalid config body. Need upperLimit(number), lowerLimit(number), unit(string)");
            }
        }
        catch (e) {
            sendError(res, 400, e.message);
        }
        return;
    }
    if (pathname === "/api/config" && method === "GET") {
        sendJson(res, 200, currentConfig);
        return;
    }
    if (pathname === "/api/step" && method === "GET") {
        sendJson(res, 200, { step: (0, index_js_1.getCurrentStep)() });
        return;
    }
    if (pathname === "/api/advance-step" && method === "POST") {
        const next = (0, index_js_1.advanceStep)();
        sendJson(res, 200, { ok: true, nextStep: next, currentStep: (0, index_js_1.getCurrentStep)() });
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
            const result = (0, index_js_1.runFirstImport)(records, currentConfig);
            sendJson(res, 200, result);
        }
        catch (e) {
            sendError(res, 400, e.message);
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
            const result = (0, index_js_1.runTemperatureCalibrationReview)(supplements, currentConfig);
            sendJson(res, 200, result);
        }
        catch (e) {
            sendError(res, 400, e.message);
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
            const result = (0, index_js_1.runUnitConversionUpdate)(conversionMap, currentConfig);
            sendJson(res, 200, result);
        }
        catch (e) {
            sendError(res, 400, e.message);
        }
        return;
    }
    if (pathname === "/api/result" && method === "GET") {
        sendJson(res, 200, (0, result_store_js_1.getResult)());
        return;
    }
    if (pathname === "/api/export/csv" && method === "GET") {
        const result = (0, result_store_js_1.getResult)();
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
            const recordId = body.recordId;
            const newStatus = body.newStatus;
            const reason = body.reason || "manual update";
            if (!recordId || !newStatus) {
                sendError(res, 400, "Missing recordId or newStatus");
                return;
            }
            const validStatuses = [
                "pending_review",
                "confirmed_normal",
                "confirmed_abnormal",
                "overridden_by_average",
            ];
            if (!validStatuses.includes(newStatus)) {
                sendError(res, 400, `Invalid newStatus. Must be one of: ${validStatuses.join(", ")}`);
                return;
            }
            const allRecords = (0, result_store_js_1.getRecords)();
            const idx = allRecords.findIndex((r) => r.id === recordId);
            if (idx === -1) {
                sendError(res, 404, `Record with id ${recordId} not found`);
                return;
            }
            let record = allRecords[idx];
            record = (0, evidence_trail_js_1.updateProcessingStatus)(record, newStatus, reason);
            if (!record.samplingIntervalNote?.note) {
                record = (0, evidence_trail_js_1.attachSamplingNote)(record, "status manually updated during final review", reason);
            }
            allRecords[idx] = record;
            (0, result_store_js_1.setRecords)(allRecords);
            sendJson(res, 200, (0, result_store_js_1.getResult)());
        }
        catch (e) {
            sendError(res, 400, e.message);
        }
        return;
    }
    sendError(res, 404, `Route ${method} ${pathname} not found`);
}
const server = http_1.default.createServer((req, res) => {
    route(req, res).catch((e) => {
        console.error("Server error:", e);
        sendError(res, 500, e.message || "Internal server error");
    });
});
server.listen(PORT, () => {
    console.log(`传送带张力巡检 HTTP server running at http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map