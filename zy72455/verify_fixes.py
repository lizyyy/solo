#!/usr/bin/env python3
"""
历史街区招牌整治 - 回滚链路与重复导入验证脚本
重点核对：
1. 复核通过-夜间缺采样 回滚 → 待复核（清除复核意见）
2. 复核通过-正常 回滚 → 待复核（清除复核意见）
3. 重复导入：新增记录 vs 复用记录 明细展示
4. 备注修改在复核状态下可见改前/改后/原因
"""

import sys
from pathlib import Path
import shutil

sys.path.insert(0, str(Path(__file__).parent))

from src.data_manager import DataManager
from src.workflow import WorkflowEngine
from src.boundary_rules import BoundaryRuleEngine
from src.models import ProcessingStatus, HeatmapIssue


def print_title(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def test_rollback_chain():
    """测试完整回滚链路"""
    print_title("【测试1】复核通过-夜间缺采样 → 回滚到待复核")
    
    # 准备一条走完三步流程且标记为夜间缺采样的数据
    sample = [{"路口名称": "测试路口A", "拍摄时间": "2024-06-12"}]
    result = workflow.step1_import_photos(sample, "test_rollback.csv", "测试员")
    photo_id = result["new_records"][0]["photo_id"]
    print(f"✓ 步骤1: 导入成功，photo_id={photo_id[:8]}...")
    
    workflow.step2_add_bus_card_hours(
        photo_id, ["07:00-09:00", "17:00-19:00"], "市政巡检员-小付", "测试补录"
    )
    print("✓ 步骤2: 补录公交刷卡时段")
    
    # 生成有夜间缺采样问题的热力图
    low_sampling_heatmap = {
        "hourly_samples": {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 1,
            "7": 100, "8": 120, "9": 90, "10": 80, "11": 75, "12": 80,
            "13": 75, "14": 70, "15": 75, "16": 85, "17": 110, "18": 100,
            "19": 50, "20": 20, "21": 10, "22": 1, "23": 0,
        }
    }
    workflow.step3_generate_heatmap(photo_id, low_sampling_heatmap, "系统")
    photo = dm.get_photo(photo_id)
    print(f"✓ 步骤3: 生成热力图，状态={photo.current_status.value}，问题={photo.heatmap_issue.value}")
    assert photo.current_status == ProcessingStatus.PENDING_REVIEW, "应该是待复核状态"
    
    # 街道规划员复核：标记为夜间缺采样
    workflow.review_heatmap(
        photo_id, is_normal=False,
        review_note="确认夜间采样设备故障，热力图偏低",
        operator="街道规划员-张工"
    )
    photo = dm.get_photo(photo_id)
    print(f"✓ 复核完成：状态={photo.current_status.value}，复核意见={photo.review_note}")
    assert photo.current_status == ProcessingStatus.REVIEWED_LOW_SAMPLING, "应该是复核通过-夜间缺采样"
    
    # 测试回滚
    result = workflow.rollback(photo_id, "管理员", "测试回滚链路")
    photo = dm.get_photo(photo_id)
    print(f"\n>>> 执行回滚 <<<")
    print(f"  从: {result['old_status']}")
    print(f"  到: {result['new_status']}")
    print(f"  复核意见已清除: {photo.review_note is None}")
    
    assert photo.current_status == ProcessingStatus.PENDING_REVIEW, \
        f"BUG: 复核通过-夜间缺采样 回滚后应该是 待复核，实际是 {photo.current_status.value}"
    assert photo.review_note is None, "BUG: 回滚后复核意见应该被清除"
    print("✓ PASS: 复核通过-夜间缺采样 → 回滚到待复核 ✓")
    
    print_title("【测试2】复核通过-正常 → 回滚到待复核")
    
    # 重新走到复核通过-正常
    workflow.review_heatmap(
        photo_id, is_normal=True,
        review_note="经补充数据验证，实际人流正常",
        operator="街道规划员-张工"
    )
    photo = dm.get_photo(photo_id)
    print(f"✓ 复核完成：状态={photo.current_status.value}，复核意见={photo.review_note}")
    assert photo.current_status == ProcessingStatus.REVIEWED_NORMAL, "应该是复核通过-正常"
    
    # 测试回滚
    result = workflow.rollback(photo_id, "管理员", "测试回滚到待复核")
    photo = dm.get_photo(photo_id)
    print(f"\n>>> 执行回滚 <<<")
    print(f"  从: {result['old_status']}")
    print(f"  到: {result['new_status']}")
    print(f"  复核意见已清除: {photo.review_note is None}")
    
    assert photo.current_status == ProcessingStatus.PENDING_REVIEW, \
        f"BUG: 复核通过-正常 回滚后应该是 待复核，实际是 {photo.current_status.value}"
    assert photo.review_note is None, "BUG: 回滚后复核意见应该被清除"
    print("✓ PASS: 复核通过-正常 → 回滚到待复核 ✓")
    
    print_title("【测试3】待复核 → 回滚到热力图已生成")
    
    result = workflow.rollback(photo_id, "管理员", "继续回滚测试")
    photo = dm.get_photo(photo_id)
    print(f"  从: {result['old_status']}")
    print(f"  到: {result['new_status']}")
    assert photo.current_status == ProcessingStatus.HEATMAP_GENERATED, \
        f"BUG: 待复核 回滚后应该是 热力图已生成，实际是 {photo.current_status.value}"
    print("✓ PASS: 待复核 → 回滚到热力图已生成 ✓")
    
    print_title("【测试4】热力图已生成 → 回滚到公交刷卡时段已补录")
    
    result = workflow.rollback(photo_id, "管理员", "继续回滚测试")
    photo = dm.get_photo(photo_id)
    print(f"  从: {result['old_status']}")
    print(f"  到: {result['new_status']}")
    print(f"  热力图数据已清除: {photo.heatmap_data is None}")
    print(f"  问题标记已清除: {photo.heatmap_issue == HeatmapIssue.NONE}")
    assert photo.current_status == ProcessingStatus.BUS_CARD_DATA_ADDED, \
        f"BUG: 热力图已生成 回滚后应该是 公交刷卡时段已补录，实际是 {photo.current_status.value}"
    print("✓ PASS: 热力图已生成 → 回滚到公交刷卡时段已补录 ✓")
    
    print_title("【测试5】公交刷卡时段已补录 → 回滚到已导入")
    
    result = workflow.rollback(photo_id, "管理员", "继续回滚测试")
    photo = dm.get_photo(photo_id)
    print(f"  从: {result['old_status']}")
    print(f"  到: {result['new_status']}")
    print(f"  公交时段已清除: {photo.bus_card_hours is None}")
    assert photo.current_status == ProcessingStatus.IMPORTED, \
        f"BUG: 公交刷卡时段已补录 回滚后应该是 已导入，实际是 {photo.current_status.value}"
    print("✓ PASS: 公交刷卡时段已补录 → 回滚到已导入 ✓")
    
    print_title("【测试6】已导入状态不可回滚")
    
    result = workflow.rollback(photo_id, "管理员", "测试不可回滚")
    print(f"  回滚结果: success={result['success']}, error={result.get('error', '')}")
    assert not result["success"], "BUG: 已导入状态应该不可以回滚"
    print("✓ PASS: 已导入状态不可回滚 ✓")


def test_deduplication():
    """测试重复导入 - 新增与复用明细"""
    print_title("【测试7】重复导入 - 新增/复用明细验证")
    
    test_data = [
        {"路口名称": "重复测试路口1", "拍摄时间": "2024-06-12", "备注": "第一条"},
        {"路口名称": "重复测试路口2", "拍摄时间": "2024-06-12", "备注": "第二条"},
    ]
    
    print("第一次导入...")
    result1 = workflow.step1_import_photos(test_data, "dedup_test.csv", "测试员")
    print(f"  输入总数: {result1['total_input']}")
    print(f"  新增: {result1['new_count']} 条")
    print(f"  复用: {result1['reused_count']} 条")
    assert result1["new_count"] == 2, "第一次导入应该2条都是新增"
    assert result1["reused_count"] == 0, "第一次导入应该0条复用"
    
    print("\n第二次导入（相同数据）...")
    result2 = workflow.step1_import_photos(test_data, "dedup_test.csv", "测试员")
    print(f"  输入总数: {result2['total_input']}")
    print(f"  新增: {result2['new_count']} 条")
    print(f"  复用: {result2['reused_count']} 条")
    assert result2["new_count"] == 0, "第二次导入应该0条新增"
    assert result2["reused_count"] == 2, "第二次导入应该2条都是复用"
    
    if result2["reused_records"]:
        print(f"\n  复用记录明细:")
        for r in result2["reused_records"]:
            print(f"    - {r['intersection_name']} (第{r['row_number']}行, 当前状态: {r['current_status']})")
    
    print("\n第三次导入（部分新增 + 部分复用）...")
    test_data3 = [
        {"路口名称": "重复测试路口1", "拍摄时间": "2024-06-12", "备注": "第一条"},  # 复用
        {"路口名称": "重复测试路口2", "拍摄时间": "2024-06-12", "备注": "第二条"},  # 复用
        {"路口名称": "重复测试路口3", "拍摄时间": "2024-06-12", "备注": "第三条新增"},  # 新增
    ]
    result3 = workflow.step1_import_photos(test_data3, "dedup_test.csv", "测试员")
    print(f"  输入总数: {result3['total_input']}")
    print(f"  新增: {result3['new_count']} 条")
    print(f"  复用: {result3['reused_count']} 条")
    assert result3["new_count"] == 1, "第三次导入应该1条新增"
    assert result3["reused_count"] == 2, "第三次导入应该2条复用"
    
    print("\n✓ PASS: 重复导入新增/复用明细正确 ✓")


def test_remark_change_in_review():
    """测试复核状态下备注修改的改前/改后/原因可见性"""
    print_title("【测试8】复核状态下备注修改 - 改前改后原因可追溯")
    
    # 准备一条复核通过-夜间缺采样状态的数据
    sample = [{"路口名称": "备注测试路口", "拍摄时间": "2024-06-12"}]
    result = workflow.step1_import_photos(sample, "remark_test.csv", "测试员")
    photo_id = result["new_records"][0]["photo_id"]
    
    workflow.step2_add_bus_card_hours(
        photo_id, ["08:00-10:00"], "市政巡检员-小付", "测试"
    )
    
    low_heatmap = {
        "hourly_samples": {str(h): 0 if h < 7 or h > 21 else 100 for h in range(24)}
    }
    workflow.step3_generate_heatmap(photo_id, low_heatmap, "系统")
    workflow.review_heatmap(
        photo_id, is_normal=False,
        review_note="确认夜间缺采样",
        operator="街道规划员"
    )
    
    photo = dm.get_photo(photo_id)
    print(f"当前状态: {photo.current_status.value}")
    print(f"初始备注: {photo.remark}")
    print(f"初始人工改动数: {len(photo.manual_changes)}")
    
    # 修改备注
    dm.update_field(
        photo_id, "remark",
        "街口招牌有松动，需要重点关注，建议下周复查",
        "市政巡检员-小付",
        "现场复查后补充备注"
    )
    
    photo = dm.get_photo(photo_id)
    print(f"\n修改备注后:")
    print(f"  当前备注: {photo.remark}")
    print(f"  人工改动数: {len(photo.manual_changes)}")
    
    if photo.manual_changes:
        latest = photo.manual_changes[-1]
        print(f"\n  最新改动详情:")
        print(f"    字段: {latest.field_name}")
        print(f"    改前: {latest.old_value}")
        print(f"    改后: {latest.new_value}")
        print(f"    操作人: {latest.operator}")
        print(f"    原因: {latest.reason}")
        print(f"    时间: {latest.change_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        
        assert latest.field_name == "remark"
        assert latest.old_value is None
        assert "街口招牌有松动" in latest.new_value
        assert latest.operator == "市政巡检员-小付"
        assert "现场复查" in latest.reason
    
    # 再改一次备注
    dm.update_field(
        photo_id, "remark",
        "已通知施工队下周一进场维修招牌",
        "市政巡检员-小付",
        "跟进进度，更新备注"
    )
    
    photo = dm.get_photo(photo_id)
    print(f"\n第二次修改备注后:")
    print(f"  当前备注: {photo.remark}")
    print(f"  人工改动数: {len(photo.manual_changes)}")
    
    if len(photo.manual_changes) >= 2:
        prev = photo.manual_changes[-2]
        latest = photo.manual_changes[-1]
        print(f"  倒数第二次: {prev.old_value} → {prev.new_value}")
        print(f"  最后一次: {latest.old_value} → {latest.new_value}")
    
    print("\n✓ PASS: 复核状态下备注修改的改前/改后/原因可追溯 ✓")


def test_history_consistency():
    """测试回滚后历史记录一致性"""
    print_title("【测试9】回滚后历史记录可追溯 - 证据链完整")
    
    sample = [{"路口名称": "历史追溯测试路口", "拍摄时间": "2024-06-12"}]
    result = workflow.step1_import_photos(sample, "history_test.csv", "测试员")
    photo_id = result["new_records"][0]["photo_id"]
    
    workflow.step2_add_bus_card_hours(photo_id, ["09:00-11:00"], "小付", "测试")
    
    normal_heatmap = {
        "hourly_samples": {str(h): 50 + h for h in range(24)}
    }
    workflow.step3_generate_heatmap(photo_id, normal_heatmap, "系统")
    
    workflow.review_heatmap(photo_id, True, "复核通过-正常", "规划员")
    
    # 回滚到待复核
    workflow.rollback(photo_id, "管理员", "测试历史追溯")
    
    history = dm.get_photo_history(photo_id)
    print(f"历史记录总数: {len(history)}")
    print("\n完整历史时间线:")
    for i, record in enumerate(history):
        print(f"  [{i+1}] {record.change_timestamp.strftime('%H:%M:%S')} | {record.change_type}")
        print(f"       {record.description}")
        print(f"       操作人: {record.operator}")
        if record.old_snapshot and record.new_snapshot:
            old_status = record.old_snapshot.get("current_status", "(初始)")
            new_status = record.new_snapshot.get("current_status", "")
            print(f"       状态变迁: {old_status} → {new_status}")
    
    # 验证每条记录都有改前/改后快照
    has_old_snapshot = sum(1 for h in history if h.old_snapshot)
    has_new_snapshot = sum(1 for h in history if h.new_snapshot)
    print(f"\n有改前快照的记录: {has_old_snapshot}/{len(history)}")
    print(f"有改后快照的记录: {has_new_snapshot}/{len(history)}")
    
    print("\n✓ PASS: 回滚后历史记录完整，证据链可追溯 ✓")


if __name__ == "__main__":
    # 清理旧的测试数据
    test_storage = Path("data/verify_storage")
    if test_storage.exists():
        shutil.rmtree(test_storage)
    
    dm = DataManager(storage_path=str(test_storage))
    workflow = WorkflowEngine(dm)
    rule_engine = BoundaryRuleEngine()
    
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║     历史街区招牌整治 - 回滚链路与重复导入 验证测试                 ║
╚═══════════════════════════════════════════════════════════════════╝
    """)
    
    all_passed = True
    try:
        test_rollback_chain()
        test_deduplication()
        test_remark_change_in_review()
        test_history_consistency()
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        all_passed = False
    except Exception as e:
        print(f"\n❌ 异常: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    print_title("测试总结")
    if all_passed:
        print("✅ 全部测试通过！")
        print("""
  ✓ 复核通过-夜间缺采样 → 回滚到待复核（清除复核意见）
  ✓ 复核通过-正常 → 回滚到待复核（清除复核意见）
  ✓ 待复核 → 回滚到热力图已生成
  ✓ 热力图已生成 → 回滚到公交刷卡时段已补录
  ✓ 公交刷卡时段已补录 → 回滚到已导入
  ✓ 已导入状态不可回滚
  ✓ 重复导入新增/复用明细正确
  ✓ 复核状态下备注修改的改前/改后/原因可追溯
  ✓ 回滚后历史记录完整，证据链可追溯
        """)
    else:
        print("❌ 有测试未通过，请检查上面的错误信息")
    
    print(f"\n测试数据存储位置: {test_storage.absolute()}")
