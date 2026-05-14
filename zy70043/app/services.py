from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import random
import string

from sqlalchemy.orm import Session
from .models import (
    RawMaterial, Formula, FormulaVersion, FormulaItem,
    QCConstraint, SubstitutionRequest, AffectedFormula,
    ApprovalRecord, ExecutionTrace, SystemConfig,
    SubstitutionStatus, ApprovalLevel, ApprovalResult
)
from .config import APPROVAL_THRESHOLD, MAX_RETRY_TIMES


def generate_request_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = ''.join(random.choices(string.ascii_uppercase, k=4))
    return f"SUB-{timestamp}-{suffix}"


class QCService:
    @staticmethod
    def validate_substitution(
        db: Session,
        original_code: str,
        substitute_code: str
    ) -> Tuple[bool, List[str]]:
        original = db.query(RawMaterial).filter(RawMaterial.code == original_code).first()
        substitute = db.query(RawMaterial).filter(RawMaterial.code == substitute_code).first()
        
        if not original or not substitute:
            return False, ["原料信息不存在"]
        
        errors = []
        warnings = []
        
        constraints = db.query(QCConstraint).filter(
            QCConstraint.raw_material_code == original_code,
            QCConstraint.is_active == True
        ).all()
        
        for constraint in constraints:
            if constraint.constraint_type == "替代类别匹配":
                allowed = constraint.constraint_value.split("|")
                if substitute.category not in allowed:
                    errors.append(
                        f"质检约束不通过：替代原料类别[{substitute.category}]不在允许列表{allowed}"
                    )
            
            elif constraint.constraint_type == "成本差异阈值":
                pass
        
        if not errors:
            warnings.append("质检类别校验通过")
        
        return (len(errors) == 0), errors + warnings


class CostService:
    @staticmethod
    def calculate_cost_diff(
        original_material: RawMaterial,
        substitute_material: RawMaterial,
        total_usage: float,
        substitute_ratio: float = 1.0
    ) -> Dict[str, Any]:
        actual_usage = total_usage * substitute_ratio
        original_cost = total_usage * original_material.unit_price
        substitute_cost = actual_usage * substitute_material.unit_price
        
        diff_amount = substitute_cost - original_cost
        diff_percent = (diff_amount / original_cost * 100) if original_cost > 0 else 0
        diff_percent = round(diff_percent, 2)
        
        exceeds = abs(diff_percent) > (APPROVAL_THRESHOLD * 100)
        
        return {
            "original_cost": round(original_cost, 2),
            "substitute_cost": round(substitute_cost, 2),
            "cost_diff_amount": round(diff_amount, 2),
            "cost_diff_percent": diff_percent,
            "exceeds_threshold": exceeds,
            "total_original_usage": total_usage,
            "total_substitute_usage": actual_usage,
            "threshold_percent": APPROVAL_THRESHOLD * 100
        }


class FormulaService:
    @staticmethod
    def find_affected_formulas(
        db: Session,
        original_material_code: str
    ) -> List[Tuple[Formula, FormulaVersion, float]]:
        active_versions = db.query(FormulaVersion).filter(
            FormulaVersion.is_effective == True
        ).all()
        
        affected = []
        for version in active_versions:
            for item in version.items:
                if item.raw_material_code == original_material_code:
                    affected.append((version.formula, version, item.quantity))
                    break
        
        return affected
    
    @staticmethod
    def create_new_version(
        db: Session,
        formula: Formula,
        substitution: SubstitutionRequest,
        created_by: str
    ) -> Optional[FormulaVersion]:
        current_version = db.query(FormulaVersion).filter(
            FormulaVersion.formula_id == formula.id,
            FormulaVersion.is_effective == True
        ).first()
        
        if not current_version:
            return None
        
        new_version_no = formula.current_version + 1
        
        new_version = FormulaVersion(
            formula_id=formula.id,
            version_number=new_version_no,
            is_effective=False,
            created_by=created_by,
            reason=f"原料替代申请 #{substitution.request_no}：{substitution.original_material_name} → {substitution.substitute_material_name}",
            substitution_id=substitution.id
        )
        db.add(new_version)
        db.flush()
        
        for item in current_version.items:
            if item.raw_material_code == substitution.original_material_code:
                new_item = FormulaItem(
                    version_id=new_version.id,
                    raw_material_id=substitution.substitute_material_id,
                    raw_material_code=substitution.substitute_material_code,
                    raw_material_name=substitution.substitute_material_name,
                    quantity=item.quantity * substitution.substitute_ratio,
                    unit=item.unit,
                    unit_price=substitution.substitute_material_id and db.query(RawMaterial).get(substitution.substitute_material_id).unit_price or 0,
                    is_substituted=True,
                    substitution_note=f"替代自：{substitution.original_material_name}"
                )
            else:
                new_item = FormulaItem(
                    version_id=new_version.id,
                    raw_material_id=item.raw_material_id,
                    raw_material_code=item.raw_material_code,
                    raw_material_name=item.raw_material_name,
                    quantity=item.quantity,
                    unit=item.unit,
                    unit_price=item.unit_price,
                    is_substituted=False,
                    substitution_note=item.substitution_note
                )
            db.add(new_item)
        
        return new_version


