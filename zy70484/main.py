from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import Response, JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json

import models
import schemas
from database import engine, get_db
from services import TenantSuspenderService, CacheService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="租户暂停器后端服务",
    description="处理短信发送清单补录、缓存管理及查询功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/tenants", response_model=schemas.TenantResponse, tags=["租户管理"])
def create_tenant(tenant: schemas.TenantCreate, db: Session = Depends(get_db)):
    existing = TenantSuspenderService.get_tenant_by_code(db, tenant.tenant_code)
    if existing:
        raise HTTPException(status_code=400, detail="租户编码已存在")
    return TenantSuspenderService.create_tenant(db, tenant)


@app.get("/api/tenants/{tenant_code}", response_model=schemas.TenantResponse, tags=["租户管理"])
def get_tenant(tenant_code: str, db: Session = Depends(get_db)):
    tenant = TenantSuspenderService.get_tenant_by_code(db, tenant_code)
    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")
    return tenant


@app.post("/api/sms/backfill", response_model=schemas.ProcessingResult, tags=["短信补录"])
def backfill_sms_records(request: schemas.SmsBackfillRequest, db: Session = Depends(get_db)):
    result, _ = TenantSuspenderService.backfill_sms_records(db, request)
    return result


@app.get("/api/query", tags=["统一查询"])
def query_records(
    batch_no: Optional[str] = Query(None, description="批次号"),
    tenant_code: Optional[str] = Query(None, description="租户编码"),
    status: Optional[str] = Query(None, description="处理状态"),
    format: str = Query("json", description="输出格式: json/markdown"),
    db: Session = Depends(get_db)
):
    records = TenantSuspenderService.query_processing_records(db, batch_no, tenant_code, status)
    
    if format == "markdown":
        md_content = _generate_markdown_report(records)
        return PlainTextResponse(content=md_content, media_type="text/markdown")
    
    return {
        "success": True,
        "count": len(records),
        "data": [
            {
                "id": r.id,
                "batch_no": r.batch_no,
                "tenant_code": r.tenant_code,
                "action": r.action,
                "status": r.status,
                "input_summary": r.input_summary,
                "action_details": r.action_details,
                "conclusion": r.conclusion,
                "error_message": r.error_message,
                "logistics_screenshot_ref": r.logistics_screenshot_ref,
                "executed_by": r.executed_by,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "duration_ms": r.duration_ms
            }
            for r in records
        ]
    }


