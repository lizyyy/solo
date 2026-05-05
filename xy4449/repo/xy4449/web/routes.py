from datetime import datetime, date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
import json

from web.app import get_scanner, get_preflight_engine
from models import (
    WorkOrder, WorkOrderStatus,
    PaperStock,
    MaintenanceRecord,
    CuttingTemplate,
    PreflightResult, PreflightStatus,
    ReviewStatus, ReviewRecord
)


orders_router = APIRouter()
stocks_router = APIRouter()
maintenance_router = APIRouter()
templates_router = APIRouter()
preflight_router = APIRouter()
review_router = APIRouter()
export_router = APIRouter()


class NoteRequest(BaseModel):
    note: str
    author: str = "operator"


class UpdateStatusRequest(BaseModel):
    status: WorkOrderStatus


class ReviewRequest(BaseModel):
    status: ReviewStatus
    reviewer: str
    notes: Optional[str] = None
    actions_required: List[str] = []


class RiskRule(BaseModel):
    id: str
    name: str
    description: str
    severity: str
    condition: str
    action: str
    enabled: bool = True


class RulesConfig:
    _instance = None
    rules: Dict[str, RiskRule] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_default_rules()
        return cls._instance
    
    def _init_default_rules(self):
        default_rules = [
            RiskRule(
                id="R001",
                name="缺失字体",
                description="当PDF中检测到缺失字体时触发",
                severity="critical",
                condition="font_check == FAILED",
                action="REVIEW_REQUIRED",
                enabled=True
            ),
            RiskRule(
                id="R002",
                name="纸张不足",
                description="当所需纸张数量不足时触发",
                severity="critical",
                condition="paper_check == FAILED",
                action="REVIEW_REQUIRED",
                enabled=True
            ),
            RiskRule(
                id="R003",
                name="尺寸不匹配",
                description="当PDF尺寸与裁切模板不匹配时触发",
                severity="high",
                condition="size_check == FAILED",
                action="REVIEW_REQUIRED",
                enabled=True
            ),
            RiskRule(
                id="R004",
                name="机器冲突",
                description="当生产时间与机器保养冲突时触发",
                severity="high",
                condition="machine_check == FAILED",
                action="REVIEW_REQUIRED",
                enabled=True
            ),
            RiskRule(
                id="R005",
                name="低库存警告",
                description="当库存低于警戒线时触发",
                severity="medium",
                condition="paper_check == WARNING",
                action="FLAG_FOR_REVIEW",
                enabled=True
            ),
            RiskRule(
                id="R006",
                name="多模板匹配",
                description="当找到多个匹配的裁切模板时触发",
                severity="medium",
                condition="size_check == WARNING",
                action="FLAG_FOR_REVIEW",
                enabled=True
            )
        ]
        
        for rule in default_rules:
            self.rules[rule.id] = rule
    
    def get_all_rules(self) -> List[RiskRule]:
        return list(self.rules.values())
    
    def get_rule(self, rule_id: str) -> Optional[RiskRule]:
        return self.rules.get(rule_id)
    
    def add_rule(self, rule: RiskRule):
        self.rules[rule.id] = rule
    
    def update_rule(self, rule_id: str, rule: RiskRule):
        self.rules[rule_id] = rule
    
    def delete_rule(self, rule_id: str) -> bool:
        if rule_id in self.rules:
            del self.rules[rule_id]
            return True
        return False
    
    def toggle_rule(self, rule_id: str) -> Optional[RiskRule]:
        rule = self.rules.get(rule_id)
        if rule:
            rule.enabled = not rule.enabled
            return rule
        return None


rules_config = RulesConfig()


class PersistenceManager:
    _instance = None
    review_records: Dict[str, ReviewRecord] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def add_review(self, review: ReviewRecord):
        self.review_records[review.id] = review
    
    def get_review(self, review_id: str) -> Optional[ReviewRecord]:
        return self.review_records.get(review_id)
    
    def get_reviews_for_order(self, order_id: str) -> List[ReviewRecord]:
        return [
            r for r in self.review_records.values()
            if r.work_order_id == order_id
        ]
    
    def get_all_reviews(self) -> List[ReviewRecord]:
        return list(self.review_records.values())


persistence_manager = PersistenceManager()


@orders_router.get("/", response_model=List[WorkOrder])
async def get_orders(
    status: Optional[WorkOrderStatus] = Query(None, description="按状态筛选"),
    customer: Optional[str] = Query(None, description="按客户名称筛选")
):
    scanner = get_scanner()
    orders = scanner.get_all_work_orders()
    
    if status:
        orders = [o for o in orders if o.status == status]
    if customer:
        orders = [o for o in orders if o.customer_name and customer.lower() in o.customer_name.lower()]
    
    return orders


