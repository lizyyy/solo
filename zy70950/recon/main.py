"""体检中心对账服务 HTTP 入口."""

from __future__ import annotations

from fastapi import Body, FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import PlainTextResponse
from typing import Optional

from . import service
from .importers import parse_additions_csv, parse_agreements_json, parse_packages_json
from .schemas import ReviewStatus

app = FastAPI(
    title="体检中心对账服务",
    version="0.1.0",
    description="导入 → 自动比对 → 人工复核 → 重新计算 → 报告下载",
)


def _wrap_http(exc: Exception, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail=str(exc))


# ---------------- 会话 ---------------- #

@app.get("/sessions")
def list_sessions():
    return [s.model_dump() for s in service.list_sessions()]


@app.post("/sessions")
def create_session(name: str = Body(..., embed=True), note: str = Body(default="", embed=True)):
    return service.create_session(name=name, note=note).model_dump()


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    try:
        return service.get_session(session_id).model_dump()
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


# ---------------- 导入 ---------------- #

@app.post("/sessions/{session_id}/import/additions")
async def import_additions(session_id: str, file: UploadFile = File(...)):
    try:
        raw = (await file.read()).decode("utf-8")
        records = parse_additions_csv(raw)
        n = service.import_additions(session_id, records)
        return {"imported": n}
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)
    except Exception as e:  # pragma: no cover - 解析错误直接透出
        raise _wrap_http(e)


@app.post("/sessions/{session_id}/import/packages")
async def import_packages(session_id: str, file: UploadFile = File(...)):
    try:
        raw = (await file.read()).decode("utf-8")
        pkgs = parse_packages_json(raw)
        n = service.import_packages(session_id, pkgs)
        return {"imported": n}
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)
    except Exception as e:
        raise _wrap_http(e)


@app.post("/sessions/{session_id}/import/agreements")
async def import_agreements(session_id: str, file: UploadFile = File(...)):
    try:
        raw = (await file.read()).decode("utf-8")
        ags = parse_agreements_json(raw)
        n = service.import_agreements(session_id, ags)
        return {"imported": n}
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)
    except Exception as e:
        raise _wrap_http(e)


# ---------------- 自动比对 ---------------- #

@app.post("/sessions/{session_id}/match")
def match(session_id: str):
    try:
        items = service.run_match(session_id)
        return {
            "matched": len(items),
            "items": [it.model_dump() for it in items],
        }
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


# ---------------- 人工复核 ---------------- #

@app.post("/sessions/{session_id}/review")
def review(
    session_id: str,
    trace_id: str = Body(..., embed=True),
    status: ReviewStatus = Body(..., embed=True),
    adjustment_amount: float = Body(default=0.0, embed=True),
    comment: str = Body(default="", embed=True),
):
    try:
        item = service.apply_review(
            session_id, trace_id=trace_id, status=status,
            adjustment_amount=adjustment_amount, comment=comment,
        )
        return item.model_dump()
    except KeyError:
        raise _wrap_http(Exception("trace_id not found"), 404)


# ---------------- 重新计算 ---------------- #

@app.post("/sessions/{session_id}/recalc")
def recalc(session_id: str):
    try:
        return service.recalc(session_id).model_dump()
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


# ---------------- 汇总 / 明细 / 报告 ---------------- #

@app.get("/sessions/{session_id}/summary")
def summary(session_id: str):
    try:
        return service.summarize(session_id).model_dump()
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


@app.get("/sessions/{session_id}/details")
def details(session_id: str, trace_id: Optional[str] = Query(default=None)):
    try:
        return service.details(session_id, trace_id=trace_id)
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


@app.get("/sessions/{session_id}/report.csv")
def report_csv(session_id: str):
    try:
        csv_text = service.build_report_csv(session_id)
        return PlainTextResponse(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=recon-{session_id}.csv"},
        )
    except KeyError:
        raise _wrap_http(Exception("session not found"), 404)


def _start() -> None:  # pragma: no cover - CLI
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":  # pragma: no cover
    _start()
