from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io

from database import get_db, engine, Base
from models import EvaluationSlice, ReconciliationRecord
from schemas import (
    EvaluationSliceCreate,
    EvaluationSliceResponse,
    ReconciliationRecordResponse,
    ReconciliationRecordImport,
    RecordDetailResponse,
    FeatureSnapshotUpdate,
    ThresholdReplayUpdate,
    ManualReviewUpdate,
    ImportResultResponse,
    AuditLogResponse,
    SliceImportRequest,
)
from services import ReconciliationService
from boundary_rules import BoundaryRules

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="召回排序漏斗对账系统",
    description="保证明细、页面、接口返回同一份结果，保留原始行号、人工改动、处理状态",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/slices", response_model=List[EvaluationSliceResponse], summary="获取评测切片列表")
def get_slices(db: Session = Depends(get_db)):
    """获取所有评测切片列表"""
    slices = db.query(EvaluationSlice).order_by(EvaluationSlice.import_time.desc()).all()
    return slices


@app.get("/api/slices/{slice_id}", response_model=EvaluationSliceResponse, summary="获取切片详情")
def get_slice(slice_id: int, db: Session = Depends(get_db)):
    """获取单个评测切片详情"""
    slice_obj = db.query(EvaluationSlice).filter(EvaluationSlice.id == slice_id).first()
    if not slice_obj:
        raise HTTPException(status_code=404, detail="评测切片不存在")
    return slice_obj


