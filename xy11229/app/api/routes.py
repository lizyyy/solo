from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from datetime import datetime
from typing import List

from app.schemas.request_schemas import (
    ReceiveOrderRequest, AttributeOrderRequest,
    DispatchRequest, ReviewRequest, ExportRequest
)
from app.models.models import (
    DeviceEvent, ServiceOrder, BadRecord, WorkOrderStats, ImportResult
)
from app.services.import_service import (
    import_device_events_from_json, import_service_orders_from_csv
)
from app.services.workflow_service import (
    receive_order, attribute_order, dispatch_repair,
    review_order, export_orders, get_order_details
)
from app.models.storage import storage
from app.utils.sensitive import mask_sensitive_data

router = APIRouter()


@router.post("/import/device-events", response_model=ImportResult)
async def import_device_events(file: UploadFile = File(...)):
    content = await file.read()
    result = import_device_events_from_json(content.decode('utf-8'))
    return result


@router.post("/import/service-orders", response_model=ImportResult)
async def import_service_orders(file: UploadFile = File(...)):
    content = await file.read()
    result = import_service_orders_from_csv(content.decode('utf-8'))
    return result


@router.post("/workflow/receive")
async def receive_order_endpoint(request: ReceiveOrderRequest):
    order, is_new = receive_order(
        order_id=request.order_id,
        station_id=request.station_id,
        problem_description=request.problem_description,
        report_time=request.report_time,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        device_id=request.device_id,
        source=request.source,
        idempotency_key=request.idempotency_key
    )
    
    order_dict = order.model_dump()
    order_dict = mask_sensitive_data(order_dict)
    
    return {
        "order": order_dict,
        "is_new": is_new,
        "message": "订单已接收" if is_new else "订单已存在（幂等）"
    }


@router.post("/workflow/attribute")
async def attribute_order_endpoint(request: AttributeOrderRequest):
    order, is_updated = attribute_order(
        order_id=request.order_id,
        attributed_type=request.attributed_type,
        attributed_reason=request.attributed_reason,
        idempotency_key=request.idempotency_key
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    order_dict = order.model_dump()
    order_dict = mask_sensitive_data(order_dict)
    
    return {
        "order": order_dict,
        "is_updated": is_updated,
        "message": "归因完成" if is_updated else "归因已存在（幂等）"
    }


@router.post("/workflow/dispatch")
async def dispatch_endpoint(request: DispatchRequest):
    dispatch, is_new = dispatch_repair(
        order_id=request.order_id,
        technician_id=request.technician_id,
        technician_name=request.technician_name,
        technician_phone=request.technician_phone,
        estimated_arrival_time=request.estimated_arrival_time,
        notes=request.notes,
        idempotency_key=request.idempotency_key
    )
    
    if not dispatch:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    dispatch_dict = dispatch.model_dump()
    dispatch_dict = mask_sensitive_data(dispatch_dict)
    
    return {
        "dispatch": dispatch_dict,
        "is_new": is_new,
        "message": "派修完成" if is_new else "派修已存在（幂等）"
    }


@router.post("/workflow/review")
async def review_endpoint(request: ReviewRequest):
    review, is_new = review_order(
        order_id=request.order_id,
        reviewer_id=request.reviewer_id,
        reviewer_name=request.reviewer_name,
        review_result=request.review_result,
        review_notes=request.review_notes,
        is_verified=request.is_verified,
        idempotency_key=request.idempotency_key
    )
    
    if not review:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    review_dict = review.model_dump()
    review_dict = mask_sensitive_data(review_dict)
    
    return {
        "review": review_dict,
        "is_new": is_new,
        "message": "复核完成" if is_new else "复核已存在（幂等）"
    }


@router.post("/workflow/export")
async def export_endpoint(request: ExportRequest):
    content = export_orders(
        format=request.format,
        status=request.status,
        start_date=request.start_date,
        end_date=request.end_date
    )
    
    media_type = "application/json" if request.format.lower() == "json" else "text/csv"
    filename = f"orders_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{request.format}"
    
    return PlainTextResponse(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/orders", response_model=List[dict])
async def get_all_orders():
    orders = storage.get_all_service_orders()
    result = []
    for order in orders:
        order_dict = order.model_dump()
        order_dict = mask_sensitive_data(order_dict)
        result.append(order_dict)
    return result


@router.get("/orders/{order_id}")
async def get_order(order_id: str):
    details = get_order_details(order_id)
    if not details:
        raise HTTPException(status_code=404, detail="订单不存在")
    return details


@router.get("/device-events", response_model=List[dict])
async def get_all_device_events():
    events = storage.get_all_device_events()
    return [e.model_dump() for e in events]


@router.get("/bad-records", response_model=List[dict])
async def get_bad_records():
    records = storage.get_all_bad_records()
    result = []
    for record in records:
        record_dict = record.model_dump()
        record_dict['raw_data'] = mask_sensitive_data(record_dict['raw_data'])
        result.append(record_dict)
    return result


@router.get("/stats", response_model=WorkOrderStats)
async def get_statistics():
    return storage.get_stats()


@router.delete("/clear-all")
async def clear_all_data():
    storage.clear_all()
    return {"message": "所有数据已清除"}
