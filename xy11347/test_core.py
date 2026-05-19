#!/usr/bin/env python3
from app.core.database import SessionLocal
from app.repositories.repositories import OrderRepository, ColorMeasurementRepository
from app.schemas.schemas import OrderCreate, ColorMeasurementCreate

db = SessionLocal()

try:
    order_repo = OrderRepository(db)
    order_data = OrderCreate(
        order_no='TEST-001',
        product_name='测试产品',
        customer='测试客户',
        paper_batch='PAPER-TEST-001',
        target_l=95.0,
        target_a=-1.5,
        target_b=5.2,
        tolerance_l=2.0,
        tolerance_a=2.0,
        tolerance_b=2.0,
        operator='测试员'
    )
    order = order_repo.create(order_data)
    print(f'✅ 创建订单成功: {order.order_no}')

    measurement_repo = ColorMeasurementRepository(db)
    measurement_data = ColorMeasurementCreate(
        order_no='TEST-001',
        measurement_no='M001',
        l_value=94.8,
        a_value=-1.6,
        b_value=5.1,
        paper_batch='PAPER-TEST-001',
        operator='张工'
    )
    measurement = measurement_repo.create(measurement_data)
    print(f'✅ 创建测色数据成功')
    print(f'   is_pass={measurement.is_pass}')
    print(f'   delta_l={measurement.delta_l}')
    print(f'   delta_e={measurement.delta_e}')

    from app.services.services import QCJudgmentService
    qc_service = QCJudgmentService(db)
    result = qc_service.evaluate_order(order.id)
    print(f'✅ 评估订单结果: {result}')

    print('\n🎉 核心功能全部测试通过！')

except Exception as e:
    print(f'❌ 错误: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
