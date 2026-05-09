from typing import List, Dict, Any
import json
from datetime import datetime
from pathlib import Path

from .models import TollRecord, AuditStatus, AuditResult
from .data_loader import DataLoader
from .vehicle_rule_engine import VehicleRuleEngine
from .route_validator import RouteValidator


class AuditEngine:
    def __init__(self, custom_rules=None, custom_routes=None):
        self.data_loader = DataLoader()
        self.vehicle_engine = VehicleRuleEngine(custom_rules)
        self.route_validator = RouteValidator(custom_routes)
        
        self.processed_ids: set = set()
        self.processed_records: Dict[str, TollRecord] = {}
        self.audit_results: Dict[str, AuditResult] = {}
    
    def run_audit(self, file_path: str) -> Dict[str, Any]:
        print(f"\n{'='*60}")
        print(f"开始稽核: {file_path}")
        print(f"{'='*60}\n")
        
        records, load_stats = self.data_loader.load_file(file_path)
        
        self._print_load_stats(load_stats)
        
        new_records = self._filter_new_records(records)
        
        if not new_records:
            print("\n无新记录需要处理\n")
            return self._generate_final_report(load_stats, {})
        
        vehicle_results = self.vehicle_engine.validate(new_records)
        self._print_vehicle_stats(self.vehicle_engine.get_stats(vehicle_results))
        
        all_results = self.route_validator.validate(new_records, vehicle_results)
        self._print_route_stats(self.route_validator.get_stats(all_results))
        
        self._update_records_status(new_records, all_results)
        self._store_results(new_records, all_results)
        
        final_stats = self._calculate_final_stats(all_results)
        self._print_final_results(final_stats, all_results)
        
        return self._generate_final_report(load_stats, final_stats, all_results)
    
    def _filter_new_records(self, records: List[TollRecord]) -> List[TollRecord]:
        new_records = []
        
        for record in records:
            if record.record_id in self.processed_ids:
                print(f"警告：记录 {record.record_id} 已处理过，跳过")
                continue
            new_records.append(record)
        
        return new_records
    
    def _update_records_status(self, records: List[TollRecord], results: List[AuditResult]) -> None:
        for record, result in zip(records, results):
            if result.vehicle_type_issue or result.route_issue:
                result.final_status = AuditStatus.SUSPICIOUS
                record.status = AuditStatus.SUSPICIOUS
                record.issues = result.review_notes
            else:
                result.final_status = AuditStatus.PASSED
                record.status = AuditStatus.PASSED
    
    def _store_results(self, records: List[TollRecord], results: List[AuditResult]) -> None:
        for record, result in zip(records, results):
            self.processed_ids.add(record.record_id)
            self.processed_records[record.record_id] = record
            self.audit_results[record.record_id] = result
    
    def _print_load_stats(self, stats: Dict[str, Any]) -> None:
        print("【数据导入统计】")
        print(f"  - 总数据行数: {stats['total_lines']}")
        print(f"  - 有效记录数: {stats['valid_records']}")
        print(f"  - 无效记录数: {stats['invalid_records']}")
        print(f"  - 重复记录数: {stats['duplicate_records']}")
        
        if stats['invalid_records'] > 0:
            print("\n  无效记录详情:")
            for idx, item in enumerate(stats['invalid_details'], 1):
                print(f"    [{idx}] 行号: {item['line']}, 错误: {item['error']}")
        
        if stats['duplicate_records'] > 0:
            print("\n  重复记录详情:")
            for idx, item in enumerate(stats['duplicate_details'], 1):
                print(f"    [{idx}] 行号: {item['line']}, 错误: {item['error']}")
    
    def _print_vehicle_stats(self, stats: Dict[str, Any]) -> None:
        print(f"\n【车型规则校验】")
        print(f"  - 校验记录数: {stats['total_records']}")
        print(f"  - 车型异常数: {stats['vehicle_type_issues']}")
        print(f"  - 车型校验通过率: {stats['vehicle_type_pass_rate']:.1f}%")
    
    def _print_route_stats(self, stats: Dict[str, Any]) -> None:
        print(f"\n【路径校验】")
        print(f"  - 校验记录数: {stats['total_records']}")
        print(f"  - 路径异常数: {stats['route_issues']}")
        print(f"  - 路径校验通过率: {stats['route_pass_rate']:.1f}%")
    
    def _calculate_final_stats(self, results: List[AuditResult]) -> Dict[str, Any]:
        total = len(results)
        needs_review = sum(1 for r in results if r.needs_manual_review)
        passed = sum(1 for r in results if r.final_status == AuditStatus.PASSED)
        suspicious = sum(1 for r in results if r.final_status == AuditStatus.SUSPICIOUS)
        vehicle_only = sum(1 for r in results if r.vehicle_type_issue and not r.route_issue)
        route_only = sum(1 for r in results if r.route_issue and not r.vehicle_type_issue)
        both_issues = sum(1 for r in results if r.vehicle_type_issue and r.route_issue)
        
        return {
            "total": total,
            "passed": passed,
            "suspicious": suspicious,
            "needs_manual_review": needs_review,
            "vehicle_type_only_issues": vehicle_only,
            "route_only_issues": route_only,
            "both_issues": both_issues,
            "pass_rate": (passed / total * 100) if total > 0 else 0
        }
    
    def _print_final_results(self, stats: Dict[str, Any], results: List[AuditResult]) -> None:
        print(f"\n{'='*60}")
        print("【稽核结果汇总】")
        print(f"{'='*60}")
        print(f"  - 总处理记录数: {stats['total']}")
        print(f"  - 通过记录数: {stats['passed']}")
        print(f"  - 疑似异常数: {stats['suspicious']}")
        print(f"  - 需人工复核数: {stats['needs_manual_review']}")
        print(f"  - 整体通过率: {stats['pass_rate']:.1f}%")
        
        if stats['needs_manual_review'] > 0:
            print(f"\n【需人工复核的记录详情】")
            for idx, result in enumerate(results, 1):
                if result.needs_manual_review:
                    print(f"\n  记录 [{idx}]:")
                    print(f"    记录ID: {result.record_id}")
                    print(f"    车牌号: {result.plate_number}")
                    print(f"    车型: {result.vehicle_type}")
                    
                    if result.vehicle_type_issue:
                        print(f"    【车型不符证据】: {result.vehicle_type_evidence}")
                    
                    if result.route_issue:
                        print(f"    【路径异常证据】: {result.route_evidence}")
                    
                    print(f"    稽核状态: {result.final_status.value}")
        
        print(f"\n{'='*60}\n")
    
    def _generate_final_report(self, load_stats: Dict[str, Any], 
                                audit_stats: Dict[str, Any],
                                results: List[AuditResult] = None) -> Dict[str, Any]:
        report = {
            "audit_time": datetime.now().isoformat(),
            "version": "1.0.0",
            "data_import": load_stats,
            "audit_results": audit_stats,
            "review_items": []
        }
        
        if results:
            for result in results:
                if result.needs_manual_review:
                    report["review_items"].append({
                        "record_id": result.record_id,
                        "plate_number": result.plate_number,
                        "vehicle_type": result.vehicle_type,
                        "vehicle_type_issue": result.vehicle_type_issue,
                        "vehicle_type_evidence": result.vehicle_type_evidence,
                        "route_issue": result.route_issue,
                        "route_evidence": result.route_evidence,
                        "final_status": result.final_status.value,
                        "review_notes": result.review_notes
                    })
        
        return report
    
    def export_report(self, report: Dict[str, Any], output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return str(path)
    
    def get_overall_stats(self) -> Dict[str, Any]:
        all_results = list(self.audit_results.values())
        total = len(all_results)
        passed = sum(1 for r in all_results if r.final_status == AuditStatus.PASSED)
        suspicious = sum(1 for r in all_results if r.final_status == AuditStatus.SUSPICIOUS)
        needs_review = sum(1 for r in all_results if r.needs_manual_review)
        
        return {
            "total_processed": total,
            "passed": passed,
            "suspicious": suspicious,
            "needs_manual_review": needs_review,
            "pass_rate": (passed / total * 100) if total > 0 else 0
        }
