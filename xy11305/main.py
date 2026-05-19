from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import uuid
import csv
import io
import re
from enum import Enum
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="社区食堂配餐管理系统")

class ChronicDisease(str, Enum):
    DIABETES = "糖尿病"
    HYPERTENSION = "高血压"
    HEART_DISEASE = "心脏病"
    KIDNEY_DISEASE = "肾病"
    NONE = "无"

class Allergen(str, Enum):
    SEAFOOD = "海鲜"
    NUTS = "坚果"
    GLUTEN = "麸质"
    DAIRY = "乳制品"
    EGGS = "鸡蛋"
    SOY = "大豆"

class MealType(str, Enum):
    BREAKFAST = "早餐"
    LUNCH = "午餐"
    DINNER = "晚餐"

class DeliveryStatus(str, Enum):
    PENDING = "待配送"
    DELIVERING = "配送中"
    DELIVERED = "已送达"
    FAILED = "配送失败"

class RecordStatus(str, Enum):
    VALID = "正常"
    INVALID = "异常"

class ElderlyProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    id_card: str
    address: str
    dietary_restrictions: List[str] = Field(default_factory=list)
    chronic_diseases: List[ChronicDisease] = Field(default_factory=list)
    allergens: List[Allergen] = Field(default_factory=list)
    delivery_route: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    status: RecordStatus = RecordStatus.VALID
    error_reason: Optional[str] = None

    @validator('phone')
    def validate_phone(cls, v):
        if not re.match(r'^1[3-9]\d{9}$', v):
            raise ValueError('手机号格式错误')
        return v

    @validator('id_card')
    def validate_id_card(cls, v):
        if not re.match(r'^\d{17}[\dXx]$', v):
            raise ValueError('身份证号格式错误')
        return v

class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    meal_type: MealType
    date: date
    ingredients: List[str]
    is_sugar_free: bool = False
    allergens: List[Allergen] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)

class MealOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    elderly_id: str
    menu_item_id: str
    meal_type: MealType
    date: date
    status: str = "待配餐"
    conflict_reason: Optional[str] = None
    is_valid: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class MealChange(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    old_menu_item_id: str
    new_menu_item_id: str
    change_reason: str
    changed_at: datetime = Field(default_factory=datetime.now)

class DeliveryRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    elderly_id: str
    delivery_route: str
    status: DeliveryStatus = DeliveryStatus.PENDING
    delivered_at: Optional[datetime] = None
    delivery_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class FollowUpRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    elderly_id: str
    satisfaction: int = Field(ge=1, le=5)
    feedback: Optional[str] = None
    follow_up_date: datetime = Field(default_factory=datetime.now)

db = {
    "elderly_profiles": [],
    "menu_items": [],
    "meal_orders": [],
    "meal_changes": [],
    "delivery_records": [],
    "follow_up_records": [],
    "request_ids": set()
}

def mask_phone(phone: str) -> str:
    if len(phone) >= 11:
        return phone[:3] + "****" + phone[7:]
    return phone

def mask_id_card(id_card: str) -> str:
    if len(id_card) >= 18:
        return id_card[:6] + "********" + id_card[14:]
    return id_card

def mask_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    masked = data.copy()
    if "phone" in masked:
        masked["phone"] = mask_phone(masked["phone"])
    if "id_card" in masked:
        masked["id_card"] = mask_id_card(masked["id_card"])
    return masked

def check_dietary_conflicts(elderly: ElderlyProfile, menu_item: MenuItem) -> tuple[bool, Optional[str]]:
    if ChronicDisease.DIABETES in elderly.chronic_diseases and not menu_item.is_sugar_free:
        return False, f"糖尿病患者禁忌：{menu_item.name} 不是无糖食品"
    
    for allergen in elderly.allergens:
        if allergen in menu_item.allergens:
            return False, f"过敏源冲突：{allergen.value}"
    
    for restriction in elderly.dietary_restrictions:
        if restriction in menu_item.ingredients:
            return False, f"忌口冲突：{restriction} 在 {menu_item.name} 中"
    
    return True, None

def is_idempotent(request_id: str) -> bool:
    if request_id in db["request_ids"]:
        return True
    db["request_ids"].add(request_id)
    return False

@app.get("/")
async def root():
    return {"message": "社区食堂配餐管理系统 API"}

@app.post("/api/elderly/import-csv", response_model=Dict[str, Any])
async def import_elderly_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    content = await file.read()
    csv_reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    
    valid_records = []
    invalid_records = []
    
    for row in csv_reader:
        try:
            chronic_diseases = [c.strip() for c in row.get('慢病', '').split(',') if c.strip()]
            allergens = [a.strip() for a in row.get('过敏源', '').split(',') if a.strip()]
            dietary_restrictions = [d.strip() for d in row.get('忌口', '').split(',') if d.strip()]
            
            profile = ElderlyProfile(
                name=row['姓名'],
                phone=row['电话'],
                id_card=row['身份证'],
                address=row['地址'],
                dietary_restrictions=dietary_restrictions,
                chronic_diseases=[ChronicDisease(cd) for cd in chronic_diseases if cd in [e.value for e in ChronicDisease]],
                allergens=[Allergen(a) for a in allergens if a in [e.value for e in Allergen]],
                delivery_route=row['配送路线']
            )
            valid_records.append(profile)
            db["elderly_profiles"].append(profile)
            logger.info(f"导入老人档案成功: {mask_sensitive_data(profile.dict())}")
        except Exception as e:
            invalid_profile = {
                "row_data": row,
                "error_reason": str(e)
            }
            invalid_records.append(invalid_profile)
            logger.warning(f"导入老人档案失败: {mask_sensitive_data(row)} - {str(e)}")
    
    return {
        "total": len(valid_records) + len(invalid_records),
        "valid_count": len(valid_records),
        "invalid_count": len(invalid_records),
        "valid_records": [mask_sensitive_data(p.dict()) for p in valid_records],
        "invalid_records": [mask_sensitive_data(r) for r in invalid_records]
    }

@app.get("/api/elderly", response_model=List[Dict[str, Any]])
async def get_elderly_list(status: Optional[RecordStatus] = None):
    profiles = db["elderly_profiles"]
    if status:
        profiles = [p for p in profiles if p.status == status]
    return [mask_sensitive_data(p.dict()) for p in profiles]

@app.post("/api/menu", response_model=MenuItem)
async def create_menu_item(menu_item: MenuItem):
    db["menu_items"].append(menu_item)
    logger.info(f"创建菜单: {menu_item.dict()}")
    return menu_item

@app.get("/api/menu", response_model=List[MenuItem])
async def get_menu(meal_date: Optional[date] = None, meal_type: Optional[MealType] = None):
    items = db["menu_items"]
    if meal_date:
        items = [i for i in items if i.date == meal_date]
    if meal_type:
        items = [i for i in items if i.meal_type == meal_type]
    return items

@app.post("/api/meal-order", response_model=Dict[str, Any])
async def create_meal_order(request_id: str, elderly_id: str, menu_item_id: str):
    if is_idempotent(request_id):
        existing_order = next((o for o in db["meal_orders"] if o.request_id == request_id), None)
        if existing_order:
            return {
                "order": existing_order.dict(),
                "is_idempotent": True,
                "message": "重复请求，返回已存在的订单"
            }
    
    elderly = next((e for e in db["elderly_profiles"] if e.id == elderly_id), None)
    if not elderly:
        raise HTTPException(status_code=404, detail="老人档案不存在")
    
    menu_item = next((m for m in db["menu_items"] if m.id == menu_item_id), None)
    if not menu_item:
        raise HTTPException(status_code=404, detail="菜单不存在")
    
    is_valid, conflict_reason = check_dietary_conflicts(elderly, menu_item)
    
    order = MealOrder(
        request_id=request_id,
        elderly_id=elderly_id,
        menu_item_id=menu_item_id,
        meal_type=menu_item.meal_type,
        date=menu_item.date,
        is_valid=is_valid,
        conflict_reason=conflict_reason,
        status="待配餐" if is_valid else "已拦截"
    )
    db["meal_orders"].append(order)
    
    logger.info(f"创建配餐订单: request_id={request_id}, valid={is_valid}, reason={conflict_reason}")
    
    return {
        "order": order.dict(),
        "is_idempotent": False,
        "conflict_check": {
            "passed": is_valid,
            "reason": conflict_reason or "无冲突，配餐通过"
        }
    }

@app.post("/api/meal-order/change", response_model=Dict[str, Any])
async def change_meal_order(request_id: str, order_id: str, new_menu_item_id: str, change_reason: str):
    if is_idempotent(request_id):
        existing_change = next((c for c in db["meal_changes"] if c.id == request_id), None)
        if existing_change:
            return {
                "change": existing_change.dict(),
                "is_idempotent": True,
                "message": "重复请求，返回已存在的改餐记录"
            }
    
    order = next((o for o in db["meal_orders"] if o.id == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    elderly = next((e for e in db["elderly_profiles"] if e.id == order.elderly_id), None)
    new_menu_item = next((m for m in db["menu_items"] if m.id == new_menu_item_id), None)
    
    if not new_menu_item:
        raise HTTPException(status_code=404, detail="新菜单不存在")
    
    is_valid, conflict_reason = check_dietary_conflicts(elderly, new_menu_item)
    
    old_menu_item_id = order.menu_item_id
    order.menu_item_id = new_menu_item_id
    order.updated_at = datetime.now()
    if not is_valid:
        order.status = "改餐拦截"
        order.conflict_reason = conflict_reason
    else:
        order.status = "已改餐"
    
    change = MealChange(
        order_id=order_id,
        old_menu_item_id=old_menu_item_id,
        new_menu_item_id=new_menu_item_id,
        change_reason=change_reason
    )
    db["meal_changes"].append(change)
    
    logger.info(f"改餐记录: order_id={order_id}, change_reason={change_reason}, valid={is_valid}")
    
    return {
        "change": change.dict(),
        "order": order.dict(),
        "is_idempotent": False,
        "conflict_check": {
            "passed": is_valid,
            "reason": conflict_reason or "改餐无冲突"
        }
    }

@app.get("/api/meal-order/{order_id}/changes", response_model=List[MealChange])
async def get_order_changes(order_id: str):
    return [c for c in db["meal_changes"] if c.order_id == order_id]

@app.post("/api/delivery", response_model=Dict[str, Any])
async def create_delivery(request_id: str, order_id: str):
    if is_idempotent(request_id):
        existing_delivery = next((d for d in db["delivery_records"] if d.id == request_id), None)
        if existing_delivery:
            return {
                "delivery": existing_delivery.dict(),
                "is_idempotent": True,
                "message": "重复请求，返回已存在的配送记录"
            }
    
    order = next((o for o in db["meal_orders"] if o.id == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    elderly = next((e for e in db["elderly_profiles"] if e.id == order.elderly_id), None)
    
    delivery = DeliveryRecord(
        order_id=order_id,
        elderly_id=order.elderly_id,
        delivery_route=elderly.delivery_route
    )
    db["delivery_records"].append(delivery)
    
    order.status = "配送中"
    logger.info(f"创建配送记录: order_id={order_id}, route={elderly.delivery_route}")
    
    return {
        "delivery": delivery.dict(),
        "is_idempotent": False
    }

@app.put("/api/delivery/{delivery_id}/status", response_model=DeliveryRecord)
async def update_delivery_status(delivery_id: str, status: DeliveryStatus, notes: Optional[str] = None):
    delivery = next((d for d in db["delivery_records"] if d.id == delivery_id), None)
    if not delivery:
        raise HTTPException(status_code=404, detail="配送记录不存在")
    
    delivery.status = status
    if status == DeliveryStatus.DELIVERED:
        delivery.delivered_at = datetime.now()
    if notes:
        delivery.delivery_notes = notes
    
    order = next((o for o in db["meal_orders"] if o.id == delivery.order_id), None)
    if order:
        if status == DeliveryStatus.DELIVERED:
            order.status = "已送达"
        elif status == DeliveryStatus.FAILED:
            order.status = "配送失败"
    
    logger.info(f"更新配送状态: delivery_id={delivery_id}, status={status}")
    return delivery

@app.get("/api/delivery", response_model=List[DeliveryRecord])
async def get_deliveries(route: Optional[str] = None):
    deliveries = db["delivery_records"]
    if route:
        deliveries = [d for d in deliveries if d.delivery_route == route]
    return deliveries

@app.post("/api/follow-up", response_model=Dict[str, Any])
async def create_follow_up(request_id: str, order_id: str, satisfaction: int, feedback: Optional[str] = None):
    if is_idempotent(request_id):
        existing_fu = next((f for f in db["follow_up_records"] if f.id == request_id), None)
        if existing_fu:
            return {
                "follow_up": existing_fu.dict(),
                "is_idempotent": True,
                "message": "重复请求，返回已存在的回访记录"
            }
    
    order = next((o for o in db["meal_orders"] if o.id == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    follow_up = FollowUpRecord(
        order_id=order_id,
        elderly_id=order.elderly_id,
        satisfaction=satisfaction,
        feedback=feedback
    )
    db["follow_up_records"].append(follow_up)
    
    logger.info(f"创建回访记录: order_id={order_id}, satisfaction={satisfaction}")
    
    return {
        "follow_up": follow_up.dict(),
        "is_idempotent": False
    }

@app.get("/api/follow-up", response_model=List[FollowUpRecord])
async def get_follow_ups(elderly_id: Optional[str] = None):
    records = db["follow_up_records"]
    if elderly_id:
        records = [r for r in records if r.elderly_id == elderly_id]
    return records

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
