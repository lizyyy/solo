from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import pandas as pd

from app.database import get_db
from app.models import EvaluationRecord, DiagnosisBatch, DiagnosisResult
from app.schemas import (
    DiagnosisRequest,
    BatchDiagnosisResponse,
    DiagnosisBatchResponse,
    DiagnosisResultResponse,
    FilterConditionCreate,
    FilterConditionResponse,
    ExportRequest,
    ErrorResponse
)
from app.services.question_bank import IdempotencyService, FilterConditionService
from app.services.diagnosis_service import DiagnosisService
from app.errors import (
    DuplicateBatchError,
    FilterConditionMismatchError,
    get_human_readable_error
)

router = APIRouter(prefix="/diagnosis", tags=["诊断"])


@router.get("/batches", response_model=List[DiagnosisBatchResponse])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DiagnosisBatch)
    if status:
        query = query.filter(DiagnosisBatch.status == status)
    batches = query.order_by(DiagnosisBatch.created_at.desc()).offset(skip).limit(limit).all()
    return batches


@router.get("/batches/{batch_id}", response_model=DiagnosisBatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(DiagnosisBatch).filter(DiagnosisBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "BATCH_NOT_FOUND",
                "message": f"诊断批次ID {batch_id} 不存在",
                "suggestion": "请检查批次ID是否正确",
                "contact_person": "系统管理员"
            }
        )
    return batch


@router.get("/batches/{batch_id}/results", response_model=List[DiagnosisResultResponse])
def get_batch_results(
    batch_id: int,
    skip: int = 0,
    limit: int = 100,
    diagnosis_type: Optional[str] = None,
    is_correct: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DiagnosisResult).filter(DiagnosisResult.batch_id == batch_id)
    if diagnosis_type:
        query = query.filter(DiagnosisResult.diagnosis_type == diagnosis_type)
    if is_correct is not None:
        query = query.filter(DiagnosisResult.is_correct == is_correct)
    return query.offset(skip).limit(limit).all()


@router.post("/run", response_model=BatchDiagnosisResponse)
def run_diagnosis(request: DiagnosisRequest, db: Session = Depends(get_db)):
    records = db.query(EvaluationRecord).filter(
        EvaluationRecord.id.in_(request.evaluation_record_ids)
    ).all()

    if not records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_RECORDS_SELECTED",
                "message": "没有找到选中的讲评记录",
                "suggestion": "请先选择要诊断的讲评记录",
                "contact_person": "讲评老师"
            }
        )

    idempotency_service = IdempotencyService(db)
    material_hash = idempotency_service.generate_material_hash(request.evaluation_record_ids)

    batch, is_reused = idempotency_service.get_or_create_batch(
        batch_name=request.batch_name,
        material_hash=material_hash,
        evaluation_record_ids=request.evaluation_record_ids,
        filter_condition_id=request.filter_condition_id
    )

    if is_reused:
        results = idempotency_service.get_batch_results(batch.id)
        summary = _calculate_summary(results)
        return BatchDiagnosisResponse(
            batch=DiagnosisBatchResponse(
                id=batch.id,
                batch_hash=batch.batch_hash,
                batch_name=batch.batch_name,
                material_count=batch.material_count,
                status=batch.status,
                error_message=batch.error_message,
                created_at=batch.created_at,
                completed_at=batch.completed_at,
                filter_condition_id=batch.filter_condition_id,
                is_reused=True
            ),
            results=results,
            summary=summary
        )

    try:
        diagnosis_service = DiagnosisService(db)
        result_data_list, summary = diagnosis_service.diagnose_batch(records, batch.id)

        results = []
        for result_data in result_data_list:
            result = DiagnosisResult(**result_data.model_dump())
            db.add(result)
            results.append(result)

        batch.status = "completed"
        batch.completed_at = datetime.now()
        db.commit()

        for result in results:
            db.refresh(result)

        return BatchDiagnosisResponse(
            batch=DiagnosisBatchResponse(
                id=batch.id,
                batch_hash=batch.batch_hash,
                batch_name=batch.batch_name,
                material_count=batch.material_count,
                status=batch.status,
                error_message=batch.error_message,
                created_at=batch.created_at,
                completed_at=batch.completed_at,
                filter_condition_id=batch.filter_condition_id,
                is_reused=False
            ),
            results=results,
            summary=summary
        )

    except Exception as e:
        batch.status = "failed"
        batch.error_message = str(e)
        db.commit()
        raise


