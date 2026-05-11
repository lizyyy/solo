from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
import json

app = FastAPI(title="跨仓拣货优先级 API", version="1.0.0")


class OrderPriority(str, Enum):
    NORMAL = "normal"
    URGENT = "urgent"


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PICKED = "picked"
    CANCELLED = "cancelled"
    PARTIAL_CANCELLED = "partial_cancelled"


class WaveStatus(str, Enum):
    PENDING = "pending"
    PICKING = "picking"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ItemRequest(BaseModel):
    sku: str
    quantity: int
    name: Optional[str] = None


class OrderCreateRequest(BaseModel):
    order_no: str
    items: List[ItemRequest]
    priority: OrderPriority = OrderPriority.NORMAL
    delivery_deadline: Optional[datetime] = None
    customer_info: Optional[Dict[str, Any]] = None


class InventoryRequest(BaseModel):
    warehouse_code: str
    warehouse_name: str
    sku: str
    sku_name: str
    quantity: int


class OrderItem(BaseModel):
    sku: str
    quantity: int
    name: Optional[str] = None


class WarehouseInventory(BaseModel):
    warehouse_code: str
    warehouse_name: str
    sku: str
    sku_name: str
    available_qty: int = 0
    locked_qty: int = 0


class InventoryLock(BaseModel):
    lock_id: str
    warehouse_code: str
    sku: str
    order_no: str
    wave_id: str
    locked_qty: int
    locked_at: datetime
    status: str
    released_at: Optional[datetime] = None
    release_reason: Optional[str] = None


class WaveItem(BaseModel):
    wave_item_id: str
    order_no: str
    warehouse_code: str
    sku: str
    quantity: int
    picked_qty: int = 0


class Wave(BaseModel):
    wave_id: str
    wave_no: str
    warehouse_code: str
    items: List[WaveItem] = []
    status: WaveStatus = WaveStatus.PENDING
    priority: OrderPriority = OrderPriority.NORMAL
    created_at: datetime
    generated_by: str


class Order(BaseModel):
    order_no: str
    items: List[OrderItem]
    priority: OrderPriority
    delivery_deadline: Optional[datetime] = None
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime
    wave_ids: List[str] = []
    customer_info: Optional[Dict[str, Any]] = None


class OrderDetail(Order):
    locks: List[InventoryLock] = []
    unavailable_reasons: List[str] = []


class WarehouseStats(BaseModel):
    warehouse_code: str
    warehouse_name: str
    pending_pick_qty: int
    locked_qty: int
    unavailable_reasons: List[str]


class WaveDetail(Wave):
    order_details: List[Dict[str, Any]] = []


DATA = {
    "inventories": {},
    "orders": {},
    "waves": {},
    "locks": {},
    "wave_counter": 0
}


def init_seed_data():
    warehouses = [
        {"code": "WH001", "name": "华东仓"},
        {"code": "WH002", "name": "华南仓"},
        {"code": "WH003", "name": "华北仓"}
    ]
    
    skus = [
        {"sku": "SKU001", "name": "商品A"},
        {"sku": "SKU002", "name": "商品B"},
        {"sku": "SKU003", "name": "商品C"},
        {"sku": "SKU004", "name": "商品D"}
    ]
    
    inventory_data = [
        ("WH001", "SKU001", 100),
        ("WH001", "SKU002", 50),
        ("WH001", "SKU003", 200),
        ("WH002", "SKU001", 80),
        ("WH002", "SKU002", 150),
        ("WH002", "SKU004", 120),
        ("WH003", "SKU001", 60),
        ("WH003", "SKU003", 90),
        ("WH003", "SKU004", 200)
    ]
    
    wh_map = {w["code"]: w["name"] for w in warehouses}
    sku_map = {s["sku"]: s["name"] for s in skus}
    
    for wh_code, sku, qty in inventory_data:
        key = f"{wh_code}:{sku}"
        DATA["inventories"][key] = WarehouseInventory(
            warehouse_code=wh_code,
            warehouse_name=wh_map[wh_code],
            sku=sku,
            sku_name=sku_map[sku],
            available_qty=qty
        )


def generate_wave_no():
    DATA["wave_counter"] += 1
    return f"W{datetime.now().strftime('%Y%m%d')}{str(DATA['wave_counter']).zfill(4)}"


def find_satisfying_warehouses(sku: str, required_qty: int) -> List[WarehouseInventory]:
    matching = []
    for key, inv in DATA["inventories"].items():
        if inv.sku == sku and inv.available_qty > 0:
            matching.append(inv)
    matching.sort(key=lambda x: x.available_qty, reverse=True)
    return matching


