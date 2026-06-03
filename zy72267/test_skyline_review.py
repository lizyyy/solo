#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services import (
    DataStore,
    ImportService,
    SelfCheckService,
    ReviewService,
    ExportService,
)
from models import ReviewStatus, ReviewIssue, AuditAction


def print_test_header(name):
    print("\n" + "=" * 60)
    print(f"🧪 测试: {name}")
    print("=" * 60)


def print_result(passed, message):
    if passed:
        print(f"✅ PASS: {message}")
    else:
        print(f"❌ FAIL: {message}")


def reset_data_store():
    import os
    data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "skyline_review_data.json")
    if os.path.exists(data_file):
        os.remove(data_file)
    
    data_store = DataStore()
    data_store._point_cloud_logs = {}
    data_store._coordinate_tables = {}
    data_store._photo_points = {}
    data_store._safety_radius_tables = {}
    data_store._review_records = {}
    data_store._occlusion_lists = {}
    data_store._audit_logs = []


def test_1_duplicate_import_detection():
    """测试1: 重复导入检测"""
    print_test_header("重复导入检测")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    
    pc_log1, is_dup1, dup_of1 = import_service.import_point_cloud_log(
        "test_pc_1.csv", pc_content, "小陶"
    )
    print_result(not is_dup1, f"第一次导入正常，批次号: {pc_log1.batch_id}")
    
    pc_log2, is_dup2, dup_of2 = import_service.import_point_cloud_log(
        "test_pc_1_copy.csv", pc_content, "小陶"
    )
    print_result(is_dup2, f"第二次导入相同内容检测为重复，重复批次: {dup_of2}")
    print_result(dup_of2 == pc_log1.batch_id, "正确识别重复的源批次")
    
    return pc_log1.batch_id


def test_2_photo_has_point_missing_coordinate():
    """测试2: 照片有点位但坐标表缺一行检测"""
    print_test_header("照片有点位但坐标表缺一行检测")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0
P004,130.0,230.0,330.0"""
    
    pc_log, is_dup, _ = import_service.import_point_cloud_log(
        "test_pc_2.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
        {"point_id": "P003", "photo_id": "PHOTO_002", "x_in_photo": 80, "y_in_photo": 180},
        {"point_id": "P004", "photo_id": "PHOTO_002", "x_in_photo": 120, "y_in_photo": 220},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    import_service.import_coordinate_table(batch_id, "coord_2.csv", coord_content, "小陶")
    
    issues = self_check_service.check_missing_coordinates(batch_id, "小陶")
    
    print_result(len(issues) == 1, f"检测到 {len(issues)} 个缺失坐标，预期1个")
    if issues:
        missing_point = issues[0]
        print_result(missing_point["point_id"] == "P004", f"正确识别缺失点位: {missing_point['point_id']}")
        print_result(missing_point["needs_safety_review"] == True, "标记为需要安全员复核")
        print_result("original_line_number" in missing_point, "保留原始行号信息")
        print_result("point_cloud_coordinates" in missing_point, "保留点云坐标信息")
    
    review = data_store.get_review_record(batch_id, "P004")
    print_result(review is not None, "复核记录已创建")
    if review:
        print_result(
            ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE in review.issues,
            "复核记录中添加了'照片有点位但坐标表缺一行'问题标签"
        )
        print_result(
            review.status == ReviewStatus.PHOTO_HAS_POINT_NO_COORDINATE,
            f"状态正确设置为: {review.status.value}"
        )
    
    return batch_id


def test_3_supplement_and_recalculate():
    """测试3: 补录坐标后重算"""
    print_test_header("补录坐标后重算")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    review_service = ReviewService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_3.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0"""
    import_service.import_coordinate_table(batch_id, "coord_3.csv", coord_content, "小陶")
    
    self_check_service.check_missing_coordinates(batch_id, "小陶")
    
    review_before = data_store.get_review_record(batch_id, "P002")
    print_result(
        ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE in review_before.issues,
        "补录前：P002有坐标缺失问题"
    )
    print_result(
        review_before.status == ReviewStatus.PHOTO_HAS_POINT_NO_COORDINATE,
        "补录前：状态为'照片有标记但坐标表缺行'"
    )
    
    result = review_service.supplement_coordinate(
        batch_id, "P002", 110.0, 210.0, 310.0, "小陶"
    )
    
    print_result(result is not None, "补录成功")
    
    coord = result.get("coordinate")
    print_result(coord is not None and coord.get("is_supplemented") == True, "坐标标记为补录")
    print_result(coord.get("supplemented_by") == "小陶", "记录补录人")
    
    review_after = data_store.get_review_record(batch_id, "P002")
    print_result(
        ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE not in review_after.issues,
        "补录后：坐标缺失问题已移除"
    )
    print_result(
        ReviewIssue.SUPPLEMENTED_COORDINATE in review_after.issues,
        "补录后：添加了'坐标为补录'问题标签"
    )
    print_result(
        review_after.status == ReviewStatus.COORDINATE_SUPPLEMENTED,
        f"补录后：状态更新为'{review_after.status.value}'"
    )
    
    audit_logs = data_store.get_audit_logs(batch_id, "P002")
    supplement_logs = [l for l in audit_logs if l.action == AuditAction.SUPPLEMENT_COORDINATE]
    print_result(len(supplement_logs) > 0, "补录操作已记录审计日志")
    recalc_logs = [l for l in audit_logs if l.action == AuditAction.RECALCULATE]
    print_result(len(recalc_logs) > 0, "补录后自动触发重算并记录日志")
    
    return batch_id


