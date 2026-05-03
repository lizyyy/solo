#!/usr/bin/env python3
"""
测试存储层和导出层
验证本地存储、历史记录、导出功能
"""

import sys
import json
import tempfile
import shutil
from pathlib import Path
from datetime import date, datetime, timedelta
from typing import List, Dict, Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.order import Order
from models.processing_status import ProcessingStatus
from models.workbench import Workbench, WorkbenchItem
from models.enums import OrderStatus
from storage.local_storage import LocalStorage
from storage.history import HistoryManager
from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_exporter import JSONExporter


class TestLocalStorage:
    """测试本地存储"""
    
    def test_workbench_save_load(self):
        """测试工作台保存和加载"""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalStorage()
            storage.data_dir = Path(tmpdir)
            storage.storage_file = Path(tmpdir) / "workbench_state.json"
            
            workbench = Workbench(name="测试工作台")
            
            order = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date(2024, 1, 15),
                is_urgent=True
            )
            
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date(2024, 1, 15),
                expected_delivery_date=date(2024, 1, 20),
                responsible_person="张工"
            )
            
            item = WorkbenchItem(order=order, processing_status=status)
            workbench.add_item(item)
            
            result = storage.save(workbench)
            assert result.success == True
            assert storage.storage_file.exists()
            
            loaded = storage.load()
            assert loaded is not None
            assert loaded.name == "测试工作台"
            assert loaded.item_count == 1
            assert loaded.get_item_by_model_id("MDL001").order.order_id == "ORD001"
            assert loaded.get_item_by_model_id("MDL001").order.is_urgent == True
            
            print("✅ test_workbench_save_load 通过")
    
    def test_import_export_file(self):
        """测试文件导入导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = LocalStorage()
            storage.data_dir = Path(tmpdir)
            
            workbench = Workbench(name="导出测试")
            
            order = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date.today()
            )
            
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=3)
            )
            
            item = WorkbenchItem(order=order, processing_status=status)
            workbench.add_item(item)
            
            export_path = Path(tmpdir) / "export.json"
            result = storage.export_to_file(export_path, workbench)
            assert result.success == True
            assert export_path.exists()
            
            imported, result = storage.import_from_file(export_path)
            assert result.success == True
            assert imported is not None
            assert imported.name == "导出测试"
            
            print("✅ test_import_export_file 通过")


class TestHistoryManager:
    """测试历史记录管理器"""
    
    def test_create_snapshot(self):
        """测试创建状态快照"""
        with tempfile.TemporaryDirectory() as tmpdir:
            history = HistoryManager()
            history.history_dir = Path(tmpdir)
            history.history_file = Path(tmpdir) / "history.json"
            history.max_size = 10
            
            workbench1 = Workbench(name="状态1")
            order1 = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date.today()
            )
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=3)
            )
            item1 = WorkbenchItem(order=order1, processing_status=status)
            workbench1.add_item(item1)
            
            history.create_snapshot_action(
                action="创建",
                description="初始状态",
                workbench=workbench1
            )
            
            assert history.can_undo == False
            assert history.can_redo == False
            assert len(history.history_list) == 1
            
            print("✅ test_create_snapshot 通过")
    
    def test_undo_redo(self):
        """测试撤销和重做"""
        with tempfile.TemporaryDirectory() as tmpdir:
            history = HistoryManager()
            history.history_dir = Path(tmpdir)
            history.history_file = Path(tmpdir) / "history.json"
            history.max_size = 10
            
            workbench1 = Workbench(name="状态1")
            order1 = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date.today()
            )
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=3)
            )
            item1 = WorkbenchItem(order=order1, processing_status=status)
            workbench1.add_item(item1)
            
            history.create_snapshot_action(
                action="修改",
                description="状态1",
                workbench=workbench1
            )
            
            workbench2 = Workbench(name="状态2")
            order2 = Order(
                order_id="ORD002",
                model_id="MDL002",
                doctor_name="李医生",
                patient_name="李四",
                tooth_position="#14",
                restoration_type="全瓷冠",
                order_date=date.today()
            )
            item2 = WorkbenchItem(order=order2, processing_status=status)
            workbench2.add_item(item2)
            
            history.create_snapshot_action(
                action="修改",
                description="状态2",
                workbench=workbench2
            )
            
            assert history.can_undo == True
            assert history.can_redo == False
            
            snapshot = history.undo()
            assert snapshot is not None
            assert snapshot["name"] == "状态1"
            assert history.can_undo == False
            assert history.can_redo == True
            
            snapshot = history.redo()
            assert snapshot is not None
            assert snapshot["name"] == "状态2"
            assert history.can_undo == True
            assert history.can_redo == False
            
            print("✅ test_undo_redo 通过")
    
    def test_history_size_limit(self):
        """测试历史记录大小限制"""
        with tempfile.TemporaryDirectory() as tmpdir:
            history = HistoryManager()
            history.history_dir = Path(tmpdir)
            history.history_file = Path(tmpdir) / "history.json"
            history.max_size = 3
            
            for i in range(5):
                workbench = Workbench(name=f"状态{i}")
                order = Order(
                    order_id=f"ORD{i:03d}",
                    model_id=f"MDL{i:03d}",
                    doctor_name="医生",
                    patient_name="患者",
                    tooth_position="#11",
                    restoration_type="烤瓷冠",
                    order_date=date.today()
                )
                status = ProcessingStatus(
                    current_status=OrderStatus.PROCESSING,
                    received_date=date.today(),
                    expected_delivery_date=date.today() + timedelta(days=3)
                )
                item = WorkbenchItem(order=order, processing_status=status)
                workbench.add_item(item)
                
                history.create_snapshot_action(
                    action="修改",
                    description=f"状态{i}",
                    workbench=workbench
                )
            
            assert len(history.history_list) == 3
            assert history.current_index == 2
            
            print("✅ test_history_size_limit 通过")


class TestMarkdownExporter:
    """测试Markdown导出器"""
    
    def test_markdown_export(self):
        """测试Markdown交付单导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workbench = Workbench(name="今日复核台")
            
            order = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11-#12",
                restoration_type="烤瓷冠",
                order_date=date(2024, 1, 15),
                is_urgent=True
            )
            
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date(2024, 1, 15),
                expected_delivery_date=date(2024, 1, 20),
                responsible_person="张工"
            )
            
            item = WorkbenchItem(order=order, processing_status=status)
            workbench.add_item(item)
            
            exporter = MarkdownExporter()
            output_path = Path(tmpdir) / "delivery_note.md"
            result = exporter.export(workbench, output_path)
            
            assert result.success == True
            assert output_path.exists()
            
            content = output_path.read_text(encoding='utf-8')
            assert "今日复核台" in content
            assert "ORD001" in content
            assert "MDL001" in content
            assert "张医生" in content
            assert "张三" in content
            assert "#11-#12" in content
            assert "烤瓷冠" in content
            
            print("✅ test_markdown_export 通过")