@orders_router.get("/{order_id}", response_model=WorkOrder)
async def get_order(order_id: str):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@orders_router.post("/{order_id}/notes")
async def add_note(order_id: str, request: NoteRequest):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    order.add_note(request.note, request.author)
    return {"message": "备注已添加", "notes": order.notes}


@orders_router.put("/{order_id}/status")
async def update_status(order_id: str, request: UpdateStatusRequest):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    order.status = request.status
    order.update_timestamp()
    order.add_note(f"状态更新为: {request.status.value}")
    
    return {"message": "状态已更新", "status": order.status}


@orders_router.get("/{order_id}/preflight", response_model=List[PreflightResult])
async def get_order_preflight_results(order_id: str):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    results = scanner.get_preflight_results_for_order(order_id)
    return results


@stocks_router.get("/", response_model=List[PaperStock])
async def get_stocks(
    low_stock_only: bool = Query(False, description="仅显示低库存")
):
    scanner = get_scanner()
    if low_stock_only:
        return scanner.get_low_stock_items()
    return scanner.get_all_paper_stocks()


@stocks_router.get("/{stock_id}", response_model=PaperStock)
async def get_stock(stock_id: str):
    scanner = get_scanner()
    stock = scanner.get_paper_stock(stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="库存不存在")
    return stock


@maintenance_router.get("/", response_model=List[MaintenanceRecord])
async def get_maintenance_records(
    active_only: bool = Query(False, description="仅显示进行中的保养")
):
    scanner = get_scanner()
    if active_only:
        return scanner.get_active_maintenance()
    return scanner.get_all_maintenance_records()


@maintenance_router.get("/{record_id}", response_model=MaintenanceRecord)
async def get_maintenance_record(record_id: str):
    scanner = get_scanner()
    record = scanner.get_maintenance_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="保养记录不存在")
    return record


@templates_router.get("/", response_model=List[CuttingTemplate])
async def get_templates():
    scanner = get_scanner()
    return scanner.get_all_cutting_templates()


@templates_router.get("/{template_id}", response_model=CuttingTemplate)
async def get_template(template_id: str):
    scanner = get_scanner()
    template = scanner.get_cutting_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="裁切模板不存在")
    return template


@preflight_router.post("/run/{order_id}")
async def run_preflight(order_id: str):
    scanner = get_scanner()
    engine = get_preflight_engine()
    
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    stocks = scanner.get_all_paper_stocks()
    maintenance = scanner.get_all_maintenance_records()
    templates = scanner.get_all_cutting_templates()
    
    engine.update_paper_stocks(stocks)
    engine.update_maintenance_records(maintenance)
    engine.update_templates(templates)
    
    result = engine.run_preflight(order)
    scanner.add_preflight_result(result)
    
    return {
        "message": "预检完成",
        "result_id": result.id,
        "status": result.status.value,
        "score": result.overall_score,
        "risk_level": result.risk_level
    }


@preflight_router.get("/results/{result_id}", response_model=PreflightResult)
async def get_preflight_result(result_id: str):
    scanner = get_scanner()
    result = scanner.get_preflight_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="预检结果不存在")
    return result


@review_router.get("/rules", response_model=List[RiskRule])
async def get_rules():
    return rules_config.get_all_rules()


@review_router.get("/rules/{rule_id}", response_model=RiskRule)
async def get_rule(rule_id: str):
    rule = rules_config.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@review_router.post("/rules", response_model=RiskRule)
async def add_rule(rule: RiskRule):
    rules_config.add_rule(rule)
    return rule


@review_router.put("/rules/{rule_id}", response_model=RiskRule)
async def update_rule(rule_id: str, rule: RiskRule):
    existing = rules_config.get_rule(rule_id)
    if not existing:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    rules_config.update_rule(rule_id, rule)
    return rule


@review_router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    success = rules_config.delete_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"message": "规则已删除"}


@review_router.post("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str):
    rule = rules_config.toggle_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"message": "规则状态已切换", "enabled": rule.enabled}


