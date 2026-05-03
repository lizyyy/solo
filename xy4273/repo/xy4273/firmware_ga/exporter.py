import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import asdict, is_dataclass
from enum import Enum


class ExportError(Exception):
    pass


class DataclassJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Path):
            return str(obj)
        return super().default(obj)


class Exporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _flatten_dict(self, d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep=sep).items())
            elif isinstance(v, list):
                items.append((new_key, json.dumps(v, ensure_ascii=False)))
            else:
                items.append((new_key, v))
        return dict(items)
    
    def export_to_json(
        self,
        data: Any,
        filename: str,
        indent: int = 2
    ) -> Path:
        output_path = self.output_dir / filename
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=indent, cls=DataclassJSONEncoder, ensure_ascii=False)
            return output_path
        except Exception as e:
            raise ExportError(f"JSON导出失败: {e}")
    
    def export_to_csv(
        self,
        data: List[Dict[str, Any]],
        filename: str,
        fieldnames: Optional[List[str]] = None,
        flatten: bool = True
    ) -> Path:
        output_path = self.output_dir / filename
        
        if not data:
            with open(output_path, 'w', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(fieldnames or [])
            return output_path
        
        processed_data = []
        for item in data:
            if flatten:
                processed_data.append(self._flatten_dict(item))
            else:
                processed_data.append(item)
        
        if fieldnames is None:
            all_keys = set()
            for item in processed_data:
                all_keys.update(item.keys())
            fieldnames = sorted(list(all_keys))
        
        try:
            with open(output_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
                writer.writeheader()
                for item in processed_data:
                    row = {}
                    for key in fieldnames:
                        value = item.get(key, '')
                        if isinstance(value, (list, dict)):
                            value = json.dumps(value, ensure_ascii=False)
                        row[key] = value
                    writer.writerow(row)
            return output_path
        except Exception as e:
            raise ExportError(f"CSV导出失败: {e}")
    
    def export_to_markdown(
        self,
        data: Dict[str, Any],
        filename: str,
        title: str = "固件灰度升级审计报告",
        include_tables: bool = True
    ) -> Path:
        output_path = self.output_dir / filename
        
        try:
            lines = []
            
            lines.append(f"# {title}")
            lines.append("")
            lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            if 'summary' in data:
                lines.append("## 概览")
                lines.append("")
                summary = data['summary']
                if isinstance(summary, dict):
                    for key, value in summary.items():
                        lines.append(f"- **{key}**: {value}")
                else:
                    lines.append(str(summary))
                lines.append("")
            
            if 'statistics' in data:
                lines.append("## 统计信息")
                lines.append("")
                stats = data['statistics']
                if isinstance(stats, dict):
                    lines.append("| 指标 | 数值 |")
                    lines.append("|------|------|")
                    for key, value in stats.items():
                        lines.append(f"| {key} | {value} |")
                lines.append("")
            
            if 'validation_results' in data:
                lines.append("## 校验结果")
                lines.append("")
                validations = data['validation_results']
                if validations:
                    passed_count = sum(1 for v in validations if v.get('passed', False))
                    failed_count = len(validations) - passed_count
                    
                    lines.append(f"- **通过**: {passed_count}")
                    lines.append(f"- **失败**: {failed_count}")
                    lines.append("")
                    
                    if include_tables:
                        lines.append("### 详细校验结果")
                        lines.append("")
                        lines.append("| 设备ID | 校验项 | 结果 | 消息 |")
                        lines.append("|--------|--------|------|------|")
                        
                        for result in validations:
                            device_id = result.get('device_id', 'N/A')
                            for validation in result.get('validations', []):
                                check = validation.get('check', 'N/A')
                                passed = "✅ 通过" if validation.get('passed') else "❌ 失败"
                                message = validation.get('message', '')
                                lines.append(f"| {device_id} | {check} | {passed} | {message} |")
                lines.append("")
            
            if 'batch_plan' in data:
                lines.append("## 分批计划")
                lines.append("")
                batches = data['batch_plan']
                if batches:
                    lines.append("| 批次ID | 优先级 | 设备数量 | 窗口ID | 延迟(小时) |")
                    lines.append("|--------|--------|----------|--------|------------|")
                    for batch in batches:
                        lines.append(
                            f"| {batch.get('batch_id', 'N/A')} | "
                            f"{batch.get('priority', 'N/A')} | "
                            f"{batch.get('device_count', 0)} | "
                            f"{batch.get('window_id', 'N/A')} | "
                            f"{batch.get('delay_hours', 0)} |"
                        )
                lines.append("")
            
            if 'rollback_records' in data:
                lines.append("## 回滚记录")
                lines.append("")
                rollbacks = data['rollback_records']
                if rollbacks:
                    lines.append("| 设备ID | 回滚时间 | 从版本 | 到版本 | 原因 | 状态 |")
                    lines.append("|--------|----------|--------|--------|------|------|")
                    for record in rollbacks:
                        status = "✅ 成功" if record.get('success') else "❌ 失败"
                        lines.append(
                            f"| {record.get('device_id', 'N/A')} | "
                            f"{record.get('rollback_time', 'N/A')} | "
                            f"{record.get('from_version', 'N/A')} | "
                            f"{record.get('to_version', 'N/A')} | "
                            f"{record.get('reason', 'N/A')} | "
                            f"{status} |"
                        )
                lines.append("")
            
            if 'telemetry_stats' in data:
                lines.append("## 遥测统计")
                lines.append("")
                telemetry = data['telemetry_stats']
                if isinstance(telemetry, dict):
                    lines.append("| 指标 | 数值 |")
                    lines.append("|------|------|")
                    for key, value in telemetry.items():
                        if isinstance(value, dict):
                            continue
                        lines.append(f"| {key} | {value} |")
                    
                    if 'state_counts' in telemetry:
                        lines.append("")
                        lines.append("### 设备状态分布")
                        lines.append("")
                        lines.append("| 状态 | 设备数 |")
                        lines.append("|------|--------|")
                        for state, count in telemetry['state_counts'].items():
                            lines.append(f"| {state} | {count} |")
                lines.append("")
            
            if 'discrepancies' in data:
                lines.append("## 数据不一致")
                lines.append("")
                discrepancies = data['discrepancies']
                if discrepancies:
                    lines.append("| 设备ID | 问题 | 详情 |")
                    lines.append("|--------|------|------|")
                    for disc in discrepancies:
                        lines.append(
                            f"| {disc.get('device_id', 'N/A')} | "
                            f"{disc.get('issue', 'N/A')} | "
                            f"{disc.get('details', 'N/A')} |"
                        )
                else:
                    lines.append("未发现数据不一致问题。")
                lines.append("")
            
            if 'notes' in data:
                lines.append("## 备注")
                lines.append("")
                lines.append(str(data['notes']))
                lines.append("")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return output_path
        except Exception as e:
            raise ExportError(f"Markdown导出失败: {e}")
    
    def create_audit_package(
        self,
        report_data: Dict[str, Any],
        base_filename: str = "audit_report"
    ) -> Dict[str, Path]:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        package = {}
        
        json_filename = f"{base_filename}_{timestamp}.json"
        package['json'] = self.export_to_json(report_data, json_filename)
        
        csv_data = report_data.get('validation_results', [])
        if csv_data:
            csv_filename = f"{base_filename}_{timestamp}.csv"
            package['csv'] = self.export_to_csv(csv_data, csv_filename)
        
        md_filename = f"{base_filename}_{timestamp}.md"
        package['markdown'] = self.export_to_markdown(report_data, md_filename)
        
        return package
    
    def export_validation_summary(
        self,
        validation_results: List[Dict[str, Any]],
        base_filename: str = "validation"
    ) -> Dict[str, Path]:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        passed = [r for r in validation_results if r.get('passed', False)]
        failed = [r for r in validation_results if not r.get('passed', False)]
        
        summary = {
            "summary": {
                "total_devices": len(validation_results),
                "passed": len(passed),
                "failed": len(failed)
            },
            "validation_results": validation_results
        }
        
        results = {}
        
        json_path = self.export_to_json(
            summary,
            f"{base_filename}_summary_{timestamp}.json"
        )
        results['json'] = json_path
        
        flat_results = []
        for result in validation_results:
            base = {
                'device_id': result['device_id'],
                'overall_passed': result['passed'],
                'summary': result.get('summary', '')
            }
            for v in result.get('validations', []):
                check_name = v['check']
                base[f"{check_name}_passed"] = v['passed']
                base[f"{check_name}_message"] = v['message']
            flat_results.append(base)
        
        csv_path = self.export_to_csv(
            flat_results,
            f"{base_filename}_results_{timestamp}.csv"
        )
        results['csv'] = csv_path
        
        return results
    
    def export_upgrade_history(
        self,
        upgrade_records: List[Dict[str, Any]],
        rollback_records: List[Dict[str, Any]],
        base_filename: str = "upgrade_history"
    ) -> Dict[str, Path]:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        data = {
            "upgrade_records": upgrade_records,
            "rollback_records": rollback_records,
            "summary": {
                "total_upgrades": len(upgrade_records),
                "total_rollbacks": len(rollback_records)
            }
        }
        
        results = {}
        
        json_path = self.export_to_json(
            data,
            f"{base_filename}_{timestamp}.json"
        )
        results['json'] = json_path
        
        if upgrade_records:
            csv_path = self.export_to_csv(
                upgrade_records,
                f"{base_filename}_upgrades_{timestamp}.csv"
            )
            results['csv_upgrades'] = csv_path
        
        if rollback_records:
            csv_rollback_path = self.export_to_csv(
                rollback_records,
                f"{base_filename}_rollbacks_{timestamp}.csv"
            )
            results['csv_rollbacks'] = csv_rollback_path
        
        return results