class TestCSVExporter:
    """测试CSV导出器"""
    
    def test_csv_issues_export(self):
        """测试问题表CSV导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workbench = Workbench(name="测试")
            exporter = CSVExporter()
            output_path = Path(tmpdir) / "issues.csv"
            result = exporter.export_issues(workbench, output_path)
            assert result.success == True
            print("✅ test_csv_issues_export 通过")
    
    def test_csv_orders_export(self):
        """测试订单表CSV导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workbench = Workbench(name="测试")
            
            order = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date.today()
            )
            
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=3)
            )
            
            item = WorkbenchItem(order=order, processing_status=status)
            workbench.add_item(item)
            
            exporter = CSVExporter()
            output_path = Path(tmpdir) / "orders.csv"
            result = exporter.export_orders(workbench, output_path)
            
            assert result.success == True
            assert output_path.exists()
            
            print("✅ test_csv_orders_export 通过")


class TestJSONExporter:
    """测试JSON导出器"""
    
    def test_json_audit_export(self):
        """测试审计包JSON导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workbench = Workbench(name="审计测试")
            
            order = Order(
                order_id="ORD001",
                model_id="MDL001",
                doctor_name="张医生",
                patient_name="张三",
                tooth_position="#11",
                restoration_type="烤瓷冠",
                order_date=date.today()
            )
            
            status = ProcessingStatus(
                current_status=OrderStatus.PROCESSING,
                received_date=date.today(),
                expected_delivery_date=date.today() + timedelta(days=3)
            )
            
            item = WorkbenchItem(order=order, processing_status=status)
            workbench.add_item(item)
            
            exporter = JSONExporter()
            output_path = Path(tmpdir) / "audit.json"
            result = exporter.export_audit_package(workbench, output_path)
            
            assert result.success == True
            assert output_path.exists()
            
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert "metadata" in data
            assert "summary" in data
            assert "workbench" in data
            assert data["workbench"]["name"] == "审计测试"
            
            print("✅ test_json_audit_export 通过")
    
    def test_json_daily_report(self):
        """测试日报JSON导出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            workbench = Workbench(name="日报测试")
            exporter = JSONExporter()
            output_path = Path(tmpdir) / "daily_report.json"
            result = exporter.export_daily_report(workbench, output_path)
            assert result.success == True
            print("✅ test_json_daily_report 通过")


def main():
    """运行所有测试"""
    print("=" * 60)
    print("存储层和导出层测试")
    print("=" * 60)
    
    print("\n[1/3] 测试本地存储...")
    storage_tests = TestLocalStorage()
    storage_tests.test_workbench_save_load()
    storage_tests.test_import_export_file()
    
    print("\n[2/3] 测试历史记录管理器...")
    history_tests = TestHistoryManager()
    history_tests.test_create_snapshot()
    history_tests.test_undo_redo()
    history_tests.test_history_size_limit()
    
    print("\n[3/3] 测试导出层...")
    print("  [3.1] Markdown导出器...")
    markdown_tests = TestMarkdownExporter()
    markdown_tests.test_markdown_export()
    
    print("  [3.2] CSV导出器...")
    csv_tests = TestCSVExporter()
    csv_tests.test_csv_issues_export()
    csv_tests.test_csv_orders_export()
    
    print("  [3.3] JSON导出器...")
    json_tests = TestJSONExporter()
    json_tests.test_json_audit_export()
    json_tests.test_json_daily_report()
    
    print("\n" + "=" * 60)
    print("✅ 所有存储层和导出层测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    main()
