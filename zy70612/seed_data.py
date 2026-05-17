from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from datetime import datetime, timedelta
import crud
import schemas

Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("开始造测试数据...")

stores_data = [
    {"store_code": "BJ001", "name": "北京朝阳店", "region": "华北", "manager_email": "bj001@company.com"},
    {"store_code": "BJ002", "name": "北京海淀店", "region": "华北", "manager_email": "bj002@company.com"},
    {"store_code": "SH001", "name": "上海浦东店", "region": "华东", "manager_email": "sh001@company.com"},
    {"store_code": "GZ001", "name": "广州天河店", "region": "华南", "manager_email": "gz001@company.com"},
    {"store_code": "SZ001", "name": "深圳南山店", "region": "华南", "manager_email": "sz001@company.com"},
]

created_stores = []
for store_data in stores_data:
    store = crud.create_store(db, schemas.StoreCreate(**store_data))
    created_stores.append(store)
    print(f"已创建门店: {store.store_code} - {store.name}")

version_data = {
    "version_code": "PROMO-2024-MAY",
    "name": "2024五一促销活动",
    "description": "五一劳动节全场促销活动，所有商品享受折扣价",
    "promotion_start": datetime(2024, 5, 1, 0, 0, 0),
    "promotion_end": datetime(2024, 5, 5, 23, 59, 59),
    "created_by": "admin@company.com"
}

version = crud.create_price_tag_version(db, schemas.PriceTagVersionCreate(**version_data))
print(f"已创建价签版本: {version.version_code} - {version.name}")

items_data = [
    {"barcode": "6901234567001", "product_name": "可口可乐330ml", "original_price": 3.50, "promotion_price": 2.99, "unit": "瓶"},
    {"barcode": "6901234567002", "product_name": "百事可乐330ml", "original_price": 3.50, "promotion_price": 2.89, "unit": "瓶"},
    {"barcode": "6901234567003", "product_name": "农夫山泉550ml", "original_price": 2.00, "promotion_price": 1.50, "unit": "瓶"},
    {"barcode": "6901234567004", "product_name": "乐事薯片原味", "original_price": 8.90, "promotion_price": 6.90, "unit": "袋"},
    {"barcode": "6901234567005", "product_name": "康师傅方便面", "original_price": 4.50, "promotion_price": 3.50, "unit": "桶"},
]

for item_data in items_data:
    item = crud.add_item_to_version(db, version_id=version.id, item=schemas.PriceTagItemCreate(**item_data))
    print(f"已添加商品: {item.barcode} - {item.product_name}")

store_ids = [store.id for store in created_stores]
crud.assign_stores_to_version(db, version_id=version.id, store_ids=store_ids, assigned_by="admin@company.com")
print(f"已分配 {len(store_ids)} 个门店到价签版本")

print("\n造数完成！")
db.close()