def test_4_three_step_workflow():
    """测试4: 三步业务流程完整走通"""
    print_test_header("三步业务流程完整走通")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    review_service = ReviewService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_4.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    print_result(len(pc_log.records) == 3, "第一步：导入点云抽稀日志成功，共3条记录")
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
        {"point_id": "P003", "photo_id": "PHOTO_002", "x_in_photo": 80, "y_in_photo": 180},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    import_service.import_coordinate_table(batch_id, "coord_4.csv", coord_content, "小陶")
    
    safety_data = [
        {"point_id": "P001", "building_name": "A座", "safety_radius": 15.0, "measured_distance": 20.0},
        {"point_id": "P002", "building_name": "A座", "safety_radius": 15.0, "measured_distance": 10.0},
        {"point_id": "P003", "building_name": "A座", "safety_radius": 15.0, "measured_distance": 25.0},
    ]
    safety_table = review_service.check_safety_radius(batch_id, safety_data, "小陶")
    print_result(len(safety_table.records) == 3, "第二步：补看安全半径表成功，共3条记录")
    
    review_p002 = data_store.get_review_record(batch_id, "P002")
    print_result(
        ReviewIssue.SAFETY_RADIUS_VIOLATION in review_p002.issues,
        "P002实测距离10m < 安全半径15m，自动标记安全半径不满足"
    )
    print_result(
        review_p002.status == ReviewStatus.SAFETY_CHECKED,
        f"P002状态更新为'{review_p002.status.value}'"
    )
    
    occlusion_data = [
        {"point_id": "P001", "occlusion_type": "天际线遮挡", "description": "遮挡城市天际线观测点1", "is_confirmed": True},
        {"point_id": "P003", "occlusion_type": "建筑物遮挡", "description": "被B座写字楼遮挡", "is_confirmed": True},
    ]
    occlusion_list = review_service.update_occlusion_list(batch_id, occlusion_data, "小陶")
    print_result(len(occlusion_list.records) == 2, "第三步：更新遮挡点清单成功，共2条记录")
    
    review_p001 = data_store.get_review_record(batch_id, "P001")
    print_result(
        review_p001.status == ReviewStatus.OCCLUSION_UPDATED,
        f"P001状态更新为'{review_p001.status.value}'"
    )
    
    workflow = review_service.get_review_workflow_status(batch_id)
    print_result(workflow["step1_import_done"] == True, "工作流状态：第一步已完成")
    print_result(workflow["step2_safety_check_done"] == True, "工作流状态：第二步已完成")
    print_result(workflow["step3_occlusion_update_done"] == True, "工作流状态：第三步已完成")
    
    return batch_id


