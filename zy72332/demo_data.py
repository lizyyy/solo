from typing import Dict, Any, List
from datetime import datetime, timedelta
import os

from models import ProcessingType
from store import DataStore
from importer import DataImporter
from annotation import AnnotationManager
from grouping import GroupingEngine


class DemoDataGenerator:
    """演示数据生成器 - 包含三种典型处理场景"""

    def __init__(self, base_dir: str = "data"):
        self.store = DataStore(base_dir)
        self.importer = DataImporter(self.store)
        self.annotation_manager = AnnotationManager(self.store)
        self.grouping_engine = GroupingEngine(self.store)
        self._ensure_screenshot_dir()

    def _ensure_screenshot_dir(self):
        screenshot_dir = os.path.join(self.store.base_dir, "screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)
        return screenshot_dir

    def generate_all(self) -> Dict[str, Any]:
        """生成所有演示数据"""
        results = {}

        print("=" * 60)
        print("正在生成演示数据...")
        print("=" * 60)

        results["smooth"] = self._generate_smooth_record()
        results["duplicate"] = self._generate_duplicate_record()
        results["old_standard"] = self._generate_old_standard_record()

        print("\n" + "=" * 60)
        print("演示数据生成完成！")
        print(f"  - 顺利记录: {results['smooth']['record_id']}")
        print(f"  - 两版答案记录: {results['duplicate']['record_id']}")
        print(f"  - 旧口径补录记录: {results['old_standard']['record_id']}")
        print("=" * 60)

        return results

    def _generate_smooth_record(self) -> Dict[str, Any]:
        """生成一条顺利处理的记录 - 类型1: 顺利记录"""
        print("\n[1/3] 生成顺利记录（望京SOHO店）...")

        record = self.importer.create_new_record(
            store_id="ST001",
            store_name="望京SOHO店",
            processing_type=ProcessingType.SMOOTH,
            operator="小祁"
        )

        screenshot_dir = self._ensure_screenshot_dir()
        screenshot_path = os.path.join(screenshot_dir, f"formula_{record.record_id}_v1.png")
        self.importer.import_screenshot(
            record_id=record.record_id,
            screenshot_path=screenshot_path,
            formula_text="距离度量分群公式 v1: 距离 = (人流×0.4 + 销售额×0.4 + 复购率×0.2) / 100",
            description="2026年5月旧公式截图 - 第一次导入",
            operator="小祁"
        )

        self.importer.import_student_answers(
            record_id=record.record_id,
            answers_data=[{
                "student_id": "S001",
                "student_name": "小明",
                "submission_time": datetime.now() - timedelta(hours=2),
                "content": {
                    "foot_traffic": 85,
                    "sales_amount": 90,
                    "customer_loyalty": 88,
                    "notes": "望京SOHO工作日人流稳定"
                },
                "version": 1
            }],
            operator="小祁"
        )

        self.grouping_engine.run_grouping(record.record_id, operator="小祁")

        return {
            "record_id": record.record_id,
            "store_name": record.store_name,
            "processing_type": ProcessingType.SMOOTH.value
        }

    def _generate_duplicate_record(self) -> Dict[str, Any]:
        """生成同一学生交两版答案的记录 - 类型2: 同一学生两版答案"""
        print("\n[2/3] 生成两版答案记录（国贸商城店）...")

        record = self.importer.create_new_record(
            store_id="ST002",
            store_name="国贸商城店",
            processing_type=ProcessingType.DUPLICATE,
            operator="小祁"
        )

        screenshot_dir = self._ensure_screenshot_dir()
        screenshot_path = os.path.join(screenshot_dir, f"formula_{record.record_id}_v1.png")
        self.importer.import_screenshot(
            record_id=record.record_id,
            screenshot_path=screenshot_path,
            formula_text="距离度量分群公式 v1: 距离 = (人流×0.4 + 销售额×0.4 + 复购率×0.2) / 100",
            description="2026年5月旧公式截图 - 第一次导入",
            operator="小祁"
        )

        self.importer.import_student_answers(
            record_id=record.record_id,
            answers_data=[
                {
                    "student_id": "S002",
                    "student_name": "小红",
                    "submission_time": datetime.now() - timedelta(hours=5),
                    "content": {
                        "foot_traffic": 72,
                        "sales_amount": 78,
                        "customer_loyalty": 65,
                        "notes": "国贸商城周末人流高峰明显"
                    },
                    "version": 1
                },
                {
                    "student_id": "S002",
                    "student_name": "小红",
                    "submission_time": datetime.now() - timedelta(hours=1),
                    "content": {
                        "foot_traffic": 88,
                        "sales_amount": 92,
                        "customer_loyalty": 75,
                        "notes": "修正：国贸商城含地下一层数据，之前漏统计"
                    },
                    "version": 2
                }
            ],
            operator="小祁"
        )

        self.importer.mark_for_review(record.record_id, operator="小祁")

        return {
            "record_id": record.record_id,
            "store_name": record.store_name,
            "processing_type": ProcessingType.DUPLICATE.value
        }

    def _generate_old_standard_record(self) -> Dict[str, Any]:
        """生成老师批注补录旧口径的记录 - 类型3: 老师批注补录旧口径"""
        print("\n[3/3] 生成旧口径补录记录（三里屯太古里店）...")

        record = self.importer.create_new_record(
            store_id="ST003",
            store_name="三里屯太古里店",
            processing_type=ProcessingType.OLD_STANDARD_SUPPLEMENT,
            operator="小祁"
        )

        screenshot_dir = self._ensure_screenshot_dir()
        screenshot_path = os.path.join(screenshot_dir, f"formula_{record.record_id}_v1.png")
        self.importer.import_screenshot(
            record_id=record.record_id,
            screenshot_path=screenshot_path,
            formula_text="距离度量分群公式 v1: 距离 = (人流×0.4 + 销售额×0.4 + 复购率×0.2) / 100",
            description="2026年5月旧公式截图 - 第一次导入",
            operator="小祁"
        )

        self.importer.import_student_answers(
            record_id=record.record_id,
            answers_data=[{
                "student_id": "S003",
                "student_name": "小刚",
                "submission_time": datetime.now() - timedelta(hours=3),
                "content": {
                    "foot_traffic": 95,
                    "sales_amount": 88,
                    "customer_loyalty": 70,
                    "notes": "三里屯夜经济活跃，22点后人流仍较高"
                },
                "version": 1
            }],
            operator="小祁"
        )

        self.grouping_engine.run_grouping(record.record_id, operator="小祁")

        self.annotation_manager.add_annotation(
            record_id=record.record_id,
            teacher_name="李老师",
            content="三里屯店按照2025年旧口径，商圈系数需要×0.85，因为当时统计范围不包含北区",
            old_standard_reference="2025版门店分群口径规范第3.2.1条",
            error_explanation_update="根据李老师批注补录旧口径：三里屯店商圈系数×0.85，最终分群需按此调整",
            operator="小祁"
        )

        self.annotation_manager.manual_correct(
            record_id=record.record_id,
            correction_note="应用2025年旧口径：商圈系数调整为0.85",
            operator="小祁"
        )

        self.grouping_engine.re_run(record.record_id, operator="小祁")

        return {
            "record_id": record.record_id,
            "store_name": record.store_name,
            "processing_type": ProcessingType.OLD_STANDARD_SUPPLEMENT.value
        }
