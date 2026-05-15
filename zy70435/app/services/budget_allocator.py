import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.database import ApprovalOrder, BudgetAllocation, ManualCorrection, ProcessLog, VersionFreeze
from app.schemas.schemas import AllocationRequest, CorrectionRequest, QueryFilter, FreezeRequest


class BudgetAllocatorService:
    BUDGET_CODES = {
        "运营支出": "OP-001",
        "项目研发": "RD-002",
        "市场推广": "MK-003",
        "人力资源": "HR-004",
        "行政采购": "AD-005",
        "差旅招待": "TR-006"
    }

    DEPARTMENT_BUDGET_LIMITS = {
        "技术研发部": 500000,
        "市场营销部": 300000,
        "人力资源部": 100000,
        "财务管理部": 80000,
        "行政办公室": 150000,
        "产品运营部": 250000,
        "销售一部": 400000,
        "销售二部": 350000
    }

    def __init__(self, db: Session):
        self.db = db

    def _calculate_overdue_priority_score(self, order: ApprovalOrder) -> float:
        base_score = order.overdue_days * 10
        priority_weights = {"critical": 3.0, "high": 2.0, "normal": 1.0, "low": 0.5}
        base_score *= priority_weights.get(order.priority, 1.0)
        if order.amount > 100000:
            base_score *= 1.5
        elif order.amount > 50000:
            base_score *= 1.2
        return base_score

    def _infer_budget_code(self, subject: str, department: str) -> str:
        subject_lower = subject.lower()
        if any(keyword in subject_lower for keyword in ["工资", "薪酬", "奖金", "社保", "公积金", "招聘"]):
            return self.BUDGET_CODES["人力资源"]
        elif any(keyword in subject_lower for keyword in ["研发", "开发", "测试", "技术", "算法"]):
            return self.BUDGET_CODES["项目研发"]
        elif any(keyword in subject_lower for keyword in ["推广", "广告", "营销", "活动", "展会"]):
            return self.BUDGET_CODES["市场推广"]
        elif any(keyword in subject_lower for keyword in ["差旅", "招待", "交通", "住宿"]):
            return self.BUDGET_CODES["差旅招待"]
        elif any(keyword in subject_lower for keyword in ["采购", "设备", "办公用品", "固定资产"]):
            return self.BUDGET_CODES["行政采购"]
        else:
            return self.BUDGET_CODES["运营支出"]

    def _check_department_budget_limit(self, department: str, amount: float) -> Tuple[bool, str]:
        used_budget = self.db.query(BudgetAllocation).join(ApprovalOrder).filter(
            ApprovalOrder.department == department,
            BudgetAllocation.status == "success",
            BudgetAllocation.is_overridden == False
        ).with_entities(BudgetAllocation.allocated_amount).all()

        total_used = sum(ua[0] for ua in used_budget)
        limit = self.DEPARTMENT_BUDGET_LIMITS.get(department, 200000)

        if total_used + amount > limit:
            return False, f"部门预算超限，已使用{total_used:.2f}元，申请{amount:.2f}元，限额{limit}元"
        return True, "预算检查通过"

    def allocate_budget(self, request: AllocationRequest) -> Dict:
        results = {
            "success_count": 0,
            "error_count": 0,
            "details": []
        }

        for order_id in request.order_ids:
            start_time = time.time()
            execution_ms = 0
            try:
                order = self.db.query(ApprovalOrder).filter(ApprovalOrder.id == order_id).first()
                if not order:
                    raise ValueError(f"审批单不存在: {order_id}")

                if order.overdue_days == 0:
                    order.overdue_days = (datetime.now() - order.due_date).days

                budget_ok, budget_msg = self._check_department_budget_limit(order.department, order.amount)

                if not budget_ok:
                    allocation = BudgetAllocation(
                        order_id=order_id,
                        allocated_amount=0,
                        allocated_budget_code=None,
                        allocation_reason=budget_msg,
                        algorithm_version=request.algorithm_version,
                        status="failed",
                        error_message=budget_msg,
                        execution_time_ms=int((time.time() - start_time) * 1000)
                    )
                    self.db.add(allocation)
                    results["error_count"] += 1
                    results["details"].append({
                        "order_no": order.order_no,
                        "status": "failed",
                        "message": budget_msg
                    })
                else:
                    score = self._calculate_overdue_priority_score(order)
                    budget_code = self._infer_budget_code(order.subject, order.department)

                    allocation = BudgetAllocation(
                        order_id=order_id,
                        allocated_amount=order.amount,
                        allocated_budget_code=budget_code,
                        allocation_reason=f"逾期优先级评分:{score:.1f}，{budget_msg}",
                        algorithm_version=request.algorithm_version,
                        status="success",
                        error_message=None,
                        execution_time_ms=int((time.time() - start_time) * 1000)
                    )
                    self.db.add(allocation)
                    order.status = "allocated"
                    results["success_count"] += 1
                    results["details"].append({
                        "order_no": order.order_no,
                        "status": "success",
                        "allocated_amount": order.amount,
                        "budget_code": budget_code,
                        "priority_score": score
                    })

                execution_ms = int((time.time() - start_time) * 1000)

                log = ProcessLog(
                    order_id=order_id,
                    operation_type="budget_allocation",
                    status=allocation.status,
                    detail=allocation.allocation_reason,
                    execution_time_ms=execution_ms,
                    operator=request.operator
                )
                self.db.add(log)

            except Exception as e:
                execution_ms = int((time.time() - start_time) * 1000)
                allocation = BudgetAllocation(
                    order_id=order_id,
                    allocated_amount=0,
                    allocated_budget_code=None,
                    allocation_reason="系统异常",
                    algorithm_version=request.algorithm_version,
                    status="error",
                    error_message=str(e),
                    execution_time_ms=execution_ms
                )
                self.db.add(allocation)

                log = ProcessLog(
                    order_id=order_id,
                    operation_type="budget_allocation",
                    status="error",
                    detail=str(e),
                    execution_time_ms=execution_ms,
                    operator=request.operator
                )
                self.db.add(log)

                results["error_count"] += 1
                results["details"].append({
                    "order_id": order_id,
                    "status": "error",
                    "message": str(e)
                })

        self.db.commit()
        return results

    def apply_manual_correction(self, request: CorrectionRequest) -> Dict:
        order = self.db.query(ApprovalOrder).filter(ApprovalOrder.id == request.order_id).first()
        if not order:
            raise ValueError(f"审批单不存在: {request.order_id}")

        latest_allocation = self.db.query(BudgetAllocation).filter(
            BudgetAllocation.order_id == request.order_id
        ).order_by(BudgetAllocation.created_at.desc()).first()

        if not latest_allocation:
            raise ValueError(f"审批单尚未进行预算分配: {request.order_id}")

        system_snapshot = json.dumps({
            "system_allocated_amount": latest_allocation.allocated_amount,
            "system_budget_code": latest_allocation.allocated_budget_code,
            "system_reason": latest_allocation.allocation_reason,
            "algorithm_version": latest_allocation.algorithm_version,
            "snapshot_time": datetime.now().isoformat()
        }, ensure_ascii=False)

        correction = ManualCorrection(
            order_id=request.order_id,
            original_allocation_id=latest_allocation.id,
            corrected_amount=request.corrected_amount,
            corrected_budget_code=request.corrected_budget_code,
            correction_reason=request.correction_reason,
            corrected_by=request.corrected_by,
            system_judgment_snapshot=system_snapshot
        )
        self.db.add(correction)

        latest_allocation.is_overridden = True

        log = ProcessLog(
            order_id=request.order_id,
            operation_type="manual_correction",
            status="success",
            detail=f"人工修正：{request.correction_reason}，修正人：{request.corrected_by}",
            operator=request.corrected_by
        )
        self.db.add(log)

        self.db.commit()

        return {
            "correction_id": correction.id,
            "order_no": order.order_no,
            "system_snapshot": json.loads(system_snapshot),
            "correction": {
                "corrected_amount": request.corrected_amount,
                "corrected_budget_code": request.corrected_budget_code,
                "reason": request.correction_reason,
                "corrected_by": request.corrected_by
            }
        }

    def freeze_version(self, request: FreezeRequest) -> Dict:
        allocation = self.db.query(BudgetAllocation).filter(
            BudgetAllocation.id == request.allocation_id
        ).first()

        if not allocation:
            raise ValueError(f"分配记录不存在: {request.allocation_id}")

        existing_freeze = self.db.query(VersionFreeze).filter(
            VersionFreeze.allocation_id == request.allocation_id
        ).first()

        if existing_freeze:
            raise ValueError(f"该分配记录已冻结: {request.allocation_id}")

        freeze = VersionFreeze(
            allocation_id=request.allocation_id,
            freeze_note=request.freeze_note,
            frozen_by=request.frozen_by,
            algorithm_hash=f"hash_{allocation.algorithm_version}_{int(time.time())}"
        )
        self.db.add(freeze)

        log = ProcessLog(
            order_id=allocation.order_id,
            operation_type="version_freeze",
            status="success",
            detail=f"版本冻结：{request.freeze_note}",
            operator=request.frozen_by
        )
        self.db.add(log)

        self.db.commit()

        return {
            "freeze_id": freeze.id,
            "frozen_at": freeze.frozen_at,
            "algorithm_hash": freeze.algorithm_hash,
            "freeze_note": request.freeze_note
        }

    def query_allocation_results(self, query_filter: QueryFilter = None):
        query = self.db.query(ApprovalOrder)

        if query_filter:
            if query_filter.department:
                query = query.filter(ApprovalOrder.department == query_filter.department)
            if query_filter.start_date:
                query = query.filter(ApprovalOrder.created_at >= query_filter.start_date)
            if query_filter.end_date:
                query = query.filter(ApprovalOrder.created_at <= query_filter.end_date)

        orders = query.order_by(ApprovalOrder.created_at.desc()).all()

        results = []
        for order in orders:
            allocations = self.db.query(BudgetAllocation).filter(
                BudgetAllocation.order_id == order.id
            ).order_by(BudgetAllocation.created_at.desc()).all()

            corrections = self.db.query(ManualCorrection).filter(
                ManualCorrection.order_id == order.id
            ).order_by(ManualCorrection.created_at.desc()).all()

            latest_allocation = allocations[0] if allocations else None
            version_freeze = None
            if latest_allocation:
                version_freeze = self.db.query(VersionFreeze).filter(
                    VersionFreeze.allocation_id == latest_allocation.id
                ).first()

            logs = self.db.query(ProcessLog).filter(
                ProcessLog.order_id == order.id
            ).order_by(ProcessLog.created_at.desc()).all()

            if query_filter:
                if query_filter.status:
                    if not latest_allocation:
                        continue
                    if latest_allocation.status != query_filter.status:
                        continue
                if query_filter.has_error is True:
                    if not latest_allocation or latest_allocation.status not in ['failed', 'error']:
                        continue
                if query_filter.has_error is False:
                    if latest_allocation and latest_allocation.status in ['failed', 'error']:
                        continue
                if query_filter.has_correction is True and not corrections:
                    continue
                if query_filter.has_correction is False and corrections:
                    continue

            result = {
                "order": {
                    "id": order.id,
                    "order_no": order.order_no,
                    "department": order.department,
                    "applicant": order.applicant,
                    "amount": order.amount,
                    "subject": order.subject,
                    "overdue_days": order.overdue_days,
                    "priority": order.priority,
                    "material_summary": order.material_summary
                },
                "allocations": [{
                    "id": a.id,
                    "allocated_amount": a.allocated_amount,
                    "budget_code": a.allocated_budget_code,
                    "reason": a.allocation_reason,
                    "algorithm_version": a.algorithm_version,
                    "is_overridden": a.is_overridden,
                    "status": a.status,
                    "error_message": a.error_message,
                    "execution_time_ms": a.execution_time_ms,
                    "created_at": a.created_at.isoformat()
                } for a in allocations],
                "manual_corrections": [{
                    "id": c.id,
                    "corrected_amount": c.corrected_amount,
                    "corrected_budget_code": c.corrected_budget_code,
                    "reason": c.correction_reason,
                    "corrected_by": c.corrected_by,
                    "system_snapshot": c.system_judgment_snapshot,
                    "created_at": c.created_at.isoformat()
                } for c in corrections],
                "version_freeze": {
                    "id": version_freeze.id,
                    "freeze_note": version_freeze.freeze_note,
                    "frozen_by": version_freeze.frozen_by,
                    "frozen_at": version_freeze.frozen_at.isoformat(),
                    "algorithm_hash": version_freeze.algorithm_hash
                } if version_freeze else None,
                "process_logs": [{
                    "id": l.id,
                    "operation_type": l.operation_type,
                    "status": l.status,
                    "detail": l.detail,
                    "execution_time_ms": l.execution_time_ms,
                    "operator": l.operator,
                    "created_at": l.created_at.isoformat()
                } for l in logs]
            }
            results.append(result)

        return results

    def get_review_trace(self, order_id: int):
        order = self.db.query(ApprovalOrder).filter(ApprovalOrder.id == order_id).first()
        if not order:
            raise ValueError(f"审批单不存在: {order_id}")

        allocations = self.db.query(BudgetAllocation).filter(
            BudgetAllocation.order_id == order_id
        ).order_by(BudgetAllocation.created_at.asc()).all()

        trace = {
            "order_no": order.order_no,
            "subject": order.subject,
            "department": order.department,
            "timeline": []
        }

        for alloc in allocations:
            trace["timeline"].append({
                "time": alloc.created_at.isoformat(),
                "type": "system_allocation",
                "version": alloc.algorithm_version,
                "status": alloc.status,
                "execution_time_ms": alloc.execution_time_ms,
                "detail": alloc.allocation_reason if alloc.status == "success" else alloc.error_message
            })

            freeze = self.db.query(VersionFreeze).filter(
                VersionFreeze.allocation_id == alloc.id
            ).first()
            if freeze:
                trace["timeline"].append({
                    "time": freeze.frozen_at.isoformat(),
                    "type": "version_freeze",
                    "freeze_note": freeze.freeze_note,
                    "algorithm_hash": freeze.algorithm_hash,
                    "frozen_by": freeze.frozen_by
                })

        corrections = self.db.query(ManualCorrection).filter(
            ManualCorrection.order_id == order_id
        ).order_by(ManualCorrection.created_at.asc()).all()

        for corr in corrections:
            trace["timeline"].append({
                "time": corr.created_at.isoformat(),
                "type": "manual_correction",
                "corrected_by": corr.corrected_by,
                "reason": corr.correction_reason,
                "system_snapshot": json.loads(corr.system_judgment_snapshot)
            })

        logs = self.db.query(ProcessLog).filter(
            ProcessLog.order_id == order_id
        ).order_by(ProcessLog.created_at.asc()).all()

        for log in logs:
            trace["timeline"].append({
                "time": log.created_at.isoformat(),
                "type": log.operation_type,
                "status": log.status,
                "detail": log.detail,
                "execution_time_ms": log.execution_time_ms,
                "operator": log.operator
            })

        trace["timeline"].sort(key=lambda x: x["time"])

        return trace
