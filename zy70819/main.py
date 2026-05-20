from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from urllib.parse import quote
import io
import pandas as pd

from database import engine, get_db, Base
import models
import schemas
import crud

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="牙科耗材效期预警API服务",
    description="为口腔连锁采购提供耗材效期管理、分类预警、修改追溯功能",
    version="1.0.0"
)


@app.post("/api/batches/", response_model=schemas.BatchResponse, summary="创建批次")
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    """
    创建新的耗材批次，系统自动进行效期分类：
    - **正常**: 效期充足
    - **待补充**: 效期不足，需要重点关注
    - **已拦截**: 过期或近效期，需拦截处理
    
    重复提交的批次会自动识别并返回原有处理结果。
    """
    existing_batch = crud.get_batch_by_number(db, batch_number=batch.batch_number)
    if existing_batch:
        response = schemas.BatchResponse.model_validate(existing_batch)
        response.is_duplicate = True
        return response
    
    db_batch, is_duplicate = crud.create_batch(db=db, batch_data=batch)
    response = schemas.BatchResponse.model_validate(db_batch)
    response.is_duplicate = is_duplicate
    return response


@app.get("/api/batches/", response_model=List[schemas.BatchResponse], summary="获取批次列表")
def read_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    获取所有批次列表，支持分页
    """
    batches = crud.get_all_batches(db, skip=skip, limit=limit)
    return batches


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchDetailResponse, summary="获取批次详情")
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    """
    获取批次详细信息，包含每个耗材的修改历史
    """
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.put("/api/items/{item_id}", response_model=schemas.ItemWithHistoryResponse, summary="修改耗材结论")
def modify_item(item_id: int, modify_data: schemas.ModifyItemRequest, db: Session = Depends(get_db)):
    """
    修改耗材的分类结论，系统会记录修改历史：
    - 修改人
    - 修改时间
    - 修改前的分类、原因和后续动作
    - 修改原因
    """
    db_item = crud.modify_batch_item(db, item_id=item_id, modify_data=modify_data)
    if db_item is None:
        raise HTTPException(status_code=404, detail="耗材记录不存在")
    return db_item


@app.get("/api/items/{item_id}/history", response_model=List[schemas.ChangeHistoryResponse], summary="获取修改历史")
def get_item_history(item_id: int, db: Session = Depends(get_db)):
    """
    获取单个耗材的所有修改历史记录
    """
    db_item = crud.get_batch_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="耗材记录不存在")
    return crud.get_item_change_history(db, item_id=item_id)


@app.get("/api/statistics", summary="获取统计信息")
def get_statistics(db: Session = Depends(get_db)):
    """
    获取系统统计信息：
    - 总批次数
    - 总耗材数
    - 分类分布统计
    """
    return crud.get_statistics(db)


@app.get("/api/reports/batch/{batch_id}", summary="下载批次报告")
def download_batch_report(batch_id: int, db: Session = Depends(get_db)):
    """
    下载批次的Excel报告，包含完整的耗材信息和分类结果
    """
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    data = []
    for item in db_batch.items:
        row = {
            "批次号": db_batch.batch_number,
            "提交人": db_batch.submitted_by,
            "提交时间": db_batch.submit_time.strftime("%Y-%m-%d %H:%M:%S"),
            "耗材编码": item.material_code,
            "耗材名称": item.material_name,
            "规格型号": item.specification or "",
            "生产厂家": item.manufacturer or "",
            "生产批号": item.batch_no,
            "生产日期": item.production_date.strftime("%Y-%m-%d") if item.production_date else "",
            "有效期至": item.expiry_date.strftime("%Y-%m-%d"),
            "数量": item.quantity,
            "单位": item.unit or "",
            "供应商": item.supplier or "",
            "储存条件": item.storage_condition or "",
            "分类结果": item.classification.value,
            "分类原因": item.reason or "",
            "后续动作": item.follow_up_action or ""
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='批次详情', index=False)
        
        worksheet = writer.sheets['批次详情']
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
    
    filename = f"batch_report_{db_batch.batch_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


@app.get("/api/reports/full", summary="下载全量报告")
def download_full_report(db: Session = Depends(get_db)):
    """
    下载所有批次的完整Excel报告，包含修改历史
    """
    batches = crud.get_all_batches(db)
    
    data = []
    for batch in batches:
        for item in batch.items:
            history_records = crud.get_item_change_history(db, item_id=item.id)
            history_str = "; ".join([
                f"[{h.change_time.strftime('%Y-%m-%d %H:%M')}] {h.changed_by} 将 {h.old_classification.value if h.old_classification else '无'} 改为 {h.new_classification.value if h.new_classification else '无'}, 原因: {h.change_reason}"
                for h in history_records
            ]) if history_records else "无修改记录"
            
            row = {
                "批次号": batch.batch_number,
                "提交人": batch.submitted_by,
                "提交时间": batch.submit_time.strftime("%Y-%m-%d %H:%M:%S"),
                "耗材编码": item.material_code,
                "耗材名称": item.material_name,
                "规格型号": item.specification or "",
                "生产厂家": item.manufacturer or "",
                "生产批号": item.batch_no,
                "生产日期": item.production_date.strftime("%Y-%m-%d") if item.production_date else "",
                "有效期至": item.expiry_date.strftime("%Y-%m-%d"),
                "数量": item.quantity,
                "单位": item.unit or "",
                "供应商": item.supplier or "",
                "分类结果": item.classification.value,
                "分类原因": item.reason or "",
                "后续动作": item.follow_up_action or "",
                "修改历史": history_str
            }
            data.append(row)
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='全量数据', index=False)
        
        worksheet = writer.sheets['全量数据']
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 60)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    output.seek(0)
    
    filename = f"full_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