def _generate_complete_export_content(
    batch_no: str,
    summary: models.MaterialSummary,
    sms_records: list,
    processing_logs: list
) -> str:
    content_parts = []
    content_parts.append(summary.summary_content)
    content_parts.append("")
    content_parts.append("=" * 60)
    content_parts.append("【短信发送明细】")
    content_parts.append("-" * 60)
    for idx, r in enumerate(sms_records, 1):
        content_parts.append(f"{idx}. 手机号: {r.phone_number}")
        content_parts.append(f"   内容: {r.content}")
        content_parts.append(f"   操作人: {r.operator}")
        content_parts.append(f"   部门: {r.department}")
        content_parts.append("")
    content_parts.append("=" * 60)
    content_parts.append("【处理日志明细】")
    content_parts.append("-" * 60)
    for idx, r in enumerate(processing_logs, 1):
        content_parts.append(f"{idx}. 动作: {r.action}")
        content_parts.append(f"   状态: {r.status}")
        content_parts.append(f"   结论: {r.conclusion}")
        content_parts.append(f"   物流截图: {r.logistics_screenshot_ref or '无'}")
        content_parts.append("")
    content_parts.append("=" * 60)
    content_parts.append(f"导出凭证: {summary.export_token}")
    content_parts.append(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return "\n".join(content_parts)


def _generate_complete_markdown_export(
    batch_no: str,
    summary: models.MaterialSummary,
    sms_records: list,
    processing_logs: list
) -> str:
    md_parts = []
    md_parts.append("# 租户暂停器 - 完整复核材料")
    md_parts.append("")
    md_parts.append("## 基本信息")
    md_parts.append(f"- **批次号**: {batch_no}")
    md_parts.append(f"- **租户编码**: {summary.tenant_code}")
    md_parts.append(f"- **记录总数**: {len(sms_records)}条")
    md_parts.append("")
    md_parts.append("## 材料摘要")
    md_parts.append("```")
    md_parts.append(summary.summary_content)
    md_parts.append("```")
    md_parts.append("")
    md_parts.append("## 短信发送明细")
    for idx, r in enumerate(sms_records, 1):
        md_parts.append(f"### 记录 #{idx}")
        md_parts.append(f"- **手机号**: {r.phone_number}")
        md_parts.append(f"- **操作人**: {r.operator}")
        md_parts.append(f"- **部门**: {r.department}")
        md_parts.append("- **短信内容**:")
        md_parts.append("  ```")
        md_parts.append(f"  {r.content}")
        md_parts.append("  ```")
        md_parts.append("")
    md_parts.append("## 处理日志明细")
    for idx, r in enumerate(processing_logs, 1):
        md_parts.append(f"### 处理日志 #{idx}")
        md_parts.append(f"- **动作**: {r.action}")
        md_parts.append(f"- **状态**: {r.status}")
        md_parts.append(f"- **物流截图**: `{r.logistics_screenshot_ref or '无'}`")
        md_parts.append("- **处理结论**:")
        md_parts.append("  ```")
        md_parts.append(f"  {r.conclusion}")
        md_parts.append("  ```")
        md_parts.append("")
    md_parts.append("## 物流拦截复核样例")
    if processing_logs and processing_logs[0].logistics_screenshot_ref:
        md_parts.append(f"- **截图编号**: `{processing_logs[0].logistics_screenshot_ref}`")
        md_parts.append("- **复核说明**: 请核对物流拦截记录中的收件人电话是否与短信发送清单中的号码一致")
        md_parts.append("- **复核状态**: ☐ 一致 ☐ 不一致 ☐ 需进一步核实")
    md_parts.append("")
    md_parts.append("---")
    md_parts.append(f"**导出凭证**: `{summary.export_token}`  ")
    md_parts.append(f"**导出时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return "\n".join(md_parts)


@app.get("/api/summary/{batch_no}/export", tags=["导出"])
def export_summary(
    batch_no: str,
    format: str = Query("json", description="导出格式: json/markdown/text"),
    db: Session = Depends(get_db)
):
    summary = TenantSuspenderService.get_material_summary(db, batch_no)
    if not summary:
        raise HTTPException(status_code=404, detail="批次摘要不存在")
    
    sms_records = TenantSuspenderService.get_all_sms_records(db, batch_no)
    processing_logs = TenantSuspenderService.query_processing_records(db, batch_no=batch_no)
    
    export_data = {
        "batch_no": batch_no,
        "tenant_code": summary.tenant_code,
        "summary_content": summary.summary_content,
        "sms_record_count": len(sms_records),
        "sms_records": [
            {
                "phone_number": r.phone_number,
                "content": r.content,
                "operator": r.operator,
                "department": r.department
            }
            for r in sms_records
        ],
        "processing_logs": [
            {
                "action": r.action,
                "status": r.status,
                "conclusion": r.conclusion,
                "logistics_screenshot_ref": r.logistics_screenshot_ref
            }
            for r in processing_logs
        ],
        "logistics_review_sample": processing_logs[0].logistics_screenshot_ref if processing_logs else None,
        "export_token": summary.export_token,
        "export_time": datetime.now().isoformat()
    }
    
    if format == "markdown":
        md_content = _generate_complete_markdown_export(batch_no, summary, sms_records, processing_logs)
        return PlainTextResponse(content=md_content, media_type="text/markdown")
    
    if format == "text":
        text_content = _generate_complete_export_content(batch_no, summary, sms_records, processing_logs)
        return PlainTextResponse(content=text_content, media_type="text/plain")
    
    return export_data


@app.get("/api/summary/{batch_no}/download", tags=["导出"])
def download_summary(
    batch_no: str,
    format: str = Query("txt", description="下载格式: txt/md"),
    db: Session = Depends(get_db)
):
    summary = TenantSuspenderService.get_material_summary(db, batch_no)
    if not summary:
        raise HTTPException(status_code=404, detail="批次摘要不存在")
    
    sms_records = TenantSuspenderService.get_all_sms_records(db, batch_no)
    processing_logs = TenantSuspenderService.query_processing_records(db, batch_no=batch_no)
    
    if format == "md":
        content = _generate_complete_markdown_export(batch_no, summary, sms_records, processing_logs)
        filename = f"tenant_suspender_summary_{batch_no}_{datetime.now().strftime('%Y%m%d')}.md"
        media_type = "text/markdown"
    else:
        content = _generate_complete_export_content(batch_no, summary, sms_records, processing_logs)
        filename = f"tenant_suspender_summary_{batch_no}_{datetime.now().strftime('%Y%m%d')}.txt"
        media_type = "text/plain"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/cache/{cache_key}/status", response_model=schemas.CacheStatusResponse, tags=["缓存管理"])
def get_cache_status(cache_key: str, db: Session = Depends(get_db)):
    cache = CacheService.get_cache_status(db, cache_key)
    if not cache:
        raise HTTPException(status_code=404, detail="缓存不存在")
    return {
        "cache_key": cache.cache_key,
        "is_stale": cache.is_stale,
        "last_refresh_time": cache.last_refresh_time,
        "refresh_count": cache.refresh_count
    }


@app.post("/api/cache/{cache_key}/mark-stale", tags=["缓存管理"])
def mark_cache_stale(cache_key: str, db: Session = Depends(get_db)):
    CacheService.mark_cache_stale(db, cache_key)
    return {"success": True, "message": f"缓存 {cache_key} 已标记为失效"}


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


def _generate_markdown_report(records: List[models.ProcessingLog]) -> str:
    md_parts = []
    md_parts.append("# 租户暂停器 - 处理记录报告")
    md_parts.append("")
    md_parts.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md_parts.append(f"**记录总数**: {len(records)}条")
    md_parts.append("")
    
    for idx, record in enumerate(records, 1):
        status_icon = "✅" if record.status == "SUCCESS" else "❌" if record.status == "FAILED" else "⚠️"
        md_parts.append(f"## {status_icon} 记录 #{idx}")
        md_parts.append("")
        md_parts.append(f"- **批次号**: {record.batch_no}")
        md_parts.append(f"- **租户编码**: {record.tenant_code}")
        md_parts.append(f"- **动作**: {record.action}")
        md_parts.append(f"- **状态**: {record.status}")
        md_parts.append(f"- **执行时间**: {record.created_at.strftime('%Y-%m-%d %H:%M:%S') if record.created_at else 'N/A'}")
        md_parts.append(f"- **执行人**: {record.executed_by or 'N/A'}")
        md_parts.append(f"- **耗时**: {record.duration_ms}ms" if record.duration_ms else "")
        md_parts.append("")
        md_parts.append("### 输入摘要")
        md_parts.append(f"> {record.input_summary}")
        md_parts.append("")
        md_parts.append("### 动作详情")
        md_parts.append(f"> {record.action_details}")
        md_parts.append("")
        md_parts.append("### 处理结论")
        md_parts.append(f"> {record.conclusion}")
        md_parts.append("")
        if record.error_message:
            md_parts.append("### 错误信息")
            md_parts.append(f"> {record.error_message}")
            md_parts.append("")
        if record.logistics_screenshot_ref:
            md_parts.append("### 物流拦截复核")
            md_parts.append(f"- 截图编号: `{record.logistics_screenshot_ref}`")
            md_parts.append("- 复核状态: `待复核`")
            md_parts.append("")
        md_parts.append("---")
        md_parts.append("")
    
    return "\n".join(md_parts)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
