#!/usr/bin/env python3
import os
import sys
import time
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import (
    Batch,
    BatchStatus,
    MaterialType,
    IdempotencyStrategy,
    TaskStatus,
    TaskType,
)
from app.schemas import BatchCreate, VisitorRecordUpdate
from app.services import (
    BatchService,
    MaterialService,
    VisitorService,
    TaskService,
    MaterialParser,
    ReportService,
    VisitorStateMachine,
)


def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_step(step, description):
    print(f"\n[{step}] {description}")
    print("-" * 60)


def demo_workflow():
    db = SessionLocal()
    
    try:
        print_header("园区访客通行异常回执状态机 - 完整演示流程")
        
        sample_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "sample"
        )
        
        print_step("1", "创建批次 - 2024年5月第三周访客异常处理")
        batch_data = BatchCreate(
            name="2024年5月第三周访客异常处理批次",
            description="处理5月15日-5月21日的访客超时、车牌识别异常等问题",
            idempotency_key="WEEK-2024-W20-VISITOR",
            idempotency_strategy=IdempotencyStrategy.APPEND,
            created_by="操作员_张小明",
        )
        batch, action = BatchService.create_batch(db, batch_data)
        print(f"批次创建成功! 操作类型: {action}")
        print(f"  批次ID: {batch.id}")
        print(f"  批次编号: {batch.batch_number}")
        print(f"  当前状态: {batch.status}")
        print(f"  创建人: {batch.created_by}")
        
        print_step("2", "上传材料 - 访客预约表")
        visitor_file = os.path.join(sample_dir, "visitor_appointment.xlsx")
        with open(visitor_file, "rb") as f:
            content = f.read()
        
        material1, status = MaterialService.upload_material(
            db,
            batch_id=batch.id,
            material_type=MaterialType.VISITOR_APPOINTMENT,
            file_name="visitor_appointment.xlsx",
            file_content=content,
            uploaded_by="操作员_张小明",
        )
        print(f"材料上传: {status}")
        print(f"  材料ID: {material1.id}")
        print(f"  文件名: {material1.file_name}")
        print(f"  批次状态: {batch.status}")
        
        print_step("3", "上传材料 - 闸机记录")
        gate_file = os.path.join(sample_dir, "gate_record.xlsx")
        with open(gate_file, "rb") as f:
            content = f.read()
        
        material2, status = MaterialService.upload_material(
            db,
            batch_id=batch.id,
            material_type=MaterialType.GATE_RECORD,
            file_name="gate_record.xlsx",
            file_content=content,
            uploaded_by="操作员_张小明",
        )
        print(f"材料上传: {status}")
        print(f"  材料ID: {material2.id}")
        print(f"  文件名: {material2.file_name}")
        print(f"  批次状态: {batch.status}")
        
        print_step("4", "上传材料 - 手工改价表")
        price_file = os.path.join(sample_dir, "manual_price_adjustment.xlsx")
        with open(price_file, "rb") as f:
            content = f.read()
        
        material3, status = MaterialService.upload_material(
            db,
            batch_id=batch.id,
            material_type=MaterialType.MANUAL_PRICE_ADJUSTMENT,
            file_name="manual_price_adjustment.xlsx",
            file_content=content,
            uploaded_by="操作员_张小明",
        )
        print(f"材料上传: {status}")
        print(f"  材料ID: {material3.id}")
        print(f"  文件名: {material3.file_name}")
        
        print_step("5", "解析材料 - 访客预约表")
        records1, metadata1 = MaterialParser.parse_material(
            MaterialType.VISITOR_APPOINTMENT, material1.file_path
        )
        count1 = VisitorService.bulk_create_records(
            db, batch.id, material1.id, records1, "操作员_张小明"
        )
        MaterialService.mark_parsed(db, material1.id)
        print(f"解析完成! 导入记录: {count1}条")
        print(f"  总行数: {metadata1.get('total_rows')}")
        
        print_step("6", "解析材料 - 闸机记录")
        records2, metadata2 = MaterialParser.parse_material(
            MaterialType.GATE_RECORD, material2.file_path
        )
        count2 = VisitorService.bulk_create_records(
            db, batch.id, material2.id, records2, "操作员_张小明"
        )
        MaterialService.mark_parsed(db, material2.id)
        print(f"解析完成! 导入记录: {count2}条")
        overstay = sum(1 for r in records2 if r.get("is_overstay"))
        print(f"  超时记录: {overstay}条")
        
        print_step("7", "解析材料 - 手工改价表")
        records3, metadata3 = MaterialParser.parse_material(
            MaterialType.MANUAL_PRICE_ADJUSTMENT, material3.file_path
        )
        count3 = VisitorService.bulk_create_records(
            db, batch.id, material3.id, records3, "操作员_张小明"
        )
        MaterialService.mark_parsed(db, material3.id)
        print(f"解析完成! 导入记录: {count3}条")
        
        print_step("8", "提交复核 - 进入审核状态")
        batch, state_change, error = BatchService.change_state(
            db,
            batch.id,
            BatchStatus.UNDER_REVIEW,
            "操作员_张小明",
            "材料上传解析完成，提交审核",
        )
        print(f"状态变更成功!")
        print(f"  从状态: {state_change.from_status}")
        print(f"  到状态: {state_change.to_status}")
        print(f"  变更原因: {state_change.reason}")
        
        print_step("9", "人工复核 - 修正超时记录")
        records, total = VisitorService.list_visitor_records(
            db, batch_id=batch.id, is_overstay=True, limit=100
        )
        print(f"发现超时记录: {len(records)}条")
        
        for i, record in enumerate(records[:3]):
            update = VisitorRecordUpdate(
                review_status="已复核",
                review_comment=f"已核实，访客为长期合作单位人员，予以豁免",
                reviewed_by="审核员_李主管",
                is_overstay=False,
            )
            updated = VisitorService.update_visitor_record(
                db, record.id, update, "审核员_李主管"
            )
            print(f"  修正记录 {i+1}: {record.visitor_name} ({record.license_plate})")
        
        print_step("10", "触发坏数据 - 创建失败的异步任务")
        bad_task = TaskService.create_task(
            db,
            task_type=TaskType.PARSE_MATERIAL,
            batch_id=batch.id,
            parameters={"material_id": 99999, "force_fail": True},
            created_by="系统自动",
            max_retries=2,
        )
        print(f"创建失败任务: ID={bad_task.id}")
        
        for i in range(3):
            TaskService.fail_task(
                db,
                bad_task.id,
                f"模拟失败 - 尝试 {i+1}/3: 材料不存在或格式错误",
                "Traceback (most recent call last):\n  ...\nValueError: Material not found",
            )
            db.refresh(bad_task)
            if bad_task.status == TaskStatus.WAITING_MANUAL.value:
                break
        
        db.refresh(bad_task)
        print(f"任务状态: {bad_task.status}")
        print(f"重试次数: {bad_task.retry_count}")
        print(f"最后错误: {bad_task.last_error[:50]}...")
        
        print_step("11", "人工处理失败任务 - 手动标记完成")
        resolved_task = TaskService.manual_resolve(
            db,
            bad_task.id,
            resolved_by="系统管理员_老王",
            resolution="材料ID错误，已核实无需再次解析，直接标记完成",
            result={"manual_fix": True, "verified": True},
        )
        print(f"任务人工处理完成!")
        print(f"  处理人: {resolved_task.result.get('manual_resolved_by')}")
        print(f"  处理方案: {resolved_task.result.get('resolution')}")
        print(f"  当前状态: {resolved_task.status}")
        
        print_step("12", "审核通过 - 进入待结算状态")
        batch, state_change, error = BatchService.change_state(
            db,
            batch.id,
            BatchStatus.REVIEW_PASSED,
            "审核员_李主管",
            "异常记录已复核完成，共修正3条超时记录，豁免处理",
        )
        print(f"状态变更成功!")
        print(f"  到状态: {state_change.to_status}")
        print(f"  变更人: {state_change.changed_by}")
        
        print_step("13", "临时冻结 - 发现跨天权限问题需要复查")
        batch, state_change, error = BatchService.change_state(
            db,
            batch.id,
            BatchStatus.FROZEN,
            "安保主管_王大队",
            "临时冻结 - 跨天后权限回收情况不明确，需要进一步核实",
        )
        print(f"批次已冻结!")
        print(f"  冻结原因: {state_change.reason}")
        print(f"  冻结时间: {state_change.changed_at}")
        
        print_step("14", "冻结后复查 - 核实权限回收记录")
        freeze_info = VisitorStateMachine.get_freeze_info(db, batch.id)
        print(f"冻结信息:")
        print(f"  冻结前状态: {freeze_info['status_before_freeze']}")
        print(f"  冻结次数: {freeze_info['freeze_count']}")
        
        time.sleep(0.5)
        
        print_step("15", "解冻并结算 - 权限核实完成")
        batch, state_change, error = BatchService.change_state(
            db,
            batch.id,
            BatchStatus.SETTLED,
            "安保主管_王大队",
            "已核实所有跨天访客权限均已正常回收，解除冻结并完成结算",
        )
        print(f"结算完成!")
        print(f"  解冻后状态: {state_change.to_status}")
        print(f"  结算时间: {batch.settled_at}")
        
        print_step("16", "生成安保主管专用报告")
        report = ReportService.generate_security_supervisor_report(
            db, batch.id, "安保主管_王大队"
        )
        print(f"报告生成完成!")
        print(f"  批次名称: {report['batch_name']}")
        print(f"  冻结前状态: {report['status_before_freeze']}")
        print(f"  冻结后状态: {report['status_after_freeze']}")
        print(f"  总访客数: {report['total_visitors']}")
        print(f"  超时记录: {report['overstay_count']}")
        print(f"  人工调整: {report['manual_adjustment_count']}条")
        print(f"  冻结原因: {report['freeze_reason']}")
        
        print_step("17", "导出Excel报告")
        filename = ReportService.export_to_excel(
            db,
            {
                "batch_ids": [batch.id],
                "include_state_history": True,
                "include_audit_logs": True,
                "exported_by": "安保主管_王大队",
            },
        )
        export_path = os.path.join("data", "exports", filename)
        print(f"Excel报告导出成功!")
        print(f"  文件名: {filename}")
        print(f"  路径: {export_path}")
        
        print_step("18", "测试幂等性 - 使用相同key再次创建批次")
        batch_dup, action = BatchService.create_batch(db, batch_data)
        print(f"幂等性测试结果:")
        print(f"  操作类型: {action} (预期: appended)")
        print(f"  返回批次ID: {batch_dup.id}")
        print(f"  与原批次相同: {batch_dup.id == batch.id}")
        
        print_step("19", "撤回归档 - 完成最终归档")
        batch, state_change, error = BatchService.change_state(
            db,
            batch.id,
            BatchStatus.ARCHIVED,
            "系统管理员_老王",
            "批次处理完成，所有记录已核实，归档保存",
        )
        print(f"归档完成!")
        print(f"  最终状态: {state_change.to_status}")
        print(f"  归档时间: {batch.archived_at}")
        
        print_step("20", "状态历史审计")
        state_history = VisitorStateMachine.get_state_history(db, batch.id)
        print(f"状态变更历史 (共{len(state_history)}次):")
        for i, sc in enumerate(state_history, 1):
            from_s = sc.get('from_status') or '初始'
            print(f"  {i}. {from_s:20s} -> {sc['to_status']:20s} | {sc['changed_by']:15s} | {sc['reason']}")
        
        print_header("演示流程完成!")
        print("主要功能验证:")
        print("  ✓ 批次创建与幂等处理")
        print("  ✓ 材料上传与解析")
        print("  ✓ 状态机流转 (创建->上传->审核->通过->冻结->结算->归档)")
        print("  ✓ 超时记录人工修正")
        print("  ✓ 异步任务失败与人工处理")
        print("  ✓ 冻结/解冻机制")
        print("  ✓ 安保主管专用报告")
        print("  ✓ Excel报告导出")
        print("  ✓ 状态历史审计")
        
    except Exception as e:
        print(f"\n❌ 演示过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    demo_workflow()