def allocate_inventory(sku: str, required_qty: int, order_no: str, wave_id: str) -> tuple:
    available_whs = find_satisfying_warehouses(sku, required_qty)
    
    if not available_whs:
        return [], [f"SKU {sku} 所有仓库均无可用库存"]
    
    total_available = sum(inv.available_qty for inv in available_whs)
    
    if total_available < required_qty:
        return [], [f"SKU {sku} 总库存不足，需要{required_qty}，可用{total_available}"]
    
    single_wh = next((inv for inv in available_whs if inv.available_qty >= required_qty), None)
    if single_wh:
        key = f"{single_wh.warehouse_code}:{sku}"
        inv = DATA["inventories"][key]
        inv.available_qty -= required_qty
        inv.locked_qty += required_qty
        
        lock = InventoryLock(
            lock_id=str(uuid.uuid4()),
            warehouse_code=inv.warehouse_code,
            sku=sku,
            order_no=order_no,
            wave_id=wave_id,
            locked_qty=required_qty,
            locked_at=datetime.now(),
            status="active"
        )
        DATA["locks"][lock.lock_id] = lock
        
        return [(inv.warehouse_code, required_qty, lock.lock_id)], []
    
    allocations = []
    remaining = required_qty
    lock_ids = []
    
    for inv in available_whs:
        if remaining <= 0:
            break
        take = min(inv.available_qty, remaining)
        key = f"{inv.warehouse_code}:{sku}"
        db_inv = DATA["inventories"][key]
        db_inv.available_qty -= take
        db_inv.locked_qty += take
        
        lock = InventoryLock(
            lock_id=str(uuid.uuid4()),
            warehouse_code=inv.warehouse_code,
            sku=sku,
            order_no=order_no,
            wave_id=wave_id,
            locked_qty=take,
            locked_at=datetime.now(),
            status="active"
        )
        DATA["locks"][lock.lock_id] = lock
        
        allocations.append((inv.warehouse_code, take, lock.lock_id))
        lock_ids.append(lock.lock_id)
        remaining -= take
    
    return allocations, []


def generate_waves_for_order(order: Order) -> tuple:
    if order.status in [OrderStatus.CANCELLED, OrderStatus.PARTIAL_CANCELLED]:
        return [], ["订单已取消，无法生成波次"]
    
    existing_waves = [w for w in DATA["waves"].values() 
                      if order.order_no in [wi.order_no for wi in w.items] 
                      and w.status != WaveStatus.CANCELLED]
    if existing_waves:
        return existing_waves, ["该订单已存在未完成波次"]
    
    wave_items_by_warehouse: Dict[str, List[WaveItem]] = {}
    unavailable_reasons = []
    all_locks = []
    
    for item in order.items:
        allocations, reasons = allocate_inventory(item.sku, item.quantity, order.order_no, "")
        unavailable_reasons.extend(reasons)
        
        for wh_code, qty, lock_id in allocations:
            wave_item = WaveItem(
                wave_item_id=str(uuid.uuid4()),
                order_no=order.order_no,
                warehouse_code=wh_code,
                sku=item.sku,
                quantity=qty
            )
            
            if lock_id in DATA["locks"]:
                DATA["locks"][lock_id].wave_id = "temp"
            
            if wh_code not in wave_items_by_warehouse:
                wave_items_by_warehouse[wh_code] = []
            wave_items_by_warehouse[wh_code].append(wave_item)
            all_locks.append((lock_id, wh_code))
    
    if not wave_items_by_warehouse:
        return [], unavailable_reasons if unavailable_reasons else ["无法分配库存"]
    
    waves = []
    for wh_code, items in wave_items_by_warehouse.items():
        wave_id = str(uuid.uuid4())
        wave = Wave(
            wave_id=wave_id,
            wave_no=generate_wave_no(),
            warehouse_code=wh_code,
            items=items,
            priority=order.priority,
            created_at=datetime.now(),
            generated_by="system"
        )
        
        for lock_id, _ in all_locks:
            if lock_id in DATA["locks"]:
                DATA["locks"][lock_id].wave_id = wave_id
        
        DATA["waves"][wave_id] = wave
        waves.append(wave)
    
    order.wave_ids = [w.wave_id for w in waves]
    order.status = OrderStatus.PROCESSING
    
    return waves, unavailable_reasons


