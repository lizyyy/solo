#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, init_db, ApprovalOrder, BudgetAllocation, ManualCorrection, VersionFreeze, ProcessLog
import json


def create_realistic_orders(db: Session):
    orders_data = [
        {
            "order_no": "AP-2024-001567",
            "department": "技术研发部",
            "applicant": "张开发",
            "amount": 150000,
            "subject": "关于申请Q4研发服务器集群扩容采购预算的请示",
            "apply_date": datetime.now() - timedelta(days=45),
            "due_date": datetime.now() - timedelta(days=15),
            "priority": "critical",
            "material_summary": "申请采购高性能计算服务器10台，用于AI模型训练。附供应商报价单、技术规格参数表、现有资源使用率报告。",
            "current_approver": "李技术总监"
        },
        {
            "order_no": "AP-2024-001568",
            "department": "市场营销部",
            "applicant": "王推广",
            "amount": 85000,
            "subject": "双11大促线上广告投放费用申请",
            "apply_date": datetime.now() - timedelta(days=40),
            "due_date": datetime.now() - timedelta(days=10),
            "priority": "high",
            "material_summary": "计划在抖音、微信朋友圈投放广告，预计曝光量500万次，转化率3%。附投放方案、KPI预测表。",
            "current_approver": "赵市场总监"
        },
        {
            "order_no": "AP-2024-001569",
            "department": "人力资源部",
            "applicant": "刘招聘",
            "amount": 45000,
            "subject": "秋季校园招聘经费申请",
            "apply_date": datetime.now() - timedelta(days=35),
            "due_date": datetime.now() - timedelta(days=5),
            "priority": "normal",
            "material_summary": "计划赴10所高校开展校园招聘，包含展位费、宣传物料、差旅费用。附院校名单、行程安排。",
            "current_approver": "孙人力总监"
        },
        {
            "order_no": "AP-2024-001570",
            "department": "行政办公室",
            "applicant": "陈行政",
            "amount": 12000,
            "subject": "办公区绿植更新及维护合同续签",
            "apply_date": datetime.now() - timedelta(days=30),
            "due_date": datetime.now() - timedelta(days=3),
            "priority": "low",
            "material_summary": "办公区绿植季度更新及日常养护服务合同续签，共计300盆。附绿植清单、供应商报价对比。",
            "current_approver": "周行政经理"
        },
        {
            "order_no": "AP-2024-001571",
            "department": "销售一部",
            "applicant": "吴销售",
            "amount": 28000,
            "subject": "华南区客户年终答谢会费用申请",
            "apply_date": datetime.now() - timedelta(days=25),
            "due_date": datetime.now() - timedelta(days=8),
            "priority": "high",
            "material_summary": "拟于12月举办华南区重点客户答谢会，预计50人参会。附场地报价单、餐饮菜单、礼品清单。",
            "current_approver": "郑销售总监"
        },
        {
            "order_no": "AP-2024-001572",
            "department": "产品运营部",
            "applicant": "冯运营",
            "amount": 65000,
            "subject": "年度用户运营活动专项资金申请",
            "apply_date": datetime.now() - timedelta(days=20),
            "due_date": datetime.now() - timedelta(days=2),
            "priority": "normal",
            "material_summary": "用于用户拉新、留存促活系列运营活动，包含优惠券发放、积分兑换等。附活动方案、ROI预测。",
            "current_approver": "褚运营总监"
        },
        {
            "order_no": "AP-2024-001573",
            "department": "财务管理部",
            "applicant": "卫财务",
            "amount": 8000,
            "subject": "财务软件年度License续费申请",
            "apply_date": datetime.now() - timedelta(days=15),
            "due_date": datetime.now() + timedelta(days=5),
            "priority": "normal",
            "material_summary": "用友财务软件U8系统年度服务续费，含技术支持及版本升级。附软件服务商续费通知。",
            "current_approver": "蒋财务总监"
        },
        {
            "order_no": "AP-2024-001574",
            "department": "技术研发部",
            "applicant": "沈测试",
            "amount": 55000,
            "subject": "自动化测试工具采购申请",
            "apply_date": datetime.now() - timedelta(days=50),
            "due_date": datetime.now() - timedelta(days=20),
            "priority": "high",
            "material_summary": "申请采购商用自动化测试平台License，预计提升测试效率50%。附工具评测报告、竞品对比表。",
            "current_approver": "韩技术VP"
        },
        {
            "order_no": "AP-2024-001575",
            "department": "销售二部",
            "applicant": "杨销售",
            "amount": 35000,
            "subject": "华东区域出差差旅费预算申请",
            "apply_date": datetime.now() - timedelta(days=18),
            "due_date": datetime.now() - timedelta(days=1),
            "priority": "normal",
            "material_summary": "计划赴上海、杭州、南京拜访8家重点客户，为期10天。附出差行程表、客户拜访计划、差旅标准。",
            "current_approver": "朱销售总监"
        },
        {
            "order_no": "AP-2024-001576",
            "department": "技术研发部",
            "applicant": "秦算法",
            "amount": 220000,
            "subject": "AI大模型训练专用GPU服务器集群采购",
            "apply_date": datetime.now() - timedelta(days=60),
            "due_date": datetime.now() - timedelta(days=30),
            "priority": "critical",
            "material_summary": "采购8台A100 GPU服务器用于自研大模型训练，预计算力提升400%。附设备配置清单、算力测算报告、三年TCO分析。",
            "current_approver": "许CTO"
        }
    ]

    created_orders = []
    for order_data in orders_data:
        overdue_days = max(0, (datetime.now() - order_data["due_date"]).days)
        order = ApprovalOrder(
            **order_data,
            status="pending",
            overdue_days=overdue_days,
            created_at=order_data["apply_date"],
            updated_at=datetime.now()
        )
        db.add(order)
        db.flush()
        created_orders.append(order)

    db.commit()
    return created_orders


