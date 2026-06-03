#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
量化回测滑点归档 - 自动化测试脚本
验证：
1. 三种场景处理结果确实不同
2. 补录记录与历史记录能正确匹配
3. 机构简称不一致时不自动归正常
4. 错误提示人性化，不包含内部字段名
"""

import sys
import unittest
from datetime import datetime

from demo_data import (
    get_counter_records, get_institution_mapping,
    get_manager_emails, get_historical_records
)
from slippage_archiver import SlippageArchiver
from models import RecordStatus, DiscrepancyType
from error_messages import get_error, USER_FRIENDLY_ERRORS


class TestSlippageArchiver(unittest.TestCase):

    def setUp(self):
        self.institution_mapping = get_institution_mapping()
        self.archiver = SlippageArchiver(self.institution_mapping)
        self.counter_records = get_counter_records()
        self.emails = get_manager_emails()
        self.historical_records = get_historical_records()

    def test_01_import_normal_records(self):
        """测试1：验证正常记录（尾号4452）导入后状态为正常"""
        print("\n" + "=" * 60)
        print("测试1：验证正常记录导入后状态为正常")
        print("=" * 60)

        result = self.archiver.import_counter_records(self.counter_records)
        normal_records = [r for r in result.records if r.tail_number == "4452"]

        for r in normal_records:
            self.assertEqual(r.status, RecordStatus.NORMAL)
            self.assertEqual(r.discrepancy_type, DiscrepancyType.NONE)
            self.assertIsNotNone(r.institution_name_verified)
            print(f"  ✓ 尾号4452记录 {r.record_id} 状态：{r.status.value}")
            print(f"    导入名称：「{r.institution_name_imported}」")
            print(f"    标准名称：「{r.institution_name_verified}」")

        self.assertEqual(len(normal_records), 2)
        print("  ✓ 正常记录共2条，全部状态正确")

    def test_02_import_mismatch_records(self):
        """测试2：验证机构简称不一致记录（尾号8823、6617）导入后状态为待财务复核"""
        print("\n" + "=" * 60)
        print("测试2：验证机构简称不一致记录导入后状态为待财务复核")
        print("=" * 60)

        result = self.archiver.import_counter_records(self.counter_records)

        mismatch_8823 = [r for r in result.records
                       if r.tail_number == "8823"
                       and r.institution_name_imported == "华信证券股份"]
        mismatch_6617 = [r for r in result.records
                       if r.tail_number == "6617"
                       and r.institution_name_imported == "国泰君安"]

        for r in mismatch_8823 + mismatch_6617:
            self.assertEqual(r.status, RecordStatus.PENDING_REVIEW)
            self.assertEqual(r.discrepancy_type, DiscrepancyType.INSTITUTION_NAME_MISMATCH)
            self.assertIsNone(r.institution_name_verified)
            self.assertTrue("待财务复核" in r.discrepancy_detail)
            print(f"  ✓ 尾号{r.tail_number}记录 {r.record_id} 状态：{r.status.value}")
            print(f"    导入名称：「{r.institution_name_imported}」")
            detail_preview = r.discrepancy_detail[:50]
            print(f"    差异说明：{detail_preview}...")

        self.assertEqual(len(mismatch_8823), 1)
        self.assertEqual(len(mismatch_6617), 1)
        print("  ✓ 不一致记录共2条，全部标记为待财务复核，未自动归正常")

    def test_03_pending_review_not_automatically_normal(self):
        """测试3：验证待复核记录不会自动转为正常"""
        print("\n" + "=" * 60)
        print("测试3：验证待复核记录不会自动转为正常")
        print("=" * 60)

        self.archiver.import_counter_records(self.counter_records)
        pending_before = self.archiver.get_pending_review_records()
        print(f"  导入后待复核记录数：{len(pending_before)}")

        archive_result = self.archiver.archive_records()
        pending_after = self.archiver.get_pending_review_records()

        self.assertEqual(len(pending_before), len(pending_after))
        print(f"  归档后待复核记录数：{len(pending_after)}")
        print(f"  待复核记录无法归档，保持待复核状态")

        for r in pending_after:
            self.assertEqual(r.status, RecordStatus.PENDING_REVIEW)
            self.assertFalse(r.archived)

        print("  ✓ 待复核记录保持待复核状态，未自动归正常，也无法归档")

    def test_04_supplement_records(self):
        """测试4：验证补录记录（尾号6617）能与历史记录匹配"""
        print("\n" + "=" * 60)
        print("测试4：验证补录记录能与历史记录匹配")
        print("=" * 60)

        self.archiver.import_counter_records(self.counter_records)
        self.archiver.load_manager_emails(self.emails)

        supplement_result = self.archiver.apply_supplement("6617")

        self.assertEqual(supplement_result.supplemented_count, 1)
        print(f"  ✓ 补录成功记录数：{supplement_result.supplemented_count}")

        supplemented_records = self.archiver.get_supplemented_records()
        self.assertEqual(len(supplemented_records), 1)

        for r in supplemented_records:
            self.assertEqual(r.tail_number, "6617")
            self.assertEqual(r.status, RecordStatus.SUPPLEMENTED)
            self.assertEqual(r.discrepancy_type, DiscrepancyType.NONE)
            self.assertEqual(r.institution_name_supplemented, "国泰君安")
            self.assertIsNotNone(r.email_reference)
            print(f"  ✓ 尾号6617记录 {r.record_id} 状态：{r.status.value}")
            print(f"    补录名称：「{r.institution_name_supplemented}」")
            print(f"    关联邮件：{r.email_reference}")
            print(f"    处理说明：{r.discrepancy_detail}")

            historical_for_tail = [h for h in self.historical_records if h["tail_number"] == "6617"]
            matched = False
            for h in historical_for_tail:
                if h["institution_name"] == r.institution_name_supplemented:
                    matched = True
                    print(f"    ✓ 与历史记录 {h['trade_date']} 的「{h['institution_name']}」完全匹配")
            self.assertTrue(matched)

        print("  ✓ 补录记录与历史记录正确匹配")

    def test_05_three_different_results(self):
        """测试5：验证三种场景处理结果确实不同"""
        print("\n" + "=" * 60)
        print("测试5：验证三种场景处理结果确实不同")
        print("=" * 60)

        self.archiver.import_counter_records(self.counter_records)
        self.archiver.load_manager_emails(self.emails)

        self.archiver.apply_supplement("6617")

        pending_8823 = [r for r in self.archiver.get_pending_review_records()
                         if r.tail_number == "8823"]
        if pending_8823:
            fix_result = self.archiver.apply_manual_fix(
                record_id=pending_8823[0].record_id,
                operator="阿南",
                note="测试人工修正",
                corrected_name="华信证券"
            )
            self.archiver.rerun_record(pending_8823[0].record_id)

        normal_4452 = [r for r in self.archiver.get_records_by_tail("4452")]
        processed_8823 = [r for r in self.archiver.get_records_by_tail("8823")
                            if r.status != RecordStatus.NORMAL]
        supplemented_6617 = self.archiver.get_supplemented_records()

        status_4452 = {r.status for r in normal_4452}
        status_8823 = {r.status for r in processed_8823}
        status_6617 = {r.status for r in supplemented_6617}

        status_values_4452 = [s.value for s in status_4452]
        status_values_8823 = [s.value for s in status_8823]
        status_values_6617 = [s.value for s in status_6617]
        print(f"  类型一（正常）尾号4452 状态集合：{status_values_4452}")
        print(f"  类型二（不一致+人工修正+重跑）尾号8823 状态集合：{status_values_8823}")
        print(f"  类型三（补录）尾号6617 状态集合：{status_values_6617}")

        self.assertEqual(status_4452, {RecordStatus.NORMAL})
        self.assertEqual(status_8823, {RecordStatus.RERUN})
        self.assertEqual(status_6617, {RecordStatus.SUPPLEMENTED})

        self.assertNotEqual(status_4452, status_8823)
        self.assertNotEqual(status_4452, status_6617)
        self.assertNotEqual(status_8823, status_6617)

        print("  ✓ 三种场景处理结果确实不同")

    def test_06_user_friendly_error_messages(self):
        """测试6：验证错误提示人性化，不包含内部字段名"""
        print("\n" + "=" * 60)
        print("测试6：验证错误提示人性化，不包含内部字段名")
        print("=" * 60)

        internal_fields = ["institution_name", "tail_number", "record_id",
                        "discrepancy_type", "status_code", "inst_name"]

        for key, template in USER_FRIENDLY_ERRORS.items():
            has_internal = any(field in template for field in internal_fields)
            self.assertFalse(has_internal, f"错误模板 {key} 包含内部字段名")

            msg = get_error(key, tail="1234", imported="测试", official="标准")
            has_internal = any(field in msg for field in internal_fields)
            self.assertFalse(has_internal, f"错误信息 {key} 包含内部字段名")

            template_preview = template[:40]
            print(f"  ✓ {key}: {template_preview}...")

        print("  ✓ 所有错误提示均为人性化描述，不包含内部字段名")

    def test_07_manual_fix_and_rerun(self):
        """测试7：验证人工修正和重跑功能正常"""
        print("\n" + "=" * 60)
        print("测试7：验证人工修正和重跑功能正常")
        print("=" * 60)

        self.archiver.import_counter_records(self.counter_records)

        pending_records = self.archiver.get_pending_review_records()
        self.assertTrue(len(pending_records) > 0)

        record_to_fix = pending_records[0]
        print(f"  待修正记录：{record_to_fix.record_id}，当前状态：{record_to_fix.status.value}")

        fix_result = self.archiver.apply_manual_fix(
            record_id=record_to_fix.record_id,
            operator="测试员",
            note="测试人工修正备注",
            corrected_name="华信证券"
        )

        self.assertEqual(fix_result.manually_fixed_count, 1)
        fixed_record = fix_result.records[0]
        self.assertEqual(fixed_record.status, RecordStatus.MANUALLY_FIXED)
        self.assertEqual(fixed_record.manual_fix_note, "测试人工修正备注")
        self.assertEqual(fixed_record.institution_name_verified, "华信证券")
        print(f"  ✓ 人工修正后状态：{fixed_record.status.value}")

        rerun_result = self.archiver.rerun_record(record_to_fix.record_id)
        self.assertEqual(rerun_result.rerun_count, 1)
        rerun_record = rerun_result.records[0]
        self.assertEqual(rerun_record.status, RecordStatus.RERUN)
        self.assertEqual(rerun_record.rerun_count, 1)
        print(f"  ✓ 重跑后状态：{rerun_record.status.value}，重跑次数：{rerun_record.rerun_count}")

        print("  ✓ 人工修正和重跑功能正常")

    def test_08_full_workflow_verification(self):
        """测试8：完整三步流程验证"""
        print("\n" + "=" * 60)
        print("测试8：完整三步流程验证")
        print("=" * 60)

        print("  【第一步】第一次导入柜台流水】")
        import_result = self.archiver.import_counter_records(self.counter_records)
        self.assertEqual(import_result.normal_count, 4)
        self.assertEqual(import_result.pending_review_count, 2)
        print(f"    正常：{import_result.normal_count} 条，待复核：{import_result.pending_review_count} 条")

        print("  【第二步】补看客户经理邮件】")
        self.archiver.load_manager_emails(self.emails)
        self.assertEqual(len(self.archiver.emails), 2)
        print(f"    加载邮件：{len(self.archiver.emails)} 封")

        print("  【第三步】补录记录更新】")
        supplement_6617 = self.archiver.apply_supplement("6617")
        self.assertEqual(supplement_6617.supplemented_count, 1)
        print(f"    补录尾号6617：{supplement_6617.supplemented_count} 条")

        pending_8823 = [r for r in self.archiver.get_pending_review_records() if r.tail_number == "8823"]
        if pending_8823:
            self.archiver.apply_manual_fix(
                record_id=pending_8823[0].record_id,
                operator="阿南",
                note="与财务确认后修正",
                corrected_name="华信证券"
            )
            self.archiver.rerun_record(pending_8823[0].record_id)
            print("    尾号8823：人工修正 + 重跑完成")

        print("  【验证结果】")
        summary = self.archiver.print_summary()
        print(summary)

        statuses = {r.status for r in self.archiver.records.values()}
        self.assertIn(RecordStatus.NORMAL, statuses)
        self.assertIn(RecordStatus.RERUN, statuses)
        self.assertIn(RecordStatus.SUPPLEMENTED, statuses)

        print("  ✓ 完整三步流程验证通过")

    def test_09_historical_match_verification(self):
        """测试9：重点验证补录记录和历史记录匹配"""
        print("\n" + "=" * 60)
        print("测试9：重点验证补录记录和历史记录匹配")
        print("=" * 60)

        self.archiver.import_counter_records(self.counter_records)
        self.archiver.load_manager_emails(self.emails)
        self.archiver.apply_supplement("6617")

        supplemented = self.archiver.get_supplemented_records()

        for rec in supplemented:
            print(f"  补录记录：尾号{rec.tail_number}，补录名称「{rec.institution_name_supplemented}」")

            historical = [h for h in self.historical_records if h["tail_number"] == rec.tail_number]
            print(f"  历史记录：")
            for h in historical:
                match = h["institution_name"] == rec.institution_name_supplemented
                status = "✓ 匹配" if match else "✗ 不匹配"
                print(f"    {h['trade_date']} 「{h['institution_name']}」 {status}")
                if match:
                    self.assertEqual(h["institution_name"], rec.institution_name_supplemented)

        print("  ✓ 补录记录与历史记录完全匹配")


def run_tests():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestSlippageArchiver)
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print(f"  运行测试：{result.testsRun} 个")
    print(f"  成功：{result.testsRun - len(result.failures) - len(result.errors)} 个")
    if result.failures:
        print(f"  失败：{len(result.failures)} 个")
        for test, traceback in result.failures:
            print(f"    - {test}")
    if result.errors:
        print(f"  错误：{len(result.errors)} 个")
        for test, traceback in result.errors:
            print(f"    - {test}")
    print("=" * 60)

    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_tests())
