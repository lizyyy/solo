"""本地 API 服务"""

import os
import tempfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .models import IssueType, ValidationResult
from .service import AuditService


app = FastAPI(
    title="经营周报一致性复核 API",
    description="用于连锁咖啡运营在发周报前进行数据一致性复核的轻量 API 服务",
    version="0.1.0",
)


class IssueResponse(BaseModel):
    issue_type: str
    metric_name: str
    message: str
    expected_value: Optional[float]
    reported_value: Optional[float]
    difference: Optional[float]
    store_id: Optional[str]
    context: Optional[str]


class MetricResponse(BaseModel):
    metric_name: str
    display_name: str
    value: float
    store_breakdown: Optional[Dict[str, float]]


class ValidationResultResponse(BaseModel):
    is_valid: bool
    total_issues: int
    critical_issues: int
    warning_issues: int
    issues: List[IssueResponse]
    calculated_metrics: List[MetricResponse]
    report_metrics: List[MetricResponse]


class StatisticsResponse(BaseModel):
    store_count: int
    store_ids: List[str]
    order_count: int
    refund_count: int
    labor_record_count: int
    metric_rule_count: int
    report_type: str
    validation: Optional[Dict]


def _decimal_to_float(value: Decimal) -> float:
    """将 Decimal 转换为 float"""
    return float(value)


def _convert_issue(issue) -> IssueResponse:
    """转换 Issue 模型为响应模型"""
    return IssueResponse(
        issue_type=issue.issue_type.value,
        metric_name=issue.metric_name,
        message=issue.message,
        expected_value=_decimal_to_float(issue.expected_value) if issue.expected_value else None,
        reported_value=_decimal_to_float(issue.reported_value) if issue.reported_value else None,
        difference=_decimal_to_float(issue.difference) if issue.difference else None,
        store_id=issue.store_id,
        context=issue.context,
    )


def _convert_metric(metric) -> MetricResponse:
    """转换 Metric 模型为响应模型"""
    store_breakdown = None
    if metric.store_breakdown:
        store_breakdown = {
            k: _decimal_to_float(v) for k, v in metric.store_breakdown.items()
        }
    
    return MetricResponse(
        metric_name=metric.metric_name,
        display_name=metric.display_name,
        value=_decimal_to_float(metric.value),
        store_breakdown=store_breakdown,
    )


def _convert_result(result: ValidationResult) -> ValidationResultResponse:
    """转换验证结果为响应模型"""
    return ValidationResultResponse(
        is_valid=result.is_valid,
        total_issues=result.total_issues,
        critical_issues=result.critical_issues,
        warning_issues=result.warning_issues,
        issues=[_convert_issue(i) for i in result.issues],
        calculated_metrics=[_convert_metric(m) for m in result.calculated_metrics],
        report_metrics=[_convert_metric(m) for m in result.report_metrics],
    )


@app.get("/")
async def root():
    """根路径，返回服务信息"""
    return {
        "service": "经营周报一致性复核 API",
        "version": "0.1.0",
        "status": "running",
        "endpoints": {
            "validate": "POST /validate",
            "audit": "POST /audit",
            "export": "POST /export/markdown, POST /export/csv",
            "docs": "/docs, /redoc",
        }
    }


