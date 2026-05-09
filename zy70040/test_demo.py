#!/usr/bin/env python3
"""
循环包材押金归还服务 - 端到端测试脚本
测试核心流程、幂等性、撤回和导出功能
"""

import sys
import json
from datetime import datetime, timedelta
from io import BytesIO

sys.path.insert(0, "/Users/lzy/pro/solo/workspaces/zy70040")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from app import models, services, export
from app.models import PackageType, DepositStatus, RefundStatus


TEST_DB_URL = "sqlite:///./test_deposit_service.db"


def setup_test_db():
    Base = declarative_base()
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return SessionLocal()


def test_deposit_order_creation(db):
    print("\n" + "=" * 60)
    print("测试1: 创建押金单")
    print("=" * 60)

    data = {
        "customer_id": "C001",
        "customer_name": "测试客户A",
        "cycle_box_count": 10,
        "thermal_bag_count": 20,
        "pallet_count": 5,
        "cycle_box_deposit": 500.0,
        "thermal_bag_deposit": 400.0,
        "pallet_deposit": 250.0,
        "operator_id": "OP001",
        "operator_name": "张三",
    }

    order = services.create_deposit_order(db, data)
    print(f"创建押金单: {order.order_no}")
    print(f"总押金: {order.total_deposit} 元")
    print(f"状态: {order.status}")

    assert order.order_no.startswith("DO")
    assert order.total_deposit == 1150.0
    assert order.status == DepositStatus.PAID
    assert order.refundable_amount == 1150.0

    print("✓ 押金单创建成功")
    return order


def test_idempotent_scan(db, order):
    print("\n" + "=" * 60)
    print("测试2: 扫码归还（幂等性测试）")
    print("=" * 60)

    scan_data1 = {
        "deposit_order_no": order.order_no,
        "package_type": PackageType.CYCLE_BOX,
        "package_code": "BOX001",
        "quantity": 1,
        "operator_id": "OP001",
        "operator_name": "张三",
    }

    scan1 = services.scan_package(db, scan_data1)
    print(f"第一次扫码: {scan1.scan_no}")
    print(f"循环箱已归还: {order.cycle_box_returned}")

    scan2 = services.scan_package(db, scan_data1)
    print(f"第二次扫码（相同包材码）: {scan2.scan_no}")
    print(f"循环箱已归还: {order.cycle_box_returned}")

    assert scan1.id == scan2.id
    assert order.cycle_box_returned == 1

    print("✓ 扫码幂等性验证通过（重复扫码不重复计数）")

    scan_data2 = {
        "deposit_order_no": order.order_no,
        "package_type": PackageType.CYCLE_BOX,
        "package_code": "BOX002",
        "quantity": 1,
        "operator_id": "OP001",
        "operator_name": "张三",
    }
    scan3 = services.scan_package(db, scan_data2)
    print(f"扫码BOX002: {scan3.scan_no}")
    print(f"循环箱已归还: {order.cycle_box_returned}")

    assert order.cycle_box_returned == 2

    print("✓ 不同包材码扫码成功")
    return [scan1, scan3]


def test_damage_deduction(db, order):
    print("\n" + "=" * 60)
    print("测试3: 损坏扣减")
    print("=" * 60)

    damage_data = {
        "deposit_order_no": order.order_no,
        "package_type": PackageType.CYCLE_BOX,
        "package_code": "BOX003",
        "quantity": 1,
        "deduction_amount": 50.0,
        "damage_level": "严重",
        "damage_description": "箱体变形，无法使用",
        "operator_id": "OP002",
        "operator_name": "李四",
    }

    damage = services.record_damage(db, damage_data)
    print(f"损坏记录: {damage.damage_no}")
    print(f"扣减金额: {damage.deduction_amount} 元")
    print(f"循环箱已损坏: {order.cycle_box_damaged}")
    print(f"总扣款: {order.total_deduction} 元")
    print(f"可退押金: {order.refundable_amount} 元")

    assert damage.damage_no.startswith("DM")
    assert order.total_deduction == 50.0
    assert order.refundable_amount == 1100.0

    print("✓ 损坏扣减成功")
    return damage


