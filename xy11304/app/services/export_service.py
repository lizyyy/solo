import pandas as pd
from sqlalchemy.orm import Session
from datetime import date, datetime
import os
from app.core.config import settings
from app.models.models import MealDistribution, Elder, Menu, DeliveryRoute
from app.schemas.schemas import mask_id_card, mask_phone


def mask_sensitive_data(data: dict) -> dict:
    if not settings.MASK_SENSITIVE_FIELDS:
        return data
    
    result = data.copy()
    for field in settings.SENSITIVE_FIELDS:
        if field in result and result[field]:
            if field == "id_card":
                result[field] = mask_id_card(str(result[field]))
            elif field == "phone":
                result[field] = mask_phone(str(result[field]))
            elif field == "address":
                addr = str(result[field])
                if len(addr) > 6:
                    result[field] = addr[:3] + "****" + addr[-3:]
    return result


def export_daily_meal_list(db: Session, report_date: date, route_id: int = None,
                           file_format: str = "xlsx") -> str:
    query = db.query(
        MealDistribution,
        Elder,
        Menu,
        DeliveryRoute
    ).join(Elder, MealDistribution.elder_id == Elder.id
    ).join(Menu, MealDistribution.menu_id == Menu.id
    ).outerjoin(DeliveryRoute, Elder.route_id == DeliveryRoute.id
    ).filter(Menu.date == report_date)
    
    if route_id is not None:
        query = query.filter(Elder.route_id == route_id)
    
    results = query.order_by(DeliveryRoute.sequence, Elder.name).all()
    
    data = []
    for meal, elder, menu, route in results:
        row = {
            "配送路线": route.name if route else "未分配",
            "房间号": elder.room_number or "",
            "姓名": elder.name,
            "身份证号": elder.id_card or "",
            "联系电话": elder.phone or "",
            "住址": elder.address or "",
            "用餐类型": _meal_type_label(menu.meal_type),
            "主菜": menu.main_dish or "",
            "副菜1": menu.side_dish1 or "",
            "副菜2": menu.side_dish2 or "",
            "汤品": menu.soup or "",
            "主食": menu.staple or "",
            "特殊要求": meal.special_requirements or "",
            "忌口": elder.dietary_restrictions or "",
            "慢性病": elder.chronic_diseases or "",
            "过敏史": elder.allergies or "",
            "配餐状态": _meal_status_label(meal.status),
            "复核人": meal.reviewed_by or "",
            "复核时间": meal.reviewed_at.strftime("%Y-%m-%d %H:%M") if meal.reviewed_at else "",
            "配送人": meal.delivered_by or "",
            "配送时间": meal.delivered_at.strftime("%Y-%m-%d %H:%M") if meal.delivered_at else "",
            "备注": meal.review_notes or ""
        }
        data.append(mask_sensitive_data(row))
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"配餐清单_{report_date.strftime('%Y%m%d')}_{timestamp}.{file_format}"
    filepath = os.path.join(settings.EXPORT_DIR, filename)
    
    if file_format == "xlsx":
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='配餐清单')
            
            worksheet = writer.sheets['配餐清单']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).apply(len).max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)
    else:
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
    
    return filepath


def export_dietary_report(db: Session, report_date: date = None,
                           file_format: str = "xlsx") -> str:
    query = db.query(Elder).filter(Elder.dietary_restrictions.isnot(None)).filter(
        Elder.dietary_restrictions != ''
    ).order_by(Elder.name)
    
    elders = query.all()
    
    data = []
    for elder in elders:
        row = {
            "姓名": elder.name,
            "身份证号": elder.id_card or "",
            "联系电话": elder.phone or "",
            "房间号": elder.room_number or "",
            "忌口": elder.dietary_restrictions or "",
            "慢性病": elder.chronic_diseases or "",
            "过敏史": elder.allergies or "",
            "备注": elder.notes or "",
            "状态": "活跃" if elder.status.value == "active" else "非活跃"
        }
        data.append(mask_sensitive_data(row))
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"特殊饮食报告_{timestamp}.{file_format}"
    filepath = os.path.join(settings.EXPORT_DIR, filename)
    
    if file_format == "xlsx":
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='特殊饮食报告')
            
            worksheet = writer.sheets['特殊饮食报告']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).apply(len).max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)
    else:
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
    
    return filepath


def export_delivery_route_list(db: Session, file_format: str = "xlsx") -> str:
    query = db.query(Elder, DeliveryRoute
    ).outerjoin(DeliveryRoute, Elder.route_id == DeliveryRoute.id
    ).order_by(DeliveryRoute.sequence, Elder.name)
    
    results = query.all()
    
    data = []
    for elder, route in results:
        row = {
            "配送路线": route.name if route else "未分配",
            "路线顺序": route.sequence if route else 999,
            "姓名": elder.name,
            "身份证号": elder.id_card or "",
            "联系电话": elder.phone or "",
            "房间号": elder.room_number or "",
            "住址": elder.address or "",
            "忌口": elder.dietary_restrictions or "",
            "慢性病": elder.chronic_diseases or "",
            "状态": "活跃" if elder.status.value == "active" else "非活跃"
        }
        data.append(mask_sensitive_data(row))
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"配送路线清单_{timestamp}.{file_format}"
    filepath = os.path.join(settings.EXPORT_DIR, filename)
    
    if file_format == "xlsx":
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='配送路线清单')
            
            worksheet = writer.sheets['配送路线清单']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).apply(len).max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)
    else:
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
    
    return filepath


def _meal_type_label(meal_type: str) -> str:
    labels = {
        "breakfast": "早餐",
        "lunch": "午餐",
        "dinner": "晚餐"
    }
    return labels.get(meal_type, meal_type)


def _meal_status_label(status) -> str:
    labels = {
        "pending": "待复核",
        "confirmed": "已确认",
        "delivered": "已配送",
        "cancelled": "已取消"
    }
    return labels.get(status.value, str(status))
