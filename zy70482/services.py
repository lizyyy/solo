import hashlib
import json
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from models import Material, Evaluation, Correction, OperationLog, CandidateList, MaterialStatus, EvaluationResult, OperationType
from schemas import MaterialCreate, CorrectionCreate, CandidateListCreate, QueryFilter
from datetime import datetime


def calculate_file_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def detect_failure_path(success_count: int, total_count: int) -> Tuple[str, str]:
    if total_count == 0:
        return "no_check_items", "未检测到检查项"
    
    success_rate = success_count / total_count
    
    if success_rate == 1.0:
        return "", "全部通过"
    elif success_rate == 0:
        return "all_failed", "全部检查项失败"
    elif success_rate < 0.5:
        return "mostly_failed", f"通过率仅为{success_rate:.1%}，大部分检查项失败"
    elif success_rate < 1.0:
        return "partial_failed", f"部分检查项失败，通过率{success_rate:.1%}"
    return "", ""


def evaluate_material(material: Material, db: Session) -> Evaluation:
    content = material.content
    check_items = content.split('\n')
    total_count = len(check_items)
    success_count = sum(1 for item in check_items if '成功' in item or '通过' in item or 'PASS' in item.upper())
    
    failure_path, failure_details = detect_failure_path(success_count, total_count)
    success_rate = success_count / total_count if total_count > 0 else 0
    
    if success_rate == 1.0:
        result = EvaluationResult.PASS
        confidence = 0.95
        reasoning = "所有检查项均通过"
    elif success_rate >= 0.5:
        result = EvaluationResult.PARTIAL_PASS
        confidence = 0.7
        reasoning = "部分检查项通过，存在失败路径"
    else:
        result = EvaluationResult.FAIL
        confidence = 0.85
        reasoning = "大部分检查项失败，存在明显失败路径"
    
    evaluation = Evaluation(
        material_id=material.id,
        result=result,
        confidence=confidence,
        reasoning=reasoning,
        failure_path=failure_path,
        failure_details=failure_details,
        success_count=success_count,
        total_count=total_count
    )
    
    db.add(evaluation)
    
    if result == EvaluationResult.PASS:
        material.status = MaterialStatus.SUCCESS
    elif result == EvaluationResult.PARTIAL_PASS:
        material.status = MaterialStatus.PARTIAL_SUCCESS
    else:
        material.status = MaterialStatus.FAILED
    
    log_operation(db, OperationType.EVALUATE, "system", [material.id], f"材料{material.id}评估完成，结果: {result}")
    
    db.commit()
    db.refresh(evaluation)
    return evaluation


def submit_material(db: Session, material_data: MaterialCreate) -> Tuple[Material, bool, bool]:
    file_hash = calculate_file_hash(material_data.content)
    
    existing_material = db.query(Material).filter(
        Material.batch_id == material_data.batch_id,
        Material.file_hash == file_hash
    ).first()
    
    if existing_material:
        existing_eval = db.query(Evaluation).filter(
            Evaluation.material_id == existing_material.id
        ).order_by(Evaluation.created_at.desc()).first()
        
        if existing_eval:
            return existing_material, True, False
        return existing_material, True, True
    
    material = Material(
        batch_id=material_data.batch_id,
        file_hash=file_hash,
        file_name=material_data.file_name,
        file_summary=material_data.file_summary,
        content=material_data.content,
        status=MaterialStatus.PENDING
    )
    
    db.add(material)
    db.commit()
    db.refresh(material)
    
    log_operation(db, OperationType.SUBMIT, "system", [material.id], f"新材料提交: {material.file_name}")
    
    evaluate_material(material, db)
    
    return material, False, False


def batch_submit_materials(db: Session, batch_id: str, materials_data: List[MaterialCreate]) -> dict:
    results = []
    new_count = 0
    reused_count = 0
    conflict_count = 0
    
    for material_data in materials_data:
        material_data.batch_id = batch_id
        material, reused, conflict = submit_material(db, material_data)
        results.append(material)
        
        if reused:
            reused_count += 1
            if conflict:
                conflict_count += 1
        else:
            new_count += 1
    
    log_operation(
        db, 
        OperationType.SUBMIT, 
        "system", 
        [m.id for m in results], 
        f"批次{batch_id}批量提交: 总数{len(results)}, 新增{new_count}, 复用{reused_count}, 冲突{conflict_count}"
    )
    
    return {
        "batch_id": batch_id,
        "total_count": len(results),
        "new_count": new_count,
        "reused_count": reused_count,
        "conflict_count": conflict_count,
        "materials": results
    }


