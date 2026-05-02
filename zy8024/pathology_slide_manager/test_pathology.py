import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Database
from importer import DataImporter
from state_machine import SlideStateMachine, RuleEngine
from reporter import ReportGenerator
from models import Slide, BorrowRecord, DepartmentRule, SlideStatus, ValidationResult


class TestDatabase(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")

    def test_insert_slides(self):
        slides = [
            Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01"),
            Slide("S002", "P002", "IHC", "2024-01-02", "肿瘤科", "A-02")
        ]
        inserted, updated = self.db.insert_slides(slides)
        self.assertEqual(inserted, 2)
        self.assertEqual(updated, 0)

        slides[0].notes = "updated"
        inserted, updated = self.db.insert_slides([slides[0]])
        self.assertEqual(inserted, 0)
        self.assertEqual(updated, 1)

    def test_insert_borrow_record(self):
        record = BorrowRecord(
            "R001", "S001", "张三", "肿瘤科",
            "2024-02-01", "2024-02-08",
            status=SlideStatus.BORROWED
        )
        result = self.db.insert_borrow_record(record)
        self.assertTrue(result)

    def test_get_slide(self):
        slide = Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01")
        self.db.insert_slides([slide])

        retrieved = self.db.get_slide("S001")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.slide_id, "S001")
        self.assertEqual(retrieved.patient_id, "P001")

    def test_get_active_borrow(self):
        slide = Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01")
        self.db.insert_slides([slide])

        record = BorrowRecord(
            "R001", "S001", "张三", "肿瘤科",
            "2024-02-01", "2024-02-08",
            status=SlideStatus.BORROWED
        )
        self.db.insert_borrow_record(record)

        active = self.db.get_active_borrow_by_slide("S001")
        self.assertIsNotNone(active)
        self.assertEqual(active.record_id, "R001")

    def test_department_rules(self):
        rules = [
            DepartmentRule("肿瘤科", 14, 3),
            DepartmentRule("外科", 10, 2)
        ]
        inserted, updated = self.db.insert_department_rules(rules)
        self.assertEqual(inserted, 2)

        rule = self.db.get_department_rule("肿瘤科")
        self.assertIsNotNone(rule)
        self.assertEqual(rule.max_borrow_days, 14)

    def test_statistics(self):
        slides = [
            Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01"),
            Slide("S002", "P002", "IHC", "2024-01-02", "肿瘤科", "A-02")
        ]
        self.db.insert_slides([slides[0]])

        stats = self.db.get_statistics()
        self.assertEqual(stats['total_slides'], 1)
        self.assertEqual(stats['available'], 1)


class TestDataImporter(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")

    def test_parse_date(self):
        importer = DataImporter(self.db)

        self.assertEqual(importer.parse_date("2024-01-15"), "2024-01-15")
        self.assertEqual(importer.parse_date("2024/01/15"), "2024-01-15")
        self.assertEqual(importer.parse_date("2024-01-15 10:30:00"), "2024-01-15")
        self.assertIsNone(importer.parse_date("invalid"))

    def test_validate_slide_csv_missing_fields(self):
        importer = DataImporter(self.db)
        result = importer.validate_slide_csv("nonexistent.csv")
        self.assertFalse(result.is_valid)


class TestStateMachine(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.state_machine = SlideStateMachine(self.db)

        self.slide = Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01")
        self.db.insert_slides([self.slide])

    def test_valid_borrow(self):
        ok, msg, record = self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="张三",
            borrower_dept="肿瘤科"
        )
        self.assertTrue(ok)
        self.assertIsNotNone(record)

    def test_duplicate_borrow_rejected(self):
        self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="张三",
            borrower_dept="肿瘤科",
            record_id="R001"
        )

        ok, msg, record = self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="李四",
            borrower_dept="外科",
            record_id="R002"
        )
        self.assertFalse(ok)
        self.assertIn("已有借阅", msg)

    def test_return_before_borrow_rejected(self):
        self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="张三",
            borrower_dept="肿瘤科",
            borrow_date="2024-02-01",
            record_id="R001"
        )

        ok, msg = self.state_machine.execute_return(
            record_id="R001",
            actual_return_date="2024-01-15"
        )
        self.assertFalse(ok)
        self.assertIn("早于", msg)

    def test_valid_return(self):
        self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="张三",
            borrower_dept="肿瘤科",
            borrow_date="2024-02-01",
            expected_return_date="2024-02-08",
            record_id="R001"
        )

        ok, msg = self.state_machine.execute_return(
            record_id="R001",
            actual_return_date="2024-02-05"
        )
        self.assertTrue(ok)
        self.assertIn("归还", msg)

    def test_overdue_return(self):
        self.state_machine.execute_borrow(
            slide_id="S001",
            borrower_name="张三",
            borrower_dept="肿瘤科",
            borrow_date="2024-02-01",
            expected_return_date="2024-02-08",
            record_id="R001"
        )

        ok, msg = self.state_machine.execute_return(
            record_id="R001",
            actual_return_date="2024-02-15"
        )
        self.assertTrue(ok)
        self.assertIn("逾期", msg)