def test_5_safety_review_not_auto_normal():
    """测试5: 照片有点位但坐标表缺一行的记录不会自动归正常，留给安全员复核"""
    print_test_header("照片有点位但坐标表缺一行需安全员复核")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    review_service = ReviewService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_5.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0"""
    import_service.import_coordinate_table(batch_id, "coord_5.csv", coord_content, "小陶")
    
    self_check_service.check_missing_coordinates(batch_id, "小陶")
    
    review_before = data_store.get_review_record(batch_id, "P002")
    print_result(
        review_before.status == ReviewStatus.PHOTO_HAS_POINT_NO_COORDINATE,
        "安全员复核前：状态为'照片有标记但坐标表缺行'"
    )
    print_result(
        ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE in review_before.issues,
        "安全员复核前：带有坐标缺行问题标签"
    )
    
    workflow = review_service.get_review_workflow_status(batch_id)
    print_result(
        workflow["pending_safety_review_count"] >= 1,
        f"工作流统计：待安全员复核数量为{workflow['pending_safety_review_count']}"
    )
    
    result = review_service.safety_review(
        batch_id, "P002", True, "已核对原始照片，坐标确实存在，补录正确", "安全员老王"
    )
    print_result(result is not None, "安全员复核操作成功")
    
    review_after = data_store.get_review_record(batch_id, "P002")
    print_result(
        review_after.status == ReviewStatus.NORMAL,
        f"安全员复核通过后：状态更新为'{review_after.status.value}'"
    )
    print_result(
        review_after.safety_reviewed_by == "安全员老王",
        "记录安全员复核人信息"
    )
    print_result(
        review_after.safety_reviewed_at is not None,
        "记录安全员复核时间"
    )
    print_result(
        review_after.remarks == "已核对原始照片，坐标确实存在，补录正确",
        "记录复核备注"
    )
    
    audit_logs = data_store.get_audit_logs(batch_id, "P002")
    review_logs = [l for l in audit_logs if l.action == AuditAction.SAFETY_REVIEW_APPROVE]
    print_result(len(review_logs) > 0, "安全员复核操作已记录审计日志")
    
    return batch_id


def test_6_single_source_of_truth():
    """测试6: 明细、页面展示、接口返回读同一份结果"""
    print_test_header("明细、页面展示、接口返回读同一份结果")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    export_service = ExportService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_6.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0"""
    import_service.import_coordinate_table(batch_id, "coord_6.csv", coord_content, "小陶")
    
    self_check_service.check_missing_coordinates(batch_id, "小陶")
    
    detail = data_store.get_point_detail(batch_id, "P002")
    summary = data_store.get_batch_summary(batch_id)
    export_data = export_service.export_details(batch_id)
    export_point = next((r for r in export_data["records"] if r["point_id"] == "P002"), None)
    
    print_result(
        detail["review"].status.value == export_point["review"].status.value,
        "明细和导出的状态一致"
    )
    print_result(
        [i.value for i in detail["review"].issues] == [i.value for i in export_point["review"].issues],
        "明细和导出的问题标签一致"
    )
    print_result(
        detail["point_cloud_log"]["original_line_number"] == export_point["point_cloud_log"]["original_line_number"],
        "明细和导出的原始行号一致"
    )
    print_result(
        summary["total_points"] == export_data["summary"]["total_points"],
        "页面汇总和导出汇总的总点数一致"
    )
    print_result(
        summary["issue_summary"].get("照片有点位但坐标表缺一行", 0) == 
        export_data["summary"]["issue_distribution"].get("照片有点位但坐标表缺一行", 0),
        "页面汇总和导出汇总的问题统计一致"
    )
    
    consistency_result = export_service.check_export_consistency(batch_id, "小陶")
    print_result(
        consistency_result["is_consistent"] == True,
        "导出一致性检查通过"
    )
    
    return batch_id


def test_7_manual_modification_audit_trail():
    """测试7: 人工改动保留完整审计痕迹"""
    print_test_header("人工改动保留完整审计痕迹")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    review_service = ReviewService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_7.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    pc_record_before = next((r for r in pc_log.records if r.point_id == "P001"), None)
    original_x, original_y, original_z = pc_record_before.x, pc_record_before.y, pc_record_before.z
    original_line_number = pc_record_before.original_line_number
    
    result = review_service.manually_modify_point_cloud(
        batch_id, "P001", 100.5, 200.5, 300.5,
        "现场复核发现坐标偏移0.5米，已校正", "小陶"
    )
    
    print_result(result is not None, "人工修改成功")
    
    pc_log_after = data_store.get_point_cloud_log(batch_id)
    pc_record_after = next((r for r in pc_log_after.records if r.point_id == "P001"), None)
    print_result(pc_record_after.is_manually_modified == True, "标记为人工修改")
    print_result(pc_record_after.original_x == original_x, "保存修改前X坐标")
    print_result(pc_record_after.original_y == original_y, "保存修改前Y坐标")
    print_result(pc_record_after.original_z == original_z, "保存修改前Z坐标")
    print_result(pc_record_after.x == 100.5, "修改后X坐标正确")
    print_result(pc_record_after.original_line_number == original_line_number, "原始行号保留不变")
    
    review = data_store.get_review_record(batch_id, "P001")
    print_result(
        ReviewIssue.MANUAL_MODIFICATION in review.issues,
        "复核记录添加了'人工改动过'问题标签"
    )
    
    detail = data_store.get_point_detail(batch_id, "P001")
    print_result(
        detail["point_cloud_log"]["is_manually_modified"] == True,
        "点详情显示人工修改标记"
    )
    print_result(
        detail["point_cloud_log"]["original_x"] == original_x,
        "点详情显示修改前X坐标"
    )
    
    audit_logs = data_store.get_audit_logs(batch_id, "P001")
    modify_logs = [l for l in audit_logs if l.action == AuditAction.MANUAL_MODIFY]
    print_result(len(modify_logs) > 0, "人工修改操作已记录审计日志")
    if modify_logs:
        log = modify_logs[0]
        print_result(log.original_line_number == original_line_number, "审计日志记录原始行号")
        print_result("x=" in str(log.original_value), "审计日志记录原值")
        print_result("x=100.5" in str(log.new_value), "审计日志记录新值")
    
    return batch_id