class SubstitutionService:
    @staticmethod
    def create_draft(
        db: Session,
        original_code: str,
        substitute_code: str,
        reason: str,
        created_by: str,
        substitute_ratio: float = 1.0,
        is_temporary: bool = True
    ) -> Dict[str, Any]:
        original = db.query(RawMaterial).filter(RawMaterial.code == original_code).first()
        substitute = db.query(RawMaterial).filter(RawMaterial.code == substitute_code).first()
        
        if not original:
            return {"success": False, "message": f"原料不存在：{original_code}"}
        if not substitute:
            return {"success": False, "message": f"替代原料不存在：{substitute_code}"}
        
        if original.stock_quantity > 0:
            return {
                "success": False,
                "message": f"警告：原原料[{original.name}]仍有库存 {original.stock_quantity}{original.unit}，请确认确实需要替代"
            }
        
        qc_pass, qc_messages = QCService.validate_substitution(db, original_code, substitute_code)
        
        affected = FormulaService.find_affected_formulas(db, original_code)
        total_usage = sum(qty for _, _, qty in affected)
        
        cost_info = CostService.calculate_cost_diff(
            original, substitute, total_usage, substitute_ratio
        )
        
        request_no = generate_request_no()
        
        substitution = SubstitutionRequest(
            request_no=request_no,
            status=SubstitutionStatus.DRAFT,
            original_material_id=original.id,
            original_material_code=original_code,
            original_material_name=original.name,
            substitute_material_id=substitute.id,
            substitute_material_code=substitute_code,
            substitute_material_name=substitute.name,
            reason=reason,
            substitute_ratio=substitute_ratio,
            is_temporary=is_temporary,
            original_cost=cost_info["original_cost"],
            substitute_cost=cost_info["substitute_cost"],
            cost_diff_amount=cost_info["cost_diff_amount"],
            cost_diff_percent=cost_info["cost_diff_percent"],
            exceeds_threshold=cost_info["exceeds_threshold"],
            affected_formula_count=len(affected),
            created_by=created_by
        )
        db.add(substitution)
        db.flush()
        
        for formula, version, usage in affected:
            affected_item = AffectedFormula(
                substitution_id=substitution.id,
                formula_id=formula.id,
                formula_code=formula.code,
                formula_name=formula.name,
                original_usage=usage
            )
            db.add(affected_item)
        
        messages = []
        if not qc_pass:
            messages.append(f"质检警告：{', '.join(qc_messages)}")
        else:
            messages.append(f"质检校验通过：{', '.join(qc_messages)}")
        
        if cost_info["exceeds_threshold"]:
            messages.append(
                f"成本警告：差异率 {cost_info['cost_diff_percent']}% 超出阈值 {cost_info['threshold_percent']}%，需额外审批"
            )
        else:
            messages.append(
                f"成本正常：差异率 {cost_info['cost_diff_percent']}% 在阈值范围内"
            )
        
        return {
            "success": True,
            "message": f"替代申请已创建，申请单号：{request_no}",
            "request_no": request_no,
            "id": substitution.id,
            "affected_formula_count": len(affected),
            "affected_formulas": [
                {"code": f.code, "name": f.name, "usage": qty}
                for f, _, qty in affected
            ],
            "cost_info": cost_info,
            "warnings": messages
        }
    
    @staticmethod
    def submit_for_approval(
        db: Session,
        request_no: str,
        submitter: str
    ) -> Dict[str, Any]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return {"success": False, "message": f"申请不存在：{request_no}"}
        
        if substitution.status != SubstitutionStatus.DRAFT:
            return {"success": False, "message": f"当前状态[{substitution.status.value}]不允许提交"}
        
        if substitution.exceeds_threshold:
            substitution.status = SubstitutionStatus.QC_REVIEW
            next_step = "质检复核"
            next_approver = "质检专员"
        else:
            substitution.status = SubstitutionStatus.COST_REVIEW
            next_step = "成本复核"
            next_approver = "成本专员"
        
        db.commit()
        
        return {
            "success": True,
            "message": f"申请 [{request_no}] 已提交，进入 {next_step} 流程",
            "request_no": request_no,
            "current_status": substitution.status.value,
            "next_approver": next_approver
        }
    
    @staticmethod
    def approve(
        db: Session,
        request_no: str,
        approver: str,
        level: str,
        result: str,
        comment: str = ""
    ) -> Dict[str, Any]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return {"success": False, "message": f"申请不存在：{request_no}"}
        
        level_map = {
            "QC": ApprovalLevel.QC,
            "COST": ApprovalLevel.COST,
            "FINAL": ApprovalLevel.FINAL,
        }
        result_map = {
            "APPROVE": ApprovalResult.APPROVE,
            "REJECT": ApprovalResult.REJECT,
            "DEFER": ApprovalResult.DEFER,
        }
        
        approval_level = level_map.get(level)
        approval_result = result_map.get(result)
        
        if not approval_level or not approval_result:
            return {"success": False, "message": "审批级别或结果参数错误"}
        
        expected_status_map = {
            ApprovalLevel.QC: SubstitutionStatus.QC_REVIEW,
            ApprovalLevel.COST: SubstitutionStatus.COST_REVIEW,
            ApprovalLevel.FINAL: SubstitutionStatus.FINAL_APPROVAL,
        }
        
        if substitution.status != expected_status_map.get(approval_level, SubstitutionStatus.PENDING_APPROVAL):
            return {
                "success": False,
                "message": f"当前状态[{substitution.status.value}]不适合进行{approval_level.value}"
            }
        
        record = ApprovalRecord(
            substitution_id=substitution.id,
            approval_level=approval_level,
            result=approval_result,
            approver=approver,
            comment=comment
        )
        db.add(record)
        
        if approval_result == ApprovalResult.REJECT:
            substitution.status = SubstitutionStatus.REJECTED
            db.commit()
            return {
                "success": True,
                "message": f"申请 [{request_no}] 已被{approval_result.value}，原因：{comment or '未说明'}",
                "final_status": SubstitutionStatus.REJECTED.value
            }
        
        if approval_result == ApprovalResult.DEFER:
            db.commit()
            return {
                "success": True,
                "message": f"申请 [{request_no}] 已{approval_result.value}，待补充信息",
                "current_status": substitution.status.value
            }
        
        transition_map = {
            ApprovalLevel.QC: SubstitutionStatus.COST_REVIEW,
            ApprovalLevel.COST: SubstitutionStatus.FINAL_APPROVAL if substitution.exceeds_threshold else SubstitutionStatus.APPROVED,
            ApprovalLevel.FINAL: SubstitutionStatus.APPROVED,
        }
        
        substitution.status = transition_map[approval_level]
        
        if substitution.exceeds_threshold:
            next_msg = f"进入下一审批环节：{transition_map[approval_level].value}"
        else:
            if approval_level == ApprovalLevel.COST:
                next_msg = "审批完成，可执行配方更新"
            else:
                next_msg = f"进入下一审批环节：{transition_map[approval_level].value}"
        
        db.commit()
        
        return {
            "success": True,
            "message": f"{approval_level.value}通过：{approver}。{next_msg}",
            "request_no": request_no,
            "current_status": substitution.status.value
        }
    
    @staticmethod
    def freeze_request(
        db: Session,
        request_no: str,
        operator: str,
        reason: str
    ) -> Dict[str, Any]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return {"success": False, "message": f"申请不存在：{request_no}"}
        
        if substitution.status in [SubstitutionStatus.COMPLETED, SubstitutionStatus.REJECTED]:
            return {"success": False, "message": f"已结束的申请无法冻结"}
        
        substitution.status = SubstitutionStatus.FROZEN
        
        db.commit()
        
        return {
            "success": True,
            "message": f"申请 [{request_no}] 已被 {operator} 冻结，原因：{reason}",
            "current_status": SubstitutionStatus.FROZEN.value
        }
    
    @staticmethod
    def unfreeze_request(
        db: Session,
        request_no: str,
        operator: str
    ) -> Dict[str, Any]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return {"success": False, "message": f"申请不存在：{request_no}"}
        
        if substitution.status != SubstitutionStatus.FROZEN:
            return {"success": False, "message": f"当前状态不是冻结状态"}
        
        substitution.status = SubstitutionStatus.APPROVED
        db.commit()
        
        return {
            "success": True,
            "message": f"申请 [{request_no}] 已由 {operator} 解冻，恢复到已通过状态",
            "current_status": SubstitutionStatus.APPROVED.value
        }
    
    @staticmethod
    def execute_substitution(
        db: Session,
        request_no: str,
        operator: str,
        simulate_failure: int = -1
    ) -> Dict[str, Any]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return {"success": False, "message": f"申请不存在：{request_no}"}
        
        if substitution.status not in [
            SubstitutionStatus.APPROVED,
            SubstitutionStatus.PARTIAL_SUCCESS,
            SubstitutionStatus.FAILED
        ]:
            return {"success": False, "message": f"当前状态[{substitution.status.value}]不允许执行"}
        
        if substitution.status == SubstitutionStatus.APPROVED:
            substitution.status = SubstitutionStatus.IMPLEMENTING
            db.flush()
        
        affected_items = db.query(AffectedFormula).filter(
            AffectedFormula.substitution_id == substitution.id
        ).all()
        
        pending_items = [
            item for item in affected_items 
            if item.processing_status != "success"
        ]
        
        if not pending_items and substitution.status == SubstitutionStatus.COMPLETED:
            return {"success": True, "message": "所有配方已成功更新，无需重复执行"}
        
        success_count = 0
        fail_count = 0
        processed_details = []
        
        for idx, item in enumerate(pending_items):
            step_name = f"更新配方：{item.formula_code}"
            step_desc = f"为配方[{item.formula_name}]创建新配方版本，替换原料"
            
            if simulate_failure == idx:
                db.add(ExecutionTrace(
                    substitution_id=substitution.id,
                    step_name=step_name,
                    step_description=step_desc,
                    is_success=False,
                    error_message="模拟执行失败：配方版本锁冲突（用于测试重试机制）",
                    retry_count=item.id
                ))
                item.processing_status = "failed"
                item.error_message = "模拟执行失败：配方版本锁冲突"
                fail_count += 1
                processed_details.append({
                    "formula_code": item.formula_code,
                    "formula_name": item.formula_name,
                    "status": "失败",
                    "error": "模拟执行失败：配方版本锁冲突"
                })
                continue
            
            try:
                formula = db.query(Formula).get(item.formula_id)
                if not formula:
                    raise Exception(f"配方不存在：{item.formula_code}")
                
                new_version = FormulaService.create_new_version(
                    db, formula, substitution, operator
                )
                
                if new_version:
                    item.new_version_id = new_version.id
                    item.is_processed = True
                    item.processing_status = "success"
                    
                    db.add(ExecutionTrace(
                        substitution_id=substitution.id,
                        step_name=step_name,
                        step_description=step_desc,
                        is_success=True,
                        error_message=None
                    ))
                    success_count += 1
                    processed_details.append({
                        "formula_code": item.formula_code,
                        "formula_name": item.formula_name,
                        "status": "成功",
                        "new_version": f"v{new_version.version_number}"
                    })
                else:
                    raise Exception("创建新版本失败")
                    
            except Exception as e:
                db.add(ExecutionTrace(
                    substitution_id=substitution.id,
                    step_name=step_name,
                    step_description=step_desc,
                    is_success=False,
                    error_message=str(e),
                    retry_count=item.id
                ))
                item.processing_status = "failed"
                item.error_message = str(e)
                fail_count += 1
                processed_details.append({
                    "formula_code": item.formula_code,
                    "formula_name": item.formula_name,
                    "status": "失败",
                    "error": str(e)
                })
        
        if fail_count == 0:
            substitution.status = SubstitutionStatus.COMPLETED
            substitution.completed_at = datetime.now()
            
            for item in affected_items:
                if item.new_version_id:
                    version = db.query(FormulaVersion).get(item.new_version_id)
                    if version:
                        for old_v in version.formula.versions:
                            if old_v.is_effective and old_v.id != version.id:
                                old_v.is_effective = False
                                old_v.effective_to = datetime.now()
                        version.is_effective = True
                        version.effective_from = datetime.now()
                    
                    formula = db.query(Formula).get(item.formula_id)
                    if formula and version:
                        formula.current_version = version.version_number
            
            final_msg = f"执行完成，共更新 {success_count} 个配方，所有配方版本已生效"
        elif success_count > 0:
            substitution.status = SubstitutionStatus.PARTIAL_SUCCESS
            final_msg = f"部分成功：{success_count} 个完成，{fail_count} 个失败，可再次执行补偿失败的配方"
        else:
            substitution.status = SubstitutionStatus.FAILED
            final_msg = f"执行失败：{fail_count} 个配方全部失败，可再次执行重试"
        
        db.commit()
        
        return {
            "success": fail_count == 0,
            "message": final_msg,
            "request_no": request_no,
            "current_status": substitution.status.value,
            "success_count": success_count,
            "fail_count": fail_count,
            "details": processed_details
        }
    
    @staticmethod
    def retry_failed(
        db: Session,
        request_no: str,
        operator: str
    ) -> Dict[str, Any]:
        return SubstitutionService.execute_substitution(db, request_no, operator)
    
    @staticmethod
    def get_request_detail(
        db: Session,
        request_no: str
    ) -> Optional[Dict[str, Any]]:
        substitution = db.query(SubstitutionRequest).filter(
            SubstitutionRequest.request_no == request_no
        ).first()
        
        if not substitution:
            return None
        
        affected = db.query(AffectedFormula).filter(
            AffectedFormula.substitution_id == substitution.id
        ).all()
        
        approvals = db.query(ApprovalRecord).filter(
            ApprovalRecord.substitution_id == substitution.id
        ).all()
        
        traces = db.query(ExecutionTrace).filter(
            ExecutionTrace.substitution_id == substitution.id
        ).all()
        
        return {
            "request_no": substitution.request_no,
            "status": substitution.status.value,
            "original_material": f"{substitution.original_material_code} - {substitution.original_material_name}",
            "substitute_material": f"{substitution.substitute_material_code} - {substitution.substitute_material_name}",
            "reason": substitution.reason,
            "substitute_ratio": substitution.substitute_ratio,
            "is_temporary": substitution.is_temporary,
            "cost_summary": {
                "原成本": f"{substitution.original_cost} 元",
                "替代后成本": f"{substitution.substitute_cost} 元",
                "成本差额": f"{substitution.cost_diff_amount} 元",
                "差异率": f"{substitution.cost_diff_percent}%",
                "超出阈值": "是" if substitution.exceeds_threshold else "否"
            },
            "affected_formulas": [
                {
                    "code": a.formula_code,
                    "name": a.formula_name,
                    "original_usage": a.original_usage,
                    "processing_status": a.processing_status,
                    "new_version_id": a.new_version_id
                }
                for a in affected
            ],
            "approvals": [
                {
                    "level": a.approval_level.value,
                    "result": a.result.value,
                    "approver": a.approver,
                    "comment": a.comment,
                    "time": a.approved_at.strftime("%Y-%m-%d %H:%M:%S")
                }
                for a in approvals
            ],
            "execution_traces": [
                {
                    "step": t.step_name,
                    "status": "成功" if t.is_success else "失败",
                    "error": t.error_message,
                    "time": t.executed_at.strftime("%Y-%m-%d %H:%M:%S")
                }
                for t in traces
            ],
            "created_by": substitution.created_by,
            "created_at": substitution.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "completed_at": substitution.completed_at.strftime("%Y-%m-%d %H:%M:%S") if substitution.completed_at else None
        }
    
    @staticmethod
    def list_requests(
        db: Session,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        query = db.query(SubstitutionRequest)
        if status:
            try:
                status_enum = SubstitutionStatus(status)
                query = query.filter(SubstitutionRequest.status == status_enum)
            except ValueError:
                pass
        
        requests = query.order_by(SubstitutionRequest.created_at.desc()).limit(limit).all()
        
        return [
            {
                "request_no": r.request_no,
                "status": r.status.value,
                "original": r.original_material_name,
                "substitute": r.substitute_material_name,
                "affected_count": r.affected_formula_count,
                "cost_diff": f"{r.cost_diff_percent}%",
                "created_by": r.created_by,
                "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for r in requests
        ]
