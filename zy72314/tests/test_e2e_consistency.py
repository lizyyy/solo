"""端到端集成测试 - 串起输入→补录/修正→状态变化→最终展示

测试场景：
1. 安装（依赖检查）
2. 启动（系统初始化）
3. 导入 v1（20 条，含负数当缺失）
4. 导入 v1_edited（内容不同，只改了备注，应该不翻倍，数量还是 20）
5. 手动改备注（只改一条备注）
6. 一致性检查（列表/详情/摘要/导出/报告同源一致）
7. 人工复核（负数当缺失，保留原始说法、改后值、处理原因、下一步找谁）
8. 再次一致性检查（复核后各视图仍一致）
9. 导出 CSV + 边界报告（同源）
10. 重复导入同一份文件（哈希相同，不翻倍）
"""

import os
import sys
import tempfile
import shutil
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quantile_calibration import QuantileCalibrationSystem
from quantile_calibration.models import BoundaryType, ProcessingStatus


class TestEndToEndWorkflow(unittest.TestCase):
    """端到端集成测试"""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "e2e.db")
        self.data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
        )
        self.v1 = os.path.join(self.data_dir, "test_rating_weights_v1.csv")
        self.v1_edited = os.path.join(
            self.data_dir, "test_rating_weights_v1_edited.csv"
        )
        self.system = QuantileCalibrationSystem(self.db_path)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_e2e_install_and_init(self):
        """Step 1 & 2: 安装依赖检查 + 系统初始化"""
        import pandas
        import openpyxl
        self.assertIsNotNone(self.system.db)
        self.assertIsNotNone(self.system.views)
        self.assertIsNotNone(self.system.importer)
        self.assertIsNotNone(self.system.workflow)
        self.assertIsNotNone(self.system.boundary_engine)

    def test_e2e_full_workflow_consistency(self):
        """完整端到端流程 + 同源一致性检查"""

        print()
        print("=" * 80)
        print("【Step 3】导入 v1（20 条，含负数当缺失）")
        print("=" * 80)
        step1 = self.system.step1_import(self.v1, "alan_ops")
        batch_id = step1["batch_id"]

        list_v1 = self.system.get_list_view(batch_id)
        summary_v1 = self.system.get_summary_view(batch_id)
        export_v1 = self.system.export_records(batch_id, include_history=False)
        report_v1 = self.system.generate_boundary_report_view(batch_id)

        self.assertEqual(list_v1["total_count"], 20, "列表总数应为 20")
        self.assertEqual(summary_v1["total_records"], 20, "摘要总数应为 20")
        self.assertEqual(len(export_v1), 20, "导出总数应为 20")
        self.assertEqual(report_v1["total_records"], 20, "报告总数应为 20")

        print(f"  列表: {list_v1['total_count']} 条")
        print(f"  摘要: {summary_v1['total_records']} 条")
        print(f"  导出: {len(export_v1)} 条")
        print(f"  报告: {report_v1['total_records']} 条")
        print(f"  负数当缺失: {summary_v1['negative_as_missing_count']} 条")
        print(f"  待复核: {summary_v1['pending_review_count']} 条")

        neg_as_missing_count_v1 = summary_v1["negative_as_missing_count"]
        pending_review_count_v1 = summary_v1["pending_review_count"]
        self.assertGreater(neg_as_missing_count_v1, 0)
        self.assertGreater(pending_review_count_v1, 0)

        print()
        print("=" * 80)
        print("【Step 4】导入 v1_edited（内容不同，只改了备注）→ 应该不翻倍，数量还是 20")
        print("=" * 80)
        step1b = self.system.step1_import(self.v1_edited, "alan_ops")
        print(f"  导入返回 action: {step1b['import_result']['action']}")
        print(f"  is_duplicate: {step1b['import_result']['is_duplicate']}")
        if "duplicate_level" in step1b["import_result"]:
            print(f"  duplicate_level: {step1b['import_result']['duplicate_level']}")
        print(f"  合并更新条数: {step1b['import_result'].get('merged_updated_count', 'N/A')}")
        print(f"  新增条数: {step1b['import_result'].get('newly_created_count', 'N/A')}")
        print(f"  当前总数: {step1b['import_result'].get('total_count', 'N/A')}")

        list_after_edit = self.system.get_list_view(batch_id)
        summary_after_edit = self.system.get_summary_view(batch_id)
        export_after_edit = self.system.export_records(batch_id, include_history=False)
        report_after_edit = self.system.generate_boundary_report_view(batch_id)

        self.assertEqual(list_after_edit["total_count"], 20,
                         "❌ 只改备注不翻倍：列表总数应该还是 20")
        self.assertEqual(summary_after_edit["total_records"], 20,
                         "❌ 只改备注不翻倍：摘要总数应该还是 20")
        self.assertEqual(len(export_after_edit), 20,
                         "❌ 只改备注不翻倍：导出总数应该还是 20")
        self.assertEqual(report_after_edit["total_records"], 20,
                         "❌ 只改备注不翻倍：报告总数应该还是 20")

        first_record = list_after_edit["items"][0]
        print(f"  ✅ 列表总数: {list_after_edit['total_count']}（未翻倍）")
        print(f"  ✅ 第一条记录备注: {first_record['remark']}")
        self.assertIn("已复核", first_record["remark"],
                      "备注更新应生效")

        print()
        print("=" * 80)
        print("【Step 5】手动改备注（只改一条记录）")
        print("=" * 80)
        target_record = list_after_edit["items"][5]
        old_remark = target_record["remark"]
        new_remark = old_remark + " 手动确认已审核"

        edit_result = self.system.manual_edit(
            record_id=target_record["record_id"],
            updates={"remark": new_remark},
            operator="alan_ops",
            reason="运营规划阿岚核对后补充备注"
        )
        self.assertTrue(edit_result["evidence_saved"])
        print(f"  改前备注: {old_remark}")
        print(f"  改后备注: {new_remark}")
        print(f"  改动字段: {edit_result['updated_fields']}")
        print(f"  版本对比: {edit_result['version_diffs'] != []}")

        print()
        print("=" * 80)
        print("【Step 6】一致性检查：列表/详情/摘要/导出/报告同源一致")
        print("=" * 80)
        consistency = self.system.verify_consistency(batch_id)
        print(f"  列表总数: {consistency['checks']['list_total']}")
        print(f"  摘要总数: {consistency['checks']['summary_total']}")
        print(f"  导出总数: {consistency['checks']['export_total']}")
        print(f"  报告总数: {consistency['checks']['report_total']}")
        print(f"  列表=摘要: {consistency['checks']['list_matches_summary']}")
        print(f"  列表=导出: {consistency['checks']['list_matches_export']}")
        print(f"  列表=报告: {consistency['checks']['list_matches_report']}")
        print(f"  全部一致: {consistency['checks']['all_totals_match']}")
        self.assertTrue(consistency["consistency_passed"],
                        "❌ 同源一致性检查未通过！列表/详情/摘要/导出/报告数量不一致")
        print("  ✅ 同源一致性检查通过")

        print()
        print("=" * 80)
        print("【Step 7】人工复核：负数当缺失，保留原始说法、改后值、处理原因、下一步找谁")
        print("=" * 80)
        self.system.step2_review_formula(
            batch_id, "alan_ops",
            "对照旧公式截图，高级产品经理P10原为-500，被旧表误标为缺失",
            "旧公式截图_2024_v3.png"
        )
        step3 = self.system.step3_boundary_report(batch_id, "alan_ops", "ta_xiaoming")
        print(f"  创建复核任务数: {len(step3['review_tasks_created'])}")

        pending = self.system.get_pending_review_tasks("ta_xiaoming")
        self.assertGreater(pending["pending_count"], 0)
        print(f"  待复核任务数: {pending['pending_count']}")

        task = pending["tasks"][0]
        record_id = task["record_id"]
        print(f"  选中任务 #{task['task_id']} → 记录 #{record_id}")

        detail_before = self.system.get_detail_view(record_id)
        print(f"  复核前状态: {detail_before['status_label']}")
        print(f"  原始说法: {detail_before['original_values']}")
        print(f"  改前改后差别: {len(detail_before['value_changes'])} 处")
        print(f"  下一步: {detail_before['next_step']}")

        record = self.system.db.get_rating_record(record_id)
        if record.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING:
            corrected_weight_p10 = -500
        else:
            corrected_weight_p10 = 0

        review_result = self.system.ta_review_record(
            task_id=task["task_id"],
            record_id=record_id,
            review_result="经与旧公式截图交叉核对，P10确实是-500，旧表误将负数标记为缺失",
            correction_decision="restore_negative",
            corrected_values={"weight_p10": corrected_weight_p10},
            ta_name="xiaoming"
        )

        self.assertTrue(review_result["evidence_traced"])
        print(f"  复核结论: {review_result['correction_decision']}")
        print(f"  修正值: {review_result['corrected_values']}")
        print(f"  复核后状态: {review_result['updated_status']}")
        print(f"  复核后边界类型: {review_result['updated_boundary_type']}")

        detail_after = self.system.get_detail_view(record_id)
        print()
        print("  【详情视图 - 复核后完整留痕】")
        print(f"    原始行号: {detail_after['original_row_number']}")
        print(f"    原始说法(P10): {detail_after['original_values'].get('weight_p10')}")
        print(f"    改后的值(P10): {detail_after['current_values']['weight_p10']}")
        print(f"    处理原因: {detail_after['processing_reasons'][-1] if detail_after['processing_reasons'] else 'N/A'}")
        print(f"    处理时间线: {len(detail_after['processing_history'])} 步")
        for step in detail_after["processing_history"]:
            print(f"      Step {step['step']}: {step['action']} by {step['operator']} → {step['reason']}")
        print(f"    下一步找谁: {detail_after['next_step'].get('assigned_to', 'N/A')}")

        self.assertIn("xiaoming", str(detail_after["processing_reasons"]),
                      "处理原因里应该有学生助教的名字")
        self.assertIn("-500", str(detail_after["current_values"].get("weight_p10", "")),
                      "改后的值应该是 -500")

        print()
        print("=" * 80)
        print("【Step 8】再次一致性检查（复核后各视图仍一致）")
        print("=" * 80)
        consistency2 = self.system.verify_consistency(batch_id)
        self.assertTrue(consistency2["consistency_passed"],
                        "❌ 复核后同源一致性检查未通过")

        list_after_review = self.system.get_list_view(batch_id)
        item_after = next(
            (i for i in list_after_review["items"] if i["record_id"] == record_id), None
        )
        self.assertEqual(item_after["status"], review_result["updated_status"],
                         "列表的状态应该等于复核结果")
        print(f"  ✅ 复核后列表状态: {item_after['status_label']}")
        print(f"  ✅ 复核后同源一致性通过")

        print()
        print("=" * 80)
        print("【Step 9】导出 CSV + 边界报告（同源）")
        print("=" * 80)
        csv_path = os.path.join(self.test_dir, "export.csv")
        self.system.export_csv(csv_path, batch_id, include_history=True)
        self.assertTrue(os.path.exists(csv_path))
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
        print(f"  CSV 行数（含表头）: {len(lines)}")
        self.assertEqual(len(lines), 21, "20条数据+1行表头 = 21行")

        report = self.system.generate_boundary_report_view(batch_id)
        print(f"  报告总数: {report['total_records']}")
        print(f"  报告边界问题数: {report['boundary_record_count']}")
        self.assertEqual(report["consistency_check"]["report_total_matches_list"], True,
                         "报告总数应该与列表一致")
        print("  ✅ 导出 CSV 和边界报告均同源一致")

        print()
        print("=" * 80)
        print("【Step 10】重复导入同一份文件（哈希相同，不翻倍）")
        print("=" * 80)
        step1_repeat = self.system.step1_import(self.v1, "alan_ops")
        self.assertTrue(step1_repeat["import_result"]["is_duplicate"])
        list_final = self.system.get_list_view(batch_id)
        self.assertEqual(list_final["total_count"], 20,
                         "❌ 重复导入同一份哈希文件也应该不翻倍")
        print(f"  最终总数: {list_final['total_count']}（未翻倍）")
        print("  ✅ 重复导入哈希相同文件，未翻倍")

        print()
        print("=" * 80)
        print("【最终统计】")
        print("=" * 80)
        final_summary = self.system.get_summary_view(batch_id)
        print(f"  总记录数: {final_summary['total_records']}")
        print(f"  按状态: {final_summary['by_status']}")
        print(f"  按边界类型: {final_summary['by_boundary']}")
        print(f"  待复核: {final_summary['pending_review_count']}")
        print(f"  负数被旧表当缺失: {final_summary['negative_as_missing_count']}")
        print(f"  已修正: {final_summary['revised_count']}")
        print()
        print("✅ 端到端集成测试全部通过！")
        print("   列表 / 详情 / 摘要 / 导出 / 报告 全部同源一致")
        print("   只改备注 / 内容不同但业务主键相同 → 不翻倍")
        print("   负数被旧表当缺失 → 留给学生助教复核，未提前归正常")
        print("   原始说法 / 改后值 / 处理原因 / 下一步找谁 → 全留痕")


if __name__ == "__main__":
    unittest.main()