def test_8_export_consistency_check():
    """测试8: 导出一致性检查功能"""
    print_test_header("导出一致性检查")
    
    reset_data_store()
    data_store = DataStore()
    import_service = ImportService()
    export_service = ExportService()
    
    pc_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    
    pc_log, _, _ = import_service.import_point_cloud_log(
        "test_pc_8.csv", pc_content, "小陶"
    )
    batch_id = pc_log.batch_id
    
    photo_points = [
        {"point_id": "P001", "photo_id": "PHOTO_001", "x_in_photo": 100, "y_in_photo": 200},
        {"point_id": "P002", "photo_id": "PHOTO_001", "x_in_photo": 150, "y_in_photo": 250},
        {"point_id": "P003", "photo_id": "PHOTO_002", "x_in_photo": 80, "y_in_photo": 180},
    ]
    import_service.import_photo_points(batch_id, photo_points, "小陶")
    
    coord_content = """P001,100.0,200.0,300.0
P002,110.0,210.0,310.0
P003,120.0,220.0,320.0"""
    import_service.import_coordinate_table(batch_id, "coord_8.csv", coord_content, "小陶")
    
    import_service.initialize_review_records(batch_id, "小陶")
    
    result = export_service.check_export_consistency(batch_id, "小陶")
    
    print_result(result["is_consistent"] == True, "一致性检查通过")
    print_result(
        result["details"]["api_record_count"] == 3,
        f"API记录数为3，实际: {result['details']['api_record_count']}"
    )
    print_result(
        result["details"]["api_record_count"] == result["details"]["csv_record_count"],
        f"API记录数({result['details']['api_record_count']}) == CSV记录数({result['details']['csv_record_count']})"
    )
    print_result(
        result["details"]["api_record_count"] == result["details"]["page_total_points"],
        f"API记录数({result['details']['api_record_count']}) == 页面汇总数({result['details']['page_total_points']})"
    )
    print_result(len(result["details"]["missing_in_csv"]) == 0, "CSV没有缺失点位")
    print_result(len(result["details"]["missing_in_api"]) == 0, "API没有缺失点位")
    print_result(result["details"]["summary_consistent"] == True, "页面汇总与API汇总一致")
    
    export_csv = export_service.export_to_csv(batch_id, "小陶")
    csv_lines = [l for l in export_csv.strip().split("\n") if l.strip()]
    print_result(len(csv_lines) == 4, f"CSV导出正确（1行表头+3行数据），实际{len(csv_lines)}行")
    
    audit_logs = data_store.get_audit_logs(batch_id)
    consistency_logs = [l for l in audit_logs if l.action == AuditAction.CHECK_EXPORT_CONSISTENCY]
    print_result(len(consistency_logs) > 0, "一致性检查操作已记录审计日志")
    
    return batch_id


def run_all_tests():
    print("🏙️  城市天际线退界复核系统 - 全面测试")
    print("=" * 60)
    
    test_results = []
    
    try:
        test_1_duplicate_import_detection()
        test_results.append(("重复导入检测", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("重复导入检测", False))
    
    try:
        test_2_photo_has_point_missing_coordinate()
        test_results.append(("照片有点位但坐标表缺一行检测", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("照片有点位但坐标表缺一行检测", False))
    
    try:
        test_3_supplement_and_recalculate()
        test_results.append(("补录坐标后重算", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("补录坐标后重算", False))
    
    try:
        test_4_three_step_workflow()
        test_results.append(("三步业务流程完整走通", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("三步业务流程完整走通", False))
    
    try:
        test_5_safety_review_not_auto_normal()
        test_results.append(("安全员复核流程", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("安全员复核流程", False))
    
    try:
        test_6_single_source_of_truth()
        test_results.append(("单数据源一致性", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("单数据源一致性", False))
    
    try:
        test_7_manual_modification_audit_trail()
        test_results.append(("人工改动审计追踪", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("人工改动审计追踪", False))
    
    try:
        test_8_export_consistency_check()
        test_results.append(("导出一致性检查", True))
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        test_results.append(("导出一致性检查", False))
    
    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    for name, success in test_results:
        if success:
            passed += 1
            print(f"✅ {name}")
        else:
            failed += 1
            print(f"❌ {name}")
    
    print("-" * 60)
    print(f"总计: {len(test_results)} 个测试, ✅ 通过: {passed}, ❌ 失败: {failed}")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