@review_router.post("/order/{order_id}")
async def review_order(order_id: str, request: ReviewRequest):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    preflight_results = scanner.get_preflight_results_for_order(order_id)
    if not preflight_results:
        raise HTTPException(status_code=400, detail="该工单没有预检结果，请先运行预检")
    
    latest_result = preflight_results[-1]
    
    review_id = f"RV{datetime.now().strftime('%Y%m%d%H%M%S')}"
    review = ReviewRecord(
        id=review_id,
        work_order_id=order_id,
        preflight_result_id=latest_result.id
    )
    
    if request.status == ReviewStatus.APPROVED:
        review.approve(request.reviewer, request.notes or "")
        order.status = WorkOrderStatus.REVIEW_APPROVED
    elif request.status == ReviewStatus.REJECTED:
        review.reject(request.reviewer, request.notes or "", request.actions_required)
        order.status = WorkOrderStatus.REVIEW_REJECTED
    else:
        review.request_clarification(request.reviewer, request.notes or "")
        order.status = WorkOrderStatus.REVIEW_PENDING
    
    persistence_manager.add_review(review)
    order.add_note(f"复核完成: {request.status.value} (审核人: {request.reviewer})")
    
    return {
        "message": "复核已完成",
        "review_id": review.id,
        "status": review.status.value,
        "order_status": order.status.value
    }


@review_router.get("/order/{order_id}", response_model=List[ReviewRecord])
async def get_order_reviews(order_id: str):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    return persistence_manager.get_reviews_for_order(order_id)


@review_router.get("/", response_model=List[ReviewRecord])
async def get_all_reviews():
    return persistence_manager.get_all_reviews()


@export_router.get("/markdown/{order_id}")
async def export_markdown(order_id: str):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    preflight_results = scanner.get_preflight_results_for_order(order_id)
    reviews = persistence_manager.get_reviews_for_order(order_id)
    
    markdown = generate_production_handover(order, preflight_results, reviews)
    
    from config import settings
    output_path = os.path.join(settings.OUTPUT_DIR, f"{order_id}_交接单.md")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown)
    
    return FileResponse(
        path=output_path,
        filename=f"{order_id}_生产交接单.md",
        media_type="text/markdown"
    )


@export_router.get("/json/{order_id}")
async def export_json(order_id: str):
    scanner = get_scanner()
    order = scanner.get_work_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    preflight_results = scanner.get_preflight_results_for_order(order_id)
    reviews = persistence_manager.get_reviews_for_order(order_id)
    
    audit_package = generate_audit_package(order, preflight_results, reviews)
    
    from config import settings
    output_path = os.path.join(settings.OUTPUT_DIR, f"{order_id}_审计包.json")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
    
    return FileResponse(
        path=output_path,
        filename=f"{order_id}_审计包.json",
        media_type="application/json"
    )


def generate_production_handover(
    order: WorkOrder,
    preflight_results: List[PreflightResult],
    reviews: List[ReviewRecord]
) -> str:
    latest_preflight = preflight_results[-1] if preflight_results else None
    latest_review = reviews[-1] if reviews else None
    
    md = f"""# 生产交接单

> 工单编号: {order.id}
> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 基本信息

| 项目 | 内容 |
|------|------|
| 工单编号 | {order.id} |
| 文件名 | {order.file_name} |
| 客户名称 | {order.customer_name or '未指定'} |
| 工单名称 | {order.job_name or '未指定'} |
| 数量 | {order.quantity or '未指定'} 张 |
| 页数 | {order.page_count} 页 |
| 当前状态 | {order.status.value} |
| 上传时间 | {order.uploaded_at.strftime('%Y-%m-%d %H:%M:%S') if order.uploaded_at else '未知'} |

---

## 纸张信息

| 项目 | 内容 |
|------|------|
| 纸张类型 | {order.paper_type or '未指定'} |
| 纸张尺寸 | {order.paper_size or f'{order.paper_width or "?"} x {order.paper_height or "?"} mm'} |
| 裁切模板 | {order.cutting_template_id or '未指定'} |

---

## 字体信息

- **需要字体**: {', '.join(order.required_fonts) if order.required_fonts else '无'}
- **缺失字体**: {', '.join(order.missing_fonts) if order.missing_fonts else '无'}

---

## 预检结果
"""
    
    if latest_preflight:
        md += f"""
### 总体评估

- **状态**: {latest_preflight.status.value.upper()}
- **得分**: {latest_preflight.overall_score:.1f} / 100
- **风险等级**: {latest_preflight.risk_level.upper()}
- **检查时间**: {latest_preflight.completed_at.strftime('%Y-%m-%d %H:%M:%S') if latest_preflight.completed_at else '未知'}

### 详细检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 字体检查 | {latest_preflight.font_check.value.upper()} | {get_check_message(latest_preflight, 'font')} |
| 纸张检查 | {latest_preflight.paper_check.value.upper()} | {get_check_message(latest_preflight, 'paper')} |
| 尺寸检查 | {latest_preflight.size_check.value.upper()} | {get_check_message(latest_preflight, 'size')} |
| 机器检查 | {latest_preflight.machine_check.value.upper()} | {get_check_message(latest_preflight, 'machine')} |

"""
        if latest_preflight.missing_fonts:
            md += f"""
### ⚠️ 问题详情

**缺失字体**:
{chr(10).join([f'- {font}' for font in latest_preflight.missing_fonts])}

"""
    else:
        md += """
> 该工单尚未进行预检
"""
    
    md += """---

## 复核记录
"""
    
    if reviews:
        for idx, review in enumerate(reviews, 1):
            md += f"""
### 复核 #{idx}

| 项目 | 内容 |
|------|------|
| 复核编号 | {review.id} |
| 状态 | {review.status.value.upper()} |
| 审核人 | {review.reviewer or '未指定'} |
| 审核时间 | {review.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if review.reviewed_at else '未知'} |
| 备注 | {review.notes or '无'} |

"""
            if review.actions_required:
                md += f"""
**需要执行的操作**:
{chr(10).join([f'- {action}' for action in review.actions_required])}

"""
    else:
        md += """
> 该工单尚未进行复核
"""
    
    md += """---

## 备注历史
"""
    
    if order.notes:
        for note in order.notes:
            md += f"- {note}\n"
    else:
        md += "> 暂无备注\n"
    
    md += f"""

---

*此文档由印刷店自动化工具自动生成*
"""
    
    return md