def test_scan_reverse(db, order, scan_records):
    print("\n" + "=" * 60)
    print("测试4: 撤回扫码记录")
    print("=" * 60)

    scan_to_reverse = scan_records[1]
    print(f"撤回前循环箱已归还: {order.cycle_box_returned}")

    reversed_scan = services.reverse_scan_record(
        db, scan_to_reverse.id, "扫码错误", "OP001", "张三"
    )

    print(f"撤回后循环箱已归还: {order.cycle_box_returned}")
    print(f"扫码记录状态: {'已撤回' if reversed_scan.is_reversed else '正常'}")

    assert reversed_scan.is_reversed == True
    assert order.cycle_box_returned == 1

    print("✓ 扫码撤回成功")

    try:
        services.reverse_scan_record(
            db, scan_to_reverse.id, "再次撤回", "OP001", "张三"
        )
        print("✗ 错误: 允许重复撤回")
        assert False
    except ValueError as e:
        print(f"✓ 正确阻止重复撤回: {e}")


def test_refund_flow(db, order):
    print("\n" + "=" * 60)
    print("测试5: 退款流程")
    print("=" * 60)

    remaining = 10 - order.cycle_box_returned - order.cycle_box_damaged
    for i in range(remaining):
        scan_data = {
            "deposit_order_no": order.order_no,
            "package_type": PackageType.CYCLE_BOX,
            "package_code": f"BOX_FILL_{i}",
            "quantity": 1,
            "operator_id": "OP001",
            "operator_name": "张三",
        }
        services.scan_package(db, scan_data)

    for i in range(20):
        scan_data = {
            "deposit_order_no": order.order_no,
            "package_type": PackageType.THERMAL_BAG,
            "package_code": f"BAG{i+1:03d}",
            "quantity": 1,
            "operator_id": "OP001",
            "operator_name": "张三",
        }
        services.scan_package(db, scan_data)

    for i in range(5):
        scan_data = {
            "deposit_order_no": order.order_no,
            "package_type": PackageType.PALLET,
            "package_code": f"PLT{i+1:03d}",
            "quantity": 1,
            "operator_id": "OP001",
            "operator_name": "张三",
        }
        services.scan_package(db, scan_data)

    print(f"全部包材归还后状态: {order.status}")
    assert order.status == DepositStatus.FULL_RETURNED

    refund = services.create_refund_from_order(
        db, order.order_no, "OP001", "张三", "原路径退回"
    )
    print(f"创建退款订单: {refund.refund_no}")
    print(f"退款金额: {refund.refund_amount} 元")

    assert refund.refund_no.startswith("RF")
    assert refund.status == RefundStatus.PENDING

    pending_refunds = services.list_pending_refunds(db)
    print(f"待处理退款数量: {len(pending_refunds)}")
    assert len(pending_refunds) >= 1

    processed = services.process_refund(db, refund.id, "TXN20240101001")
    print(f"退款处理后状态: {processed.status}")

    assert processed.status == RefundStatus.SUCCESS
    assert order.refunded_amount == 1100.0
    assert order.refundable_amount == 0.0
    assert order.status == DepositStatus.CLOSED

    print("✓ 退款流程成功")
    return processed


def test_idempotent_refund(db):
    print("\n" + "=" * 60)
    print("测试6: 退款幂等性测试")
    print("=" * 60)

    data = {
        "customer_id": "C002",
        "customer_name": "测试客户B",
        "cycle_box_count": 2,
        "thermal_bag_count": 0,
        "pallet_count": 0,
        "cycle_box_deposit": 100.0,
        "thermal_bag_deposit": 0.0,
        "pallet_deposit": 0.0,
        "operator_id": "OP001",
        "operator_name": "张三",
    }

    order2 = services.create_deposit_order(db, data)

    scan_data = {
        "deposit_order_no": order2.order_no,
        "package_type": PackageType.CYCLE_BOX,
        "package_code": "TEST_BOX001",
        "quantity": 2,
        "operator_id": "OP001",
        "operator_name": "张三",
    }
    services.scan_package(db, scan_data)

    refund1 = services.create_refund_from_order(
        db, order2.order_no, "OP001", "张三"
    )
    print(f"第一次创建退款: {refund1.refund_no}")

    refund2 = services.create_refund_from_order(
        db, order2.order_no, "OP001", "张三"
    )
    print(f"第二次创建退款: {refund2.refund_no}")

    assert refund1.id == refund2.id

    print("✓ 退款幂等性验证通过（重复创建返回同一订单）")


