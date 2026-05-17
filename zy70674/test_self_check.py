#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base, Bed, Patient, Admission, TransferRecord, TurnoverInterval, TurnoverReport
from services import generate_turnover_report, review_intervals, export_report_to_excel, calculate_duration_hours
from schemas import TurnoverCalculationRequest


class TestBedTurnoverSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)
    
    def setUp(self):
        self.db = self.Session()
    
    def tearDown(self):
        self.db.rollback()
        self.db.close()
    
    def test_1_calculate_duration_hours(self):
        print("\n[测试1] 时间区间时长计算")
        start = datetime(2024, 1, 1, 8, 0, 0)
        end = datetime(2024, 1, 2, 8, 0, 0)
        duration = calculate_duration_hours(start, end)
        self.assertEqual(duration, 24.0)
        print(f"  ✓ 24小时计算正确: {duration}")
        
        end = datetime(2024, 1, 1, 8, 30, 0)
        duration = calculate_duration_hours(start, end)
        self.assertEqual(duration, 0.5)
        print(f"  ✓ 30分钟计算正确: {duration}")
    
    def test_2_bed_management(self):
        print("\n[测试2] 床位管理")
        bed = Bed(
            bed_number="ICU-001",
            ward="ICU",
            department="重症医学科",
            bed_type="监护床",
            is_active=True
        )
        self.db.add(bed)
        self.db.commit()
        
        saved = self.db.query(Bed).filter_by(bed_number="ICU-001").first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.ward, "ICU")
        print(f"  ✓ 床位创建成功: {saved.bed_number}")
        
        bed2 = Bed(
            bed_number="ICU-002",
            ward="ICU",
            department="重症医学科",
            bed_type="普通床"
        )
        bed3 = Bed(
            bed_number="WARD-001",
            ward="内科一病区",
            department="内科",
            bed_type="普通床"
        )
        self.db.add_all([bed2, bed3])
        self.db.commit()
        print(f"  ✓ 批量创建床位成功")
    
    def test_3_patient_management(self):
        print("\n[测试3] 患者管理")
        patient = Patient(
            patient_id="P001",
            name="张三",
            gender="男",
            age=45,
            diagnosis="肺炎"
        )
        self.db.add(patient)
        self.db.commit()
        
        saved = self.db.query(Patient).filter_by(patient_id="P001").first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.name, "张三")
        print(f"  ✓ 患者创建成功: {saved.patient_id} - {saved.name}")
    
    def test_4_admission_management(self):
        print("\n[测试4] 入院管理")
        patient = Patient(
            patient_id="P002",
            name="李四",
            gender="女",
            age=60
        )
        bed = Bed(
            bed_number="ICU-003",
            ward="ICU",
            department="重症医学科"
        )
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM001",
            patient_id="P002",
            bed_id=bed.id,
            ward="ICU",
            department="重症医学科",
            admission_time=datetime(2024, 1, 1, 10, 0),
            discharge_time=datetime(2024, 1, 5, 14, 0),
            status="active"
        )
        self.db.add(admission)
        self.db.commit()
        
        saved = self.db.query(Admission).filter_by(admission_number="ADM001").first()
        self.assertIsNotNone(saved)
        duration = calculate_duration_hours(saved.admission_time, saved.discharge_time)
        print(f"  ✓ 入院记录创建成功，住院时长: {duration}小时")
    
    def test_5_transfer_record(self):
        print("\n[测试5] 转科记录与区间拆分")
        patient = Patient(patient_id="P003", name="王五")
        bed1 = Bed(bed_number="ICU-004", ward="ICU", department="重症医学科")
        bed2 = Bed(bed_number="WARD-002", ward="内科一病区", department="内科")
        self.db.add_all([patient, bed1, bed2])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM002",
            patient_id="P003",
            bed_id=bed1.id,
            ward="ICU",
            department="重症医学科",
            admission_time=datetime(2024, 1, 1, 8, 0),
            discharge_time=datetime(2024, 1, 10, 16, 0)
        )
        self.db.add(admission)
        self.db.commit()
        
        transfer = TransferRecord(
            admission_number="ADM002",
            patient_id="P003",
            from_ward="ICU",
            to_ward="内科一病区",
            from_bed_id=bed1.id,
            to_bed_id=bed2.id,
            transfer_time=datetime(2024, 1, 5, 10, 0),
            transfer_reason="病情好转，转普通病房"
        )
        self.db.add(transfer)
        self.db.commit()
        
        saved = self.db.query(TransferRecord).filter_by(admission_number="ADM002").first()
        self.assertIsNotNone(saved)
        print(f"  ✓ 转科记录创建成功: {saved.from_ward} -> {saved.to_ward}")
    
    def test_6_pre_discharge_marking(self):
        print("\n[测试6] 预出院标记")
        patient = Patient(patient_id="P004", name="赵六")
        bed = Bed(bed_number="WARD-003", ward="内科一病区", department="内科")
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM003",
            patient_id="P004",
            bed_id=bed.id,
            ward="内科一病区",
            department="内科",
            admission_time=datetime(2024, 1, 3, 9, 0),
            discharge_time=datetime(2024, 1, 8, 11, 0),
            is_pre_discharge=True,
            pre_discharge_time=datetime(2024, 1, 8, 8, 0)
        )
        self.db.add(admission)
        self.db.commit()
        
        saved = self.db.query(Admission).filter_by(admission_number="ADM003").first()
        self.assertTrue(saved.is_pre_discharge)
        print(f"  ✓ 预出院标记成功，预出院时间: {saved.pre_discharge_time}")
    
    def test_7_abnormal_interval_detection(self):
        print("\n[测试7] 异常区间检测（临时占床）")
        ward = "异常检测病区"
        patient = Patient(patient_id="P005", name="钱七")
        bed = Bed(bed_number="ABN-001", ward=ward, department="内科")
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM004",
            patient_id="P005",
            bed_id=bed.id,
            ward=ward,
            department="内科",
            admission_time=datetime(2024, 1, 4, 14, 0),
            discharge_time=datetime(2024, 1, 4, 14, 30)
        )
        self.db.add(admission)
        self.db.commit()
        
        request = TurnoverCalculationRequest(
            ward=ward,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            abnormal_threshold_hours=24.0
        )
        
        report, intervals = generate_turnover_report(self.db, request)
        self.assertEqual(report.abnormal_intervals, 1)
        
        abnormal = [i for i in intervals if i.is_abnormal]
        self.assertTrue(len(abnormal) > 0)
        print(f"  ✓ 异常区间检测成功，检测到 {len(abnormal)} 个异常")
        print(f"    异常原因: {abnormal[0].abnormal_reason}")
        print(f"    时长: {abnormal[0].duration_hours}小时")
    
    def test_8_turnover_report_generation(self):
        print("\n[测试8] 周转报告生成")
        ward = "ICU"
        
        patients = [
            Patient(patient_id=f"P8{i:02d}", name=f"患者{i}")
            for i in range(1, 6)
        ]
        beds = [
            Bed(bed_number=f"RPT-{i:03d}", ward=ward, department="重症医学科")
            for i in range(1, 6)
        ]
        self.db.add_all(patients + beds)
        self.db.commit()
        
        admissions = []
        for i in range(5):
            admission = Admission(
                admission_number=f"ADM10{i}",
                patient_id=patients[i].patient_id,
                bed_id=beds[i].id,
                ward=ward,
                department="重症医学科",
                admission_time=datetime(2024, 1, i + 1, 8, 0),
                discharge_time=datetime(2024, 1, i + 4, 16, 0)
            )
            admissions.append(admission)
        self.db.add_all(admissions)
        self.db.commit()
        
        transfer = TransferRecord(
            admission_number="ADM100",
            patient_id="P101",
            from_ward=ward,
            to_ward="内科一病区",
            from_bed_id=beds[0].id,
            to_bed_id=beds[0].id + 10,
            transfer_time=datetime(2024, 1, 3, 10, 0)
        )
        self.db.add(transfer)
        self.db.commit()
        
        request = TurnoverCalculationRequest(
            ward=ward,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            report_name="ICU一月周转报告",
            abnormal_threshold_hours=24.0
        )
        
        report, intervals = generate_turnover_report(self.db, request)
        
        self.assertIsNotNone(report.report_id)
        self.assertEqual(report.ward, ward)
        self.assertTrue(report.total_intervals > 0)
        print(f"  ✓ 周转报告生成成功")
        print(f"    报告ID: {report.report_id}")
        print(f"    总区间数: {report.total_intervals}")
        print(f"    异常区间数: {report.abnormal_intervals}")
        print(f"    转科次数: {report.transfer_count}")
        print(f"    平均周转时长: {report.average_turnover_hours}小时")
        
        self.assertEqual(len(intervals), report.total_intervals)
        print(f"  ✓ 区间记录与报告统计一致")
    
    def test_9_interval_review(self):
        print("\n[测试9] 异常区间人工复核")
        ward = "外科一病区"
        
        patient = Patient(patient_id="P201", name="复核测试患者")
        bed = Bed(bed_number="SURG-001", ward=ward, department="外科")
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM201",
            patient_id="P201",
            bed_id=bed.id,
            ward=ward,
            department="外科",
            admission_time=datetime(2024, 1, 10, 9, 0),
            discharge_time=datetime(2024, 1, 10, 9, 20)
        )
        self.db.add(admission)
        self.db.commit()
        
        request = TurnoverCalculationRequest(
            ward=ward,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31)
        )
        report, intervals = generate_turnover_report(self.db, request)
        
        abnormal_ids = [i.id for i in intervals if i.is_abnormal]
        self.assertTrue(len(abnormal_ids) > 0)
        
        reviewed = review_intervals(
            self.db,
            interval_ids=abnormal_ids,
            review_notes="经核实为转科过渡，属正常情况",
            reviewed_by="护士长",
            approve=True
        )
        
        self.assertEqual(len(reviewed), len(abnormal_ids))
        for interval in reviewed:
            self.assertEqual(interval.status, "reviewed")
            self.assertFalse(interval.needs_review)
        
        print(f"  ✓ 人工复核完成，已复核 {len(reviewed)} 个区间")
        print(f"    复核人: {reviewed[0].reviewed_by}")
        print(f"    复核备注: {reviewed[0].review_notes}")
    
    def test_10_export_report(self):
        print("\n[测试10] 报告导出")
        ward = "内科二病区"
        
        patient = Patient(patient_id="P301", name="导出测试")
        bed = Bed(bed_number="WARD2-001", ward=ward, department="内科")
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM301",
            patient_id="P301",
            bed_id=bed.id,
            ward=ward,
            department="内科",
            admission_time=datetime(2024, 1, 15, 8, 0),
            discharge_time=datetime(2024, 1, 20, 14, 0)
        )
        self.db.add(admission)
        self.db.commit()
        
        request = TurnoverCalculationRequest(
            ward=ward,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            report_name="导出测试报告"
        )
        report, intervals = generate_turnover_report(self.db, request)
        
        os.makedirs("test_exports", exist_ok=True)
        output_path = f"test_exports/{report.report_id}.xlsx"
        
        result = export_report_to_excel(self.db, report.report_id, output_path)
        
        self.assertTrue(os.path.exists(output_path))
        self.assertEqual(result["report_id"], report.report_id)
        self.assertTrue(result["record_count"] > 0)
        
        print(f"  ✓ Excel报告导出成功")
        print(f"    导出路径: {output_path}")
        print(f"    导出记录数: {result['record_count']}")
        
        os.remove(output_path)
        os.rmdir("test_exports")
    
    def test_11_error_handling_already_reviewed(self):
        print("\n[测试11] 错误处理 - 已复核记录不可重复操作")
        ward = "测试病区"
        
        patient = Patient(patient_id="P401", name="错误测试")
        bed = Bed(bed_number="TEST-001", ward=ward, department="测试科")
        self.db.add_all([patient, bed])
        self.db.commit()
        
        admission = Admission(
            admission_number="ADM401",
            patient_id="P401",
            bed_id=bed.id,
            ward=ward,
            department="测试科",
            admission_time=datetime(2024, 1, 20, 8, 0),
            discharge_time=datetime(2024, 1, 20, 8, 15)
        )
        self.db.add(admission)
        self.db.commit()
        
        request = TurnoverCalculationRequest(
            ward=ward,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31)
        )
        report, intervals = generate_turnover_report(self.db, request)
        
        interval_ids = [i.id for i in intervals]
        review_intervals(self.db, interval_ids, "第一次复核", "测试员", True)
        
        intervals_after_first = self.db.query(TurnoverInterval).filter(
            TurnoverInterval.id.in_(interval_ids)
        ).all()
        
        first_reviewed_by = [i.reviewed_by for i in intervals_after_first]
        self.assertEqual(first_reviewed_by, ["测试员"] * len(intervals_after_first))
        
        review_intervals(self.db, interval_ids, "第二次复核", "测试员2", True)
        
        intervals_after_second = self.db.query(TurnoverInterval).filter(
            TurnoverInterval.id.in_(interval_ids)
        ).all()
        
        second_reviewed_by = [i.reviewed_by for i in intervals_after_second]
        self.assertEqual(second_reviewed_by, ["测试员"] * len(intervals_after_second))
        
        print(f"  ✓ 已复核记录正确跳过，复核人未被覆盖")


def run_all_tests():
    print("=" * 60)
    print("床位周转转科拆分异常区间系统 - 自检脚本")
    print("=" * 60)
    print(f"测试开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestBedTurnoverSystem)
    
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    print(f"测试完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"总测试数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✓ 所有测试通过！系统功能正常。")
        return 0
    else:
        print("\n✗ 部分测试失败，请检查代码！")
        if result.failures:
            print("\n失败详情:")
            for test, traceback in result.failures:
                print(f"  - {test}: {traceback.splitlines()[-1]}")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
