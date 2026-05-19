import os
import sys
import tempfile
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pharmacy_inventory.models import Database, InventoryRecord, RecordStatus, ProductType, AbnormalType
from pharmacy_inventory.service import InventoryService
from pharmacy_inventory.report import ReportGenerator


class TestInventorySystem(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.mktemp(suffix='.db')
        self.db = Database(self.temp_db)
        self.service = InventoryService(self.db)
        self.report_gen = ReportGenerator(self.db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_receive_product_normal(self):
        result = self.service.receive_product(
            batch_no="TEST001",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.status, RecordStatus.RECEIVED.value)
        self.assertEqual(result.record.abnormal_type, AbnormalType.NORMAL.value)

    def test_receive_product_temperature_abnormal(self):
        result = self.service.receive_product(
            batch_no="TEST002",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=15.0,
            receiver="张药师"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.abnormal_type, AbnormalType.TEMPERATURE_ABNORMAL.value)

    def test_receive_product_damaged(self):
        result = self.service.receive_product(
            batch_no="TEST003",
            product_type="insulin",
            product_name="胰岛素",
            quantity=50,
            temperature=4.0,
            receiver="李药师",
            is_damaged=True,
            damage_description="外包装破损"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.abnormal_type, AbnormalType.PACKAGE_DAMAGED.value)

    def test_receive_duplicate_batch(self):
        self.service.receive_product(
            batch_no="TEST004",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.receive_product(
            batch_no="TEST004",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.assertTrue(result.success)
        self.assertTrue(result.is_idempotent)
        self.assertIn("幂等性", result.message)

    def test_receive_idempotency(self):
        result1 = self.service.receive_product(
            batch_no="TEST005",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.assertTrue(result1.success)
        self.assertFalse(result1.is_idempotent)

        result2 = self.service.receive_product(
            batch_no="TEST005",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.assertTrue(result2.is_idempotent)

    def test_receive_duplicate_different_params(self):
        self.service.receive_product(
            batch_no="TEST006",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.receive_product(
            batch_no="TEST006",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=200,
            temperature=5.0,
            receiver="张药师"
        )
        self.assertFalse(result.success)
        self.assertIn("已存在", result.message)

    def test_isolate_product(self):
        self.service.receive_product(
            batch_no="TEST007",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.isolate_product(
            batch_no="TEST007",
            product_type="vaccine",
            handler="王主管"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.status, RecordStatus.ISOLATED.value)

    def test_review_product(self):
        self.service.receive_product(
            batch_no="TEST007",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.review_product(
            batch_no="TEST007",
            product_type="vaccine",
            handler="王主管"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.status, RecordStatus.REVIEWED.value)

    def test_release_product_normal(self):
        self.service.receive_product(
            batch_no="TEST008",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.service.review_product(
            batch_no="TEST008",
            product_type="vaccine",
            handler="王主管"
        )

        result = self.service.release_product(
            batch_no="TEST008",
            product_type="vaccine",
            handler="王主管"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.status, RecordStatus.RELEASED.value)

    def test_release_product_abnormal(self):
        self.service.receive_product(
            batch_no="TEST009",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=15.0,
            receiver="张药师"
        )
        self.service.review_product(
            batch_no="TEST009",
            product_type="vaccine",
            handler="王主管"
        )

        result = self.service.release_product(
            batch_no="TEST009",
            product_type="vaccine",
            handler="王主管"
        )
        self.assertFalse(result.success)
        self.assertIn("异常", result.message)

    def test_return_product(self):
        self.service.receive_product(
            batch_no="TEST010",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.return_product(
            batch_no="TEST010",
            product_type="vaccine",
            handler="王主管",
            notes="厂家召回"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.record.status, RecordStatus.RETURNED.value)

    def test_invalid_status_transition(self):
        self.service.receive_product(
            batch_no="TEST011",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        result = self.service.release_product(
            batch_no="TEST011",
            product_type="vaccine",
            handler="王主管"
        )
        self.assertFalse(result.success)
        self.assertIn("已复核", result.message)

    def test_batch_receive(self):
        items = [
            {
                "batch_no": "BATCH001",
                "product_type": "vaccine",
                "product_name": "乙肝疫苗",
                "quantity": 50,
                "temperature": 4.0,
                "receiver": "张药师"
            },
            {
                "batch_no": "BATCH002",
                "product_type": "insulin",
                "product_name": "胰岛素",
                "quantity": 30,
                "temperature": 6.0,
                "receiver": "李药师"
            },
            {
                "batch_no": "BATCH001",
                "product_type": "vaccine",
                "product_name": "乙肝疫苗",
                "quantity": 50,
                "temperature": 4.0,
                "receiver": "张药师"
            }
        ]

        result = self.service.batch_receive(items)
        self.assertEqual(result.total_count, 3)
        self.assertEqual(result.success_count, 3)
        self.assertEqual(result.failed_count, 0)

    def test_query_records_by_receiver(self):
        self.service.receive_product(
            batch_no="QUERY001",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.service.receive_product(
            batch_no="QUERY002",
            product_type="insulin",
            product_name="胰岛素",
            quantity=50,
            temperature=4.0,
            receiver="李药师"
        )

        records = self.report_gen.query_records(receiver="张药师")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].batch_no, "QUERY001")

    def test_query_records_by_status(self):
        self.service.receive_product(
            batch_no="QUERY003",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.service.review_product(
            batch_no="QUERY003",
            product_type="vaccine",
            handler="王主管"
        )

        records = self.report_gen.query_records(status=RecordStatus.REVIEWED.value)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].status, RecordStatus.REVIEWED.value)

    def test_query_records_by_product_type(self):
        self.service.receive_product(
            batch_no="QUERY004",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.service.receive_product(
            batch_no="QUERY005",
            product_type="insulin",
            product_name="胰岛素",
            quantity=50,
            temperature=4.0,
            receiver="李药师"
        )

        records = self.report_gen.query_records(product_type=ProductType.VACCINE.value)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].product_type, ProductType.VACCINE.value)

    def test_generate_summary(self):
        self.service.receive_product(
            batch_no="SUM001",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )
        self.service.receive_product(
            batch_no="SUM002",
            product_type="insulin",
            product_name="胰岛素",
            quantity=50,
            temperature=4.0,
            receiver="李药师",
            is_damaged=True
        )

        records = self.report_gen.query_records()
        summary = self.report_gen.generate_summary(records)

        self.assertEqual(summary["total_count"], 2)
        self.assertEqual(summary["total_quantity"], 150)
        self.assertIn("vaccine", summary["by_product_type"])
        self.assertIn("insulin", summary["by_product_type"])
        self.assertIn(AbnormalType.NORMAL.value, summary["by_abnormal_type"])
        self.assertIn(AbnormalType.PACKAGE_DAMAGED.value, summary["by_abnormal_type"])

    def test_export_csv(self):
        self.service.receive_product(
            batch_no="EXPORT001",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        records = self.report_gen.query_records()
        csv_content = self.report_gen.export_to_csv(records)

        self.assertIsNotNone(csv_content)
        self.assertIn("EXPORT001", csv_content)
        self.assertIn("新冠疫苗", csv_content)

    def test_export_json(self):
        self.service.receive_product(
            batch_no="EXPORT002",
            product_type="vaccine",
            product_name="新冠疫苗",
            quantity=100,
            temperature=5.0,
            receiver="张药师"
        )

        records = self.report_gen.query_records()
        json_content = self.report_gen.export_to_json(records)

        self.assertIsNotNone(json_content)
        self.assertIn("EXPORT002", json_content)
        self.assertIn("summary", json_content)


if __name__ == "__main__":
    unittest.main()
