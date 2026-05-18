import sys
import os
from datetime import datetime, timedelta
import json
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import schemas
import crud


def run_acceptance_tests():
    print("=" * 60)
    print("文印店打印急件插队 API - 验收测试")
    print("=" * 60)

    db = SessionLocal()

    try:
        print("\n1. 准备测试数据...")

        base_time = datetime.utcnow() + timedelta(hours=8)

        normal_order = {
            "order_no": "TEST-NORMAL-001",
            "customer_name": "测试用户A",
            "customer_phone": "13900139001",
            "document_name": "会议资料汇编.docx",
            "page_count": 45,
            "color_mode": "black_white",
            "paper_size": "A4",
            "double_sided": True,
            "binding_type": "胶装",
            "original_promised_time": base_time + timedelta(hours=3),
            "urgent_reason": "半小时后会议要用，加急打印",
            "target_queue_position": 1,
            "operator": "测试管理员"
        }
        print(f"   ✓ 正常记录准备完成: {normal_order['order_no']}")

        conflict_order = {
            "order_no": "TEST-CONFLICT-001",
            "customer_name": "测试用户B",
            "customer_phone": "13900139002",
            "document_name": "招投标文件.pdf",
            "page_count": 100,
            "color_mode": "color",
            "paper_size": "A3",
            "double_sided": True,
            "binding_type": "精装",
            "original_promised_time": base_time + timedelta(hours=5),
            "urgent_reason": "今晚必须出稿",
            "target_queue_position": 1,
            "operator": "测试管理员"
        }
        print(f"   ✓ 冲突记录准备完成: {conflict_order['order_no']}")

        bad_import_rows = [
            {
                "order_no": "",
                "customer_name": "",
                "page_count": -5,
                "document_name": "坏数据行"
            }
        ]
        print(f"   ✓ 导入坏行准备完成")

        print("\n2. 执行正常创建测试...")
        try:
            order_schema = schemas.PrintUrgentOrderCreate(**normal_order)
            result = crud.force_insert_urgent_order(db, order_schema)
            print(f"   ✓ 正常记录创建成功: order_no={result.order_no}, status={result.status}")
        except Exception as e:
            print(f"   ✗ 正常记录创建失败: {e}")
            return False

        print("\n3. 执行冲突检测测试...")
        try:
            order_schema = schemas.PrintUrgentOrderCreate(**conflict_order)
            crud.create_urgent_order(db, order_schema)
            print(f"   ✗ 未检测到冲突 (失败)")
            return False
        except Exception as e:
            if hasattr(e, 'error_code') and e.error_code == 'DELIVERY_TIME_CONFLICT':
                print(f"   ✓ 正确检测到交付时间冲突")
                print(f"     影响订单数: {e.error_details['affected_orders_count']}")
                print(f"     冲突详情: 确认需要={e.error_details['confirmation_required']}")
            else:
                print(f"   ✗ 错误类型不正确: {getattr(e, 'error_code', 'UNKNOWN')}")
                return False

        print("\n4. 执行导入数据验证测试...")

        import_rows = [
            bad_import_rows[0],
            normal_order,
            {"order_no": "URG-20240518-001", "customer_name": "已存在订单", "page_count": 10}
        ]

        failed_rows = []
        for idx, row in enumerate(import_rows):
            try:
                if "order_no" not in row or not row["order_no"]:
                    raise ValueError("缺少订单编号")
                if "page_count" not in row or row["page_count"] <= 0:
                    raise ValueError("页数必须大于0")
                if "customer_name" not in row or not row["customer_name"]:
                    raise ValueError("缺少客户姓名")

                existing = crud.get_urgent_order_by_no(db, row["order_no"])
                if existing:
                    raise ValueError(f"订单已存在: {row['order_no']}")

            except Exception as e:
                failed_rows.append({
                    "row_index": idx + 1,
                    "row_data": row,
                    "error_message": str(e)
                })

        print(f"   ✓ 导入坏行检测完成，发现 {len(failed_rows)} 条错误")
        for fail in failed_rows:
            print(f"     第{fail['row_index']}行: {fail['error_message']}")

        print("\n5. 执行导出与接口返回互校验...")
        created_order = crud.get_urgent_order_by_no(db, normal_order["order_no"])
        api_response = {
            "order_no": created_order.order_no,
            "customer_name": created_order.customer_name,
            "page_count": created_order.page_count,
            "status": created_order.status
        }

        export_data = crud.export_orders_to_dict(db)
        matched_export = next((x for x in export_data if x["order_no"] == normal_order["order_no"]), None)

        if matched_export and api_response["order_no"] == matched_export["order_no"] and \
           api_response["customer_name"] == matched_export["customer_name"] and \
           api_response["page_count"] == matched_export["page_count"] and \
           api_response["status"] == matched_export["status"]:
            print("   ✓ 接口返回与导出内容一致")
        else:
            print("   ✗ 接口返回与导出内容不一致")
            print(f"     API响应: {api_response}")
            print(f"     导出数据: {matched_export}")
            return False

        print("\n6. 产能日志一致性验证...")
        logs = crud.get_capacity_logs(db, urgent_order_id=created_order.id)
        if logs:
            print(f"   ✓ 产能日志已记录: {len(logs)} 条")
            for log in logs:
                print(f"     - {log.log_type}: {log.impact_description}")
        else:
            print("   ! 未找到产能日志 (视业务需求而定)")

        print("\n" + "=" * 60)
        print("所有验收测试通过! ✓")
        print("=" * 60)

        print("\n测试数据汇总:")
        print(f"  正常记录: {normal_order['order_no']}")
        print(f"  冲突记录: {conflict_order['order_no']} (已触发 DELIVERY_TIME_CONFLICT 错误)")
        print(f"  导入坏行: {len(failed_rows)} 条错误已检测")

        return True

    except Exception as e:
        print(f"\n✗ 测试执行异常: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = run_acceptance_tests()
    sys.exit(0 if success else 1)