def create_dirty_data_scenario(db: Session, orders):
    """创建脏数据场景：旧版本覆盖新结果的情况"""

    order1 = orders[0]
    order2 = orders[1]

    alloc1_v1 = BudgetAllocation(
        order_id=order1.id,
        allocated_amount=150000,
        allocated_budget_code="RD-002",
        allocation_reason="逾期优先级评分:450.0，预算检查通过",
        algorithm_version="v0.9.0-beta",
        is_overridden=False,
        status="success",
        execution_time_ms=15,
        created_at=datetime.now() - timedelta(days=10)
    )
    db.add(alloc1_v1)
    db.flush()

    alloc1_v2 = BudgetAllocation(
        order_id=order1.id,
        allocated_amount=150000,
        allocated_budget_code="RD-002",
        allocation_reason="逾期优先级评分:450.0，预算检查通过",
        algorithm_version="v0.9.1-beta",
        is_overridden=False,
        status="success",
        execution_time_ms=12,
        created_at=datetime.now() - timedelta(days=8)
    )
    db.add(alloc1_v2)
    db.flush()

    alloc1_v3 = BudgetAllocation(
        order_id=order1.id,
        allocated_amount=140000,
        allocated_budget_code="OP-001",
        allocation_reason="逾期优先级评分:450.0，预算检查通过 - 人工调整后金额",
        algorithm_version="v1.0.0",
        is_overridden=True,
        status="success",
        execution_time_ms=10,
        created_at=datetime.now() - timedelta(days=5)
    )
    db.add(alloc1_v3)
    db.flush()

    correction = ManualCorrection(
        order_id=order1.id,
        original_allocation_id=alloc1_v2.id,
        corrected_amount=140000,
        corrected_budget_code="OP-001",
        correction_reason="实际采购价格下降，经与供应商协商最终成交价为14万，调整预算编码为运营支出",
        corrected_by="预算专员-王审核",
        system_judgment_snapshot=json.dumps({
            "system_allocated_amount": 150000,
            "system_budget_code": "RD-002",
            "system_reason": "逾期优先级评分:450.0，预算检查通过",
            "algorithm_version": "v0.9.1-beta",
            "snapshot_time": (datetime.now() - timedelta(days=5)).isoformat()
        }, ensure_ascii=False),
        created_at=datetime.now() - timedelta(days=5)
    )
    db.add(correction)
    db.flush()

    freeze = VersionFreeze(
        allocation_id=alloc1_v3.id,
        freeze_note="Q4预算终审确认，金额已与财务核对无误，锁定版本",
        frozen_by="财务总监-陈审批",
        algorithm_hash="hash_v1.0.0_1699999999",
        frozen_at=datetime.now() - timedelta(days=3)
    )
    db.add(freeze)
    db.flush()

    alloc2_fail = BudgetAllocation(
        order_id=order2.id,
        allocated_amount=0,
        allocated_budget_code=None,
        allocation_reason="部门预算超限，已使用250000.00元，申请85000.00元，限额300000元",
        algorithm_version="v1.0.0",
        is_overridden=False,
        status="failed",
        error_message="部门预算超限，已使用250000.00元，申请85000.00元，限额300000元",
        execution_time_ms=8,
        created_at=datetime.now() - timedelta(days=2)
    )
    db.add(alloc2_fail)
    db.flush()

    log_error = ProcessLog(
        order_id=order2.id,
        operation_type="budget_allocation",
        status="failed",
        detail="部门预算超限，已使用250000.00元，申请85000.00元，限额300000元",
        execution_time_ms=8,
        operator="system",
        created_at=datetime.now() - timedelta(days=2)
    )
    db.add(log_error)

    db.commit()


def main():
    print("初始化数据库...")
    init_db()

    db = SessionLocal()

    try:
        print("生成真实部门审批催办数据...")
        orders = create_realistic_orders(db)
        print(f"  已创建 {len(orders)} 条审批单")

        print("生成脏数据场景（旧版本覆盖新结果）...")
        create_dirty_data_scenario(db, orders)
        print("  已生成多版本分配记录、人工修正、版本冻结、失败案例等脏数据")

        print("\n演示数据生成完成！")
        print("\n数据概览:")
        print(f"  - 审批单数量: {len(orders)}")
        print(f"  - 包含部门: 技术研发部、市场营销部、人力资源部、行政办公室、销售一/二部、产品运营部、财务管理部")
        print(f"  - 逾期天数: 0 ~ 30天")
        print(f"  - 优先级: critical, high, normal, low")
        print(f"  - 金额范围: 8,000 ~ 220,000元")
        print(f"  - 脏数据场景: 多版本分配覆盖、人工修正备注、版本冻结、预算超限失败")

    except Exception as e:
        print(f"错误: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
