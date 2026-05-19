import unittest
from datetime import datetime, timedelta
import os
import tempfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import Base
from models import HazardStatus, HazardLevel
from schemas import (
    HazardCreate, HazardUpdate, ResponsiblePersonCreate,
    RectificationCreate, RecheckCreate, HazardPhotoCreate
)
from services import HazardService, BatchOperationService, ExportService
from repositories import ResponsiblePersonRepository


class TestHazardSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(cls.engine)

    def test_1_create_responsible_person(self):
        repo = ResponsiblePersonRepository(self.db)
        person = repo.create(ResponsiblePersonCreate(
            name="张三",
            phone="13800138000",
            department="安全部",
            position="安全员"
        ))
        self.db.commit()
        
        self.assertIsNotNone(person.id)
        self.assertEqual(person.name, "张三")
        self.assertTrue(person.is_active)

    def test_2_create_hazard(self):
        repo = ResponsiblePersonRepository(self.db)
        person = repo.create(ResponsiblePersonCreate(name="李四"))
        self.db.commit()

        service = HazardService(self.db)
        hazard_data = HazardCreate(
            title="电缆井积水",
            description="B区电缆井存在积水",
            location="B区地下一层",
            location_detail="电缆井#3",
            level=HazardLevel.MEDIUM,
            discoverer="王五",
            deadline=datetime.utcnow() + timedelta(days=7),
            department="工程部",
            team="电气班",
            responsible_person_id=person.id,
            photos=[
                HazardPhotoCreate(
                    file_path="/photos/20240101_001.jpg",
                    file_name="现场照片.jpg",
                    photo_type="discovery"
                )
            ]
        )
        
        hazard = service.create_hazard(hazard_data, operator="测试员")
        
        self.assertIsNotNone(hazard.id)
        self.assertIsNotNone(hazard.hazard_code)
        self.assertEqual(hazard.status, HazardStatus.ASSIGNED)
        self.assertEqual(len(hazard.photos), 1)
        self.assertTrue(len(hazard.rule_check_results) > 0)

    def test_3_hazard_workflow(self):
        repo = ResponsiblePersonRepository(self.db)
        person = repo.create(ResponsiblePersonCreate(name="赵六"))
        self.db.commit()

        service = HazardService(self.db)
        hazard = service.create_hazard(HazardCreate(
            title="消防通道堵塞",
            location="A区一楼",
            responsible_person_id=person.id,
            photos=[
                HazardPhotoCreate(file_path="/photos/1.jpg", file_name="堵塞.jpg")
            ]
        ))

        hazard = service.start_rectification(hazard.id)
        self.assertEqual(hazard.status, HazardStatus.RECTIFYING)

        hazard = service.submit_rectification(
            hazard.id,
            RectificationCreate(
                rectifier="赵六",
                description="已清理通道杂物",
                measures="移走堆放的货物，设置警示标识",
                photos=[
                    {"file_path": "/photos/rect1.jpg", "file_name": "整改后.jpg"}
                ]
            )
        )
        self.assertEqual(hazard.status, HazardStatus.RECHECKING)

        hazard = service.submit_recheck(
            hazard.id,
            RecheckCreate(
                rechecker="审核员",
                result=True,
                description="整改合格",
                suggestion="保持通道畅通",
                photos=[
                    {"file_path": "/photos/recheck1.jpg", "file_name": "复查.jpg"}
                ]
            )
        )
        
        self.assertEqual(len(hazard.rectifications), 1)
        self.assertEqual(len(hazard.rechecks), 1)

    def test_4_close_hazard_without_photos_should_fail(self):
        repo = ResponsiblePersonRepository(self.db)
        person = repo.create(ResponsiblePersonCreate(name="钱七"))
        self.db.commit()

        service = HazardService(self.db)
        hazard = service.create_hazard(HazardCreate(
            title="无照片隐患",
            location="C区",
            responsible_person_id=person.id,
            photos=[]
        ))

        can_close, messages, hazard = service.close_hazard(hazard.id)
        self.assertFalse(can_close)
        self.assertTrue(any("缺少" in msg for msg in messages))

    def test_5_batch_import(self):
        batch_service = BatchOperationService(self.db)
        
        hazard_data_list = [
            {
                "title": "批量导入隐患1",
                "description": "测试批量导入",
                "location": "D区",
                "responsible_person": "周八",
                "photos": [{"file_path": "/photos/batch1.jpg"}]
            },
            {
                "title": "批量导入隐患2",
                "location": "E区",
                "responsible_person": "吴九"
            },
            {
                "title": "",
                "location": "F区"
            }
        ]

        result = batch_service.import_hazards(hazard_data_list, operator="批量导入员")
        
        self.assertEqual(result.total_count, 3)
        self.assertEqual(result.success_count, 2)
        self.assertEqual(result.failed_count, 1)
        
        success_items = [item for item in result.items if item.success]
        self.assertEqual(len(success_items), 2)
        
        failed_items = [item for item in result.items if not item.success]
        self.assertEqual(len(failed_items), 1)

        fetched_result = batch_service.get_batch_result(result.batch_no)
        self.assertIsNotNone(fetched_result)
        self.assertEqual(fetched_result.batch_no, result.batch_no)

    def test_6_duplicate_hazard_detection(self):
        service = HazardService(self.db)
        
        hazard1 = service.create_hazard(HazardCreate(
            title="重复隐患测试",
            location="重复位置",
            photos=[{"file_path": "/photos/dup1.jpg"}]
        ))

        hazard2 = service.create_hazard(HazardCreate(
            title="重复隐患测试",
            location="重复位置",
            photos=[{"file_path": "/photos/dup2.jpg"}]
        ))

        self.assertTrue(hazard2.is_duplicate)
        self.assertIsNotNone(hazard2.duplicate_with)

    def test_7_export_service(self):
        service = HazardService(self.db)
        for i in range(5):
            service.create_hazard(HazardCreate(
                title=f"导出测试隐患{i}",
                location=f"测试区域{i}",
                photos=[{"file_path": f"/photos/export{i}.jpg"}]
            ))

        export_service = ExportService(self.db)
        export_rows = export_service.export_hazards()
        
        self.assertGreaterEqual(len(export_rows), 5)
        
        excel_bytes = export_service.export_to_excel()
        self.assertGreater(len(excel_bytes), 0)

    def test_8_statistics(self):
        export_service = ExportService(self.db)
        stats = export_service.get_statistics()
        
        self.assertIn("total", stats)
        self.assertIn("closed", stats)
        self.assertIn("open", stats)
        self.assertIn("closed_rate", stats)
        self.assertIn("status_distribution", stats)

    def test_9_hazard_filter(self):
        from schemas import HazardFilter
        
        service = HazardService(self.db)
        
        person = ResponsiblePersonRepository(self.db).create(
            ResponsiblePersonCreate(name="筛选测试人")
        )
        self.db.commit()

        for i in range(3):
            service.create_hazard(HazardCreate(
                title=f"部门测试{i}",
                location="筛选区域",
                department="测试部门",
                responsible_person_id=person.id,
                photos=[{"file_path": f"/photos/filter{i}.jpg"}]
            ))

        filter_params = HazardFilter(department="测试部门")
        filtered = service.list_hazards(filter_params)
        
        self.assertGreaterEqual(len(filtered), 3)
        
        count = service.count_hazards(filter_params)
        self.assertGreaterEqual(count, 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
