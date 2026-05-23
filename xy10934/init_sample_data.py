import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime


def init_locations(db: Session):
    locations = [
        {"location_code": "A-01-01", "zone": "A", "aisle": "01", "shelf": "01", "sort_order": 1, "sku": "SKU001", "sku_name": "商品1", "stock_qty": 100},
        {"location_code": "A-01-02", "zone": "A", "aisle": "01", "shelf": "02", "sort_order": 2, "sku": "SKU002", "sku_name": "商品2", "stock_qty": 150},
        {"location_code": "A-02-01", "zone": "A", "aisle": "02", "shelf": "01", "sort_order": 3, "sku": "SKU003", "sku_name": "商品3", "stock_qty": 80},
        {"location_code": "A-02-02", "zone": "A", "aisle": "02", "shelf": "02", "sort_order": 4, "sku": "SKU004", "sku_name": "商品4", "stock_qty": 200},
        {"location_code": "B-01-01", "zone": "B", "aisle": "01", "shelf": "01", "sort_order": 5, "sku": "SKU005", "sku_name": "商品5", "stock_qty": 60},
        {"location_code": "B-01-02", "zone": "B", "aisle": "01", "shelf": "02", "sort_order": 6, "sku": "SKU006", "sku_name": "商品6", "stock_qty": 90},
        {"location_code": "B-02-01", "zone": "B", "aisle": "02", "shelf": "01", "sort_order": 7, "sku": "SKU007", "sku_name": "商品7", "stock_qty": 120},
        {"location_code": "B-02-02", "zone": "B", "aisle": "02", "shelf": "02", "sort_order": 8, "sku": "SKU008", "sku_name": "商品8", "stock_qty": 70},
    ]

    for loc_data in locations:
        loc = db.query(models.Location).filter(models.Location.location_code == loc_data["location_code"]).first()
        if not loc:
            loc = models.Location(**loc_data)
            db.add(loc)
    db.commit()
    print(f"已初始化 {len(locations)} 个库位")


def init_orders(db: Session):
    orders_data = [
        {
            "order_no": "ORD202401001",
            "customer": "客户A",
            "address": "北京市朝阳区xxx路xxx号",
            "total_amount": 999.0,
            "items": [
                {"sku": "SKU001", "sku_name": "商品1", "qty": 2, "price": 99.0},
                {"sku": "SKU002", "sku_name": "商品2", "qty": 3, "price": 199.0},
                {"sku": "SKU003", "sku_name": "商品3", "qty": 1, "price": 299.0},
            ]
        },
        {
            "order_no": "ORD202401002",
            "customer": "客户B",
            "address": "上海市浦东新区xxx路xxx号",
            "total_amount": 1598.0,
            "items": [
                {"sku": "SKU001", "sku_name": "商品1", "qty": 5, "price": 99.0},
                {"sku": "SKU004", "sku_name": "商品4", "qty": 2, "price": 499.0},
            ]
        },
        {
            "order_no": "ORD202401003",
            "customer": "客户C",
            "address": "广州市天河区xxx路xxx号",
            "total_amount": 2397.0,
            "items": [
                {"sku": "SKU002", "sku_name": "商品2", "qty": 4, "price": 199.0},
                {"sku": "SKU005", "sku_name": "商品5", "qty": 3, "price": 299.0},
                {"sku": "SKU006", "sku_name": "商品6", "qty": 2, "price": 399.0},
            ]
        },
        {
            "order_no": "ORD202401004",
            "customer": "客户D",
            "address": "深圳市南山区xxx路xxx号",
            "total_amount": 1196.0,
            "items": [
                {"sku": "SKU003", "sku_name": "商品3", "qty": 2, "price": 299.0},
                {"sku": "SKU007", "sku_name": "商品7", "qty": 1, "price": 599.0},
            ]
        },
        {
            "order_no": "ORD202401005",
            "customer": "客户E",
            "address": "杭州市西湖区xxx路xxx号",
            "total_amount": 798.0,
            "items": [
                {"sku": "SKU004", "sku_name": "商品4", "qty": 1, "price": 499.0},
                {"sku": "SKU008", "sku_name": "商品8", "qty": 1, "price": 299.0},
            ]
        },
    ]

    for order_data in orders_data:
        existing = db.query(models.Order).filter(models.Order.order_no == order_data["order_no"]).first()
        if existing:
            continue

        order = models.Order(
            order_no=order_data["order_no"],
            customer=order_data["customer"],
            address=order_data["address"],
            total_amount=order_data["total_amount"],
            total_qty=sum(item["qty"] for item in order_data["items"]),
        )
        db.add(order)
        db.flush()

        for item_data in order_data["items"]:
            item = models.OrderItem(
                order_id=order.id,
                sku=item_data["sku"],
                sku_name=item_data["sku_name"],
                qty=item_data["qty"],
                price=item_data["price"],
            )
            db.add(item)

    db.commit()
    print(f"已初始化 {len(orders_data)} 个订单")


def main():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("开始初始化样例数据...")
        init_locations(db)
        init_orders(db)
        print("样例数据初始化完成！")
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