def release_locks_for_wave(wave_id: str, reason: str = "订单取消"):
    for lock_id, lock in DATA["locks"].items():
        if lock.wave_id == wave_id and lock.status == "active":
            inv_key = f"{lock.warehouse_code}:{lock.sku}"
            if inv_key in DATA["inventories"]:
                inv = DATA["inventories"][inv_key]
                inv.available_qty += lock.locked_qty
                inv.locked_qty -= lock.locked_qty
            
            lock.status = "released"
            lock.released_at = datetime.now()
            lock.release_reason = reason


@app.on_event("startup")
async def startup_event():
    init_seed_data()


@app.post("/api/orders/import", response_model=Dict[str, Any])
def import_order(request: OrderCreateRequest):
    if request.order_no in DATA["orders"]:
        raise HTTPException(status_code=400, detail=f"订单号 {request.order_no} 已存在")
    
    order = Order(
        order_no=request.order_no,
        items=[OrderItem(**item.dict()) for item in request.items],
        priority=request.priority,
        delivery_deadline=request.delivery_deadline,
        created_at=datetime.now(),
        customer_info=request.customer_info
    )
    DATA["orders"][request.order_no] = order
    
    return {
        "success": True,
        "message": "订单导入成功",
        "data": {
            "order_no": order.order_no,
            "status": order.status.value,
            "priority": order.priority.value
        }
    }


@app.post("/api/inventory", response_model=Dict[str, Any])
def update_inventory(request: InventoryRequest):
    key = f"{request.warehouse_code}:{request.sku}"
    
    if key in DATA["inventories"]:
        inv = DATA["inventories"][key]
        inv.available_qty = request.quantity
        inv.sku_name = request.sku_name
        inv.warehouse_name = request.warehouse_name
    else:
        DATA["inventories"][key] = WarehouseInventory(
            warehouse_code=request.warehouse_code,
            warehouse_name=request.warehouse_name,
            sku=request.sku,
            sku_name=request.sku_name,
            available_qty=request.quantity
        )
    
    return {
        "success": True,
        "message": "库存更新成功",
        "data": DATA["inventories"][key].dict()
    }


@app.post("/api/waves/generate", response_model=Dict[str, Any])
def generate_waves(order_nos: Optional[List[str]] = Query(None)):
    if order_nos:
        orders = []
        for order_no in order_nos:
            if order_no not in DATA["orders"]:
                raise HTTPException(status_code=404, detail=f"订单 {order_no} 不存在")
            orders.append(DATA["orders"][order_no])
    else:
        orders = [o for o in DATA["orders"].values() if o.status == OrderStatus.PENDING]
    
    orders.sort(key=lambda o: (o.priority == OrderPriority.URGENT, o.created_at), reverse=True)
    
    result_waves = []
    all_reasons = []
    
    for order in orders:
        waves, reasons = generate_waves_for_order(order)
        result_waves.extend(waves)
        all_reasons.extend(reasons)
    
    return {
        "success": True,
        "message": "波次生成完成",
        "data": {
            "waves": [w.dict() for w in result_waves],
            "unavailable_reasons": all_reasons
        }
    }


@app.post("/api/waves/{wave_id}/confirm", response_model=Dict[str, Any])
def confirm_picking(wave_id: str):
    if wave_id not in DATA["waves"]:
        raise HTTPException(status_code=404, detail="波次不存在")
    
    wave = DATA["waves"][wave_id]
    if wave.status == WaveStatus.COMPLETED:
        return {"success": True, "message": "波次已确认拣货"}
    
    wave.status = WaveStatus.COMPLETED
    
    for lock_id, lock in DATA["locks"].items():
        if lock.wave_id == wave_id and lock.status == "active":
            lock.status = "consumed"
    
    for item in wave.items:
        order = DATA["orders"].get(item.order_no)
        if order:
            order_waves = [DATA["waves"].get(wid) for wid in order.wave_ids]
            all_completed = all(w and w.status == WaveStatus.COMPLETED for w in order_waves)
            if all_completed:
                order.status = OrderStatus.PICKED
    
    return {
        "success": True,
        "message": "拣货确认成功",
        "data": wave.dict()
    }


@app.post("/api/orders/{order_no}/cancel", response_model=Dict[str, Any])
def cancel_order(order_no: str):
    if order_no not in DATA["orders"]:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    order = DATA["orders"][order_no]
    
    if order.status in [OrderStatus.CANCELLED, OrderStatus.PARTIAL_CANCELLED]:
        return {"success": True, "message": "订单已取消"}
    
    for wave_id in order.wave_ids:
        if wave_id in DATA["waves"]:
            wave = DATA["waves"][wave_id]
            if wave.status != WaveStatus.COMPLETED:
                wave.status = WaveStatus.CANCELLED
                release_locks_for_wave(wave_id, reason=f"订单 {order_no} 取消")
    
    has_completed = any(
        DATA["waves"].get(wid) and DATA["waves"][wid].status == WaveStatus.COMPLETED
        for wid in order.wave_ids
    )
    
    order.status = OrderStatus.PARTIAL_CANCELLED if has_completed else OrderStatus.CANCELLED
    
    return {
        "success": True,
        "message": "订单取消成功，库存已释放",
        "data": {
            "order_no": order_no,
            "status": order.status.value
        }
    }


