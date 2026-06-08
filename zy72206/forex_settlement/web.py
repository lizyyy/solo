import os
import tempfile
from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates
from .repository import SettlementRepository
from .models import ProcessingStep


def create_app(data_dir: str = "./data") -> FastAPI:
    app = FastAPI(title="外汇远期交割排程", version="1.0.0")

    templates_dir = os.path.join(os.path.dirname(__file__), "templates")
    templates = Jinja2Templates(directory=templates_dir)

    repo = SettlementRepository(data_dir=data_dir)

    @app.get("/", response_class=HTMLResponse)
    def page_index(request: Request):
        records = repo.get_records_for_display()
        blocking_map = {}
        for r in repo.get_all_records():
            info = repo.get_blocking_info(r.id)
            if info and info["is_blocked"]:
                blocking_map[r.id] = info
        return templates.TemplateResponse("index.html", {
            "request": request,
            "records": records,
            "blocking_map": blocking_map,
        })

    @app.get("/records/{record_id}", response_class=HTMLResponse)
    def page_record_detail(request: Request, record_id: str):
        record = repo.get_record_for_api(record_id)
        if not record:
            return HTMLResponse("<h3>记录不存在</h3>", status_code=404)
        blocking = repo.get_blocking_info(record_id)
        audit_logs_raw = repo.get_audit_logs(record_id)
        audit_logs = [
            {
                "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "action": log.action,
                "operator": log.operator,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "note": log.note,
            }
            for log in audit_logs_raw
        ]
        return templates.TemplateResponse("detail.html", {
            "request": request,
            "record": record,
            "blocking": blocking,
            "audit_logs": audit_logs,
        })

    @app.get("/blocking", response_class=HTMLResponse)
    def page_blocking(request: Request):
        records = repo.get_all_records()
        blocking_records = []
        for r in records:
            info = repo.get_blocking_info(r.id)
            if info and info["is_blocked"]:
                detail = repo.get_record_for_api(r.id)
                info["detail"] = detail
                blocking_records.append(info)
        return templates.TemplateResponse("blocking.html", {
            "request": request,
            "blocking_records": blocking_records,
        })

    @app.get("/api/records", response_class=JSONResponse)
    def api_list_records(step: Optional[str] = None):
        if step:
            records = repo.get_records_by_step(ProcessingStep(step))
            return [repo._record_to_dict(r) for r in records]
        return repo.get_records_for_export()

    @app.get("/api/records/{record_id}", response_class=JSONResponse)
    def api_get_record(record_id: str):
        data = repo.get_record_for_api(record_id)
        if not data:
            return JSONResponse({"error": "记录不存在"}, status_code=404)
        return data

    @app.get("/api/blocking", response_class=JSONResponse)
    def api_blocking():
        records = repo.get_all_records()
        result = []
        for r in records:
            info = repo.get_blocking_info(r.id)
            if info and info["is_blocked"]:
                info["record_detail"] = repo.get_record_for_api(r.id)
                result.append(info)
        return result

    @app.get("/api/records/{record_id}/audit", response_class=JSONResponse)
    def api_audit_logs(record_id: str):
        logs = repo.get_audit_logs(record_id)
        return [
            {
                "id": log.id,
                "action": log.action,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "operator": log.operator,
                "timestamp": log.timestamp.isoformat(),
                "note": log.note,
            }
            for log in logs
        ]

    @app.post("/api/records/{record_id}/advance", response_class=JSONResponse)
    def api_advance(record_id: str, operator: str = Form("operator")):
        record = repo.advance_record_step(record_id, operator)
        if not record:
            return JSONResponse({"error": "推进失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/records/{record_id}/tax-rate", response_class=JSONResponse)
    def api_update_tax_rate(
        record_id: str,
        tax_rate: float = Form(...),
        tax_rate_remark: str = Form(...),
        operator: str = Form("afen"),
    ):
        record = repo.update_record_tax_rate(record_id, tax_rate, tax_rate_remark, operator)
        if not record:
            return JSONResponse({"error": "更新失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/records/{record_id}/risk-review", response_class=JSONResponse)
    def api_risk_review(
        record_id: str,
        approved: bool = Form(...),
        review_note: str = Form(...),
        operator: str = Form("risk"),
    ):
        record = repo.risk_review_record(record_id, approved, review_note, operator)
        if not record:
            return JSONResponse({"error": "复核失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/records/{record_id}/summary", response_class=JSONResponse)
    def api_update_summary(
        record_id: str,
        summary_remark: str = Form(...),
        operator: str = Form("manager"),
    ):
        record = repo.update_record_summary(record_id, summary_remark, operator)
        if not record:
            return JSONResponse({"error": "更新失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/records/{record_id}/reverse", response_class=JSONResponse)
    def api_reverse(record_id: str, reason: str = Form(...), operator: str = Form("operator")):
        record = repo.reverse_record(record_id, reason, operator)
        if not record:
            return JSONResponse({"error": "冲正失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/records/{record_id}/rollback", response_class=JSONResponse)
    def api_rollback(
        record_id: str,
        to_step: str = Form(...),
        reason: str = Form(...),
        operator: str = Form("operator"),
    ):
        record = repo.rollback_record(record_id, ProcessingStep(to_step), operator, reason)
        if not record:
            return JSONResponse({"error": "回滚失败"}, status_code=400)
        return repo.get_record_for_api(record_id)

    @app.post("/api/import", response_class=JSONResponse)
    async def api_import(file: UploadFile = File(...), operator: str = Form("system")):
        suffix = os.path.splitext(file.filename or ".xlsx")[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        try:
            records = repo.import_from_excel(tmp_path, operator)
            return {
                "imported_count": len(records),
                "records": [repo._record_to_dict(r) for r in records],
            }
        finally:
            os.unlink(tmp_path)

    @app.get("/api/export")
    def api_export():
        tmp_path = os.path.join(tempfile.gettempdir(), "settlement_export.xlsx")
        repo.export_to_excel(tmp_path)
        return FileResponse(
            tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="settlement_export.xlsx",
        )

    return app
