import json
import csv
import sys
from datetime import datetime
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import (
    Owner, RenovationApplication, Inspection,
    DeductionRule, ProcessingRecord, RefundRecord
)


def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("=" * 60)
        print("开始初始化示例数据...")
        print("=" * 60)

        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        inspect_batch_id = f"BATCH_INSPECT_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        print(f"\n📋 装修申请批次号: {batch_id}")
        print(f"🔍 巡检批次号: {inspect_batch_id}")

        with open('sample_data/renovation_applications.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                room_number = row.get('房号', '').strip()
                if not room_number:
                    continue

                owner = db.query(Owner).filter(Owner.room_number == room_number).first()
                if not owner:
                    owner = Owner(
                        room_number=room_number,
                        owner_name=row.get('业主姓名', row.get('申请人', '未知')),
                        phone=f"138{hash(room_number) % 100000000:08d}"[:11],
                        deposit_amount=float(row.get('押金金额', 0) or 0)
                    )
                    db.add(owner)
                    db.flush()

                app = RenovationApplication(
                    batch_id=batch_id,
                    owner_id=owner.id,
                    room_number=room_number,
                    applicant_name=row.get('申请人', row.get('业主姓名', '')),
                    apply_date=row.get('申请日期', ''),
                    renovation_type=row.get('装修类型', ''),
                    contractor=row.get('施工单位', ''),
                    deposit_amount=float(row.get('押金金额', 0) or 0),
                    remark=row.get('备注', ''),
                    source_file='renovation_applications.csv'
                )
                db.add(app)
                print(f"  ✅ 装修申请: {room_number} - {row.get('装修类型', '')}")

        with open('sample_data/inspections.json', 'r', encoding='utf-8') as f:
            inspections_data = json.load(f)

        for item in inspections_data:
            room_number = item.get('room_number', '').strip()
            if not room_number:
                continue

            owner = db.query(Owner).filter(Owner.room_number == room_number).first()
            if not owner:
                owner = Owner(
                    room_number=room_number,
                    owner_name=item.get('owner_name', '未知')
                )
                db.add(owner)
                db.flush()

            application = db.query(RenovationApplication).filter(
                RenovationApplication.room_number == room_number
            ).order_by(RenovationApplication.created_at.desc()).first()

            violations = item.get('violations', [])
            inspection = Inspection(
                batch_id=inspect_batch_id,
                owner_id=owner.id,
                application_id=application.id if application else None,
                room_number=room_number,
                inspector=item.get('inspector', ''),
                inspect_date=item.get('inspect_date', ''),
                inspect_result=item.get('inspect_result', ''),
                violations=json.dumps(violations, ensure_ascii=False) if violations else '',
                rectification_required=item.get('rectification_required', False),
                remark=item.get('remark', ''),
                source_file='inspections.json'
            )
            db.add(inspection)
            print(f"  ✅ 巡检记录: {room_number} - {item.get('inspect_result', '')}")

        with open('sample_data/deduction_rules.json', 'r', encoding='utf-8') as f:
            rules_data = json.load(f)

        for item in rules_data:
            rule_code = item.get('rule_code', '').strip()
            if not rule_code:
                continue

            existing = db.query(DeductionRule).filter(DeductionRule.rule_code == rule_code).first()
            if existing:
                continue

            rule = DeductionRule(
                rule_code=rule_code,
                rule_name=item.get('rule_name', ''),
                violation_type=item.get('violation_type', ''),
                deduction_amount=float(item.get('deduction_amount', 0)),
                description=item.get('description', '')
            )
            db.add(rule)
            print(f"  ✅ 扣款规则: {rule_code} - {item.get('rule_name', '')}")

        db.commit()
        print(f"\n📊 数据导入完成！")

        print(f"\n{'=' * 60}")
        print("添加处理记录示例...")
        print(f"{'=' * 60}")

        app_a1002 = db.query(RenovationApplication).filter(
            RenovationApplication.room_number == "A栋1002"
        ).first()

        if app_a1002:
            record1 = ProcessingRecord(
                application_id=app_a1002.id,
                room_number="A栋1002",
                action_type="review",
                previous_status="pending",
                new_status="reviewing",
                reason="资料齐全，进入审核",
                processor="王主管",
                remark="初次审核"
            )
            db.add(record1)

            record2 = ProcessingRecord(
                application_id=app_a1002.id,
                room_number="A栋1002",
                action_type="returned",
                previous_status="reviewing",
                new_status="returned_for_revision",
                reason="巡检发现违规，需整改后提交复查",
                processor="张经理",
                remark="整改要求：恢复承重墙原状，清理消防通道"
            )
            db.add(record2)

            print(f"  ✅ A栋1002 处理记录: 审核 → 退回修改")

        app_b2001 = db.query(RenovationApplication).filter(
            RenovationApplication.room_number == "B栋2001"
        ).first()

        if app_b2001:
            record3 = ProcessingRecord(
                application_id=app_b2001.id,
                room_number="B栋2001",
                action_type="freeze",
                previous_status="pending",
                new_status="frozen",
                reason="巡检发现违规搭建阳光房，押金暂时冻结",
                processor="物业经理",
                remark="需业主拆除阳光房并恢复阳台配重墙后申请解冻"
            )
            db.add(record3)

            owner = db.query(Owner).filter(Owner.room_number == "B栋2001").first()
            if owner:
                owner.deposit_frozen = True

            print(f"  ✅ B栋2001 处理记录: 押金冻结")

        app_a1006 = db.query(RenovationApplication).filter(
            RenovationApplication.room_number == "A栋1006"
        ).first()

        if app_a1006:
            app_a1006.status = "approved"
            record4 = ProcessingRecord(
                application_id=app_a1006.id,
                room_number="A栋1006",
                action_type="approved",
                previous_status="pending",
                new_status="approved",
                reason="餐饮装修申请，已确认油烟净化设备安装计划",
                processor="物业审批组",
                remark="需施工单位提供油烟净化设备合格证"
            )
            db.add(record4)
            print(f"  ✅ A栋1006 处理记录: 审批通过")

        app_a1001 = db.query(RenovationApplication).filter(
            RenovationApplication.room_number == "A栋1001"
        ).first()

        if app_a1001:
            app_a1001.status = "completed"
            record5 = ProcessingRecord(
                application_id=app_a1001.id,
                room_number="A栋1001",
                action_type="completed",
                previous_status="approved",
                new_status="completed",
                reason="装修完成，验收合格，押金退还",
                processor="验收组",
                remark="退还押金5000元"
            )
            db.add(record5)

            refund1 = RefundRecord(
                refund_code="REFUND-2026-001",
                room_number="A栋1001",
                owner_name="张伟",
                refund_amount=5000,
                refund_reason="装修验收合格，退还押金",
                related_batch_id=batch_id,
                approval_status="approved",
                approver="财务组",
                approval_time=datetime.now()
            )
            db.add(refund1)
            print(f"  ✅ A栋1001 处理记录: 完成 + 退款记录")

        db.flush()

        refund1.is_duplicate = True
        refund1.remark = (refund1.remark or "") + f"\n重复退款检测: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 系统检测到相同退款单号"
        print(f"  ⚠️ 添加重复退款检测示例 (标记已存在的退款单)")

        db.commit()

        print(f"\n{'=' * 60}")
        print("初始化完成！汇总信息：")
        print(f"{'=' * 60}")
        print(f"  👤 业主总数: {db.query(Owner).count()}")
        print(f"  📋 装修申请总数: {db.query(RenovationApplication).count()}")
        print(f"  🔍 巡检记录总数: {db.query(Inspection).count()}")
        print(f"  📏 扣款规则总数: {db.query(DeductionRule).count()}")
        print(f"  📝 处理记录总数: {db.query(ProcessingRecord).count()}")
        print(f"  💰 退款记录总数: {db.query(RefundRecord).count()}")
        print(f"  ❄️ 押金冻结数: {db.query(Owner).filter(Owner.deposit_frozen == True).count()}")
        print(f"\n  📌 特别标注：A栋1002 需要人工修正（违规整改）")
        print(f"  📌 特别标注：B栋2001 押金已冻结")
        print(f"  📌 特别标注：REFUND-2026-001 存在重复退款")

    except Exception as e:
        db.rollback()
        print(f"\n❌ 初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

    print(f"\n启动服务请运行: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    print(f"API文档地址: http://localhost:8000/docs")


if __name__ == "__main__":
    seed_data()