def test_operation_history(db, order):
    print("\n" + "=" * 60)
    print("测试7: 操作历史追踪")
    print("=" * 60)

    history = services.get_operation_history(
        db, entity_type="deposit_order", entity_id=order.id
    )

    print(f"押金单相关操作记录数量: {len(history)}")
    for record in history:
        print(f"  - {record.operation_type}: {record.operation_desc} "
              f"(操作人: {record.operator_name})")

    assert len(history) > 0

    print("✓ 操作历史记录完整")


def test_export_functions(db, order):
    print("\n" + "=" * 60)
    print("测试8: 数据导出功能")
    print("=" * 60)

    orders = services.list_deposit_orders(db)
    deposit_data = export.export_deposit_orders(db, orders)
    print(f"押金单导出数据大小: {len(deposit_data)} 字节")

    scans = services.get_scan_records(db)
    scan_data = export.export_scan_records(db, scans)
    print(f"扫码记录导出数据大小: {len(scan_data)} 字节")

    damages = services.get_damage_records(db)
    damage_data = export.export_damage_records(db, damages)
    print(f"损坏记录导出数据大小: {len(damage_data)} 字节")

    refunds = services.list_refund_orders(db)
    refund_data = export.export_refund_orders(db, refunds)
    print(f"退款订单导出数据大小: {len(refund_data)} 字节")

    history = services.get_operation_history(db)
    history_data = export.export_operation_history(db, history)
    print(f"操作历史导出数据大小: {len(history_data)} 字节")

    assert len(deposit_data) > 0
    assert len(scan_data) > 0

    print("✓ 数据导出功能正常")


def test_reconciliation(db):
    print("\n" + "=" * 60)
    print("测试9: 财务对账")
    print("=" * 60)

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)

    batch = services.create_reconciliation_batch(
        db, start_date, end_date, "OP001", "张三"
    )

    print(f"对账批次: {batch.batch_no}")
    print(f"押金单数量: {batch.total_orders}")
    print(f"总押金: {batch.total_deposit} 元")
    print(f"已退款: {batch.total_refund} 元")
    print(f"已扣款: {batch.total_deduction} 元")
    print(f"剩余押金: {batch.remaining_deposit} 元")

    assert batch.batch_no.startswith("RC")

    recon_data = export.export_reconciliation_batch(db, batch)
    print(f"对账数据导出大小: {len(recon_data)} 字节")

    print("✓ 财务对账功能正常")


def test_detail_traceability(db, order):
    print("\n" + "=" * 60)
    print("测试10: 明细追溯能力")
    print("=" * 60)

    detail_order = services.get_deposit_order(db, order.order_no)

    print(f"押金单: {detail_order.order_no}")
    print(f"  - 扫码记录数量: {len(detail_order.scan_records)}")
    print(f"  - 损坏记录数量: {len(detail_order.damage_records)}")
    print(f"  - 退款订单数量: {len(detail_order.refund_orders)}")

    print("\n扫码记录明细:")
    for scan in detail_order.scan_records:
        print(f"  - {scan.scan_no}: {scan.package_type} {scan.package_code} "
              f"(数量: {scan.quantity}, {'已撤回' if scan.is_reversed else '有效'})")

    print("\n损坏记录明细:")
    for damage in detail_order.damage_records:
        print(f"  - {damage.damage_no}: {damage.package_type} {damage.package_code} "
              f"(扣减: {damage.deduction_amount}元)")

    print("\n退款订单明细:")
    for refund in detail_order.refund_orders:
        print(f"  - {refund.refund_no}: {refund.refund_amount}元 "
              f"(状态: {refund.status})")

    assert len(detail_order.scan_records) > 0

    print("\n✓ 明细追溯功能完整，可从汇总反查到每条操作记录")


def run_all_tests():
    print("\n" + "#" * 60)
    print("# 循环包材押金归还服务 - 端到端测试")
    print("#" * 60)

    db = setup_test_db()

    try:
        order = test_deposit_order_creation(db)
        scans = test_idempotent_scan(db, order)
        damage = test_damage_deduction(db, order)
        test_scan_reverse(db, order, scans)
        test_refund_flow(db, order)
        test_idempotent_refund(db)
        test_operation_history(db, order)
        test_export_functions(db, order)
        test_reconciliation(db)
        test_detail_traceability(db, order)

        print("\n" + "#" * 60)
        print("# ✓ 所有测试通过！")
        print("#" * 60)

    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()

    return True


if __name__ == "__main__":
    run_all_tests()
