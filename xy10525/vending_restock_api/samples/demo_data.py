from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.models import Machine, Product, Inventory, SalesForecast, Fault, FaultStatus
from app.config import settings


def create_basic_data(db: Session):
    machines = [
        Machine(
            id="M001",
            name="售卖机A-办公楼大厅",
            location="A座1楼大厅",
            latitude=31.2304,
            longitude=121.4737,
            max_slots=20,
            is_active=True
        ),
        Machine(
            id="M002",
            name="售卖机B-科技园东门",
            location="B座东门入口",
            latitude=31.2306,
            longitude=121.4740,
            max_slots=15,
            is_active=True
        ),
        Machine(
            id="M003",
            name="售卖机C-食堂",
            location="食堂2楼",
            latitude=31.2308,
            longitude=121.4742,
            max_slots=25,
            is_active=True
        ),
        Machine(
            id="M004",
            name="售卖机D-地铁口",
            location="地铁2号口",
            latitude=31.2310,
            longitude=121.4745,
            max_slots=20,
            is_active=True
        )
    ]
    
    products = [
        Product(id="P001", name="可口可乐330ml", sku="COKE001", category="饮料", unit_volume=1),
        Product(id="P002", name="农夫山泉550ml", sku="WATER001", category="饮料", unit_volume=1),
        Product(id="P003", name="乐事薯片原味", sku="CHIPS001", category="零食", unit_volume=2),
        Product(id="P004", name="奥利奥夹心饼干", sku="OREO001", category="零食", unit_volume=2),
        Product(id="P005", name="康师傅红烧牛肉面", sku="NOODLE001", category="方便食品", unit_volume=3),
        Product(id="P006", name="红牛功能饮料", sku="REDBULL001", category="饮料", unit_volume=1),
        Product(id="P007", name="好丽友派", sku="ORION001", category="零食", unit_volume=2),
        Product(id="P008", name="旺仔牛奶", sku="WANT001", category="饮料", unit_volume=1),
    ]
    
    db.add_all(machines)
    db.add_all(products)
    db.commit()
    
    today = datetime.now()
    expiry_future = today + timedelta(days=30)
    expiry_soon = today + timedelta(days=2)
    expiry_past = today - timedelta(days=5)
    
    inventories = [
        Inventory(machine_id="M001", product_id="P001", quantity=2, min_level=10, max_level=50, expiry_date=expiry_future),
        Inventory(machine_id="M001", product_id="P002", quantity=8, min_level=10, max_level=40, expiry_date=expiry_future),
        Inventory(machine_id="M001", product_id="P003", quantity=15, min_level=5, max_level=30, expiry_date=expiry_soon),
        Inventory(machine_id="M001", product_id="P004", quantity=3, min_level=8, max_level=25, expiry_date=expiry_future),
        Inventory(machine_id="M001", product_id="P005", quantity=25, min_level=10, max_level=35, expiry_date=expiry_future),
        
        Inventory(machine_id="M002", product_id="P001", quantity=45, min_level=10, max_level=50, expiry_date=expiry_future),
        Inventory(machine_id="M002", product_id="P002", quantity=5, min_level=15, max_level=40, expiry_date=expiry_future),
        Inventory(machine_id="M002", product_id="P006", quantity=1, min_level=5, max_level=20, expiry_date=expiry_future),
        Inventory(machine_id="M002", product_id="P007", quantity=10, min_level=5, max_level=20, expiry_date=expiry_past),
        
        Inventory(machine_id="M003", product_id="P001", quantity=8, min_level=15, max_level=60, expiry_date=expiry_future),
        Inventory(machine_id="M003", product_id="P002", quantity=12, min_level=20, max_level=50, expiry_date=expiry_future),
        Inventory(machine_id="M003", product_id="P005", quantity=5, min_level=15, max_level=40, expiry_date=expiry_future),
        Inventory(machine_id="M003", product_id="P008", quantity=20, min_level=10, max_level=30, expiry_date=expiry_future),
        
        Inventory(machine_id="M004", product_id="P001", quantity=30, min_level=20, max_level=80, expiry_date=expiry_future),
        Inventory(machine_id="M004", product_id="P002", quantity=25, min_level=20, max_level=60, expiry_date=expiry_future),
        Inventory(machine_id="M004", product_id="P003", quantity=5, min_level=10, max_level=35, expiry_date=expiry_future),
        Inventory(machine_id="M004", product_id="M004"[:4], quantity=18, min_level=10, max_level=30, expiry_date=expiry_future),
    ]
    
    db.add_all(inventories)
    
    forecasts = [
        SalesForecast(machine_id="M001", product_id="P001", forecast_date=today, predicted_quantity=35),
        SalesForecast(machine_id="M001", product_id="P002", forecast_date=today, predicted_quantity=25),
        SalesForecast(machine_id="M002", product_id="P006", forecast_date=today, predicted_quantity=15),
        SalesForecast(machine_id="M003", product_id="P005", forecast_date=today, predicted_quantity=28),
        SalesForecast(machine_id="M004", product_id="P003", forecast_date=today, predicted_quantity=20),
    ]
    db.add_all(forecasts)
    
    faults = [
        Fault(
            id="F001",
            machine_id="M004",
            fault_type="支付模块故障",
            description="微信支付无法扫码，屏幕显示二维码失败",
            status=FaultStatus.RESOLVED,
            priority=2,
            assigned_operator="张维修",
            reported_at=today - timedelta(days=1),
            resolved_at=today - timedelta(hours=2),
            resolution_notes="更换扫码枪硬件故障，已更换新设备"
        )
    ]
    db.add_all(faults)
    
    db.commit()
    
    return {
        "machines": len(machines),
        "products": len(products),
        "inventories": len(inventories),
        "forecasts": len(forecasts),
        "faults": len(faults)
    }


def init_all_samples():
    db = SessionLocal()
    try:
        result = create_basic_data(db)
        return {
            "success": True,
            "message": "Demo data initialized successfully",
            "data": result,
            "description": {
                "machines": "M001-M004 四台售卖机，含不同场景的库存和临期情况",
                "products": "8种常见商品，含饮料、零食、方便食品",
                "scenarios_ready": [
                    "M001: 缺货+临期商品需回收",
                    "M002: 缺货+过期商品需回收",
                    "M003: 正常补货需求",
                    "M004: 已解决历史故障"
                ]
            }
        }
    finally:
        db.close()
