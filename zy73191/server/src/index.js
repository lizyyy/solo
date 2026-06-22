const express = require("express");
const cors = require("cors");
const { contentHash } = require("./lib/hash");
const { extractFromContent } = require("./lib/extract");
const { buildReviewPair } = require("./lib/review");
const db = require("./db");

const CASE_ID = "default";
const FACT_KEY = "boundary-safety";

async function start() {
  await db.initDB();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.post("/api/materials", (req, res) => {
    const { type, version, source, content, quote } = req.body;
    if (!type || !content) {
      return res.status(400).json({ error: "type 和 content 必填" });
    }
    const validTypes = ["历史答案", "后补备注", "口头备注"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type 必须为 ${validTypes.join("/")}` });
    }
    const hash = contentHash(type, version || "", content);
    const existing = db.findMaterialByHash(hash);
    if (existing) {
      return res.json({ duplicated: true, refId: existing.id, submittedId: existing.id, material: existing });
    }
    const extracted = extractFromContent(content);
    const contributes = {};
    if (extracted.recurrence) contributes.recurrence = extracted.recurrence;
    if (extracted.boundary) contributes.boundary = extracted.boundary;
    const hasContributes = Object.keys(contributes).length > 0;
    const finalQuote = quote || extracted.quote || "";
    const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const material = {
      id,
      type,
      version: version || "",
      source: source || "",
      content,
      contentHash: hash,
      quote: finalQuote,
      contributes: hasContributes ? contributes : undefined,
      createdAt: db.now(),
    };
    db.insertMaterial(material);
    res.json({ duplicated: false, refId: id, submittedId: id, material });
  });

  app.get("/api/materials", (_req, res) => {
    res.json(db.listMaterials());
  });

  app.post("/api/review", (req, res) => {
    const { primary, steps } = req.body;
    const materials = db.listMaterials();
    if (materials.length === 0) {
      return res.status(400).json({ error: "没有材料，无法复核" });
    }
    const pair = buildReviewPair(materials, steps || 6);
    if (!pair) {
      return res.status(400).json({
        error:
          "无法构建复核：需要至少一份「历史答案」类型材料，且其内容需包含递推式（如 a_n = a1 / (a2-3)）和边界值（如 a_0 = 5, a_1 = 3）。",
      });
    }
    if (primary === "fixed") pair.primary = "fixed";
    const runId = `rv-${Date.now().toString(36)}`;
    db.insertReviewRun({
      id: runId,
      caseId: CASE_ID,
      primary: pair.primary,
      payload: pair,
      createdAt: db.now(),
    });
    if (!db.getJudgment(CASE_ID, FACT_KEY)) {
      const divStep = pair.old.result.find((s) => s.status === "divzero");
      const autoValue = divStep
        ? "边界有除零风险（n=" + divStep.n + "）"
        : "边界安全（未见异常）";
      db.upsertJudgment(CASE_ID, FACT_KEY, autoValue);
      db.addAudit({
        id: `a-auto-${Date.now().toString(36)}`,
        caseId: CASE_ID,
        factKey: FACT_KEY,
        prevValue: "—（未复核）",
        nextValue: autoValue,
        reason: "自动复核：系统根据材料自动推演得出",
        actor: "系统",
        ts: db.now(),
      });
    }
    res.json(pair);
  });

  app.get("/api/review", (_req, res) => {
    const latest = db.latestReview(CASE_ID);
    if (!latest) return res.json(null);
    res.json(latest);
  });

  app.get("/api/reviews", (_req, res) => {
    res.json(db.listReviews(CASE_ID));
  });

  app.post("/api/judgment", (req, res) => {
    const { value, reason, actor } = req.body;
    if (!value || !reason || !actor) {
      return res.status(400).json({ error: "value、reason、actor 必填" });
    }
    const prev = db.getJudgment(CASE_ID, FACT_KEY);
    const prevValue = prev ? prev.value : "—（未复核）";
    db.upsertJudgment(CASE_ID, FACT_KEY, value);
    const entry = {
      id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      caseId: CASE_ID,
      factKey: FACT_KEY,
      prevValue,
      nextValue: value,
      reason,
      actor,
      ts: db.now(),
    };
    db.addAudit(entry);
    res.json({ ok: true, entry });
  });

  app.get("/api/judgment", (_req, res) => {
    const j = db.getJudgment(CASE_ID, FACT_KEY);
    res.json(j || { caseId: CASE_ID, factKey: FACT_KEY, value: "—（未复核）", ts: null });
  });

  app.get("/api/audit", (_req, res) => {
    res.json(db.listAudit(CASE_ID));
  });

  app.post("/api/seed", (_req, res) => {
    const seedData = [
      {
        id: "m-hist-v1",
        type: "历史答案",
        version: "v1（旧版）",
        source: "历史答案库 · 2026-06-18",
        content: "数列递推 a_n = a_{n-1} / (a_{n-2} - 3)；边界 a_0 = 5, a_1 = 3。",
        quote: "边界 a_0 = 5, a_1 = 3",
      },
      {
        id: "m-note-fix",
        type: "后补备注",
        version: "v2",
        source: "小岑 · 后补",
        content: "更正：边界 a_1 应为 2（旧版 a_1=3 会在 n=3 处使分母 a_{n-2}-3 = 0）。",
        quote: "a_1 应为 2",
      },
      {
        id: "m-verbal",
        type: "口头备注",
        version: "—",
        source: "复盘口头录音",
        content: "我记得边界 a_1 取过 3。",
        quote: "a_1 取过 3",
      },
    ];
    const results = [];
    for (const s of seedData) {
      const hash = contentHash(s.type, s.version, s.content);
      const existing = db.findMaterialByHash(hash);
      if (existing) {
        results.push({ duplicated: true, refId: existing.id });
        continue;
      }
      const extracted = extractFromContent(s.content);
      const contributes = {};
      if (extracted.recurrence) contributes.recurrence = extracted.recurrence;
      if (extracted.boundary) contributes.boundary = extracted.boundary;
      const hasContributes = Object.keys(contributes).length > 0;
      db.insertMaterial({
        id: s.id,
        type: s.type,
        version: s.version,
        source: s.source,
        content: s.content,
        contentHash: hash,
        quote: s.quote || extracted.quote || "",
        contributes: hasContributes ? contributes : undefined,
        createdAt: db.now(),
      });
      results.push({ duplicated: false, refId: s.id });
    }
    res.json({ seeded: results });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`数列递推边界复核 · 后端服务已启动 http://localhost:${PORT}`);
    console.log(`SQLite 数据库: ${db.DB_PATH}`);
    console.log(`API 前缀: /api`);
  });
}

start().catch((e) => {
  console.error("启动失败:", e);
  process.exit(1);
});
