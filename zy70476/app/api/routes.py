from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, FileResponse
from typing import Optional, List
from datetime import datetime
import uuid
import os

from app.models.schemas import (
    LakePartition, DetectionRule, InvoiceRed冲Record,
    RuleType, DetectionStatus, BatchRecord, DetectionResult,
    FailedItem
)
from app.models.store import store
from app.services.detector import detector
from app.services.report_generator import report_generator
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["version-reminder"])


@router.post("/partitions", response_model=dict, summary="新增湖仓分区")
async def create_partition(partition: LakePartition):
    try:
        partition_id = store.save_partition(partition)
        return {"success": True, "partition_id": partition_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partitions", response_model=List[LakePartition], summary="获取分区列表")
async def get_partitions(environment: Optional[str] = None):
    try:
        return store.get_partitions(environment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partitions/{partition_id}", response_model=LakePartition, summary="获取单个分区详情")
async def get_partition(partition_id: str):
    try:
        partition = store.get_partition_by_id(partition_id)
        if not partition:
            raise HTTPException(status_code=404, detail="分区不存在")
        return partition
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules", response_model=dict, summary="新增检测规则")
async def create_rule(rule: DetectionRule):
    try:
        rule_id = store.save_rule(rule)
        return {"success": True, "rule_id": rule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules", response_model=List[DetectionRule], summary="获取规则列表")
async def get_rules(rule_type: Optional[RuleType] = None, is_active: Optional[bool] = None):
    try:
        return store.get_rules(rule_type, is_active)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoices", response_model=dict, summary="新增发票红冲记录")
async def create_invoice(invoice: InvoiceRed冲Record):
    try:
        invoice_id = store.save_invoice(invoice)
        return {"success": True, "invoice_id": invoice_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invoices", response_model=List[InvoiceRed冲Record], summary="获取发票红冲记录")
async def get_invoices(environment: Optional[str] = None):
    try:
        return store.get_invoices(environment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detection/run", response_model=dict, summary="执行批量检测")
async def run_detection(rule_type: RuleType = RuleType.NORMAL, executed_by: str = "system"):
    try:
        batch_id = detector.run_batch_detection(rule_type, executed_by)
        return {"success": True, "batch_id": batch_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batches/{batch_id}", response_model=BatchRecord, summary="获取批次详情")
async def get_batch(batch_id: str):
    try:
        batch = store.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        return batch
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batches/{batch_id}/results", response_model=List[DetectionResult], summary="获取批次检测结果")
async def get_batch_results(batch_id: str):
    try:
        return store.get_results(batch_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batches/{batch_id}/failed", response_model=List[FailedItem], summary="获取批次失败项")
async def get_batch_failed_items(batch_id: str):
    try:
        return store.get_failed_items(batch_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{batch_id}/json", summary="获取JSON格式报告")
async def get_report_json(batch_id: str):
    try:
        report = report_generator.generate_report(batch_id)
        content = report_generator.to_json(report)
        store.save_report(batch_id, content, "json")
        return Response(content=content, media_type="application/json")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{batch_id}/markdown", summary="获取Markdown格式报告")
async def get_report_markdown(batch_id: str):
    try:
        report = report_generator.generate_report(batch_id)
        content = report_generator.to_markdown(report)
        store.save_report(batch_id, content, "md")
        return Response(content=content, media_type="text/markdown")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{batch_id}/download", summary="下载报告")
async def download_report(batch_id: str, format: str = Query("json", enum=["json", "md"])):
    try:
        report = report_generator.generate_report(batch_id)
        
        if format == "json":
            content = report_generator.to_json(report)
            filename = f"{batch_id}_report.json"
            media_type = "application/json"
        else:
            content = report_generator.to_markdown(report)
            filename = f"{batch_id}_report.md"
            media_type = "text/markdown"
        
        file_path = settings.REPORTS_DIR / filename
        file_path.write_text(content, encoding="utf-8")
        
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/version/{version}", response_model=DetectionRule, summary="按版本获取历史规则")
async def get_rule_by_version(version: str):
    try:
        rule = store.get_rule_by_version(version)
        if not rule:
            raise HTTPException(status_code=404, detail="规则版本不存在")
        return rule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invoices/environment/{environment}", response_model=List[InvoiceRed冲Record], summary="按环境查询发票红冲记录")
async def get_invoices_by_environment(environment: str):
    try:
        invoices = store.get_invoices(environment)
        if not invoices:
            raise HTTPException(status_code=404, detail="该环境下无发票红冲记录")
        return invoices
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
