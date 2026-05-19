import io
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, Device, User
from app.schemas import ExportRequest
from app.utils import mask_sensitive_data
from app.auth import get_current_active_user, require_roles
from app.models import UserRole

router = APIRouter(prefix="/export", tags=["导出"])


@router.post("/orders", summary="导出工单数据")
async def export_orders(
    export_params: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR))
):
    query = db.query(
        Order.id,
        Order.order_no,
        Device.device_code,
        Device.device_name,
        Device.location,
        Order.status,
        Order.issue_type,
        Order.issue_description,
        Order.cabin_number,
        Order.customer_name,
        Order.customer_phone,
        User.full_name.label("creator_name"),
        Order.created_at,
        Order.received_at,
        Order.attributed_at,
        Order.dispatched_at,
        Order.reviewed_at,
        Order.closed_at
    ).join(Device, Order.device_id == Device.id) \
     .outerjoin(User, Order.created_by == User.id)
    
    if export_params.start_date:
        query = query.filter(Order.created_at >= export_params.start_date)
    if export_params.end_date:
        query = query.filter(Order.created_at <= export_params.end_date)
    if export_params.status:
        query = query.filter(Order.status.in_(export_params.status))
    if export_params.issue_type:
        query = query.filter(Order.issue_type.in_(export_params.issue_type))
    
    orders = query.all()
    
    data = []
    for order in orders:
        row = {
            "工单ID": order.id,
            "工单编号": order.order_no,
            "设备编号": order.device_code,
            "设备名称": order.device_name,
            "设备位置": order.location,
            "状态": order.status.value if order.status else "",
            "问题类型": order.issue_type.value if order.issue_type else "",
            "问题描述": order.issue_description or "",
            "仓门编号": order.cabin_number or "",
            "客户姓名": order.customer_name or "",
            "客户电话": mask_sensitive_data(order.customer_phone or ""),
            "创建人": order.creator_name or "",
            "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S") if order.created_at else "",
            "接单时间": order.received_at.strftime("%Y-%m-%d %H:%M:%S") if order.received_at else "",
            "归因时间": order.attributed_at.strftime("%Y-%m-%d %H:%M:%S") if order.attributed_at else "",
            "派修时间": order.dispatched_at.strftime("%Y-%m-%d %H:%M:%S") if order.dispatched_at else "",
            "复核时间": order.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if order.reviewed_at else "",
            "关闭时间": order.closed_at.strftime("%Y-%m-%d %H:%M:%S") if order.closed_at else ""
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='工单数据')
    
    output.seek(0)
    
    filename = f"工单导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/events/abnormal", summary="导出异常事件")
async def export_abnormal_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR))
):
    from app.models import DeviceEvent, EventStatus
    
    query = db.query(
        DeviceEvent.id,
        DeviceEvent.event_id,
        Device.device_code,
        Device.device_name,
        DeviceEvent.event_type,
        DeviceEvent.event_time,
        DeviceEvent.cabin_number,
        DeviceEvent.battery_code,
        DeviceEvent.user_phone,
        DeviceEvent.error_code,
        DeviceEvent.error_message
    ).join(Device, DeviceEvent.device_id == Device.id) \
     .filter(DeviceEvent.status == EventStatus.ABNORMAL)
    
    events = query.all()
    
    data = []
    for event in events:
        row = {
            "事件ID": event.event_id,
            "设备编号": event.device_code,
            "设备名称": event.device_name,
            "事件类型": event.event_type.value if event.event_type else "",
            "事件时间": event.event_time.strftime("%Y-%m-%d %H:%M:%S") if event.event_time else "",
            "仓门编号": event.cabin_number or "",
            "电池编号": event.battery_code or "",
            "用户电话": mask_sensitive_data(event.user_phone or ""),
            "错误码": event.error_code or "",
            "错误信息": event.error_message or ""
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='异常事件')
    
    output.seek(0)
    
    filename = f"异常事件导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )