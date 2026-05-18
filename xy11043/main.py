import os
import io
import pandas as pd
from datetime import date, datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db, Base
import models
import schemas
import crud

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="家具定制厂板材裁切排队 API",
    description="支持按日期、状态、负责人或门店筛选，批量导入时处理余料预占冲突，提供行级结果",
    version="1.0.0"
)

@app.get("/", tags=["根目录"])
def read_root():
    return {
        "message": "家具定制厂板材裁切排队 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_endpoints": {
            "创建": "POST /api/cutting-queue/",
            "修改": "PUT /api/cutting-queue/{id}",
            "查询列表": "GET /api/cutting-queue/",
            "查询单个": "GET /api/cutting-queue/{id}",
            "删除": "DELETE /api/cutting-queue/{id}",
            "批量导入": "POST /api/cutting-queue/batch-import",
            "导出": "GET /api/cutting-queue/export"
        }
    }

@app.post("/api/cutting-queue/", response_model=schemas.CuttingQueueResponse, tags=["裁切排队"], summary="创建裁切排队记录")
def create_cutting_queue(queue: schemas.CuttingQueueCreate, db: Session = Depends(get_db)):
    db_queue = crud.get_cutting_queue_by_order_no(db, order_no=queue.order_no)
    if db_queue:
        raise HTTPException(status_code=400, detail=f"订单编号 {queue.order_no} 已存在")
    return crud.create_cutting_queue(db=db, queue=queue)

@app.get("/api/cutting-queue/", response_model=List[schemas.CuttingQueueResponse], tags=["裁切排队"], summary="查询裁切排队列表")
def read_cutting_queues(
    skip: int = Query(0, description="跳过记录数"),
    limit: int = Query(100, description="返回记录数"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    status: Optional[str] = Query(None, description="状态: pending, queued, cutting, completed, paused, cancelled"),
    assigned_to: Optional[str] = Query(None, description="负责人"),
    store_name: Optional[str] = Query(None, description="门店名称"),
    board_type: Optional[str] = Query(None, description="板材类型"),
    is_urgent: Optional[bool] = Query(None, description="是否急单"),
    db: Session = Depends(get_db)
):
    queues = crud.get_cutting_queues(
        db,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        status=status,
        assigned_to=assigned_to,
        store_name=store_name,
        board_type=board_type,
        is_urgent=is_urgent
    )
    return queues

@app.post("/api/cutting-queue/batch-import", response_model=schemas.BatchImportResponse, tags=["裁切排队"], summary="批量导入裁切排队记录")
def batch_import(items: List[schemas.BatchImportItem], db: Session = Depends(get_db)):
    create_items = [schemas.CuttingQueueCreate(**item.model_dump()) for item in items]
    result = crud.bulk_import_cutting_queue(db, create_items)
    return result

@app.get("/api/cutting-queue/export", tags=["裁切排队"], summary="导出裁切排队记录")
def export_cutting_queues(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    status: Optional[str] = Query(None, description="状态"),
    assigned_to: Optional[str] = Query(None, description="负责人"),
    store_name: Optional[str] = Query(None, description="门店名称"),
    db: Session = Depends(get_db)
):
    queues = crud.get_cutting_queues(
        db,
        skip=0,
        limit=10000,
        start_date=start_date,
        end_date=end_date,
        status=status,
        assigned_to=assigned_to,
        store_name=store_name
    )
    
    data = []
    for q in queues:
        data.append({
            "ID": q.id,
            "订单编号": q.order_no,
            "客户名称": q.customer_name,
            "门店名称": q.store_name,
            "销售员": q.salesperson,
            "下单日期": q.order_date,
            "交货日期": q.delivery_date,
            "板材类型": q.board_type,
            "板材颜色": q.board_color,
            "板材厚度(mm)": q.board_thickness,
            "板材长度(mm)": q.board_length,
            "板材宽度(mm)": q.board_width,
            "需求数量": q.required_pieces,
            "已裁切数量": q.cut_pieces,
            "剩余数量": q.remaining_pieces,
            "物料编码": q.material_code,
            "物料批次": q.material_batch,
            "物料位置": q.material_location,
            "封边要求": q.edge_banding,
            "钻孔要求": q.drilling,
            "特殊工艺": q.special_processing,
            "优先级": q.priority,
            "状态": q.status,
            "负责人": q.assigned_to,
            "机器编号": q.machine_no,
            "预计裁切时间(分钟)": q.estimated_cutting_time,
            "是否急单": "是" if q.is_urgent else "否",
            "备注": q.remarks,
            "版本": q.version,
            "创建时间": q.created_at,
            "更新时间": q.updated_at
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='裁切排队')
    
    output.seek(0)
    filename = f"cutting_queue_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/cutting-queue/{queue_id}", response_model=schemas.CuttingQueueResponse, tags=["裁切排队"], summary="查询单个裁切排队记录")
def read_cutting_queue(queue_id: int, db: Session = Depends(get_db)):
    db_queue = crud.get_cutting_queue(db, queue_id=queue_id)
    if db_queue is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return db_queue

@app.put("/api/cutting-queue/{queue_id}", response_model=schemas.CuttingQueueResponse, tags=["裁切排队"], summary="修改裁切排队记录")
def update_cutting_queue(queue_id: int, queue_update: schemas.CuttingQueueUpdate, db: Session = Depends(get_db)):
    db_queue = crud.get_cutting_queue(db, queue_id=queue_id)
    if db_queue is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return crud.update_cutting_queue(db=db, queue_id=queue_id, queue_update=queue_update)

@app.delete("/api/cutting-queue/{queue_id}", tags=["裁切排队"], summary="删除裁切排队记录")
def delete_cutting_queue(queue_id: int, db: Session = Depends(get_db)):
    db_queue = crud.get_cutting_queue(db, queue_id=queue_id)
    if db_queue is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    crud.delete_cutting_queue(db=db, queue_id=queue_id)
    return {"message": "删除成功"}

def check_config():
    required_configs = ["DATABASE_URL"]
    missing_configs = []
    for config in required_configs:
        if not os.getenv(config):
            missing_configs.append(config)
    
    if missing_configs:
        print("=" * 60)
        print("警告: 缺少必要的配置项!")
        print("请确保以下环境变量已配置:")
        for config in missing_configs:
            print(f"  - {config}")
        print()
        print("请参考 .env.example 文件创建 .env 文件")
        print("=" * 60)

check_config()

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
