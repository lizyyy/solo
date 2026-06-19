#!/usr/bin/env python3
"""
历史街区招牌整治 - 端到端验证脚本
在同一条真实样例中串联：
  1. 首次导入路口照片
  2. 再次导入同批照片触发复用
  3. 补录公交刷卡时段
  4. 生成热力图（含夜间缺采样）
  5. 保存负责人备注
  6. 刷新后重算
  7. 复核终态回滚（复核通过-正常 / 复核通过-夜间缺采样 → 待复核）
  8. 导出报告
重点核对：
  - 每条记录的新增/复用标识
  - 复核状态与复核意见
  - 备注变更历史（改前/改后/原因）
  - 夜间缺采样说明
  - 报告导出内容
  - 离开导入页后仍能追到新增与复用结果
"""

import sys
import json
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.data_manager import DataManager
from src.workflow import WorkflowEngine
from src.boundary_rules import BoundaryRuleEngine
from src.models import ProcessingStatus, HeatmapIssue, ImportType


def sep(title=""):
    print(f"\n{'='*70}")
    if title:
        print(f"  {title}")
        print(f"{'='*70}")


def check(condition, msg):
    if not condition:
        print(f"  ❌ FAIL: {msg}")
        return False
    print(f"  ✅ PASS: {msg}")
    return True