@app.post("/api/slices", response_model=ImportResultResponse, summary="导入评测切片")
def create_slice(
    request: SliceImportRequest,
    db: Session = Depends(get_db),
):
    """
    第一步: 导入评测切片及明细记录

    - 自动识别少数类样本
    - 自动检测被总指标盖住的样本
    - 被盖住的样本标记为待复核状态
    """
    service = ReconciliationService(db)
    try:
        slice_obj, stats = service.import_evaluation_slice(
            slice_name=request.slice_name,
            records=request.records,
            imported_by=request.imported_by,
            description=request.description,
        )
        return ImportResultResponse(
            slice_id=slice_obj.id,
            slice_name=slice_obj.slice_name,
            **stats,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/slices/{slice_id}/import-excel", response_model=ImportResultResponse, summary="通过Excel导入评测切片")
async def import_slice_excel(
    slice_id: int,
    file: UploadFile = File(...),
    imported_by: str = "system",
    db: Session = Depends(get_db),
):
    """通过Excel文件导入评测切片明细"""
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))

        required_columns = ["original_row_number"]
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Excel缺少必要列: {col}")

        records = []
        for _, row in df.iterrows():
            record = ReconciliationRecordImport(
                original_row_number=int(row.get("original_row_number", 0)),
                sample_id=str(row.get("sample_id", "")) if pd.notna(row.get("sample_id")) else None,
                sample_type=str(row.get("sample_type", "")) if pd.notna(row.get("sample_type")) else None,
                recall_rate=float(row["recall_rate"]) if pd.notna(row.get("recall_rate")) else None,
                precision_rate=float(row["precision_rate"]) if pd.notna(row.get("precision_rate")) else None,
                total_metric=float(row["total_metric"]) if pd.notna(row.get("total_metric")) else None,
            )
            records.append(record)

        service = ReconciliationService(db)
        slice_obj = db.query(EvaluationSlice).filter(EvaluationSlice.id == slice_id).first()
        if not slice_obj:
            raise HTTPException(status_code=404, detail="评测切片不存在")

        stats = {"total_records": len(records), "minority_count": 0, "masked_by_total_count": 0}
        for record in records:
            db_record = ReconciliationRecord(
                slice_id=slice_id,
                original_row_number=record.original_row_number,
                sample_id=record.sample_id,
                sample_type=record.sample_type,
                is_minority=False,
                recall_rate=record.recall_rate,
                precision_rate=record.precision_rate,
                total_metric=record.total_metric,
                status="step1_imported",
            )
            db.add(db_record)

        db.commit()
        slice_obj.total_count = len(records)
        db.commit()

        return ImportResultResponse(
            slice_id=slice_id,
            slice_name=slice_obj.slice_name,
            **stats,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.get("/api/slices/{slice_id}/records", response_model=List[ReconciliationRecordResponse], summary="获取切片对账记录")
def get_slice_records(
    slice_id: int,
    status: Optional[str] = None,
    minority_only: bool = False,
    masked_only: bool = False,
    db: Session = Depends(get_db),
):
    """
    获取切片下的对账记录列表

    - 支持按状态筛选
    - 支持只看少数类样本
    - 支持只看被总指标盖住的样本
    """
    service = ReconciliationService(db)
    records = service.get_slice_records(
        slice_id=slice_id,
        status_filter=status,
        minority_only=minority_only,
        masked_only=masked_only,
    )
    return records


@app.get("/api/records/{record_id}", response_model=RecordDetailResponse, summary="获取记录详情")
def get_record_detail(record_id: int, db: Session = Depends(get_db)):
    """获取单条对账记录详情，包含完整审计日志"""
    service = ReconciliationService(db)
    record = service.get_record_with_audit(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return record


@app.get("/api/records/{record_id}/audit-logs", response_model=List[AuditLogResponse], summary="获取记录审计日志")
def get_record_audit_logs(record_id: int, db: Session = Depends(get_db)):
    """获取单条记录的完整操作历史"""
    from models import AuditLog
    logs = db.query(AuditLog).filter(AuditLog.record_id == record_id).order_by(AuditLog.operation_time.desc()).all()
    return logs


@app.put("/api/records/{record_id}/feature-snapshot", response_model=ReconciliationRecordResponse, summary="步骤2: 补看特征快照编号")
def add_feature_snapshot(
    record_id: int,
    update: FeatureSnapshotUpdate,
    db: Session = Depends(get_db),
):
    """
    第二步: 实验平台负责人阿越补看特征快照编号

    边界规则: 被总指标盖住的少数类样本保持待复核状态
    """
    service = ReconciliationService(db)
    try:
        record = service.add_feature_snapshot(record_id, update)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/records/{record_id}/threshold-replay", response_model=ReconciliationRecordResponse, summary="步骤3: 阈值回放更新")
def update_threshold_replay(
    record_id: int,
    update: ThresholdReplayUpdate,
    db: Session = Depends(get_db),
):
    """
    第三步: 阈值回放更新

    边界规则: 被总指标盖住的少数类样本不自动归正常，继续待复核
    """
    service = ReconciliationService(db)
    try:
        record = service.update_threshold_replay(record_id, update)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/records/{record_id}/review", response_model=ReconciliationRecordResponse, summary="算法工程师人工复核")
def manual_review(
    record_id: int,
    review: ManualReviewUpdate,
    db: Session = Depends(get_db),
):
    """
    算法工程师人工复核

    边界规则: 被总指标盖住的少数类样本必须经过此步骤才能确认
    """
    service = ReconciliationService(db)
    try:
        record = service.manual_review(record_id, review)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/records/{record_id}/rollback", response_model=ReconciliationRecordResponse, summary="回滚记录")
def rollback_record(
    record_id: int,
    operator: str,
    target_step: str = "step1_imported",
    remark: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """回滚记录到指定步骤，支持完整审计追踪"""
    service = ReconciliationService(db)
    try:
        record = service.rollback_record(record_id, operator, target_step, remark)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/records/{record_id}/mark-pending", response_model=ReconciliationRecordResponse, summary="标记为待复核")
def mark_pending_review(
    record_id: int,
    operator: str,
    remark: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """手动将记录标记为待算法工程师复核"""
    service = ReconciliationService(db)
    try:
        record = service.mark_pending_review(record_id, operator, remark)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/slices/{slice_id}/export", summary="导出对账明细")
def export_records(
    slice_id: int,
    db: Session = Depends(get_db),
):
    """
    导出对账明细（Excel格式）

    关键保证: 导出的明细与页面展示、接口返回使用同一份数据源
    """
    from fastapi.responses import StreamingResponse

    service = ReconciliationService(db)
    records = service.get_slice_records(slice_id=slice_id)
    slice_obj = db.query(EvaluationSlice).filter(EvaluationSlice.id == slice_id).first()

    if not slice_obj:
        raise HTTPException(status_code=404, detail="评测切片不存在")

    rules = BoundaryRules()
    data = []
    for record in records:
        data.append({
            "原始行号": record.original_row_number,
            "样本ID": record.sample_id,
            "样本类型": record.sample_type,
            "是否少数类": "是" if record.is_minority else "否",
            "召回率": record.recall_rate,
            "准确率": record.precision_rate,
            "总指标": record.total_metric,
            "是否被总指标盖住": "是" if record.is_masked_by_total else "否",
            "特征快照编号": record.feature_snapshot_id,
            "特征快照补看人": record.feature_snapshot_added_by,
            "回放阈值": record.threshold_value,
            "阈值回放结果": record.threshold_replay_result,
            "当前状态": rules.get_status_description(record.status),
            "人工备注": record.manual_note,
            "复核人": record.reviewed_by,
            "创建时间": record.created_at,
            "更新时间": record.updated_at,
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="对账明细")

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=对账明细_{slice_obj.slice_name}.xlsx"},
    )


@app.get("/api/boundary-rules", summary="获取边界规则说明")
def get_boundary_rules():
    """获取系统的边界规则说明，确保各方理解一致"""
    rules = BoundaryRules()
    return {
        "少数类判定规则": {
            "条件1": "样本类型显式标记为'少数类'",
            "条件2": f"召回率 < 30%",
            "条件3": f"类别占比 < {rules.MINORITY_THRESHOLD:.0%}",
        },
        "总指标盖住判定规则": {
            "前提": "必须是少数类样本",
            "条件1": f"总指标 >= {rules.TOTAL_METRIC_MASK_THRESHOLD:.0%}",
            "条件2": "总指标高于切片平均水平（如有）",
        },
        "关键禁止规则": "被总指标盖住的少数类样本，禁止自动归为正常，必须标记为待复核",
        "状态流转规则": {
            "step1_imported": "评测切片已导入",
            "step2_feature_added": "特征快照编号已补看",
            "step3_threshold_updated": "阈值回放已更新",
            "pending_review": "待算法工程师复核",
            "confirmed_normal": "已确认正常",
            "confirmed_abnormal": "已确认异常",
            "rollback": "已回滚",
        },
    }


@app.get("/api/health", summary="健康检查")
def health_check():
    return {"status": "ok", "service": "召回排序漏斗对账系统"}