@app.get("/api/warehouses/stats", response_model=Dict[str, Any])
def get_warehouse_stats():
    stats: Dict[str, WarehouseStats] = {}
    wh_names = {}
    
    for key, inv in DATA["inventories"].items():
        wh_names[inv.warehouse_code] = inv.warehouse_name
        if inv.warehouse_code not in stats:
            stats[inv.warehouse_code] = WarehouseStats(
                warehouse_code=inv.warehouse_code,
                warehouse_name=inv.warehouse_name,
                pending_pick_qty=0,
                locked_qty=0,
                unavailable_reasons=[]
            )
    
    for wh_code, stat in stats.items():
        stat.locked_qty = sum(
            inv.locked_qty for key, inv in DATA["inventories"].items()
            if inv.warehouse_code == wh_code
        )
        
        stat.pending_pick_qty = sum(
            item.quantity - item.picked_qty
            for wave in DATA["waves"].values()
            if wave.warehouse_code == wh_code and wave.status in [WaveStatus.PENDING, WaveStatus.PICKING]
            for item in wave.items
        )
    
    unavailable_orders = [
        o for o in DATA["orders"].values()
        if o.status == OrderStatus.PENDING and not o.wave_ids
    ]
    
    for order in unavailable_orders:
        for item in order.items:
            total_available = sum(
                inv.available_qty + inv.locked_qty
                for key, inv in DATA["inventories"].items()
                if inv.sku == item.sku
            )
            if total_available < item.quantity:
                for wh_code in stats.keys():
                    stats[wh_code].unavailable_reasons.append(
                        f"订单 {order.order_no}: SKU {item.sku} 总库存不足(需{item.quantity}/有{total_available})"
                    )
    
    return {
        "success": True,
        "data": {
            "warehouses": [s.dict() for s in stats.values()]
        }
    }


@app.get("/api/waves", response_model=Dict[str, Any])
def list_waves(warehouse_code: Optional[str] = None, status: Optional[WaveStatus] = None):
    waves = list(DATA["waves"].values())
    
    if warehouse_code:
        waves = [w for w in waves if w.warehouse_code == warehouse_code]
    if status:
        waves = [w for w in waves if w.status == status]
    
    waves.sort(key=lambda w: (w.priority == OrderPriority.URGENT, w.created_at), reverse=True)
    
    return {
        "success": True,
        "data": {
            "waves": [w.dict() for w in waves]
        }
    }


@app.get("/api/orders/{order_no}", response_model=Dict[str, Any])
def get_order_detail(order_no: str):
    if order_no not in DATA["orders"]:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    order = DATA["orders"][order_no]
    locks = [lock for lock in DATA["locks"].values() if lock.order_no == order_no]
    
    waves = [DATA["waves"].get(wid) for wid in order.wave_ids if wid in DATA["waves"]]
    allocated_skus = set()
    for wave in waves:
        for item in wave.items:
            allocated_skus.add(item.sku)
    
    unavailable_reasons = []
    for item in order.items:
        if item.sku not in allocated_skus:
            total_available = sum(
                inv.available_qty + inv.locked_qty
                for key, inv in DATA["inventories"].items()
                if inv.sku == item.sku
            )
            if total_available < item.quantity:
                unavailable_reasons.append(
                    f"SKU {item.sku} 总库存不足，需要{item.quantity}，可用{total_available}"
                )
            elif total_available == 0:
                unavailable_reasons.append(f"SKU {item.sku} 无可用库存")
    
    return {
        "success": True,
        "data": {
            "order": order.dict(),
            "locks": [lock.dict() for lock in locks],
            "unavailable_reasons": unavailable_reasons
        }
    }


@app.get("/api/inventory", response_model=Dict[str, Any])
def list_inventory(warehouse_code: Optional[str] = None, sku: Optional[str] = None):
    inventories = list(DATA["inventories"].values())
    
    if warehouse_code:
        inventories = [inv for inv in inventories if inv.warehouse_code == warehouse_code]
    if sku:
        inventories = [inv for inv in inventories if inv.sku == sku]
    
    return {
        "success": True,
        "data": {
            "inventories": [inv.dict() for inv in inventories]
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
