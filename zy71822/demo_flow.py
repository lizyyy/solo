#!/usr/bin/env python3
import os
import sys
import tempfile
import csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import ReviewStatus, AnomalyType
from island_supply_service import IslandSupplyService


def create_test_csv(path, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def run_demo():
    print("=" * 70)
    print("  海岛补给竞速 - 完整功能演示")
    print("=" * 70)

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        service = IslandSupplyService(db_path=db_path)

        print("\n📌 步骤1: 导入掉落配置")
        drop_configs = [
            {"stage": "5", "item_name": "高级补给箱", "drop_rate": "15.5", "version": "1", "note": ""},
            {"stage": "10", "item_name": "特级补给箱", "drop_rate": "10.0", "version": "1", "note": ""},
            {"stage": "13", "item_name": "传说材料", "drop_rate": "3.5", "version": "1", "note": ""},
        ]
        drop_csv = os.path.join(tmpdir, "drop_config.csv")
        create_test_csv(drop_csv, drop_configs)
        configs = service.import_drop_configs(drop_csv, operator="运营小明")
        print(f"✅ 成功导入 {len(configs)} 条掉落配置")

        print("\n📌 步骤2: 导入第一版排行榜（含异常标记）")
        lb_v1 = [
            {"player_id": "P001", "player_name": "海岛探险家", "score": "98500", "rank": "1", "stage_progress": "15", "anomaly": "", "note": ""},
            {"player_id": "P002", "player_name": "破浪者", "score": "87200", "rank": "2", "stage_progress": "14", "anomaly": "", "note": ""},
            {"player_id": "P003", "player_name": "珊瑚守护", "score": "76800", "rank": "3", "stage_progress": "13", "anomaly": "断线", "note": "玩家反馈掉线后分数不对"},
            {"player_id": "P004", "player_name": "潮汐猎人", "score": "65400", "rank": "4", "stage_progress": "12", "anomaly": "", "note": ""},
            {"player_id": "P005", "player_name": "落日船长", "score": "54300", "rank": "5", "stage_progress": "11", "anomaly": "刷分", "note": ""},
        ]
        lb_csv_v1 = os.path.join(tmpdir, "leaderboard_v1.csv")
        create_test_csv(lb_csv_v1, lb_v1)
        result_v1 = service.import_leaderboard(
            lb_csv_v1,
            source_ref="排行榜截图_20260531_1000.png",
            operator="运营小明",
        )
        print(f"✅ 批次ID: {result_v1.batch.batch_id}")
        print(f"✅ 新增: {len(result_v1.new_records)} 条")
        pending = [r for r in result_v1.new_records if r.review_status == ReviewStatus.PENDING_CONFIRM]
        print(f"⚠️  自动标记待确认: {len(pending)} 条")
        for r in pending:
            print(f"   - [{r.anomaly_type.value}] {r.player_name}: {r.anomaly_note}")

        print("\n📌 步骤3: 审核记录 - P003确认为正常")
        p003_id = next(r.id for r in result_v1.new_records if r.player_id == "P003")
        service.confirm_record(p003_id, is_normal=True, note="核对截图，掉线后实际分数就是这么多", operator="运营主管")
        print(f"✅ P003已标记为正常")

        print("\n📌 步骤4: 审核记录 - P005确认为异常")
        p005_id = next(r.id for r in result_v1.new_records if r.player_id == "P005")
        service.confirm_record(p005_id, is_normal=False, note="确认重开刷分，不予发奖", operator="运营主管")
        print(f"✅ P005已标记为驳回")

        print("\n📌 步骤5: 导入第二版排行榜（分数更高，正常更新）")
        lb_v2 = [
            {"player_id": "P001", "player_name": "海岛探险家", "score": "108500", "rank": "1", "stage_progress": "16", "anomaly": "", "note": ""},
            {"player_id": "P002", "player_name": "破浪者", "score": "97200", "rank": "2", "stage_progress": "15", "anomaly": "", "note": ""},
            {"player_id": "P006", "player_name": "贝壳收集家", "score": "43200", "rank": "6", "stage_progress": "10", "anomaly": "", "note": ""},
        ]
        lb_csv_v2 = os.path.join(tmpdir, "leaderboard_v2.csv")
        create_test_csv(lb_csv_v2, lb_v2)
        result_v2 = service.import_leaderboard(
            lb_csv_v2,
            source_ref="排行榜截图_20260531_1400.png",
            operator="运营小明",
        )
        print(f"✅ 批次ID: {result_v2.batch.batch_id}")
        print(f"✅ 新增: {len(result_v2.new_records)} 条 (P006)")
        print(f"✅ 更新: {len(result_v2.updated_records)} 条 (P001, P002)")
        for diff in result_v2.version_diffs:
            print(f"   📝 {diff.old_record.player_name}: {diff.summary}")

        print("\n📌 步骤6: 导入旧版本排行榜（分数更低，自动标记断线错乱）")
        lb_v3_old = [
            {"player_id": "P001", "player_name": "海岛探险家", "score": "58500", "rank": "10", "stage_progress": "8", "anomaly": "", "note": ""},
        ]
        lb_csv_v3 = os.path.join(tmpdir, "leaderboard_v3_old.csv")
        create_test_csv(lb_csv_v3, lb_v3_old)
        result_v3 = service.import_leaderboard(
            lb_csv_v3,
            source_ref="排行榜截图_20260530_错误版本.png",
            operator="运营小明",
        )
        print(f"✅ 批次ID: {result_v3.batch.batch_id}")
        anomaly_records = [r for r in result_v3.updated_records if r.anomaly_type != AnomalyType.NONE]
        print(f"⚠️  自动标记断线错乱: {len(anomaly_records)} 条")
        for r in anomaly_records:
            print(f"   - {r.player_name}: {r.anomaly_note}")

        print("\n📌 步骤7: 撤回错误批次")
        success = service.revoke_batch(result_v3.batch.batch_id, reason="上传了错误的旧版本截图", operator="运营主管")
        if success:
            print(f"✅ 批次 {result_v3.batch.batch_id} 已撤回")
            p001_after = service.db.get_leaderboard_record(p003_id - 2)
            if p001_after:
                print(f"   P001状态变为: {p001_after.review_status.value}")

        print("\n📌 步骤8: 自动检测异常")
        print("\n--- 检测断线进度错乱 ---")
        susp_disconnect = service.detect_disconnect_corruption(score_deviation_threshold=5000)
        if susp_disconnect:
            print(f"⚠️  发现 {len(susp_disconnect)} 条疑似记录:")
            for r in susp_disconnect:
                print(f"   - {r.player_name}: {r.score}分")
        else:
            print("✅ 未发现断线异常")

        print("\n--- 检测重开刷分 ---")
        susp_restart = service.detect_restart_brush_score(rank_jump_threshold=20)
        if susp_restart:
            print(f"⚠️  发现 {len(susp_restart)} 条疑似记录")
        else:
            print("✅ 未发现刷分异常")

        print("\n📌 步骤9: 查看P001完整溯源")
        p001_id = next(r.id for r in result_v1.new_records if r.player_id == "P001")
        trace = service.get_record_trace(p001_id)
        if trace:
            rec = trace["record"]
            print(f"📍 玩家: {rec['player_name']} (ID: {rec['player_id']})")
            print(f"   当前分数: {rec['score']} | 状态: {rec['review_status']}")
            print(f"   来源文件: {trace['evidence']['source_file']}")
            print(f"   来源引用: {trace['evidence']['source_ref']}")
            print(f"   关联掉落配置: {len(trace['related_drop_configs'])} 条")
            for cfg in trace["related_drop_configs"]:
                print(f"     - 关卡{cfg['stage']}: {cfg['item_name']} ({cfg['drop_rate']}%)")
            print(f"   版本历史: {len(trace['version_history'])} 条")
            for h in trace["version_history"]:
                print(f"     v{h['old_version']}→v{h['new_version']}: {h['change_summary']}")

        print("\n📌 步骤10: 导出排行榜")
        export_path = os.path.join(tmpdir, "final_result.csv")
        results = service.export_with_trace(
            export_path,
            include_pending=True,
            include_trace=True,
        )
        base = os.path.splitext(export_path)[0]
        print(f"✅ 导出完成，共 {len(results)} 条记录")
        print(f"   汇总表: {base}_summary.csv")
        print(f"   详情JSON: {base}_detail.json")
        print(f"   警告信息: {base}_warnings.txt")

        normal_count = sum(1 for r in results if r.record.review_status == ReviewStatus.NORMAL)
        pending_count = sum(1 for r in results if r.record.review_status == ReviewStatus.PENDING_CONFIRM)
        rejected_count = sum(1 for r in results if r.record.review_status == ReviewStatus.REJECTED)
        print(f"\n📊 统计: 正常 {normal_count} | 待确认 {pending_count} | 已驳回 {rejected_count}")

        print("\n📌 步骤11: 查看所有导入批次")
        batches = service.list_batches()
        print(f"共有 {len(batches)} 个导入批次:")
        for b in batches:
            batch = b["batch"]
            status = "🔴 已撤回" if batch["is_revoked"] else "🟢 正常"
            warning = " ⚠️有版本变更" if b["has_warnings"] else ""
            print(f"  {status} {batch['batch_id']}{warning}")
            print(f"    文件: {batch['source_file']} | 记录数: {b['record_count']}")

        print("\n" + "=" * 70)
        print("  ✅ 所有功能演示完成！")
        print("=" * 70)
        print("\n核心功能总结:")
        print("  1. ✅ 掉落配置导入与关联")
        print("  2. ✅ 排行榜导入（支持重复导入、版本对比）")
        print("  3. ✅ 自动异常检测（断线、刷分、漏发）")
        print("  4. ✅ 导入旧版本自动标记为断线错乱")
        print("  5. ✅ 批次撤回功能")
        print("  6. ✅ 人工审核确认")
        print("  7. ✅ 完整版本历史记录")
        print("  8. ✅ 记录溯源（来源、掉落配置、版本历史）")
        print("  9. ✅ 筛选导出（带警告提醒）")
        print("  10.✅ 变更不静默，所有操作都有提示和记录")


if __name__ == "__main__":
    run_demo()
