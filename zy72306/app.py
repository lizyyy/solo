from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional, List
from pathlib import Path
import json

from src import StateStore, AnomalyResult, ReviewRecord, ManualModification

app = FastAPI(
    title="时间序列异常分解 API",
    description="所有接口从同一份 StateStore 读取，确保列表、详情、摘要、导出数据完全一致",
    version="2.0.0"
)

DEFAULT_WORKDIR = "./output"


def get_store(workdir: str = DEFAULT_WORKDIR) -> StateStore:
    store = StateStore(workdir=workdir)
    if not store.exists():
        raise HTTPException(
            status_code=404,
            detail=f"工作目录 {workdir} 中没有找到 StateStore，请先运行 import 命令导入数据"
        )
    return store


@app.get("/api/health", tags=["系统"])
def health_check():
    """健康检查"""
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/list", tags=["数据接口"])
def list_results(
    workdir: str = Query(DEFAULT_WORKDIR, description="工作目录"),
    pending_only: bool = Query(False, description="只显示待验证/待复核的记录")
):
    """列表接口：和 CLI `list` 命令读同一份数据"""
    store = get_store(workdir)
    results = store.get_results()
    if pending_only:
        results = [
            r for r in results
            if r.anomaly_type == "pending_verification" or r.process_status in ["pending_review"]
        ]

    return {
        "metadata": {
            "snapshot_version": store.metadata.current_version,
            "result_count": len(results),
            "consistency": store.consistency_check()
        },
        "data": [r.to_dict() for r in results]
    }


@app.get("/api/detail/{row_number}", tags=["数据接口"])
def detail_result(row_number: int, workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")):
    """详情接口：和 CLI `detail` 命令读同一份数据，包含完整的人工修改、复核记录证据链"""
    store = get_store(workdir)
    result = store.get_result(row_number)
    if result is None:
        raise HTTPException(status_code=404, detail=f"行号 {row_number} 不存在")

    consistency = store.consistency_check(row_number)

    return {
        "metadata": {
            "snapshot_version": result.snapshot_version,
            "consistency": consistency
        },
        "data": result.to_dict(),
        "evidence_chain": {
            "manual_modifications": [m.to_dict() for m in result.manual_modifications],
            "review_records": [r.to_dict() for r in result.review_records],
            "audit_trail": [a.to_dict() for a in store.get_audit_trail(row_number)]
        }
    }


@app.get("/api/summary", tags=["数据接口"])
def get_summary(workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")):
    """摘要接口：和 CLI `summary` 命令读同一份数据"""
    store = get_store(workdir)
    summary = store.get_summary()
    return {
        "metadata": {
            "snapshot_version": store.metadata.current_version,
            "consistency": store.consistency_check()
        },
        "data": summary.to_dict()
    }


@app.get("/api/history/{row_number}", tags=["数据接口"])
def get_history(row_number: Optional[int] = None, workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")):
    """历史记录接口：和 CLI `history` 命令读同一份数据"""
    store = get_store(workdir)
    audits = store.get_audit_trail(row_number)
    return {
        "metadata": {
            "snapshot_version": store.metadata.current_version,
            "record_count": len(audits)
        },
        "data": [a.to_dict() for a in audits]
    }


@app.get("/api/verify", tags=["数据接口"])
def verify_consistency(
    row_number: Optional[int] = Query(None, description="指定行号，不填则检查全部"),
    workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")
):
    """一致性检查接口：和 CLI `verify` 命令读同一份数据"""
    store = get_store(workdir)
    result = store.consistency_check(row_number)
    return result


@app.get("/api/export/csv", tags=["导出接口"])
def export_csv(workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")):
    """导出 CSV：和 CLI `export` 命令读同一份数据"""
    store = get_store(workdir)
    exporter = store.get_exporter()
    path = Path(workdir) / "api_export.csv"
    exporter.export_to_csv(str(path), flat=False)
    return FileResponse(str(path), media_type="text/csv", filename="timeseries_anomaly.csv")


@app.get("/api/export/excel", tags=["导出接口"])
def export_excel(workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")):
    """导出 Excel（4个 Sheet）：和 CLI `export` 命令读同一份数据"""
    store = get_store(workdir)
    exporter = store.get_exporter()
    path = Path(workdir) / "api_export.xlsx"
    exporter.export_to_excel(str(path))
    return FileResponse(
        str(path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="timeseries_anomaly.xlsx"
    )


@app.post("/api/modify/{row_number}", tags=["操作接口"])
def modify_record(
    row_number: int,
    field_name: str = Query(..., description="要修改的字段名，如 denominator, teacher_comment"),
    new_value: str = Query(..., description="新值"),
    reason: str = Query(..., description="修改原因"),
    modified_by: str = Query("API 调用者", description="修改人"),
    workdir: str = Query(DEFAULT_WORKDIR, description="工作目录")
):
    """人工补录/修正接口：修改后列表、详情、摘要、导出 全部自动同步"""
    store = get_store(workdir)

    def _convert_value(field_name, value):
        if field_name in ["numerator", "denominator", "ratio"]:
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        return value

    new_val = _convert_value(field_name, new_value)
    result = store.apply_manual_modification(
        row_number=row_number,
        field_name=field_name,
        new_value=new_val,
        actor=modified_by,
        reason=reason
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"行号 {row_number} 不存在")

    consistency = store.consistency_check(row_number)

    exporter = store.get_exporter()
    exporter.export_to_csv(str(Path(workdir) / "timeseries_anomaly.csv"))
    exporter.export_to_excel(str(Path(workdir) / "timeseries_anomaly.xlsx"))

    return {
        "status": "ok",
        "message": f"行号 {row_number} 的 {field_name} 已修改为 {new_val}",
        "consistency": consistency,
        "data": result.to_dict()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
