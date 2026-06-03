import unittest
import os
import tempfile
import shutil
import pandas as pd
from datetime import datetime

from src.processor import ReleaseScheduleProcessor
from src.models import ProcessStatus


class TestFullWorkflow(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.data_dir = os.path.join(self.test_dir, "data")
        os.makedirs(self.data_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def _create_test_excel(self, filename: str, data: list) -> str:
        df = pd.DataFrame(data)
        file_path = os.path.join(self.test_dir, filename)
        df.to_excel(file_path, index=False)
        return file_path

    def test_three_step_workflow(self):
        test_data = [
            {
                "除权日": "2024-01-15",
                "票据号": "BILL001",
                "金额": 1000.0,
                "备注": "正常票据",
            },
            {
                "除权日": "2024-01-15",
                "票据号": "BILL002",
                "金额": 0.0,
                "备注": "已冲正以前票据",
            },
            {
                "除权日": "2024-01-15",
                "票据号": "BILL003",
                "金额": 500.0,
                "备注": "待补税费率",
            },
        ]

        excel_file = self._create_test_excel("ex_dividend.xlsx", test_data)

        processor = ReleaseScheduleProcessor(data_dir=self.data_dir)

        step1_result = processor.step1_import_ex_dividend_screenshot(
            excel_file_path=excel_file,
            operator="操作员小张",
        )

        self.assertEqual(step1_result["total_records"], 3)
        self.assertEqual(step1_result["step"], "step1_import")
        self.assertEqual(
            step1_result["boundary_stats"].get("zero_amount_with_reversal_note", 0),
            1,
        )

        risk_records = processor.get_records_for_risk_review()
        self.assertEqual(len(risk_records), 1)
        self.assertEqual(risk_records[0]["bill_number"], "BILL002")
        self.assertEqual(risk_records[0]["status"], "risk_review_required")
        self.assertEqual(risk_records[0]["original_row_number"], 3)

        target_record_id = None
        for record_id, record in processor.records.items():
            if record.bill_number == "BILL003":
                target_record_id = record_id
                break

        self.assertIsNotNone(target_record_id)

        old_remark = processor.records[target_record_id].remark
        step2_result = processor.step2_risk_review_tax_rate_remark(
            record_id=target_record_id,
            operator="风控值班老秦",
            tax_rate=0.06,
            remark="已补税费率6%，核对完税凭证",
            review_note="核对完税凭证后补录",
        )

        self.assertEqual(step2_result["step"], "step2_risk_review")
        self.assertEqual(step2_result["reviewed_by"], "风控值班老秦")

        updated_record = processor.records[target_record_id]
        self.assertEqual(updated_record.tax_rate, 0.06)
        self.assertEqual(updated_record.remark, "已补税费率6%，核对完税凭证")
        self.assertGreater(len(updated_record.change_history), 1)

        history = processor.get_record_history(target_record_id)
        self.assertIn("remark", history["change_summary"])
        remark_changes = history["change_summary"]["remark"]
        self.assertEqual(len(remark_changes), 1)
        self.assertEqual(remark_changes[0]["old"], old_remark)
        self.assertEqual(remark_changes[0]["operator"], "风控值班老秦")

        step3_result = processor.step3_update_summary_for_manager(
            operator="汇总员小李",
        )

        self.assertEqual(step3_result["step"], "step3_summary")
        self.assertEqual(step3_result["total_records"], 3)
        self.assertEqual(step3_result["risk_review_required_count"], 1)
        self.assertEqual(step3_result["generated_by"], "汇总员小李")

        self.assertIn("boundary_rules", step3_result)
        self.assertIn("records_summary", step3_result)

    def test_duplicate_import_prevention(self):
        test_data = [
            {
                "除权日": "2024-01-15",
                "票据号": "BILL001",
                "金额": 1000.0,
                "备注": "测试",
            },
        ]
        excel_file = self._create_test_excel("test.xlsx", test_data)

        processor = ReleaseScheduleProcessor(data_dir=self.data_dir)
        processor.step1_import_ex_dividend_screenshot(excel_file, operator="test")

        with self.assertRaises(ValueError) as context:
            processor.step1_import_ex_dividend_screenshot(excel_file, operator="test2")

        self.assertIn("文件已在", str(context.exception))
        self.assertIn("批次号", str(context.exception))

    def test_approve_boundary_case(self):
        test_data = [
            {
                "除权日": "2024-01-15",
                "票据号": "BILL001",
                "金额": 0.0,
                "备注": "已冲正",
            },
        ]
        excel_file = self._create_test_excel("test.xlsx", test_data)

        processor = ReleaseScheduleProcessor(data_dir=self.data_dir)
        processor.step1_import_ex_dividend_screenshot(excel_file, operator="test")

        record_id = list(processor.records.keys())[0]
        record = processor.records[record_id]
        self.assertEqual(record.status, ProcessStatus.RISK_REVIEW_REQUIRED)

        result = processor.approve_boundary_case(
            record_id=record_id,
            operator="风控老秦",
            approve_note="确认已冲正，真实业务无误",
        )

        self.assertEqual(result["action"], "approve_boundary_case")
        self.assertEqual(result["approved_by"], "风控老秦")

        updated_record = processor.records[record_id]
        self.assertEqual(updated_record.status, ProcessStatus.NORMAL)

    def test_replay_commands_generation(self):
        test_data = [
            {
                "除权日": "2024-01-15",
                "票据号": "BILL001",
                "金额": 1000.0,
                "备注": "测试",
            },
        ]
        excel_file = self._create_test_excel("test.xlsx", test_data)

        processor = ReleaseScheduleProcessor(data_dir=self.data_dir)
        processor.step1_import_ex_dividend_screenshot(excel_file, operator="操作员A")

        record_id = list(processor.records.keys())[0]
        processor.step2_risk_review_tax_rate_remark(
            record_id=record_id,
            operator="风控老秦",
            tax_rate=0.06,
        )

        commands = processor.generate_replay_commands()

        self.assertGreater(len(commands), 0)
        self.assertTrue(any("step1_import_ex_dividend_screenshot" in cmd for cmd in commands))
        self.assertTrue(any("step2_risk_review_tax_rate_remark" in cmd for cmd in commands))
        self.assertTrue(any("操作员A" in cmd for cmd in commands))
        self.assertTrue(any("风控老秦" in cmd for cmd in commands))

    def test_export_full_report(self):
        test_data = [
            {
                "除权日": "2024-01-15",
                "票据号": "BILL001",
                "金额": 0.0,
                "备注": "已冲正",
            },
        ]
        excel_file = self._create_test_excel("test.xlsx", test_data)

        processor = ReleaseScheduleProcessor(data_dir=self.data_dir)
        processor.step1_import_ex_dividend_screenshot(excel_file, operator="test")

        output_path = os.path.join(self.test_dir, "full_report.json")
        report = processor.export_full_report(output_path=output_path)

        self.assertTrue(os.path.exists(output_path))
        self.assertIn("records", report)
        self.assertIn("import_history", report)
        self.assertIn("boundary_rules", report)
        self.assertIn("replay_commands", report)
        self.assertIn("generated_at", report)


if __name__ == "__main__":
    unittest.main()