def get_check_message(result: PreflightResult, check_type: str) -> str:
    for check in result.checks:
        if check.check_type == check_type:
            return check.message
    return "无信息"


def generate_audit_package(
    order: WorkOrder,
    preflight_results: List[PreflightResult],
    reviews: List[ReviewRecord]
) -> Dict[str, Any]:
    return {
        "audit_id": f"AUD{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "version": "1.0.0",
        
        "work_order": {
            "id": order.id,
            "file_name": order.file_name,
            "file_path": order.file_path,
            "customer_name": order.customer_name,
            "job_name": order.job_name,
            "quantity": order.quantity,
            "page_count": order.page_count,
            "paper_type": order.paper_type,
            "paper_size": order.paper_size,
            "paper_width": order.paper_width,
            "paper_height": order.paper_height,
            "cutting_template_id": order.cutting_template_id,
            "status": order.status.value,
            "required_fonts": order.required_fonts,
            "missing_fonts": order.missing_fonts,
            "notes": order.notes,
            "uploaded_at": order.uploaded_at.isoformat() if order.uploaded_at else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None
        },
        
        "preflight_results": [
            {
                "id": r.id,
                "work_order_id": r.work_order_id,
                "status": r.status.value,
                "font_check": r.font_check.value,
                "paper_check": r.paper_check.value,
                "size_check": r.size_check.value,
                "machine_check": r.machine_check.value,
                "missing_fonts": r.missing_fonts,
                "required_paper": r.required_paper,
                "paper_available": r.paper_available,
                "paper_quantity_required": r.paper_quantity_required,
                "paper_quantity_available": r.paper_quantity_available,
                "size_mismatch_details": r.size_mismatch_details,
                "machine_conflicts": r.machine_conflicts,
                "conflicting_maintenance": r.conflicting_maintenance,
                "overall_score": r.overall_score,
                "risk_level": r.risk_level,
                "checks": [
                    {
                        "check_name": c.check_name,
                        "check_type": c.check_type,
                        "status": c.status.value,
                        "message": c.message,
                        "details": c.details,
                        "severity": c.severity
                    }
                    for c in r.checks
                ],
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "duration_seconds": r.duration_seconds
            }
            for r in preflight_results
        ],
        
        "review_records": [
            {
                "id": r.id,
                "work_order_id": r.work_order_id,
                "preflight_result_id": r.preflight_result_id,
                "status": r.status.value,
                "reviewer": r.reviewer,
                "notes": r.notes,
                "actions_required": r.actions_required,
                "risk_assessment": r.risk_assessment,
                "mitigation_notes": r.mitigation_notes,
                "next_reviewer": r.next_reviewer,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            }
            for r in reviews
        ],
        
        "summary": {
            "total_preflight_checks": len(preflight_results),
            "total_reviews": len(reviews),
            "final_status": order.status.value,
            "latest_preflight_score": preflight_results[-1].overall_score if preflight_results else None,
            "latest_review_status": reviews[-1].status.value if reviews else None
        }
    }