def create_correction(db: Session, correction_data: CorrectionCreate) -> Correction:
    material = db.query(Material).filter(Material.id == correction_data.material_id).first()
    if not material:
        raise ValueError("材料不存在")
    
    original_result = None
    if correction_data.evaluation_id:
        evaluation = db.query(Evaluation).filter(Evaluation.id == correction_data.evaluation_id).first()
        if evaluation:
            original_result = evaluation.result
    
    correction = Correction(
        material_id=correction_data.material_id,
        evaluation_id=correction_data.evaluation_id,
        operator=correction_data.operator,
        original_result=original_result,
        corrected_result=correction_data.corrected_result,
        remark=correction_data.remark
    )
    
    db.add(correction)
    material.status = MaterialStatus.NEEDS_REVIEW
    
    log_operation(
        db, 
        OperationType.CORRECT, 
        correction_data.operator, 
        [correction_data.material_id], 
        f"人工修正: {correction_data.remark}"
    )
    
    db.commit()
    db.refresh(correction)
    return correction


def confirm_evaluation(db: Session, evaluation_id: int, operator: str, confirmed: bool) -> Evaluation:
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        raise ValueError("评估不存在")
    
    evaluation.is_manual_confirmed = confirmed
    evaluation.confirmed_by = operator
    evaluation.confirmed_at = datetime.now()
    
    material = db.query(Material).filter(Material.id == evaluation.material_id).first()
    if material:
        material.status = MaterialStatus.CONFIRMED if confirmed else MaterialStatus.NEEDS_REVIEW
    
    log_operation(
        db, 
        OperationType.CONFIRM, 
        operator, 
        [evaluation.material_id], 
        f"人工确认评估结果: {'通过' if confirmed else '需要复审'}"
    )
    
    db.commit()
    db.refresh(evaluation)
    return evaluation


def create_candidate_list(db: Session, candidate_data: CandidateListCreate) -> CandidateList:
    candidate = CandidateList(
        operation_type=candidate_data.operation_type,
        name=candidate_data.name,
        target_ids=json.dumps(candidate_data.target_ids),
        created_by="system"
    )
    
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def get_candidate_list_materials(db: Session, candidate_id: int) -> Tuple[CandidateList, List[Material]]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if not candidate:
        raise ValueError("候选清单不存在")
    
    target_ids = json.loads(candidate.target_ids)
    materials = db.query(Material).filter(Material.id.in_(target_ids)).all()
    
    return candidate, materials


def execute_candidate_list(db: Session, candidate_id: int, operator: str) -> CandidateList:
    candidate, materials = get_candidate_list_materials(db, candidate_id)
    
    if candidate.is_executed:
        raise ValueError("候选清单已执行")
    
    if candidate.operation_type == OperationType.DELETE:
        for material in materials:
            db.delete(material)
    elif candidate.operation_type == OperationType.ROLLBACK:
        for material in materials:
            material.status = MaterialStatus.PENDING
    
    candidate.is_executed = True
    candidate.executed_at = datetime.now()
    
    log_operation(
        db, 
        candidate.operation_type, 
        operator, 
        [m.id for m in materials], 
        f"执行候选清单: {candidate.name}"
    )
    
    db.commit()
    db.refresh(candidate)
    return candidate


def query_materials(db: Session, query_filter: QueryFilter) -> List[Material]:
    query = db.query(Material)
    
    if query_filter.file_summary:
        query = query.filter(Material.file_summary.contains(query_filter.file_summary))
    
    if query_filter.status:
        query = query.filter(Material.status == query_filter.status)
    
    if query_filter.batch_id:
        query = query.filter(Material.batch_id == query_filter.batch_id)
    
    if query_filter.only_needs_confirmation:
        query = query.join(Evaluation).filter(
            Evaluation.is_manual_confirmed == False,
            Material.status.in_([MaterialStatus.PARTIAL_SUCCESS, MaterialStatus.NEEDS_REVIEW])
        )
    
    return query.order_by(Material.created_at.desc()).all()


def log_operation(db: Session, operation_type: str, operator: str, target_ids: List[int], remark: str):
    log = OperationLog(
        operation_type=operation_type,
        operator=operator,
        target_ids=json.dumps(target_ids),
        remark=remark
    )
    db.add(log)
    db.commit()