@app.post("/validate", response_model=ValidationResultResponse)
async def validate_report(
    orders: UploadFile = File(..., description="订单数据 CSV 文件"),
    refunds: UploadFile = File(..., description="退款数据 CSV 文件"),
    labor_costs: UploadFile = File(..., description="人工成本 CSV 文件"),
    metric_rules: UploadFile = File(..., description="指标规则 YAML 文件"),
    report: UploadFile = File(..., description="待验证的报告文件 (.md 或 .json)"),
):
    """
    验证报告数据一致性
    
    上传业务数据文件和待验证的报告文件，执行一致性复核并返回验证结果。
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        orders_path = temp_path / "orders.csv"
        refunds_path = temp_path / "refunds.csv"
        labor_path = temp_path / "labor_costs.csv"
        rules_path = temp_path / "metric_rules.yaml"
        
        report_ext = os.path.splitext(report.filename)[1] if report.filename else '.md'
        report_path = temp_path / f"report{report_ext}"
        
        for file_obj, dest_path in [
            (orders, orders_path),
            (refunds, refunds_path),
            (labor_costs, labor_path),
            (metric_rules, rules_path),
            (report, report_path),
        ]:
            content = await file_obj.read()
            with open(dest_path, 'wb') as f:
                f.write(content)
            await file_obj.close()
        
        try:
            service = AuditService()
            result = service.audit(
                orders_path,
                refunds_path,
                labor_path,
                rules_path,
                report_path,
            )
            
            return _convert_result(result)
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/audit")
async def audit_report(
    orders: UploadFile = File(..., description="订单数据 CSV 文件"),
    refunds: UploadFile = File(..., description="退款数据 CSV 文件"),
    labor_costs: UploadFile = File(..., description="人工成本 CSV 文件"),
    metric_rules: UploadFile = File(..., description="指标规则 YAML 文件"),
    report: UploadFile = File(..., description="待验证的报告文件 (.md 或 .json)"),
    format: str = "json",
):
    """
    执行完整审计并生成报告
    
    执行完整的一致性复核流程，并可以导出报告。
    
    - format=json: 返回 JSON 格式的完整结果
    - format=markdown: 下载 Markdown 格式的报告
    - format=csv: 下载 CSV 格式的问题明细
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        orders_path = temp_path / "orders.csv"
        refunds_path = temp_path / "refunds.csv"
        labor_path = temp_path / "labor_costs.csv"
        rules_path = temp_path / "metric_rules.yaml"
        
        report_ext = os.path.splitext(report.filename)[1] if report.filename else '.md'
        report_path = temp_path / f"report{report_ext}"
        
        for file_obj, dest_path in [
            (orders, orders_path),
            (refunds, refunds_path),
            (labor_costs, labor_path),
            (metric_rules, rules_path),
            (report, report_path),
        ]:
            content = await file_obj.read()
            with open(dest_path, 'wb') as f:
                f.write(content)
            await file_obj.close()
        
        try:
            service = AuditService()
            result = service.audit(
                orders_path,
                refunds_path,
                labor_path,
                rules_path,
                report_path,
            )
            
            if format == "json":
                return _convert_result(result)
            elif format == "markdown":
                output_path = temp_path / "audit_report.md"
                service.export_markdown_report(output_path, result)
                return FileResponse(
                    path=str(output_path),
                    media_type="text/markdown",
                    filename=f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
                )
            elif format == "csv":
                output_path = temp_path / "audit_issues.csv"
                service.export_csv_report(output_path, result)
                return FileResponse(
                    path=str(output_path),
                    media_type="text/csv",
                    filename=f"audit_issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                )
            else:
                raise HTTPException(status_code=400, detail=f"不支持的格式: {format}")
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/export/markdown")
async def export_markdown(
    orders: UploadFile = File(...),
    refunds: UploadFile = File(...),
    labor_costs: UploadFile = File(...),
    metric_rules: UploadFile = File(...),
    report: UploadFile = File(...),
):
    """导出 Markdown 格式的差异报告"""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        orders_path = temp_path / "orders.csv"
        refunds_path = temp_path / "refunds.csv"
        labor_path = temp_path / "labor_costs.csv"
        rules_path = temp_path / "metric_rules.yaml"
        
        report_ext = os.path.splitext(report.filename)[1] if report.filename else '.md'
        report_path = temp_path / f"report{report_ext}"
        
        for file_obj, dest_path in [
            (orders, orders_path),
            (refunds, refunds_path),
            (labor_costs, labor_path),
            (metric_rules, rules_path),
            (report, report_path),
        ]:
            content = await file_obj.read()
            with open(dest_path, 'wb') as f:
                f.write(content)
            await file_obj.close()
        
        try:
            service = AuditService()
            result = service.audit(
                orders_path,
                refunds_path,
                labor_path,
                rules_path,
                report_path,
            )
            
            output_path = temp_path / "audit_report.md"
            service.export_markdown_report(output_path, result)
            
            return FileResponse(
                path=str(output_path),
                media_type="text/markdown",
                filename=f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            )
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.post("/export/csv")
async def export_csv(
    orders: UploadFile = File(...),
    refunds: UploadFile = File(...),
    labor_costs: UploadFile = File(...),
    metric_rules: UploadFile = File(...),
    report: UploadFile = File(...),
):
    """导出 CSV 格式的问题明细"""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        orders_path = temp_path / "orders.csv"
        refunds_path = temp_path / "refunds.csv"
        labor_path = temp_path / "labor_costs.csv"
        rules_path = temp_path / "metric_rules.yaml"
        
        report_ext = os.path.splitext(report.filename)[1] if report.filename else '.md'
        report_path = temp_path / f"report{report_ext}"
        
        for file_obj, dest_path in [
            (orders, orders_path),
            (refunds, refunds_path),
            (labor_costs, labor_path),
            (metric_rules, rules_path),
            (report, report_path),
        ]:
            content = await file_obj.read()
            with open(dest_path, 'wb') as f:
                f.write(content)
            await file_obj.close()
        
        try:
            service = AuditService()
            result = service.audit(
                orders_path,
                refunds_path,
                labor_path,
                rules_path,
                report_path,
            )
            
            output_path = temp_path / "audit_issues.csv"
            service.export_csv_report(output_path, result)
            
            return FileResponse(
                path=str(output_path),
                media_type="text/csv",
                filename=f"audit_issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
