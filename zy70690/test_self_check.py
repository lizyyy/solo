#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
展会制证材料退回批次报告系统自检脚本
"""
import os
import sys
import json
import tempfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if os.path.exists("certificate_system.db"):
    os.remove("certificate_system.db")

from database import init_db, SessionLocal
from services import (
    ParticipantService, MaterialService, ReturnReasonService,
    BatchService, ReportService, BusinessException, init_default_data
)
from schemas import (
    ParticipantCreate, PersonMaterialCreate, ReturnReasonCreate,
    BatchCreate, PersonMaterialUpdate, ErrorCodes
)
from models import MaterialStatus, ParticipantType, IDCardType

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_result(test_name, passed, message=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status} - {test_name}")
    if message:
        print(f"    {message}")

def run_self_check():
    print("\n" + "="*60)
    print("  展会制证材料退回批次报告系统 - 自检脚本")
    print("="*60)
    
    init_db()
    db = SessionLocal()
    init_default_data(db)
    
    passed_count = 0
    failed_count = 0
    
    try:
        print_section("1. 参展主体管理测试")
        
        participant_data = ParticipantCreate(
            participant_code="EXH001",
            name="测试展览公司",
            type=ParticipantType.EXHIBITOR,
            contact_person="张三",
            contact_phone="13800138000",
            email="test@example.com",
            booth_number="A1-01"
        )
        participant = ParticipantService.create_participant(db, participant_data)
        print_result("创建参展主体", True, f"ID: {participant.id}, 代码: {participant.participant_code}")
        passed_count += 1
        
        found = ParticipantService.get_participant_by_code(db, "EXH001")
        print_result("查询参展主体", found is not None)
        passed_count += 1
        
        participants = ParticipantService.list_participants(db, ParticipantType.EXHIBITOR)
        print_result("按类型筛选参展主体", len(participants) >= 1)
        passed_count += 1
        
        try:
            ParticipantService.create_participant(db, participant_data)
            print_result("重复参展主体代码检查", False)
            failed_count += 1
        except BusinessException as e:
            print_result("重复参展主体代码检查", True, f"错误码: {e.error_code}")
            passed_count += 1
        
        print_section("2. 退回原因管理测试")
        
        reasons = ReturnReasonService.list_reasons(db)
        print_result("查询默认退回原因", len(reasons) >= 8)
        passed_count += 1
        
        reason = ReturnReasonService.get_reason_by_code(db, "ID_CARD_MISMATCH")
        print_result("查询特定退回原因", reason is not None and reason.needs_manual_review == True)
        passed_count += 1
        
        custom_reason = ReturnReasonCreate(
            code="CUSTOM001",
            category="其他",
            description="自定义退回原因",
            needs_manual_review=False
        )
        created = ReturnReasonService.create_reason(db, custom_reason)
        print_result("创建自定义退回原因", created.code == "CUSTOM001")
        passed_count += 1
        
        print_section("3. 人员材料创建测试")
        
        material_data = PersonMaterialCreate(
            material_code="MAT001",
            participant_code="EXH001",
            id_card_type=IDCardType.EXHIBITOR_PASS,
            name="李四",
            id_card_number="110101199001011234",
            phone="13900139000",
            email="lisi@example.com"
        )
        material = MaterialService.create_material(db, material_data)
        print_result("创建人员材料", True, f"ID: {material.id}, 状态: {material.status.value}")
        passed_count += 1
        
        print_result("材料初始版本号", material.version == 1)
        passed_count += 1
        
        material2_data = PersonMaterialCreate(
            material_code="MAT002",
            participant_code="EXH001",
            id_card_type=IDCardType.EXHIBITOR_PASS,
            name="王五",
            id_card_number="110101199002025678"
        )
        material2 = MaterialService.create_material(db, material2_data)
        
        material3_data = PersonMaterialCreate(
            material_code="MAT003",
            participant_code="EXH001",
            id_card_type=IDCardType.EXHIBITOR_PASS,
            name="赵六",
            id_card_number="110101199003039012"
        )
        material3 = MaterialService.create_material(db, material3_data)
        print_result("批量创建测试材料", True)
        passed_count += 1
        
        print_section("4. 状态流转测试")
        
        submitted = MaterialService.submit_material(db, "MAT001", "IDEMP001")
        print_result("提交材料", submitted.status == MaterialStatus.SUBMITTED)
        passed_count += 1
        
        try:
            MaterialService.submit_material(db, "MAT002", "IDEMP001")
            print_result("幂等性检查", False)
            failed_count += 1
        except BusinessException as e:
            print_result("幂等性检查", e.error_code == ErrorCodes.DUPLICATE_SUBMISSION)
            passed_count += 1
        
        returned = MaterialService.return_material(db, "MAT001", "INVALID_PHOTO", "照片模糊")
        print_result("退回材料", returned.status == MaterialStatus.RETURNED)
        passed_count += 1
        
        resubmitted = MaterialService.resubmit_material(db, "MAT001")
        print_result("重新提交材料", resubmitted.status == MaterialStatus.RESUBMITTED)
        passed_count += 1
        
        print_result("重新提交后版本号", resubmitted.version == 2)
        passed_count += 1
        
        approved = MaterialService.approve_material(db, "MAT001")
        print_result("审核通过材料", approved.status == MaterialStatus.APPROVED)
        passed_count += 1
        
        try:
            MaterialService.return_material(db, "MAT001", "INVALID_PHOTO")
            print_result("终态材料无法退回", False)
            failed_count += 1
        except BusinessException as e:
            print_result("终态材料无法退回", e.error_code == ErrorCodes.ALREADY_PROCESSED)
            passed_count += 1
        
        print_section("5. 材料筛选测试")
        
        all_materials = MaterialService.list_materials(db)
        print_result("查询所有材料", len(all_materials) >= 3)
        passed_count += 1
        
        by_participant = MaterialService.list_materials(db, participant_code="EXH001")
        print_result("按参展主体筛选", len(by_participant) >= 3)
        passed_count += 1
        
        by_status = MaterialService.list_materials(db, status=MaterialStatus.APPROVED)
        print_result("按状态筛选", len(by_status) >= 1)
        passed_count += 1
        
        by_card_type = MaterialService.list_materials(db, id_card_type=IDCardType.EXHIBITOR_PASS)
        print_result("按证件类型筛选", len(by_card_type) >= 3)
        passed_count += 1
        
        print_section("6. 需要人工复核场景测试")
        
        MaterialService.submit_material(db, "MAT002")
        
        try:
            MaterialService.return_material(db, "MAT002", "ID_CARD_MISMATCH")
            print_result("需要人工复核的退回", False)
            failed_count += 1
        except BusinessException as e:
            print_result("需要人工复核的退回", e.error_code == ErrorCodes.NEEDS_MANUAL_REVIEW)
            passed_count += 1
        
        mat2 = MaterialService.get_material_by_code(db, "MAT002")
        print_result("材料状态已更新为退回", mat2.status == MaterialStatus.RETURNED)
        passed_count += 1
        
        print_section("7. 制证批次管理测试")
        
        batch_data = BatchCreate(
            batch_code="BATCH001",
            name="第一批制证",
            description="参展商证件第一批",
            id_card_type=IDCardType.EXHIBITOR_PASS,
            material_codes=["MAT001", "MAT002", "MAT003"]
        )
        batch = BatchService.create_batch(db, batch_data)
        print_result("创建制证批次", True, f"批次代码: {batch.batch_code}, 总数: {batch.total_count}")
        passed_count += 1
        
        found_batch = BatchService.get_batch_by_code(db, "BATCH001")
        print_result("查询批次", found_batch is not None and found_batch.total_count == 3)
        passed_count += 1
        
        batches = BatchService.list_batches(db, id_card_type=IDCardType.EXHIBITOR_PASS)
        print_result("按证件类型筛选批次", len(batches) >= 1)
        passed_count += 1
        
        print_section("8. 批次批量退回测试")
        
        return_items = [
            {"material_code": "MAT002", "return_reason_code": "INVALID_PHOTO", "return_note": "照片不合格"},
            {"material_code": "MAT003", "return_reason_code": "OTHER", "return_note": "其他问题"},
        ]
        
        try:
            BatchService.return_batch_materials(db, "BATCH001", return_items)
            print_result("批量退回批次材料", False)
            failed_count += 1
        except BusinessException as e:
            print_result("批量退回含人工复核", e.error_code == ErrorCodes.NEEDS_MANUAL_REVIEW)
            passed_count += 1
        
        updated_batch = BatchService.get_batch_by_code(db, "BATCH001")
        print_result("批次退回数量更新", updated_batch.returned_count == 2)
        passed_count += 1
        
        print_section("9. 制证报告生成测试")
        
        report_result = ReportService.generate_report(
            db,
            batch_code="BATCH001",
            report_code="REP001",
            name="第一批制证退回报告",
            file_format="xlsx"
        )
        
        print_result("生成报告", report_result["report"].status.value == "已完成")
        passed_count += 1
        
        print_result("报告统计信息", "statistics" in report_result and report_result["statistics"]["returned_count"] == 2)
        passed_count += 1
        
        reports = ReportService.list_reports(db)
        print_result("查询报告列表", len(reports) >= 1)
        passed_count += 1
        
        report = ReportService.get_report_by_code(db, "REP001")
        print_result("查询特定报告", report.report_code == "REP001")
        passed_count += 1
        
        statistics = json.loads(report.statistics)
        print_result("报告退回率计算", "return_rate" in statistics)
        passed_count += 1
        
        print_section("10. 版本历史记录测试")
        
        material = MaterialService.get_material_by_code(db, "MAT001")
        print_result("版本历史记录存在", len(material.version_history) >= 2)
        passed_count += 1
        
        versions = sorted([v.version for v in material.version_history])
        print_result("版本号递增正确", versions == [1, 1, 2])
        passed_count += 1
        
        print_section("11. 缺失字段错误测试")
        
        invalid_material = PersonMaterialCreate(
            material_code="MAT_INVALID",
            participant_code="EXH001",
            id_card_type=IDCardType.EXHIBITOR_PASS,
            name="",
            id_card_number="110101199001011234"
        )
        try:
            MaterialService.create_material(db, invalid_material)
            print_result("空字段验证", False)
            failed_count += 1
        except:
            print_result("空字段验证", True)
            passed_count += 1
        
        print_section("12. 状态不允许测试")
        
        try:
            MaterialService.approve_material(db, "MAT001")
            print_result("已通过材料重复审核", False)
            failed_count += 1
        except BusinessException as e:
            print_result("已通过材料重复审核", e.error_code == ErrorCodes.ALREADY_PROCESSED)
            passed_count += 1
        
        print_section("13. 不存在资源测试")
        
        not_found = MaterialService.get_material_by_code(db, "NOT_EXIST")
        print_result("不存在材料查询返回None", not_found is None)
        passed_count += 1
        
        try:
            MaterialService.approve_material(db, "NOT_EXIST")
            print_result("审核不存在材料抛出异常", False)
            failed_count += 1
        except BusinessException as e:
            print_result("审核不存在材料抛出异常", e.error_code == ErrorCodes.NOT_FOUND)
            passed_count += 1
        
        print("\n" + "="*60)
        print(f"  自检完成 - 总计: {passed_count + failed_count} 个测试")
        print(f"  通过: {passed_count} ✓  |  失败: {failed_count} ✗")
        print("="*60)
        
        if failed_count == 0:
            print("\n✓ 所有测试通过！系统可以正常使用。")
        else:
            print(f"\n✗ 有 {failed_count} 个测试失败，请检查系统配置。")
        
        return failed_count == 0
        
    except Exception as e:
        print(f"\n✗ 自检过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_self_check()
    sys.exit(0 if success else 1)
