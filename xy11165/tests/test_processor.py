import unittest
from datetime import datetime
from pathlib import Path
import tempfile
import shutil

from visitor_timeout_cli.processor import VisitorProcessor, parse_datetime, parse_bool


class TestParseDatetime(unittest.TestCase):
    def test_parse_valid_formats(self):
        self.assertEqual(parse_datetime("2024-05-19 08:30:00"), datetime(2024, 5, 19, 8, 30, 0))
        self.assertEqual(parse_datetime("2024/05/19 08:30:00"), datetime(2024, 5, 19, 8, 30, 0))
        self.assertEqual(parse_datetime("2024-05-19 08:30"), datetime(2024, 5, 19, 8, 30, 0))

    def test_parse_empty(self):
        self.assertIsNone(parse_datetime(""))
        self.assertIsNone(parse_datetime("   "))

    def test_parse_invalid(self):
        with self.assertRaises(ValueError):
            parse_datetime("无效时间")


class TestParseBool(unittest.TestCase):
    def test_true_values(self):
        self.assertTrue(parse_bool("true"))
        self.assertTrue(parse_bool("1"))
        self.assertTrue(parse_bool("yes"))
        self.assertTrue(parse_bool("是"))
        self.assertTrue(parse_bool("跨楼层"))
        self.assertTrue(parse_bool("手工放行"))

    def test_false_values(self):
        self.assertFalse(parse_bool(""))
        self.assertFalse(parse_bool("false"))
        self.assertFalse(parse_bool("0"))
        self.assertFalse(parse_bool("否"))


class TestVisitorProcessor(unittest.TestCase):
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp())
        self.processor = VisitorProcessor(timeout_hours=8)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_empty_directory(self):
        results = self.processor.process_directory(self.test_dir)
        self.assertEqual(len(results), 0)

    def test_bad_rows_handling(self):
        test_file = self.test_dir / "bad_rows.csv"
        test_file.write_text("""visitor_id,visitor_name,company,visit_floor,checkin_time,checkout_time,is_cross_floor,is_manual_release,remarks
V001,正常用户,测试公司,4F,2024-05-20 09:00:00,2024-05-20 20:00:00,否,否,超时
,缺少ID,坏公司,5F,2024-05-20 10:00:00,2024-05-20 18:00:00,否,否,缺少访客ID
V002,,没有名字,6F,2024-05-20 11:00:00,2024-05-20 19:00:00,否,否,缺少姓名
V003,超时用户,正常公司,8F,2024-05-20 08:00:00,2024-05-20 19:00:00,否,否,正常超时
""")

        results = self.processor.process_directory(self.test_dir)
        self.assertGreaterEqual(len(self.processor.errors), 2)
        self.assertEqual(len(results), 2)

    def test_stable_sort(self):
        test_file = self.test_dir / "test_sort.csv"
        test_file.write_text("""visitor_id,visitor_name,company,visit_floor,checkin_time,checkout_time,is_cross_floor,is_manual_release,remarks
V003,用户C,公司C,5F,2024-05-20 10:00:00,2024-05-20 20:00:00,否,否,超时
V001,用户A,公司A,3F,2024-05-20 08:00:00,2024-05-20 19:00:00,否,否,超时
V002,用户B,公司B,3F,2024-05-20 09:00:00,2024-05-20 18:00:00,否,否,超时
""")

        results1 = self.processor.process_directory(self.test_dir)
        results2 = self.processor.process_directory(self.test_dir)

        self.assertEqual(len(results1), 3)
        self.assertEqual(len(results2), 3)
        self.assertEqual([r.visitor_id for r in results1], [r.visitor_id for r in results2])
        self.assertEqual(results1[0].visitor_id, "V001")
        self.assertEqual(results1[1].visitor_id, "V002")
        self.assertEqual(results1[2].visitor_id, "V003")

    def test_cross_floor_and_manual_release(self):
        test_file = self.test_dir / "special.csv"
        test_file.write_text("""visitor_id,visitor_name,company,visit_floor,checkin_time,checkout_time,is_cross_floor,is_manual_release,remarks
V001,正常用户,公司A,3F,2024-05-20 09:00:00,2024-05-20 17:00:00,否,否,正常
V002,跨楼层用户,公司B,5F,2024-05-20 09:00:00,2024-05-20 17:00:00,是,否,跨楼层
V003,手工放行用户,公司C,7F,2024-05-20 09:00:00,2024-05-20 17:00:00,否,是,手工放行
""")

        results = self.processor.process_directory(self.test_dir)
        self.assertEqual(len(results), 2)
        visitor_ids = [r.visitor_id for r in results]
        self.assertIn("V002", visitor_ids)
        self.assertIn("V003", visitor_ids)
        self.assertNotIn("V001", visitor_ids)

    def test_output_columns_stable(self):
        from visitor_timeout_cli.models import OUTPUT_COLUMNS

        expected = [
            "visitor_id",
            "visitor_name",
            "company",
            "visit_floor",
            "checkin_time",
            "checkout_time",
            "timeout_duration_minutes",
            "is_cross_floor",
            "is_manual_release",
            "remarks",
        ]
        self.assertEqual(OUTPUT_COLUMNS, expected)


if __name__ == "__main__":
    unittest.main()
