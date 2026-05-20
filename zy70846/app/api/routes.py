from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import date
import json

from app.schemas.common import ReviewAction, ApiResponse
from app.schemas.inventory import InventoryRecord
from app.schemas.sales import SalesRecord
from app.schemas.replenishment import ReplenishmentRecord
from app.schemas.reconciliation import ReconciliationRecord
from app.services.import_service import import_service
from app.services.reconciliation_service import reconciliation_service
from app.services.report_service import report_service
from app.storage.memory import storage

router = APIRouter(prefix="/api", tags=["对账系统"])


@router.post("/inventory/import", response_model=ApiResponse)
async def import_inventory(
    file: UploadFile = File(...),
    store_id: str = Query(..., description="门店ID"),
    store_name: str = Query(..., description="门店名称"),
    operator: str = Query(..., description="操作人")
):
    try:
        content = await file.read()
        record = import_service.import_inventory_csv(content, store_id, store_name, operator)
        return ApiResponse(message="盘点数据导入成功", data=record)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.get("/inventory", response_model=ApiResponse)
async def list_inventory(store_id: Optional[str] = None):
    records = storage.list_inventory(store_id)
    return ApiResponse(data=records, total=len(records))


@router.post("/sales/import", response_model=ApiResponse)
async def import_sales(
    file: UploadFile = File(...),
    store_id: str = Query(..., description="门店ID"),
    store_name: str = Query(..., description="门店名称"),
    operator: str = Query(..., description="操作人")
):
    try:
        content = await file.read()
        record = import_service.import_sales_json(content, store_id, store_name, operator)
        return ApiResponse(message="销售数据导入成功", data=record)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.get("/sales", response_model=ApiResponse)
async def list_sales(store_id: Optional[str] = None):
    records = storage.list_sales(store_id)
    return ApiResponse(data=records, total=len(records))


@router.post("/replenishment/import", response_model=ApiResponse)
async def import_replenishment(
    file: UploadFile = File(...),
    store_id: str = Query(..., description="门店ID"),
    store_name: str = Query(..., description="门店名称"),
    operator: str = Query(..., description="操作人"),
    supplier: str = Query("", description="供应商")
):
    try:
        content = await file.read()
        record = import_service.import_replenishment_csv(content, store_id, store_name, operator, supplier)
        return ApiResponse(message="补货数据导入成功", data=record)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.get("/replenishment", response_model=ApiResponse)
async def list_replenishment(store_id: Optional[str] = None):
    records = storage.list_replenishment(store_id)
    return ApiResponse(data=records, total=len(records))


