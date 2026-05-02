"""
示例数据模块 - 生成测试数据和自检功能
"""

import csv
import json
import os
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from .models import (
    OrderCase, PatientInfo, ToothPosition, MaterialInfo,
    ResinBatch, PostProcessingRecord, MaterialType, OrderStatus
)


class SampleDataGenerator:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = output_dir or tempfile.gettempdir()
    
    def generate_sample_orders(self, count: int = 5, include_errors: bool = False) -> List[Dict[str, Any]]:
        sample_orders = []
        
        patient_names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"]
        tooth_positions = ["11,12", "13-16", "21,22,23", "36,37", "45,46", "11", "21,22", "31,32,41,42"]
        materials = [("树脂", "A2"), ("陶瓷", "A3"), ("树脂", "B1"), ("金属", "原色"), ("陶瓷", "A1")]
        batch_numbers = ["RES-2024-001", "RES-2024-002", "CER-2024-015", "MET-2024-008"]
        
        for i in range(count):
            idx = i % len(patient_names)
            
            order = {
                "case_id": f"CASE-{20240501 + i:08d}",
                "patient_id": f"P{2024050000 + i:010d}",
                "patient_name": patient_names[idx],
                "gender": "男" if i % 2 == 0 else "女",
                "age": 25 + (i * 5) % 50,
                "tooth_position": tooth_positions[idx % len(tooth_positions)],
                "material_type": materials[idx % len(materials)][0],
                "color_shade": materials[idx % len(materials)][1],
                "resin_batch": batch_numbers[idx % len(batch_numbers)],
                "resin_expiration": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            }
            
            if include_errors and i % 3 == 0:
                if i % 6 == 0:
                    order["tooth_position"] = "99,100"
                elif i % 6 == 3:
                    order["color_shade"] = "INVALID_COLOR"
                else:
                    order["resin_expiration"] = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
            sample_orders.append(order)
        
        return sample_orders
    
    def write_sample_orders_csv(self, file_path: str, count: int = 5, include_errors: bool = False):
        sample_orders = self.generate_sample_orders(count, include_errors)
        
        if not sample_orders:
            return
        
        fieldnames = list(sample_orders[0].keys())
        
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(sample_orders)
        
        return file_path
    
    def generate_sample_model_files(self, directory: str, count: int = 3) -> List[str]:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        
        created_files = []
        
        sample_content = "This is a dummy STL/3MF file for testing purposes."
        
        for i in range(count):
            file_name = f"model_P{2024050000 + i:010d}_T{i+11}.stl"
            file_path = os.path.join(directory, file_name)
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(sample_content + f"\nGenerated at: {datetime.now().isoformat()}")
            
            created_files.append(file_path)
        
        return created_files
    
    def generate_sample_post_processing_records(self, directory: str, count: int = 3) -> List[str]:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        
        created_files = []
        
        processing_types = ["清洗固化", "抛光", "染色", "后处理"]
        operators = ["技师A", "技师B", "技师C"]
        
        for i in range(count):
            record = {
                "case_id": f"CASE-{20240501 + i:08d}",
                "processing_type": processing_types[i % len(processing_types)],
                "start_time": (datetime.now() - timedelta(hours=2, minutes=30 + i * 10)).strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": (datetime.now() - timedelta(hours=1, minutes=30 + i * 10)).strftime("%Y-%m-%d %H:%M:%S"),
                "operator": operators[i % len(operators)],
                "notes": f"正常后处理流程 - 病例 {i+1}"
            }
            
            file_name = f"post_processing_{20240501 + i:08d}.json"
            file_path = os.path.join(directory, file_name)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
            
            created_files.append(file_path)
        
        return created_files
    
    def create_complete_sample_workspace(self, workspace_path: str, include_errors: bool = True) -> Dict[str, Any]:
        from .models import Workspace
        
        ws = Workspace(
            root_path=workspace_path,
            creation_date=datetime.now()
        )
        
        os.makedirs(ws.orders_dir, exist_ok=True)
        os.makedirs(ws.models_dir, exist_ok=True)
        os.makedirs(ws.records_dir, exist_ok=True)
        os.makedirs(ws.quarantine_dir, exist_ok=True)
        os.makedirs(ws.output_dir, exist_ok=True)
        os.makedirs(ws.reports_dir, exist_ok=True)
        
        orders_csv_path = os.path.join(ws.orders_dir, "sample_orders.csv")
        self.write_sample_orders_csv(orders_csv_path, count=5, include_errors=include_errors)
        
        model_files = self.generate_sample_model_files(ws.models_dir, count=3)
        
        record_files = self.generate_sample_post_processing_records(ws.records_dir, count=3)
        
        config = {
            "workspace_id": ws.workspace_id,
            "created_at": datetime.now().isoformat(),
            "version": "1.0.0",
            "settings": {
                "default_material_validation": True,
                "strict_tooth_position": True,
                "quarantine_on_critical": True
            }
        }
        
        with open(ws.config_file, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        return {
            "workspace_path": workspace_path,
            "orders_csv": orders_csv_path,
            "model_files": model_files,
            "record_files": record_files,
            "config_file": ws.config_file,
            "directories": {
                "orders": ws.orders_dir,
                "models": ws.models_dir,
                "records": ws.records_dir,
                "quarantine": ws.quarantine_dir,
                "output": ws.output_dir,
                "reports": ws.reports_dir
            }
        }


class SelfTestRunner:
    def __init__(self):
        self.test_results = []
    
    def run_all_tests(self, workspace_path: Optional[str] = None) -> Dict[str, Any]:
        from .models import Workspace, OrderStatus
        from .csv_parser import CSVParser
        from .file_scanner import FileScanner
        from .rules_engine import RulesEngine
        from .quarantine import QuarantineManager
        from .packer import Packer
        from .reporter import Reporter
        
        use_temp = workspace_path is None
        
        if use_temp:
            workspace_path = os.path.join(tempfile.gettempdir(), "denture_checker_self_test")
        
        generator = SampleDataGenerator(workspace_path)
        
        workspace_info = generator.create_complete_sample_workspace(
            workspace_path, 
            include_errors=True
        )
        
        ws = Workspace(
            root_path=workspace_path,
            creation_date=datetime.now()
        )
        
        results = {
            "test_start_time": datetime.now().isoformat(),
            "workspace_path": workspace_path,
            "tests": [],
            "passed": 0,
            "failed": 0,
            "errors": []
        }
        
        test_name = "1. CSV 解析测试"
        try:
            parser = CSVParser()
            cases = parser.parse_file(workspace_info["orders_csv"])
            
            if len(cases) >= 3:
                results["tests"].append({
                    "test": test_name,
                    "status": "passed",
                    "details": f"成功解析 {len(cases)} 个病例"
                })
                results["passed"] += 1
            else:
                results["tests"].append({
                    "test": test_name,
                    "status": "failed",
                    "details": f"解析病例数不足: {len(cases)}"
                })
                results["failed"] += 1
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        test_name = "2. 文件扫描测试"
        try:
            scanner = FileScanner(workspace_path)
            scanned = scanner.scan_workspace(workspace_path)
            
            if len(scanned.get("model_files", [])) > 0:
                results["tests"].append({
                    "test": test_name,
                    "status": "passed",
                    "details": f"扫描到 {len(scanned['model_files'])} 个模型文件"
                })
                results["passed"] += 1
            else:
                results["tests"].append({
                    "test": test_name,
                    "status": "warning",
                    "details": "未扫描到模型文件（可能正常）"
                })
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        test_name = "3. 规则引擎测试"
        try:
            engine = RulesEngine()
            rules_summary = engine.get_rules_summary()
            
            validated_cases, validation_result = engine.validate_all_cases(cases)
            
            has_passed = any(c.status == OrderStatus.PASSED for c in validated_cases)
            has_quarantined = any(c.status == OrderStatus.QUARANTINED for c in validated_cases)
            
            results["tests"].append({
                "test": test_name,
                "status": "passed",
                "details": f"执行了 {len(rules_summary)} 条规则, 通过: {validation_result.passed_cases}, 隔离: {validation_result.quarantined_cases}"
            })
            results["passed"] += 1
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        test_name = "4. 隔离区测试"
        try:
            quarantine_manager = QuarantineManager(ws.quarantine_dir)
            quarantined_count = quarantine_manager.quarantine_cases(validated_cases)
            
            results["tests"].append({
                "test": test_name,
                "status": "passed",
                "details": f"隔离了 {quarantined_count} 个病例到 {ws.quarantine_dir}"
            })
            results["passed"] += 1
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        test_name = "5. 打包测试"
        try:
            packer = Packer(ws.output_dir)
            pack_result = packer.pack_passed_cases(validated_cases)
            
            results["tests"].append({
                "test": test_name,
                "status": "passed",
                "details": f"打包了 {pack_result['packed_count']} 个病例到 {pack_result.get('pack_dir', ws.output_dir)}"
            })
            results["passed"] += 1
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        test_name = "6. 报告生成测试"
        try:
            reporter = Reporter(ws.reports_dir)
            report_files = reporter.generate_report(
                validated_cases, 
                validation_result,
                report_name="self_test_report",
                formats=["json", "csv", "markdown"]
            )
            
            if len(report_files) >= 2:
                results["tests"].append({
                    "test": test_name,
                    "status": "passed",
                    "details": f"生成了 {len(report_files)} 个报告文件: {list(report_files.keys())}"
                })
                results["passed"] += 1
            else:
                results["tests"].append({
                    "test": test_name,
                    "status": "failed",
                    "details": f"报告生成不完整: {report_files}"
                })
                results["failed"] += 1
        except Exception as e:
            results["tests"].append({
                "test": test_name,
                "status": "error",
                "details": str(e)
            })
            results["errors"].append(str(e))
        
        results["test_end_time"] = datetime.now().isoformat()
        results["summary"] = {
            "total_tests": len(results["tests"]),
            "passed": results["passed"],
            "failed": results["failed"],
            "errors": len(results["errors"]),
            "success_rate": f"{(results['passed']/len(results['tests'])*100):.1f}%" if results["tests"] else "0%"
        }
        
        if use_temp:
            import shutil
            try:
                shutil.rmtree(workspace_path)
            except:
                pass
        
        return results