def run_e2e():
    storage = Path("data/e2e_storage")
    if storage.exists():
        shutil.rmtree(storage)
    
    dm = DataManager(storage_path=str(storage))
    wf = WorkflowEngine(dm)
    
    all_ok = True
    
    # ===== STEP 1: 首次导入 =====
    sep("STEP 1: 首次导入路口照片")
    
    batch = [
        {"路口名称": "中山路与人民路交叉口", "拍摄时间": "2024-01-15", "招牌状态": "待整治"},
        {"路口名称": "历史街区南口", "拍摄时间": "2024-01-15", "招牌状态": "已整治"},
    ]
    
    r1 = wf.step1_import_photos(batch, "batch_2024.csv", "市政巡检员-小付")
    all_ok &= check(r1["new_count"] == 2, "首次导入: 2条新增")
    all_ok &= check(r1["reused_count"] == 0, "首次导入: 0条复用")
    
    for rec in r1["new_records"]:
        photo = dm.get_photo(rec["photo_id"])
        all_ok &= check(
            photo.import_type == ImportType.NEW,
            f"{rec['intersection_name']} import_type=新增"
        )
    
    photo_id_a = r1["new_records"][0]["photo_id"]
    photo_id_b = r1["new_records"][1]["photo_id"]
    
    # ===== STEP 2: 再次导入同批 → 触发复用 =====
    sep("STEP 2: 再次导入同批路口照片（触发复用）")
    
    r2 = wf.step1_import_photos(batch, "batch_2024.csv", "市政巡检员-小付")
    all_ok &= check(r2["new_count"] == 0, "再次导入: 0条新增")
    all_ok &= check(r2["reused_count"] == 2, "再次导入: 2条复用")
    
    for rec in r2["reused_records"]:
        all_ok &= check(
            rec["current_status"] == "已导入",
            f"复用记录 {rec['intersection_name']} 当前状态={rec['current_status']}"
        )
    
    # 验证复用确认写入历史
    for pid in [photo_id_a, photo_id_b]:
        hist = dm.get_photo_history(pid)
        reuse_events = [h for h in hist if h.change_type == "复用确认"]
        all_ok &= check(
            len(reuse_events) >= 1,
            f"{pid[:8]}... 有复用确认历史记录"
        )
        if reuse_events:
            desc = reuse_events[0].description
            all_ok &= check(
                "当前状态=" in desc,
                f"复用确认历史包含当前状态信息"
            )
    
    # ===== STEP 3: 补录公交刷卡时段 =====
    sep("STEP 3: 补录公交刷卡时段")
    
    wf.step2_add_bus_card_hours(
        photo_id_b, ["07:30-09:30", "16:30-18:30"],
        "市政巡检员-小付", "回看历史街区招牌整治时补录"
    )
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.current_status == ProcessingStatus.BUS_CARD_DATA_ADDED,
        "补录后状态=公交刷卡时段已补录"
    )
    
    # ===== STEP 4: 生成热力图（夜间缺采样） =====
    sep("STEP 4: 生成热力图（含夜间缺采样）")
    
    low_night_heatmap = {
        "hourly_samples": {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 1, "6": 3,
            "7": 90, "8": 110, "9": 85, "10": 75, "11": 70, "12": 72,
            "13": 68, "14": 70, "15": 72, "16": 80, "17": 95, "18": 90,
            "19": 30, "20": 2, "21": 1, "22": 0, "23": 0,
        }
    }
    
    wf.step3_generate_heatmap(photo_id_b, low_night_heatmap, "系统")
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.current_status == ProcessingStatus.PENDING_REVIEW,
        "夜间缺采样 → 状态=待复核"
    )
    all_ok &= check(
        photo_b.heatmap_issue == HeatmapIssue.LOW_NIGHT_SAMPLING,
        "热力图问题=夜间缺采样导致热力图偏低"
    )
    
    # ===== STEP 5: 保存负责人备注 =====
    sep("STEP 5: 保存负责人备注")
    
    dm.update_field(
        photo_id_b, "remark",
        "南口招牌有松动，需重点关注",
        "市政巡检员-小付",
        "现场复查后补充备注"
    )
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.remark == "南口招牌有松动，需重点关注",
        "备注保存成功"
    )
    
    # 验证备注修改在manual_changes中可追溯
    remark_changes = [mc for mc in photo_b.manual_changes if mc.field_name == "remark"]
    all_ok &= check(len(remark_changes) == 1, "备注修改记录数为1")
    if remark_changes:
        mc = remark_changes[0]
        all_ok &= check(mc.old_value is None, f"改前值=None")
        all_ok &= check("南口招牌" in mc.new_value, f"改后值包含'南口招牌'")
        all_ok &= check("现场复查" in mc.reason, f"修改原因包含'现场复查'")
    
    # ===== STEP 6: 刷新后重算 — 再次导入验证信息持久化 =====
    sep("STEP 6: 刷新后重算 — 再次导入验证信息持久化")
    
    # 模拟"刷新"：重新加载数据
    dm2 = DataManager(storage_path=str(storage))
    wf2 = WorkflowEngine(dm2)
    
    r3 = wf2.step1_import_photos(batch, "batch_2024.csv", "市政巡检员-小付")
    all_ok &= check(r3["new_count"] == 0, "刷新后再次导入: 仍然0条新增")
    all_ok &= check(r3["reused_count"] == 2, "刷新后再次导入: 仍然2条复用")
    
    # 验证复用记录携带了当前完整信息
    reused_b = [r for r in r3["reused_records"] if r["photo_id"] == photo_id_b][0]
    all_ok &= check(
        reused_b["heatmap_issue"] == "夜间缺采样导致热力图偏低",
        "复用记录携带夜间缺采样标识"
    )
    all_ok &= check(
        reused_b["remark"] == "南口招牌有松动，需重点关注",
        "复用记录携带当前备注"
    )
    all_ok &= check(
        reused_b["manual_change_count"] == 1,
        "复用记录携带备注修改次数"
    )
    
    # 使用dm2继续后续操作（模拟刷新后）
    dm = dm2
    wf = wf2
    
    # ===== STEP 7: 复核 — 标记为夜间缺采样 =====
    sep("STEP 7: 复核 — 标记为夜间缺采样")
    
    wf.review_heatmap(
        photo_id_b, is_normal=False,
        review_note="确认夜间采样设备故障，热力图偏低非实际人流",
        operator="街道规划员-张工"
    )
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.current_status == ProcessingStatus.REVIEWED_LOW_SAMPLING,
        "复核后状态=复核通过-夜间缺采样"
    )
    all_ok &= check(
        photo_b.review_note == "确认夜间采样设备故障，热力图偏低非实际人流",
        "复核意见已保存"
    )
    
    # 修改备注（复核状态下）
    dm.update_field(
        photo_id_b, "remark",
        "南口招牌已通知施工队下周维修，夜间缺采样待补数据",
        "市政巡检员-小付",
        "更新维修进度和缺采样状态"
    )
    
    # ===== STEP 8: 复核终态回滚 → 待复核 =====
    sep("STEP 8: 复核终态回滚 → 待复核")
    
    result = wf.rollback(photo_id_b, "管理员", "需要补充夜间采样数据后重新复核")
    all_ok &= check(result["old_status"] == "复核通过-夜间缺采样", "回滚前=复核通过-夜间缺采样")
    all_ok &= check(result["new_status"] == "待复核", "回滚后=待复核")
    
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.current_status == ProcessingStatus.PENDING_REVIEW,
        "当前状态=待复核"
    )
    all_ok &= check(
        photo_b.review_note is None,
        "复核意见已清除"
    )
    all_ok &= check(
        "南口招牌已通知" in (photo_b.remark or ""),
        "备注在回滚后保留"
    )
    
    # 验证回滚历史中明确写了"复核意见已清除"
    hist = dm.get_photo_history(photo_id_b)
    rollback_events = [h for h in hist if h.change_type == "回滚"]
    last_rollback = rollback_events[-1]
    all_ok &= check(
        "复核意见已清除" in last_rollback.description,
        "回滚历史描述包含'复核意见已清除'"
    )
    all_ok &= check(
        last_rollback.old_snapshot.get("review_note") is not None,
        "回滚前快照有复核意见"
    )
    all_ok &= check(
        last_rollback.new_snapshot.get("review_note") is None,
        "回滚后快照复核意见为None"
    )
    
    # ===== STEP 9: 再次复核 — 标记为正常 =====
    sep("STEP 9: 再次复核 — 标记为正常")
    
    # 从待复核直接复核为正常（不需要重新生成热力图）
    wf.review_heatmap(
        photo_id_b, is_normal=True,
        review_note="经补充数据验证，人流情况正常",
        operator="街道规划员-张工"
    )
    
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.current_status == ProcessingStatus.REVIEWED_NORMAL,
        "复核后状态=复核通过-正常"
    )
    
    # ===== STEP 10: 复核通过-正常 → 回滚到待复核 =====
    sep("STEP 10: 复核通过-正常 → 回滚到待复核")
    
    result = wf.rollback(photo_id_b, "管理员", "重新检查热力图计算逻辑")
    all_ok &= check(result["old_status"] == "复核通过-正常", "回滚前=复核通过-正常")
    all_ok &= check(result["new_status"] == "待复核", "回滚后=待复核")
    
    hist = dm.get_photo_history(photo_id_b)
    rollback_events = [h for h in hist if h.change_type == "回滚"]
    last_rollback = rollback_events[-1]
    all_ok &= check(
        "复核意见已清除" in last_rollback.description,
        "从复核通过-正常回滚，历史包含'复核意见已清除'"
    )
    
    # ===== STEP 11: 再次导入（复核状态下）→ 验证复用记录包含复核状态 =====
    sep("STEP 11: 再次导入（复核状态下）→ 复用记录包含完整信息")
    
    r4 = wf.step1_import_photos(batch, "batch_2024.csv", "市政巡检员-小付")
    reused_b = [r for r in r4["reused_records"] if r["photo_id"] == photo_id_b][0]
    all_ok &= check(
        reused_b["current_status"] == "待复核",
        "复用记录显示当前状态=待复核"
    )
    
    # ===== STEP 12: 导出报告 =====
    sep("STEP 12: 导出报告验证")
    
    report = wf.export_report()
    all_ok &= check(
        report["report_title"] == "历史街区招牌整治 - 路口照片管理报告",
        "报告标题正确"
    )
    all_ok &= check(
        len(report["photos"]) == 2,
        "报告包含2条照片记录"
    )
    
    photo_b_report = [p for p in report["photos"] if p["photo_id"] == photo_id_b][0]
    
    all_ok &= check(
        photo_b_report["import_type"] == "新增",
        f"报告: 路口B导入类型=新增"
    )
    all_ok &= check(
        photo_b_report["current_status"] == "待复核",
        "报告: 当前状态=待复核"
    )
    all_ok &= check(
        photo_b_report["reuse_event_count"] >= 2,
        f"报告: 复用确认事件 >= 2次"
    )
    all_ok &= check(
        photo_b_report["remark_change_count"] >= 1,
        f"报告: 备注修改 >= 1次"
    )
    
    if photo_b_report["remark_changes"]:
        rc = photo_b_report["remark_changes"][0]
        all_ok &= check(
            rc["old_value"] is None and "南口招牌" in rc["new_value"],
            "报告: 备注改前=None, 改后包含'南口招牌'"
        )
        all_ok &= check(
            "现场复查" in rc["reason"],
            "报告: 备注修改原因可追溯"
        )
    
    if photo_b_report["rollback_events"]:
        re_last = photo_b_report["rollback_events"][-1]
        all_ok &= check(
            re_last["review_note_cleared"] == True,
            "报告: 最后一次回滚标记复核意见已清除"
        )
    
    if photo_b_report["reuse_events"]:
        re_ev = photo_b_report["reuse_events"][0]
        all_ok &= check(
            "当前状态=" in re_ev["description"],
            "报告: 复用确认事件描述包含当前状态"
        )
    
    # 保存JSON报告到文件
    report_path = storage / "e2e_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n  报告已保存至: {report_path}")
    
    # ===== STEP 13: 离开导入页后仍能追到新增与复用结果 =====
    sep("STEP 13: 离开导入页后 — 通过历史和报告追溯新增/复用")
    
    for pid in [photo_id_a, photo_id_b]:
        hist = dm.get_photo_history(pid)
        import_events = [h for h in hist if h.change_type == "导入（新增）"]
        reuse_events = [h for h in hist if h.change_type == "复用确认"]
        all_ok &= check(
            len(import_events) == 1,
            f"{pid[:8]}... 历史中有1条'导入（新增）'记录"
        )
        all_ok &= check(
            len(reuse_events) >= 2,
            f"{pid[:8]}... 历史中有>=2条'复用确认'记录"
        )
        
        if import_events:
            snap = import_events[0].new_snapshot
            all_ok &= check(
                snap.get("import_type") == "新增",
                "导入（新增）快照中 import_type=新增"
            )
        
        if reuse_events:
            snap = reuse_events[0].new_snapshot
            all_ok &= check(
                "current_status" in snap,
                "复用确认快照中包含 current_status"
            )
            all_ok &= check(
                "heatmap_issue" in snap,
                "复用确认快照中包含 heatmap_issue"
            )
            all_ok &= check(
                "remark" in snap,
                "复用确认快照中包含 remark"
            )
    
    # ===== 最终统计 =====
    sep("最终统计")
    
    stats = dm.get_statistics()
    print(f"  照片总数: {stats['total_photos']}")
    print(f"  状态分布: {json.dumps(stats['status_distribution'], ensure_ascii=False)}")
    print(f"  问题分布: {json.dumps(stats['issue_distribution'], ensure_ascii=False)}")
    print(f"  变更总数: {stats['total_changes']}")
    
    photo_b = dm.get_photo(photo_id_b)
    all_ok &= check(
        photo_b.import_type == ImportType.NEW,
        "最终: 路口B import_type=新增（首次导入标记不变）"
    )
    
    sep("测试结果")
    if all_ok:
        print("✅ 全部检查通过！")
        print("""
验证覆盖：
  ✓ 首次导入：标记为新增，import_type持久化
  ✓ 再次导入：触发复用确认，写入历史（含当前状态/热力图问题/备注/复核意见）
  ✓ 刷新后重算：复用信息持久化，离开导入页后可追溯
  ✓ 补录公交刷卡时段
  ✓ 生成热力图（夜间缺采样检测）
  ✓ 保存负责人备注（改前/改后/原因）
  ✓ 复核通过-夜间缺采样 → 回滚到待复核，复核意见已清除
  ✓ 复核通过-正常 → 回滚到待复核，复核意见已清除
  ✓ 回滚历史明确记录"复核意见已清除"
  ✓ 报告导出包含：新增/复用标识、复核状态、备注变更、夜间缺采样、回滚事件
  ✓ 报告中回滚事件标记 review_note_cleared=True
        """)
    else:
        print("❌ 有检查未通过，请查看上方标记 ❌ 的条目")
    
    return all_ok


if __name__ == "__main__":
    success = run_e2e()
    sys.exit(0 if success else 1)
