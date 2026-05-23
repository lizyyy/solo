from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import schemas
import services

engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.create_all(bind=engine)

def test_stock_split_calculation():
    db = TestingSessionLocal()

    print("=" * 60)
    print("测试缺货拆单计算修复验证")
    print("=" * 60)

    location = models.Location(
        location_code="A-01-01",
        zone="A",
        aisle="01",
        shelf="01",
        sort_order=1,
        sku="SKU001",
        sku_name="测试商品",
        stock_qty=100,
    )
    db.add(location)
    db.commit()

    order = models.Order(
        order_no="TEST001",
        customer="测试客户",
        total_amount=0,
        total_qty=5,
    )
    db.add(order)
    db.flush()

    order_item = models.OrderItem(
        order_id=order.id,
        sku="SKU001",
        sku_name="测试商品",
        qty=5,
        price=100,
    )
    db.add(order_item)
    db.commit()

    wave = models.Wave(
        wave_code="WAVETEST001",
        status="ready",
        total_orders=1,
        total_skus=1,
        total_qty=5,
    )
    db.add(wave)
    db.flush()

    original_task = models.PickTask(
        task_code="TASKTEST001",
        wave_id=wave.id,
        order_id=order.id,
        sku="SKU001",
        sku_name="测试商品",
        location_code="A-01-01",
        required_qty=5,
        status="pending",
    )
    db.add(original_task)
    db.commit()
    db.refresh(original_task)

    print(f"\n【测试前】")
    print(f"原任务ID: {original_task.id}")
    print(f"原任务需求数量: {original_task.required_qty}")
    print(f"可用库存: 2")
    print(f"预期: 原任务=2, 新任务=3 (剩余缺货)")

    split_request = schemas.StockSplitRequest(
        pick_task_id=original_task.id,
        available_qty=2,
        reason="测试缺货拆单",
        operator="测试员",
    )

    try:
        services.process_stock_split(db, split_request)
    except Exception as e:
        print(f"拆单失败: {e}")
        db.close()
        return

    db.refresh(original_task)

    new_task = db.query(models.PickTask).filter(
        models.PickTask.split_from_task_id == original_task.id
    ).first()

    print(f"\n【测试后】")
    print(f"原任务需求数量: {original_task.required_qty}")
    if new_task:
        print(f"新任务需求数量: {new_task.required_qty}")
        print(f"新任务状态: {new_task.status}")
    else:
        print("新任务: 未创建!")

    print(f"\n【结果验证】")
    success = True

    if original_task.required_qty != 2:
        print(f"❌ 原任务数量错误: 预期=2, 实际={original_task.required_qty}")
        success = False
    else:
        print(f"✅ 原任务数量正确: 2")

    if not new_task:
        print("❌ 新任务未创建!")
        success = False
    elif new_task.required_qty != 3:
        print(f"❌ 新任务数量错误: 预期=3, 实际={new_task.required_qty}")
        success = False
    else:
        print(f"✅ 新任务数量正确: 3")

    if new_task and new_task.status != "out_of_stock":
        print(f"❌ 新任务状态错误: 预期=out_of_stock, 实际={new_task.status}")
        success = False
    elif new_task:
        print(f"✅ 新任务状态正确: out_of_stock")

    if original_task.is_split != True:
        print(f"❌ 原任务拆单标记错误")
        success = False
    else:
        print(f"✅ 原任务拆单标记正确")

    if new_task and new_task.split_from_task_id != original_task.id:
        print(f"❌ 新任务关联错误")
        success = False
    elif new_task:
        print(f"✅ 新任务关联正确")

    print(f"\n{'=' * 60}")
    if success:
        print("✅ 所有测试通过! 缺货拆单计算修复成功!")
    else:
        print("❌ 测试失败!")
    print("=" * 60)

    db.close()

if __name__ == "__main__":
    test_stock_split_calculation()