@router.post("/export")
def export_results(request: ExportRequest, db: Session = Depends(get_db)):
    batch = db.query(DiagnosisBatch).filter(DiagnosisBatch.id == request.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "BATCH_NOT_FOUND",
                "message": f"诊断批次ID {request.batch_id} 不存在",
                "suggestion": "请检查批次ID是否正确",
                "contact_person": "系统管理员"
            }
        )

    if batch.filter_condition_id != request.filter_condition_id:
        if not (batch.filter_condition_id is None and request.filter_condition_id is None):
            raise FilterConditionMismatchError()

    query = db.query(DiagnosisResult).filter(DiagnosisResult.batch_id == request.batch_id)

    if request.filter_condition_id:
        filter_service = FilterConditionService(db)
        condition = filter_service.get_condition(request.filter_condition_id)
        if condition:
            condition_json = condition.condition_json
            if 'diagnosis_type' in condition_json:
                query = query.filter(DiagnosisResult.diagnosis_type == condition_json['diagnosis_type'])
            if 'is_correct' in condition_json:
                query = query.filter(DiagnosisResult.is_correct == condition_json['is_correct'])

    results = query.all()

    data = []
    for result in results:
        record = result.evaluation_record
        question = result.question
        data.append({
            "学生学号": record.student_id if record else "",
            "学生姓名": record.student_name if record else "",
            "题目编号": record.question_no if record else "",
            "题目内容": question.content if question else "",
            "学生答案": record.student_answer if record else "",
            "标准答案": question.standard_answer if question else "",
            "诊断结果": "正确" if result.is_correct else "错误",
            "是否等价答案": "是" if result.is_equivalent else "否",
            "错误类型": _get_error_type_name(result.error_type),
            "错误说明": result.human_readable_error or "",
            "改进建议": result.suggestion or "",
            "下一步操作": result.next_action or "",
            "联系人": result.contact_person or ""
        })

    df = pd.DataFrame(data)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='诊断结果')

        workbook = writer.book
        worksheet = writer.sheets['诊断结果']

        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width

    output.seek(0)

    filename = f"诊断结果_{batch.batch_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _calculate_summary(results: List[DiagnosisResult]) -> Dict[str, Any]:
    total = len(results)
    correct = sum(1 for r in results if r.is_correct)
    equivalent = sum(1 for r in results if r.is_equivalent)
    incorrect = sum(1 for r in results if not r.is_correct)

    error_types = {}
    for r in results:
        if not r.is_correct and r.error_type:
            type_name = _get_error_type_name(r.error_type)
            error_types[type_name] = error_types.get(type_name, 0) + 1

    return {
        "total_records": total,
        "successfully_diagnosed": total,
        "diagnostic_errors": 0,
        "correct_count": correct,
        "equivalent_count": equivalent,
        "incorrect_count": incorrect,
        "accuracy_rate": round(correct / total * 100, 2) if total > 0 else 0,
        "error_type_distribution": error_types,
        "errors": []
    }


def _get_error_type_name(error_type: Optional[str]) -> str:
    type_names = {
        "format_error": "格式错误",
        "type_mismatch": "递推类型不匹配",
        "wrong_common_difference": "公差错误",
        "wrong_common_ratio": "公比错误",
        "wrong_coefficient": "系数错误",
        "wrong_constant": "常数项错误",
        "calculation_error": "计算错误",
        "correct": "正确",
        "incorrect": "错误"
    }
    return type_names.get(error_type or "", error_type or "")