@router.post("/reconciliation/create", response_model=ApiResponse)
async def create_reconciliation(
    inventory_id: str = Query(..., description="盘点记录ID"),
    sales_id: str = Query(..., description="销售记录ID"),
    replenishment_id: str = Query(..., description="补货记录ID"),
    operator: str = Query(..., description="操作人"),
    store_id: str = Query(..., description="门店ID"),
    store_name: str = Query(..., description="门店名称")
):
    try:
        record = reconciliation_service.create_reconciliation(
            inventory_id, sales_id, replenishment_id, operator, store_id, store_name
        )
        return ApiResponse(message="对账创建成功", data=record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reconciliation/{reconciliation_id}", response_model=ApiResponse)
async def get_reconciliation(reconciliation_id: str):
    record = storage.get_reconciliation(reconciliation_id)
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return ApiResponse(data=record)


@router.get("/reconciliation", response_model=ApiResponse)
async def list_reconciliation(store_id: Optional[str] = None):
    records = reconciliation_service.get_reconciliation_history(store_id)
    return ApiResponse(data=records, total=len(records))


@router.post("/reconciliation/{reconciliation_id}/review", response_model=ApiResponse)
async def review_discrepancy(
    reconciliation_id: str,
    discrepancy_id: str = Query(..., description="差异记录ID"),
    action: ReviewAction = Query(..., description="处理动作"),
    reviewer: str = Query(..., description="复核人"),
    remark: str = Query("", description="处理意见"),
    revised_qty: Optional[int] = Query(None, description="修订数量")
):
    try:
        record = reconciliation_service.review_discrepancy(
            reconciliation_id, discrepancy_id, action, reviewer, remark, revised_qty
        )
        return ApiResponse(message="差异复核成功", data=record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reconciliation/{reconciliation_id}/complete", response_model=ApiResponse)
async def complete_reconciliation(reconciliation_id: str, operator: str = Query(..., description="操作人")):
    try:
        record = reconciliation_service.complete_reconciliation(reconciliation_id, operator)
        return ApiResponse(message="对账完成", data=record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reconciliation/{reconciliation_id}/audit-log", response_model=ApiResponse)
async def get_audit_log(reconciliation_id: str):
    logs = reconciliation_service.get_audit_history(reconciliation_id)
    return ApiResponse(data=logs, total=len(logs))


@router.get("/reconciliation/{reconciliation_id}/report/excel")
async def download_excel_report(reconciliation_id: str):
    try:
        report_data = report_service.generate_excel_report(reconciliation_id)
        record = storage.get_reconciliation(reconciliation_id)
        filename = f"对账报告_{record.store_name}_{date.today().isoformat()}.xlsx"
        return StreamingResponse(
            report_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reconciliation/{reconciliation_id}/report/csv")
async def download_csv_report(reconciliation_id: str):
    try:
        report_data = report_service.generate_csv_report(reconciliation_id)
        record = storage.get_reconciliation(reconciliation_id)
        filename = f"对账报告_{record.store_name}_{date.today().isoformat()}.csv"
        return StreamingResponse(
            report_data,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sample-data", response_model=ApiResponse)
async def create_sample_data():
    from datetime import timedelta
    
    inv_content = """sku,sku_name,quantity,unit_price,expiry_date,category
SKU001,可口可乐,120,3.5,2025-03-15,饮料
SKU002,百事可乐,80,3.5,,饮料
SKU003,农夫山泉,150,2.0,2025-02-28,饮料
SKU004,乐事薯片,45,8.0,2025-01-20,零食
SKU005,康师傅方便面,60,4.5,2025-03-10,食品
SKU006,统一冰红茶,90,3.0,,饮料
SKU007,旺仔牛奶,55,5.0,2025-02-15,饮料
SKU008,奥利奥饼干,30,12.0,,零食
"""
    inv_record = import_service.import_inventory_csv(
        inv_content.encode('utf-8'), 'STORE001', '朝阳门店', '张三'
    )
    
    sales_data = {
        "sales": [
            {"sku": "SKU001", "sku_name": "可口可乐", "quantity": 80, "unit_price": 3.5, "total_amount": 280},
            {"sku": "SKU002", "sku_name": "百事可乐", "quantity": 40, "unit_price": 3.5, "total_amount": 140},
            {"sku": "SKU003", "sku_name": "矿泉水", "quantity": 100, "unit_price": 2.0, "total_amount": 200},
            {"sku": "SKU004", "sku_name": "乐事薯片", "quantity": 25, "unit_price": 8.0, "total_amount": 200},
            {"sku": "SKU005", "sku_name": "泡面", "quantity": 50, "unit_price": 4.5, "total_amount": 225},
            {"sku": "SKU006", "sku_name": "统一冰红茶", "quantity": 60, "unit_price": 3.0, "total_amount": 180},
            {"sku": "SKU007", "sku_name": "旺仔牛奶", "quantity": 45, "unit_price": 5.0, "total_amount": 225},
            {"sku": "SKU008", "sku_name": "奥利奥饼干", "quantity": 20, "unit_price": 12.0, "total_amount": 240},
        ]
    }
    sales_record = import_service.import_sales_json(
        json.dumps(sales_data).encode('utf-8'), 'STORE001', '朝阳门店', '李四'
    )
    
    rep_content = """sku,sku_name,requested_quantity,actual_quantity,unit_price,category
SKU001,可口可乐,100,102,3.0,饮料
SKU002,百事可乐,70,70,3.0,饮料
SKU003,农夫山泉,120,118,1.5,饮料
SKU004,乐事薯片,40,40,6.0,零食
SKU005,康师傅方便面,55,55,3.5,食品
SKU006,统一冰红茶,80,82,2.5,饮料
SKU007,旺仔牛奶,50,50,4.0,饮料
SKU008,奥利奥饼干,35,35,9.0,零食
"""
    rep_record = import_service.import_replenishment_csv(
        rep_content.encode('utf-8'), 'STORE001', '朝阳门店', '王五', '统一配送中心'
    )
    
    reconciliation = reconciliation_service.create_reconciliation(
        inv_record.id, sales_record.id, rep_record.id, '管理员', 'STORE001', '朝阳门店'
    )
    
    return ApiResponse(
        message="示例数据创建成功",
        data={
            "inventory_id": inv_record.id,
            "sales_id": sales_record.id,
            "replenishment_id": rep_record.id,
            "reconciliation_id": reconciliation.id
        }
    )