class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.rule_engine = RuleEngine(self.db)

        rule = DepartmentRule("肿瘤科", 14, 3)
        self.db.insert_department_rules([rule])

        self.slide = Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01")
        self.db.insert_slides([self.slide])

    def test_borrow_limit(self):
        ok, msg = self.rule_engine.check_borrow_limit("肿瘤科")
        self.assertTrue(ok)

        for i in range(3):
            slide = Slide(f"S00{i+2}", f"P00{i+2}", "HE", "2024-01-01", "病理科", f"A-0{i+2}")
            self.db.insert_slides([slide])
            sm = SlideStateMachine(self.db)
            sm.execute_borrow(
                slide_id=f"S00{i+2}",
                borrower_name=f"借阅人{i+1}",
                borrower_dept="肿瘤科",
                record_id=f"R00{i+1}"
            )

        ok, msg = self.rule_engine.check_borrow_limit("肿瘤科")
        self.assertFalse(ok)
        self.assertIn("超过", msg)

    def test_expected_return_date_calculation(self):
        borrow_date = "2024-02-01"
        expected = self.rule_engine.get_expected_return_date("肿瘤科", borrow_date)

        expected_dt = datetime.strptime(expected, "%Y-%m-%d")
        borrow_dt = datetime.strptime(borrow_date, "%Y-%m-%d")

        self.assertEqual((expected_dt - borrow_dt).days, 14)

    def test_overdue_detection(self):
        slide = Slide("S002", "P002", "IHC", "2024-01-15", "肿瘤科", "B-01")
        self.db.insert_slides([slide])

        sm = SlideStateMachine(self.db)
        sm.execute_borrow(
            slide_id="S002",
            borrower_name="测试",
            borrower_dept="肿瘤科",
            borrow_date="2024-01-01",
            expected_return_date="2024-01-10",
            record_id="OVERDUE_TEST"
        )

        overdue = self.rule_engine.check_overdue_slides()
        self.assertEqual(len(overdue), 1)
        self.assertEqual(overdue[0]['slide_id'], "S002")


class TestReporter(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")
        self.reporter = ReportGenerator(self.db)

        slides = [
            Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01"),
            Slide("S002", "P002", "IHC", "2024-01-02", "肿瘤科", "A-02")
        ]
        self.db.insert_slides(slides)

        sm = SlideStateMachine(self.db)
        sm.execute_borrow("S001", "张三", "肿瘤科", borrow_date="2024-02-01",
                         expected_return_date="2024-02-10", record_id="R001")
        sm.execute_return("R001", "2024-02-08")

    def test_generate_markdown_report(self):
        records = self.db.get_borrow_records(status=SlideStatus.RETURNED)
        report = self.reporter.generate_handover_markdown(records)

        self.assertIn("切片交接报告", report)
        self.assertIn("S001", report)
        self.assertIn("张三", report)

    def test_generate_csv_report(self):
        records = self.db.get_borrow_records(status=SlideStatus.RETURNED)
        report = self.reporter.generate_handover_csv(records)

        lines = report.strip().split('\n')
        self.assertEqual(len(lines), 2)
        self.assertIn("切片ID", lines[0])
        self.assertIn("S001", lines[1])


class TestEdgeCases(unittest.TestCase):
    def setUp(self):
        self.db = Database(":memory:")

    def test_same_slide_different_record_ids(self):
        slides = [Slide("S001", "P001", "HE", "2024-01-01", "病理科", "A-01")]
        self.db.insert_slides(slides)

        sm = SlideStateMachine(self.db)

        ok1, _, record1 = sm.execute_borrow("S001", "张三", "肿瘤科", record_id="R001")
        self.assertTrue(ok1)

        ok2, msg2, record2 = sm.execute_borrow("S001", "李四", "外科", record_id="R002")
        self.assertFalse(ok2)
        self.assertIn("已有借阅", msg2)

    def test_return_without_borrow(self):
        sm = SlideStateMachine(self.db)
        ok, msg = sm.execute_return("NONEXISTENT", "2024-02-01")
        self.assertFalse(ok)

    def test_borrow_nonexistent_slide(self):
        sm = SlideStateMachine(self.db)
        ok, msg, _ = sm.execute_borrow("NONEXISTENT", "张三", "肿瘤科")
        self.assertFalse(ok)
        self.assertIn("不存在", msg)

    def test_batch_return_empty_list(self):
        sm = SlideStateMachine(self.db)
        success, failed, errors = sm.batch_return([])
        self.assertEqual(success, 0)
        self.assertEqual(failed, 0)


def run_tests():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestDatabase))
    suite.addTests(loader.loadTestsFromTestCase(TestDataImporter))
    suite.addTests(loader.loadTestsFromTestCase(TestStateMachine))
    suite.addTests(loader.loadTestsFromTestCase(TestRuleEngine))
    suite.addTests(loader.loadTestsFromTestCase(TestReporter))
    suite.addTests(loader.loadTestsFromTestCase(TestEdgeCases))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
