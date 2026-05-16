import io
import json
import pandas as pd
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    TaskBatchCreate, ProcessDetailUpdate, TaskBatchStatusUpdate,
    ManualFixRequest, TaskBatchQuery, ExportRequest
)
from service import (
    create_task_batch, update_process_detail, update_batch_status,
    manual_fix_receipt, get_receipt_by_no, get_batch_by_idempotent_key,
    query_task_batches, get_batch_details, build_receipt_response,
    update_export_stats
)
from models import TaskStatus

router = APIRouter()


@router.post("/receipts", summary="创建任务批次并生成收据")
def create_receipt(request: TaskBatchCreate, db: Session = Depends(get_db)):
    try:
        batch, is_duplicate = create_task_batch(db, request)
        response_data = build_receipt_response(db, batch, is_duplicate)
        if is_duplicate:
            return {
                "code": 200,
                "message": "重复请求，已返回已有收据",
                "data": response_data
            }
        return {
            "code": 201,
            "message": "创建成功",
            "data": response_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.get("/receipts/{receipt_no}", summary="根据收据编号查询")
def get_receipt(receipt_no: str, db: Session = Depends(get_db)):
    receipt = get_receipt_by_no(db, receipt_no)
    if not receipt:
        raise HTTPException(status_code=404, detail="收据不存在")
    return {
        "code": 200,
        "message": "查询成功",
        "data": {
            "receipt_no": receipt.receipt_no,
            "idempotent_key": receipt.idempotent_key,
            "status": receipt.status,
            "final_conclusion": receipt.final_conclusion,
            "result_summary": receipt.result_summary,
            "issued_at": receipt.issued_at,
            "issued_by": receipt.issued_by,
            "export_count": receipt.export_count,
            "last_exported_at": receipt.last_exported_at
        }
    }


@router.get("/receipts/idempotent/{idempotent_key}", summary="根据幂等键查询")
def get_by_idempotent_key(idempotent_key: str, db: Session = Depends(get_db)):
    batch = get_batch_by_idempotent_key(db, idempotent_key)
    if not batch:
        raise HTTPException(status_code=404, detail="未找到对应任务")
    response_data = build_receipt_response(db, batch, False)
    return {
        "code": 200,
        "message": "查询成功",
        "data": response_data
    }


@router.post("/receipts/query", summary="分页查询任务批次列表")
def query_receipts(query: TaskBatchQuery, db: Session = Depends(get_db)):
    batches, total = query_task_batches(db, query)
    data_list = [build_receipt_response(db, batch, False) for batch in batches]
    return {
        "code": 200,
        "message": "查询成功",
        "data": {
            "list": data_list,
            "total": total,
            "page": query.page,
            "page_size": query.page_size
        }
    }


@router.patch("/receipts/{batch_id}/details", summary="更新处理明细状态")
def update_details(batch_id: int, updates: List[ProcessDetailUpdate], db: Session = Depends(get_db)):
    try:
        batch = update_process_detail(db, batch_id, updates)
        response_data = build_receipt_response(db, batch, False)
        return {
            "code": 200,
            "message": "明细更新成功",
            "data": response_data
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.patch("/receipts/{batch_id}/status", summary="推进批次状态")
def update_status(batch_id: int, request: TaskBatchStatusUpdate, db: Session = Depends(get_db)):
    try:
        batch = update_batch_status(db, batch_id, request)
        response_data = build_receipt_response(db, batch, False)
        return {
            "code": 200,
            "message": "状态更新成功",
            "data": response_data
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.post("/receipts/manual-fix", summary="人工修正收据")
def manual_fix(request: ManualFixRequest, db: Session = Depends(get_db)):
    try:
        receipt = manual_fix_receipt(db, request)
        return {
            "code": 200,
            "message": "人工修正成功",
            "data": {
                "receipt_no": receipt.receipt_no,
                "status": receipt.status,
                "final_conclusion": receipt.final_conclusion,
                "result_summary": receipt.result_summary,
                "operator": receipt.issued_by
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修正失败: {str(e)}")


@router.get("/receipts/{batch_id}/details", summary="获取批次处理明细")
def get_details(batch_id: int, db: Session = Depends(get_db)):
    details = get_batch_details(db, batch_id)
    return {
        "code": 200,
        "message": "查询成功",
        "data": [
            {
                "detail_no": d.detail_no,
                "item_key": d.item_key,
                "item_data": d.item_data,
                "status": d.status,
                "result_data": d.result_data,
                "error_message": d.error_message,
                "processing_basis": d.processing_basis,
                "processed_at": d.processed_at,
                "retry_count": d.retry_count
            }
            for d in details
        ]
    }


@router.post("/receipts/export", summary="导出收据数据")
def export_receipts(request: ExportRequest, db: Session = Depends(get_db)):
    if request.receipt_nos:
        from models import Receipt, TaskBatch
        batches = db.query(TaskBatch).join(Receipt).filter(
            Receipt.receipt_no.in_(request.receipt_nos)
        ).all()
    elif request.query:
        batches, _ = query_task_batches(db, request.query)
    else:
        raise HTTPException(status_code=400, detail="请提供查询条件或收据编号列表")

    export_data = []
    detail_data = []

    for batch in batches:
        receipt = get_receipt_by_no(db, batch.receipt_no)
        row = {
            "收据编号": batch.receipt_no,
            "批次号": batch.batch_no,
            "批次名称": batch.batch_name,
            "幂等键": batch.idempotent_key,
            "触发来源": batch.trigger_source.value if hasattr(batch.trigger_source, 'value') else batch.trigger_source,
            "状态": batch.status.value if hasattr(batch.status, 'value') else batch.status,
            "总数": batch.total_count,
            "成功数": batch.success_count,
            "失败数": batch.failed_count,
            "最终结论": receipt.final_conclusion if receipt else "",
            "结果摘要": json.dumps(receipt.result_summary, ensure_ascii=False) if receipt and receipt.result_summary else "",
            "原始输入": json.dumps(batch.original_input, ensure_ascii=False) if batch.original_input else "",
            "结果快照": json.dumps(batch.result_snapshot, ensure_ascii=False) if batch.result_snapshot else "",
            "错误信息": batch.error_message or "",
            "操作人": batch.operator or "",
            "创建时间": batch.created_at.strftime("%Y-%m-%d %H:%M:%S") if batch.created_at else "",
            "处理时间": batch.processed_at.strftime("%Y-%m-%d %H:%M:%S") if batch.processed_at else "",
            "导出次数": receipt.export_count if receipt else 0,
            "最后导出时间": receipt.last_exported_at.strftime("%Y-%m-%d %H:%M:%S") if receipt and receipt.last_exported_at else ""
        }
        export_data.append(row)

        if request.include_details:
            details = get_batch_details(db, batch.id)
            for d in details:
                detail_row = {
                    "收据编号": batch.receipt_no,
                    "明细号": d.detail_no,
                    "项标识": d.item_key,
                    "状态": d.status.value if hasattr(d.status, 'value') else d.status,
                    "项数据": json.dumps(d.item_data, ensure_ascii=False) if d.item_data else "",
                    "结果数据": json.dumps(d.result_data, ensure_ascii=False) if d.result_data else "",
                    "错误信息": d.error_message or "",
                    "处理依据": json.dumps(d.processing_basis, ensure_ascii=False) if d.processing_basis else "",
                    "处理时间": d.processed_at.strftime("%Y-%m-%d %H:%M:%S") if d.processed_at else "",
                    "重试次数": d.retry_count
                }
                detail_data.append(detail_row)

        update_export_stats(db, batch.receipt_no)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(export_data).to_excel(writer, sheet_name='收据摘要', index=False)
        if request.include_details and detail_data:
            pd.DataFrame(detail_data).to_excel(writer, sheet_name='处理明细', index=False)

    output.seek(0)
    filename = f"receipt_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/stats", summary="获取统计数据")
def get_stats(db: Session = Depends(get_db)):
    from models import TaskBatch
    total = db.query(TaskBatch).count()
    pending = db.query(TaskBatch).filter(TaskBatch.status == TaskStatus.PENDING).count()
    processing = db.query(TaskBatch).filter(TaskBatch.status == TaskStatus.PROCESSING).count()
    success = db.query(TaskBatch).filter(TaskBatch.status == TaskStatus.SUCCESS).count()
    failed = db.query(TaskBatch).filter(TaskBatch.status == TaskStatus.FAILED).count()
    manual_fixed = db.query(TaskBatch).filter(TaskBatch.status == TaskStatus.MANUAL_FIXED).count()

    return {
        "code": 200,
        "message": "查询成功",
        "data": {
            "total": total,
            "pending": pending,
            "processing": processing,
            "success": success,
            "failed": failed,
            "manual_fixed": manual_fixed
        }
    }
