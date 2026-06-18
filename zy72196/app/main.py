import json
import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.database import init_db, get_conn, row_to_dict
from app.stratifier import (
    run_stratification, incremental_stratification,
    compare_runs, generate_report,
)
from app.demo_data import SAMPLES, EXTRA_SAMPLES, EXTRA_SAMPLES2

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(title="模型评测样本分层工具")


@app.on_event("startup")
def startup():
    init_db()


class SampleInput(BaseModel):
    id: Optional[str] = None
    content: str
    domain: Optional[str] = None
    reference_result: Optional[str] = None
    model_output: Optional[str] = None
    model_confidence: Optional[float] = None
    human_label: Optional[str] = None
    source: Optional[str] = None
    import_batch: Optional[str] = None
    notes: Optional[str] = None


class StratifyRequest(BaseModel):
    samples: list[dict]
    strat_types: Optional[list[str]] = None
    run_type: Optional[str] = "initial"


class IncrementalRequest(BaseModel):
    samples: list[dict]
    strat_types: Optional[list[str]] = None


class ReviewRequest(BaseModel):
    sample_id: str
    new_label: str
    operator: Optional[str] = "人工复核"


class CompareRequest(BaseModel):
    run_id_a: str
    run_id_b: str


@app.get("/")
async def index():
    html_path = os.path.join(BASE_DIR, "static", "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/load-demo")
async def load_demo():
    result = run_stratification(SAMPLES, run_type="initial", operator="演示数据加载")
    return result


@app.post("/api/load-extra")
async def load_extra():
    result = incremental_stratification(EXTRA_SAMPLES, operator="补录数据")
    return result


@app.post("/api/load-extra2")
async def load_extra2():
    result = incremental_stratification(EXTRA_SAMPLES2, operator="补录数据（第二轮）")
    return result


@app.post("/api/samples/import")
async def import_samples(req: StratifyRequest):
    result = run_stratification(req.samples, strat_types=req.strat_types,
                                run_type=req.run_type, operator="API导入")
    return result


@app.post("/api/samples/incremental")
async def import_incremental(req: IncrementalRequest):
    result = incremental_stratification(req.samples, strat_types=req.strat_types,
                                        operator="API增量导入")
    return result


@app.get("/api/samples")
async def list_samples(status: Optional[str] = None):
    with get_conn() as conn:
        samples = []
        rows = conn.execute("SELECT * FROM samples ORDER BY import_time").fetchall()
        for r in rows:
            s = row_to_dict(r)
            if s.get("raw_json"):
                try:
                    s["raw_json"] = json.loads(s["raw_json"])
                except Exception:
                    pass
            samples.append(s)
        if status:
            samples = [s for s in samples if s.get("status") == status]
        return {"samples": samples, "total": len(samples)}


@app.get("/api/samples/{sample_id}")
async def get_sample(sample_id: str):
    with get_conn() as conn:
        sample = row_to_dict(conn.execute("SELECT * FROM samples WHERE id=?", (sample_id,)).fetchone())
        if not sample:
            raise HTTPException(404, f"样本 {sample_id} 不存在")
        stratifications = []
        for r in conn.execute(
            "SELECT * FROM stratification_results WHERE sample_id=? ORDER BY created_at DESC",
            (sample_id,),
        ).fetchall():
            d = row_to_dict(r)
            if d.get("evidence"):
                try:
                    d["evidence"] = json.loads(d["evidence"])
                except Exception:
                    pass
            stratifications.append(d)
        audit = []
        for r in conn.execute(
            "SELECT * FROM audit_log WHERE sample_id=? ORDER BY timestamp",
            (sample_id,),
        ).fetchall():
            d = row_to_dict(r)
            for field in ("before_value", "after_value"):
                if d.get(field):
                    try:
                        d[field] = json.loads(d[field])
                    except Exception:
                        pass
            audit.append(d)
        return {"sample": sample, "stratifications": stratifications, "audit_trail": audit}


@app.post("/api/review")
async def human_review(req: ReviewRequest):
    with get_conn() as conn:
        from app.database import update_human_label
        update_human_label(conn, req.sample_id, req.new_label, req.operator)
        return {"status": "ok", "message": f"样本 {req.sample_id} 标签已更新为「{req.new_label}」"}


@app.get("/api/runs")
async def list_runs():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM runs ORDER BY run_time DESC").fetchall()
        runs = []
        for r in rows:
            d = row_to_dict(r)
            if d.get("metrics_json"):
                try:
                    d["metrics_json"] = json.loads(d["metrics_json"])
                except Exception:
                    pass
            runs.append(d)
        return {"runs": runs}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    with get_conn() as conn:
        run = row_to_dict(conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone())
        if not run:
            raise HTTPException(404, f"运行记录 {run_id} 不存在")
        if run.get("metrics_json"):
            try:
                run["metrics_json"] = json.loads(run["metrics_json"])
            except Exception:
                pass
        metrics = []
        for r in conn.execute("SELECT * FROM metric_snapshots WHERE run_id=?", (run_id,)).fetchall():
            metrics.append(row_to_dict(r))
        stratifications = []
        for r in conn.execute(
            """SELECT sr.*, s.content, s.domain, s.reference_result, s.model_output,
                      s.model_confidence, s.human_label, s.is_duplicate, s.duplicate_of, s.source
               FROM stratification_results sr
               JOIN samples s ON sr.sample_id = s.id
               WHERE sr.run_id=?
               ORDER BY sr.stratum_type, sr.stratum""",
            (run_id,),
        ).fetchall():
            d = row_to_dict(r)
            if d.get("evidence"):
                try:
                    d["evidence"] = json.loads(d["evidence"])
                except Exception:
                    pass
            stratifications.append(d)
        return {"run": run, "metrics": metrics, "stratifications": stratifications}


@app.post("/api/compare")
async def compare(req: CompareRequest):
    result = compare_runs(req.run_id_a, req.run_id_b)
    return result


@app.get("/api/report/{run_id}")
async def report(run_id: str):
    result = generate_report(run_id)
    return result


@app.post("/api/rerun")
async def rerun(strat_types: Optional[list[str]] = None):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM samples WHERE is_duplicate=0 AND status IN ('stratified', 'reviewed', 'duplicate') ORDER BY import_time"
        ).fetchall()
        samples = [row_to_dict(r) for r in rows]

    if not samples:
        raise HTTPException(400, "没有可重跑的样本，请先导入数据")

    for s in samples:
        s["is_duplicate"] = 0
        s["duplicate_of"] = None
        s["status"] = "pending"

    result = run_stratification(samples, strat_types=strat_types, run_type="rerun", operator="重跑")
    return result


app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
